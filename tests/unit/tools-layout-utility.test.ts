/**
 * Layout & Utility Tools Tests
 *
 * Tests execute functions for: set_layout_properties, set_layout_align,
 * set_layout_sizing, set_constraints, set_layer_order, align_nodes, distribute_nodes
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

const { setLayoutProperties } = await import('../../mcp-server/src/tools/set_layout_properties.js');
const { setLayoutAlign } = await import('../../mcp-server/src/tools/set_layout_align.js');
const { setLayoutSizing } = await import('../../mcp-server/src/tools/set_layout_sizing.js');
const { setConstraints } = await import('../../mcp-server/src/tools/set_constraints.js');
const { setLayerOrder } = await import('../../mcp-server/src/tools/set_layer_order.js');
const { alignNodes } = await import('../../mcp-server/src/tools/align_nodes.js');
const { distributeNodes } = await import('../../mcp-server/src/tools/distribute_nodes.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigmaWithRetry: ReturnType<typeof vi.fn>;
    sendToFigmaValidated: ReturnType<typeof vi.fn>;
  };
};

describe('setLayoutProperties', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates layout mode and returns CSS', async () => {
    const result = await setLayoutProperties({
      nodeId: 'frame-1',
      layoutMode: 'HORIZONTAL'
    });

    expect(result.nodeId).toBe('frame-1');
    expect(result.updated).toContain('layoutMode');
    expect(result.cssEquivalent).toContain('display: flex;');
    expect(result.cssEquivalent).toContain('flex-direction: row;');
  });

  it('updates multiple properties', async () => {
    const result = await setLayoutProperties({
      nodeId: 'frame-2',
      layoutMode: 'VERTICAL',
      itemSpacing: 24,
      padding: 16,
      width: 400,
      height: 300
    });

    expect(result.updated).toContain('layoutMode');
    expect(result.updated).toContain('itemSpacing');
    expect(result.updated).toContain('padding');
    expect(result.updated).toContain('width');
    expect(result.updated).toContain('height');
    expect(result.cssEquivalent).toContain('flex-direction: column;');
    expect(result.cssEquivalent).toContain('gap: 24px;');
    expect(result.cssEquivalent).toContain('padding: 16px;');
    expect(result.cssEquivalent).toContain('width: 400px;');
  });

  it('generates block CSS for NONE layout mode', async () => {
    const result = await setLayoutProperties({
      nodeId: 'frame-3',
      layoutMode: 'NONE'
    });

    expect(result.cssEquivalent).toContain('display: block;');
    expect(result.cssEquivalent).toContain('position: relative;');
  });

  it('generates individual padding CSS when paddingTop/Right/Bottom/Left are specified', async () => {
    const result = await setLayoutProperties({
      nodeId: 'frame-pad',
      paddingTop: 8,
      paddingRight: 16,
      paddingBottom: 24,
      paddingLeft: 32
    });

    expect(result.updated).toContain('paddingTop');
    expect(result.updated).toContain('paddingRight');
    expect(result.updated).toContain('paddingBottom');
    expect(result.updated).toContain('paddingLeft');
    expect(result.cssEquivalent).toContain('padding: 8px 16px 24px 32px;');
  });

  it('throws when no properties are specified', async () => {
    await expect(setLayoutProperties({ nodeId: 'frame-4' })).rejects.toThrow(
      'No properties specified'
    );
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Bridge error'));

    await expect(
      setLayoutProperties({ nodeId: 'frame-5', layoutMode: 'VERTICAL' })
    ).rejects.toThrow('Bridge error');
  });
});

describe('setLayoutAlign', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets both axes and returns CSS', async () => {
    const result = await setLayoutAlign({
      nodeId: 'card-1',
      primaryAxis: 'CENTER',
      counterAxis: 'CENTER'
    });

    expect(result.nodeId).toBe('card-1');
    expect(result.primaryAxis).toBe('CENTER');
    expect(result.counterAxis).toBe('CENTER');
    expect(result.cssEquivalent).toContain('justify-content: center');
    expect(result.cssEquivalent).toContain('align-items: center');
  });

  it('sets SPACE_BETWEEN on primary axis', async () => {
    const result = await setLayoutAlign({
      nodeId: 'nav-1',
      primaryAxis: 'SPACE_BETWEEN'
    });

    expect(result.cssEquivalent).toContain('justify-content: space-between');
  });

  it('throws when neither axis is specified', async () => {
    await expect(setLayoutAlign({ nodeId: 'card-2' })).rejects.toThrow(
      'Must specify at least one of primaryAxis or counterAxis'
    );
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Plugin crashed'));

    await expect(setLayoutAlign({ nodeId: 'card-3', primaryAxis: 'MIN' })).rejects.toThrow(
      'Plugin crashed'
    );
  });
});

describe('setLayoutSizing', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets horizontal HUG and vertical FILL', async () => {
    const result = await setLayoutSizing({
      nodeId: 'btn-1',
      horizontal: 'HUG',
      vertical: 'FILL'
    });

    expect(result.nodeId).toBe('btn-1');
    expect(result.horizontal).toBe('HUG');
    expect(result.vertical).toBe('FILL');
    expect(result.cssEquivalent).toContain('width: fit-content');
    expect(result.cssEquivalent).toContain('align-self: stretch');
  });

  it('sets FIXED sizing with correct CSS', async () => {
    const result = await setLayoutSizing({
      nodeId: 'avatar-1',
      horizontal: 'FIXED',
      vertical: 'FIXED'
    });

    expect(result.cssEquivalent).toContain('width: [fixed]px');
    expect(result.cssEquivalent).toContain('height: [fixed]px');
  });

  it('sets horizontal FILL with flex CSS', async () => {
    const result = await setLayoutSizing({
      nodeId: 'card-1',
      horizontal: 'FILL'
    });

    expect(result.cssEquivalent).toContain('flex: 1');
  });

  it('sets layoutPositioning to ABSOLUTE', async () => {
    const result = await setLayoutSizing({
      nodeId: 'badge-1',
      layoutPositioning: 'ABSOLUTE'
    });

    expect(result.nodeId).toBe('badge-1');
    expect(result.layoutPositioning).toBe('ABSOLUTE');
    expect(result.cssEquivalent).toContain('position: absolute');
    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledWith(
      'set_layout_sizing',
      {
        nodeId: 'badge-1',
        horizontal: undefined,
        vertical: undefined,
        layoutPositioning: 'ABSOLUTE'
      },
      expect.anything()
    );
  });

  it('sets layoutPositioning to AUTO', async () => {
    const result = await setLayoutSizing({
      nodeId: 'item-1',
      layoutPositioning: 'AUTO'
    });

    expect(result.layoutPositioning).toBe('AUTO');
    expect(result.cssEquivalent).toContain('position: relative');
  });

  it('throws when no property is specified', async () => {
    await expect(setLayoutSizing({ nodeId: 'node-1' })).rejects.toThrow(
      'Must specify at least one of horizontal, vertical, or layoutPositioning'
    );
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Timeout'));

    await expect(setLayoutSizing({ nodeId: 'node-2', horizontal: 'FILL' })).rejects.toThrow(
      'Timeout'
    );
  });
});

describe('setConstraints', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({ nodeId: 'node-1' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets horizontal CENTER constraint', async () => {
    const result = await setConstraints({
      nodeId: 'node-1',
      horizontal: 'CENTER'
    });

    expect(result.nodeId).toBe('node-1');
    expect(result.applied).toContain('horizontal: CENTER');
    expect(result.cssEquivalent).toContain('left: 50%;');
    expect(result.cssEquivalent).toContain('translateX(-50%)');
    expect(result.description).toContain('centered horizontally');
  });

  it('auto-enables pins for STRETCH constraint', async () => {
    const result = await setConstraints({
      nodeId: 'node-2',
      horizontal: 'STRETCH'
    });

    expect(result.applied).toContain('horizontal: STRETCH');
    expect(result.applied).toContain('pinLeft');
    expect(result.applied).toContain('pinRight');
    expect(result.description).toContain('stretches horizontally');
  });

  it('auto-sets STRETCH when both pins are provided', async () => {
    const result = await setConstraints({
      nodeId: 'node-3',
      pinLeft: true,
      pinRight: true
    });

    expect(result.applied).toContain('horizontal: STRETCH');
  });

  it('locks aspect ratio', async () => {
    const result = await setConstraints({
      nodeId: 'node-4',
      horizontal: 'SCALE',
      vertical: 'SCALE',
      aspectRatioLocked: true
    });

    expect(result.applied).toContain('aspectRatioLocked');
    expect(result.cssEquivalent).toContain('aspect-ratio');
    expect(result.description).toContain('aspect ratio locked');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Figma error'));

    await expect(setConstraints({ nodeId: 'node-5', horizontal: 'MIN' })).rejects.toThrow(
      'Figma error'
    );
  });

  it('auto-enables vertical pins for STRETCH constraint', async () => {
    const result = await setConstraints({
      nodeId: 'node-6',
      vertical: 'STRETCH'
    });

    expect(result.applied).toContain('vertical: STRETCH');
    expect(result.applied).toContain('pinTop');
    expect(result.applied).toContain('pinBottom');
    expect(result.description).toContain('stretches vertically');
  });

  it('auto-sets vertical STRETCH when both pinTop and pinBottom are provided', async () => {
    const result = await setConstraints({
      nodeId: 'node-7',
      pinTop: true,
      pinBottom: true
    });

    expect(result.applied).toContain('vertical: STRETCH');
    expect(result.applied).toContain('pinTop');
    expect(result.applied).toContain('pinBottom');
  });

  it('includes pinTop and pinBottom in applied list when set explicitly', async () => {
    const result = await setConstraints({
      nodeId: 'node-8',
      vertical: 'MIN',
      pinTop: true,
      pinBottom: true
    });

    expect(result.applied).toContain('vertical: MIN');
    expect(result.applied).toContain('pinTop');
    expect(result.applied).toContain('pinBottom');
  });

  it('generates correct CSS for vertical CENTER constraint', async () => {
    const result = await setConstraints({
      nodeId: 'node-9',
      vertical: 'CENTER'
    });

    expect(result.cssEquivalent).toContain('top: 50%');
    expect(result.cssEquivalent).toContain('translateY(-50%)');
    expect(result.description).toContain('centered vertically');
  });

  it('generates combined transform for both CENTER constraints', async () => {
    const result = await setConstraints({
      nodeId: 'node-10',
      horizontal: 'CENTER',
      vertical: 'CENTER'
    });

    expect(result.cssEquivalent).toContain('translate(-50%, -50%)');
    expect(result.cssEquivalent).toContain('left: 50%');
    expect(result.cssEquivalent).toContain('top: 50%');
  });

  it('returns no-constraints description when nothing is set', async () => {
    const result = await setConstraints({
      nodeId: 'node-11'
    });

    expect(result.description).toBe('No constraints applied');
    expect(result.applied).toEqual([]);
  });
});

describe('setLayerOrder', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('brings node to front and returns new index', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      newIndex: 5,
      message: 'Moved to front'
    });

    const result = await setLayerOrder({
      nodeId: 'mane-1',
      action: 'BRING_TO_FRONT'
    });

    expect(result.success).toBe(true);
    expect(result.data.nodeId).toBe('mane-1');
    expect(result.data.action).toBe('BRING_TO_FRONT');
    expect(result.data.newIndex).toBe(5);
    expect(result.message).toContain('BRING_TO_FRONT');
  });

  it('sets specific index', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      newIndex: 2,
      message: 'Index set'
    });

    const result = await setLayerOrder({
      nodeId: 'tail-1',
      action: 'SET_INDEX',
      index: 2
    });

    expect(result.data.newIndex).toBe(2);
  });

  it('throws when SET_INDEX is used without index', async () => {
    await expect(setLayerOrder({ nodeId: 'node-1', action: 'SET_INDEX' })).rejects.toThrow(
      'index is required when action is SET_INDEX'
    );
  });

  it('wraps bridge errors with context', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Node locked'));

    await expect(setLayerOrder({ nodeId: 'locked-1', action: 'BRING_TO_FRONT' })).rejects.toThrow(
      'Failed to set layer order for node locked-1: Node locked'
    );
  });
});

describe('alignNodes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('aligns nodes to top edge', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      message: 'Aligned'
    });

    const result = await alignNodes({
      nodeIds: ['leg1', 'leg2', 'leg3'],
      alignment: 'TOP',
      alignTo: 'FIRST'
    });

    expect(result.success).toBe(true);
    expect(result.data.nodeIds).toEqual(['leg1', 'leg2', 'leg3']);
    expect(result.data.alignment).toBe('TOP');
    expect(result.data.alignedTo).toBe('FIRST');
    expect(result.message).toContain('3 nodes');
    expect(result.message).toContain('TOP');
  });

  it('defaults alignTo to SELECTION_BOUNDS', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({ message: 'Aligned' });

    const result = await alignNodes({
      nodeIds: ['a', 'b'],
      alignment: 'CENTER_H'
    });

    expect(result.data.alignedTo).toBe('SELECTION_BOUNDS');
  });

  it('wraps bridge errors with context', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Nodes not found'));

    await expect(alignNodes({ nodeIds: ['a', 'b'], alignment: 'LEFT' })).rejects.toThrow(
      'Failed to align nodes: Nodes not found'
    );
  });

  it('throws when fewer than 2 nodeIds are provided', async () => {
    await expect(alignNodes({ nodeIds: ['only-one'], alignment: 'LEFT' })).rejects.toThrow(
      'Must provide at least 2 nodes to align'
    );
  });
});

describe('distributeNodes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('distributes nodes horizontally with SPACING method', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      spacing: 20,
      message: 'Distributed'
    });

    const result = await distributeNodes({
      nodeIds: ['n1', 'n2', 'n3'],
      axis: 'HORIZONTAL'
    });

    expect(result.success).toBe(true);
    expect(result.data.nodeIds).toEqual(['n1', 'n2', 'n3']);
    expect(result.data.axis).toBe('HORIZONTAL');
    expect(result.data.method).toBe('SPACING');
    expect(result.data.spacing).toBe(20);
    expect(result.message).toContain('3 nodes');
  });

  it('distributes with custom spacing', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      message: 'Distributed'
    });

    const result = await distributeNodes({
      nodeIds: ['a', 'b', 'c'],
      axis: 'VERTICAL',
      method: 'SPACING',
      spacing: 16
    });

    expect(result.data.spacing).toBe(16);
    expect(result.data.axis).toBe('VERTICAL');
  });

  it('distributes with CENTERS method', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      message: 'Distributed'
    });

    const result = await distributeNodes({
      nodeIds: ['s1', 's2', 's3', 's4'],
      axis: 'HORIZONTAL',
      method: 'CENTERS'
    });

    expect(result.data.method).toBe('CENTERS');
    expect(result.message).toContain('CENTERS');
  });

  it('wraps bridge errors with context', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Invalid nodes'));

    await expect(distributeNodes({ nodeIds: ['a', 'b', 'c'], axis: 'HORIZONTAL' })).rejects.toThrow(
      'Failed to distribute nodes: Invalid nodes'
    );
  });

  it('throws when fewer than 3 nodeIds are provided', async () => {
    await expect(distributeNodes({ nodeIds: ['a', 'b'], axis: 'HORIZONTAL' })).rejects.toThrow(
      'Must provide at least 3 nodes to distribute'
    );
  });
});
