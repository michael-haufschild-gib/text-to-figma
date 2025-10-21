# Tool Migration Guide

## Overview

This guide shows how to migrate existing tools to use the new standardized error handling, logging, and metrics infrastructure implemented as part of the engineering review improvements.

## Changes Implemented

### 1. Error Hierarchy (`mcp-server/src/errors/index.ts`)

- `ToolExecutionError` - Base class for all tool errors
- `ValidationError` - Input validation failures
- `FigmaAPIError` - Figma operation failures
- `NetworkError` - Communication failures
- `ConfigurationError` - Configuration issues

### 2. Configuration Management (`mcp-server/src/config.ts`)

- Centralized environment variable validation
- Type-safe configuration access
- Support for multiple environments (dev/staging/prod)

### 3. Monitoring Infrastructure

- **Logging** - Structured logging with context
- **Metrics** - Counters, gauges, histograms for observability
- **Error Tracking** - Automatic error aggregation and deduplication

## Migration Pattern

### Before (Old Pattern)

```typescript
import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

export async function myTool(input: MyInput): Promise<MyResult> {
  // Simple validation
  const validated = myInputSchema.parse(input);

  // Direct Figma call
  const response = await getFigmaBridge().sendToFigma('my_operation', validated);

  return { result: response.data };
}
```

### After (New Pattern)

```typescript
import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { getLogger } from '../monitoring/logger.js';
import { getMetrics } from '../monitoring/metrics.js';
import { trackError } from '../monitoring/error-tracker.js';
import { ValidationError, FigmaAPIError, NetworkError, wrapError } from '../errors/index.js';

// Initialize monitoring
const logger = getLogger().child({ tool: 'my_tool' });
const metrics = getMetrics();

// Register metrics
const invocationCounter = metrics.counter('tool_invocations_total', 'Total tool invocations', ['tool']);
const successCounter = metrics.counter('tool_success_total', 'Successful tool executions', ['tool']);
const errorCounter = metrics.counter('tool_errors_total', 'Tool execution errors', ['tool', 'error_type']);
const durationHistogram = metrics.histogram('tool_duration_ms', 'Tool execution duration in milliseconds', [10, 50, 100, 200, 500, 1000, 2000, 5000]);

/**
 * My Tool with comprehensive error handling, logging, and metrics
 *
 * @param input - Tool parameters
 * @returns Tool result
 * @throws {ValidationError} When input validation fails
 * @throws {FigmaAPIError} When Figma operation fails
 * @throws {NetworkError} When communication fails
 *
 * @example
 * ```typescript
 * const result = await myTool({ param: 'value' });
 * ```
 */
export async function myTool(input: MyInput): Promise<MyResult> {
  const startTime = Date.now();

  // Log invocation
  logger.info('Tool invoked', { input });
  invocationCounter.inc(1, { tool: 'my_tool' });

  try {
    // Validate input with detailed error handling
    let validated: MyInput;
    try {
      validated = myInputSchema.parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new ValidationError(
          `Input validation failed: ${error.errors.map(e => e.message).join(', ')}`,
          'my_tool',
          input,
          error.errors
        );

        logger.error('Validation failed', validationError, { input, errors: error.errors });
        errorCounter.inc(1, { tool: 'my_tool', error_type: 'validation' });
        trackError(validationError, { tool: 'my_tool', input }, 'medium', 'validation');

        throw validationError;
      }
      throw error;
    }

    // Call Figma with error handling
    const bridge = getFigmaBridge();
    let response;

    try {
      response = await bridge.sendToFigma('my_operation', validated);
    } catch (error) {
      if (error instanceof Error) {
        let toolError;

        if (error.message.includes('Not connected') || error.message.includes('Connection')) {
          toolError = new NetworkError(
            'Failed to communicate with Figma',
            'my_tool',
            'figma-bridge',
            validated,
            error
          );
          errorCounter.inc(1, { tool: 'my_tool', error_type: 'network' });
        } else {
          toolError = new FigmaAPIError(
            'Figma operation failed',
            'my_tool',
            'my_operation',
            validated,
            error
          );
          errorCounter.inc(1, { tool: 'my_tool', error_type: 'figma_api' });
        }

        logger.error('Operation failed', toolError, { input: validated });
        trackError(toolError, { tool: 'my_tool', input: validated }, 'high', 'figma_api');

        throw toolError;
      }

      const wrappedError = wrapError(error, 'my_tool', validated);
      logger.error('Unknown error', wrappedError, { input: validated });
      errorCounter.inc(1, { tool: 'my_tool', error_type: 'unknown' });
      trackError(wrappedError, { tool: 'my_tool', input: validated });

      throw wrappedError;
    }

    // Success metrics
    const duration = Date.now() - startTime;
    durationHistogram.observe(duration);
    successCounter.inc(1, { tool: 'my_tool' });

    logger.info('Operation successful', { duration, input: validated });

    return { result: response.data };

  } catch (error) {
    // Re-throw known errors
    if (error instanceof ValidationError || error instanceof FigmaAPIError || error instanceof NetworkError) {
      throw error;
    }

    // Wrap unexpected errors
    const wrappedError = wrapError(error, 'my_tool', input);
    logger.error('Unexpected error', wrappedError, { input });
    errorCounter.inc(1, { tool: 'my_tool', error_type: 'unexpected' });
    trackError(wrappedError, { tool: 'my_tool', input });

    throw wrappedError;
  }
}
```

