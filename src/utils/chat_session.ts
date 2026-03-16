import {
  Agent,
  AgentInputItem,
  MCPServerStreamableHttp,
  OpenAIChatCompletionsModel,
  MCPServer,
} from "@openai/agents";
import OpenAI from "openai";
import { AgentsHelper } from "./agents_helper";
import SystemPrompt from "../instructions/system_prompt";
import codingAgentInstructions from "../instructions/coding_agent_instructions";
import { now } from "./index";
import {
  createExternalMcpServerInstance,
  loadExternalMcpServers,
} from "./external_mcp";

const TOOL_RESPONSE_PURGE_THRESHOLD = 1024 * 3;
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || "ollama/llama3.1";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1";
const LLM_PROVIDER = (process.env.LLM_PROVIDER || "ollama").toLowerCase();

loadExternalMcpServers();

const createOpenAIClient = () => {
  if (LLM_PROVIDER === "ollama") {
    return new OpenAI({
      apiKey: process.env.OLLAMA_API_KEY || "ollama",
      baseURL: OLLAMA_BASE_URL,
    });
  }
  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_API_BASE_URL,
  });
};

const myMCPServer = new MCPServerStreamableHttp({
  url: process.env.BACKEND_URL + "/mcp",
  name: "MCP Server",
  authProvider: {
    redirectToAuthorization: () => {
      return true;
    },
    clientMetadata: {
      scope: [],
    },
    saveCodeVerifier: () => {
      return true;
    },
    clientInformation: () => {
      return {
        client_id: "test",
        scope: [],
        metaData: {
          scope: [],
        },
      };
    },
    saveClientInformation: () => {
      return {
        id: "test",
      };
    },
    tokens: () => {
      return {
        access_token: process.env.DEV_ACCESS_TOKEN || "DEV_ACCESS_TOKEN",
        expires_in: 360000000000,
        token_type: "Bearer",
      };
    },
  },
});

export class ChatSession {
  public history: AgentInputItem[] = [];

  constructor(
    public sessionId: string = "",
    public userId: string = "",
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public sessionAccessToken: string = "",
    public selectedModel: string = DEFAULT_MODEL,

    public openai = createOpenAIClient(),

    public modelPrimary = new OpenAIChatCompletionsModel(
      openai,
      selectedModel
    ),

    public codingAgent = new Agent({
      model: modelPrimary,
      name: "Coding AI Agent",
      instructions: codingAgentInstructions,
      handoffDescription:
        "Use this agent when you need to create a single HTML/JavaScript/CSS web page application based on user input. Or if you need to generate code snippets or assist with programming tasks. Or you need to demonstrate something visually and it can be done using HTML/CSS/JavaScript.",
    }),

    public genericAgent = new Agent({
      model: modelPrimary,
      name: "Generic AI Agent",
      instructions: SystemPrompt.replace(/\%\%NOW\%\%/gi, now()),
      mcpServers: [myMCPServer] as MCPServer[],
      handoffs: [codingAgent],
      modelSettings: {
        parallelToolCalls: false,
      },
    })
  ) {}

  update() {
    this.updatedAt = new Date();
  }

  setAccessToken(token: string) {
    this.sessionAccessToken = token;
  }

  setModel(model: string) {
    this.selectedModel = model || DEFAULT_MODEL;
    this.modelPrimary = new OpenAIChatCompletionsModel(this.openai, this.selectedModel);
    this.codingAgent.model = this.modelPrimary;
    this.genericAgent.model = this.modelPrimary;
  }

  addHistory(item: AgentInputItem) {
    this.history.push(item);
    this.update();
  }

  setHistory(history: AgentInputItem[]) {
    this.history = this.purgeContext(history);
    this.genericAgent.instructions = SystemPrompt.replace(
      /\%\%NOW\%\%/gi,
      now()
    );
    console.log("Setting history for session", {
      sessionId: this.sessionId,
      history_size: this.getContextSize(),
    });
    this.update();
  }

  purgeContext(history: AgentInputItem[]) {
    return history.map((record) => {
      if (record.type === "function_call_result" && record.output) {
        return {
          ...record,
          id: record.id && record.id === "FAKE_ID" ? undefined : record.id,
          output: {
            ...record.output,
            text:
              ((record.output as any).text || "").length >
              TOOL_RESPONSE_PURGE_THRESHOLD
                ? "[RAW RESULT PURGED. USE DATA FROM NEXT ITEMS IN HISTORY. CALL TOOL AGAIN IF NEED RAW DATA WHICH IS NOT AVAILABLE IN NEXT HISTORY ITEMS]"
                : (record.output as any).text,
          },
        } as any;
      }
      return record;
    });
  }

  getContextSize() {
    return JSON.stringify(this.history).length;
  }

  flushHistory() {
    console.log("Flushing history for session", {
      sessionId: this.sessionId,
      history_size: this.getContextSize(),
    });
    this.history = [];
    this.update();
  }

  async startStream(
    prompt: string | AgentInputItem[],
    mcpServers: string[],
    accessToken?: string,
    model?: string
  ) {
    if (accessToken) {
      this.setAccessToken(accessToken);
    }
    if (model) {
      this.setModel(model);
    }

    const dynamicServers = mcpServers
      .map((id) => createExternalMcpServerInstance(id, this.sessionAccessToken))
      .filter(Boolean) as MCPServer[];

    this.genericAgent.mcpServers = [myMCPServer].concat(dynamicServers);
    return await AgentsHelper.stream(this.genericAgent, prompt);
  }
}
