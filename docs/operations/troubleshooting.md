# Troubleshooting Guide

## Common Issues and Solutions

### WebSocket Connection Issues

#### Issue: "No Figma clients connected"

**Symptoms:**
- MCP tools return "No Figma clients connected" error
- Health check shows `figma_bridge.connected: false`

**Causes:**
1. Figma plugin not loaded
2. WebSocket bridge server not running
3. Network connectivity issues

**Solutions:**

1. **Verify WebSocket Bridge is Running**
   ```bash
   # Check if port 8080 is listening
   lsof -i :8080

   # Or use netstat
   netstat -an | grep 8080
   ```

2. **Check Figma Plugin**
   - Open Figma Desktop app
   - Go to Plugins > Development > text-to-figma
   - Verify plugin is running
   - Check browser console for errors (Cmd+Option+I on Mac)

3. **Test WebSocket Connectivity**
   ```bash
   # Using wscat
   npm install -g wscat
   wscat -c ws://localhost:8080
   ```

4. **Check Logs**
   ```bash
   # Docker
   docker-compose logs websocket-bridge

   # PM2
   pm2 logs websocket-bridge
   ```

#### Issue: "Request timeout"

**Symptoms:**
- Operations timeout after 30 seconds
- No response from Figma plugin

**Causes:**
1. Figma plugin frozen or crashed
2. Large operations taking too long
3. Network latency

**Solutions:**

1. **Restart Figma Plugin**
   - Close Figma Desktop app completely
   - Reopen and reload plugin

2. **Increase Timeout** (if needed)
   ```env
   # In .env file
   FIGMA_REQUEST_TIMEOUT=60000  # 60 seconds
   ```

3. **Check Operation Complexity**
   - Break large operations into smaller chunks
   - Verify not creating thousands of nodes at once

---

### Health Check Issues

#### Issue: Health check returns 503 (Service Unavailable)

**Symptoms:**
- `/health` endpoint returns HTTP 503
- Status shows "degraded" or "unhealthy"

**Diagnosis:**
```bash
curl -v http://localhost:8081/health
```

**Solutions:**

1. **If Figma Bridge Disconnected**
   - Restart WebSocket bridge
   - Restart Figma plugin
   - Check network connectivity

2. **If Memory High**
   ```bash
   # Check memory usage
   docker stats  # for Docker
   pm2 monit     # for PM2
   ```
   - Restart services if memory leak detected
   - Investigate memory usage patterns

---

### Build and Compilation Issues

#### Issue: "Cannot find module" errors

**Symptoms:**
- MCP server fails to start
- Import errors in logs

**Causes:**
1. TypeScript not compiled
2. Dependencies not installed
3. Incorrect Node.js version

**Solutions:**

1. **Rebuild TypeScript**
   ```bash
   cd mcp-server
   npm run build
   ```

2. **Clean and Reinstall**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

3. **Verify Node.js Version**
   ```bash
   node --version  # Should be 20.x or later
   ```

#### Issue: TypeScript compilation errors

**Symptoms:**
- `npm run build` fails
- Type errors in output

**Solutions:**

1. **Check TypeScript Version**
   ```bash
   npm list typescript
   ```

2. **Clear TypeScript Cache**
   ```bash
   rm -rf dist
   npm run build
   ```

3. **Run Type Check**
   ```bash
   npm run type-check
   ```

---

### Port Conflicts

#### Issue: "EADDRINUSE" or "Port already in use"

**Symptoms:**
- Server fails to start
- Error mentions port 8080 or 8081

**Solutions:**

1. **Find Process Using Port**
   ```bash
   # On macOS/Linux
   lsof -ti :8080

   # Kill process
   lsof -ti :8080 | xargs kill -9
   ```

2. **Use Different Port**
   ```env
   # WebSocket Bridge
   PORT=8090

   # Health Check
   HEALTH_CHECK_PORT=8091
   ```

---

### Performance Issues

#### Issue: Slow response times

**Symptoms:**
- Operations take longer than expected
- Latency above 300ms consistently

**Diagnosis:**

1. **Check Health Metrics**
   ```bash
   curl http://localhost:8081/health | jq
   ```

2. **Monitor Resource Usage**
   ```bash
   # Docker
   docker stats

   # PM2
   pm2 monit
   ```

**Solutions:**

1. **Optimize Operations**
   - Batch multiple related operations
   - Use layout constraints instead of manual positioning
   - Avoid unnecessary re-renders in Figma

2. **Scale Resources**
   - Increase Docker container memory
   - Allocate more CPU cores

