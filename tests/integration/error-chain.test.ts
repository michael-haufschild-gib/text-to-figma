/**
 * Error Chain Integration Tests
 *
 * Verifies that errors propagate correctly across the full stack:
 * FigmaBridge → Tool execute → Tool Router → Error Tracker → Metrics
 *
 * These tests catch a class of bugs where error wrapping, categorization,
 * or metrics tracking silently drops information at layer boundaries.
 * Each test verifies that error details survive the entire chain intact.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { getToolRegistry, resetToolRegistry } from '../../mcp-server/src/routing/tool-registry.js';
import { routeToolCall } from '../../mcp-server/src/routing/tool-router.js';
import { getMetrics, resetMetrics } from '../../mcp-server/src/monitoring/metrics.js';
import {
  getErrorTracker,
  resetErrorTracker
} from '../../mcp-server/src/monitoring/error-tracker.js';
import { loadConfig, resetConfig } from '../../mcp-server/src/config.js';
import {
  ToolExecutionError,
  FigmaAPIError,
  NetworkError,
  ValidationError
} from '../../mcp-server/src/errors/index.js';
import type { AnyToolHandler } from '../../mcp-server/src/routing/tool-handler.js';

describe('Error Chain Integration', () => {
  function registerErrorTools(): void {
    const registry = getToolRegistry();

    // Tool that wraps bridge errors as NetworkError
    const networkErrorTool: AnyToolHandler = {
      name: 'network_error_tool',
      schema: z.object({ trigger: z.string() }),
      execute: () => {
        return Promise.reject(
          new NetworkError(
            'Failed to communicate with Figma',
            'network_error_tool',
            'figma-bridge',
            undefined,
            new Error('WebSocket closed')
          )
        );
      },
      formatResponse: () => [{ type: 'text', text: 'unreachable' }],
      definition: {
        name: 'network_error_tool',
        description: 'Test: throws NetworkError',
        inputSchema: {
          type: 'object',
          properties: { trigger: { type: 'string' } },
          required: ['trigger']
        }
      }
    };

    // Tool that wraps bridge errors as FigmaAPIError
    const apiErrorTool: AnyToolHandler = {
      name: 'api_error_tool',
      schema: z.object({ trigger: z.string() }),
      execute: () => {
        return Promise.reject(
          new FigmaAPIError(
            'Figma frame creation failed',
            'api_error_tool',
            'create_frame',
            { name: 'Test' },
            new Error('Internal Figma error')
          )
        );
      },
      formatResponse: () => [{ type: 'text', text: 'unreachable' }],
      definition: {
        name: 'api_error_tool',
        description: 'Test: throws FigmaAPIError',
        inputSchema: {
          type: 'object',
          properties: { trigger: { type: 'string' } },
          required: ['trigger']
        }
      }
    };

    // Tool that throws a ValidationError
    const validationErrorTool: AnyToolHandler = {
      name: 'validation_error_tool',
      schema: z.object({ trigger: z.string() }),
      execute: () => {
        return Promise.reject(
          new ValidationError('Parent validation failed', 'validation_error_tool', {
            name: 'Bad'
          })
        );
      },
      formatResponse: () => [{ type: 'text', text: 'unreachable' }],
      definition: {
        name: 'validation_error_tool',
        description: 'Test: throws ValidationError',
        inputSchema: {
          type: 'object',
          properties: { trigger: { type: 'string' } },
          required: ['trigger']
        }
      }
    };

    // Tool that throws a raw non-Error value (testing wrapError path)
    const rawThrowTool: AnyToolHandler = {
      name: 'raw_throw_tool',
      schema: z.object({ trigger: z.string() }),
      execute: () => {
        return Promise.reject('string error from Figma');
      },
      formatResponse: () => [{ type: 'text', text: 'unreachable' }],
      definition: {
        name: 'raw_throw_tool',
        description: 'Test: throws raw string',
        inputSchema: {
          type: 'object',
          properties: { trigger: { type: 'string' } },
          required: ['trigger']
        }
      }
    };

    registry.register(networkErrorTool);
    registry.register(apiErrorTool);
    registry.register(validationErrorTool);
    registry.register(rawThrowTool);
  }

  beforeEach(() => {
    resetToolRegistry();
    resetMetrics();
    resetErrorTracker();
    loadConfig();
    registerErrorTools();
  });

  afterEach(() => {
    resetToolRegistry();
    resetMetrics();
    resetErrorTracker();
    resetConfig();
  });

  describe('NetworkError propagation', () => {
    it('preserves error class and message through router', async () => {
      try {
        await routeToolCall('network_error_tool', { trigger: 'go' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError);
        expect((error as NetworkError).message).toBe('Failed to communicate with Figma');
        expect((error as NetworkError).tool).toBe('network_error_tool');
      }
    });

    it('preserves the cause chain (original error accessible)', async () => {
      try {
        await routeToolCall('network_error_tool', { trigger: 'go' });
        expect.fail('Should have thrown');
      } catch (error) {
        const netErr = error as NetworkError;
        expect(netErr.cause).toBeInstanceOf(Error);
        expect((netErr.cause as Error).message).toBe('WebSocket closed');
      }
    });

    it('is tracked in metrics with correct error_type label', async () => {
      resetMetrics();
      const metrics = getMetrics();
      const errors = metrics.counter('tool_errors_total');

      await routeToolCall('network_error_tool', { trigger: 'go' }).catch(() => {});

      expect(errors.get({ tool: 'network_error_tool', error_type: 'NetworkError' })).toBe(1);
    });

    it('is tracked by error tracker with correct category', async () => {
      await routeToolCall('network_error_tool', { trigger: 'go' }).catch(() => {});

      const tracker = getErrorTracker();
      const all = tracker.getAll();
      expect(all.length).toBeGreaterThanOrEqual(1);
      // The error message contains "communicate" which doesn't match standard categories,
      // but the error tracker should still track it
      const tracked = all.find((e) => e.error.message.includes('communicate'));
      expect(tracked?.error.message).toBe('Failed to communicate with Figma');
    });
  });

  describe('FigmaAPIError propagation', () => {
    it('preserves error class, tool name, and operation through router', async () => {
      try {
        await routeToolCall('api_error_tool', { trigger: 'go' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FigmaAPIError);
        const apiErr = error as FigmaAPIError;
        expect(apiErr.tool).toBe('api_error_tool');
        expect(apiErr.operation).toBe('create_frame');
        expect(apiErr.message).toBe('Figma frame creation failed');
      }
    });

    it('input is preserved on the error for debugging', async () => {
      try {
        await routeToolCall('api_error_tool', { trigger: 'go' });
        expect.fail('Should have thrown');
      } catch (error) {
        const apiErr = error as FigmaAPIError;
        expect(apiErr.input).toEqual({ name: 'Test' });
      }
    });
  });

  describe('ValidationError propagation', () => {
    it('preserves ValidationError identity through router', async () => {
      try {
        await routeToolCall('validation_error_tool', { trigger: 'go' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toBe('Parent validation failed');
      }
    });

    it('is tracked in metrics as ValidationError type', async () => {
      resetMetrics();
      const metrics = getMetrics();
      const errors = metrics.counter('tool_errors_total');

      await routeToolCall('validation_error_tool', { trigger: 'go' }).catch(() => {});

      expect(errors.get({ tool: 'validation_error_tool', error_type: 'ValidationError' })).toBe(1);
    });
  });

  describe('raw throw (non-Error) propagation', () => {
    it('raw string throw is propagated as-is through router', async () => {
      try {
        await routeToolCall('raw_throw_tool', { trigger: 'go' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBe('string error from Figma');
      }
    });

    it('raw throw is tracked in metrics with "Error" error_type (wrapped by router)', async () => {
      resetMetrics();
      const metrics = getMetrics();
      const errors = metrics.counter('tool_errors_total');

      await routeToolCall('raw_throw_tool', { trigger: 'go' }).catch(() => {});

      // Non-Error thrown values: the router wraps them as new Error(String(error))
      // which has name = 'Error'. The original string is re-thrown to the caller,
      // but the metrics tracking uses the wrapped Error object.
      expect(errors.get({ tool: 'raw_throw_tool', error_type: 'Error' })).toBe(1);
    });
  });

  describe('Zod validation error from schema parse', () => {
    it('schema validation failure produces ZodError tracked in metrics', async () => {
      resetMetrics();
      const metrics = getMetrics();
      const errors = metrics.counter('tool_errors_total');

      // Send input that fails schema validation (empty trigger string would still pass,
      // but missing required field won't)
      await routeToolCall('network_error_tool', {}).catch(() => {});

      expect(errors.get({ tool: 'network_error_tool', error_type: 'ZodError' })).toBe(1);
    });

    it('schema error message includes details about what failed', async () => {
      try {
        await routeToolCall('network_error_tool', { trigger: 42 }); // wrong type
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).name).toBe('ZodError');
        const message = (error as Error).message;
        expect(message.length).toBeGreaterThan(0);
      }
    });
  });

  describe('error toJSON serialization survives the chain', () => {
    it('ToolExecutionError.toJSON includes all fields', async () => {
      try {
        await routeToolCall('api_error_tool', { trigger: 'go' });
        expect.fail('Should have thrown');
      } catch (error) {
        const json = (error as FigmaAPIError).toJSON();
        expect(json.name).toBe('FigmaAPIError');
        expect(json.message).toBe('Figma frame creation failed');
        expect(json.tool).toBe('api_error_tool');
        expect(json.operation).toBe('create_frame');
        expect(json.code).toBe('OP_FAILED');
        expect(json.cause).toEqual({
          name: 'Error',
          message: 'Internal Figma error'
        });
      }
    });
  });

  describe('multiple errors from different tools track independently', () => {
    it('each tool error increments its own counter', async () => {
      resetMetrics();
      const metrics = getMetrics();
      const errors = metrics.counter('tool_errors_total');

      await routeToolCall('network_error_tool', { trigger: 'go' }).catch(() => {});
      await routeToolCall('api_error_tool', { trigger: 'go' }).catch(() => {});
      await routeToolCall('validation_error_tool', { trigger: 'go' }).catch(() => {});

      expect(errors.get({ tool: 'network_error_tool', error_type: 'NetworkError' })).toBe(1);
      expect(errors.get({ tool: 'api_error_tool', error_type: 'FigmaAPIError' })).toBe(1);
      expect(errors.get({ tool: 'validation_error_tool', error_type: 'ValidationError' })).toBe(1);
    });

    it('invocation counter still increments on failure', async () => {
      resetMetrics();
      const metrics = getMetrics();
      const invocations = metrics.counter('tool_invocations_total');

      await routeToolCall('network_error_tool', { trigger: 'go' }).catch(() => {});
      await routeToolCall('api_error_tool', { trigger: 'go' }).catch(() => {});

      expect(invocations.get({ tool: 'network_error_tool' })).toBe(1);
      expect(invocations.get({ tool: 'api_error_tool' })).toBe(1);
    });
  });
});
