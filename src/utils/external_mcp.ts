import { parseJSON } from ".";
import path from "path";
import fs from "fs";
import {
  MCPServer,
  MCPServerStdio,
  MCPServerStreamableHttp,
  MCPTool,
} from "@openai/agents";

type MCPTransportType = "stdio" | "streamable-http" | "sse";
type MCPAuthType = "bearer";

export interface ExternalMcpServerAuthConfig {
  type: MCPAuthType;
  token?: string;
  useSessionToken?: boolean;
}

export interface ExternalMcpServerConfig {
  description?: string;
  transport?: MCPTransportType;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string;
  auth?: ExternalMcpServerAuthConfig;
  toolFilter?: {
    allowedToolNames?: string[];
    blockedToolNames?: string[];
  };
}

export interface ExternalMcpServerSummary {
  id: string;
  title: string;
  description: string;
  transport: MCPTransportType;
  url?: string;
  command?: string;
  args?: string[];
  auth?: {
    type: MCPAuthType;
    configured: boolean;
    sessionTokenEnabled: boolean;
  };
}

export interface ExternalMcpToolSummary {
  name: string;
  description: string;
  inputSchema: MCPTool["inputSchema"];
  category: "system" | "generic" | "business";
}

export interface ExternalMcpServerDiagnostics {
  connected: boolean;
  status: "connected" | "failed";
  checkedAt: number;
  latencyMs: number;
  error?: string;
  tools: ExternalMcpToolSummary[];
}

export interface ExternalMcpServerRuntime {
  config: ExternalMcpServerConfig;
  summary: ExternalMcpServerSummary;
  createServer: (sessionToken?: string) => MCPServer;
}

const EXTERNAL_MCP_SERVER_RUNTIMES = {} as Record<string, ExternalMcpServerRuntime>;
export const EXTERNAL_MCP_SERVERS_CONFIG = {} as Record<
  string,
  ExternalMcpServerSummary
>;

const SYSTEM_TOOL_NAMES = new Set([
  "health",
  "security_policy",
  "smoke_test",
  "list_endpoints",
  "list_allowed_endpoints",
]);
const GENERIC_TOOL_NAMES = new Set(["call_api", "call_api_form"]);

const resolveEnvValue = (value?: string) => {
  if (!value) {
    return value;
  }
  return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name) => {
    return process.env[name] || "";
  });
};

const getTransport = (config: ExternalMcpServerConfig): MCPTransportType => {
  if (config.transport) {
    return config.transport;
  }
  if (config.url) {
    return "streamable-http";
  }
  return "stdio";
};

const toSummary = (
  id: string,
  config: ExternalMcpServerConfig
): ExternalMcpServerSummary => {
  const transport = getTransport(config);
  const token = resolveEnvValue(config.auth?.token);
  return {
    id,
    title: config.description || id,
    description: config.description || id,
    transport,
    url: config.url,
    command: config.command,
    args: config.args,
    auth: config.auth
      ? {
          type: config.auth.type,
          configured: Boolean(token),
          sessionTokenEnabled: Boolean(config.auth.useSessionToken),
        }
      : undefined,
  };
};

const createRequestInit = (
  config: ExternalMcpServerConfig,
  sessionToken?: string
) => {
  const configuredToken = resolveEnvValue(config.auth?.token);
  const token =
    config.auth?.useSessionToken && sessionToken ? sessionToken : configuredToken;
  if (config.auth?.type === "bearer" && token) {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  }
  return undefined;
};

const createServerFactory = (
  id: string,
  config: ExternalMcpServerConfig
): ExternalMcpServerRuntime | null => {
  const transport = getTransport(config);
  const summary = toSummary(id, config);

  const createServer = (sessionToken?: string): MCPServer => {
    if (transport === "stdio") {
      return new MCPServerStdio({
        name: id,
        command: config.command!,
        args: config.args,
        cwd: config.cwd,
        env: config.env,
        cacheToolsList: false,
        toolFilter: config.toolFilter,
      });
    }

    return new MCPServerStreamableHttp({
      name: id,
      url: config.url!,
      cacheToolsList: false,
      toolFilter: config.toolFilter,
      requestInit: createRequestInit(config, sessionToken),
    });
  };

  if (transport === "stdio" && !config.command) {
    return null;
  }
  if (transport !== "stdio" && !config.url) {
    return null;
  }

  return {
    config,
    summary,
    createServer,
  };
};

