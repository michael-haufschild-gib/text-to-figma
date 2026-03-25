/**
 * Style Tools Tests
 *
 * Tests execute functions for: create_color_style, create_text_style,
 * create_effect_style, apply_fill_style, apply_text_style, apply_effect_style
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

const { createColorStyle } = await import('../../mcp-server/src/tools/create_color_style.js');
const { createTextStyle } = await import('../../mcp-server/src/tools/create_text_style.js');
const { createEffectStyle } = await import('../../mcp-server/src/tools/create_effect_style.js');
const { applyFillStyle } = await import('../../mcp-server/src/tools/apply_fill_style.js');
const { applyTextStyle } = await import('../../mcp-server/src/tools/apply_text_style.js');
const { applyEffectStyle } = await import('../../mcp-server/src/tools/apply_effect_style.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigmaWithRetry: ReturnType<typeof vi.fn>;
    sendToFigmaValidated: ReturnType<typeof vi.fn>;
  };
};

describe('createColorStyle', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      styleId: 'style-color-1'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns styleId, name, color, and descriptive message', async () => {
    const result = await createColorStyle({
      name: 'Primary',
      color: '#0066FF',
      description: 'Primary brand color'
    });

    expect(result.styleId).toBe('style-color-1');
    expect(result.name).toBe('Primary');
    expect(result.color).toBe('#0066FF');
    expect(result.message).toBe('Created color style "Primary" (#0066FF)');
  });

  it('sends correct payload to bridge', async () => {
    await createColorStyle({
      name: 'Error',
      color: '#CC0000',
      description: 'Error state color'
    });

    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledWith(
      'create_color_style',
      {
        name: 'Error',
        color: '#CC0000',
        description: 'Error state color'
      },
      expect.anything()
    );
  });

  it('rejects response when bridge returns no styleId', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Required at "styleId"'));

    await expect(
      createColorStyle({
        name: 'Gray/500',
        color: '#6B7280'
      })
    ).rejects.toThrow();
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Style creation failed'));

    await expect(createColorStyle({ name: 'Fail', color: '#000000' })).rejects.toThrow(
      'Style creation failed'
    );
  });
});

describe('createTextStyle', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      styleId: 'style-text-1'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns styleId, name, fontSize, fontWeight, and message', async () => {
    const result = await createTextStyle({
      name: 'H1',
      fontFamily: 'Inter',
      fontSize: 48,
      fontWeight: 700,
      lineHeight: 56,
      textCase: 'ORIGINAL' as const,
      textDecoration: 'NONE' as const,
      description: 'Main heading'
    });

    expect(result.styleId).toBe('style-text-1');
    expect(result.name).toBe('H1');
    expect(result.fontSize).toBe(48);
    expect(result.fontWeight).toBe(700);
    expect(result.message).toBe('Created text style "H1" (48px, 700)');
  });

  it('rejects response when bridge returns no styleId', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Required at "styleId"'));

    await expect(
      createTextStyle({
        name: 'Body',
        fontFamily: 'Inter',
        fontSize: 16,
        fontWeight: 400,
        textCase: 'ORIGINAL' as const,
        textDecoration: 'NONE' as const
      })
    ).rejects.toThrow();
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Font not available'));

    await expect(
      createTextStyle({
        name: 'Fail',
        fontFamily: 'Inter',
        fontSize: 16,
        fontWeight: 400,
        textCase: 'ORIGINAL' as const,
        textDecoration: 'NONE' as const
      })
    ).rejects.toThrow('Font not available');
  });
});

describe('createEffectStyle', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      styleId: 'style-effect-1'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns styleId, name, effectCount, and message', async () => {
    const result = await createEffectStyle({
      name: 'Elevation/2',
      effects: [
        {
          type: 'DROP_SHADOW',
          offsetX: 0,
          offsetY: 4,
          blur: 16,
          spread: 0,
          color: '#000000',
          opacity: 0.08
        }
      ],
      description: 'Card elevation'
    });

    expect(result.styleId).toBe('style-effect-1');
    expect(result.name).toBe('Elevation/2');
    expect(result.effectCount).toBe(1);
    expect(result.message).toBe('Created effect style "Elevation/2" with 1 effect(s)');
  });

  it('counts multiple effects correctly', async () => {
    const result = await createEffectStyle({
      name: 'Complex Shadow',
      effects: [
        { type: 'DROP_SHADOW', blur: 4, offsetX: 0, offsetY: 2 },
        { type: 'DROP_SHADOW', blur: 16, offsetX: 0, offsetY: 8 }
      ]
    });

    expect(result.effectCount).toBe(2);
    expect(result.message).toContain('2 effect(s)');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Effect limit reached'));

    await expect(
      createEffectStyle({
        name: 'Fail',
        effects: [{ type: 'LAYER_BLUR', blur: 8 }]
      })
    ).rejects.toThrow('Effect limit reached');
  });
});

describe('applyFillStyle', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      styleName: 'Primary'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns nodeId, styleName from bridge, and message', async () => {
    const result = await applyFillStyle({
      nodeId: 'button-1',
      styleNameOrId: 'S:abc123'
    });

    expect(result.nodeId).toBe('button-1');
    expect(result.styleName).toBe('Primary');
    expect(result.message).toBe('Applied fill style "Primary" to node');
  });

  it('falls back to styleNameOrId when bridge returns no styleName', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({ success: true });

    const result = await applyFillStyle({
      nodeId: 'frame-1',
      styleNameOrId: 'Error'
    });

    expect(result.styleName).toBe('Error');
    expect(result.message).toBe('Applied fill style "Error" to node');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Style not found'));

    await expect(
      applyFillStyle({ nodeId: 'node-1', styleNameOrId: 'NonExistent' })
    ).rejects.toThrow('Style not found');
  });
});

describe('applyTextStyle', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      styleName: 'H1'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns nodeId, styleName from bridge, and message', async () => {
    const result = await applyTextStyle({
      nodeId: 'heading-1',
      styleNameOrId: 'S:text-style-id'
    });

    expect(result.nodeId).toBe('heading-1');
    expect(result.styleName).toBe('H1');
    expect(result.message).toBe('Applied text style "H1" to text node');
  });

  it('falls back to styleNameOrId when bridge returns no styleName', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({ success: true });

    const result = await applyTextStyle({
      nodeId: 'paragraph-1',
      styleNameOrId: 'Body/Regular'
    });

    expect(result.styleName).toBe('Body/Regular');
    expect(result.message).toBe('Applied text style "Body/Regular" to text node');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Text style not found'));

    await expect(applyTextStyle({ nodeId: 'text-1', styleNameOrId: 'Missing' })).rejects.toThrow(
      'Text style not found'
    );
  });
});

describe('applyEffectStyle', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      styleName: 'Elevation/2'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns nodeId, styleName from bridge, and message', async () => {
    const result = await applyEffectStyle({
      nodeId: 'card-1',
      styleNameOrId: 'S:effect-style-id'
    });

    expect(result.nodeId).toBe('card-1');
    expect(result.styleName).toBe('Elevation/2');
    expect(result.message).toBe('Applied effect style "Elevation/2" to node');
  });

  it('falls back to styleNameOrId when bridge returns no styleName', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({ success: true });

    const result = await applyEffectStyle({
      nodeId: 'button-1',
      styleNameOrId: 'Shadow/Button Hover'
    });

    expect(result.styleName).toBe('Shadow/Button Hover');
    expect(result.message).toBe('Applied effect style "Shadow/Button Hover" to node');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Effect style not found'));

    await expect(
      applyEffectStyle({ nodeId: 'node-1', styleNameOrId: 'NonExistent' })
    ).rejects.toThrow('Effect style not found');
  });
});
