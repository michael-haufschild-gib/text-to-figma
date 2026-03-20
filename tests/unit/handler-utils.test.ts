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
        execute: (input: { n: number }) => ({ result: input.n }),
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
  });
});
