/**
 * Tool Pipeline Integration Tests
 *
 * Tests the full tool execution pipeline: registry → router → execute → node registry.
 * These tests verify that the plumbing between layers works correctly under realistic
 * conditions: sequential tool calls that build on each other's state, concurrent calls,
 * error propagation across layers, and Zod schema → execute → format pipeline integrity.
 *
 * Unlike unit tests that mock the bridge, these tests use real tool registrations and
 * real routing. Only the FigmaBridge is mocked (it requires a live Figma connection).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { resetNodeRegistry, getNodeRegistry } from '../../mcp-server/src/node-registry.js';
import { getToolRegistry, resetToolRegistry } from '../../mcp-server/src/routing/tool-registry.js';
import { routeToolCall } from '../../mcp-server/src/routing/tool-router.js';
import { resetMetrics, getMetrics } from '../../mcp-server/src/monitoring/metrics.js';
import { resetErrorTracker } from '../../mcp-server/src/monitoring/error-tracker.js';
import { loadConfig, resetConfig } from '../../mcp-server/src/config.js';
import type { AnyToolHandler } from '../../mcp-server/src/routing/tool-handler.js';

/**
 * Mock tools that simulate real tool behavior with node registry interaction,
 * without requiring a Figma bridge connection.
 */
function registerMockTools(): void {
  const registry = getToolRegistry();

  const createFrameHandler: AnyToolHandler = {
    name: 'create_mock_frame',
    schema: z.object({
      name: z.string().min(1),
      parentId: z.string().optional()
    }),
    execute: (input: unknown) => {
      const { name, parentId } = input as { name: string; parentId?: string };
      const nodeId = `frame_${name}_${Date.now()}`;
      const reg = getNodeRegistry();
      reg.register(nodeId, {
        type: 'FRAME',
        name,
        parentId: parentId ?? null,
        children: []
      });
      return Promise.resolve({ nodeId, name });
    },
    formatResponse: (result: unknown) => {
      const { nodeId, name } = result as { nodeId: string; name: string };
      return [{ type: 'text', text: `Created frame "${name}" with ID ${nodeId}` }];
    },
    definition: {
      name: 'create_mock_frame',
      description: 'Test tool: creates a frame node',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          parentId: { type: 'string' }
        },
        required: ['name']
      }
    }
  };

  const getChildrenHandler: AnyToolHandler = {
    name: 'get_mock_children',
    schema: z.object({
      nodeId: z.string().min(1)
    }),
    execute: (input: unknown) => {
      const { nodeId } = input as { nodeId: string };
      const reg = getNodeRegistry();
      const children = reg.getChildren(nodeId);
      return Promise.resolve({
        nodeId,
        children: children.map((c) => ({ id: c.nodeId, name: c.name }))
      });
    },
    formatResponse: (result: unknown) => {
      const { nodeId, children } = result as {
        nodeId: string;
        children: Array<{ id: string; name: string }>;
      };
      return [
        {
          type: 'text',
          text: `Node ${nodeId} has ${children.length} children: ${children.map((c) => c.name).join(', ')}`
        }
      ];
    },
    definition: {
      name: 'get_mock_children',
      description: 'Test tool: gets children of a node',
      inputSchema: {
        type: 'object',
        properties: { nodeId: { type: 'string' } },
        required: ['nodeId']
      }
    }
  };

  const slowToolHandler: AnyToolHandler = {
    name: 'slow_mock_tool',
    schema: z.object({ delayMs: z.number().positive(), label: z.string() }),
    execute: async (input: unknown) => {
      const { delayMs, label } = input as { delayMs: number; label: string };
      await new Promise((r) => setTimeout(r, delayMs));
      return { label, completedAt: Date.now() };
    },
    formatResponse: (result: unknown) => {
      const { label } = result as { label: string };
      return [{ type: 'text', text: `Slow tool "${label}" completed` }];
    },
    definition: {
      name: 'slow_mock_tool',
      description: 'Test tool: simulates slow operation',
      inputSchema: {
        type: 'object',
        properties: {
          delayMs: { type: 'number' },
          label: { type: 'string' }
        },
        required: ['delayMs', 'label']
      }
    }
  };

  const failToolHandler: AnyToolHandler = {
    name: 'fail_mock_tool',
    schema: z.object({ errorType: z.enum(['Error', 'TypeError', 'Custom']) }),
    execute: (input: unknown) => {
      const { errorType } = input as { errorType: string };
      if (errorType === 'TypeError') {
        return Promise.reject(new TypeError('Cannot read properties of undefined'));
      }
      if (errorType === 'Custom') {
        const err = new Error('Custom tool failure');
        err.name = 'ToolExecutionError';
        return Promise.reject(err);
      }
      return Promise.reject(new Error('Generic tool failure'));
    },
    formatResponse: () => [{ type: 'text', text: 'should not be reached' }],
    definition: {
      name: 'fail_mock_tool',
      description: 'Test tool: always fails',
      inputSchema: {
        type: 'object',
        properties: { errorType: { type: 'string' } },
        required: ['errorType']
      }
    }
  };

  registry.register(createFrameHandler);
  registry.register(getChildrenHandler);
  registry.register(slowToolHandler);
  registry.register(failToolHandler);
}

