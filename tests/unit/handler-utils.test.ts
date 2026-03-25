/**
 * Handler Utilities Tests
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  defineHandler,
  textResponse,
  formatHierarchyTree
} from '../../mcp-server/src/routing/handler-utils.js';

describe('Handler Utilities', () => {
  describe('textResponse', () => {
    it('wraps a string in MCP text content format', () => {
      const result = textResponse('hello');
      expect(result).toEqual([{ type: 'text', text: 'hello' }]);
    });

    it('returns a single-element array', () => {
      expect(textResponse('x')).toHaveLength(1);
    });

    it('handles empty string', () => {
      expect(textResponse('')).toEqual([{ type: 'text', text: '' }]);
    });
  });

  describe('defineHandler', () => {
    it('returns the same object passed in (identity factory)', () => {
      const schema = z.object({ n: z.number() });
      const opts = {
        name: 'test',
        schema,
        execute: (input: { n: number }) => Promise.resolve({ result: input.n }),
        formatResponse: (r: { result: number }) => textResponse(String(r.result)),
        definition: {
          name: 'test',
          description: 'test tool',
          inputSchema: { type: 'object' as const }
        }
      };

      const handler = defineHandler(opts);
      expect(handler.name).toBe('test');
      expect(handler.schema).toBe(schema);
      expect(handler.execute).toBe(opts.execute);
    });
  });

  describe('formatHierarchyTree', () => {
    it('returns string input unchanged', () => {
      expect(formatHierarchyTree('tree text')).toBe('tree text');
    });

    it('extracts hierarchy field from object', () => {
      expect(formatHierarchyTree({ hierarchy: 'tree output' })).toBe('tree output');
    });

    it('JSON-stringifies objects without hierarchy field', () => {
      const obj = { a: 1, b: 2 };
      expect(formatHierarchyTree(obj)).toBe(JSON.stringify(obj, null, 2));
    });

    it('converts non-string/non-object to string', () => {
      expect(formatHierarchyTree(42)).toBe('42');
      expect(formatHierarchyTree(null)).toBe('null');
    });

    it('handles empty string', () => {
      expect(formatHierarchyTree('')).toBe('');
    });

    it('handles object with empty hierarchy (falsy — falls through to JSON)', () => {
      // Empty string is falsy, so the hierarchy field check won't match
      const result = formatHierarchyTree({ hierarchy: '' });
      expect(result).toContain('hierarchy');
    });

    it('handles deeply nested object', () => {
      const deep = { a: { b: { c: { d: 'deep' } } } };
      const result = formatHierarchyTree(deep);
      expect(result).toContain('deep');
    });

    it('handles boolean', () => {
      expect(formatHierarchyTree(true)).toBe('true');
      expect(formatHierarchyTree(false)).toBe('false');
    });

    it('handles undefined', () => {
      expect(formatHierarchyTree(undefined)).toBe('undefined');
    });

    it('handles array', () => {
      const result = formatHierarchyTree([1, 2, 3]);
      expect(result).toContain('1');
    });
  });

  describe('textResponse edge cases', () => {
    it('handles multi-line strings', () => {
      const result = textResponse('line1\nline2\nline3');
      expect(result[0].text).toContain('\n');
    });

    it('handles special characters', () => {
      const result = textResponse('Special: <>&"\'`${}');
      expect(result[0].text).toBe('Special: <>&"\'`${}');
    });

    it('handles very long strings', () => {
      const longStr = 'x'.repeat(10000);
      const result = textResponse(longStr);
      expect(result[0].text).toHaveLength(10000);
    });

    it('handles unicode and emoji content', () => {
      const result = textResponse('Japanese: \u65E5\u672C\u8A9E, Emoji: \uD83D\uDE00');
      expect(result[0].text).toContain('\u65E5\u672C\u8A9E');
    });
  });

  describe('defineHandler type safety', () => {
    it('produced handler schema.parse validates input correctly', () => {
      const typedSchema = z.object({ name: z.string().min(1), count: z.number().int().positive() });
      type TypedInput = z.infer<typeof typedSchema>;
      const handler = defineHandler<TypedInput, { total: number }>({
        name: 'typed_tool',
        schema: typedSchema,
        execute: (input) => Promise.resolve({ total: input.count }),
        formatResponse: (r) => textResponse(`Total: ${r.total}`),
        definition: { name: 'typed_tool', inputSchema: { type: 'object' } }
      });

      expect(() => handler.schema.parse({ name: 'x', count: 5 })).not.toThrow();
      expect(() => handler.schema.parse({ name: '', count: 5 })).toThrow();
      expect(() => handler.schema.parse({ name: 'x', count: -1 })).toThrow();
    });

    it('formatResponse output conforms to ResponseContent shape', () => {
      const handler = defineHandler({
        name: 'shape_check',
        schema: z.object({ v: z.number() }),
        execute: (input) => Promise.resolve({ doubled: input.v * 2 }),
        formatResponse: (r) => textResponse(String(r.doubled)),
        definition: { name: 'shape_check', inputSchema: { type: 'object' } }
      });

      const content = handler.formatResponse({ doubled: 10 });
      expect(content).toHaveLength(1);
      expect(content[0]).toHaveProperty('type', 'text');
      expect(content[0]).toHaveProperty('text', '10');
    });
  });

  describe('formatHierarchyTree disambiguation', () => {
    it('object with numeric hierarchy field falls to JSON (not a string)', () => {
      // hierarchy field is number, not string — should JSON-stringify the whole object
      const result = formatHierarchyTree({ hierarchy: 42 });
      expect(result).toContain('"hierarchy": 42');
    });

    it('object with null hierarchy field falls to JSON', () => {
      const result = formatHierarchyTree({ hierarchy: null });
      expect(result).toContain('null');
    });
  });
});
