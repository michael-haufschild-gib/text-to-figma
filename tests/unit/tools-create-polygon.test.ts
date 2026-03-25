/**
 * create_polygon Tool Tests
 *
 * Tests execute function behavior: polygon type naming, CSS generation,
 * dimension calculation, and bridge error propagation.
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
    FigmaAckResponseSchema: { parse: (v: unknown) => v },
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

const { createPolygon } = await import('../../mcp-server/src/tools/create_polygon.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigmaValidated: ReturnType<typeof vi.fn>;
  };
};

describe('createPolygon', () => {
  beforeEach(() => {
    loadConfig();
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      nodeId: '5:40'
    });
  });

  afterEach(() => {
    resetConfig();
    vi.restoreAllMocks();
  });

  it('identifies a triangle for 3 sides', async () => {
    const result = await createPolygon({
      sideCount: 3,
      radius: 50,
      name: 'Triangle',
      fillColor: '#FF0000'
    });

    expect(result.polygonId).toBe('5:40');
    expect(result.polygonType).toBe('triangle');
    expect(result.sideCount).toBe(3);
    expect(result.radius).toBe(50);
    expect(result.message).toContain('triangle');
    expect(result.message).toContain('3 sides');
  });

  it('identifies a hexagon for 6 sides', async () => {
    const result = await createPolygon({
      sideCount: 6,
      radius: 60,
      name: 'Hexagon Badge'
    });

    expect(result.polygonType).toBe('hexagon');
    expect(result.message).toContain('hexagon');
  });

  it('names unknown polygon types with side count', async () => {
    const result = await createPolygon({
      sideCount: 7,
      radius: 40,
      name: 'Heptagon'
    });

    // 7 is not in the lookup table
    expect(result.polygonType).toBe('7-sided polygon');
    expect(result.message).toContain('7-sided polygon');
  });

  it('identifies all named polygon types correctly', async () => {
    const namedTypes: Record<number, string> = {
      3: 'triangle',
      4: 'diamond',
      5: 'pentagon',
      6: 'hexagon',
      8: 'octagon'
    };

    for (const [sides, expectedType] of Object.entries(namedTypes)) {
      const result = await createPolygon({
        sideCount: Number(sides),
        radius: 30,
        name: 'Test'
      });
      expect(result.polygonType).toBe(expectedType);
    }
  });

  it('generates CSS with correct dimensions from radius', async () => {
    const result = await createPolygon({
      sideCount: 6,
      radius: 50,
      name: 'Hexagon',
      fillColor: '#0066FF'
    });

    // CSS dimensions = radius * 2
    expect(result.cssEquivalent).toContain('width: 100px');
    expect(result.cssEquivalent).toContain('height: 100px');
    expect(result.cssEquivalent).toContain('background-color: #0066FF');
    expect(result.cssEquivalent).toContain('clip-path: polygon');
  });

  it('sends correct payload to bridge', async () => {
    await createPolygon({
      sideCount: 5,
      radius: 45,
      name: 'Pentagon',
      parentId: 'frame-10',
      fillColor: '#00FF00',
      strokeColor: '#006600',
      strokeWeight: 2
    });

    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledWith(
      'create_polygon',
      expect.objectContaining({
        sideCount: 5,
        radius: 45,
        name: 'Pentagon',
        parentId: 'frame-10',
        fillColor: '#00FF00',
        strokeColor: '#006600',
        strokeWeight: 2
      }),
      expect.anything() // Zod response schema
    );
  });

  it('rejects response when bridge returns no nodeId', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Required at "nodeId"'));

    await expect(
      createPolygon({
        sideCount: 3,
        radius: 30,
        name: 'No ID'
      })
    ).rejects.toThrow();
  });

  it('propagates bridge errors without wrapping', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Request timeout exceeded'));

    await expect(createPolygon({ sideCount: 4, radius: 40, name: 'Fail' })).rejects.toThrow(
      'Request timeout exceeded'
    );
  });
});