function setupPipelineTests(): void {
  beforeEach(() => {
    resetToolRegistry();
    resetNodeRegistry();
    resetMetrics();
    resetErrorTracker();
    loadConfig();
    registerMockTools();
  });

  afterEach(() => {
    resetToolRegistry();
    resetNodeRegistry();
    resetMetrics();
    resetErrorTracker();
    resetConfig();
  });
}

describe('Tool Pipeline — sequential tool calls with shared state', () => {
  setupPipelineTests();

  it('create parent → create child → verify hierarchy through get_children', async () => {
    const parentResult = await routeToolCall('create_mock_frame', { name: 'Container' });
    expect(parentResult[0].text).toContain('Container');
    const parentId = parentResult[0].text!.match(/ID (\S+)/)?.[1];
    expect(parentId).toMatch(/^frame_Container_/);

    const childResult = await routeToolCall('create_mock_frame', {
      name: 'Header',
      parentId
    });
    expect(childResult[0].text).toContain('Header');

    const childrenResult = await routeToolCall('get_mock_children', { nodeId: parentId });
    expect(childrenResult[0].text).toContain('1 children');
    expect(childrenResult[0].text).toContain('Header');
  });

  it('create parent → create multiple children → verify all appear in order', async () => {
    const parentResult = await routeToolCall('create_mock_frame', { name: 'Page' });
    const parentId = parentResult[0].text!.match(/ID (\S+)/)?.[1]!;

    await routeToolCall('create_mock_frame', { name: 'Header', parentId });
    await routeToolCall('create_mock_frame', { name: 'Content', parentId });
    await routeToolCall('create_mock_frame', { name: 'Footer', parentId });

    const childrenResult = await routeToolCall('get_mock_children', { nodeId: parentId });
    expect(childrenResult[0].text).toContain('3 children');
    expect(childrenResult[0].text).toContain('Header');
    expect(childrenResult[0].text).toContain('Content');
    expect(childrenResult[0].text).toContain('Footer');
  });

  it('nested three levels deep: grandchild is a descendant of root', async () => {
    const rootResult = await routeToolCall('create_mock_frame', { name: 'Root' });
    const rootId = rootResult[0].text!.match(/ID (\S+)/)?.[1]!;

    const midResult = await routeToolCall('create_mock_frame', {
      name: 'Middle',
      parentId: rootId
    });
    const midId = midResult[0].text!.match(/ID (\S+)/)?.[1]!;

    await routeToolCall('create_mock_frame', {
      name: 'Leaf',
      parentId: midId
    });

    const rootChildren = await routeToolCall('get_mock_children', { nodeId: rootId });
    expect(rootChildren[0].text).toContain('1 children');
    expect(rootChildren[0].text).toContain('Middle');

    const midChildren = await routeToolCall('get_mock_children', { nodeId: midId });
    expect(midChildren[0].text).toContain('1 children');
    expect(midChildren[0].text).toContain('Leaf');

    const registry = getNodeRegistry();
    const descendants = registry.getDescendants(rootId);
    expect(descendants).toHaveLength(2);
    expect(descendants.map((d) => d.name)).toEqual(['Middle', 'Leaf']);
  });
});

