/**
 * Figma Bridge Unit Tests
 *
 * Tests the full FigmaBridge lifecycle: connection, message handling,
 * circuit breaker state machine, retry with backoff, abort, disconnect,
 * and reconnection. Uses a mock WebSocket that emits events to simulate
 * the real WebSocket connection without a server.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import { ErrorCode, createError } from '../../mcp-server/src/errors/error-codes.js';
import { loadConfig, resetConfig } from '../../mcp-server/src/config.js';

// Track all created MockWebSocket instances so tests can interact with them
let mockWsInstances: MockWebSocket[] = [];

class MockWebSocket extends EventEmitter {
  static OPEN = 1;
  static CLOSED = 3;
  static CONNECTING = 0;
  readyState = 0; // Start as CONNECTING
  send = vi.fn();
  // close() sets readyState but does NOT emit 'close' —
  // the real WebSocket fires 'close' asynchronously. Tests that need
  // to simulate unexpected disconnect call emit('close') directly.
  close = vi.fn(function (this: MockWebSocket) {
    this.readyState = 3;
  });

  constructor(_url: string) {
    super();
    mockWsInstances.push(this);
  }

  /** Test helper: simulate successful connection */
  simulateOpen(): void {
    this.readyState = 1; // OPEN
    this.emit('open');
  }

  /** Test helper: simulate incoming message */
  simulateMessage(data: string | Buffer): void {
    this.emit('message', data);
  }

  /** Test helper: simulate connection error */
  simulateError(message: string): void {
    this.emit('error', new Error(message));
  }
}

vi.mock('ws', () => ({
  default: MockWebSocket,
  WebSocket: MockWebSocket
}));

// Must import after mock
const { FigmaBridgeError, FigmaBridge } = await import('../../mcp-server/src/figma-bridge.js');

// FigmaBridgeError construction tests are in error-classes.test.ts

