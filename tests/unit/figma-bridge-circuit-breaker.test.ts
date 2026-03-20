/**
 * FigmaBridge Circuit Breaker Tests
 *
 * Tests circuit breaker state machine: CLOSED → OPEN → HALF_OPEN → CLOSED,
 * probe-in-flight rejection, disabled bypass, and status reporting.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import { ErrorCode, createError } from '../../mcp-server/src/errors/error-codes.js';
import { loadConfig, resetConfig } from '../../mcp-server/src/config.js';

let mockWsInstances: MockWebSocket[] = [];

class MockWebSocket extends EventEmitter {
  static OPEN = 1;
  static CLOSED = 3;
  static CONNECTING = 0;
  readyState = 0;
  send = vi.fn();
  close = vi.fn(function (this: MockWebSocket) {
    this.readyState = 3;
  });

  constructor(_url: string) {
    super();
    mockWsInstances.push(this);
  }

  simulateOpen(): void {
    this.readyState = 1;
    this.emit('open');
  }

  simulateMessage(data: string | Buffer): void {
    this.emit('message', data);
  }
}

vi.mock('ws', () => ({
  default: MockWebSocket,
  WebSocket: MockWebSocket
}));

const { FigmaBridgeError, FigmaBridge } = await import('../../mcp-server/src/figma-bridge.js');

describe('FigmaBridge circuit breaker', () => {
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

  async function connectBridge(): Promise<MockWebSocket> {
    const connectPromise = bridge.connect();
    const ws = mockWsInstances[mockWsInstances.length - 1]!;
    ws.simulateOpen();
    await connectPromise;
    return ws;
  }

  async function tripCircuitBreaker(ws: MockWebSocket): Promise<void> {
    for (let i = 0; i < 5; i++) {
      const p = bridge.sendToFigmaWithRetry('test', {}, { maxRetries: 1, baseDelay: 1 });
      const sentData = JSON.parse(
        ws.send.mock.calls[ws.send.mock.calls.length - 1][0] as string
      ) as Record<string, unknown>;
      ws.simulateMessage(JSON.stringify({ id: sentData.id, success: false, error: `fail-${i}` }));
      await p.catch(() => {});
      await vi.advanceTimersByTimeAsync(10);
    }
  }

  it('opens after threshold failures (default 5)', async () => {
    const ws = await connectBridge();
    await tripCircuitBreaker(ws);
    expect(bridge.getConnectionStatus().circuitBreakerState).toBe('OPEN');
  });

  it('rejects immediately when circuit is OPEN', async () => {
    const ws = await connectBridge();
    await tripCircuitBreaker(ws);

    await expect(
      bridge.sendToFigmaWithRetry('test', {}, { maxRetries: 1, baseDelay: 1 })
    ).rejects.toThrow('Circuit breaker');
  });

  it('transitions to HALF_OPEN after reset timeout and allows probe', async () => {
    const ws = await connectBridge();
    await tripCircuitBreaker(ws);
    expect(bridge.getConnectionStatus().circuitBreakerState).toBe('OPEN');

    vi.advanceTimersByTime(31000);

    const probePromise = bridge.sendToFigmaWithRetry(
      'probe',
      {},
      {
        maxRetries: 1,
        baseDelay: 1
      }
    );
    const sentData = JSON.parse(
      ws.send.mock.calls[ws.send.mock.calls.length - 1][0] as string
    ) as Record<string, unknown>;
    ws.simulateMessage(JSON.stringify({ id: sentData.id, success: true, data: 'recovered' }));

    await expect(probePromise).resolves.toBe('recovered');
  });

  it('rejects concurrent requests during HALF_OPEN probe', async () => {
    const ws = await connectBridge();
    await tripCircuitBreaker(ws);
    vi.advanceTimersByTime(31000);

    const probePromise = bridge.sendToFigmaWithRetry(
      'probe',
      {},
      {
        maxRetries: 1,
        baseDelay: 1
      }
    );

    const blockedPromise = bridge.sendToFigmaWithRetry(
      'blocked',
      {},
      {
        maxRetries: 1,
        baseDelay: 1
      }
    );

    await expect(blockedPromise).rejects.toThrow('probe in progress');

    // Clean up probe
    const lastSendIdx = ws.send.mock.calls.length - 1;
    if (lastSendIdx >= 0) {
      const sentData = JSON.parse(ws.send.mock.calls[lastSendIdx][0] as string) as Record<
        string,
        unknown
      >;
      ws.simulateMessage(JSON.stringify({ id: sentData.id, success: true, data: 'ok' }));
    }
    await probePromise.catch(() => {});
  });

  it('returns to CLOSED after 2 successes in HALF_OPEN state', async () => {
    const ws = await connectBridge();
    await tripCircuitBreaker(ws);
    vi.advanceTimersByTime(31000);

    // First success (probe)
    const p1 = bridge.sendToFigmaWithRetry('test', {}, { maxRetries: 1, baseDelay: 1 });
    let sentData = JSON.parse(
      ws.send.mock.calls[ws.send.mock.calls.length - 1][0] as string
    ) as Record<string, unknown>;
    ws.simulateMessage(JSON.stringify({ id: sentData.id, success: true, data: 'ok1' }));
    await p1;

    // Second success → CLOSED
    const p2 = bridge.sendToFigmaWithRetry('test', {}, { maxRetries: 1, baseDelay: 1 });
    sentData = JSON.parse(ws.send.mock.calls[ws.send.mock.calls.length - 1][0] as string) as Record<
      string,
      unknown
    >;
    ws.simulateMessage(JSON.stringify({ id: sentData.id, success: true, data: 'ok2' }));
    await p2;

    expect(bridge.getConnectionStatus().circuitBreakerState).toBe('CLOSED');
  });

  it('bypasses circuit breaker when disabled in config', async () => {
    bridge.disconnect();
    resetConfig();

    process.env.CIRCUIT_BREAKER_ENABLED = 'false';
    loadConfig();
    bridge = new FigmaBridge();

    const ws = await connectBridge();

    for (let i = 0; i < 10; i++) {
      const p = bridge.sendToFigma('test', {});
      const sentData = JSON.parse(
        ws.send.mock.calls[ws.send.mock.calls.length - 1][0] as string
      ) as Record<string, unknown>;
      ws.simulateMessage(JSON.stringify({ id: sentData.id, success: false, error: `fail-${i}` }));
      await p.catch(() => {});
    }

    expect(bridge.getConnectionStatus().circuitBreakerState).toBe('CLOSED');
    delete process.env.CIRCUIT_BREAKER_ENABLED;
  });

  it('reports status accurately with pending requests', async () => {
    const ws = await connectBridge();
    const pending = bridge.sendToFigma('pending_op', {}).catch(() => {});

    const status = bridge.getConnectionStatus();
    expect(status.connected).toBe(true);
    expect(status.wsReadyState).toBe(1);
    expect(status.pendingRequests).toBe(1);
    expect(status.circuitBreakerState).toBe('CLOSED');
  });
});