describe('Tool Pipeline — concurrent tool calls', () => {
  setupPipelineTests();

  it('concurrent creates do not corrupt shared node registry', async () => {
    const results = await Promise.all([
      routeToolCall('create_mock_frame', { name: 'Frame_A' }),
      routeToolCall('create_mock_frame', { name: 'Frame_B' }),
      routeToolCall('create_mock_frame', { name: 'Frame_C' })
    ]);

    const ids = results.map((r) => r[0].text!.match(/ID (\S+)/)?.[1]);
    expect(new Set(ids).size).toBe(3);

    const registry = getNodeRegistry();
    expect(registry.getAllNodes()).toHaveLength(3);
    expect(registry.getRootNodes()).toHaveLength(3);
  });

  it('concurrent slow operations all complete independently', async () => {
    const start = Date.now();
    const results = await Promise.all([
      routeToolCall('slow_mock_tool', { delayMs: 10, label: 'A' }),
      routeToolCall('slow_mock_tool', { delayMs: 10, label: 'B' }),
      routeToolCall('slow_mock_tool', { delayMs: 10, label: 'C' })
    ]);

    expect(results).toHaveLength(3);
    expect(results[0][0].text).toContain('A');
    expect(results[1][0].text).toContain('B');
    expect(results[2][0].text).toContain('C');

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it('mix of succeeding and failing concurrent calls does not affect each other', async () => {
    const results = await Promise.allSettled([
      routeToolCall('create_mock_frame', { name: 'Good_Frame' }),
      routeToolCall('fail_mock_tool', { errorType: 'Error' }),
      routeToolCall('create_mock_frame', { name: 'Also_Good' })
    ]);

    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect(results[2].status).toBe('fulfilled');

    const registry = getNodeRegistry();
    expect(registry.getAllNodes()).toHaveLength(2);
  });
});

describe('Tool Pipeline — error propagation', () => {
  setupPipelineTests();

  it('Zod validation errors propagate as ZodError through routeToolCall', async () => {
    try {
      await routeToolCall('create_mock_frame', { name: '' }); // min(1) violation
      expect.fail('Should have thrown');
    } catch (error) {
      expect((error as Error).name).toBe('ZodError');
    }
  });

  it('execute errors preserve their original type through routeToolCall', async () => {
    try {
      await routeToolCall('fail_mock_tool', { errorType: 'TypeError' });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError);
      expect((error as Error).message).toBe('Cannot read properties of undefined');
    }
  });

  it('unknown tool names produce descriptive error', async () => {
    await expect(routeToolCall('nonexistent_tool', {})).rejects.toThrow(
      'Unknown tool: nonexistent_tool'
    );
  });

  it('custom error names are preserved for error tracking', async () => {
    try {
      await routeToolCall('fail_mock_tool', { errorType: 'Custom' });
      expect.fail('Should have thrown');
    } catch (error) {
      expect((error as Error).name).toBe('ToolExecutionError');
      expect((error as Error).message).toBe('Custom tool failure');
    }
  });
});

describe('Tool Pipeline — metrics tracking', () => {
  setupPipelineTests();

  it('successful calls increment invocation and success counters', async () => {
    resetMetrics();
    const metrics = getMetrics();
    const invocations = metrics.counter('tool_invocations_total');
    const successes = metrics.counter('tool_success_total');

    await routeToolCall('create_mock_frame', { name: 'Counted' });

    expect(invocations.get({ tool: 'create_mock_frame' })).toBe(1);
    expect(successes.get({ tool: 'create_mock_frame' })).toBe(1);
  });

  it('failed calls increment invocation and error counters but not success', async () => {
    resetMetrics();
    const metrics = getMetrics();
    const invocations = metrics.counter('tool_invocations_total');
    const successes = metrics.counter('tool_success_total');
    const errors = metrics.counter('tool_errors_total');

    await routeToolCall('fail_mock_tool', { errorType: 'Error' }).catch(() => {});

    expect(invocations.get({ tool: 'fail_mock_tool' })).toBe(1);
    expect(successes.get({ tool: 'fail_mock_tool' })).toBe(0);
    expect(errors.get({ tool: 'fail_mock_tool', error_type: 'Error' })).toBe(1);
  });

  it('validation errors are tracked in error counter with ZodError type', async () => {
    resetMetrics();
    const metrics = getMetrics();
    const errors = metrics.counter('tool_errors_total');

    await routeToolCall('create_mock_frame', { name: '' }).catch(() => {});

    expect(errors.get({ tool: 'create_mock_frame', error_type: 'ZodError' })).toBe(1);
  });

  it('multiple tools track independent counters', async () => {
    resetMetrics();
    const metrics = getMetrics();
    const invocations = metrics.counter('tool_invocations_total');

    await routeToolCall('create_mock_frame', { name: 'A' });
    await routeToolCall('create_mock_frame', { name: 'B' });
    await routeToolCall('get_mock_children', { nodeId: 'any' });

    expect(invocations.get({ tool: 'create_mock_frame' })).toBe(2);
    expect(invocations.get({ tool: 'get_mock_children' })).toBe(1);
  });
});

describe('Tool Pipeline — schema-execute-format integrity', () => {
  setupPipelineTests();

  it('schema strips unknown properties before passing to execute', async () => {
    const result = await routeToolCall('create_mock_frame', {
      name: 'Stripped',
      extraProp: 'should be ignored',
      another: 42
    });
    expect(result[0].text).toContain('Stripped');
  });

  it('formatResponse output always has type field on every content item', async () => {
    const result = await routeToolCall('create_mock_frame', { name: 'TypeCheck' });
    for (const item of result) {
      expect(item.type).toBe('text');
      expect(item.text).toContain('TypeCheck');
    }
  });
});

describe('Tool Pipeline — registry state isolation', () => {
  setupPipelineTests();

  it('each beforeEach starts with empty registry', () => {
    const registry = getNodeRegistry();
    expect(registry.getAllNodes()).toHaveLength(0);
  });

  it('tool calls in one test do not leak into another', async () => {
    const registry = getNodeRegistry();
    expect(registry.getAllNodes()).toHaveLength(0);

    await routeToolCall('create_mock_frame', { name: 'Isolated' });
    expect(registry.getAllNodes()).toHaveLength(1);
  });
});
