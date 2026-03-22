/**
 * Handler Utilities
 *
 * Shared helpers for building tool handlers in the routing system.
 */

import type { z } from 'zod';
import type {
  AnyToolHandler,
  ResponseContent,
  ToolDefinition,
  ToolHandler
} from './tool-handler.js';

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
  schema: z.ZodSchema<TInput>;
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

/**
 * Format hierarchy data (string or object) into a printable tree.
 */
export function formatHierarchyTree(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }
  if (data !== null && data !== undefined && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (typeof obj.hierarchy === 'string' && obj.hierarchy !== '') {
      return obj.hierarchy;
    }
    return JSON.stringify(data, null, 2);
  }
  return String(data);
}
