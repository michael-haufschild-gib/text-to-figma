/**
 * Remaining Tools Tests
 *
 * Tests execute functions for: connect_shapes, set_text_properties
 *
 * Each tool section covers:
 * 1. Schema validation (valid, invalid, boundary inputs)
 * 2. Payload verification (what gets sent to the bridge)
 * 3. Response construction (correct CSS, correct messages)
 * 4. Error paths (bridge failures, no-op inputs)
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

const { connectShapes, ConnectShapesInputSchema } =
  await import('../../mcp-server/src/tools/connect_shapes.js');
const { setTextProperties, SetTextPropertiesInputSchema } =
  await import('../../mcp-server/src/tools/set_text_properties.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigma: ReturnType<typeof vi.fn>;
    sendToFigmaWithRetry: ReturnType<typeof vi.fn>;
    sendToFigmaValidated: ReturnType<typeof vi.fn>;
    isConnected: ReturnType<typeof vi.fn>;
    getConnectionStatus: ReturnType<typeof vi.fn>;
  };
};

// ─── ConnectShapesInputSchema ────────────────────────────────────────────────

describe('ConnectShapesInputSchema', () => {
  it('accepts minimal valid input (4 required fields)', () => {
    const result = ConnectShapesInputSchema.safeParse({
      sourceNodeId: 'a',
      targetNodeId: 'b',
      sourceAnchor: 'TOP',
      targetAnchor: 'BOTTOM'
    });
    expect(result.success).toBe(true);
  });

  it('accepts all 9 anchor points on both source and target', () => {
    const anchors = [
      'TOP',
      'TOP_LEFT',
      'TOP_RIGHT',
      'BOTTOM',
      'BOTTOM_LEFT',
      'BOTTOM_RIGHT',
      'LEFT',
      'RIGHT',
      'CENTER'
    ];
    for (const anchor of anchors) {
      const result = ConnectShapesInputSchema.safeParse({
        sourceNodeId: 'a',
        targetNodeId: 'b',
        sourceAnchor: anchor,
        targetAnchor: anchor
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects empty sourceNodeId', () => {
    const result = ConnectShapesInputSchema.safeParse({
      sourceNodeId: '',
      targetNodeId: 'b',
      sourceAnchor: 'TOP',
      targetAnchor: 'BOTTOM'
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid anchor value', () => {
    const result = ConnectShapesInputSchema.safeParse({
      sourceNodeId: 'a',
      targetNodeId: 'b',
      sourceAnchor: 'MIDDLE',
      targetAnchor: 'BOTTOM'
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid method value', () => {
    const result = ConnectShapesInputSchema.safeParse({
      sourceNodeId: 'a',
      targetNodeId: 'b',
      sourceAnchor: 'TOP',
      targetAnchor: 'BOTTOM',
      method: 'MERGE'
    });
    expect(result.success).toBe(false);
  });

  it('accepts all 3 valid methods', () => {
    for (const method of ['POSITION_ONLY', 'POSITION_OVERLAP', 'UNION']) {
      const result = ConnectShapesInputSchema.safeParse({
        sourceNodeId: 'a',
        targetNodeId: 'b',
        sourceAnchor: 'TOP',
        targetAnchor: 'BOTTOM',
        method
      });
      expect(result.success).toBe(true);
    }
  });
});

// ─── connectShapes ───────────────────────────────────────────────────────────

describe('connectShapes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends correct payload to bridge with defaults applied', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({ merged: false, message: 'ok' });

    await connectShapes({
      sourceNodeId: 'head-1',
      targetNodeId: 'neck-1',
      sourceAnchor: 'BOTTOM',
      targetAnchor: 'TOP'
    });

    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledWith(
      'connect_shapes',
      {
        sourceNodeId: 'head-1',
        targetNodeId: 'neck-1',
        sourceAnchor: 'BOTTOM',
        targetAnchor: 'TOP',
        method: 'POSITION_OVERLAP',
        overlap: 5,
        unionResult: true
      },
      expect.anything()
    );
  });

  it('defaults method to POSITION_OVERLAP, overlap to 5, unionResult to true', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({ merged: false, message: 'ok' });

    const result = await connectShapes({
      sourceNodeId: 'head-1',
      targetNodeId: 'neck-1',
      sourceAnchor: 'BOTTOM',
      targetAnchor: 'TOP'
    });

    expect(result.success).toBe(true);
    expect(result.method).toBe('POSITION_OVERLAP');
    expect(result.message).toContain('5px overlap');
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('uses custom overlap value when provided', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({ merged: false, message: 'ok' });

    const result = await connectShapes({
      sourceNodeId: 'a',
      targetNodeId: 'b',
      sourceAnchor: 'BOTTOM',
      targetAnchor: 'TOP',
      overlap: 20
    });

    expect(result.message).toContain('20px overlap');
    const payload = __mockBridge.sendToFigmaValidated.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.overlap).toBe(20);
  });

  it('merged=true changes message format to include newNodeId', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      merged: true,
      newNodeId: 'merged-99',
      message: 'Merged'
    });

    const result = await connectShapes({
      sourceNodeId: 'a',
      targetNodeId: 'b',
      sourceAnchor: 'BOTTOM',
      targetAnchor: 'TOP',
      method: 'UNION',
      overlap: 10
    });

    expect(result.merged).toBe(true);
    expect(result.newNodeId).toBe('merged-99');
    expect(result.message).toContain('merged-99');
    expect(result.message).not.toContain('overlap');
  });

  it('POSITION_ONLY message does not mention overlap', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({ merged: false, message: 'ok' });

    const result = await connectShapes({
      sourceNodeId: 'leg-1',
      targetNodeId: 'body-1',
      sourceAnchor: 'TOP',
      targetAnchor: 'BOTTOM',
      method: 'POSITION_ONLY'
    });

    expect(result.method).toBe('POSITION_ONLY');
    expect(result.message).not.toContain('overlap');
    expect(result.message).toContain('POSITION_ONLY');
  });

  it('bridge response with no merged field defaults merged to false', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({ message: 'done' });

    const result = await connectShapes({
      sourceNodeId: 'a',
      targetNodeId: 'b',
      sourceAnchor: 'LEFT',
      targetAnchor: 'RIGHT'
    });

    expect(result.merged).toBe(false);
    expect(result.newNodeId).toBeUndefined();
  });

  it('unionResult=false is sent when explicitly set', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({ merged: false, message: 'ok' });

    await connectShapes({
      sourceNodeId: 'a',
      targetNodeId: 'b',
      sourceAnchor: 'TOP',
      targetAnchor: 'BOTTOM',
      method: 'UNION',
      unionResult: false
    });

    const payload = __mockBridge.sendToFigmaValidated.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.unionResult).toBe(false);
  });

  it('propagates bridge errors without wrapping', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Node not found'));

    await expect(
      connectShapes({
        sourceNodeId: 'x',
        targetNodeId: 'y',
        sourceAnchor: 'TOP',
        targetAnchor: 'BOTTOM'
      })
    ).rejects.toThrow('Node not found');
  });

  it('propagates non-Error thrown values from bridge', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue('string error');

    await expect(
      connectShapes({
        sourceNodeId: 'x',
        targetNodeId: 'y',
        sourceAnchor: 'TOP',
        targetAnchor: 'BOTTOM'
      })
    ).rejects.toBe('string error');
  });
});

// ─── SetTextPropertiesInputSchema ────────────────────────────────────────────

describe('SetTextPropertiesInputSchema', () => {
  it('requires nodeId', () => {
    expect(SetTextPropertiesInputSchema.safeParse({}).success).toBe(false);
  });

  it('rejects empty nodeId', () => {
    expect(
      SetTextPropertiesInputSchema.safeParse({ nodeId: '', decoration: 'UNDERLINE' }).success
    ).toBe(false);
  });

  it('accepts just nodeId with any single optional property', () => {
    expect(
      SetTextPropertiesInputSchema.safeParse({ nodeId: 'n', decoration: 'UNDERLINE' }).success
    ).toBe(true);
    expect(SetTextPropertiesInputSchema.safeParse({ nodeId: 'n', textCase: 'UPPER' }).success).toBe(
      true
    );
    expect(
      SetTextPropertiesInputSchema.safeParse({ nodeId: 'n', paragraphSpacing: 16 }).success
    ).toBe(true);
  });

  it('rejects invalid decoration value', () => {
    expect(
      SetTextPropertiesInputSchema.safeParse({ nodeId: 'n', decoration: 'BOLD' }).success
    ).toBe(false);
  });

  it('rejects invalid textCase value', () => {
    expect(SetTextPropertiesInputSchema.safeParse({ nodeId: 'n', textCase: 'CAMEL' }).success).toBe(
      false
    );
  });

  it('defaults letterSpacing unit to PERCENT when not provided', () => {
    const result = SetTextPropertiesInputSchema.safeParse({
      nodeId: 'n',
      letterSpacing: { value: 5 }
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.letterSpacing?.unit).toBe('PERCENT');
    }
  });

  it('accepts negative paragraphIndent (hanging indent)', () => {
    const result = SetTextPropertiesInputSchema.safeParse({
      nodeId: 'n',
      paragraphIndent: -20
    });
    expect(result.success).toBe(true);
  });
});

// ─── setTextProperties ──────────────────────────────────────────────────────

describe('setTextProperties', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaWithRetry.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends correct payload to bridge with all properties', async () => {
    await setTextProperties({
      nodeId: 'text-1',
      decoration: 'UNDERLINE',
      textCase: 'UPPER',
      letterSpacing: { value: 10, unit: 'PERCENT' },
      paragraphSpacing: 16,
      paragraphIndent: 24
    });

    expect(__mockBridge.sendToFigmaWithRetry).toHaveBeenCalledWith('set_text_properties', {
      nodeId: 'text-1',
      decoration: 'UNDERLINE',
      textCase: 'UPPER',
      letterSpacing: { value: 10, unit: 'PERCENT' },
      paragraphSpacing: 16,
      paragraphIndent: 24
    });
  });

  it('only includes specified properties in bridge payload (no undefined keys)', async () => {
    await setTextProperties({ nodeId: 'text-1', decoration: 'UNDERLINE' });

    const payload = __mockBridge.sendToFigmaWithRetry.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(payload)).toEqual(['nodeId', 'decoration']);
    expect(payload).not.toHaveProperty('textCase');
    expect(payload).not.toHaveProperty('letterSpacing');
  });

  it('applies multiple text properties and returns CSS equivalents', async () => {
    const result = await setTextProperties({
      nodeId: 'text-1',
      decoration: 'UNDERLINE',
      textCase: 'UPPER',
      letterSpacing: { value: 10, unit: 'PERCENT' }
    });

    expect(result.nodeId).toBe('text-1');
    expect(result.applied).toEqual(['decoration', 'letterSpacing', 'textCase']);
    expect(result.cssEquivalent).toContain('text-decoration: underline;');
    expect(result.cssEquivalent).toContain('text-transform: uppercase;');
    expect(result.cssEquivalent).toContain('letter-spacing: 0.1em;');
  });

  it('generates correct CSS for all 4 textCase values', async () => {
    const cases: Array<[string, string]> = [
      ['UPPER', 'uppercase'],
      ['LOWER', 'lowercase'],
      ['TITLE', 'capitalize'],
      ['ORIGINAL', 'none']
    ];

    for (const [figmaCase, cssValue] of cases) {
      __mockBridge.sendToFigmaWithRetry.mockResolvedValue(undefined);
      const result = await setTextProperties({
        nodeId: 'n',
        textCase: figmaCase as 'UPPER' | 'LOWER' | 'TITLE' | 'ORIGINAL'
      });
      expect(result.cssEquivalent).toBe(`text-transform: ${cssValue};`);
    }
  });

  it('computes letter-spacing in pixels vs em correctly', async () => {
    const pixelResult = await setTextProperties({
      nodeId: 'n',
      letterSpacing: { value: 2, unit: 'PIXELS' }
    });
    expect(pixelResult.cssEquivalent).toBe('letter-spacing: 2px;');

    const pctResult = await setTextProperties({
      nodeId: 'n',
      letterSpacing: { value: 50, unit: 'PERCENT' }
    });
    expect(pctResult.cssEquivalent).toBe('letter-spacing: 0.5em;');
  });

  it('handles zero letter-spacing value', async () => {
    const result = await setTextProperties({
      nodeId: 'n',
      letterSpacing: { value: 0, unit: 'PERCENT' }
    });
    expect(result.cssEquivalent).toBe('letter-spacing: 0em;');
  });

  it('handles negative paragraph indent (hanging indent)', async () => {
    const result = await setTextProperties({
      nodeId: 'n',
      paragraphIndent: -20
    });
    expect(result.cssEquivalent).toContain('text-indent: -20px;');
  });

  it('returns applied array in the order properties are processed', async () => {
    const result = await setTextProperties({
      nodeId: 'n',
      paragraphSpacing: 16,
      decoration: 'NONE',
      paragraphIndent: 10
    });
    // Production code processes: decoration, letterSpacing, textCase, paragraphSpacing, paragraphIndent
    expect(result.applied).toEqual(['decoration', 'paragraphSpacing', 'paragraphIndent']);
  });

  it('throws descriptive error when no properties are specified', async () => {
    await expect(setTextProperties({ nodeId: 'text-5' })).rejects.toThrow(
      'No text properties specified'
    );
    // Bridge should NOT have been called
    expect(__mockBridge.sendToFigmaWithRetry).not.toHaveBeenCalled();
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaWithRetry.mockRejectedValue(new Error('Not a text node'));

    await expect(setTextProperties({ nodeId: 'rect-1', decoration: 'UNDERLINE' })).rejects.toThrow(
      'Not a text node'
    );
  });
});
