# Connection Reliability Fix

## Problem Statement

LLM agents frequently report false connection errors when using the text-to-figma MCP tools:
- "Not connected to Figma"
- "WebSocket server not running"
- "Plugin not connected"

These errors occur even when the system is actually working correctly, as evidenced by the fact that subsequent operations succeed.

## Root Cause Analysis

### The Pattern That Causes False Errors

All 50+ MCP tools use this pattern:

```typescript
export async function someTool(input: SomeInput): Promise<SomeResult> {
  const bridge = getFigmaBridge();

  // ❌ PROBLEMATIC: Throws error immediately if not connected
  if (!bridge.isConnected()) {
    throw new Error('Not connected to Figma. Ensure the plugin is running.');
  }

  // Never reached if connection check fails
  const response = await bridge.sendToFigma('some_command', payload);
  return response;
}
```

### Why This Fails

1. **Startup Race Condition**
   - MCP server starts → attempts to connect → may fail if Figma plugin not open yet
   - Server continues running (logs "Will retry automatically")
   - Tool is called → checks `isConnected()` → returns `false` → throws error
   - Health check connects 10 seconds later
   - But LLM already saw the error and reports "not connected"

2. **Idle Reconnection**
   - After period of inactivity, connection may close
   - First tool call checks `isConnected()` → false → immediate error
   - Bridge has auto-reconnect capabilities but never gets a chance to use them

3. **Brief Disconnections**
   - Network hiccups or plugin reloads cause temporary disconnections
   - Tools fail immediately instead of waiting for reconnection

### What Already Works

The `FigmaBridge` class already has robust reconnection capabilities:

1. **Auto-Reconnect**
   - Health check runs every 10 seconds
   - Automatically attempts reconnection if disconnected
   - Exponential backoff with max 30 second delay

2. **Retry Logic**
   - `sendToFigmaWithRetry()` method with automatic retry
   - Exponential backoff
   - Circuit breaker pattern to prevent cascading failures
   - Attempts to reconnect if disconnected

3. **Connection Management**
   - `connect()` method can be called on-demand
   - Handles connection errors gracefully
   - Provides proper error messages

**The problem is that tools check connection status but never use these capabilities!**

## Solutions

### Option 1: Use sendToFigmaWithRetry (RECOMMENDED)

Replace the pattern in all tools:

```typescript
export async function someTool(input: SomeInput): Promise<SomeResult> {
  const bridge = getFigmaBridge();

  // ✅ BETTER: Let retry logic handle connection
  // Remove the isConnected() check entirely
  const response = await bridge.sendToFigmaWithRetry('some_command', payload);
  return response;
}
```

**Benefits:**
- Uses existing robust retry/reconnect infrastructure
- Exponential backoff prevents thundering herd
- Circuit breaker prevents cascading failures
- No code duplication
- Handles temporary issues gracefully

### Option 2: Use ensureConnected Helper

For tools that need immediate feedback:

```typescript
import { ensureConnected } from '../utils/ensure-connected.js';

export async function someTool(input: SomeInput): Promise<SomeResult> {
  const bridge = getFigmaBridge();

  // ✅ GOOD: Attempt connection before checking
  await ensureConnected();

  const response = await bridge.sendToFigma('some_command', payload);
  return response;
}
```

**Benefits:**
- Gives helpful error message if truly can't connect
- Attempts connection before failing
- Quick timeout (5 seconds) for fast feedback

### Option 3: Attempt Connection in Check

Simple modification to existing pattern:

```typescript
export async function someTool(input: SomeInput): Promise<SomeResult> {
  const bridge = getFigmaBridge();

  // ✅ OK: Try to connect if not connected
  if (!bridge.isConnected()) {
    await bridge.connect();
  }

  const response = await bridge.sendToFigma('some_command', payload);
  return response;
}
```

**Drawbacks:**
- No retry logic
- No circuit breaker
- Less robust than Option 1

## Implementation Plan

### Phase 1: Create Infrastructure ✅
- [x] Create `ensure-connected.ts` utility
- [x] Document the issue and solutions

### Phase 2: Update Tools
- [ ] Create migration script to update all tools automatically
- [ ] Update tools to use `sendToFigmaWithRetry`
- [ ] Remove premature `isConnected()` checks

### Phase 3: Testing
- [ ] Add integration tests for connection retry behavior
- [ ] Test startup scenarios (plugin not ready)
- [ ] Test reconnection after idle
- [ ] Test behavior during brief disconnections

### Phase 4: Documentation
- [ ] Update tool development guide
- [ ] Add best practices for connection handling
- [ ] Document error messages and troubleshooting

## Files Affected

All tool files in `mcp-server/src/tools/`:
- 50+ tool implementation files
- Pattern is identical in all

## Migration Script

```bash
#!/bin/bash
# Fix connection check pattern in all tools

find mcp-server/src/tools -name "*.ts" -type f | while read file; do
  # Replace sendToFigma with sendToFigmaWithRetry
  sed -i '' 's/bridge\.sendToFigma(/bridge.sendToFigmaWithRetry(/g' "$file"

  # Remove the connection check block
  # Note: This is a simplified version - real implementation needs proper AST manipulation
  echo "Updated: $file"
done
```

## Testing Strategy

### Unit Tests
```typescript
describe('Tool connection handling', () => {
  it('should retry connection if initially disconnected', async () => {
    // Mock bridge as disconnected
    // Call tool
    // Verify it attempts reconnection
    // Verify it succeeds after reconnection
  });

  it('should provide helpful error if connection fails', async () => {
    // Mock bridge connection to fail
    // Call tool
    // Verify error message includes troubleshooting steps
  });

  it('should not fail on brief disconnections', async () => {
    // Simulate brief disconnection during call
    // Verify tool succeeds via retry
  });
});
```

### Integration Tests
```typescript
describe('MCP Server connection reliability', () => {
  it('should work when started before Figma plugin', async () => {
    // Start MCP server
    // Call tool (plugin not connected)
    // Start plugin
    // Verify tool eventually succeeds
  });

  it('should recover from plugin restart', async () => {
    // Establish connection
    // Restart plugin
    // Call tool
    // Verify automatic reconnection
  });
});
```

## Expected Outcomes

After implementing this fix:

1. **Fewer False Errors**
   - LLMs won't see "not connected" errors when system is actually working
   - Better user experience during startup
   - Resilient to brief disconnections

2. **Better Error Messages**
   - When connection truly fails, provide actionable troubleshooting steps
   - Help users understand what to check

3. **More Robust System**
   - Leverage existing retry/reconnect infrastructure
   - Handle edge cases gracefully
   - Reduce manual intervention needed

## Verification

To verify the fix is working:

1. **Startup Test**
   ```bash
   # Start MCP server BEFORE opening Figma plugin
   npm start
   # In Claude Desktop, try to create a page
   # Should succeed (may take a few seconds for connection)
   ```

2. **Reconnection Test**
   ```bash
   # With system working, close and reopen Figma plugin
   # Immediately try to use a tool
   # Should succeed via auto-reconnect
   ```

3. **Idle Test**
   ```bash
   # Let system sit idle for 5+ minutes
   # Use a tool
   # Should succeed (may take a moment to reconnect)
   ```

## Related Files

- `mcp-server/src/figma-bridge.ts` - Connection management
- `mcp-server/src/utils/ensure-connected.ts` - Connection helper
- `mcp-server/src/tools/**/*.ts` - All tool implementations
- `mcp-server/src/index.ts` - Server startup and initialization

## References

- Circuit Breaker Pattern: https://martinfowler.com/bliki/CircuitBreaker.html
- Retry with Exponential Backoff: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
