# Deployment Runbook

## Overview

This runbook provides step-by-step instructions for deploying the Text-to-Figma system in various environments.

## Prerequisites

- Node.js 20.x or later
- npm 9.x or later
- Docker and Docker Compose (for containerized deployment)
- Access to deployment environment
- Figma Desktop app installed (for local development)

## Local Development Deployment

### Quick Start

```bash
# Clone repository
git clone https://github.com/michael-h-patrianna/text-to-figma.git
cd text-to-figma

# Install dependencies for all services
npm run setup

# Start all services
npm run dev
```

### Manual Step-by-Step

1. **Install WebSocket Bridge dependencies**
   ```bash
   cd websocket-server
   npm install
   ```

2. **Install MCP Server dependencies**
   ```bash
   cd ../mcp-server
   npm install
   ```

3. **Build MCP Server**
   ```bash
   npm run build
   ```

4. **Start WebSocket Bridge** (in separate terminal)
   ```bash
   cd websocket-server
   npm start
   ```
   - Verify: Should see "WebSocket bridge server started on port 8080"

5. **Start MCP Server** (in separate terminal)
   ```bash
   cd mcp-server
   npm start
   ```
   - Verify: Should see MCP server startup messages

6. **Verify Health**
   ```bash
   curl http://localhost:8081/health
   ```
   - Should return HTTP 200 with health status JSON

## Docker Compose Deployment

### Development Environment

```bash
# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services (with graceful shutdown)
docker-compose down

# Forceful stop if needed (not recommended)
docker-compose down --timeout 5
```

### Production Environment

1. **Set Environment Variables**
   Create `.env` file:
   ```env
   NODE_ENV=production
   LOG_LEVEL=warn
   FIGMA_WS_URL=ws://websocket-bridge:8080
   HEALTH_CHECK_ENABLED=true
   HEALTH_CHECK_PORT=8081
   ENABLE_METRICS=true
   ENABLE_ERROR_TRACKING=true
   GRACEFUL_SHUTDOWN_TIMEOUT=30000
   CIRCUIT_BREAKER_ENABLED=true
   RETRY_MAX_ATTEMPTS=3
   ```

2. **Build Production Images**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
   ```

3. **Deploy**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

4. **Verify Deployment**
   ```bash
   # Check health
   curl http://localhost:8081/health

   # Check logs
   docker-compose logs mcp-server
   docker-compose logs websocket-bridge
   ```

## Manual Production Deployment

### 1. Prepare Environment

```bash
# Create deployment directory
mkdir -p /opt/text-to-figma
cd /opt/text-to-figma

# Clone repository
git clone https://github.com/michael-h-patrianna/text-to-figma.git .

# Checkout production branch/tag
git checkout main  # or specific version tag
```

### 2. Install Dependencies

```bash
# WebSocket Bridge
cd websocket-server
npm ci --only=production

# MCP Server
cd ../mcp-server
npm ci
npm run build
npm prune --production
```

### 3. Configure Environment

Create `/opt/text-to-figma/mcp-server/.env`:
```env
NODE_ENV=production
LOG_LEVEL=warn
FIGMA_WS_URL=ws://localhost:8080
HEALTH_CHECK_PORT=8081
HEALTH_CHECK_ENABLED=true
GRACEFUL_SHUTDOWN_TIMEOUT=30000
CIRCUIT_BREAKER_ENABLED=true
CIRCUIT_BREAKER_THRESHOLD=5
RETRY_MAX_ATTEMPTS=3
```

### 4. Set Up Process Manager (PM2)

```bash
# Install PM2 globally
npm install -g pm2

# Start WebSocket Bridge
cd /opt/text-to-figma/websocket-server
pm2 start server.js --name websocket-bridge

# Start MCP Server
cd /opt/text-to-figma/mcp-server
pm2 start dist/index.js --name mcp-server

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
```

### 5. Verify Deployment

```bash
# Check process status
pm2 status

# Check health endpoint
curl http://localhost:8081/health

