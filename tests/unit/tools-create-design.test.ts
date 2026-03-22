/**
 * create_design Tool Tests
 *
 * Tests execute function behavior: batch creation, auto-correction, response
 * validation (type guard), node registry integration, and error handling
 * (returns { success: false } instead of throwing).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, resetConfig } from '../../mcp-server/src/config.js';
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
    FigmaBridgeError: class extends Error {
      constructor(msg: string) {
        super(typeof msg === 'string' ? msg : 'bridge error');
        this.name = 'FigmaBridgeError';
      }
    },
    __mockBridge: mockBridge
  };
});

const { createDesign } = await import('../../mcp-server/src/tools/create_design.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigmaWithRetry: ReturnType<typeof vi.fn>;
  };
};

/** Helper: build a valid Figma response matching FigmaCreateDesignResponse */
function validResponse(overrides: Record<string, unknown> = {}) {
  return {
    rootNodeId: '10:1',
    nodeIds: { Button: '10:1', Label: '10:2' },
    totalNodes: 2,
    message: 'Created 2 nodes',
    nodes: [
      {
        nodeId: '10:1',
        type: 'FRAME',
        name: 'Button',
        parentId: null,
        bounds: { x: 0, y: 0, width: 200, height: 48 }
      },
      {
        nodeId: '10:2',
        type: 'TEXT',
        name: 'Label',
        parentId: '10:1',
        bounds: { x: 16, y: 12, width: 100, height: 24 }
      }
    ],
    ...overrides
  };
}

const { CreateDesignInputSchema } = await import('../../mcp-server/src/tools/create_design.js');

