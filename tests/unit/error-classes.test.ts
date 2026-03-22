/**
 * Legacy Error Classes Unit Tests
 *
 * Tests ToolExecutionError, ValidationError, FigmaAPIError,
 * NetworkError, ConfigurationError, type guards, and wrapError.
 */

import { describe, expect, it } from 'vitest';
import {
  ToolExecutionError,
  ValidationError,
  FigmaAPIError,
  NetworkError,
  ConfigurationError,
  FigmaBridgeError,
  isToolExecutionError,
  isValidationError,
  isFigmaAPIError,
  isNetworkError,
  isConfigurationError,
  isFigmaBridgeError,
  wrapError
} from '../../mcp-server/src/errors/index.js';
import { ErrorCode, createError } from '../../mcp-server/src/errors/error-codes.js';

describe('ToolExecutionError', () => {
  it('stores tool name and message', () => {
    const err = new ToolExecutionError('Operation failed', 'create_frame');
    expect(err.message).toBe('Operation failed');
    expect(err.tool).toBe('create_frame');
    expect(err.name).toBe('ToolExecutionError');
    expect(err).toBeInstanceOf(Error);
  });

  it('stores optional input and cause', () => {
    const cause = new Error('root cause');
    const err = new ToolExecutionError('Failed', 'set_fills', { nodeId: '123' }, cause);
    expect(err.input).toEqual({ nodeId: '123' });
    expect(err.cause).toBe(cause);
  });

  it('serializes to JSON with all fields', () => {
    const cause = new Error('root');
    const err = new ToolExecutionError('msg', 'tool', { x: 1 }, cause);
    const json = err.toJSON();
    expect(json.name).toBe('ToolExecutionError');
    expect(json.message).toBe('msg');
    expect(json.tool).toBe('tool');
    expect(json.input).toEqual({ x: 1 });
    expect((json.cause as Record<string, unknown>).message).toBe('root');
    expect(json.stack).toBeTypeOf('string');
  });

  it('serializes without cause when not provided', () => {
    const err = new ToolExecutionError('msg', 'tool');
    const json = err.toJSON();
    expect(json.cause).toBeUndefined();
  });
});

describe('ValidationError', () => {
  it('extends ToolExecutionError', () => {
    const err = new ValidationError('Invalid input', 'create_text');
    expect(err).toBeInstanceOf(ToolExecutionError);
    expect(err.name).toBe('ValidationError');
  });

  it('stores validation errors', () => {
    const valErrors = [{ field: 'color', message: 'invalid hex' }];
    const err = new ValidationError('Invalid', 'set_fills', { color: 'red' }, valErrors);
    expect(err.validationErrors).toEqual(valErrors);
  });

  it('includes validationErrors in JSON', () => {
    const err = new ValidationError('Invalid', 'tool', undefined, ['error1']);
    const json = err.toJSON();
    expect(json.validationErrors).toEqual(['error1']);
    expect(json.name).toBe('ValidationError');
  });
});

describe('FigmaAPIError', () => {
  it('extends ToolExecutionError with operation field', () => {
    const err = new FigmaAPIError('API failed', 'create_frame', 'createFrame');
    expect(err).toBeInstanceOf(ToolExecutionError);
    expect(err.name).toBe('FigmaAPIError');
    expect(err.operation).toBe('createFrame');
  });

  it('includes operation in JSON', () => {
    const json = new FigmaAPIError('msg', 'tool', 'op').toJSON();
    expect(json.operation).toBe('op');
  });
});

describe('NetworkError', () => {
  it('extends ToolExecutionError with endpoint field', () => {
    const err = new NetworkError('Timeout', 'create_frame', 'ws://localhost:8080');
    expect(err).toBeInstanceOf(ToolExecutionError);
    expect(err.name).toBe('NetworkError');
    expect(err.endpoint).toBe('ws://localhost:8080');
  });

  it('includes endpoint in JSON', () => {
    const json = new NetworkError('msg', 'tool', '/api').toJSON();
    expect(json.endpoint).toBe('/api');
  });
});

describe('ConfigurationError', () => {
  it('stores key and value', () => {
    const err = new ConfigurationError('Invalid port', 'HEALTH_CHECK_PORT', 'abc');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ConfigurationError');
    expect(err.key).toBe('HEALTH_CHECK_PORT');
    expect(err.value).toBe('abc');
  });

  it('serializes to JSON', () => {
    const err = new ConfigurationError('Bad value', 'KEY', 42);
    const json = err.toJSON();
    expect(json.name).toBe('ConfigurationError');
    expect(json.key).toBe('KEY');
    expect(json.value).toBe(42);
  });
});

