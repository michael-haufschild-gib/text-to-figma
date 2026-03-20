/**
 * Tool Handler Interface
 *
 * Defines the contract for tool handlers in the routing system.
 * Each tool exports a handler that implements this interface.
 */

import type { z } from 'zod';

/**
 * Response content types for MCP protocol
 *
 * @remarks
 * These types align with MCP SDK's CallToolResult content structure.
 * Text is most common, but image and resource are supported.
 */
export interface ResponseContent {
  /** Content type */
  type: 'text' | 'image' | 'resource';
  /** Text content (for type='text') */
  text?: string;
  /** Base64 data (for type='image') */
  data?: string;
  /** Resource URI (for type='resource') */
  uri?: string;
  /** MIME type (for image/resource) */
  mimeType?: string;
}

/**
 * Tool definition for MCP protocol
 *
 * @remarks
 * This structure matches the MCP SDK's ToolDefinition type.
 * Used for the ListTools response.
 */
export interface ToolDefinition {
  /** Unique tool name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** JSON Schema for input validation */
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

/**
 * Tool Handler Interface
 *
 * Defines the contract for all tool handlers in the routing system.
 * Each tool exports a handler implementing this interface for registration.
 *
 * @typeParam TInput - The validated input type (inferred from Zod schema)
 * @typeParam TResult - The result type returned by execute function
 *
 * @example
 * ```typescript
 * export const createFrameHandler: ToolHandler<CreateFrameInput, CreateFrameResult> = {
 *   name: 'create_frame',
 *   schema: CreateFrameInputSchema,
 *   execute: createFrame,
 *   formatResponse: (result) => [{
 *     type: 'text',
 *     text: `Frame Created: ${result.frameId}\nCSS: ${result.cssEquivalent}`
 *   }],
 *   definition: createFrameToolDefinition
 * };
 * ```
 *
 * @remarks
 * - Generic types enable type-safe tool registration
 * - Schema validates input before execute is called
 * - formatResponse converts result to MCP protocol format
 * - Definition used for MCP ListTools response
 */
export interface ToolHandler<TInput = unknown, TResult = unknown> {
  /** Unique tool name (must match definition.name) */
  name: string;

  /** Zod schema for input validation */
  schema: z.ZodSchema<TInput>;

  /**
   * Execute the tool with validated input
   *
   * @param input - Validated input (parsed by schema)
   * @returns Promise resolving to tool result
   * @throws May throw ValidationError, FigmaAPIError, NetworkError
   */
  execute: (input: TInput) => Promise<TResult>;

  /**
   * Format result into MCP response content
   *
   * @param result - Result from execute function
   * @returns Array of content items for MCP protocol
   */
  formatResponse: (result: TResult) => ResponseContent[];

  /** MCP tool definition for ListTools response */
  definition: ToolDefinition;
}