describe('FigmaBridge', () => {
  let bridge: InstanceType<typeof FigmaBridge>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockWsInstances = [];
    loadConfig();
    bridge = new FigmaBridge();
  });

  afterEach(() => {
    bridge.disconnect();
    vi.useRealTimers();
    resetConfig();
    vi.restoreAllMocks();
  });

  /**
   * Helper: connect the bridge and simulate open
   */
  async function connectBridge(): Promise<MockWebSocket> {
    const connectPromise = bridge.connect();
    const ws = mockWsInstances[mockWsInstances.length - 1]!;
    ws.simulateOpen();
    await connectPromise;
    return ws;
  }

  describe('connect', () => {
    it('resolves when WebSocket emits open', async () => {
      const connectPromise = bridge.connect();
      const ws = mockWsInstances[0]!;
      ws.simulateOpen();
      await expect(connectPromise).resolves.toBeUndefined();
      expect(bridge.isConnected()).toBe(true);
    });

    it('rejects with CONN_FAILED when WebSocket emits error before open', async () => {
      const connectPromise = bridge.connect();
      const ws = mockWsInstances[0]!;
      ws.simulateError('ECONNREFUSED');
      await expect(connectPromise).rejects.toThrow('Failed to connect');
    });

    it('rejects with CONN_TIMEOUT when connection takes too long', async () => {
      const connectPromise = bridge.connect();
      // Advance past the 5000ms connection timeout
      vi.advanceTimersByTime(5001);
      await expect(connectPromise).rejects.toThrow('Connection timeout');
    });

    it('returns existing promise when called concurrently', async () => {
      const p1 = bridge.connect();
      const p2 = bridge.connect();
      // Only one WebSocket instance should have been created
      expect(mockWsInstances).toHaveLength(1);
      const ws = mockWsInstances[0]!;
      ws.simulateOpen();
      await Promise.all([p1, p2]);
      expect(bridge.isConnected()).toBe(true);
    });

    it('is a no-op when already connected', async () => {
      await connectBridge();
      // Second connect should return immediately without creating a new WS
      const instanceCountBefore = mockWsInstances.length;
      await bridge.connect();
      expect(mockWsInstances.length).toBe(instanceCountBefore);
    });

    it('resets circuit breaker on successful connection', async () => {
      await connectBridge();
      const status = bridge.getConnectionStatus();
      expect(status.circuitBreakerState).toBe('CLOSED');
    });
  });

  describe('sendToFigma', () => {
    it('throws CONN_NOT_CONNECTED when not connected', async () => {
      await expect(bridge.sendToFigma('test', {})).rejects.toThrow();
      try {
        await bridge.sendToFigma('test', {});
      } catch (error) {
        expect((error as InstanceType<typeof FigmaBridgeError>).code).toBe(
          ErrorCode.CONN_NOT_CONNECTED
        );
      }
    });

    it('sends JSON-serialized request with unique ID', async () => {
      const ws = await connectBridge();
      const promise = bridge.sendToFigma('create_frame', { name: 'test' });

      // Verify send was called with proper JSON
      expect(ws.send).toHaveBeenCalledOnce();
      const sentData = JSON.parse(ws.send.mock.calls[0][0] as string) as Record<string, unknown>;
      expect(sentData.type).toBe('create_frame');
      expect(sentData.payload).toEqual({ name: 'test' });
      expect(sentData.id).toMatch(/^req_/);

      // Resolve the pending request
      ws.simulateMessage(
        JSON.stringify({ id: sentData.id, success: true, data: { nodeId: '1:2' } })
      );
      const result = await promise;
      expect(result).toEqual({ nodeId: '1:2' });
    });

    it('rejects when response has success: false', async () => {
      const ws = await connectBridge();
      const promise = bridge.sendToFigma('bad_op', {});

      const sentData = JSON.parse(ws.send.mock.calls[0][0] as string) as Record<string, unknown>;
      ws.simulateMessage(
        JSON.stringify({ id: sentData.id, success: false, error: 'Node not found' })
      );

      await expect(promise).rejects.toThrow('Node not found');
    });

    it('rejects with OP_TIMEOUT when response never arrives', async () => {
      await connectBridge();
      const promise = bridge.sendToFigma('slow_op', {});

      // Advance past the request timeout (default 30000ms)
      vi.advanceTimersByTime(31000);

      await expect(promise).rejects.toThrow('Request timeout');
    });

    it('rejects when ws.send throws', async () => {
      const ws = await connectBridge();
      ws.send.mockImplementation(() => {
        throw new Error('WebSocket is closed');
      });

      await expect(bridge.sendToFigma('test', {})).rejects.toThrow('WebSocket is closed');
    });
  });

  describe('handleMessage', () => {
    it('handles string data', async () => {
      const ws = await connectBridge();
      const promise = bridge.sendToFigma('test', {});
      const sentData = JSON.parse(ws.send.mock.calls[0][0] as string) as Record<string, unknown>;

      ws.simulateMessage(JSON.stringify({ id: sentData.id, success: true, data: 'ok' }));
      await expect(promise).resolves.toBe('ok');
    });

    it('handles Buffer data', async () => {
      const ws = await connectBridge();
      const promise = bridge.sendToFigma('test', {});
      const sentData = JSON.parse(ws.send.mock.calls[0][0] as string) as Record<string, unknown>;

      const bufferData = Buffer.from(
        JSON.stringify({ id: sentData.id, success: true, data: 'from-buffer' })
      );
      ws.simulateMessage(bufferData);
      await expect(promise).resolves.toBe('from-buffer');
    });

    it('ignores connection/info messages without affecting pending requests', async () => {
      const ws = await connectBridge();
      const promise = bridge.sendToFigma('test', {});
      const sentData = JSON.parse(ws.send.mock.calls[0][0] as string) as Record<string, unknown>;

      // These should be silently consumed
      ws.simulateMessage(JSON.stringify({ type: 'connection', message: 'Welcome' }));
      ws.simulateMessage(JSON.stringify({ type: 'info', message: 'Plugin ready' }));

      // The pending request should still be pending
      expect(bridge.getConnectionStatus().pendingRequests).toBe(1);

      // Now resolve it
      ws.simulateMessage(JSON.stringify({ id: sentData.id, success: true, data: 'done' }));
      await expect(promise).resolves.toBe('done');
    });

    it('ignores invalid JSON without crashing', async () => {
      const ws = await connectBridge();
      // Should not throw
      ws.simulateMessage('not valid json {{{');
      expect(bridge.isConnected()).toBe(true);
    });

    it('ignores messages with invalid schema (ZodError) without crashing', async () => {
      const ws = await connectBridge();
      // Missing required 'id' and 'success' fields
      ws.simulateMessage(JSON.stringify({ foo: 'bar' }));
      expect(bridge.isConnected()).toBe(true);
    });

    it('ignores responses for unknown request IDs', async () => {
      const ws = await connectBridge();
      ws.simulateMessage(JSON.stringify({ id: 'req_unknown', success: true, data: 'orphan' }));
      expect(bridge.isConnected()).toBe(true);
    });
  });

  describe('sendToFigmaWithAbort', () => {
    it('throws CONN_NOT_CONNECTED when not connected', () => {
      expect(() => bridge.sendToFigmaWithAbort('test', {})).toThrow();
    });

    it('returns a promise that resolves normally when not aborted', async () => {
      const ws = await connectBridge();
      const { promise } = bridge.sendToFigmaWithAbort('test', {});

      const sentData = JSON.parse(ws.send.mock.calls[0][0] as string) as Record<string, unknown>;
      ws.simulateMessage(JSON.stringify({ id: sentData.id, success: true, data: 'ok' }));
      await expect(promise).resolves.toBe('ok');
    });

    it('abort prevents resolution of the promise', async () => {
      const ws = await connectBridge();
      const { promise, abort } = bridge.sendToFigmaWithAbort('test', {});

      const sentData = JSON.parse(ws.send.mock.calls[0][0] as string) as Record<string, unknown>;

      // Abort before response arrives
      abort.abort();

      // Even if server responds, the promise should never resolve
      ws.simulateMessage(JSON.stringify({ id: sentData.id, success: true, data: 'late' }));

      // The pending request was removed, so pending count should be 0
      expect(bridge.getConnectionStatus().pendingRequests).toBe(0);

      // Promise will neither resolve nor reject after abort — it stays pending
      // We can't easily test "stays pending" but we can verify the request was cleaned up
      // and the abort controller reflects aborted state
    });

    it('abort removes the pending request from tracking', async () => {
      const ws = await connectBridge();
      const { abort } = bridge.sendToFigmaWithAbort('test', {});

      expect(bridge.getConnectionStatus().pendingRequests).toBe(1);
      abort.abort();
      expect(bridge.getConnectionStatus().pendingRequests).toBe(0);
    });

    it('double abort is safe (no-op)', async () => {
      await connectBridge();
      const { abort } = bridge.sendToFigmaWithAbort('test', {});
      abort.abort();
      expect(() => abort.abort()).not.toThrow();
    });
  });

  describe('disconnect', () => {
    it('is safe to call multiple times', () => {
      expect(() => {
        bridge.disconnect();
        bridge.disconnect();
        bridge.disconnect();
      }).not.toThrow();
    });

    it('rejects all pending requests with CONN_LOST', async () => {
      const ws = await connectBridge();

      const p1 = bridge.sendToFigma('op1', {});
      const p2 = bridge.sendToFigma('op2', {});

      expect(bridge.getConnectionStatus().pendingRequests).toBe(2);

      bridge.disconnect();

      await expect(p1).rejects.toThrow('Bridge disconnected');
      await expect(p2).rejects.toThrow('Bridge disconnected');
    });

    it('closes the WebSocket and resets connection state', async () => {
      const ws = await connectBridge();
      expect(bridge.isConnected()).toBe(true);

      bridge.disconnect();
      expect(bridge.isConnected()).toBe(false);
      expect(ws.close).toHaveBeenCalled();
    });

    it('resets reconnect attempts', async () => {
      await connectBridge();
      bridge.disconnect();
      expect(bridge.getConnectionStatus().reconnectAttempts).toBe(0);
    });
  });

  describe('handleDisconnect (reconnection)', () => {
    it('rejects all pending requests on unexpected disconnect', async () => {
      const ws = await connectBridge();
      const promise = bridge.sendToFigma('test', {});

      // Simulate unexpected close (not via disconnect())
      ws.readyState = 3;
      ws.emit('close');

      await expect(promise).rejects.toThrow('Connection lost');
    });

    it('attempts reconnection with exponential backoff', async () => {
      const ws = await connectBridge();

      // Simulate unexpected disconnect
      ws.readyState = 3;
      ws.emit('close');

      // After first disconnect, reconnect should be scheduled with 2s delay (1000 * 2^1)
      expect(mockWsInstances).toHaveLength(1); // No reconnect yet

      vi.advanceTimersByTime(2001);

      // A new WebSocket instance should have been created for reconnection
      expect(mockWsInstances.length).toBeGreaterThan(1);
    });
  });

  describe('sendToFigmaWithRetry', () => {
    it('returns on first success without retry', async () => {
      const ws = await connectBridge();
      const promise = bridge.sendToFigmaWithRetry('test', {}, { maxRetries: 3, baseDelay: 10 });

      const sentData = JSON.parse(ws.send.mock.calls[0][0] as string) as Record<string, unknown>;
      ws.simulateMessage(JSON.stringify({ id: sentData.id, success: true, data: 'first-try' }));

      await expect(promise).resolves.toBe('first-try');
      // Only 1 send call = no retries
      expect(ws.send).toHaveBeenCalledOnce();
    });

    it('does not retry FigmaBridgeError with VAL_ code prefix', async () => {
      const ws = await connectBridge();

      // Override send to throw a VAL_ error directly (simulating validation layer)
      let callCount = 0;
      ws.send.mockImplementation(() => {
        callCount++;
        const structured = createError(ErrorCode.VAL_FAILED, 'Validation failed');
        throw new FigmaBridgeError(structured);
      });

      await expect(
        bridge.sendToFigmaWithRetry('test', {}, { maxRetries: 3, baseDelay: 10 })
      ).rejects.toThrow('Validation failed');

      // Should have only tried once (no retry for VAL_ errors)
      expect(callCount).toBe(1);
    });

    it('does not retry ZodError (validation)', async () => {
      const ws = await connectBridge();

      // Make sendToFigma throw a ZodError-named error
      ws.send.mockImplementation(() => {
        const err = new Error('Validation failed');
        err.name = 'ZodError';
        throw err;
      });

      await expect(
        bridge.sendToFigmaWithRetry('test', {}, { maxRetries: 3, baseDelay: 10 })
      ).rejects.toThrow('Validation failed');

      // Should have only tried once (no retry for validation errors)
      expect(ws.send).toHaveBeenCalledOnce();
    });

    it('exhausts all retries and throws last error', async () => {
      const ws = await connectBridge();

      const promise = bridge.sendToFigmaWithRetry(
        'test',
        {},
        {
          maxRetries: 2,
          baseDelay: 10,
          maxDelay: 100
        }
      );

      // First attempt
      let sentData = JSON.parse(ws.send.mock.calls[0][0] as string) as Record<string, unknown>;
      ws.simulateMessage(JSON.stringify({ id: sentData.id, success: false, error: 'Figma busy' }));

      // Wait for retry delay
      await vi.advanceTimersByTimeAsync(200);

      // Second attempt (last)
      sentData = JSON.parse(ws.send.mock.calls[1][0] as string) as Record<string, unknown>;
      ws.simulateMessage(JSON.stringify({ id: sentData.id, success: false, error: 'Still busy' }));

      await expect(promise).rejects.toThrow('Still busy');
    });
  });
});

// Circuit breaker tests are in figma-bridge-circuit-breaker.test.ts

describe('resetFigmaBridge', () => {
  // Import singleton functions after mock
  let getFigmaBridge: typeof import('../../mcp-server/src/figma-bridge.js').getFigmaBridge;
  let resetFigmaBridge: typeof import('../../mcp-server/src/figma-bridge.js').resetFigmaBridge;

  beforeEach(async () => {
    loadConfig();
    const mod = await import('../../mcp-server/src/figma-bridge.js');
    getFigmaBridge = mod.getFigmaBridge;
    resetFigmaBridge = mod.resetFigmaBridge;
  });

  afterEach(() => {
    resetConfig();
    vi.restoreAllMocks();
  });

  it('creates a fresh instance after reset', () => {
    const first = getFigmaBridge();
    const sameInstance = getFigmaBridge();
    expect(first).toBe(sameInstance);

    resetFigmaBridge();

    const fresh = getFigmaBridge();
    expect(fresh).not.toBe(first);
  });
});
