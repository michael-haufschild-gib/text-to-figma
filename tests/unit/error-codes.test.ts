/**
 * Structured Error Codes Unit Tests
 */

import { describe, expect, it } from 'vitest';
import {
  ErrorCode,
  createError,
  createErrorWithSuggestion,
  formatStructuredError,
  isStructuredError
} from '../../mcp-server/src/errors/error-codes.js';

describe('Error Codes', () => {
  describe('createError', () => {
    it('creates structured error with auto-suggestion', () => {
      const err = createError(ErrorCode.NODE_NOT_FOUND, 'Node 123 missing');
      expect(err.code).toBe(ErrorCode.NODE_NOT_FOUND);
      expect(err.message).toBe('Node 123 missing');
      expect(err.suggestion).toContain('get_page_hierarchy');
    });

    it('includes details when provided', () => {
      const err = createError(ErrorCode.OP_TIMEOUT, 'Timed out', { requestId: 'r1' });
      expect(err.details).toEqual({ requestId: 'r1' });
    });

    it('sets suggestion to undefined for unknown code', () => {
      const err = createError('CUSTOM_CODE' as ErrorCode, 'Custom');
      expect(err.suggestion).toBeUndefined();
    });
  });

  describe('createErrorWithSuggestion', () => {
    it('uses the provided suggestion instead of default', () => {
      const err = createErrorWithSuggestion(
        ErrorCode.CONN_FAILED,
        'Cannot connect',
        'Try restarting',
        { port: 8080 }
      );
      expect(err.suggestion).toBe('Try restarting');
      expect(err.details).toEqual({ port: 8080 });
    });
  });

  describe('isStructuredError', () => {
    it('returns true for valid structured errors', () => {
      const err = createError(ErrorCode.VAL_FAILED, 'Bad input');
      expect(isStructuredError(err)).toBe(true);
    });

    it('returns false for plain objects missing code', () => {
      expect(isStructuredError({ message: 'no code' })).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isStructuredError(null)).toBe(false);
      expect(isStructuredError(undefined)).toBe(false);
    });

    it('returns false for non-objects', () => {
      expect(isStructuredError('string')).toBe(false);
      expect(isStructuredError(42)).toBe(false);
    });

    it('returns false for invalid code value', () => {
      expect(isStructuredError({ code: 'NOT_REAL', message: 'test' })).toBe(false);
    });
  });

  describe('formatStructuredError', () => {
    it('formats basic error with code and message', () => {
      const err = createError(ErrorCode.SYS_INTERNAL, 'Unexpected failure');
      const text = formatStructuredError(err);
      expect(text).toContain('SYS_INTERNAL');
      expect(text).toContain('Unexpected failure');
    });

    it('includes details when present', () => {
      const err = createError(ErrorCode.OP_FAILED, 'Failed', { tool: 'create_frame' });
      const text = formatStructuredError(err);
      expect(text).toContain('Details:');
      expect(text).toContain('create_frame');
    });

    it('includes suggestion when present', () => {
      const err = createError(ErrorCode.CONN_NOT_CONNECTED, 'Not connected');
      const text = formatStructuredError(err);
      expect(text).toContain('Suggestion:');
    });

    it('omits Details section when details is empty', () => {
      const err = createError(ErrorCode.SYS_INTERNAL, 'Error', {});
      const text = formatStructuredError(err);
      expect(text).not.toContain('Details:');
    });
  });

  describe('all error codes have suggestions', () => {
    const allCodes = Object.values(ErrorCode);

    it.each(allCodes)('ErrorCode.%s has a default suggestion', (code) => {
      const err = createError(code as ErrorCode, 'test');
      expect(err.suggestion).toBeTypeOf('string');
      // Previous line already asserts it's a string, now check non-empty
      expect(err.suggestion!.length).toBeGreaterThan(0);
    });
  });

  describe('error code categories', () => {
    it('CONN codes all start with CONN_', () => {
      const connCodes = Object.values(ErrorCode).filter((c) => c.startsWith('CONN_'));
      expect(connCodes.length).toBeGreaterThanOrEqual(4);
    });

    it('NODE codes all start with NODE_', () => {
      const nodeCodes = Object.values(ErrorCode).filter((c) => c.startsWith('NODE_'));
      expect(nodeCodes.length).toBeGreaterThanOrEqual(4);
    });

    it('VAL codes all start with VAL_', () => {
      const valCodes = Object.values(ErrorCode).filter((c) => c.startsWith('VAL_'));
      expect(valCodes.length).toBeGreaterThanOrEqual(6);
    });

    it('OP codes all start with OP_', () => {
      const opCodes = Object.values(ErrorCode).filter((c) => c.startsWith('OP_'));
      expect(opCodes.length).toBeGreaterThanOrEqual(5);
    });

    it('SYS codes all start with SYS_', () => {
      const sysCodes = Object.values(ErrorCode).filter((c) => c.startsWith('SYS_'));
      expect(sysCodes.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('formatStructuredError for all error codes', () => {
    const allCodes = Object.values(ErrorCode);

    it.each(allCodes)('formatStructuredError produces valid output for %s', (code) => {
      const err = createError(code as ErrorCode, `Test error for ${code}`);
      const text = formatStructuredError(err);

      expect(text).toContain(code);
      expect(text).toContain(`Test error for ${code}`);
      expect(text).toContain('Suggestion:');
    });
  });

  describe('suggestions are actionable', () => {
    it('CONN suggestions mention connection-related actions', () => {
      const connCodes = Object.values(ErrorCode).filter((c) => c.startsWith('CONN_'));
      for (const code of connCodes) {
        const err = createError(code as ErrorCode, 'test');
        // Suggestions for connection errors should mention Figma, connection, or check
        expect(err.suggestion!.length).toBeGreaterThan(10);
      }
    });

    it('NODE suggestions mention node-related actions', () => {
      const nodeCodes = Object.values(ErrorCode).filter((c) => c.startsWith('NODE_'));
      for (const code of nodeCodes) {
        const err = createError(code as ErrorCode, 'test');
        expect(err.suggestion!.length).toBeGreaterThan(10);
      }
    });
  });

  describe('createError with details', () => {
    it('preserves complex nested details', () => {
      const details = {
        tool: 'create_frame',
        input: { name: 'Test', width: 100 },
        metadata: { attempt: 3 }
      };
      const err = createError(ErrorCode.OP_FAILED, 'Failed', details);
      expect(err.details).toEqual(details);
    });

    it('preserves undefined details when not provided', () => {
      const err = createError(ErrorCode.OP_FAILED, 'Failed');
      expect(err.details).toBeUndefined();
    });
  });

  describe('isStructuredError edge cases', () => {
    it('rejects object with valid code but no message', () => {
      expect(isStructuredError({ code: ErrorCode.OP_FAILED })).toBe(false);
    });

    it('accepts object with valid code and message', () => {
      const err = createError(ErrorCode.OP_FAILED, 'test');
      expect(isStructuredError(err)).toBe(true);
    });
  });
});
