/**
 * Error Propagation Integration Tests
 *
 * Tests that errors flow correctly through the entire system:
 * tool execution → router error wrapping → error tracking → statistics.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAllTools } from '../../mcp-server/src/routing/register-tools.js';
import { getToolRegistry, resetToolRegistry } from '../../mcp-server/src/routing/tool-registry.js';
import { routeToolCall } from '../../mcp-server/src/routing/tool-router.js';
import { ErrorTracker } from '../../mcp-server/src/monitoring/error-tracker.js';
import {
  ErrorCode,
  createError,
  createErrorWithSuggestion,
  formatStructuredError,
  isStructuredError
} from '../../mcp-server/src/errors/error-codes.js';
import {
  ToolExecutionError,
  ValidationError,
  wrapError,
  isToolExecutionError,
  isValidationError
} from '../../mcp-server/src/errors/index.js';

describe('Error Propagation', () => {
  let tracker: ErrorTracker;

  beforeEach(() => {
    resetToolRegistry();
    registerAllTools();
    tracker = new ErrorTracker();
  });

  afterEach(() => {
    resetToolRegistry();
    tracker.destroy();
  });

  describe('validation errors through the router', () => {
    it('invalid tool input produces a catchable error', async () => {
      try {
        await routeToolCall('check_wcag_contrast', {
          foreground: 'not-a-color',
          background: '#FFFFFF'
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);

        // Track the error
        tracker.track(error as Error);
        const stats = tracker.getStatistics();
        expect(stats.total).toBe(1);
      }
    });

    it('unknown tool name produces an error with descriptive message', async () => {
      try {
        await routeToolCall('nonexistent_tool', {});
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('Unknown tool');
      }
    });
  });

  describe('structured error system', () => {
    it('createError → isStructuredError → formatStructuredError chain works', () => {
      const err = createError(ErrorCode.NODE_NOT_FOUND, 'Node 123 not found');

      expect(isStructuredError(err)).toBe(true);

      const formatted = formatStructuredError(err);
      expect(formatted).toContain('NODE_NOT_FOUND');
      expect(formatted).toContain('Node 123 not found');
      expect(formatted).toContain('Suggestion:');
    });

    it('createErrorWithSuggestion includes custom suggestion', () => {
      const err = createErrorWithSuggestion(
        ErrorCode.CONN_FAILED,
        'Cannot connect',
        'Check the WebSocket server',
        { port: 8080 }
      );

      const formatted = formatStructuredError(err);
      expect(formatted).toContain('Check the WebSocket server');
      expect(formatted).toContain('8080');
    });
  });

  describe('error wrapping preserves context', () => {
    it('wrapError chains through ToolExecutionError', () => {
      const original = new Error('Node not found');
      const wrapped = wrapError(original, 'create_frame', { x: 100 });

      expect(isToolExecutionError(wrapped)).toBe(true);
      expect(wrapped.message).toBe('Node not found');
      expect(wrapped.tool).toBe('create_frame');
      expect(wrapped.input).toEqual({ x: 100 });
      expect(wrapped.cause).toBe(original);
    });

    it('ValidationError preserves validation details through wrapError', () => {
      const valErr = new ValidationError('Invalid color', 'set_fills', { color: 'red' }, [
        { field: 'color', message: 'must be hex' }
      ]);
      const wrapped = wrapError(valErr, 'set_fills');

      // wrapError should return the original since it's already a ToolExecutionError
      expect(wrapped).toBe(valErr);
      expect(isValidationError(wrapped)).toBe(true);
      expect((wrapped as ValidationError).validationErrors).toHaveLength(1);
    });
  });

  describe('error tracking integration', () => {
    it('router validation errors get tracked and categorized', async () => {
      // Cause multiple validation errors
      const tools = [
        { name: 'check_wcag_contrast', input: { foreground: 'bad' } },
        { name: 'validate_design_tokens', input: { spacing: ['not-a-number'] } }
      ];

      for (const { name, input } of tools) {
        try {
          await routeToolCall(name, input);
        } catch (error) {
          tracker.track(error as Error);
        }
      }

      const stats = tracker.getStatistics();
      expect(stats.total).toBe(2);
      expect(stats.uniqueErrors).toBe(2);
    });
  });

  describe('error class hierarchy', () => {
    it('ToolExecutionError toJSON includes all fields', () => {
      const cause = new Error('root cause');
      const err = new ToolExecutionError('Op failed', 'create_frame', { width: 100 }, cause);
      const json = err.toJSON();

      expect(json.name).toBe('ToolExecutionError');
      expect(json.message).toBe('Op failed');
      expect(json.tool).toBe('create_frame');
      expect(json.input).toEqual({ width: 100 });
      expect((json.cause as Record<string, unknown>).message).toBe('root cause');
      expect(json.code).toBe(ErrorCode.OP_FAILED);
    });

    it('ValidationError toJSON includes validationErrors', () => {
      const err = new ValidationError(
        'Bad input',
        'set_fills',
        { color: 'red' },
        [{ field: 'color' }],
        ErrorCode.VAL_INVALID_COLOR
      );
      const json = err.toJSON();

      expect(json.name).toBe('ValidationError');
      expect(json.code).toBe(ErrorCode.VAL_INVALID_COLOR);
      expect(json.validationErrors).toHaveLength(1);
    });

    it('wrapError with non-Error value creates ToolExecutionError from string', () => {
      const wrapped = wrapError('string error', 'test_tool');
      expect(isToolExecutionError(wrapped)).toBe(true);
      expect(wrapped.message).toBe('string error');
      expect(wrapped.tool).toBe('test_tool');
    });
  });

  describe('isStructuredError edge cases', () => {
    it('returns false for null', () => {
      expect(isStructuredError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isStructuredError(undefined)).toBe(false);
    });

    it('returns false for non-object', () => {
      expect(isStructuredError('string')).toBe(false);
      expect(isStructuredError(42)).toBe(false);
    });

    it('returns false for object missing code', () => {
      expect(isStructuredError({ message: 'test' })).toBe(false);
    });

    it('returns false for object with invalid code', () => {
      expect(isStructuredError({ code: 'NOT_REAL', message: 'test' })).toBe(false);
    });

    it('returns true for valid StructuredError', () => {
      const err = createError(ErrorCode.OP_FAILED, 'test');
      expect(isStructuredError(err)).toBe(true);
    });
  });

  describe('formatStructuredError formatting', () => {
    it('includes details when present', () => {
      const err = createError(ErrorCode.OP_TIMEOUT, 'Timed out', { requestId: 'r1' });
      const formatted = formatStructuredError(err);
      expect(formatted).toContain('requestId');
      expect(formatted).toContain('r1');
    });

    it('omits details section when no details', () => {
      const err = createError(ErrorCode.OP_FAILED, 'Failed');
      const formatted = formatStructuredError(err);
      expect(formatted).not.toContain('Details:');
    });
  });
});