describe('Type guards', () => {
  const toolErr = new ToolExecutionError('msg', 'tool');
  const valErr = new ValidationError('msg', 'tool');
  const figmaErr = new FigmaAPIError('msg', 'tool', 'op');
  const netErr = new NetworkError('msg', 'tool');
  const configErr = new ConfigurationError('msg', 'key');
  const plainErr = new Error('plain');

  describe('isToolExecutionError', () => {
    it('returns true for ToolExecutionError and subclasses', () => {
      expect(isToolExecutionError(toolErr)).toBe(true);
      expect(isToolExecutionError(valErr)).toBe(true);
      expect(isToolExecutionError(figmaErr)).toBe(true);
      expect(isToolExecutionError(netErr)).toBe(true);
    });

    it('returns false for non-ToolExecutionError', () => {
      expect(isToolExecutionError(plainErr)).toBe(false);
      expect(isToolExecutionError(configErr)).toBe(false);
      expect(isToolExecutionError(null)).toBe(false);
      expect(isToolExecutionError('string')).toBe(false);
    });
  });

  describe('isValidationError', () => {
    it('returns true only for ValidationError', () => {
      expect(isValidationError(valErr)).toBe(true);
      expect(isValidationError(toolErr)).toBe(false);
      expect(isValidationError(plainErr)).toBe(false);
    });
  });

  describe('isFigmaAPIError', () => {
    it('returns true only for FigmaAPIError', () => {
      expect(isFigmaAPIError(figmaErr)).toBe(true);
      expect(isFigmaAPIError(toolErr)).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('returns true only for NetworkError', () => {
      expect(isNetworkError(netErr)).toBe(true);
      expect(isNetworkError(toolErr)).toBe(false);
    });
  });

  describe('isConfigurationError', () => {
    it('returns true only for ConfigurationError', () => {
      expect(isConfigurationError(configErr)).toBe(true);
      expect(isConfigurationError(plainErr)).toBe(false);
    });
  });
});

describe('wrapError', () => {
  it('returns ToolExecutionError unchanged', () => {
    const original = new ToolExecutionError('msg', 'tool');
    const wrapped = wrapError(original, 'other_tool');
    expect(wrapped).toBe(original);
  });

  it('returns subclass errors unchanged', () => {
    const original = new ValidationError('msg', 'tool');
    const wrapped = wrapError(original, 'other_tool');
    expect(wrapped).toBe(original);
  });

  it('wraps plain Error with tool context', () => {
    const original = new Error('plain error');
    const wrapped = wrapError(original, 'create_frame', { x: 100 });
    expect(wrapped).toBeInstanceOf(ToolExecutionError);
    expect(wrapped.message).toBe('plain error');
    expect(wrapped.tool).toBe('create_frame');
    expect(wrapped.input).toEqual({ x: 100 });
    expect(wrapped.cause).toBe(original);
  });

  it('wraps non-Error values (string)', () => {
    const wrapped = wrapError('string error', 'tool');
    expect(wrapped).toBeInstanceOf(ToolExecutionError);
    expect(wrapped.message).toBe('string error');
    expect(wrapped.tool).toBe('tool');
  });

  it('wraps non-Error values (number)', () => {
    const wrapped = wrapError(42, 'tool');
    expect(wrapped.message).toBe('42');
  });

  it('wraps null', () => {
    const wrapped = wrapError(null, 'tool');
    expect(wrapped.message).toBe('null');
  });

  it('wraps undefined', () => {
    const wrapped = wrapError(undefined, 'tool');
    expect(wrapped.message).toBe('undefined');
  });

  it('wraps object thrown as error (uses String())', () => {
    const wrapped = wrapError({ code: 404 }, 'tool');
    expect(wrapped).toBeInstanceOf(ToolExecutionError);
    // String({code: 404}) produces '[object Object]'
    expect(wrapped.message).toBe('[object Object]');
  });

  it('wraps boolean', () => {
    const wrapped = wrapError(false, 'tool');
    expect(wrapped.message).toBe('false');
  });
});

describe('ToolExecutionError JSON edge cases', () => {
  it('toJSON without input produces clean object', () => {
    const err = new ToolExecutionError('Failed', 'test_tool');
    const json = err.toJSON();
    expect(json.name).toBe('ToolExecutionError');
    expect(json.tool).toBe('test_tool');
    expect(json.input).toBeUndefined();
    expect(json.cause).toBeUndefined();
    expect(json.stack).toBeTypeOf('string');
  });

  it('toJSON serializes cause as name + message only (not full chain)', () => {
    const root = new Error('root cause');
    const top = new ToolExecutionError('top error', 'tool_b', undefined, root);

    const json = top.toJSON();
    expect(json.message).toBe('top error');
    const causeJson = json.cause as Record<string, unknown>;
    expect(causeJson.message).toBe('root cause');
    expect(causeJson.name).toBe('Error');
  });

  it('toJSON input is the same reference (not deep-cloned)', () => {
    const input = { nodeId: '123', color: '#FF0000' };
    const err = new ToolExecutionError('Failed', 'tool', input);
    const json = err.toJSON();
    expect(json.input).toEqual(input);
    // toJSON stores direct reference
    expect(json.input).toBe(input);
  });
});

describe('ValidationError edge cases', () => {
  it('empty validationErrors array', () => {
    const err = new ValidationError('Invalid', 'tool', undefined, []);
    expect(err.validationErrors).toEqual([]);
    const json = err.toJSON();
    expect(json.validationErrors).toEqual([]);
  });

  it('validationErrors with complex objects', () => {
    const errors = [
      { field: 'color', message: 'invalid hex', expected: '#FFFFFF', received: 'red' },
      { field: 'size', message: 'too large', max: 100, actual: 200 }
    ];
    const err = new ValidationError('Invalid', 'tool', undefined, errors);
    expect(err.validationErrors).toHaveLength(2);
  });
});

describe('FigmaAPIError edge cases', () => {
  it('preserves operation through toJSON', () => {
    const err = new FigmaAPIError('Figma call failed', 'create_frame', 'createFrame');
    const json = err.toJSON();
    expect(json.operation).toBe('createFrame');
    expect(json.name).toBe('FigmaAPIError');
    expect(json.tool).toBe('create_frame');
  });
});

describe('NetworkError edge cases', () => {
  it('preserves endpoint through toJSON', () => {
    const err = new NetworkError('Connection refused', 'check_connection', 'ws://localhost:8080');
    const json = err.toJSON();
    expect(json.endpoint).toBe('ws://localhost:8080');
    expect(json.name).toBe('NetworkError');
  });
});

describe('FigmaBridgeError', () => {
  it('constructs from StructuredError (new-style)', () => {
    const structured = createError(ErrorCode.CONN_TIMEOUT, 'Connection timed out');
    const err = new FigmaBridgeError(structured);

    expect(err.message).toBe('Connection timed out');
    expect(err.code).toBe(ErrorCode.CONN_TIMEOUT);
    expect(err.name).toBe('FigmaBridgeError');
    expect(err.suggestion).toContain('timed out');
  });

  it('constructs from string (legacy-style)', () => {
    const err = new FigmaBridgeError('Old-style error');

    expect(err.message).toBe('Old-style error');
    expect(err.code).toBe(ErrorCode.SYS_INTERNAL); // default for legacy
    expect(err.name).toBe('FigmaBridgeError');
  });

  it('constructs from string with legacy code', () => {
    const err = new FigmaBridgeError('Network failure', ErrorCode.CONN_FAILED);

    expect(err.message).toBe('Network failure');
    expect(err.code).toBe(ErrorCode.CONN_FAILED);
  });

  it('exposes structuredError property', () => {
    const structured = createError(ErrorCode.OP_TIMEOUT, 'Timeout', { requestId: 'r1' });
    const err = new FigmaBridgeError(structured);

    expect(err.structuredError).toBe(structured);
    expect(err.details).toEqual({ requestId: 'r1' });
  });

  it('isFigmaBridgeError type guard works correctly', () => {
    const structured = createError(ErrorCode.OP_FAILED, 'Failed');
    const bridgeErr = new FigmaBridgeError(structured);

    expect(isFigmaBridgeError(bridgeErr)).toBe(true);
    expect(isFigmaBridgeError(new Error('plain'))).toBe(false);
    expect(isFigmaBridgeError(null)).toBe(false);
    expect(isFigmaBridgeError('string')).toBe(false);
  });

  it('is instanceof Error', () => {
    const err = new FigmaBridgeError('test');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('Type guard exhaustiveness', () => {
  it('type guards return false for unrelated objects', () => {
    const obj = { message: 'not an error', tool: 'fake' };
    expect(isToolExecutionError(obj)).toBe(false);
    expect(isValidationError(obj)).toBe(false);
    expect(isFigmaAPIError(obj)).toBe(false);
    expect(isNetworkError(obj)).toBe(false);
    expect(isConfigurationError(obj)).toBe(false);
  });

  it('type guards return false for undefined', () => {
    expect(isToolExecutionError(undefined)).toBe(false);
    expect(isValidationError(undefined)).toBe(false);
    expect(isFigmaAPIError(undefined)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
    expect(isConfigurationError(undefined)).toBe(false);
  });
});
