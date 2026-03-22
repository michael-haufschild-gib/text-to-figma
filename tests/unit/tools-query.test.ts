/**
 * Query Tools Tests
 *
 * Tests execute functions for: get_node_by_id, get_node_by_name, get_children,
 * get_parent, get_page_hierarchy, get_selection, get_absolute_bounds, get_relative_bounds
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetNodeRegistry, getNodeRegistry } from '../../mcp-server/src/node-registry.js';

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
    getFigmaBridge: () => mockBridge,
    FigmaBridge: vi.fn(() => mockBridge),
    __mockBridge: mockBridge
  };
});

const { getNodeById } = await import('../../mcp-server/src/tools/get_node_by_id.js');
const { getNodeByName } = await import('../../mcp-server/src/tools/get_node_by_name.js');
const { getChildren } = await import('../../mcp-server/src/tools/get_children.js');
const { getParent } = await import('../../mcp-server/src/tools/get_parent.js');
const { getPageHierarchy } = await import('../../mcp-server/src/tools/get_page_hierarchy.js');
const { getSelection } = await import('../../mcp-server/src/tools/get_selection.js');
const { getAbsoluteBounds } = await import('../../mcp-server/src/tools/get_absolute_bounds.js');
const { getRelativeBounds } = await import('../../mcp-server/src/tools/get_relative_bounds.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigma: ReturnType<typeof vi.fn>;
    sendToFigmaWithRetry: ReturnType<typeof vi.fn>;
    sendToFigmaValidated: ReturnType<typeof vi.fn>;
  };
};

describe('getNodeById', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns node info when node exists', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      exists: true,
      node: {
        id: '1:42',
        name: 'Header Frame',
        type: 'FRAME',
        width: 400,
        height: 60,
        x: 0,
        y: 0,
        parentId: '0:1',
        childrenCount: 3
      }
    });

    const result = await getNodeById({ nodeId: '1:42' });

    expect(result.success).toBe(true);
    expect(result.nodeId).toBe('1:42');
    expect(result.name).toBe('Header Frame');
    expect(result.type).toBe('FRAME');
    expect(result.width).toBe(400);
    expect(result.height).toBe(60);
    expect(result.parentId).toBe('0:1');
    expect(result.childrenCount).toBe(3);
    expect(result.message).toContain('FRAME');
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('throws when node does not exist', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      exists: false,
      error: 'Node not found'
    });

    await expect(getNodeById({ nodeId: 'missing-1' })).rejects.toThrow('Node not found');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Connection refused'));

    await expect(getNodeById({ nodeId: '1:42' })).rejects.toThrow('Connection refused');
  });
});

describe('getNodeByName', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns matching nodes on success', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      nodes: [
        { nodeId: '1:10', name: 'Button Primary', type: 'FRAME', parentId: '0:1' },
        { nodeId: '1:20', name: 'Button Secondary', type: 'FRAME', parentId: '0:1' }
      ]
    });

    const result = await getNodeByName({ name: 'Button', findAll: true, exactMatch: false });

    expect(result.found).toBe(2);
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0].nodeId).toBe('1:10');
    expect(result.message).toContain('partial');
    expect(result.message).toContain('all matches');
  });

  it('returns empty array when no matches found', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      nodes: []
    });

    const result = await getNodeByName({ name: 'NonExistent', findAll: false, exactMatch: true });

    expect(result.found).toBe(0);
    expect(result.nodes).toHaveLength(0);
    expect(result.message).toContain('exact');
    expect(result.message).toContain('first match');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Timeout'));

    await expect(
      getNodeByName({ name: 'Test', findAll: false, exactMatch: false })
    ).rejects.toThrow('Timeout');
  });
});

describe('getChildren', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns direct children', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      children: [
        { nodeId: '2:1', name: 'Title', type: 'TEXT', visible: true, locked: false },
        { nodeId: '2:2', name: 'Subtitle', type: 'TEXT', visible: true, locked: false },
        { nodeId: '2:3', name: 'Image', type: 'RECTANGLE', visible: false, locked: true }
      ]
    });

    const result = await getChildren({ nodeId: '1:1', recursive: false });

    expect(result.nodeId).toBe('1:1');
    expect(result.childCount).toBe(3);
    expect(result.children).toHaveLength(3);
    expect(result.children[2].visible).toBe(false);
    expect(result.children[2].locked).toBe(true);
    expect(result.message).toContain('direct children');
  });

  it('returns descendants when recursive is true', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      children: [
        { nodeId: '2:1', name: 'Child', type: 'FRAME', visible: true, locked: false },
        { nodeId: '3:1', name: 'Grandchild', type: 'TEXT', visible: true, locked: false }
      ]
    });

    const result = await getChildren({ nodeId: '1:1', recursive: true });

    expect(result.childCount).toBe(2);
    expect(result.message).toContain('descendants');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Node not found'));

    await expect(getChildren({ nodeId: 'bad-id', recursive: false })).rejects.toThrow(
      'Node not found'
    );
  });
});

describe('getParent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parent info when parent exists', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      parent: { id: '0:1', name: 'Page 1', type: 'PAGE' }
    });

    const result = await getParent({ nodeId: '1:42' });

    expect(result.nodeId).toBe('1:42');
    expect(result.parentId).toBe('0:1');
    expect(result.parentName).toBe('Page 1');
    expect(result.parentType).toBe('PAGE');
    expect(result.message).toContain('Page 1');
  });

  it('returns no parent for root nodes', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true
      // no parent field
    });

    const result = await getParent({ nodeId: 'root-1' });

    expect(result.nodeId).toBe('root-1');
    expect(result.parentId).toBeUndefined();
    expect(result.message).toContain('no parent');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Disconnected'));

    await expect(getParent({ nodeId: '1:42' })).rejects.toThrow('Disconnected');
  });
});

describe('getPageHierarchy', () => {
  beforeEach(() => {
    resetNodeRegistry();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns cached hierarchy when refresh is false', async () => {
    // Pre-populate registry
    const registry = getNodeRegistry();
    registry.register('1:1', {
      type: 'FRAME',
      name: 'TestFrame',
      parentId: null,
      children: [],
      bounds: { x: 0, y: 0, width: 100, height: 100 }
    });

    const result = await getPageHierarchy({ refresh: false });

    expect(result.source).toBe('cache');
    expect(result.stats.totalNodes).toBe(1);
    // Bridge should NOT have been called
    expect(__mockBridge.sendToFigmaValidated).not.toHaveBeenCalled();
  });

  it('refreshes from Figma when refresh is true', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      hierarchy: [
        {
          nodeId: '1:1',
          type: 'FRAME',
          name: 'Root',
          bounds: { x: 0, y: 0, width: 800, height: 600 },
          children: [
            {
              nodeId: '2:1',
              type: 'TEXT',
              name: 'Title',
              bounds: { x: 10, y: 10, width: 200, height: 24 },
              children: []
            }
          ]
        }
      ],
      pageId: '0:1',
      pageName: 'Page 1'
    });

    const result = await getPageHierarchy({ refresh: true });

    expect(result.source).toBe('figma');
    expect(result.hierarchy).toHaveLength(1);
    expect(result.hierarchy[0].name).toBe('Root');
    // Registry should now contain both nodes
    expect(result.stats.totalNodes).toBe(2);
  });

  it('propagates bridge errors on refresh', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Plugin not connected'));

    await expect(getPageHierarchy({ refresh: true })).rejects.toThrow('Plugin not connected');
  });
});

describe('getSelection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns selected nodes', async () => {
    const selectionData = {
      selection: [
        {
          nodeId: '1:42',
          type: 'FRAME',
          name: 'Button',
          bounds: { x: 0, y: 0, width: 120, height: 40 },
          cornerRadius: 8,
          fills: [{ type: 'SOLID', color: { r: 0.15, g: 0.93, b: 1 } }]
        }
      ],
      count: 1
    };
    __mockBridge.sendToFigmaValidated.mockResolvedValue(selectionData);

    const result = await getSelection({});

    expect(result.count).toBe(1);
    expect(result.selection).toHaveLength(1);
    expect(result.selection[0].name).toBe('Button');
    expect(result.selection[0].cornerRadius).toBe(8);
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('No selection'));

    await expect(getSelection({})).rejects.toThrow('No selection');
  });
});

describe('getAbsoluteBounds', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns bounds for a node', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      nodeId: '1:42',
      bounds: { x: 100, y: 200, width: 300, height: 150 },
      message: 'Bounds retrieved'
    });

    const result = await getAbsoluteBounds({ nodeId: '1:42' });

    expect(result.success).toBe(true);
    expect(result.nodeId).toBe('1:42');
    expect(result.bounds.x).toBe(100);
    expect(result.bounds.y).toBe(200);
    expect(result.bounds.width).toBe(300);
    expect(result.bounds.height).toBe(150);
    expect(result.message).toContain('100');
    expect(result.message).toContain('300');
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Node deleted'));

    await expect(getAbsoluteBounds({ nodeId: 'gone-1' })).rejects.toThrow('Node deleted');
  });
});

describe('getRelativeBounds', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns relative positioning data', async () => {
    const relativeBounds = {
      relativeX: 50,
      relativeY: -10,
      distanceFromRight: 150,
      distanceFromLeft: 50,
      distanceFromTop: -10,
      distanceFromBottom: 90,
      centerDistanceX: 100,
      centerDistanceY: 40,
      width: 80,
      height: 60,
      referencePoints: {
        topLeft: { x: 0, y: 0 },
        topCenter: { x: 100, y: 0 },
        topRight: { x: 200, y: 0 },
        centerLeft: { x: 0, y: 50 },
        center: { x: 100, y: 50 },
        centerRight: { x: 200, y: 50 },
        bottomLeft: { x: 0, y: 100 },
        bottomCenter: { x: 100, y: 100 },
        bottomRight: { x: 200, y: 100 }
      }
    };

    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      relativeBounds,
      message: 'Relative bounds calculated'
    });

    const result = await getRelativeBounds({
      targetNodeId: 'target-1',
      referenceNodeId: 'ref-1'
    });

    expect(result.success).toBe(true);
    expect(result.targetNodeId).toBe('target-1');
    expect(result.referenceNodeId).toBe('ref-1');
    expect(result.relativeBounds.relativeX).toBe(50);
    expect(result.relativeBounds.relativeY).toBe(-10);
    expect(result.relativeBounds.referencePoints.center.x).toBe(100);
    expect(result.message).toContain('50.0');
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Target node missing'));

    await expect(
      getRelativeBounds({ targetNodeId: 'bad', referenceNodeId: 'ref' })
    ).rejects.toThrow('Target node missing');
  });
});
