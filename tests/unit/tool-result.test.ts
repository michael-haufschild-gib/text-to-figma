/**
 * Tool Result Utility Tests
 */

import { describe, expect, it } from 'vitest';
import { createToolResult } from '../../mcp-server/src/utils/tool-result.js';

describe('Tool Result Utilities', () => {
  describe('createToolResult', () => {
    it('creates a success result with correct structure', () => {
      const result = createToolResult({ nodeId: '123' }, 'Node created');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ nodeId: '123' });
      expect(result.message).toBe('Node created');
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('handles complex data objects', () => {
      const data = { ids: ['a', 'b'], nested: { count: 5 } };
      const result = createToolResult(data, 'Done');
      expect(result.data).toEqual(data);
    });

    it('produces valid ISO timestamp', () => {
      const result = createToolResult(null, 'test');
      const parsed = new Date(result.timestamp);
      expect(parsed.getTime()).not.toBeNaN();
    });

    it('handles null data', () => {
      const result = createToolResult(null, 'No data');
      expect(result.data).toBeNull();
      expect(result.success).toBe(true);
    });

    it('handles array data', () => {
      const result = createToolResult([1, 2, 3], 'Array data');
      expect(result.data).toEqual([1, 2, 3]);
    });

    it('timestamp is a valid ISO string close to now', () => {
      const before = Date.now();
      const result = createToolResult({}, 'test');
      const after = Date.now();
      const ts = new Date(result.timestamp).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });
});
