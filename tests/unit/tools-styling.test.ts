/**
 * Styling Tools Tests
 *
 * Tests execute functions for: set_fills, set_corner_radius, set_stroke,
 * set_appearance, apply_effects, add_gradient_fill, set_image_fill
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
    __mockBridge: mockBridge
  };
});

const { setFills } = await import('../../mcp-server/src/tools/set_fills.js');
const { setCornerRadius } = await import('../../mcp-server/src/tools/set_corner_radius.js');
const { setStroke } = await import('../../mcp-server/src/tools/set_stroke.js');
const { setAppearance } = await import('../../mcp-server/src/tools/set_appearance.js');
const { applyEffects } = await import('../../mcp-server/src/tools/apply_effects.js');
const { addGradientFill } = await import('../../mcp-server/src/tools/add_gradient_fill.js');
const { setImageFill } = await import('../../mcp-server/src/tools/set_image_fill.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigmaValidated: ReturnType<typeof vi.fn>;
  };
};

describe('setFills', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns correct result with hex color', async () => {
    const result = await setFills({
      nodeId: 'node-1',
      color: '#FF0000',
      opacity: 1
    });

    expect(result.nodeId).toBe('node-1');
    expect(result.appliedColor).toBe('#FF0000');
    expect(result.cssEquivalent).toBe('background-color: #FF0000;');
  });

  it('generates text CSS when isText flag is true', async () => {
    const result = await setFills({ nodeId: 'text-1', color: '#0000FF', opacity: 1 }, true);

    expect(result.cssEquivalent).toBe('color: #0000FF;');
  });

  it('includes opacity in CSS when opacity < 1', async () => {
    const result = await setFills({
      nodeId: 'node-2',
      color: '#00FF00',
      opacity: 0.5
    });

    expect(result.cssEquivalent).toContain('opacity: 0.5');
    expect(result.cssEquivalent).toContain('background-color: #00FF00;');
  });

  it('sends normalized RGB values (0-1) to bridge', async () => {
    await setFills({ nodeId: 'node-3', color: '#FF8000', opacity: 1 });

    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledOnce();
    const callArgs = __mockBridge.sendToFigmaValidated.mock.calls[0] as [
      string,
      Record<string, unknown>
    ];
    expect(callArgs[0]).toBe('set_fills');
    const payload = callArgs[1] as {
      nodeId: string;
      fills: Array<{ type: string; color: { r: number; g: number; b: number }; opacity: number }>;
    };
    expect(payload.nodeId).toBe('node-3');
    expect(payload.fills).toHaveLength(1);
    expect(payload.fills[0].type).toBe('SOLID');
    expect(payload.fills[0].color.r).toBe(1);
    expect(payload.fills[0].color.g).toBeCloseTo(0.502, 1);
    expect(payload.fills[0].color.b).toBe(0);
    expect(payload.fills[0].opacity).toBe(1);
  });

  it('accepts RGB object input and converts to hex', async () => {
    const result = await setFills({
      nodeId: 'node-4',
      color: { r: 255, g: 0, b: 0 },
      opacity: 1
    });

    expect(result.appliedColor).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('handles opacity exactly at 1 — no opacity CSS added', async () => {
    const result = await setFills({
      nodeId: 'node-exact-1',
      color: '#333333',
      opacity: 1
    });

    // opacity: 1 should NOT produce an "opacity:" line in CSS
    expect(result.cssEquivalent).not.toContain('opacity:');
    expect(result.cssEquivalent).toBe('background-color: #333333;');
  });

  it('handles opacity at 0 — fully transparent', async () => {
    const result = await setFills({
      nodeId: 'node-zero-opacity',
      color: '#FF0000',
      opacity: 0
    });

    expect(result.cssEquivalent).toContain('opacity: 0');
  });

  it('sends correct normalized RGB to bridge for pure white', async () => {
    await setFills({ nodeId: 'node-white', color: '#FFFFFF', opacity: 1 });

    const callArgs = __mockBridge.sendToFigmaValidated.mock.calls[0] as [
      string,
      { fills: Array<{ color: { r: number; g: number; b: number } }> }
    ];
    const color = callArgs[1].fills[0].color;
    expect(color.r).toBe(1);
    expect(color.g).toBe(1);
    expect(color.b).toBe(1);
  });

  it('sends correct normalized RGB to bridge for pure black', async () => {
    await setFills({ nodeId: 'node-black', color: '#000000', opacity: 1 });

    const callArgs = __mockBridge.sendToFigmaValidated.mock.calls[0] as [
      string,
      { fills: Array<{ color: { r: number; g: number; b: number } }> }
    ];
    const color = callArgs[1].fills[0].color;
    expect(color.r).toBe(0);
    expect(color.g).toBe(0);
    expect(color.b).toBe(0);
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Connection lost'));

    await expect(setFills({ nodeId: 'node-5', color: '#FF0000', opacity: 1 })).rejects.toThrow(
      'Connection lost'
    );
  });
});

describe('setCornerRadius', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns uniform radius result', async () => {
    const result = await setCornerRadius({ nodeId: 'rect-1', radius: 8 });

    expect(result.nodeId).toBe('rect-1');
    expect(result.isUniform).toBe(true);
    expect(result.cssEquivalent).toBe('border-radius: 8px;');
    expect(result.message).toContain('uniform');
  });

  it('returns individual corner radius result', async () => {
    const result = await setCornerRadius({
      nodeId: 'rect-2',
      topLeft: 16,
      topRight: 16,
      bottomRight: 0,
      bottomLeft: 0
    });

    expect(result.isUniform).toBe(false);
    expect(result.cssEquivalent).toBe('border-radius: 16px 16px 0px 0px;');
    expect(result.message).toContain('TL:16px');
    expect(result.message).toContain('TR:16px');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Figma disconnected'));

    await expect(setCornerRadius({ nodeId: 'rect-3', radius: 4 })).rejects.toThrow(
      'Figma disconnected'
    );
  });
});

describe('setStroke', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns solid stroke result', async () => {
    const result = await setStroke({
      nodeId: 'frame-1',
      strokeWeight: 1,
      strokeColor: '#E0E0E0',
      strokeAlign: 'INSIDE',
      opacity: 1
    });

    expect(result.nodeId).toBe('frame-1');
    expect(result.strokeWeight).toBe(1);
    expect(result.strokeAlign).toBe('INSIDE');
    expect(result.isDashed).toBe(false);
    expect(result.cssEquivalent).toBe('border: 1px solid #E0E0E0;');
    expect(result.message).toContain('solid');
  });

  it('returns dashed stroke result', async () => {
    const result = await setStroke({
      nodeId: 'frame-2',
      strokeWeight: 2,
      strokeColor: '#0066FF',
      strokeAlign: 'CENTER',
      dashPattern: [5, 3],
      opacity: 1
    });

    expect(result.isDashed).toBe(true);
    expect(result.cssEquivalent).toContain('dashed');
    expect(result.cssEquivalent).toContain('CENTER');
  });

  it('generates rgba CSS when opacity < 1', async () => {
    const result = await setStroke({
      nodeId: 'frame-3',
      strokeWeight: 1,
      strokeColor: '#FF0000',
      strokeAlign: 'INSIDE',
      opacity: 0.5
    });

    expect(result.cssEquivalent).toContain('rgba(255, 0, 0, 0.5)');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Timeout'));

    await expect(
      setStroke({
        nodeId: 'frame-4',
        strokeWeight: 1,
        strokeColor: '#000000',
        strokeAlign: 'INSIDE',
        opacity: 1
      })
    ).rejects.toThrow('Timeout');
  });
});

describe('setAppearance', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets opacity and returns correct CSS', async () => {
    const result = await setAppearance({
      nodeId: 'node-1',
      opacity: 0.5
    });

    expect(result.nodeId).toBe('node-1');
    expect(result.applied).toContain('opacity');
    expect(result.cssEquivalent).toBe('opacity: 0.5;');
  });

  it('sets blend mode and clipping together', async () => {
    const result = await setAppearance({
      nodeId: 'node-2',
      blendMode: 'MULTIPLY',
      clipping: { enabled: true, useMask: false }
    });

    expect(result.applied).toContain('blendMode');
    expect(result.applied).toContain('clipping');
    expect(result.cssEquivalent).toContain('mix-blend-mode: multiply;');
    expect(result.cssEquivalent).toContain('overflow: hidden;');
  });

  it('generates mask CSS when useMask is true', async () => {
    const result = await setAppearance({
      nodeId: 'node-3',
      clipping: { enabled: true, useMask: true }
    });

    expect(result.cssEquivalent).toContain('mask-image');
  });

  it('throws when no properties are specified', async () => {
    await expect(setAppearance({ nodeId: 'node-4' })).rejects.toThrow(
      'No appearance properties specified'
    );
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Bridge down'));

    await expect(setAppearance({ nodeId: 'node-5', opacity: 0.8 })).rejects.toThrow('Bridge down');
  });
});

describe('applyEffects', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies drop shadow and returns CSS', async () => {
    const result = await applyEffects({
      nodeId: 'card-1',
      effects: [
        {
          type: 'DROP_SHADOW',
          color: '#000000',
          opacity: 0.25,
          x: 0,
          y: 2,
          blur: 4,
          spread: 0
        }
      ]
    });

    expect(result.nodeId).toBe('card-1');
    expect(result.effectsApplied).toBe(1);
    expect(result.cssEquivalent).toContain('box-shadow:');
    expect(result.cssEquivalent).toContain('rgba(0, 0, 0, 0.25)');
  });

  it('applies layer blur and returns filter CSS', async () => {
    const result = await applyEffects({
      nodeId: 'blur-1',
      effects: [{ type: 'LAYER_BLUR', radius: 8 }]
    });

    expect(result.cssEquivalent).toContain('filter: blur(8px);');
  });

  it('applies background blur and returns backdrop-filter CSS', async () => {
    const result = await applyEffects({
      nodeId: 'glass-1',
      effects: [{ type: 'BACKGROUND_BLUR', radius: 10 }]
    });

    expect(result.cssEquivalent).toContain('backdrop-filter: blur(10px);');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Plugin crashed'));

    await expect(
      applyEffects({
        nodeId: 'fail-1',
        effects: [{ type: 'LAYER_BLUR', radius: 4 }]
      })
    ).rejects.toThrow('Plugin crashed');
  });
});

describe('addGradientFill', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies linear gradient and returns CSS', async () => {
    const result = await addGradientFill({
      nodeId: 'frame-1',
      type: 'LINEAR',
      angle: 45,
      opacity: 1,
      stops: [
        { position: 0, color: '#0066FF', opacity: 1 },
        { position: 1, color: '#9933FF', opacity: 1 }
      ]
    });

    expect(result.nodeId).toBe('frame-1');
    expect(result.type).toBe('LINEAR');
    expect(result.stopCount).toBe(2);
    expect(result.cssEquivalent).toContain('linear-gradient(45deg');
    expect(result.cssEquivalent).toContain('#0066FF 0%');
    expect(result.cssEquivalent).toContain('#9933FF 100%');
  });

  it('applies radial gradient and returns CSS', async () => {
    const result = await addGradientFill({
      nodeId: 'frame-2',
      type: 'RADIAL',
      angle: 0,
      opacity: 1,
      stops: [
        { position: 0, color: '#FFFFFF', opacity: 1 },
        { position: 1, color: '#0066FF', opacity: 1 }
      ]
    });

    expect(result.cssEquivalent).toContain('radial-gradient(circle');
  });

  it('includes opacity in CSS when overall opacity < 1', async () => {
    const result = await addGradientFill({
      nodeId: 'frame-3',
      type: 'LINEAR',
      angle: 0,
      opacity: 0.5,
      stops: [
        { position: 0, color: '#000000', opacity: 1 },
        { position: 1, color: '#FFFFFF', opacity: 1 }
      ]
    });

    expect(result.cssEquivalent).toContain('opacity: 0.5');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Network error'));

    await expect(
      addGradientFill({
        nodeId: 'frame-4',
        type: 'LINEAR',
        angle: 0,
        opacity: 1,
        stops: [
          { position: 0, color: '#000000', opacity: 1 },
          { position: 1, color: '#FFFFFF', opacity: 1 }
        ]
      })
    ).rejects.toThrow('Network error');
  });
});

describe('setImageFill', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies image fill with FILL mode and returns CSS', async () => {
    const result = await setImageFill({
      nodeId: 'rect-1',
      imageUrl: 'https://example.com/photo.jpg',
      scaleMode: 'FILL',
      opacity: 1
    });

    expect(result.nodeId).toBe('rect-1');
    expect(result.imageUrl).toBe('https://example.com/photo.jpg');
    expect(result.scaleMode).toBe('FILL');
    expect(result.opacity).toBe(1);
    expect(result.cssEquivalent).toContain(
      "background-image: url('https://example.com/photo.jpg')"
    );
    expect(result.cssEquivalent).toContain('background-size: cover;');
  });

  it('applies image fill with FIT mode', async () => {
    const result = await setImageFill({
      nodeId: 'rect-2',
      imageUrl: 'https://example.com/logo.png',
      scaleMode: 'FIT',
      opacity: 0.8
    });

    expect(result.cssEquivalent).toContain('background-size: contain;');
    expect(result.opacity).toBe(0.8);
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Image load failed'));

    await expect(
      setImageFill({
        nodeId: 'rect-3',
        imageUrl: 'https://example.com/broken.jpg',
        scaleMode: 'FILL',
        opacity: 1
      })
    ).rejects.toThrow('Image load failed');
  });
});
