/**
 * Figma Bridge Unit Tests — Connection & Request Handling
 *
 * Tests connection lifecycle, message handling, request/response routing,
 * and abort support. Uses a mock WebSocket that emits events to simulate
 * the real connection without a server.
 *
 * Related test files:
 * - figma-bridge-lifecycle.test.ts: disconnect, reconnection, retry, validation
 * - figma-bridge-circuit-breaker.test.ts: circuit breaker state machine
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '../../mcp-server/src/errors/error-codes.js';
import { loadConfig, resetConfig } from '../../mcp-server/src/config.js';
import { MockWebSocket, mockWsInstances, resetMockWsInstances } from '../helpers/mock-websocket.js';

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

    it('resolves each concurrent request to its own response by ID', async () => {
      const ws = await connectBridge();

      // Fire three concurrent requests
      const p1 = bridge.sendToFigma('op_a', { key: 'a' });
      const p2 = bridge.sendToFigma('op_b', { key: 'b' });
      const p3 = bridge.sendToFigma('op_c', { key: 'c' });

      // Extract request IDs from sent messages
      const ids = ws.send.mock.calls.map(
        (call: unknown[]) => (JSON.parse(call[0] as string) as { id: string }).id
      );
      expect(ids).toHaveLength(3);
      // All IDs should be unique
      expect(new Set(ids).size).toBe(3);

      // Respond OUT OF ORDER: respond to p3 first, then p1, then p2
      ws.simulateMessage(JSON.stringify({ id: ids[2], success: true, data: 'result_c' }));
      ws.simulateMessage(JSON.stringify({ id: ids[0], success: true, data: 'result_a' }));
      ws.simulateMessage(JSON.stringify({ id: ids[1], success: true, data: 'result_b' }));

      // Each promise should resolve to its own result despite out-of-order responses
      await expect(p1).resolves.toBe('result_a');
      await expect(p2).resolves.toBe('result_b');
      await expect(p3).resolves.toBe('result_c');
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

    it('abort sets aborted flag on the controller', async () => {
      await connectBridge();
      const { abort } = bridge.sendToFigmaWithAbort('test', {});
      expect(abort.aborted).toBe(false);
      abort.abort();
      expect(abort.aborted).toBe(true);
    });

    it('abort controller aborted flag is synced on promise rejection (e.g., timeout)', async () => {
      await connectBridge();
      const { promise, abort } = bridge.sendToFigmaWithAbort('slow', {});

      expect(abort.aborted).toBe(false);

      // Let the request timeout
      vi.advanceTimersByTime(31000);
      await promise.catch(() => {});

      // After timeout rejection, the abort controller should be marked as aborted
      expect(abort.aborted).toBe(true);
    });
  });

  describe('dispatchRequest edge cases', () => {
    it('sendToFigma throws synchronously if ws is not connected', async () => {
      // Bridge was never connected
      await expect(bridge.sendToFigma('test', {})).rejects.toThrow();
    });

    it('sendToFigma throws if ws.readyState is not OPEN despite connected flag', async () => {
      const ws = await connectBridge();

      // Manually set readyState to CLOSED (simulates race condition)
      ws.readyState = 3;

      // The isConnected() check uses both this.connected AND ws.readyState
      expect(bridge.isConnected()).toBe(false);
      await expect(bridge.sendToFigma('test', {})).rejects.toThrow();
    });

    it('multiple requests share the same ws connection (no new WS created)', async () => {
      const ws = await connectBridge();
      const instancesBefore = mockWsInstances.length;

      // Fire 5 concurrent requests
      const promises = Array.from({ length: 5 }, (_, i) =>
        bridge.sendToFigma(`op_${i}`, { index: i })
      );

      // All 5 should use the same WS (no new instances)
      expect(mockWsInstances.length).toBe(instancesBefore);

      // Clean up: resolve all
      for (let i = 0; i < 5; i++) {
        const sentData = JSON.parse(ws.send.mock.calls[i][0] as string) as Record<string, unknown>;
        ws.simulateMessage(JSON.stringify({ id: sentData.id, success: true, data: i }));
      }
      await Promise.all(promises);
    });

    it('getConnectionStatus reflects accurate pending request count during rapid fire', async () => {
      const ws = await connectBridge();

      // Fire requests rapidly
      const p1 = bridge.sendToFigma('a', {});
      const p2 = bridge.sendToFigma('b', {});
      const p3 = bridge.sendToFigma('c', {});

      expect(bridge.getConnectionStatus().pendingRequests).toBe(3);

      // Resolve first
      const id1 = (JSON.parse(ws.send.mock.calls[0][0] as string) as { id: string }).id;
      ws.simulateMessage(JSON.stringify({ id: id1, success: true, data: 'a' }));
      await p1;

      expect(bridge.getConnectionStatus().pendingRequests).toBe(2);

      // Resolve remaining
      const id2 = (JSON.parse(ws.send.mock.calls[1][0] as string) as { id: string }).id;
      const id3 = (JSON.parse(ws.send.mock.calls[2][0] as string) as { id: string }).id;
      ws.simulateMessage(JSON.stringify({ id: id2, success: true, data: 'b' }));
      ws.simulateMessage(JSON.stringify({ id: id3, success: true, data: 'c' }));
      await Promise.all([p2, p3]);

      expect(bridge.getConnectionStatus().pendingRequests).toBe(0);
    });
  });
});