## Step-by-Step Migration Checklist

### 1. Add Imports

```typescript
import { getLogger } from '../monitoring/logger.js';
import { getMetrics } from '../monitoring/metrics.js';
import { trackError } from '../monitoring/error-tracker.js';
import { ValidationError, FigmaAPIError, NetworkError, wrapError } from '../errors/index.js';
```

### 2. Initialize Monitoring (module level)

```typescript
const logger = getLogger().child({ tool: 'tool_name' });
const metrics = getMetrics();

const invocationCounter = metrics.counter('tool_invocations_total', 'Total tool invocations', ['tool']);
const successCounter = metrics.counter('tool_success_total', 'Successful executions', ['tool']);
const errorCounter = metrics.counter('tool_errors_total', 'Execution errors', ['tool', 'error_type']);
const durationHistogram = metrics.histogram('tool_duration_ms', 'Execution duration', [10, 50, 100, 200, 500, 1000, 2000, 5000]);
```

### 3. Add JSDoc Documentation

Include comprehensive documentation with:
- Description
- `@param` for each parameter
- `@returns` for return value
- `@throws` for each error type
- `@example` with usage examples

### 4. Add Invocation Logging and Metrics

```typescript
const startTime = Date.now();
logger.info('Tool invoked', { input });
invocationCounter.inc(1, { tool: 'tool_name' });
```

### 5. Wrap Validation in Try-Catch

```typescript
let validated: InputType;
try {
  validated = inputSchema.parse(input);
} catch (error) {
  if (error instanceof z.ZodError) {
    const validationError = new ValidationError(
      `Input validation failed: ${error.errors.map(e => e.message).join(', ')}`,
      'tool_name',
      input,
      error.errors
    );

    logger.error('Validation failed', validationError, { input, errors: error.errors });
    errorCounter.inc(1, { tool: 'tool_name', error_type: 'validation' });
    trackError(validationError, { tool: 'tool_name', input }, 'medium', 'validation');

    throw validationError;
  }
  throw error;
}
```

### 6. Wrap Figma Calls with Error Handling

```typescript
try {
  response = await bridge.sendToFigma('operation', validated);
} catch (error) {
  if (error instanceof Error) {
    let toolError;

    if (error.message.includes('Not connected') || error.message.includes('Connection')) {
      toolError = new NetworkError('Failed to communicate with Figma', 'tool_name', 'figma-bridge', validated, error);
      errorCounter.inc(1, { tool: 'tool_name', error_type: 'network' });
    } else {
      toolError = new FigmaAPIError('Figma operation failed', 'tool_name', 'operation', validated, error);
      errorCounter.inc(1, { tool: 'tool_name', error_type: 'figma_api' });
    }

    logger.error('Operation failed', toolError, { input: validated });
    trackError(toolError, { tool: 'tool_name', input: validated }, 'high', 'figma_api');

    throw toolError;
  }

  const wrappedError = wrapError(error, 'tool_name', validated);
  logger.error('Unknown error', wrappedError, { input: validated });
  errorCounter.inc(1, { tool: 'tool_name', error_type: 'unknown' });
  trackError(wrappedError, { tool: 'tool_name', input: validated });

  throw wrappedError;
}
```

### 7. Add Success Metrics

```typescript
const duration = Date.now() - startTime;
durationHistogram.observe(duration);
successCounter.inc(1, { tool: 'tool_name' });

logger.info('Operation successful', { duration, input: validated });
```

### 8. Add Outer Catch for Unexpected Errors

```typescript
} catch (error) {
  if (error instanceof ValidationError || error instanceof FigmaAPIError || error instanceof NetworkError) {
    throw error;
  }

  const wrappedError = wrapError(error, 'tool_name', input);
  logger.error('Unexpected error', wrappedError, { input });
  errorCounter.inc(1, { tool: 'tool_name', error_type: 'unexpected' });
  trackError(wrappedError, { tool: 'tool_name', input });

  throw wrappedError;
}
```

## Complete Example

See `mcp-server/src/tools/create_frame.ts` for a fully migrated example implementing all patterns.

## Tools to Migrate

Run this command to list all tools that need migration:

```bash
find mcp-server/src/tools -name "*.ts" -type f | xargs grep -L "getLogger" | wc -l
```

## Testing Migrated Tools

After migrating a tool:

1. **Build**: `npm run build`
2. **Type Check**: `npm run type-check`
3. **Lint**: `npm run lint`
4. **Test**: Run relevant integration tests

## Benefits of Migration

1. **Better Debugging** - Structured logging with full context
2. **Observability** - Metrics for monitoring and alerting
3. **Error Tracking** - Automatic aggregation and pattern detection
4. **Consistency** - Uniform error handling across all tools
5. **Production Readiness** - Professional error messages and recovery

## Priority Order

Migrate tools in this order:

1. **High Traffic** - Most frequently used tools
2. **Critical Path** - Tools in critical user workflows
3. **Complex Logic** - Tools with complex operations
4. **Remaining** - All other tools

## Need Help?

Refer to:
- `docs/meta/styleguide.md` - Coding standards
- `mcp-server/src/errors/index.ts` - Error class documentation
- `mcp-server/src/tools/create_frame.ts` - Complete example
