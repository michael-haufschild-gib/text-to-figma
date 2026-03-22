/**
 * set_transform Tool Tests
 *
 * Tests the SetTransformInputSchema validation and setTransform execute function:
 * 1. Schema validation (required fields, boundary values, flip enum)
 * 2. Payload verification (what gets sent to the bridge)
 * 3. CSS generation (position, rotation, flip, scale)
 * 4. Applied-list ordering
 * 5. Error paths (no transforms, bridge failure)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const { setTransform, SetTransformInputSchema } =
  await import('../../mcp-server/src/tools/set_transform.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigma: ReturnType<typeof vi.fn>;
    sendToFigmaWithRetry: ReturnType<typeof vi.fn>;
    isConnected: ReturnType<typeof vi.fn>;
    getConnectionStatus: ReturnType<typeof vi.fn>;
  };
};

// ─── SetTransformInputSchema ─────────────────────────────────────────────────

describe('SetTransformInputSchema', () => {
  it('requires nodeId', () => {
    expect(SetTransformInputSchema.safeParse({ rotation: 45 }).success).toBe(false);
  });

  it('rejects empty nodeId', () => {
    expect(SetTransformInputSchema.safeParse({ nodeId: '', rotation: 45 }).success).toBe(false);
  });

  it('rejects non-positive size dimensions', () => {
    expect(
      SetTransformInputSchema.safeParse({ nodeId: 'n', size: { width: 0, height: 100 } }).success
    ).toBe(false);
    expect(
      SetTransformInputSchema.safeParse({ nodeId: 'n', size: { width: 100, height: -1 } }).success
    ).toBe(false);
  });

  it('accepts negative position coordinates', () => {
    const result = SetTransformInputSchema.safeParse({
      nodeId: 'n',
      position: { x: -100, y: -200 }
    });
    expect(result.success).toBe(true);
  });

  it('accepts negative rotation (counter-clockwise)', () => {
    const result = SetTransformInputSchema.safeParse({
      nodeId: 'n',
      rotation: -45
    });
    expect(result.success).toBe(true);
  });

  it('accepts zero rotation', () => {
    const result = SetTransformInputSchema.safeParse({
      nodeId: 'n',
      rotation: 0
    });
    expect(result.success).toBe(true);
  });

  it('accepts all 3 flip values', () => {
    for (const flip of ['HORIZONTAL', 'VERTICAL', 'BOTH']) {
      expect(SetTransformInputSchema.safeParse({ nodeId: 'n', flip }).success).toBe(true);
    }
  });

  it('rejects invalid flip value', () => {
    expect(SetTransformInputSchema.safeParse({ nodeId: 'n', flip: 'DIAGONAL' }).success).toBe(
      false
    );
  });
});

// ─── setTransform ────────────────────────────────────────────────────────────

describe('setTransform', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaWithRetry.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends correct payload with all transform types', async () => {
    await setTransform({
      nodeId: 'el-1',
      position: { x: 100, y: 200 },
      size: { width: 300, height: 400 },
      rotation: 45,
      scale: { x: 2, y: 1.5 },
      flip: 'HORIZONTAL'
    });

    expect(__mockBridge.sendToFigmaWithRetry).toHaveBeenCalledWith('set_transform', {
      nodeId: 'el-1',
      position: { x: 100, y: 200 },
      size: { width: 300, height: 400 },
      rotation: 45,
      scale: { x: 2, y: 1.5 },
      flip: 'HORIZONTAL'
    });
  });

  it('only includes specified transforms in payload', async () => {
    await setTransform({ nodeId: 'el-1', rotation: 90 });

    const payload = __mockBridge.sendToFigmaWithRetry.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(payload)).toEqual(['nodeId', 'rotation']);
  });

  it('generates position CSS with absolute positioning', async () => {
    const result = await setTransform({
      nodeId: 'el-1',
      position: { x: 100, y: 200 }
    });

    expect(result.cssEquivalent).toContain('position: absolute;');
    expect(result.cssEquivalent).toContain('left: 100px;');
    expect(result.cssEquivalent).toContain('top: 200px;');
  });

  it('handles negative position coordinates in CSS', async () => {
    const result = await setTransform({
      nodeId: 'el-1',
      position: { x: -50, y: -100 }
    });

    expect(result.cssEquivalent).toContain('left: -50px;');
    expect(result.cssEquivalent).toContain('top: -100px;');
  });

  it('handles zero rotation in CSS', async () => {
    const result = await setTransform({ nodeId: 'el-1', rotation: 0 });
    expect(result.cssEquivalent).toContain('transform: rotate(0deg);');
    expect(result.applied).toEqual(['rotation']);
  });

  it('generates correct CSS for all 3 flip directions', async () => {
    const flips: Array<[string, string]> = [
      ['HORIZONTAL', 'scaleX(-1)'],
      ['VERTICAL', 'scaleY(-1)'],
      ['BOTH', 'scale(-1, -1)']
    ];

    for (const [flipValue, expectedCss] of flips) {
      __mockBridge.sendToFigmaWithRetry.mockResolvedValue(undefined);
      const result = await setTransform({
        nodeId: 'el',
        flip: flipValue as 'HORIZONTAL' | 'VERTICAL' | 'BOTH'
      });
      expect(result.cssEquivalent).toContain(expectedCss);
    }
  });

  it('applies returns list preserving order: position, size, rotation, scale, flip', async () => {
    const result = await setTransform({
      nodeId: 'el-1',
      flip: 'HORIZONTAL',
      position: { x: 0, y: 0 },
      rotation: 10,
      size: { width: 50, height: 50 },
      scale: { x: 1, y: 1 }
    });

    expect(result.applied).toEqual(['position', 'size', 'rotation', 'scale', 'flip']);
  });

  it('throws descriptive error when no transformations specified', async () => {
    await expect(setTransform({ nodeId: 'el-6' })).rejects.toThrow('No transformations specified');
    expect(__mockBridge.sendToFigmaWithRetry).not.toHaveBeenCalled();
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaWithRetry.mockRejectedValue(new Error('Transform failed'));

    await expect(setTransform({ nodeId: 'x', position: { x: 0, y: 0 } })).rejects.toThrow(
      'Transform failed'
    );
  });
});
