import { parseJSON } from "@/lib/utils";
import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export interface ImageResponseData {
  text: string;
  type: string;
  data: string;
  mimeType: string;
}

export interface MCPServerDescriptor {
  id: string;
  title: string;
  description: string;
  transport: "stdio" | "streamable-http" | "sse";
  url?: string;
  command?: string;
  args?: string[];
  auth?: {
    type: "bearer";
    configured: boolean;
    sessionTokenEnabled: boolean;
  };
}

export interface MCPToolDescriptor {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: boolean;
  };
  category: "system" | "generic" | "business";
}

export interface MCPServerDiagnostics {
  connected: boolean;
  status: "connected" | "failed";
  checkedAt: number;
  latencyMs: number;
  error?: string;
  tools: MCPToolDescriptor[];
}

export interface ToolCallLogEntry {
  id: string;
  tool: string;
  args: string;
  startedAt?: number;
  finishedAt?: number;
  runtime?: string;
  success?: boolean;
  output?: unknown;
}

export interface AgentResponse {
  text: string;
  id?: string;
  started?: boolean;
  finished?: boolean;
  name?: string;
  timestamp?: number;
  arguments?: string;
  runtime?: string;
  image?: ImageResponseData;
  json?: Record<string, any>;
  html?: ImageResponseData;
}

export interface ChatItem {
  prompt: string;
  response: AgentResponse;
}

export interface ChatSessionState {
  tokens: number;
  items: ChatItem[];
  sending: boolean;
  connected: boolean;
  templateId: number;
  prompt: string;
  toolResponseId: string;
  mcpServers: MCPServerDescriptor[];
  selectedMcpServerIds: string[];
  mcpDiagnostics: Record<string, MCPServerDiagnostics>;
  toolCallLog: ToolCallLogEntry[];
  defaultModel: string;
  selectedModel: string;
  supportedModels: string[];
  llmProvider: string;
}

const initialState: ChatSessionState = {
  tokens: 0,
  items: [],
  sending: false,
  connected: false,
  templateId: 0,
  prompt: "",
  toolResponseId: "",
  mcpServers: [],
  selectedMcpServerIds: [],
  mcpDiagnostics: {},
  toolCallLog: [],
  defaultModel: "ollama/llama3.1",
  selectedModel: "ollama/llama3.1",
  supportedModels: ["ollama/llama3.1"],
  llmProvider: "ollama",
};

