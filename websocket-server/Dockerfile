# WebSocket Bridge Server Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files and tsconfig
COPY package*.json tsconfig.json ./

# Install all dependencies (need devDependencies for build)
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Remove devDependencies after build
RUN npm prune --omit=dev

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "dist/server.js"]
