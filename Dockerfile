FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
COPY client/package*.json ./client/
RUN npm ci && cd client && npm ci

COPY . .
RUN cd client && npm run build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/client/dist ./client/dist
COPY src ./src
COPY tsconfig.json ./tsconfig.json
COPY mcp.json ./mcp.json
COPY .env.template ./.env.template

EXPOSE 3000

CMD ["npx", "tsx", "--env-file=.env", "src/index.ts"]