const chatSessionSlice = createSlice({
  name: "chatSession",
  initialState,
  reducers: {
    addHTMLItem: (
      state,
      action: PayloadAction<{
        type: string;
        text: string;
        data: string;
        mimeType: string;
      }>
    ) => {
      const htmlItem = action.payload;
      const item = {
        prompt: "",
        response: {
          text: "[html]",
          html: htmlItem,
        },
      };
      state.items.push(item);
    },
    addImageItem: (
      state,
      action: PayloadAction<{
        type: string;
        text: string;
        data: string;
        mimeType: string;
      }>
    ) => {
      const imageItem = action.payload;
      const item = {
        prompt: "",
        response: {
          text: "[image]",
          image: imageItem,
        },
      };
      state.items.push(item);
    },
    addChartItem: (
      state,
      action: PayloadAction<{
        id: string;
        output: { text: string; type: string };
      }>
    ) => {
      const chartItem = action.payload;
      const json = parseJSON(chartItem.output.text);
      const item = {
        prompt: "",
        response: {
          text: "[chart]",
          json,
        },
      };
      state.items.push(item);
    },
    addToolCall(
      state,
      action: PayloadAction<{
        sessionId: string;
        id: string;
        name?: string;
        timestamp: number;
        arguments?: string;
        finished?: boolean;
      }>
    ) {
      const item = state.items.find(
        (i) => i.response && i.response.id === action.payload.id
      );
      if (item) {
        item.response = {
          ...item.response,
          text: "[tool_call]",
          finished: true,
          started: false,
          runtime: (
            (action.payload.timestamp - item.response.timestamp!) /
            1000
          ).toFixed(1),
        };
      } else {
        state.items.push(
          {
            prompt: "",
            response: {
              ...action.payload,
              name: action.payload.name,
              arguments: action.payload.arguments,
              text: `[tool_call]`,
              started: true,
              finished: false,
            },
          },
          {
            prompt: "",
            response: {
              text: "",
            },
          }
        );
      }

      const existingLog = state.toolCallLog.find(
        (entry) => entry.id === action.payload.id
      );
      if (existingLog) {
        existingLog.finishedAt = action.payload.finished
          ? action.payload.timestamp
          : existingLog.finishedAt;
        existingLog.runtime = item?.response.runtime || existingLog.runtime;
      } else {
        state.toolCallLog.unshift({
          id: action.payload.id,
          tool: action.payload.name || "Unknown tool",
          args: action.payload.arguments || "{}",
          startedAt: action.payload.timestamp,
        });
      }
    },
    setToolCallOutput(
      state,
      action: PayloadAction<{
        id: string;
        tool: string;
        output: unknown;
      }>
    ) {
      const existingLog = state.toolCallLog.find(
        (entry) => entry.id === action.payload.id
      );
      const success = !(
        typeof action.payload.output === "object" &&
        action.payload.output &&
        "error" in (action.payload.output as Record<string, unknown>)
      );
      if (existingLog) {
        existingLog.output = action.payload.output;
        existingLog.tool = action.payload.tool;
        existingLog.success = success;
        if (!existingLog.finishedAt) {
          existingLog.finishedAt = Date.now();
        }
      } else {
        state.toolCallLog.unshift({
          id: action.payload.id,
          tool: action.payload.tool,
          args: "{}",
          finishedAt: Date.now(),
          success,
          output: action.payload.output,
        });
      }
    },
    setTokens(state, action: PayloadAction<number>) {
      state.tokens = action.payload;
    },
    setItems(state, action: PayloadAction<ChatItem[]>) {
      state.items = action.payload;
    },
    addItem(state, action: PayloadAction<ChatItem>) {
      state.items.push(action.payload);
    },
    updateLastResponse(state, action: PayloadAction<string>) {
      let index = -1;
      for (let i = state.items.length - 1; i >= 0; i--) {
        if (
          typeof state.items[i].response.json === "undefined" &&
          typeof state.items[i].response.image === "undefined"
        ) {
          index = i;
          break;
        }
      }
      if (index >= 0 && state.items[index]) {
        state.items[index].response.text += action.payload;
      }
    },
    setSending(state, action: PayloadAction<boolean>) {
      state.sending = action.payload;
    },
    setPrompt(state, action: PayloadAction<string>) {
      state.prompt = action.payload;
    },
    setConnected(state, action: PayloadAction<boolean>) {
      state.connected = action.payload;
    },
    setTemplateId(state, action: PayloadAction<number>) {
      state.templateId = action.payload;
    },
    showToolResponse(state, action: PayloadAction<string>) {
      state.toolResponseId = action.payload;
    },
    setMCPServers(state, action: PayloadAction<MCPServerDescriptor[]>) {
      state.mcpServers = action.payload;
    },
    setSelectedMcpServers(state, action: PayloadAction<string[]>) {
      state.selectedMcpServerIds = action.payload;
    },
    setMcpDiagnostics(
      state,
      action: PayloadAction<Record<string, MCPServerDiagnostics>>
    ) {
      state.mcpDiagnostics = action.payload;
    },
    setModelConfig(
      state,
      action: PayloadAction<{
        defaultModel: string;
        supportedModels: string[];
        llmProvider: string;
      }>
    ) {
      state.defaultModel = action.payload.defaultModel;
      state.supportedModels = action.payload.supportedModels;
      state.llmProvider = action.payload.llmProvider;
      if (!state.selectedModel) {
        state.selectedModel = action.payload.defaultModel;
      }
    },
    setSelectedModel(state, action: PayloadAction<string>) {
      state.selectedModel = action.payload;
    },
    setChatSession(state, action: PayloadAction<Partial<ChatSessionState>>) {
      state.tokens =
        typeof action.payload.tokens === "undefined"
          ? state.tokens
          : action.payload.tokens;
      state.items =
        typeof action.payload.items === "undefined"
          ? state.items
          : action.payload.items;
      state.sending =
        typeof action.payload.sending === "undefined"
          ? state.sending
          : action.payload.sending;
      state.connected =
        typeof action.payload.connected === "undefined"
          ? state.connected
          : action.payload.connected;
      state.selectedMcpServerIds =
        typeof action.payload.selectedMcpServerIds === "undefined"
          ? state.selectedMcpServerIds
          : action.payload.selectedMcpServerIds;
      state.mcpDiagnostics =
        typeof action.payload.mcpDiagnostics === "undefined"
          ? state.mcpDiagnostics
          : action.payload.mcpDiagnostics;
      state.toolCallLog =
        typeof action.payload.toolCallLog === "undefined"
          ? state.toolCallLog
          : action.payload.toolCallLog;
      state.selectedModel =
        typeof action.payload.selectedModel === "undefined"
          ? state.selectedModel
          : action.payload.selectedModel;
    },
  },
});

export const {
  setTokens,
  setItems,
  setSending,
  setConnected,
  setChatSession,
  updateLastResponse,
  addItem,
  addToolCall,
  setToolCallOutput,
  setTemplateId,
  setPrompt,
  showToolResponse,
  addChartItem,
  setMCPServers,
  setSelectedMcpServers,
  setMcpDiagnostics,
  setModelConfig,
  setSelectedModel,
  addImageItem,
  addHTMLItem,
} = chatSessionSlice.actions;
export default chatSessionSlice.reducer;
