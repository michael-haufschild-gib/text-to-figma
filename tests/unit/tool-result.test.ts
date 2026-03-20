/**
 * Tool Result Utility Tests
 */

import { describe, expect, it, vi } from 'vitest';
import {
  createToolResult,
  executeToolWithLogging,
  createToolError
} from '../../mcp-server/src/utils/tool-result.js';

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
  });

  describe('executeToolWithLogging', () => {
    it('wraps successful execution in a ToolResult', async () => {
      const result = await executeToolWithLogging('test_tool', { x: 1 }, async () => ({
        data: { value: 42 },
        message: 'Computed value'
      }));

      expect(result.success).toBe(true);
      expect(result.data.value).toBe(42);
      expect(result.message).toBe('Computed value');
    });

    it('re-throws errors with tool name prefix', async () => {
      await expect(
        executeToolWithLogging('my_tool', {}, async () => {
          throw new Error('something broke');
        })
      ).rejects.toThrow('[my_tool] something broke');
    });

    it('handles non-Error thrown values (string)', async () => {
      await expect(
        executeToolWithLogging('my_tool', {}, async () => {
          throw 'raw string error';
        })
      ).rejects.toThrow('[my_tool] raw string error');
    });

    it('handles non-Error thrown values (number)', async () => {
      await expect(
        executeToolWithLogging('my_tool', {}, async () => {
          throw 42;
        })
      ).rejects.toThrow('[my_tool] 42');
    });

    it('handles non-Error thrown values (undefined)', async () => {
      await expect(
        executeToolWithLogging('my_tool', {}, async () => {
          throw undefined;
        })
      ).rejects.toThrow('[my_tool] undefined');
    });
  });

  describe('createToolError', () => {
    it('creates an error with tool name prefix', () => {
      const error = createToolError('set_fills', 'Node not found');
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('[set_fills] Node not found');
    });

    it('includes context in the error message', () => {
      const error = createToolError('set_fills', 'Node not found', { nodeId: '123' });
      expect(error.message).toContain('nodeId');
      expect(error.message).toContain('123');
    });

    it('omits context section when no context provided', () => {
      const error = createToolError('test', 'fail');
      expect(error.message).not.toContain('Context');
    });

    it('includes empty context when context is empty object', () => {
      const error = createToolError('test', 'fail', {});
      // Empty object stringifies to "{}", so Context will be present
      expect(error.message).toContain('Context');
    });

    it('serializes nested context objects', () => {
      const error = createToolError('test', 'fail', { nested: { a: 1, b: 'two' } });
      expect(error.message).toContain('"a":1');
      expect(error.message).toContain('"b":"two"');
    });
  });

  describe('createToolResult edge cases', () => {
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

  describe('executeToolWithLogging error wrapping', () => {
    it('wraps Error subclass and preserves message', async () => {
      class CustomError extends Error {
        constructor() {
          super('custom error');
          this.name = 'CustomError';
        }
      }

      await expect(
        executeToolWithLogging('my_tool', {}, async () => {
          throw new CustomError();
        })
      ).rejects.toThrow('[my_tool] custom error');
    });

    it('wraps object thrown as error', async () => {
      await expect(
        executeToolWithLogging('my_tool', {}, async () => {
          throw { code: 404, text: 'not found' };
        })
      ).rejects.toThrow('[my_tool]');
    });

    it('wraps null thrown as error', async () => {
      await expect(
        executeToolWithLogging('my_tool', {}, async () => {
          throw null;
        })
      ).rejects.toThrow('[my_tool] null');
    });

    it('success result has correct structure', async () => {
      const result = await executeToolWithLogging('test', {}, async () => ({
        data: { id: '123' },
        message: 'Created'
      }));

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '123' });
      expect(result.message).toBe('Created');
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
