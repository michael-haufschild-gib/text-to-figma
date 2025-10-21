# Incident Response Playbook

## Overview

This playbook provides procedures for responding to production incidents in the Text-to-Figma system.

## Severity Levels

### P0 - Critical
- Complete service outage
- Data loss or corruption
- Security breach
- **Response Time**: Immediate (< 5 minutes)
- **Escalation**: Immediate

### P1 - High
- Partial service outage
- Significant performance degradation (> 500ms latency)
- Elevated error rates (> 10%)
- **Response Time**: < 15 minutes
- **Escalation**: Within 30 minutes if not resolved

### P2 - Medium
- Minor feature degradation
- Intermittent errors
- Single component failure with fallback
- **Response Time**: < 1 hour
- **Escalation**: Within 2 hours if not resolved

### P3 - Low
- Cosmetic issues
- Performance degradation (< 500ms)
- Non-critical warnings
- **Response Time**: Next business day
- **Escalation**: Not required

---

## Common Incidents

### 1. WebSocket Bridge Down

**Symptoms:**
- Health check fails for `figma_bridge`
- All tool operations fail with "Not connected"
- Error rate spikes to 100%

**Impact:** P0 - Complete service outage

**Response:**
1. **Verify the issue**
   ```bash
   curl http://localhost:8081/health | jq '.checks.figma_bridge'
   lsof -i :8080
   ```

2. **Check WebSocket server logs**
   ```bash
   pm2 logs websocket-bridge --lines 50
   ```

3. **Restart WebSocket bridge**
   ```bash
   pm2 restart websocket-bridge
   ```

4. **If restart fails, check for**:
   - Port conflict: `lsof -i :8080`
   - Out of memory: `dmesg | tail`
   - Disk space: `df -h`

5. **Verify recovery**
   ```bash
   curl http://localhost:8081/health
   ```

6. **Post-incident**:
   - Review logs for root cause
   - Update monitoring if needed
   - Document in post-mortem

---

### 2. High Error Rate

**Symptoms:**
- Error tracker shows spike in errors
- Success rate < 90%
- Elevated response times

**Impact:** P1 - High

**Response:**
1. **Check error statistics**
   ```bash
   curl http://localhost:8081/health | jq '.checks'
   ```

2. **Review error categories**
   ```javascript
   // In Node console
   const { getErrorTracker } = require('./dist/monitoring/error-tracker.js');
   const stats = getErrorTracker().getStatistics();
   console.log(stats.byCategory);
   ```

3. **If validation errors**: Check for recent API changes
4. **If network errors**: Check Figma connectivity
5. **If internal errors**: Check for bugs introduced in recent deployment

6. **Mitigation**:
   ```bash
   # If recent deployment, rollback
   git checkout <previous-version>
   npm run build
   pm2 restart mcp-server
   ```

---

### 3. Memory Leak

**Symptoms:**
- Health check shows memory > 90%
- Process crashes periodically
- Slow performance over time

**Impact:** P1 - High

**Response:**
1. **Check current memory**
   ```bash
   curl http://localhost:8081/health | jq '.checks.memory'
   ps aux | grep node
   ```

2. **Immediate mitigation**
   ```bash
   # Restart service to free memory
   pm2 restart mcp-server
   ```

3. **Investigate cause**:
   - Check error tracker size
   - Review pending requests
   - Check for resource leaks

4. **Long-term fix**:
   - Adjust error tracker limits
   - Add more aggressive pruning
   - Increase memory limits

---

### 4. Circuit Breaker Open

**Symptoms:**
- Errors: "Circuit breaker is OPEN"
- Recent failures to Figma
- Automatic recovery not happening

**Impact:** P2 - Medium

**Response:**
1. **Check circuit breaker state**
   ```bash
   # Review recent errors
   pm2 logs mcp-server | grep -i "circuit"
   ```

2. **Verify Figma is actually down**
   ```bash
   # Test WebSocket connectivity
   curl http://localhost:8080
   ```

3. **If Figma is up, manually reset**:
   ```bash
   # Restart to reset circuit breaker
   pm2 restart mcp-server
   ```

4. **If Figma is down, wait for recovery**:
   - Circuit breaker will auto-reset after configured timeout
   - Monitor Figma status
   - Notify users of degraded service

---

### 5. Performance Degradation

**Symptoms:**
- Response times > 500ms
- Health check OK but slow
- Users reporting lag

**Impact:** P2 - Medium

**Response:**
1. **Check metrics**
   ```bash
   # Review duration histogram
   curl http://localhost:8081/health
   ```

2. **Identify bottleneck**:
   - High CPU: Check for infinite loops
   - High memory: Check for memory leak
   - Slow network: Check WebSocket latency

