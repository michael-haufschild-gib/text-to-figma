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
});