describe('CreateDesignInputSchema', () => {
  it('accepts a minimal spec with just type', () => {
    const result = CreateDesignInputSchema.safeParse({
      spec: { type: 'frame' }
    });
    expect(result.success).toBe(true);
  });

  it('accepts deeply nested children (5 levels)', () => {
    const result = CreateDesignInputSchema.safeParse({
      spec: {
        type: 'frame',
        name: 'L0',
        children: [
          {
            type: 'frame',
            name: 'L1',
            children: [
              {
                type: 'frame',
                name: 'L2',
                children: [
                  {
                    type: 'frame',
                    name: 'L3',
                    children: [{ type: 'text', name: 'L4', props: { content: 'deep' } }]
                  }
                ]
              }
            ]
          }
        ]
      }
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid type in spec', () => {
    const result = CreateDesignInputSchema.safeParse({
      spec: { type: 'image' }
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid type in nested child', () => {
    const result = CreateDesignInputSchema.safeParse({
      spec: {
        type: 'frame',
        children: [{ type: 'button' }]
      }
    });
    expect(result.success).toBe(false);
  });

  it('accepts spec with empty children array', () => {
    const result = CreateDesignInputSchema.safeParse({
      spec: { type: 'frame', children: [] }
    });
    expect(result.success).toBe(true);
  });

  it('accepts spec with props as arbitrary record', () => {
    const result = CreateDesignInputSchema.safeParse({
      spec: {
        type: 'text',
        props: { content: 'Hello', fontSize: 16, customProp: true }
      }
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional parentId', () => {
    const result = CreateDesignInputSchema.safeParse({
      spec: { type: 'frame' },
      parentId: 'existing-frame-1'
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parentId).toBe('existing-frame-1');
    }
  });

  it('accepts optional autoCorrect flag', () => {
    const result = CreateDesignInputSchema.safeParse({
      spec: { type: 'frame' },
      autoCorrect: false
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.autoCorrect).toBe(false);
    }
  });

  it('rejects missing spec', () => {
    const result = CreateDesignInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects spec as string', () => {
    const result = CreateDesignInputSchema.safeParse({ spec: 'not an object' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid node types', () => {
    for (const type of ['frame', 'text', 'ellipse', 'rectangle', 'line']) {
      const result = CreateDesignInputSchema.safeParse({
        spec: { type, name: `Test ${type}` }
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('createDesign', () => {
  beforeEach(() => {
    loadConfig();
    resetNodeRegistry();
    __mockBridge.sendToFigmaWithRetry.mockResolvedValue(validResponse());
  });

  afterEach(() => {
    resetConfig();
    vi.restoreAllMocks();
  });

  it('returns success with node IDs on valid response', async () => {
    const result = await createDesign({
      spec: {
        type: 'frame',
        name: 'Button',
        props: { layoutMode: 'HORIZONTAL', padding: 16, itemSpacing: 8 },
        children: [{ type: 'text', name: 'Label', props: { content: 'Click Me', fontSize: 16 } }]
      }
    });

    expect(result.success).toBe(true);
    expect(result.rootNodeId).toBe('10:1');
    expect(result.nodeIds).toEqual({ Button: '10:1', Label: '10:2' });
    expect(result.totalNodes).toBe(2);
    expect(result.message).toBe('Created 2 nodes');
  });

  it('registers all nodes from response in NodeRegistry', async () => {
    await createDesign({
      spec: {
        type: 'frame',
        name: 'Container',
        children: [{ type: 'text', name: 'Text' }]
      }
    });

    const registry = getNodeRegistry();

    const frameNode = registry.getNode('10:1');
    expect(frameNode?.type).toBe('FRAME');
    expect(frameNode?.name).toBe('Button');
    expect(frameNode?.parentId).toBeNull();
    expect(frameNode?.bounds).toEqual({ x: 0, y: 0, width: 200, height: 48 });

    const textNode = registry.getNode('10:2');
    expect(textNode?.type).toBe('TEXT');
    expect(textNode?.name).toBe('Label');
    expect(textNode?.parentId).toBe('10:1');
  });

  it('returns success:false when response fails type guard', async () => {
    // Missing rootNodeId → fails isValidCreateDesignResponse
    __mockBridge.sendToFigmaWithRetry.mockResolvedValue({
      nodeIds: {},
      totalNodes: 0
    });

    const result = await createDesign({
      spec: { type: 'frame', name: 'Test' }
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid response');
  });

  it('propagates bridge errors to the router for tracking', async () => {
    __mockBridge.sendToFigmaWithRetry.mockRejectedValue(new Error('WebSocket connection lost'));

    await expect(
      createDesign({
        spec: { type: 'frame', name: 'Fail' }
      })
    ).rejects.toThrow('WebSocket connection lost');
  });

  it('includes auto-corrections in result when values are off-grid', async () => {
    const result = await createDesign({
      spec: {
        type: 'frame',
        name: 'OffGrid',
        // itemSpacing: 15 is not on 8pt grid → should be corrected
        props: { layoutMode: 'VERTICAL', itemSpacing: 15 }
      }
    });

    expect(result.success).toBe(true);
    // Auto-corrections should be present
    expect(result.autoCorrections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'itemSpacing',
          originalValue: 15
        })
      ])
    );
  });

  it('skips auto-correction when autoCorrect is false', async () => {
    const result = await createDesign({
      spec: {
        type: 'frame',
        name: 'NoCorrect',
        props: { layoutMode: 'VERTICAL', itemSpacing: 15 }
      },
      autoCorrect: false
    });

    expect(result.success).toBe(true);
    expect(result.autoCorrections).toBeUndefined();
  });

  it('passes parentId to bridge when provided', async () => {
    await createDesign({
      spec: { type: 'frame', name: 'Nested' },
      parentId: 'existing-frame-99'
    });

    expect(__mockBridge.sendToFigmaWithRetry).toHaveBeenCalledWith(
      'create_design',
      expect.objectContaining({
        parentId: 'existing-frame-99'
      })
    );
  });

  it('handles response with no nodes array gracefully', async () => {
    __mockBridge.sendToFigmaWithRetry.mockResolvedValue({
      rootNodeId: '20:1',
      nodeIds: { Frame: '20:1' },
      totalNodes: 1,
      message: 'Created 1 node'
      // no nodes array
    });

    const result = await createDesign({
      spec: { type: 'frame', name: 'Simple' }
    });

    expect(result.success).toBe(true);
    expect(result.rootNodeId).toBe('20:1');

    // No nodes to register — getNode returns null for unregistered IDs
    const registry = getNodeRegistry();
    expect(registry.getNode('20:1')).toBeNull();
  });

  it('returns success:false when response is null', async () => {
    __mockBridge.sendToFigmaWithRetry.mockResolvedValue(null);

    const result = await createDesign({
      spec: { type: 'frame', name: 'Null' }
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid response');
  });

  it('returns success:false when response is undefined', async () => {
    __mockBridge.sendToFigmaWithRetry.mockResolvedValue(undefined);

    const result = await createDesign({
      spec: { type: 'frame', name: 'Undef' }
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid response');
  });

  it('handles deeply nested spec with multiple correction points', async () => {
    const result = await createDesign({
      spec: {
        type: 'frame',
        name: 'Dashboard',
        props: { layoutMode: 'VERTICAL', padding: 15, itemSpacing: 10 },
        children: [
          {
            type: 'frame',
            name: 'Header',
            props: { layoutMode: 'HORIZONTAL', padding: 10, itemSpacing: 6 },
            children: [
              { type: 'text', name: 'Title', props: { content: 'Dashboard', fontSize: 14 } }
            ]
          },
          {
            type: 'frame',
            name: 'Content',
            props: { layoutMode: 'VERTICAL', padding: 20 }
          }
        ]
      }
    });

    expect(result.success).toBe(true);
    // Multiple off-grid values should be auto-corrected
    expect(result.autoCorrections).toBeInstanceOf(Array);
    expect(result.autoCorrections!.length).toBeGreaterThanOrEqual(3);
  });

  it('propagates Figma-internal errors with original message', async () => {
    const specificError = 'FIGMA_INTERNAL: Maximum node count exceeded for this file';
    __mockBridge.sendToFigmaWithRetry.mockRejectedValue(new Error(specificError));

    await expect(
      createDesign({
        spec: { type: 'frame', name: 'TooMany' }
      })
    ).rejects.toThrow(specificError);
  });

  it('returns success:false when response has wrong shape (number instead of object)', async () => {
    __mockBridge.sendToFigmaWithRetry.mockResolvedValue(42);

    const result = await createDesign({
      spec: { type: 'frame', name: 'BadShape' }
    });

    expect(result.success).toBe(false);
  });

  it('registers nodes with correct parent-child relationships from response', async () => {
    __mockBridge.sendToFigmaWithRetry.mockResolvedValue(
      validResponse({
        nodes: [
          {
            nodeId: 'root-1',
            type: 'FRAME',
            name: 'Card',
            parentId: null,
            bounds: { x: 0, y: 0, width: 300, height: 200 }
          },
          {
            nodeId: 'child-1',
            type: 'TEXT',
            name: 'Title',
            parentId: 'root-1',
            bounds: { x: 16, y: 16, width: 200, height: 24 }
          },
          {
            nodeId: 'child-2',
            type: 'TEXT',
            name: 'Body',
            parentId: 'root-1',
            bounds: { x: 16, y: 48, width: 200, height: 48 }
          }
        ],
        rootNodeId: 'root-1',
        nodeIds: { Card: 'root-1', Title: 'child-1', Body: 'child-2' },
        totalNodes: 3,
        message: 'Created 3 nodes'
      })
    );

    await createDesign({
      spec: { type: 'frame', name: 'Card' }
    });

    const registry = getNodeRegistry();
    // Root node should have no parent
    expect(registry.getNode('root-1')?.parentId).toBeNull();
    // Children should reference root as parent
    expect(registry.getNode('child-1')?.parentId).toBe('root-1');
    expect(registry.getNode('child-2')?.parentId).toBe('root-1');
  });
});
