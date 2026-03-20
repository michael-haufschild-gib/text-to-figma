/**
 * Standardized tool result utilities for production-ready MCP tools
 *
 * Provides consistent result structures, logging, and error handling
 * across all tools in the MCP server.
 */

import { getLogger } from '../monitoring/logger.js';

const logger = getLogger().child({ component: 'tool-result' });

/**
 * Standard tool result structure
 *
 * All tools return this structure on success.
 * On failure, tools throw exceptions which are caught by the MCP transport layer.
 */
export interface ToolResult<T = unknown> {
  /** Always true for returned results (failures throw exceptions) */
  success: true;
  /** Tool-specific result data */
  data: T;
  /** Human-readable message describing the operation */
  message: string;
  /** ISO timestamp when operation completed */
  timestamp: string;
}

/**
 * Create a standardized success result
 *
 * @param data - Tool-specific result data
 * @param message - Human-readable success message
 * @returns Standardized tool result
 *
 * @example
 * ```typescript
 * return createToolResult(
 *   { nodeId: '123', newIndex: 5 },
 *   'Successfully reordered node to index 5'
 * );
 * ```
 */
export function createToolResult<T>(data: T, message: string): ToolResult<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  };
}

/**
 * Wrap a tool execution with logging and standardized error handling
 *
 * @param toolName - Name of the tool being executed
 * @param input - Tool input parameters
 * @param executor - Async function that executes the tool logic
 * @returns Tool result or throws enhanced error
 *
 * @example
 * ```typescript
 * export async function myTool(input: MyInput): Promise<ToolResult<MyOutput>> {
 *   return executeToolWithLogging('my_tool', input, async () => {
 *     // Tool logic here
 *     const result = await bridge.sendToFigma(...);
 *     return { result };
 *   });
 * }
 * ```
 */
export async function executeToolWithLogging<TInput, TOutput>(
  toolName: string,
  input: TInput,
  executor: () => Promise<{ data: TOutput; message: string }>
): Promise<ToolResult<TOutput>> {
  const startTime = Date.now();

  logger.debug(`[${toolName}] Starting execution`, { input });

  try {
    const result = await executor();
    const duration = Date.now() - startTime;

    logger.info(`[${toolName}] Success`, {
      duration,
      message: result.message
    });

    return createToolResult(result.data, result.message);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`[${toolName}] Failed`, error instanceof Error ? error : undefined, {
      duration,
      input
    });

    // Enhance error with context
    throw new Error(`[${toolName}] ${errorMessage}`);
  }
}

/**
 * Create a standardized error for tool failures
 *
 * @param toolName - Name of the tool that failed
 * @param message - Error message
 * @param context - Additional error context
 * @returns Error with standardized format
 *
 * @example
 * ```typescript
 * if (!nodeExists) {
 *   throw createToolError('set_layer_order', 'Node not found', {
 *     nodeId: input.nodeId
 *   });
 * }
 * ```
 */
export function createToolError(
  toolName: string,
  message: string,
  context?: Record<string, unknown>
): Error {
  const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
  const error = new Error(`[${toolName}] ${message}${contextStr}`);

  logger.error(`[${toolName}] Error created`, undefined, { message, context });

  return error;
}
