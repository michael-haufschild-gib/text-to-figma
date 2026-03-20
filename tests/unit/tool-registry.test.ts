/**
 * Unit tests for Tool Registry
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ToolHandler } from '../../mcp-server/src/routing/tool-handler.js';
import {
  ToolRegistry,
  getToolRegistry,
  resetToolRegistry
} from '../../mcp-server/src/routing/tool-registry.js';

type TestInput1 = { value: number };
type TestResult1 = { result: number };
type TestInput2 = { text: string };
type TestResult2 = { output: string };

const mockToolHandler1: ToolHandler<TestInput1, TestResult1> = {
  name: 'test_tool_1',
  schema: z.object({ value: z.number() }),
  execute: async (input) => ({ result: input.value * 2 }),
  formatResponse: (result) => [{ type: 'text', text: `Result: ${result.result}` }],
  definition: {
    name: 'test_tool_1',
    description: 'Test tool 1',
    inputSchema: {
      type: 'object',
      properties: { value: { type: 'number' } },
      required: ['value']
    }
  }
};

const mockToolHandler2: ToolHandler<TestInput2, TestResult2> = {
  name: 'test_tool_2',
  schema: z.object({ text: z.string() }),
  execute: async (input) => ({ output: input.text.toUpperCase() }),
  formatResponse: (result) => [{ type: 'text', text: result.output }],
  definition: {
    name: 'test_tool_2',
    description: 'Test tool 2',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text']
    }
  }
};

describe('ToolRegistry', () => {
  describe('register', () => {
    it('registers and retrieves a tool', () => {
      const registry = new ToolRegistry();
      registry.register(mockToolHandler1);

      expect(registry.get('test_tool_1')).toBe(mockToolHandler1);
    });

    it('registers multiple tools', () => {
      const registry = new ToolRegistry();
      registry.register(mockToolHandler1);
      registry.register(mockToolHandler2);

      expect(registry.get('test_tool_1')).toBe(mockToolHandler1);
      expect(registry.get('test_tool_2')).toBe(mockToolHandler2);
    });

    it('throws on duplicate registration', () => {
      const registry = new ToolRegistry();
      registry.register(mockToolHandler1);

      expect(() => registry.register(mockToolHandler1)).toThrow(
        "Tool 'test_tool_1' is already registered"
      );
    });
  });

  describe('get', () => {
    it('returns undefined for non-existent tool', () => {
      const registry = new ToolRegistry();
      expect(registry.get('non_existent')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('returns empty array when no tools registered', () => {
      const registry = new ToolRegistry();
      expect(registry.getAll()).toEqual([]);
    });

    it('returns all registered tools', () => {
      const registry = new ToolRegistry();
      registry.register(mockToolHandler1);
      registry.register(mockToolHandler2);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(mockToolHandler1);
      expect(all).toContain(mockToolHandler2);
    });
  });

  describe('listDefinitions', () => {
    it('returns empty array when no tools registered', () => {
      const registry = new ToolRegistry();
      expect(registry.listDefinitions()).toEqual([]);
    });

    it('returns definitions for all registered tools', () => {
      const registry = new ToolRegistry();
      registry.register(mockToolHandler1);
      registry.register(mockToolHandler2);

      const defs = registry.listDefinitions();
      expect(defs).toHaveLength(2);

      const def1 = defs.find((d) => d.name === 'test_tool_1');
      const def2 = defs.find((d) => d.name === 'test_tool_2');
      expect(def1?.description).toBe('Test tool 1');
      expect(def2?.description).toBe('Test tool 2');
    });
  });

  describe('clear', () => {
    it('removes all registered tools', () => {
      const registry = new ToolRegistry();
      registry.register(mockToolHandler1);
      registry.register(mockToolHandler2);

      registry.clear();
      expect(registry.getAll()).toHaveLength(0);
    });
  });
});

describe('getToolRegistry singleton', () => {
  beforeEach(() => {
    resetToolRegistry();
  });

  it('returns the same instance on multiple calls', () => {
    const a = getToolRegistry();
    const b = getToolRegistry();
    expect(a).toBe(b);
  });

  it('shares registered tools across references', () => {
    const a = getToolRegistry();
    a.register(mockToolHandler1);

    const b = getToolRegistry();
    expect(b.get('test_tool_1')).toBe(mockToolHandler1);
  });

  it('creates fresh instance after reset', () => {
    const a = getToolRegistry();
    a.register(mockToolHandler1);

    resetToolRegistry();
    const b = getToolRegistry();
    expect(b.get('test_tool_1')).toBeUndefined();
  });
});

describe('ToolRegistry edge cases', () => {
  it('allows re-registration after clear', () => {
    const registry = new ToolRegistry();
    registry.register(mockToolHandler1);
    registry.clear();
    expect(() => registry.register(mockToolHandler1)).not.toThrow();
    expect(registry.get('test_tool_1')).toBe(mockToolHandler1);
  });

  it('getAll returns all handlers in insertion order', () => {
    const registry = new ToolRegistry();
    registry.register(mockToolHandler1);
    registry.register(mockToolHandler2);

    const all = registry.getAll();
    expect(all[0]).toBe(mockToolHandler1);
    expect(all[1]).toBe(mockToolHandler2);
  });

  it('listDefinitions returns matching count to getAll', () => {
    const registry = new ToolRegistry();
    registry.register(mockToolHandler1);
    registry.register(mockToolHandler2);

    expect(registry.listDefinitions().length).toBe(registry.getAll().length);
  });

  it('get returns exact handler reference (not copy)', () => {
    const registry = new ToolRegistry();
    registry.register(mockToolHandler1);

    const retrieved = registry.get('test_tool_1');
    expect(retrieved).toBe(mockToolHandler1);
  });
});
