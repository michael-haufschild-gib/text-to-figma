/**
 * Handler Utilities
 *
 * Shared helpers for building tool handlers in the routing system.
 */

import type { z } from 'zod';
import type { ResponseContent, ToolHandler } from './tool-handler.js';

/**
 * Build a ToolHandler from its constituent parts.
 *
 * Provides a concise factory that enforces the ToolHandler contract
 * without requiring explicit generic annotations at every call site.
 */
export function defineHandler<TInput, TResult>(opts: {
  name: string;
  schema: z.ZodSchema<TInput>;
  execute: (input: TInput) => Promise<TResult>;
  formatResponse: (result: TResult) => ResponseContent[];
  definition: ToolHandler<TInput, TResult>['definition'];
}): ToolHandler<TInput, TResult> {
  return opts;
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
