/**
 * FigmaBridge Concurrency & Race Condition Tests
 *
 * Tests timing-dependent scenarios that can cause subtle bugs:
 * - Multiple requests in flight with interleaved responses
 * - Abort during response processing
 * - Disconnect while requests are pending
 * - Timeout racing with response arrival
 * - Connect/disconnect rapid cycling
 *
 * These tests target bugs that only manifest under concurrent load
 * or specific timing conditions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, resetConfig } from '../../mcp-server/src/config.js';
import { MockWebSocket, mockWsInstances, resetMockWsInstances } from '../helpers/mock-websocket.js';

vi.mock('ws', () => ({
  default: MockWebSocket,
  WebSocket: MockWebSocket
}));

const { FigmaBridge } = await import('../../mcp-server/src/figma-bridge.js');

describe('FigmaBridge — Concurrency & Race Conditions', () => {
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

  function getSentRequestId(ws: MockWebSocket, callIndex: number): string {
    const sentData = JSON.parse(ws.send.mock.calls[callIndex][0] as string) as { id: string };
    return sentData.id;
  }

  describe('interleaved responses to concurrent requests', () => {
    it('resolves each promise to the correct response despite reverse-order delivery', async () => {
      const ws = await connectBridge();

      const p1 = bridge.sendToFigma('op_first', { seq: 1 });
      const p2 = bridge.sendToFigma('op_second', { seq: 2 });
      const p3 = bridge.sendToFigma('op_third', { seq: 3 });

      const id1 = getSentRequestId(ws, 0);
      const id2 = getSentRequestId(ws, 1);
      const id3 = getSentRequestId(ws, 2);

      // Respond in reverse order
      ws.simulateMessage(JSON.stringify({ id: id3, success: true, data: 'third' }));
      ws.simulateMessage(JSON.stringify({ id: id1, success: true, data: 'first' }));
      ws.simulateMessage(JSON.stringify({ id: id2, success: true, data: 'second' }));

      await expect(p1).resolves.toBe('first');
      await expect(p2).resolves.toBe('second');
      await expect(p3).resolves.toBe('third');
    });

    it('one failure does not affect other pending requests', async () => {
      const ws = await connectBridge();

      const p1 = bridge.sendToFigma('will_succeed', {});
      const p2 = bridge.sendToFigma('will_fail', {});
      const p3 = bridge.sendToFigma('will_also_succeed', {});

      const id1 = getSentRequestId(ws, 0);
      const id2 = getSentRequestId(ws, 1);
      const id3 = getSentRequestId(ws, 2);

      // Fail the middle one
      ws.simulateMessage(JSON.stringify({ id: id2, success: false, error: 'Not found' }));
      ws.simulateMessage(JSON.stringify({ id: id1, success: true, data: 'ok1' }));
      ws.simulateMessage(JSON.stringify({ id: id3, success: true, data: 'ok3' }));

      await expect(p1).resolves.toBe('ok1');
      await expect(p2).rejects.toThrow('Not found');
      await expect(p3).resolves.toBe('ok3');
    });
  });

  describe('abort racing with response', () => {
    it('abort before response means promise never resolves or rejects with data', async () => {
      const ws = await connectBridge();
      const { promise, abort } = bridge.sendToFigmaWithAbort('race_test', {});

      const id = getSentRequestId(ws, 0);

      // Abort first
      abort.abort();
      expect(abort.aborted).toBe(true);

      // Response arrives after abort — should be ignored
      ws.simulateMessage(JSON.stringify({ id, success: true, data: 'late_data' }));

      // The pending request was already removed, so the response is silently dropped
      expect(bridge.getConnectionStatus().pendingRequests).toBe(0);
    });

    it('abort after response arrived is a no-op', async () => {
      const ws = await connectBridge();
      const { promise, abort } = bridge.sendToFigmaWithAbort('race_test', {});

      const id = getSentRequestId(ws, 0);

      // Response arrives first
      ws.simulateMessage(JSON.stringify({ id, success: true, data: 'on_time' }));
      await expect(promise).resolves.toBe('on_time');

      // Late abort should be a no-op (request already resolved)
      expect(() => abort.abort()).not.toThrow();
    });
  });

  describe('disconnect racing with pending requests', () => {
    it('disconnect rejects all pending requests with CONN_LOST', async () => {
      const ws = await connectBridge();

      const p1 = bridge.sendToFigma('pending1', {});
      const p2 = bridge.sendToFigma('pending2', {});
      const p3 = bridge.sendToFigma('pending3', {});

      expect(bridge.getConnectionStatus().pendingRequests).toBe(3);

      bridge.disconnect();

      await expect(p1).rejects.toThrow('Bridge disconnected');
      await expect(p2).rejects.toThrow('Bridge disconnected');
      await expect(p3).rejects.toThrow('Bridge disconnected');
    });

    it('new request after disconnect throws CONN_NOT_CONNECTED', async () => {
      await connectBridge();
      bridge.disconnect();

      await expect(bridge.sendToFigma('after_disconnect', {})).rejects.toThrow();
    });
  });

  describe('timeout racing with response', () => {
    it('response arriving just before timeout resolves successfully', async () => {
      const ws = await connectBridge();
      const promise = bridge.sendToFigma('almost_timeout', {});

      const id = getSentRequestId(ws, 0);

      // Advance to just before timeout (default 30000ms)
      vi.advanceTimersByTime(29999);

      // Response arrives in the nick of time
      ws.simulateMessage(JSON.stringify({ id, success: true, data: 'just_in_time' }));

      await expect(promise).resolves.toBe('just_in_time');
    });

    it('timeout fires if response arrives 1ms too late', async () => {
      const ws = await connectBridge();
      const promise = bridge.sendToFigma('too_slow', {});

      // Advance past timeout
      vi.advanceTimersByTime(30001);

      // Response arrives after timeout — promise already rejected
      const id = getSentRequestId(ws, 0);
      ws.simulateMessage(JSON.stringify({ id, success: true, data: 'too_late' }));

      await expect(promise).rejects.toThrow('Request timeout');
    });
  });

  describe('connect/disconnect rapid cycling', () => {
    it('rapid connect-disconnect-connect cycle does not leave zombie state', async () => {
      // First connection
      const ws1 = await connectBridge();
      expect(bridge.isConnected()).toBe(true);

      // Rapid disconnect
      bridge.disconnect();
      expect(bridge.isConnected()).toBe(false);

      // Rapid reconnect
      const connectPromise = bridge.connect();
      const ws2 = mockWsInstances[mockWsInstances.length - 1]!;
      ws2.simulateOpen();
      await connectPromise;
      expect(bridge.isConnected()).toBe(true);

      // Should be able to send requests on the new connection
      const sendPromise = bridge.sendToFigma('post_reconnect', {});
      const id = getSentRequestId(ws2, 0);
      ws2.simulateMessage(JSON.stringify({ id, success: true, data: 'alive' }));

      await expect(sendPromise).resolves.toBe('alive');
    });

    it('disconnect during connect attempt closes the socket and clears state', async () => {
      const connectPromise = bridge.connect();
      const ws = mockWsInstances[mockWsInstances.length - 1]!;

      // Disconnect before open event fires — this closes the ws
      bridge.disconnect();
      expect(bridge.isConnected()).toBe(false);

      // The ws.close() was called by disconnect()
      expect(ws.close).toHaveBeenCalled();

      // The connect promise is still pending because the ws never opened.
      // Simulate the close event that would normally fire after ws.close()
      ws.emit('close');

      // Advance timers to trigger the connection timeout
      vi.advanceTimersByTime(6000);

      // The connect promise should eventually reject
      await connectPromise.catch(() => {});

      expect(bridge.isConnected()).toBe(false);
    });
  });

  describe('duplicate response handling', () => {
    it('second response for same request ID is silently ignored', async () => {
      const ws = await connectBridge();
      const promise = bridge.sendToFigma('dedup_test', {});

      const id = getSentRequestId(ws, 0);

      // First response resolves the promise
      ws.simulateMessage(JSON.stringify({ id, success: true, data: 'first_response' }));
      await expect(promise).resolves.toBe('first_response');

      // Second response for the same ID — pending request already removed
      // Should not throw or cause any side effects
      expect(() => {
        ws.simulateMessage(JSON.stringify({ id, success: true, data: 'duplicate' }));
      }).not.toThrow();

      expect(bridge.getConnectionStatus().pendingRequests).toBe(0);
    });
  });

  describe('request ID uniqueness under rapid fire', () => {
    it('100 concurrent requests all get unique IDs', async () => {
      const ws = await connectBridge();

      const promises = Array.from({ length: 100 }, (_, i) =>
        bridge.sendToFigma(`rapid_${i}`, { index: i })
      );

      const ids = ws.send.mock.calls.map(
        (call: unknown[]) => (JSON.parse(call[0] as string) as { id: string }).id
      );

      expect(new Set(ids).size).toBe(100);

      // Clean up: resolve all
      for (let i = 0; i < 100; i++) {
        ws.simulateMessage(JSON.stringify({ id: ids[i], success: true, data: i }));
      }
      await Promise.all(promises);
    });
  });
});
