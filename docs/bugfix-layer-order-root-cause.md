# Root Cause Analysis: set_layer_order Tool Failure

## Problem Statement
The `set_layer_order` tool (and 3 related tools) always failed with error "Failed to set layer order" even when the operation succeeded in Figma.

## Root Cause

### Type Annotation Mismatch
The tools incorrectly expected the response structure to include `success` and `error` fields:

```typescript
const response = await bridge.sendToFigmaWithRetry<{
  success: boolean;      // ❌ WRONG! Not in unwrapped response
  newIndex?: number;     // ✓ Correct
  error?: string;        // ❌ WRONG! Not in unwrapped response
}>('set_layer_order', {...});

if (!response.success) {  // ❌ BUG! response.success is undefined
  throw new Error(response.error || 'Failed to set layer order');
}
```

### Bridge Behavior
The `FigmaBridge.sendToFigmaWithRetry()` method unwraps responses:

1. **Figma Plugin** sends: `{ success: true, data: { newIndex: 5, message: "..." } }`
2. **Bridge** receives and checks `success` field
3. **On success**: Returns only `response.data` (the inner data object)
4. **On failure**: Throws an error (never returns)

### The Bug
- Tools checked `if (!response.success)` but `response.success` was `undefined`
- In JavaScript, `undefined` is falsy
- Condition was always true, causing tools to always throw errors
- Even successful operations were reported as failures

## Why This Wasn't Caught

1. **TypeScript Limitations**: Type system allows `undefined` values, didn't catch the error
2. **No Integration Tests**: These specific tools lacked automated tests
3. **Template Propagation**: All 4 tools were created from the same flawed template

## Affected Tools

1. `set_layer_order.ts` - Controls z-index/stacking order
2. `align_nodes.ts` - Aligns multiple nodes
3. `distribute_nodes.ts` - Distributes nodes evenly
4. `connect_shapes.ts` - Connects and positions shapes

## The Fix

### Before (Broken)
```typescript
const response = await bridge.sendToFigmaWithRetry<{
  success: boolean;
  newIndex?: number;
  error?: string;
}>('set_layer_order', {...});

if (!response.success) {
  throw new Error(response.error || 'Failed to set layer order');
}

return { ...response };
```

### After (Fixed)
```typescript
// Note: Bridge unwraps response, returns data on success, throws on failure
const response = await bridge.sendToFigmaWithRetry<{
  newIndex: number;
  message: string;
}>('set_layer_order', {...});

// No need to check success - bridge throws on failure
return {
  nodeId: validated.nodeId,
  action: validated.action,
  newIndex: response.newIndex,
  message: `Set layer order: ${validated.action}...`
};
```

## Key Learnings

1. **Trust the Abstraction**: The bridge already handles success/failure, don't check again
2. **Match Response Types**: Type annotations must match what the bridge actually returns
3. **Test Integration Points**: Always test where different layers interact
4. **Document Response Shapes**: Clearly document what each layer returns

## Prevention Measures

1. ✅ Fixed all 4 affected tools
2. ✅ Added comments explaining bridge behavior
3. ✅ Documented the correct pattern
4. 📝 TODO: Add integration tests for these tools
5. 📝 TODO: Create tool development guide with correct patterns
6. 📝 TODO: Add TypeScript strict mode checks

## Related Files

- `/mcp-server/src/tools/set_layer_order.ts`
- `/mcp-server/src/tools/align_nodes.ts`
- `/mcp-server/src/tools/distribute_nodes.ts`
- `/mcp-server/src/tools/connect_shapes.ts`
- `/mcp-server/src/figma-bridge.ts` (bridge implementation)
- `/figma-plugin/code.ts` (plugin response wrapping)

## Date
2025-10-20
