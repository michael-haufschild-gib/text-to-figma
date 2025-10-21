# Production-Ready Tool Pattern

## Overview

All MCP tools should follow this standardized pattern for production use:
1. Structured logging with timing
2. Explicit success reporting with timestamps
3. Consistent error handling
4. Detailed operation results

## Template Structure

```typescript
import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { createToolResult, type ToolResult } from '../utils/tool-result.js';
import { createScopedLogger } from '../utils/logger.js';

const log = createScopedLogger('tool_name');

// ... schemas ...

/**
 * Result data type (just the data fields)
 */
export interface ToolNameData {
  // Fields returned to user (without success, message, timestamp)
  field1: string;
  field2: number;
}

/**
 * Result type (wraps data with standard fields)
 */
export type ToolNameResult = ToolResult<ToolNameData>;

/**
 * Implementation
 */
export async function toolName(input: ToolNameInput): Promise<ToolNameResult> {
  const startTime = Date.now();

  // Validate input
  const validated = ToolNameInputSchema.parse(input);

  // Custom validation
  if (someCondition) {
    const error = new Error('Validation failed');
    log.error('Validation failed', { error: error.message, input });
    throw error;
  }

  log.debug('Starting operation', { key: validated.value });

  try {
    // Get Figma bridge
    const bridge = getFigmaBridge();

    // Send command to Figma
    // Note: Bridge unwraps response, returns data on success, throws on failure
    const response = await bridge.sendToFigmaWithRetry<{
      field: string;
      message: string;
    }>('command_name', {
      param1: validated.param1,
      param2: validated.param2
    });

    const duration = Date.now() - startTime;
    const message = `Operation completed successfully`;

    log.info('Operation successful', {
      duration,
      result: response
    });

    return createToolResult<ToolNameData>(
      {
        field1: response.field,
        field2: calculated_value
      },
      message
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    log.error('Operation failed', {
      error: errorMessage,
      duration,
      input: validated
    });

    throw new Error(`[tool_name] ${errorMessage}`);
  }
}
```

## Key Changes from Old Pattern

### Before (Old Pattern)
```typescript
export interface ToolResult {
  field1: string;
  field2: number;
  message: string;
}

export async function tool(input: Input): Promise<ToolResult> {
  const validated = Schema.parse(input);
  const bridge = getFigmaBridge();

  const response = await bridge.sendToFigmaWithRetry(...);

  return {
    field1: response.field1,
    field2: response.field2,
    message: 'Success'
  };
}
```

### After (Production Pattern)
```typescript
export interface ToolData {
  field1: string;
  field2: number;
}

export type ToolResult = ToolResult<ToolData>;

export async function tool(input: Input): Promise<ToolResult> {
  const startTime = Date.now();
  const validated = Schema.parse(input);

  log.debug('Starting', { input: validated });

  try {
    const bridge = getFigmaBridge();
    const response = await bridge.sendToFigmaWithRetry(...);

    const duration = Date.now() - startTime;
    log.info('Success', { duration });

    return createToolResult<ToolData>(
      {
        field1: response.field1,
        field2: response.field2
      },
      'Success message'
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    log.error('Failed', { error: errorMessage, duration });
    throw new Error(`[tool] ${errorMessage}`);
  }
}
```

## Benefits

1. **Explicit Success Reporting**: Every result includes `success: true`
2. **Timestamps**: All results include ISO timestamp for debugging
3. **Performance Tracking**: Log duration of every operation
4. **Consistent Logging**: All tools log at debug/info/error levels
5. **Better Error Context**: Errors include tool name and context
6. **Type Safety**: Data and Result types are separate for clarity

## Standard Result Structure

All tools return:
```typescript
{
  success: true,  // Always true (failures throw exceptions)
  data: {
    // Tool-specific data fields
  },
  message: "Human-readable success message",
  timestamp: "2025-10-20T12:34:56.789Z"
}
```

## Migration Checklist

For each tool:
- [ ] Add imports (createToolResult, ToolResult, createScopedLogger)
- [ ] Create scoped logger: `const log = createScopedLogger('tool_name')`
- [ ] Split Result type into Data + Result
- [ ] Add `const startTime = Date.now()`
- [ ] Wrap in try/catch
- [ ] Add log.debug at start
- [ ] Add log.info on success
- [ ] Add log.error on failure
- [ ] Return createToolResult instead of plain object
- [ ] Calculate and log duration

## Status

### Updated Tools (3/9)
- ✅ set_layer_order
- ✅ align_nodes
- ✅ distribute_nodes

### Remaining Critical Tools (6/9)
- ⏳ connect_shapes
- ⏳ get_node_by_id
- ⏳ list_pages
- ⏳ create_page
- ⏳ get_absolute_bounds
- ⏳ get_relative_bounds

### Remaining Tools (59)
- All other tools in /mcp-server/src/tools/
