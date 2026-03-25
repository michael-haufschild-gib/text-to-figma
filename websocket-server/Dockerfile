# WebSocket Bridge Server Dockerfile — multi-stage build
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "const s = require('net').connect(8080, '127.0.0.1', () => { s.destroy(); process.exit(0); }); s.on('error', () => process.exit(1)); setTimeout(() => process.exit(1), 3000);"

CMD ["node", "dist/server.js"]
