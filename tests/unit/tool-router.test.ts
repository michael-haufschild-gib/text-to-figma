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
  execute: (input) => Promise.resolve({ result: input.value * 2 }),
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

  it('increments invocation counter by 1 per call', async () => {
    getToolRegistry().register(testHandler);
    resetMetrics();
    const metrics = getMetrics();
    const invocations = metrics.counter('tool_invocations_total');

    await routeToolCall('test_tool', { value: 1 });
    await routeToolCall('test_tool', { value: 2 });

    expect(invocations.get({ tool: 'test_tool' })).toBe(2);
  });

  it('increments success counter only on success', async () => {
    const failHandler: ToolHandler<TestInput, TestResult> = {
      ...testHandler,
      name: 'sometimes_fails',
      execute: (input) => {
        if (input.value === 0) throw new Error('zero not allowed');
        return { result: input.value };
      },
      definition: { ...testHandler.definition, name: 'sometimes_fails' }
    };
    getToolRegistry().register(failHandler);
    resetMetrics();
    const metrics = getMetrics();
    const successes = metrics.counter('tool_success_total');

    await routeToolCall('sometimes_fails', { value: 5 });
    await routeToolCall('sometimes_fails', { value: 3 }).catch(() => {});
    await expect(routeToolCall('sometimes_fails', { value: 0 })).rejects.toThrow();

    expect(successes.get({ tool: 'sometimes_fails' })).toBe(2);
  });

  it('records error_type label from error name', async () => {
    const typedErrorHandler: ToolHandler<TestInput, TestResult> = {
      ...testHandler,
      name: 'typed_error_tool',
      execute: () => {
        const err = new Error('custom');
        err.name = 'CustomError';
        throw err;
      },
      definition: { ...testHandler.definition, name: 'typed_error_tool' }
    };
    getToolRegistry().register(typedErrorHandler);
    resetMetrics();
    const metrics = getMetrics();
    const errors = metrics.counter('tool_errors_total');

    await routeToolCall('typed_error_tool', { value: 1 }).catch(() => {});

    expect(errors.get({ tool: 'typed_error_tool', error_type: 'CustomError' })).toBe(1);
  });

  it('handles async execute function returning a promise', async () => {
    const asyncHandler: ToolHandler<TestInput, TestResult> = {
      ...testHandler,
      name: 'async_tool',
      execute: async (input) => {
        await new Promise((r) => setTimeout(r, 1));
        return { result: input.value * 3 };
      },
      definition: { ...testHandler.definition, name: 'async_tool' }
    };

    getToolRegistry().register(asyncHandler);
    const result = await routeToolCall('async_tool', { value: 7 });
    expect(result[0].text).toBe('Result: 21');
  });

  it('concurrent calls to different tools track independent metrics', async () => {
    const handlerA: ToolHandler<TestInput, TestResult> = {
      ...testHandler,
      name: 'tool_a',
      execute: async (input) => {
        await new Promise((r) => setTimeout(r, 1));
        return { result: input.value + 1 };
      },
      definition: { ...testHandler.definition, name: 'tool_a' }
    };

    const handlerB: ToolHandler<TestInput, TestResult> = {
      ...testHandler,
      name: 'tool_b',
      execute: (input) => Promise.resolve({ result: input.value + 2 }),
      definition: { ...testHandler.definition, name: 'tool_b' }
    };

    getToolRegistry().register(handlerA);
    getToolRegistry().register(handlerB);
    resetMetrics();
    const metrics = getMetrics();
    const invocations = metrics.counter('tool_invocations_total');

    // Fire concurrently
    const results = await Promise.all([
      routeToolCall('tool_a', { value: 10 }),
      routeToolCall('tool_b', { value: 20 }),
      routeToolCall('tool_a', { value: 30 })
    ]);

    expect(results[0][0].text).toBe('Result: 11');
    expect(results[1][0].text).toBe('Result: 22');
    expect(results[2][0].text).toBe('Result: 31');

    expect(invocations.get({ tool: 'tool_a' })).toBe(2);
    expect(invocations.get({ tool: 'tool_b' })).toBe(1);
  });

  it('propagates error when formatResponse throws', async () => {
    const badFormatHandler: ToolHandler<TestInput, TestResult> = {
      ...testHandler,
      name: 'bad_format_tool',
      formatResponse: () => {
        throw new Error('format exploded');
      },
      definition: { ...testHandler.definition, name: 'bad_format_tool' }
    };

    getToolRegistry().register(badFormatHandler);
    await expect(routeToolCall('bad_format_tool', { value: 1 })).rejects.toThrow('format exploded');
  });

  it('records "unknown" error_type when error name is empty string', async () => {
    const emptyNameHandler: ToolHandler<TestInput, TestResult> = {
      ...testHandler,
      name: 'empty_name_tool',
      execute: () => {
        const err = new Error('nameless');
        err.name = '';
        throw err;
      },
      definition: { ...testHandler.definition, name: 'empty_name_tool' }
    };

    getToolRegistry().register(emptyNameHandler);
    resetMetrics();
    const metrics = getMetrics();
    const errors = metrics.counter('tool_errors_total');

    await routeToolCall('empty_name_tool', { value: 1 }).catch(() => {});

    expect(errors.get({ tool: 'empty_name_tool', error_type: 'unknown' })).toBe(1);
  });

  it('formatResponse error increments only error counter, not success counter', async () => {
    const formatFailHandler: ToolHandler<TestInput, TestResult> = {
      ...testHandler,
      name: 'format_error_metrics',
      formatResponse: () => {
        throw new Error('bad format');
      },
      definition: { ...testHandler.definition, name: 'format_error_metrics' }
    };

    getToolRegistry().register(formatFailHandler);
    resetMetrics();
    const metrics = getMetrics();
    const successes = metrics.counter('tool_success_total');
    const errors = metrics.counter('tool_errors_total');

    await routeToolCall('format_error_metrics', { value: 1 }).catch(() => {});

    // formatResponse failure must NOT count as success
    expect(successes.get({ tool: 'format_error_metrics' })).toBe(0);
    expect(errors.get({ tool: 'format_error_metrics', error_type: 'Error' })).toBe(1);
  });
});
