/**
 * Shared FigmaBridge mock factory
 *
 * Provides a consistent mock bridge for tool tests. This factory can be
 * used with vi.mock() to avoid duplicating the mock setup across files.
 *
 * NOTE: vitest hoists vi.mock() calls, so the factory function passed to
 * vi.mock() cannot reference imports from this module. Instead, use the
 * factory inline OR use `vi.mock('...', () => createBridgeMock())` with
 * a dynamic import. See the vitest docs on module mocking for details.
 *
 * For test files that import the tool module via top-level `await import()`,
 * the inline mock pattern (copy-paste) is required because vitest hoists
 * vi.mock before any import happens. This is a vitest limitation, not a
 * test quality issue.
 *
 * Usage pattern (for files using dynamic import):
 *   vi.mock('../../mcp-server/src/figma-bridge.js', () => {
 *     // inline factory — see any tools-*.test.ts for the pattern
 *   });
 */

import { vi } from 'vitest';

export interface MockBridge {
  isConnected: ReturnType<typeof vi.fn>;
  sendToFigma: ReturnType<typeof vi.fn>;
  sendToFigmaWithRetry: ReturnType<typeof vi.fn>;
  sendToFigmaValidated: ReturnType<typeof vi.fn>;
  sendToFigmaWithAbort: ReturnType<typeof vi.fn>;
  getConnectionStatus: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

let _mockBridge: MockBridge | null = null;

/**
 * Creates a fresh mock bridge instance. Call this to get a mock for
 * vi.mock() factory function.
 */
export function createBridgeMock(): Record<string, unknown> {
  _mockBridge = {
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
    FigmaAckResponseSchema: { parse: (v: unknown) => v },
    getFigmaBridge: () => _mockBridge,
    FigmaBridge: vi.fn(() => _mockBridge),
    FigmaBridgeError: class FigmaBridgeError extends Error {
      code: string;
      constructor(msgOrStructured: string | { message: string; code: string }) {
        const msg = typeof msgOrStructured === 'string' ? msgOrStructured : msgOrStructured.message;
        super(msg);
        this.name = 'FigmaBridgeError';
        this.code = typeof msgOrStructured === 'string' ? 'SYS_INTERNAL' : msgOrStructured.code;
      }
    },
    __mockBridge: _mockBridge
  };
}

/**
 * Gets the current mock bridge instance. Must be called after
 * createBridgeMock() has been used.
 */
export function getMockBridge(): MockBridge {
  if (!_mockBridge) {
    throw new Error(
      'getMockBridge() called before createBridgeMock(). ' +
        'Use vi.mock("...figma-bridge.js", createBridgeMock) first.'
    );
  }
  return _mockBridge;
}

/**
 * Resets the mock bridge to a clean state (all mocks cleared).
 * Useful in afterEach() if you want fresh mocks between tests.
 */
export function resetMockBridge(): void {
  if (_mockBridge) {
    for (const fn of Object.values(_mockBridge)) {
      if (typeof fn === 'function' && 'mockReset' in fn) {
        (fn as ReturnType<typeof vi.fn>).mockReset();
      }
    }
    // Re-apply defaults
    _mockBridge.isConnected.mockReturnValue(true);
    _mockBridge.getConnectionStatus.mockReturnValue({
      connected: true,
      wsReadyState: 1,
      pendingRequests: 0,
      circuitBreakerState: 'CLOSED' as const,
      reconnectAttempts: 0
    });
  }
}
