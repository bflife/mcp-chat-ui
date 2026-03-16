# MCP Chat UI

TypeScript/React chat UI for interacting with agents and MCP tools via WebSocket. **This project is not just a Chat UI — it is a boilerplate for building Model Context Protocol (MCP) servers and easily testing their capabilities by chatting with them.** The architecture enables rapid development, extension, and interactive experimentation with MCP agents and tools.

https://github.com/user-attachments/assets/ce39f244-9d77-4d29-b6e2-1119063653b8

## Agent & LLM Integration

Agents are run using the **OpenAI Agents SDK** for seamless integration with MCP. The project now supports **Ollama-first** deployment by default, while still allowing **OpenRouter** as an optional provider. With Ollama, you can run local models behind an OpenAI-compatible API endpoint, which is a strong fit for private FastMCP gateway workflows and local development. If needed, OpenRouter can still be enabled for access to hosted models through a unified API.

## Features

- Chat with AI agents and tools in real time
- Extensible tool system (register new tools by asking Copilot)
- During chat, users can see all tool calls with their arguments and responses for debugging purposes
- Chart rendering and data visualization
- Coding AI Canvas implementation, allowing users to create designs and interactive visualizations by providing a natural language description (like Gemini Canvas). 'f.e. a user could say "visualize inserting sorting algorithm" and the system would generate and show a interactive visual representation of the algorithm.'
- Google authentication integration
- Hot reload and fast development with Vite

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm

### Environment Setup

1. Copy `.env.template` to `.env`:
   ```bash
   cp .env.template .env
   ```
2. By default, configure Ollama in `.env`:
   - `LLM_PROVIDER=ollama`
   - `OLLAMA_BASE_URL=http://127.0.0.1:11434/v1`
   - `DEFAULT_MODEL=ollama/llama3.1`
3. If you prefer hosted models instead, set `LLM_PROVIDER=openrouter` and provide `OPENROUTER_API_KEY`. You can get your API key from [OpenRouter](https://openrouter.ai/).
4. (Optional) Set `GOOGLE_CLIENT_ID` in `.env` to enable Google authentication for the chat UI.
5. (Optional) Set `LOGIN_ENABLED=true` and `LOGIN_API_URL=...` to enable the password login page.

### Install Dependencies

```bash
# In project root
npm install
cd client
npm install

# or

npm run install_all

```

### Ollama Quick Start

```bash
# Start Ollama locally first
ollama serve

# Example model pull
ollama pull llama3.1
```

Then keep the default `.env` values for `LLM_PROVIDER`, `OLLAMA_BASE_URL`, and `DEFAULT_MODEL`.

### Run Development Server

```bash
# In project root
npm run dev
open http://localhost:5173/
```

### Start Production Build

```bash
# In project root
npm run start
open http://localhost:3000/
```

## Docker Deployment

### Deployment option 1: connect to a host Ollama service

This is the recommended deployment mode when Ollama is already running on the host or another machine.

1. Copy environment file:
   ```bash
   cp .env.template .env
   ```
2. Set at least:
   ```env
   NODE_ENV=production
   LLM_PROVIDER=ollama
   DEFAULT_MODEL=ollama/llama3.1
   OLLAMA_BASE_URL=http://host.docker.internal:11434/v1
   LOGIN_ENABLED=true
   LOGIN_API_URL=http://your-auth-service/api/v1/auth/login
   BACKEND_URL=http://localhost:3000
   FRONTEND_URL=http://localhost:3000
   ```
3. Start container:
   ```bash
   docker compose up -d --build
   ```
4. Open:
   ```text
   http://localhost:3000
   ```

### Deployment option 2: connect to remote Ollama

If Ollama runs on another server, set:

```env
OLLAMA_BASE_URL=http://YOUR_OLLAMA_HOST:11434/v1
```

Then run:

```bash
docker compose up -d --build
```

### Notes

- The app container exposes port `3000`.
- The current compose file assumes your auth API is external.
- If you use Linux and `host.docker.internal` is unavailable, replace it with the host IP or add an `extra_hosts` mapping.
- You can still switch to OpenRouter by setting `LLM_PROVIDER=openrouter` and providing `OPENROUTER_API_KEY`.

### Inspect MCP Server

```bash
# In project root
npm run inspect
```

## Registering New MCP Tools

You can add new server-side tools by simply asking Copilot:

> register new tool with name `my_tool_name`, input parameters `param1: string`, `param2: number`, output fields `result: string`

Copilot will generate the file and code for you. See `.github/copilot-instructions.md` for full details.

## Registering External MCP Servers

You can add new external MCP servers by editing the `mcp.json` file in the project root. List your server configuration in this file to make them available for selection in the chat UI.

### Example `mcp.json`

```jsonc
{
  "mcpServers": {
    "playwright": {
      "description": "Playwright MCP",
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--headless", "--isolated"]
    },
    "memory": {
      "description": "Server Memory MCP",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```

## Project Structure

- `client/` — React UI, organized by feature (chat, chart, common, ui)
- `src/server/` — WebSocket server, agent/tool orchestration
- `src/tools/` — MCP tools (auto-registered)
- `src/agents/` — Agent logic
- `.github/copilot-instructions.md` — AI agent instructions and conventions

## About

This project demonstrates a flexible, extensible chat UI for agent/tool workflows, **and serves as a boilerplate for building and interactively testing MCP servers and tools.** Developer productivity is powered by Copilot and clear conventions for rapid extension.
