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

# Health check — TCP connection to verify WebSocket server is listening
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "const s = require('net').connect(8080, '127.0.0.1', () => { s.destroy(); process.exit(0); }); s.on('error', () => process.exit(1)); setTimeout(() => process.exit(1), 3000);"

# Start server
CMD ["node", "dist/server.js"]
