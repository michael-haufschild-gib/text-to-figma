/**
 * Figma Bridge Unit Tests
 *
 * Tests FigmaBridgeError construction, error code getters, and
 * the FigmaBridge class: connection status, sendToFigma preconditions,
 * disconnect cleanup, and getConnectionStatus diagnostics.
 *
 * Note: Full WebSocket integration (connect, message handling, retry)
 * cannot be tested without a real WebSocket server. These tests verify
 * the synchronous logic and error handling paths that don't require an
 * active connection.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode, createError } from '../../mcp-server/src/errors/error-codes.js';
import { loadConfig, resetConfig } from '../../mcp-server/src/config.js';

// Mock WebSocket to prevent real connections
vi.mock('ws', () => {
  const EventEmitter = require('events');

  class MockWebSocket extends EventEmitter {
    static OPEN = 1;
    static CLOSED = 3;
    static CONNECTING = 0;
    readyState = 1;
    send = vi.fn();
    close = vi.fn(function (this: MockWebSocket) {
      this.readyState = 3;
    });
  }

  return { default: MockWebSocket, WebSocket: MockWebSocket };
});

// Must import after mock
const { FigmaBridgeError, FigmaBridge } = await import('../../mcp-server/src/figma-bridge.js');

describe('FigmaBridgeError', () => {
  describe('construction from StructuredError', () => {
    it('preserves message, code, and suggestion', () => {
      const structured = createError(ErrorCode.NODE_NOT_FOUND, 'Node 123 not found');
      const err = new FigmaBridgeError(structured);

      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('FigmaBridgeError');
      expect(err.message).toBe('Node 123 not found');
      expect(err.code).toBe(ErrorCode.NODE_NOT_FOUND);
      expect(err.suggestion).toBeTypeOf('string');
      expect(err.structuredError).toBe(structured);
    });

    it('preserves details from structured error', () => {
      const structured = createError(ErrorCode.OP_TIMEOUT, 'Timed out', { requestId: 'r1' });
      const err = new FigmaBridgeError(structured);
      expect(err.details).toEqual({ requestId: 'r1' });
    });
  });

  describe('construction from legacy (message, code) signature', () => {
    it('creates error with specified code', () => {
      const err = new FigmaBridgeError('Connection failed', 'CONN_FAILED');
      expect(err.message).toBe('Connection failed');
      expect(err.code).toBe(ErrorCode.CONN_FAILED);
    });

    it('defaults to SYS_INTERNAL when code is omitted', () => {
      const err = new FigmaBridgeError('Unknown issue');
      expect(err.code).toBe(ErrorCode.SYS_INTERNAL);
    });

    it('returns undefined suggestion for invalid code', () => {
      const err = new FigmaBridgeError('test', 'NOT_A_REAL_CODE');
      expect(err.suggestion).toBeUndefined();
    });
  });

  describe('error code getters', () => {
    it('code getter returns the ErrorCode enum value', () => {
      for (const code of [
        ErrorCode.CONN_NOT_CONNECTED,
        ErrorCode.CONN_TIMEOUT,
        ErrorCode.NODE_NOT_FOUND,
        ErrorCode.VAL_FAILED,
        ErrorCode.OP_FAILED,
        ErrorCode.SYS_CIRCUIT_OPEN
      ]) {
        const err = new FigmaBridgeError(createError(code, 'test'));
        expect(err.code).toBe(code);
      }
    });

    it('suggestion getter returns matching suggestion for known codes', () => {
      const err = new FigmaBridgeError(createError(ErrorCode.CONN_NOT_CONNECTED, 'Not connected'));
      expect(err.suggestion).toContain('Figma');
    });

    it('details getter returns undefined when no details provided', () => {
      const err = new FigmaBridgeError(createError(ErrorCode.OP_FAILED, 'Failed'));
      expect(err.details).toBeUndefined();
    });
  });

  describe('error identity', () => {
    it('is instance of Error', () => {
      const err = new FigmaBridgeError('test');
      expect(err).toBeInstanceOf(Error);
    });

    it('has name FigmaBridgeError', () => {
      const err = new FigmaBridgeError('test');
      expect(err.name).toBe('FigmaBridgeError');
    });

    it('has a stack trace', () => {
      const err = new FigmaBridgeError('test');
      expect(err.stack).toContain('FigmaBridgeError');
    });
  });
});

describe('FigmaBridge', () => {
  beforeEach(() => {
    loadConfig(); // FigmaBridge constructor needs config
  });

  afterEach(() => {
    resetConfig();
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('isConnected returns false before connect()', () => {
      const bridge = new FigmaBridge();
      expect(bridge.isConnected()).toBe(false);
      bridge.disconnect();
    });

    it('getConnectionStatus reports disconnected state', () => {
      const bridge = new FigmaBridge();
      const status = bridge.getConnectionStatus();
      expect(status.connected).toBe(false);
      expect(status.pendingRequests).toBe(0);
      expect(status.reconnectAttempts).toBe(0);
      bridge.disconnect();
    });
  });

  describe('sendToFigma preconditions', () => {
    it('throws CONN_NOT_CONNECTED when not connected', async () => {
      const bridge = new FigmaBridge();

      try {
        await bridge.sendToFigma('test_command', { data: 'test' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FigmaBridgeError);
        expect((error as InstanceType<typeof FigmaBridgeError>).code).toBe(
          ErrorCode.CONN_NOT_CONNECTED
        );
      }

      bridge.disconnect();
    });
  });

  describe('sendToFigmaWithAbort preconditions', () => {
    it('throws CONN_NOT_CONNECTED when not connected', () => {
      const bridge = new FigmaBridge();

      try {
        bridge.sendToFigmaWithAbort('test_command', { data: 'test' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FigmaBridgeError);
        expect((error as InstanceType<typeof FigmaBridgeError>).code).toBe(
          ErrorCode.CONN_NOT_CONNECTED
        );
      }

      bridge.disconnect();
    });
  });

  describe('disconnect', () => {
    it('is safe to call multiple times', () => {
      const bridge = new FigmaBridge();
      expect(() => {
        bridge.disconnect();
        bridge.disconnect();
        bridge.disconnect();
      }).not.toThrow();
    });

    it('resets connection state', () => {
      const bridge = new FigmaBridge();
      bridge.disconnect();
      expect(bridge.isConnected()).toBe(false);
    });
  });

  describe('getConnectionStatus', () => {
    it('returns all expected fields with correct types', () => {
      const bridge = new FigmaBridge();
      const status = bridge.getConnectionStatus();

      expect(status.connected).toBe(false);
      expect(status.wsReadyState).toBeUndefined();
      expect(status.pendingRequests).toBe(0);
      expect(status.circuitBreakerState).toBe('CLOSED');
      expect(status.reconnectAttempts).toBe(0);

      bridge.disconnect();
    });

    it('circuit breaker starts in CLOSED state', () => {
      const bridge = new FigmaBridge();
      const status = bridge.getConnectionStatus();
      expect(status.circuitBreakerState).toBe('CLOSED');
      bridge.disconnect();
    });

    it('pendingRequests count is 0 when disconnected', () => {
      const bridge = new FigmaBridge();
      expect(bridge.getConnectionStatus().pendingRequests).toBe(0);
      bridge.disconnect();
    });

    it('reconnectAttempts resets after disconnect', () => {
      const bridge = new FigmaBridge();
      bridge.disconnect();
      expect(bridge.getConnectionStatus().reconnectAttempts).toBe(0);
    });
  });
});

describe('FigmaBridgeError edge cases', () => {
  it('legacy constructor with known ErrorCode', () => {
    const err = new FigmaBridgeError('Timeout occurred', 'CONN_TIMEOUT');
    expect(err.code).toBe(ErrorCode.CONN_TIMEOUT);
    expect(err.message).toBe('Timeout occurred');
    expect(err.suggestion).toBeTypeOf('string');
  });

  it('legacy constructor with SYS_INTERNAL fallback', () => {
    const err = new FigmaBridgeError('Generic problem');
    expect(err.code).toBe(ErrorCode.SYS_INTERNAL);
  });

  it('structured constructor preserves all fields', () => {
    const structured = createError(ErrorCode.OP_FAILED, 'Operation failed', {
      tool: 'create_frame',
      duration: 500
    });
    const err = new FigmaBridgeError(structured);
    expect(err.code).toBe(ErrorCode.OP_FAILED);
    expect(err.details).toEqual({ tool: 'create_frame', duration: 500 });
    expect(err.structuredError).toBe(structured);
  });

  it('error is catchable as Error', () => {
    const err = new FigmaBridgeError('test');
    try {
      throw err;
    } catch (caught) {
      expect(caught).toBeInstanceOf(Error);
      expect(caught).toBeInstanceOf(FigmaBridgeError);
    }
  });

  it('stack trace contains FigmaBridgeError name', () => {
    const err = new FigmaBridgeError('stack test');
    expect(err.stack).toContain('FigmaBridgeError');
  });
});
