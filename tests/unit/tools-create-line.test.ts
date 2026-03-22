/**
 * create_line Tool Tests
 *
 * Tests execute function behavior: line orientation detection, length calculation,
 * CSS generation for horizontal/vertical/diagonal lines, and bridge error propagation.
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

const { createLine } = await import('../../mcp-server/src/tools/create_line.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigmaValidated: ReturnType<typeof vi.fn>;
  };
};

describe('createLine', () => {
  beforeEach(() => {
    loadConfig();
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      nodeId: '4:30'
    });
  });

  afterEach(() => {
    resetConfig();
    vi.restoreAllMocks();
  });

  it('identifies a horizontal line when y coordinates match', async () => {
    const result = await createLine({
      x1: 0,
      y1: 50,
      x2: 300,
      y2: 50,
      strokeColor: '#E0E0E0',
      strokeWeight: 1,
      strokeCap: 'NONE',
      name: 'Divider'
    });

    expect(result.lineId).toBe('4:30');
    expect(result.isHorizontal).toBe(true);
    expect(result.isVertical).toBe(false);
    expect(result.length).toBe(300);
    expect(result.message).toContain('horizontal');
    expect(result.cssEquivalent).toContain('border-top: 1px solid #E0E0E0');
  });

  it('identifies a vertical line when x coordinates match', async () => {
    const result = await createLine({
      x1: 100,
      y1: 0,
      x2: 100,
      y2: 200,
      strokeColor: '#000000',
      strokeWeight: 2,
      strokeCap: 'NONE',
      name: 'Vertical'
    });

    expect(result.isHorizontal).toBe(false);
    expect(result.isVertical).toBe(true);
    expect(result.length).toBe(200);
    expect(result.cssEquivalent).toContain('border-left: 2px solid #000000');
  });

  it('identifies a diagonal line and computes correct angle and length', async () => {
    // 3-4-5 right triangle: length = 5
    const result = await createLine({
      x1: 0,
      y1: 0,
      x2: 3,
      y2: 4,
      strokeColor: '#FF0000',
      strokeWeight: 1,
      strokeCap: 'NONE',
      name: 'Diagonal'
    });

    expect(result.isHorizontal).toBe(false);
    expect(result.isVertical).toBe(false);
    expect(result.length).toBe(5);
    expect(result.message).toContain('diagonal');
    // Diagonal CSS uses transform with angle
    expect(result.cssEquivalent).toContain('transform: rotate(');
    expect(result.cssEquivalent).toContain('width: 5px');
    expect(result.cssEquivalent).toContain('background: #FF0000');
  });

  it('includes dashed border-style for dashed horizontal lines', async () => {
    const result = await createLine({
      x1: 0,
      y1: 0,
      x2: 200,
      y2: 0,
      strokeColor: '#999999',
      strokeWeight: 2,
      strokeCap: 'NONE',
      dashPattern: [5, 3],
      name: 'Dashed'
    });

    expect(result.cssEquivalent).toContain('border-style: dashed');
  });

  it('sends correct payload to bridge including optional fields', async () => {
    await createLine({
      x1: 10,
      y1: 20,
      x2: 300,
      y2: 20,
      strokeColor: '#CCCCCC',
      strokeWeight: 3,
      strokeCap: 'ROUND',
      dashPattern: [10, 5],
      name: 'Custom Line',
      parentId: 'frame-7'
    });

    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledWith(
      'create_line',
      expect.objectContaining({
        x1: 10,
        y1: 20,
        x2: 300,
        y2: 20,
        strokeColor: '#CCCCCC',
        strokeWeight: 3,
        strokeCap: 'ROUND',
        dashPattern: [10, 5],
        name: 'Custom Line',
        parentId: 'frame-7'
      }),
      expect.anything() // Zod response schema
    );
  });

  it('handles zero-length line (point)', async () => {
    const result = await createLine({
      x1: 50,
      y1: 50,
      x2: 50,
      y2: 50,
      strokeColor: '#000000',
      strokeWeight: 1,
      strokeCap: 'NONE',
      name: 'Point'
    });

    // Both dx and dy are 0
    expect(result.isHorizontal).toBe(true); // dy === 0
    expect(result.isVertical).toBe(true); // dx === 0
    expect(result.length).toBe(0);
  });

  it('returns empty lineId when response has no nodeId', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({ success: true });

    const result = await createLine({
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
      strokeColor: '#000000',
      strokeWeight: 1,
      strokeCap: 'NONE',
      name: 'No ID'
    });

    expect(result.lineId).toBe('');
  });

  it('propagates bridge errors without wrapping', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Not connected to Figma plugin'));

    await expect(
      createLine({
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 0,
        strokeColor: '#000000',
        strokeWeight: 1,
        strokeCap: 'NONE',
        name: 'Fail'
      })
    ).rejects.toThrow('Not connected to Figma plugin');
  });
});