export const getToolCategory = (
  toolName: string
): ExternalMcpToolSummary["category"] => {
  if (SYSTEM_TOOL_NAMES.has(toolName)) {
    return "system";
  }
  if (GENERIC_TOOL_NAMES.has(toolName)) {
    return "generic";
  }
  return "business";
};

export const summarizeTool = (tool: MCPTool): ExternalMcpToolSummary => ({
  name: tool.name,
  description: tool.description || "No description available",
  inputSchema: tool.inputSchema,
  category: getToolCategory(tool.name),
});

export const getExternalMcpServerSummaries = () => EXTERNAL_MCP_SERVERS_CONFIG;

export const getExternalMcpServerRuntime = (id: string) =>
  EXTERNAL_MCP_SERVER_RUNTIMES[id];

export const createExternalMcpServerInstance = (
  id: string,
  sessionToken?: string
) => {
  const runtime = EXTERNAL_MCP_SERVER_RUNTIMES[id];
  return runtime ? runtime.createServer(sessionToken) : null;
};

export const listExternalMcpServerDiagnostics = async (
  selectedServerIds?: string[],
  sessionToken?: string
): Promise<Record<string, ExternalMcpServerDiagnostics>> => {
  const ids =
    selectedServerIds && selectedServerIds.length > 0
      ? selectedServerIds
      : Object.keys(EXTERNAL_MCP_SERVER_RUNTIMES);

  const result = {} as Record<string, ExternalMcpServerDiagnostics>;

  for (const id of ids) {
    const runtime = EXTERNAL_MCP_SERVER_RUNTIMES[id];
    if (!runtime) {
      continue;
    }

    const server = runtime.createServer(sessionToken);
    const startedAt = Date.now();
    try {
      await server.connect();
      const tools = await server.listTools();
      result[id] = {
        connected: true,
        status: "connected",
        checkedAt: Date.now(),
        latencyMs: Date.now() - startedAt,
        tools: tools.map(summarizeTool),
      };
    } catch (error: any) {
      result[id] = {
        connected: false,
        status: "failed",
        checkedAt: Date.now(),
        latencyMs: Date.now() - startedAt,
        error: error?.message || String(error),
        tools: [],
      };
    } finally {
      try {
        await server.close();
      } catch {
        // ignore close errors for diagnostics
      }
    }
  }

  return result;
};

export const loadExternalMcpServers = () => {
  Object.keys(EXTERNAL_MCP_SERVERS_CONFIG).forEach((key) => {
    delete EXTERNAL_MCP_SERVERS_CONFIG[key];
  });
  Object.keys(EXTERNAL_MCP_SERVER_RUNTIMES).forEach((key) => {
    delete EXTERNAL_MCP_SERVER_RUNTIMES[key];
  });

  const servers = {} as Record<string, MCPServer>;
  const config = parseJSON(
    fs.readFileSync(path.join(__dirname, "../../mcp.json"), "utf-8")
  ) as {
    mcpServers: Record<string, ExternalMcpServerConfig>;
  };

  if (config.mcpServers) {
    for (const [tag, serverConfig] of Object.entries(config.mcpServers)) {
      const runtime = createServerFactory(tag, serverConfig);
      if (!runtime) {
        continue;
      }
      EXTERNAL_MCP_SERVER_RUNTIMES[tag] = runtime;
      EXTERNAL_MCP_SERVERS_CONFIG[tag] = runtime.summary;
      servers[tag] = runtime.createServer();
    }
  }

  return servers;
};
