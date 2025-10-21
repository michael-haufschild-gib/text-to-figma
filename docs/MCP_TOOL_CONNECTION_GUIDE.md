# MCP Tool Development - Connection Best Practices

## Quick Reference: Always Use `sendToFigmaWithRetry`

### ✅ CORRECT Pattern

```typescript
export async function myTool(input: MyInput): Promise<MyResult> {
  const validated = MyInputSchema.parse(input);
  const bridge = getFigmaBridge();

  // ✅ Use sendToFigmaWithRetry - handles reconnection automatically
  const response = await bridge.sendToFigmaWithRetry<ResponseType>(
    'command_name',
    payload
  );

  if (!response.success) {
    throw new Error(response.error || 'Operation failed');
  }

  return response.data;
}
```

### ❌ INCORRECT Pattern (DO NOT USE)

```typescript
export async function myTool(input: MyInput): Promise<MyResult> {
  const bridge = getFigmaBridge();

  // ❌ WRONG: Premature check causes false errors
  if (!bridge.isConnected()) {
    throw new Error('Not connected to Figma');
  }

  // ❌ WRONG: sendToFigma doesn't retry or reconnect
  const response = await bridge.sendToFigma<ResponseType>(
    'command_name',
    payload
  );

  return response.data;
}
```

## Why This Matters

### The Problem
When you check `isConnected()` and immediately throw an error:
- Tools fail during startup (before plugin ready)
- Tools fail after idle periods
- LLMs see false "not connected" errors
- Users get frustrated

### The Solution
`sendToFigmaWithRetry` handles:
- ✅ Automatic reconnection if disconnected
- ✅ Exponential backoff for retries
- ✅ Circuit breaker to prevent cascading failures
- ✅ Graceful handling of temporary issues

## Connection Flow

```
Tool Called
    ↓
sendToFigmaWithRetry
    ↓
Check if connected
    ↓
  ┌─────────────┬─────────────┐
  │ Connected   │ Not         │
  │             │ Connected   │
  ↓             ↓
Send Request   Attempt
              Connection
              (auto-retry)
                  ↓
              ┌───────┬───────┐
              │ Success │ Fail │
              ↓         ↓
         Send Request  Error
              ↓
         Response
```

## Configuration

Retry behavior can be configured in `config.ts`:

```typescript
{
  RETRY_MAX_ATTEMPTS: 3,        // Max retries
  RETRY_BASE_DELAY: 1000,       // Base delay (1s)
  RETRY_MAX_DELAY: 30000,       // Max delay (30s)
  CIRCUIT_BREAKER_ENABLED: true,
  CIRCUIT_BREAKER_THRESHOLD: 5,
  CIRCUIT_BREAKER_RESET_TIMEOUT: 60000
}
```

## Error Handling

### Let the Bridge Handle It

```typescript
try {
  const response = await bridge.sendToFigmaWithRetry(...);
  return response;
} catch (error) {
  // Only thrown if truly can't connect/execute
  // Error will be helpful and actionable
  throw error;
}
```

### Don't Pre-Check Connection

```typescript
// ❌ DON'T DO THIS
if (!bridge.isConnected()) {
  throw new Error('Not connected');
}

// ✅ DO THIS INSTEAD
// Just call sendToFigmaWithRetry - it handles connection
const response = await bridge.sendToFigmaWithRetry(...);
```

## Custom Retry Options

If you need custom retry behavior:

```typescript
const response = await bridge.sendToFigmaWithRetry<ResponseType>(
  'command_name',
  payload,
  {
    maxRetries: 5,           // Override default
    baseDelay: 500,          // Faster initial retry
    maxDelay: 10000          // Cap at 10s
  }
);
```

## Testing

When writing tests for tools:

```typescript
describe('myTool', () => {
  it('should retry connection if initially disconnected', async () => {
    // Mock bridge as disconnected
    const bridge = getFigmaBridge();
    jest.spyOn(bridge, 'isConnected').mockReturnValue(false);

    // Mock successful reconnection on retry
    jest.spyOn(bridge, 'sendToFigmaWithRetry').mockResolvedValueOnce({
      success: true,
      data: expectedData
    });

    // Call tool - should succeed via retry
    const result = await myTool(input);

    expect(result).toEqual(expectedData);
    expect(bridge.sendToFigmaWithRetry).toHaveBeenCalled();
  });
});
```

## Migration Checklist

If updating an old tool:

- [ ] Remove `if (!bridge.isConnected())` check
- [ ] Replace `sendToFigma` with `sendToFigmaWithRetry`
- [ ] Remove any manual retry logic (bridge handles it)
- [ ] Test with plugin disconnected at startup
- [ ] Test with plugin closed and reopened
- [ ] Verify error messages are helpful

## Common Mistakes

### Mistake 1: Checking Connection Before Calling
```typescript
// ❌ WRONG
if (!bridge.isConnected()) {
  throw new Error('Not connected');
}
const result = await bridge.sendToFigmaWithRetry(...);
```

**Why it's wrong:** The retry method will check and reconnect anyway. Pre-checking causes false errors.

### Mistake 2: Using sendToFigma Instead of sendToFigmaWithRetry
```typescript
// ❌ WRONG
const result = await bridge.sendToFigma(...);
```

**Why it's wrong:** No retry or reconnection logic. Fails on temporary issues.

### Mistake 3: Manual Retry Logic
```typescript
// ❌ WRONG
let retries = 0;
while (retries < 3) {
  try {
    return await bridge.sendToFigma(...);
  } catch (error) {
    retries++;
    await sleep(1000);
  }
}
```

**Why it's wrong:** Bridge already has robust retry logic. Don't reinvent it.

## Quick Migration Script

Use the automated script to fix all tools at once:

```bash
node mcp-server/scripts/fix-connection-pattern.mjs
```

This script:
- Removes `if (!bridge.isConnected())` checks
- Replaces `sendToFigma` with `sendToFigmaWithRetry`
- Preserves all other functionality

## Reference Documentation

- **Bridge Implementation:** `mcp-server/src/figma-bridge.ts`
- **Connection Utilities:** `mcp-server/src/utils/ensure-connected.ts`
- **Configuration:** `mcp-server/src/config.ts`
- **Full Analysis:** `docs/CONNECTION_RELIABILITY_FIX.md`

## Questions?

If you're unsure about connection handling:
1. Check existing tools (they all use the same pattern)
2. Refer to this guide
3. Use `sendToFigmaWithRetry` - it's almost always the right choice
