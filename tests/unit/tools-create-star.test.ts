/**
 * create_star Tool Tests
 *
 * Tests execute function behavior: inner radius calculation, CSS generation,
 * point count handling, and bridge error propagation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, resetConfig } from '../../mcp-server/src/config.js';

// Mock the figma bridge
vi.mock('../../mcp-server/src/figma-bridge.js', () => {
  const mockBridge = {
    isConnected: vi.fn(() => true),
    sendToFigma: vi.fn(),
    sendToFigmaValidated: vi.fn(),
    sendToFigmaWithAbort: vi.fn(),
    getConnectionStatus: vi.fn(() => ({
      connected: true,
      pendingRequests: 0,
      circuitBreakerState: 'CLOSED',
      reconnectAttempts: 0
    })),
    connect: vi.fn(),
    disconnect: vi.fn()
  };

  return {
    getFigmaBridge: () => mockBridge,
    FigmaBridge: vi.fn(() => mockBridge),
    FigmaBridgeError: class extends Error {
      constructor(msg: string) {
        super(typeof msg === 'string' ? msg : 'bridge error');
        this.name = 'FigmaBridgeError';
      }
    },
    __mockBridge: mockBridge
  };
});

const { createStar } = await import('../../mcp-server/src/tools/create_star.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigmaValidated: ReturnType<typeof vi.fn>;
  };
};

describe('createStar', () => {
  beforeEach(() => {
    loadConfig();
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      nodeId: '6:50'
    });
  });

  afterEach(() => {
    resetConfig();
    vi.restoreAllMocks();
  });

  it('auto-calculates inner radius using golden ratio when not provided', async () => {
    const result = await createStar({
      pointCount: 5,
      radius: 100,
      name: 'Star'
    });

    expect(result.starId).toBe('6:50');
    expect(result.pointCount).toBe(5);
    expect(result.radius).toBe(100);
    // innerRadius = 100 * 0.382 = 38.2
    expect(result.innerRadius).toBeCloseTo(38.2, 1);
    expect(result.message).toContain('5-point star');
    expect(result.message).toContain('radius: 100px');
  });

  it('uses explicit inner radius when provided', async () => {
    const result = await createStar({
      pointCount: 5,
      radius: 60,
      innerRadius: 20,
      name: 'Custom Star'
    });

    expect(result.innerRadius).toBe(20);
    expect(result.message).toContain('inner: 20px');
  });

  it('generates CSS with correct dimensions from radius', async () => {
    const result = await createStar({
      pointCount: 5,
      radius: 50,
      name: 'Star',
      fillColor: '#FFD700'
    });

    // CSS dimensions = radius * 2
    expect(result.cssEquivalent).toContain('width: 100px');
    expect(result.cssEquivalent).toContain('height: 100px');
    expect(result.cssEquivalent).toContain('background-color: #FFD700');
    // Star with 5 points has 10 vertices (5 * 2)
    expect(result.cssEquivalent).toContain('10 vertices');
  });

  it('sends correct payload to bridge with auto-calculated inner radius', async () => {
    await createStar({
      pointCount: 8,
      radius: 60,
      name: 'Starburst',
      parentId: 'frame-20',
      fillColor: '#FF6B00',
      strokeColor: '#CC5500',
      strokeWeight: 2
    });

    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledWith(
      'create_star',
      expect.objectContaining({
        pointCount: 8,
        radius: 60,
        innerRadius: 60 * 0.382, // auto-calculated
        name: 'Starburst',
        parentId: 'frame-20',
        fillColor: '#FF6B00',
        strokeColor: '#CC5500',
        strokeWeight: 2
      }),
      expect.anything() // Zod response schema
    );
  });

  it('sends explicit inner radius to bridge when provided', async () => {
    await createStar({
      pointCount: 12,
      radius: 80,
      innerRadius: 30,
      name: 'Burst'
    });

    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledWith(
      'create_star',
      expect.objectContaining({
        innerRadius: 30
      }),
      expect.anything() // Zod response schema
    );
  });

  it('rejects response when bridge returns no nodeId', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Required at "nodeId"'));

    await expect(
      createStar({
        pointCount: 5,
        radius: 24,
        name: 'No ID'
      })
    ).rejects.toThrow();
  });

  it('propagates bridge errors without wrapping', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Circuit breaker open'));

    await expect(createStar({ pointCount: 5, radius: 30, name: 'Fail' })).rejects.toThrow(
      'Circuit breaker open'
    );
  });
});
