# MCP Server Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Expose health check port
EXPOSE 8081

# Health check — wget is built into Alpine, no CJS/ESM concerns
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:8081/health || exit 1

# Start server
CMD ["node", "dist/index.js"]
