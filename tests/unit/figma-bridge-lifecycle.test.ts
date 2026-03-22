/**
 * Figma Bridge Lifecycle Tests — Disconnect, Reconnection, Retry, Validation
 *
 * Tests disconnect behavior, reconnection with exponential backoff,
 * retry logic with circuit breaker, sendToFigmaValidated, and
 * edge cases in message handling.
 *
 * Related test files:
 * - figma-bridge.test.ts: connection, request/response, abort
 * - figma-bridge-circuit-breaker.test.ts: circuit breaker state machine
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode, createError } from '../../mcp-server/src/errors/error-codes.js';
import { loadConfig, resetConfig } from '../../mcp-server/src/config.js';
import { MockWebSocket, mockWsInstances, resetMockWsInstances } from '../helpers/mock-websocket.js';

vi.mock('ws', () => ({
  default: MockWebSocket,
  WebSocket: MockWebSocket
}));

// Must import after mock
const { FigmaBridgeError, FigmaBridge } = await import('../../mcp-server/src/figma-bridge.js');

describe('FigmaBridge — Lifecycle & Retry', () => {
  let bridge: InstanceType<typeof FigmaBridge>;

  beforeEach(() => {
    vi.useFakeTimers();
    resetMockWsInstances();
    loadConfig();
    bridge = new FigmaBridge();
  });

  afterEach(() => {
    bridge.disconnect();
    vi.useRealTimers();
    resetConfig();
    vi.restoreAllMocks();
  });

  async function connectBridge(): Promise<MockWebSocket> {
    const connectPromise = bridge.connect();
    const ws = mockWsInstances[mockWsInstances.length - 1]!;
    ws.simulateOpen();
    await connectPromise;
    return ws;
  }

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

    it('rejects EVERY pending request on disconnect, not just the first', async () => {
      const ws = await connectBridge();

      // Create 5 concurrent pending requests
      const promises = Array.from({ length: 5 }, (_, i) =>
        bridge.sendToFigma(`op_${i}`, { index: i })
      );

      expect(bridge.getConnectionStatus().pendingRequests).toBe(5);

      // Simulate unexpected disconnect
      ws.readyState = 3;
      ws.emit('close');

      // Every single promise must reject with CONN_LOST
      const results = await Promise.allSettled(promises);
      for (const result of results) {
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected') {
          const reason = result.reason as Error;
          expect(reason.message).toContain('Connection lost');
        }
      }

      // All pending requests should be cleaned up
      expect(bridge.getConnectionStatus().pendingRequests).toBe(0);
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

    it('stops reconnecting after maxReconnectAttempts', async () => {
      const ws = await connectBridge();

      // Simulate disconnect
      ws.readyState = 3;
      ws.emit('close');

      // Default maxReconnectAttempts is 5, each reconnect creates a new WS instance
      // Advance past the maximum possible backoff for all attempts
      for (let i = 0; i < 6; i++) {
        vi.advanceTimersByTime(31000); // Past max delay of 30s
      }

      // After max attempts, no more reconnection attempts should be scheduled
      const instanceCount = mockWsInstances.length;
      vi.advanceTimersByTime(60000);
      // No new instances created — reconnection gave up
      expect(mockWsInstances.length).toBe(instanceCount);
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

  describe('sendToFigmaValidated', () => {
    it('returns validated data when response matches schema', async () => {
      const ws = await connectBridge();
      const { z } = await import('zod');
      const schema = z.object({ nodeId: z.string(), name: z.string() });

      const promise = bridge.sendToFigmaValidated('create_frame', { name: 'Test' }, schema);

      // First retry call goes through sendToFigma, which sends the WS message
      const sentData = JSON.parse(ws.send.mock.calls[0][0] as string) as Record<string, unknown>;
      ws.simulateMessage(
        JSON.stringify({
          id: sentData.id,
          success: true,
          data: { nodeId: '1:42', name: 'Test' }
        })
      );

      const result = await promise;
      expect(result).toEqual({ nodeId: '1:42', name: 'Test' });
    });

    it('throws ZodError when response does not match schema', async () => {
      const ws = await connectBridge();
      const { z } = await import('zod');
      const schema = z.object({ nodeId: z.string() });

      const promise = bridge.sendToFigmaValidated('create_frame', { name: 'Test' }, schema);

      const sentData = JSON.parse(ws.send.mock.calls[0][0] as string) as Record<string, unknown>;
      ws.simulateMessage(
        JSON.stringify({
          id: sentData.id,
          success: true,
          data: { wrongField: 42 } // does not match { nodeId: string }
        })
      );

      await expect(promise).rejects.toThrow();
      try {
        await promise;
      } catch (error) {
        expect((error as Error).name).toBe('ZodError');
      }
    });
  });

  describe('handleMessage edge cases', () => {
    it('handles Array of Buffers (Buffer[]) as message data', async () => {
      const ws = await connectBridge();
      const promise = bridge.sendToFigma('test', {});
      const sentData = JSON.parse(ws.send.mock.calls[0][0] as string) as Record<string, unknown>;

      // Simulate Buffer array data (WebSocket can send fragmented frames)
      const part1 = Buffer.from(`{"id":"${sentData.id as string}","succe`);
      const part2 = Buffer.from('ss":true,"data":"array-buf"}');
      ws.emit('message', [part1, part2]);

      await expect(promise).resolves.toBe('array-buf');
    });

    it('aborted request is removed from pending map, late response is ignored', async () => {
      const ws = await connectBridge();
      const { abort } = bridge.sendToFigmaWithAbort('test', {});
      const sentData = JSON.parse(ws.send.mock.calls[0][0] as string) as Record<string, unknown>;

      expect(bridge.getConnectionStatus().pendingRequests).toBe(1);
      abort.abort();
      expect(abort.aborted).toBe(true);
      expect(bridge.getConnectionStatus().pendingRequests).toBe(0);

      // Simulate late response — should not crash or affect state
      ws.simulateMessage(JSON.stringify({ id: sentData.id, success: true, data: 'late' }));

      // No pending requests means the response was silently dropped
      expect(bridge.getConnectionStatus().pendingRequests).toBe(0);
    });

    it('rejects pending request on timeout even if aborted flag was not set', async () => {
      await connectBridge();
      const promise = bridge.sendToFigma('slow_op', {});

      // Advance past request timeout
      vi.advanceTimersByTime(31000);

      const error = await promise.catch((e: Error) => e);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('Request timeout');
    });

    it('timeout cleans up pending request from the map', async () => {
      await connectBridge();
      bridge.sendToFigma('slow_op', {}).catch(() => {});

      expect(bridge.getConnectionStatus().pendingRequests).toBe(1);

      vi.advanceTimersByTime(31000);

      // After timeout fires, the pending request should be removed
      expect(bridge.getConnectionStatus().pendingRequests).toBe(0);
    });

    it('response after timeout is silently ignored (no double resolution)', async () => {
      const ws = await connectBridge();
      const promise = bridge.sendToFigma('slow_op', {});
      const sentData = JSON.parse(ws.send.mock.calls[0][0] as string) as Record<string, unknown>;

      // Trigger timeout
      vi.advanceTimersByTime(31000);
      await expect(promise).rejects.toThrow('Request timeout');

      // Late response arrives — should not crash
      ws.simulateMessage(JSON.stringify({ id: sentData.id, success: true, data: 'too late' }));
      expect(bridge.getConnectionStatus().pendingRequests).toBe(0);
    });

    it('connection info/type messages do not resolve pending requests even if id field is present', async () => {
      const ws = await connectBridge();
      const promise = bridge.sendToFigma('test', {});
      const sentData = JSON.parse(ws.send.mock.calls[0][0] as string) as Record<string, unknown>;

      // Send a connection message that happens to have a matching id field
      // The production code checks message.type === 'connection' || 'info' first
      ws.simulateMessage(
        JSON.stringify({ type: 'connection', message: 'reconnected', id: sentData.id })
      );

      // The request should still be pending (not resolved by the connection message)
      expect(bridge.getConnectionStatus().pendingRequests).toBe(1);

      // Now send the real response
      ws.simulateMessage(JSON.stringify({ id: sentData.id, success: true, data: 'real' }));
      await expect(promise).resolves.toBe('real');
    });

    it('ignores unsupported data types (not string, Buffer, or Buffer[]) without crashing', async () => {
      const ws = await connectBridge();

      // Emit a message with an unsupported data type (e.g., a number).
      // The handleMessage code has a branch for this: logs and returns early.
      ws.emit('message', 42);

      // Bridge should remain connected and functional
      expect(bridge.isConnected()).toBe(true);

      // Verify normal messages still work after receiving unsupported data
      const promise = bridge.sendToFigma('test', {});
      const sentData = JSON.parse(ws.send.mock.calls[0][0] as string) as Record<string, unknown>;
      ws.simulateMessage(JSON.stringify({ id: sentData.id, success: true, data: 'ok' }));
      await expect(promise).resolves.toBe('ok');
    });
  });
});

// Circuit breaker tests are in figma-bridge-circuit-breaker.test.ts

describe('FigmaBridge — Health Check', () => {
  let bridge: InstanceType<typeof FigmaBridge>;

  beforeEach(() => {
    vi.useFakeTimers();
    resetMockWsInstances();
    loadConfig();
    bridge = new FigmaBridge();
  });

  afterEach(() => {
    bridge.disconnect();
    vi.useRealTimers();
    resetConfig();
    vi.restoreAllMocks();
  });

  async function connectBridge(): Promise<MockWebSocket> {
    const connectPromise = bridge.connect();
    const ws = mockWsInstances[mockWsInstances.length - 1]!;
    ws.simulateOpen();
    await connectPromise;
    return ws;
  }

  it('health check starts after successful connection and attempts reconnect when disconnected', async () => {
    const ws = await connectBridge();
    expect(bridge.isConnected()).toBe(true);

    // Simulate unexpected disconnect (sets connected=false without cleanup)
    ws.readyState = 3;
    ws.emit('close');

    expect(bridge.isConnected()).toBe(false);

    // Health check interval is 10000ms — advance past it
    vi.advanceTimersByTime(10001);

    // A new WebSocket instance should have been created for reconnection attempt
    expect(mockWsInstances.length).toBeGreaterThan(1);
  });

  it('health check resets reconnect counter after maxReconnectAttempts exhausted', async () => {
    const ws = await connectBridge();
    expect(bridge.getConnectionStatus().reconnectAttempts).toBe(0);

    // Simulate unexpected disconnect
    ws.readyState = 3;
    ws.emit('close');

    // After disconnect, reconnectAttempts increments and reconnection is scheduled.
    // We advance timers to trigger reconnection attempts. Each failed attempt
    // (no simulateOpen) creates a new MockWebSocket but the error/close handler
    // will increment reconnectAttempts further.
    // The health check fires at 10s and resets the counter if maxReconnectAttempts reached.

    // Advance past several reconnect + health check cycles to verify the health check
    // eventually triggers a new connection attempt after the counter resets.
    const instancesBefore = mockWsInstances.length;

    // Advance enough time for health check to fire multiple times
    await vi.advanceTimersByTimeAsync(120000);

    // The health check should have created at least one new WS instance
    // after resetting the reconnect counter
    expect(mockWsInstances.length).toBeGreaterThan(instancesBefore);
  });

  it('disconnect stops the health check (no reconnection attempts after disconnect)', async () => {
    await connectBridge();

    // Explicitly disconnect — this should stop health check
    bridge.disconnect();

    const instancesAfterDisconnect = mockWsInstances.length;

    // Advance well past health check interval
    vi.advanceTimersByTime(30000);

    // No new instances should be created — health check was stopped
    expect(mockWsInstances.length).toBe(instancesAfterDisconnect);
  });

  it('health check is a no-op when already connected', async () => {
    await connectBridge();

    const instancesBefore = mockWsInstances.length;

    // Advance past several health check intervals
    vi.advanceTimersByTime(30001);

    // No new WebSocket instances — already connected
    expect(mockWsInstances.length).toBe(instancesBefore);
    expect(bridge.isConnected()).toBe(true);
  });
});

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