3. **Quick fixes**:
   ```bash
   # Restart services
   pm2 restart all

   # Check system resources
   top
   df -h
   netstat -an | grep ESTABLISHED | wc -l
   ```

4. **If persistent**:
   - Review recent code changes
   - Check for database/external service issues
   - Consider scaling horizontally

---

## Escalation Procedures

### Level 1: On-Call Engineer
- First responder
- Basic troubleshooting
- Service restarts
- **Escalate if**: Unable to resolve within SLA time

### Level 2: Senior Engineer
- Deep troubleshooting
- Code fixes
- Configuration changes
- **Escalate if**: Requires architectural changes

### Level 3: Engineering Lead
- System architecture decisions
- Major incidents
- Coordination with other teams

---

## Communication Templates

### Incident Notification

```
INCIDENT: [P0/P1/P2/P3] - [Brief Description]

Status: Investigating / Identified / Monitoring / Resolved
Started: [Timestamp]
Impact: [User-facing impact]
Affected: [Which components]

Current Actions:
- [What we're doing]

Next Update: [Time]

Updates: [Link to status page]
```

### Resolution Notification

```
RESOLVED: [Brief Description]

Duration: [Time from start to resolution]
Root Cause: [What caused it]
Fix Applied: [What we did]

Preventive Measures:
- [Actions to prevent recurrence]

Post-Mortem: [Link or date scheduled]
```

---

## Monitoring Dashboards

### Key Metrics to Watch

1. **Availability**
   - Health check status
   - Uptime percentage
   - Service availability

2. **Performance**
   - Request latency (p50, p95, p99)
   - Error rate
   - Success rate

3. **Resources**
   - CPU usage
   - Memory usage
   - Disk space

4. **Business Metrics**
   - Tool invocation rate
   - Most used tools
   - User adoption

### Alert Thresholds

```yaml
# Example alert configuration

alerts:
  - name: Service Down
    condition: health_check_failed
    severity: P0
    threshold: 1 failure

  - name: High Error Rate
    condition: error_rate > 10%
    severity: P1
    threshold: 5 minutes

  - name: Memory High
    condition: memory_usage > 90%
    severity: P1
    threshold: 10 minutes

  - name: Slow Requests
    condition: p95_latency > 1000ms
    severity: P2
    threshold: 15 minutes

  - name: Circuit Breaker Open
    condition: circuit_state == OPEN
    severity: P2
    threshold: immediate
```

---

## Post-Incident Procedures

### 1. Immediate Aftermath (< 1 hour after resolution)
- [ ] Verify full service recovery
- [ ] Document timeline of events
- [ ] Gather all relevant logs
- [ ] Note actions taken
- [ ] Communicate resolution to stakeholders

### 2. Post-Mortem (Within 48 hours)
- [ ] Schedule post-mortem meeting
- [ ] Analyze root cause
- [ ] Document lessons learned
- [ ] Create action items for prevention
- [ ] Update runbooks if needed

### 3. Follow-up (Within 1 week)
- [ ] Implement preventive measures
- [ ] Update monitoring/alerts
- [ ] Share learnings with team
- [ ] Update documentation
- [ ] Close incident ticket

---

## Incident Log Template

```markdown
# Incident Report: [ID] - [Title]

## Summary
- **Date**: YYYY-MM-DD
- **Duration**: X hours Y minutes
- **Severity**: PX
- **Status**: Resolved
- **Impact**: [Description]

## Timeline (All times in UTC)
- HH:MM - Incident detected
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Monitoring for stability
- HH:MM - Incident resolved

## Root Cause
[Detailed explanation]

## Resolution
[What was done to fix it]

## Impact
- Users affected: [Number/Percentage]
- Requests failed: [Number]
- Revenue impact: [If applicable]

## Action Items
1. [ ] [Preventive measure]
2. [ ] [Monitoring improvement]
3. [ ] [Documentation update]

## Lessons Learned
- [Key learnings]
```

---

## Emergency Contacts

```yaml
# Update with actual contact information

On-Call Rotation:
  - Week 1: [Engineer A] - [Contact]
  - Week 2: [Engineer B] - [Contact]

Escalation:
  - Engineering Lead: [Name] - [Contact]
  - DevOps: [Name] - [Contact]
  - Product: [Name] - [Contact]

External:
  - Figma Support: support@figma.com
  - Cloud Provider: [Support link]
```

---

## Tools and Resources

- **Health Check**: http://localhost:8081/health
- **Logs**: `pm2 logs` or Docker logs
- **Metrics**: (To be configured)
- **Status Page**: (To be configured)
- **Incident Tracker**: GitHub Issues
- **Documentation**: /docs/operations/
- **Runbooks**: /docs/operations/deployment-runbook.md
- **Troubleshooting**: /docs/operations/troubleshooting.md
