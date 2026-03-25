/**
 * Handler Utilities
 *
 * Routing-layer helpers for building tool handlers.
 * Formatting utilities live in utils/response-formatters.ts.
 */

import type { z } from 'zod';
import type {
  AnyToolHandler,
  ResponseContent,
  ToolDefinition,
  ToolHandler
} from './tool-handler.js';

// Re-export formatters so existing handler-*.ts imports don't break
export {
  rgbToHex,
  formatFill,
  formatFills,
  formatBounds,
  formatSelectionNode,
  formatHierarchyTree
} from '../utils/response-formatters.js';

/**
 * Build a ToolHandler from its constituent parts.
 *
 * Generic parameters enforce type safety within the handler pipeline
 * (schema.parse → execute → formatResponse). The return type is
 * AnyToolHandler because handler arrays are heterogeneous — callers
 * store handlers with different TInput/TResult in the same collection.
 * This eliminates the need for `as AnyToolHandler[]` casts at call sites.
 */
export function defineHandler<TInput, TResult>(opts: {
  name: string;
  schema: z.ZodType<TInput, z.ZodTypeDef, unknown>;
  execute: (input: TInput) => Promise<TResult>;
  formatResponse: (result: TResult) => ResponseContent[];
  definition: ToolDefinition;
}): AnyToolHandler {
  return opts as ToolHandler<unknown, unknown>;
}

/**
 * Wrap a single text string in the MCP response content format.
 */
export function textResponse(text: string): ResponseContent[] {
  return [{ type: 'text', text }];
}