# View logs
pm2 logs mcp-server
pm2 logs websocket-bridge
```

## Post-Deployment Verification

### Health Checks

1. **Liveness Check** (Is the service alive?)
   ```bash
   curl http://localhost:8081/live
   ```
   Expected: HTTP 200, `{"alive": true, "timestamp": <timestamp>}`
   - Returns 200 if service is running (even if degraded)
   - Use this for Kubernetes liveness probes

2. **Readiness Check** (Is the service ready for traffic?)
   ```bash
   curl http://localhost:8081/ready
   ```
   Expected: HTTP 200, `{"ready": true, "timestamp": <timestamp>}`
   - Returns 200 only if fully operational
   - Returns 503 if Figma bridge disconnected or unhealthy
   - Use this for Kubernetes readiness probes and load balancer health checks

3. **Full Health Check** (Detailed status)
   ```bash
   curl http://localhost:8081/health
   ```
   Expected: HTTP 200 with detailed health status:
   ```json
   {
     "status": "healthy",
     "timestamp": 1234567890,
     "uptime": 3600,
     "checks": {
       "figma_bridge": {
         "connected": true,
         "status": "pass"
       },
       "memory": {
         "used": 45,
         "total": 100,
         "percentage": 45,
         "status": "pass"
       }
     }
   }
   ```

   **Status Values:**
   - `healthy`: All checks pass
   - `degraded`: Figma bridge disconnected but service operational
   - `unhealthy`: Memory critical or service failing

### Functional Tests

1. **WebSocket Connection**
   ```bash
   # Test WebSocket connectivity
   cd tests
   npm run test:integration
   ```

2. **MCP Tools**
   ```bash
   # Run tool tests
   cd tests
   npm run test:unit
   ```

## Rollback Procedures

### Docker Compose Rollback

```bash
# Stop current deployment
docker-compose down

# Checkout previous version
git checkout <previous-version-tag>

# Rebuild and deploy
docker-compose up --build -d
```

### PM2 Rollback

```bash
# Stop services
pm2 stop mcp-server websocket-bridge

# Checkout previous version
cd /opt/text-to-figma
git checkout <previous-version-tag>

# Rebuild
cd mcp-server
npm ci
npm run build

# Restart services
pm2 restart all
```

## Monitoring

### Key Metrics to Monitor

- **Health Check Endpoints:**
  - `/health` - Overall service health
  - `/ready` - Service readiness for traffic
  - `/live` - Service liveness status

- **Connection Metrics:**
  - WebSocket connection count
  - Figma bridge connection status
  - Circuit breaker state (CLOSED/OPEN/HALF_OPEN)

- **Performance Metrics:**
  - Request/response latency (p50, p95, p99)
  - Tool execution duration
  - Retry attempt rates

- **Error Metrics:**
  - Error rates by category (validation, network, figma_api, internal)
  - Error tracker statistics
  - Circuit breaker trip events

- **Resource Metrics:**
  - Memory usage (should stay below 90%)
  - CPU usage
  - Heap size

- **Graceful Shutdown:**
  - Shutdown duration
  - Pending requests at shutdown
  - Clean exit status

### Log Locations

- **Docker**: `docker-compose logs -f [service-name]`
- **PM2**: `pm2 logs [service-name]`
- **Raw logs**: `/opt/text-to-figma/logs/` (if file logging configured)

## Troubleshooting

See [troubleshooting.md](./troubleshooting.md) for common issues and solutions.

## Security Considerations

1. **Firewall Rules**
   - WebSocket Bridge: Port 8080 (internal only)
   - Health Check: Port 8081 (monitoring systems only)

2. **Environment Variables**
   - Never commit `.env` files to version control
   - Use secure secret management in production

3. **Updates**
   - Run `npm audit` regularly
   - Keep dependencies up-to-date
   - Monitor Dependabot PRs

## Support

For deployment issues:
1. Check [troubleshooting.md](./troubleshooting.md)
2. Review logs in detail
3. Check health check endpoints
4. Open GitHub issue with deployment details