3. **Check Network**
   - Verify low latency between services
   - Test with `ping` and `traceroute`

---

### Logging and Debugging

#### Enable Debug Logging

```env
LOG_LEVEL=debug
```

Restart services to apply.

#### View Detailed Logs

**Docker:**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f mcp-server

# Last 100 lines
docker-compose logs --tail=100 mcp-server
```

**PM2:**
```bash
# All services
pm2 logs

# Specific service
pm2 logs mcp-server

# Clear logs
pm2 flush
```

#### Export Logs for Analysis

```bash
# Docker
docker-compose logs > deployment-logs.txt

# PM2
pm2 logs --raw > deployment-logs.txt
```

---

### Memory Leaks

#### Issue: Memory usage growing over time

**Symptoms:**
- Health check shows increasing memory usage
- Eventually service crashes or becomes unresponsive

**Diagnosis:**

1. **Monitor Memory Over Time**
   ```bash
   # Check memory every 5 minutes
   watch -n 300 'curl -s http://localhost:8081/health | jq .checks.memory'
   ```

2. **Generate Heap Snapshot** (Node.js)
   ```bash
   # Send SIGUSR2 to process
   kill -USR2 <pid>
   ```

**Solutions:**

1. **Restart Services Regularly**
   ```bash
   # PM2 auto-restart based on memory
   pm2 start dist/index.js --max-memory-restart 500M
   ```

2. **Check Error Tracker**
   - Error tracker has automatic pruning
   - Verify `ERROR_TRACKER_PRUNE_INTERVAL` is set

3. **Review Code**
   - Check for event listener leaks
   - Verify proper cleanup in error handlers

---

### Testing Issues

#### Issue: Integration tests failing

**Symptoms:**
- Tests timeout or fail unexpectedly
- WebSocket connection errors in tests

**Solutions:**

1. **Ensure Clean State**
   ```bash
   # Kill any running servers
   pkill -f "node.*server.js"
   pkill -f "node.*index.js"

   # Run tests
   npm test
   ```

2. **Check Port Availability**
   ```bash
   lsof -i :8080  # Should be empty before tests
   ```

3. **Run Tests with Debug Output**
   ```bash
   LOG_LEVEL=debug npm test
   ```

---

### Docker-Specific Issues

#### Issue: Container won't start

**Solutions:**

1. **Check Logs**
   ```bash
   docker-compose logs <service-name>
   ```

2. **Rebuild Images**
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up
   ```

3. **Check Disk Space**
   ```bash
   docker system df
   docker system prune  # Clean up if needed
   ```

#### Issue: Health check failing in Docker

**Solutions:**

1. **Test Health Check Manually**
   ```bash
   docker-compose exec mcp-server sh
   wget -q -O- http://localhost:8081/health
   ```

2. **Increase Health Check Start Period**
   ```yaml
   # In docker-compose.yml
   healthcheck:
     start_period: 60s  # Give more time to start
   ```

---

## Emergency Procedures

### Complete System Reset

```bash
# Stop all services
docker-compose down
# OR
pm2 stop all

# Clean all data
rm -rf logs/
rm -rf node_modules/
rm -rf dist/

# Reinstall
npm install
npm run build

# Restart
docker-compose up -d
# OR
pm2 restart all
```

### Data Recovery

If issues persist, collect diagnostic information:

```bash
# Create diagnostic bundle
mkdir diagnostic-$(date +%Y%m%d-%H%M%S)
cd diagnostic-$(date +%Y%m%d-%H%M%S)

# Collect logs
docker-compose logs > docker-logs.txt 2>&1
# OR
pm2 logs --raw > pm2-logs.txt 2>&1

# Collect health status
curl -v http://localhost:8081/health > health-status.json 2>&1

# Collect system info
uname -a > system-info.txt
node --version >> system-info.txt
npm --version >> system-info.txt
docker --version >> system-info.txt

# Create archive
cd ..
tar -czf diagnostic-$(date +%Y%m%d-%H%M%S).tar.gz diagnostic-*/
```

Share this archive when reporting issues.

---

## Getting Help

1. **Check this guide first**
2. **Review logs** for error messages
3. **Test health endpoints**
4. **Search existing GitHub issues**
5. **Open new issue** with:
   - Error messages
   - Steps to reproduce
   - Environment details
   - Diagnostic bundle (if applicable)

## Related Documentation

- [Deployment Runbook](./deployment-runbook.md)
- [Architecture Documentation](../architecture.md)
- [MCP Server Documentation](../architecture-mcp-server.md)
- [WebSocket Bridge Documentation](../architecture-websocket-server.md)
