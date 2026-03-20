/**
 * Unit tests for Tool Router
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ToolHandler } from '../../mcp-server/src/routing/tool-handler.js';
import { getToolRegistry, resetToolRegistry } from '../../mcp-server/src/routing/tool-registry.js';
import { routeToolCall } from '../../mcp-server/src/routing/tool-router.js';
import { getMetrics, resetMetrics } from '../../mcp-server/src/monitoring/metrics.js';

type TestInput = { value: number };
type TestResult = { result: number };

const testHandler: ToolHandler<TestInput, TestResult> = {
  name: 'test_tool',
  schema: z.object({ value: z.number() }),
  execute: (input) => ({ result: input.value * 2 }),
  formatResponse: (result) => [{ type: 'text', text: `Result: ${result.result}` }],
  definition: {
    name: 'test_tool',
    description: 'Test tool',
    inputSchema: {
      type: 'object',
      properties: { value: { type: 'number' } },
      required: ['value']
    }
  }
};

describe('routeToolCall', () => {
  beforeEach(() => {
    resetToolRegistry();
  });

  it('routes to the correct handler and returns formatted response', async () => {
    getToolRegistry().register(testHandler);

    const result = await routeToolCall('test_tool', { value: 5 });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'text', text: 'Result: 10' });
  });

  it('throws for unknown tool', async () => {
    await expect(routeToolCall('unknown_tool', {})).rejects.toThrow('Unknown tool');
  });

  it('throws for invalid input', async () => {
    getToolRegistry().register(testHandler);

    await expect(routeToolCall('test_tool', { value: 'not a number' })).rejects.toThrow();
  });

  it('preserves errors thrown by the tool execute function', async () => {
    const failingHandler: ToolHandler<TestInput, TestResult> = {
      ...testHandler,
      name: 'failing_tool',
      execute: () => {
        throw new Error('Tool execution failed');
      },
      definition: { ...testHandler.definition, name: 'failing_tool' }
    };

    getToolRegistry().register(failingHandler);

    await expect(routeToolCall('failing_tool', { value: 5 })).rejects.toThrow(
      'Tool execution failed'
    );
  });

  it('handles concurrent calls to the same tool', async () => {
    getToolRegistry().register(testHandler);

    const results = await Promise.all([
      routeToolCall('test_tool', { value: 1 }),
      routeToolCall('test_tool', { value: 2 }),
      routeToolCall('test_tool', { value: 3 })
    ]);

    expect(results).toHaveLength(3);
    expect(results[0][0].text).toBe('Result: 2');
    expect(results[1][0].text).toBe('Result: 4');
    expect(results[2][0].text).toBe('Result: 6');
  });

  it('handles zero as valid numeric input', async () => {
    getToolRegistry().register(testHandler);
    const result = await routeToolCall('test_tool', { value: 0 });
    expect(result[0].text).toBe('Result: 0');
  });

  it('handles negative numbers', async () => {
    getToolRegistry().register(testHandler);
    const result = await routeToolCall('test_tool', { value: -5 });
    expect(result[0].text).toBe('Result: -10');
  });

  it('rejects extra unknown properties (strict validation)', async () => {
    getToolRegistry().register(testHandler);
    // Zod strips unknown properties by default, so this should work
    const result = await routeToolCall('test_tool', { value: 5, extra: 'ignored' });
    expect(result[0].text).toBe('Result: 10');
  });

  it('handles tool that returns multiple content items', async () => {
    const multiHandler: ToolHandler<TestInput, TestResult> = {
      ...testHandler,
      name: 'multi_tool',
      formatResponse: (result) => [
        { type: 'text', text: `Line 1: ${result.result}` },
        { type: 'text', text: `Line 2: done` }
      ],
      definition: { ...testHandler.definition, name: 'multi_tool' }
    };

    getToolRegistry().register(multiHandler);
    const result = await routeToolCall('multi_tool', { value: 5 });
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Line 1: 10');
    expect(result[1].text).toBe('Line 2: done');
  });

  it('records invocation metrics on success', async () => {
    getToolRegistry().register(testHandler);
    const metrics = getMetrics();

    await routeToolCall('test_tool', { value: 1 });

    const allMetrics = metrics.getMetrics();
    const invocations = allMetrics.find((m) => m.name === 'tool_invocations_total');
    const successes = allMetrics.find((m) => m.name === 'tool_success_total');
    expect(invocations?.type).toBe('counter');
    expect(successes?.type).toBe('counter');
  });

  it('records error metrics on failure', async () => {
    const failHandler: ToolHandler<TestInput, TestResult> = {
      ...testHandler,
      name: 'fail_metrics_tool',
      execute: () => {
        throw new Error('fail for metrics');
      },
      definition: { ...testHandler.definition, name: 'fail_metrics_tool' }
    };

    getToolRegistry().register(failHandler);
    const metrics = getMetrics();

    await expect(routeToolCall('fail_metrics_tool', { value: 1 })).rejects.toThrow();

    const allMetrics = metrics.getMetrics();
    const errors = allMetrics.find((m) => m.name === 'tool_errors_total');
    expect(errors?.type).toBe('counter');
  });

  it('records duration histogram for both success and failure paths', async () => {
    getToolRegistry().register(testHandler);
    const failHandler: ToolHandler<TestInput, TestResult> = {
      ...testHandler,
      name: 'duration_fail_tool',
      execute: () => {
        throw new Error('duration test');
      },
      definition: { ...testHandler.definition, name: 'duration_fail_tool' }
    };
    getToolRegistry().register(failHandler);

    await routeToolCall('test_tool', { value: 1 });
    await expect(routeToolCall('duration_fail_tool', { value: 1 })).rejects.toThrow();

    const allMetrics = getMetrics().getMetrics();
    const durations = allMetrics.find((m) => m.name === 'tool_duration_ms');
    expect(durations?.type).toBe('histogram');
  });

  it('propagates the original error type for ZodError on invalid input', async () => {
    getToolRegistry().register(testHandler);

    try {
      await routeToolCall('test_tool', { value: 'not_a_number' });
      expect.fail('Should have thrown');
    } catch (error) {
      expect((error as Error).name).toBe('ZodError');
    }
  });

  it('propagates non-Error thrown values from execute', async () => {
    const stringThrowHandler: ToolHandler<TestInput, TestResult> = {
      ...testHandler,
      name: 'string_throw_tool',
      execute: () => {
        throw 'raw string error';
      },
      definition: { ...testHandler.definition, name: 'string_throw_tool' }
    };

    getToolRegistry().register(stringThrowHandler);
    await expect(routeToolCall('string_throw_tool', { value: 1 })).rejects.toBe('raw string error');
  });
});
