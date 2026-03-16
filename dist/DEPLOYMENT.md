# Docker Deployment Guide

## Overview

This project can be deployed as a single Node.js container serving:
- the built React frontend
- the Express + WebSocket backend
- the local MCP HTTP endpoint

The container is designed to work best with an external Ollama service.

## Recommended production topology

### Option A: host machine runs Ollama
- `mcp-chat-ui` runs in Docker
- `ollama` runs on the host machine
- `LOGIN_API_URL` points to your FastAPI auth service
- external FastMCP / FastAPI gateway remains outside this container

Example:
- App: `http://localhost:3000`
- Ollama: `http://host.docker.internal:11434/v1`
- Auth API: `http://host.docker.internal:8000/api/v1/auth/login`

### Option B: remote Ollama server
- set `OLLAMA_BASE_URL=http://YOUR_OLLAMA_HOST:11434/v1`
- keep the app container unchanged

## Files added
- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`

## Quick start

1. Copy env file:
   ```bash
   cp .env.template .env
   ```
2. Update `.env`:
   ```env
   NODE_ENV=production
   LLM_PROVIDER=ollama
   DEFAULT_MODEL=ollama/llama3.1
   OLLAMA_BASE_URL=http://host.docker.internal:11434/v1
   OLLAMA_API_KEY=ollama
   LOGIN_ENABLED=true
   LOGIN_API_URL=http://host.docker.internal:8000/api/v1/auth/login
   BACKEND_URL=http://localhost:3000
   FRONTEND_URL=http://localhost:3000
   DEV_ACCESS_TOKEN=DEV_ACCESS_TOKEN
   ```
3. Start service:
   ```bash
   docker compose up -d --build
   ```
4. Access app:
   ```text
   http://localhost:3000
   ```

## Notes

- On Linux, `host.docker.internal` may require Docker Engine support for `host-gateway`. This compose file already includes `extra_hosts` for that.
- If your external MCP servers are also containerized, point `mcp.json` URLs to reachable internal DNS names or external addresses.
- For hosted LLM use, switch to:
  ```env
  LLM_PROVIDER=openrouter
  OPENROUTER_API_KEY=your_key
  OPENROUTER_API_BASE_URL=https://openrouter.ai/api/v1
  ```

## Packaging

A downloadable archive can be generated with:

```bash
tar -czf dist/mcp-chat-ui-docker-YYYY-MM-DD.tar.gz \
  --exclude=node_modules \
  --exclude=client/node_modules \
  --exclude=client/dist \
  .
```
