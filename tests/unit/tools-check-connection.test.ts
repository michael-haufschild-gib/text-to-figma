/**
 * check_connection Tool Tests
 *
 * Tests the check_connection execute function:
 * 1. Not-connected status reporting
 * 2. Ping success with full connection info
 * 3. Ping failure handling
 * 4. WebSocket ready state mapping
 * 5. Edge cases (undefined state, unknown state)
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock the figma bridge
vi.mock('../../mcp-server/src/figma-bridge.js', () => {
  const mockBridge = {
    isConnected: vi.fn(() => true),
    sendToFigma: vi.fn(),
    sendToFigmaWithRetry: vi.fn(),
    sendToFigmaValidated: vi.fn(),
    sendToFigmaWithAbort: vi.fn(),
    getConnectionStatus: vi.fn(() => ({
      connected: true,
      wsReadyState: 1,
      pendingRequests: 0,
      circuitBreakerState: 'CLOSED' as const,
      reconnectAttempts: 0
    })),
    connect: vi.fn(),
    disconnect: vi.fn()
  };

  return {
    getFigmaBridge: () => mockBridge,
    FigmaBridge: vi.fn(() => mockBridge),
    __mockBridge: mockBridge
  };
});

const { checkConnection } = await import('../../mcp-server/src/tools/check_connection.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigma: ReturnType<typeof vi.fn>;
    sendToFigmaValidated: ReturnType<typeof vi.fn>;
    sendToFigmaWithRetry: ReturnType<typeof vi.fn>;
    isConnected: ReturnType<typeof vi.fn>;
    getConnectionStatus: ReturnType<typeof vi.fn>;
  };
};

describe('checkConnection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns not-connected status when WebSocket is down', async () => {
    __mockBridge.getConnectionStatus.mockReturnValue({
      connected: false,
      wsReadyState: 3,
      pendingRequests: 0,
      circuitBreakerState: 'OPEN',
      reconnectAttempts: 2
    });

    const result = await checkConnection();

    expect(result.connected).toBe(false);
    expect(result.wsReadyState).toBe(3);
    expect(result.wsReadyStateText).toBe('CLOSED');
    expect(result.circuitBreakerState).toBe('OPEN');
    expect(result.message).toContain('Not connected');
    // Should not attempt ping when disconnected
    expect(__mockBridge.sendToFigmaValidated).not.toHaveBeenCalled();
  });

  it('does not attempt ping when disconnected — returns immediately', async () => {
    __mockBridge.getConnectionStatus.mockReturnValue({
      connected: false,
      wsReadyState: 0,
      pendingRequests: 0,
      circuitBreakerState: 'CLOSED',
      reconnectAttempts: 0
    });

    const result = await checkConnection();

    expect(result.connected).toBe(false);
    expect(result.wsReadyStateText).toBe('CONNECTING');
    expect(result.latencyMs).toBeUndefined();
    expect(__mockBridge.sendToFigmaValidated).not.toHaveBeenCalled();
  });

  it('returns full connection info when ping succeeds', async () => {
    __mockBridge.getConnectionStatus.mockReturnValue({
      connected: true,
      wsReadyState: 1,
      pendingRequests: 0,
      circuitBreakerState: 'CLOSED',
      reconnectAttempts: 0
    });
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      pong: true,
      timestamp: Date.now(),
      pluginVersion: '1.2.0',
      fileName: 'My Design',
      currentPage: 'Home'
    });

    const result = await checkConnection();

    expect(result.connected).toBe(true);
    expect(result.latencyMs).toBeTypeOf('number');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.figmaFile).toBe('My Design');
    expect(result.currentPage).toBe('Home');
    expect(result.pluginVersion).toBe('1.2.0');
    expect(result.wsReadyStateText).toBe('OPEN');
    expect(result.message).toContain('My Design');
    expect(result.message).toContain('Home');
    expect(result.error).toBeUndefined();
  });

  it('sends ping command to bridge with correct type', async () => {
    __mockBridge.getConnectionStatus.mockReturnValue({
      connected: true,
      wsReadyState: 1,
      pendingRequests: 0,
      circuitBreakerState: 'CLOSED',
      reconnectAttempts: 0
    });
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      pong: true,
      timestamp: Date.now(),
      pluginVersion: '1.0.0',
      fileName: 'F',
      currentPage: 'P'
    });

    await checkConnection();

    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledWith('ping', {}, expect.anything());
  });

  it('returns connected=true with error when ping fails (WebSocket up but plugin unresponsive)', async () => {
    __mockBridge.getConnectionStatus.mockReturnValue({
      connected: true,
      wsReadyState: 1,
      pendingRequests: 0,
      circuitBreakerState: 'CLOSED',
      reconnectAttempts: 0
    });
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Ping timeout'));

    const result = await checkConnection();

    expect(result.connected).toBe(true);
    expect(result.latencyMs).toBeTypeOf('number');
    expect(result.message).toContain('did not respond to ping');
    expect(result.error).toBe('Ping timeout');
    // Should not have figmaFile/currentPage since ping failed
    expect(result.figmaFile).toBeUndefined();
    expect(result.currentPage).toBeUndefined();
  });

  it('converts non-Error thrown values to string in error field', async () => {
    __mockBridge.getConnectionStatus.mockReturnValue({
      connected: true,
      wsReadyState: 1,
      pendingRequests: 0,
      circuitBreakerState: 'CLOSED',
      reconnectAttempts: 0
    });
    __mockBridge.sendToFigmaValidated.mockRejectedValue('raw string error');

    const result = await checkConnection();

    expect(result.error).toBe('raw string error');
  });

  it('maps all known wsReadyState values correctly', async () => {
    const stateMap: Array<[number, string]> = [
      [0, 'CONNECTING'],
      [1, 'OPEN'],
      [2, 'CLOSING'],
      [3, 'CLOSED']
    ];

    for (const [state, text] of stateMap) {
      __mockBridge.getConnectionStatus.mockReturnValue({
        connected: false,
        wsReadyState: state,
        pendingRequests: 0,
        circuitBreakerState: 'CLOSED',
        reconnectAttempts: 0
      });

      const result = await checkConnection();
      expect(result.wsReadyStateText).toBe(text);
    }
  });

  it('handles undefined wsReadyState (no wsReadyStateText)', async () => {
    __mockBridge.getConnectionStatus.mockReturnValue({
      connected: false,
      wsReadyState: undefined,
      pendingRequests: 0,
      circuitBreakerState: 'CLOSED',
      reconnectAttempts: 0
    });

    const result = await checkConnection();

    expect(result.wsReadyStateText).toBeUndefined();
  });

  it('handles unknown wsReadyState with UNKNOWN text', async () => {
    __mockBridge.getConnectionStatus.mockReturnValue({
      connected: false,
      wsReadyState: 99,
      pendingRequests: 0,
      circuitBreakerState: 'CLOSED',
      reconnectAttempts: 0
    });

    const result = await checkConnection();

    expect(result.wsReadyStateText).toBe('UNKNOWN');
  });

  it('reports pending requests from connection status', async () => {
    __mockBridge.getConnectionStatus.mockReturnValue({
      connected: true,
      wsReadyState: 1,
      pendingRequests: 5,
      circuitBreakerState: 'HALF_OPEN',
      reconnectAttempts: 0
    });
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      pong: true,
      timestamp: Date.now(),
      pluginVersion: '1.0.0',
      fileName: 'F',
      currentPage: 'P'
    });

    const result = await checkConnection();

    expect(result.pendingRequests).toBe(5);
    expect(result.circuitBreakerState).toBe('HALF_OPEN');
  });
});
