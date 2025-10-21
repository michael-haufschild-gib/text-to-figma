/**
 * Tool Router
 *
 * Routes tool calls to registered handlers with validation,
 * execution, and response formatting.
 */

import { getLogger } from '../monitoring/logger.js';
import type { ResponseContent } from './tool-handler.js';
import { getToolRegistry } from './tool-registry.js';

const logger = getLogger().child({ component: 'tool-router' });

/**
 * Route a tool call to the appropriate handler
 *
 * Performs the following steps:
 * 1. Look up tool handler in registry
 * 2. Validate input against tool's schema
 * 3. Execute tool function
 * 4. Format result into MCP response
 *
 * @param toolName - Name of the tool to invoke
 * @param args - Input arguments (will be validated by tool's schema)
 * @returns Promise resolving to formatted response content
 * @throws {Error} If tool not found
 * @throws {ValidationError} If input validation fails
 * @throws {FigmaAPIError} If Figma operation fails
 * @throws {NetworkError} If communication fails
 *
 * @example
 * ```typescript
 * try {
 *   const content = await routeToolCall('create_frame', {
 *     name: 'Button',
 *     layoutMode: 'HORIZONTAL'
 *   });
 *   return { content };
 * } catch (error) {
 *   return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
 * }
 * ```
 *
 * @remarks
 * - Validates input using tool's Zod schema
 * - Logs tool invocation for observability
 * - Preserves exact error types from tools
 * - Returns MCP-compatible response format
 */
export async function routeToolCall(toolName: string, args: unknown): Promise<ResponseContent[]> {
  const registry = getToolRegistry();
  const handler = registry.get(toolName);

  if (!handler) {
    logger.error('Unknown tool requested', undefined, { tool: toolName });
    throw new Error(`Unknown tool: ${toolName}`);
  }

  logger.info('Routing tool call', { tool: toolName });

  try {
    // Validate input using tool's schema
    const validatedInput = handler.schema.parse(args);

    // Execute tool
    const result = await handler.execute(validatedInput);

    // Format response
    return handler.formatResponse(result);
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error('Tool execution failed', errorObj, { tool: toolName, args });
    throw error;
  }
}
