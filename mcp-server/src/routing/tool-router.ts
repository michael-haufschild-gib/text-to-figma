/**
 * Tool Router
 *
 * Routes tool calls to registered handlers with validation,
 * execution, response formatting, and centralized observability.
 */

import { ErrorCode } from '../errors/error-codes.js';
import { ToolExecutionError } from '../errors/index.js';
import { trackError } from '../monitoring/error-tracker.js';
import { getLogger } from '../monitoring/logger.js';
import { getMetrics } from '../monitoring/metrics.js';
import type { ResponseContent } from './tool-handler.js';
import { getToolRegistry } from './tool-registry.js';

const logger = getLogger().child({ component: 'tool-router' });
const metrics = getMetrics();

const invocations = metrics.counter('tool_invocations_total', 'Total tool invocations', ['tool']);
const successes = metrics.counter('tool_success_total', 'Successful tool executions', ['tool']);
const errors = metrics.counter('tool_errors_total', 'Tool execution errors', [
  'tool',
  'error_type'
]);
const durations = metrics.histogram(
  'tool_duration_ms',
  'Tool execution duration in milliseconds',
  [10, 50, 100, 200, 500, 1000, 2000, 5000]
);

/**
 * Known error types for metric label normalization.
 * Prevents unbounded label cardinality from arbitrary error names.
 */
const KNOWN_ERROR_TYPES = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'ZodError',
  'FigmaBridgeError',
  'ToolExecutionError',
  'ValidationError',
  'FigmaAPIError',
  'NetworkError',
  'ConfigurationError',
  'PathCommandValidationError'
]);

function normalizeErrorType(name: string): string {
  return KNOWN_ERROR_TYPES.has(name) ? name : 'other';
}

/**
 * Route a tool call to the appropriate handler
 *
 * Performs the following steps:
 * 1. Look up tool handler in registry
 * 2. Validate input against tool's schema
 * 3. Execute tool function with timing
 * 4. Format result into MCP response
 * 5. Record metrics and errors centrally
 *
 * @param toolName - Name of the tool to invoke
 * @param args - Input arguments (will be validated by tool's schema)
 * @returns Promise resolving to formatted response content
 * @throws {Error} If tool not found
 */
export async function routeToolCall(toolName: string, args: unknown): Promise<ResponseContent[]> {
  const registry = getToolRegistry();
  const handler = registry.get(toolName);

  if (!handler) {
    logger.error('Unknown tool requested', undefined, { tool: toolName });
    throw new ToolExecutionError(
      `Unknown tool: ${toolName}`,
      toolName,
      args,
      undefined,
      ErrorCode.SYS_UNKNOWN_COMMAND
    );
  }

  const startTime = Date.now();
  invocations.inc(1, { tool: toolName });
  logger.info('Routing tool call', { tool: toolName });

  try {
    // Validate input using tool's schema — parse returns the inferred type
    const validatedInput: unknown = handler.schema.parse(args);

    // Execute tool
    const result: unknown = await handler.execute(validatedInput);

    // Format response — must succeed before recording metrics as success
    const response = handler.formatResponse(result);

    // Record success only after both execute and formatResponse complete
    const duration = Date.now() - startTime;
    durations.observe(duration);
    successes.inc(1, { tool: toolName });
    logger.info('Tool call succeeded', { tool: toolName, duration });

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    durations.observe(duration);

    const errorObj = error instanceof Error ? error : new Error(String(error));
    const errorType = normalizeErrorType(errorObj.name !== '' ? errorObj.name : 'unknown');

    errors.inc(1, { tool: toolName, error_type: errorType });
    logger.error('Tool execution failed', errorObj, { tool: toolName, duration });
    trackError(errorObj, { tool: toolName }, undefined, undefined);

    throw error;
  }
}
