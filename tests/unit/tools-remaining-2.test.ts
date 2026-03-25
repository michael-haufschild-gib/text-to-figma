/**
 * Remaining Tools Tests (Part 2)
 *
 * Tests execute functions for: add_layout_grid, create_rectangle_with_image_fill,
 * create_boolean_operation
 *
 * Each section covers: schema validation, payload verification, CSS generation,
 * error handling, and edge cases.
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

const { addLayoutGrid, AddLayoutGridInputSchema } =
  await import('../../mcp-server/src/tools/add_layout_grid.js');
const { createRectangleWithImageFill } =
  await import('../../mcp-server/src/tools/create_rectangle_with_image_fill.js');
const { createBooleanOperation, CreateBooleanOperationInputSchema } =
  await import('../../mcp-server/src/tools/create_boolean_operation.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigma: ReturnType<typeof vi.fn>;
    sendToFigmaWithRetry: ReturnType<typeof vi.fn>;
    sendToFigmaValidated: ReturnType<typeof vi.fn>;
    isConnected: ReturnType<typeof vi.fn>;
    getConnectionStatus: ReturnType<typeof vi.fn>;
  };
};

// ─── AddLayoutGridInputSchema ────────────────────────────────────────────────

describe('AddLayoutGridInputSchema', () => {
  it('requires nodeId and pattern', () => {
    expect(AddLayoutGridInputSchema.safeParse({}).success).toBe(false);
    expect(AddLayoutGridInputSchema.safeParse({ nodeId: 'n' }).success).toBe(false);
  });

  it('accepts minimal input with defaults filled', () => {
    const result = AddLayoutGridInputSchema.safeParse({
      nodeId: 'frame-1',
      pattern: 'COLUMNS'
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gutter).toBe(20);
      expect(result.data.margin).toBe(0);
      expect(result.data.offset).toBe(0);
      expect(result.data.color).toBe('#FF0000');
      expect(result.data.opacity).toBe(0.1);
    }
  });

  it('rejects negative gutter', () => {
    expect(
      AddLayoutGridInputSchema.safeParse({
        nodeId: 'n',
        pattern: 'COLUMNS',
        gutter: -1
      }).success
    ).toBe(false);
  });

  it('rejects opacity out of 0-1 range', () => {
    expect(
      AddLayoutGridInputSchema.safeParse({
        nodeId: 'n',
        pattern: 'COLUMNS',
        opacity: 1.5
      }).success
    ).toBe(false);
    expect(
      AddLayoutGridInputSchema.safeParse({
        nodeId: 'n',
        pattern: 'COLUMNS',
        opacity: -0.1
      }).success
    ).toBe(false);
  });

  it('rejects non-integer count', () => {
    expect(
      AddLayoutGridInputSchema.safeParse({
        nodeId: 'n',
        pattern: 'COLUMNS',
        count: 3.5
      }).success
    ).toBe(false);
  });

  it('rejects zero count (must be positive)', () => {
    expect(
      AddLayoutGridInputSchema.safeParse({
        nodeId: 'n',
        pattern: 'COLUMNS',
        count: 0
      }).success
    ).toBe(false);
  });

  it('rejects invalid pattern value', () => {
    expect(AddLayoutGridInputSchema.safeParse({ nodeId: 'n', pattern: 'DIAGONAL' }).success).toBe(
      false
    );
  });
});

// ─── addLayoutGrid ───────────────────────────────────────────────────────────

describe('addLayoutGrid', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaWithRetry.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends correct payload to bridge', async () => {
    await addLayoutGrid({
      nodeId: 'frame-1',
      pattern: 'COLUMNS',
      count: 12,
      gutter: 20,
      margin: 64,
      offset: 0,
      color: '#FF0000',
      opacity: 0.1
    });

    expect(__mockBridge.sendToFigmaWithRetry).toHaveBeenCalledWith(
      'add_layout_grid',
      expect.objectContaining({
        nodeId: 'frame-1',
        pattern: 'COLUMNS',
        count: 12,
        gutter: 20,
        margin: 64
      })
    );
  });

  it('adds a column grid and returns CSS equivalent', async () => {
    const result = await addLayoutGrid({
      nodeId: 'frame-1',
      pattern: 'COLUMNS',
      count: 12,
      gutter: 20,
      margin: 64,
      offset: 0,
      color: '#FF0000',
      opacity: 0.1
    });

    expect(result.nodeId).toBe('frame-1');
    expect(result.pattern).toBe('COLUMNS');
    expect(result.count).toBe(12);
    expect(result.gutter).toBe(20);
    expect(result.margin).toBe(64);
    expect(result.cssEquivalent).toContain('grid-template-columns: repeat(12, 1fr)');
    expect(result.cssEquivalent).toContain('gap: 20px');
    expect(result.message).toContain('12-column');
  });

  it('adds a row grid and generates row CSS', async () => {
    const result = await addLayoutGrid({
      nodeId: 'frame-2',
      pattern: 'ROWS',
      count: 8,
      gutter: 8,
      margin: 0,
      offset: 0,
      color: '#0000FF',
      opacity: 0.05
    });

    expect(result.pattern).toBe('ROWS');
    expect(result.cssEquivalent).toContain('grid-template-rows: repeat(8, 1fr)');
    expect(result.message).toContain('8-row');
  });

  it('adds a GRID pattern without count', async () => {
    const result = await addLayoutGrid({
      nodeId: 'frame-3',
      pattern: 'GRID',
      gutter: 8,
      margin: 0,
      offset: 0,
      color: '#FF0000',
      opacity: 0.1
    });

    expect(result.pattern).toBe('GRID');
    expect(result.count).toBeUndefined();
    expect(result.cssEquivalent).toContain('background-size');
    expect(result.message).toContain('grid');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaWithRetry.mockRejectedValue(new Error('Not a frame'));

    await expect(
      addLayoutGrid({
        nodeId: 'rect-1',
        pattern: 'COLUMNS',
        count: 12,
        gutter: 20,
        margin: 0,
        offset: 0,
        color: '#FF0000',
        opacity: 0.1
      })
    ).rejects.toThrow('Not a frame');
  });
});

// ─── createRectangleWithImageFill ────────────────────────────────────────────

describe('createRectangleWithImageFill', () => {
  beforeEach(() => {
    resetNodeRegistry();
    __mockBridge.isConnected.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a rectangle with image fill and registers in node registry', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      nodeId: 'img-123'
    });

    const result = await createRectangleWithImageFill({
      imageUrl: 'https://example.com/photo.jpg',
      width: 320,
      height: 200,
      scaleMode: 'FILL',
      name: 'Hero Image'
    });

    expect(result.rectangleId).toBe('img-123');
    expect(result.imageUrl).toBe('https://example.com/photo.jpg');
    expect(result.width).toBe(320);
    expect(result.height).toBe(200);
    expect(result.scaleMode).toBe('FILL');
    expect(result.cssEquivalent).toContain('background-size: cover;');
    expect(result.message).toContain('FILL');

    // Verify node was registered
    const registry = getNodeRegistry();
    const node = registry.getNode('img-123');
    expect(node?.type).toBe('RECTANGLE');
    expect(node?.name).toBe('Hero Image');
  });

  it('throws when not connected to Figma', async () => {
    __mockBridge.isConnected.mockReturnValue(false);

    await expect(
      createRectangleWithImageFill({
        imageUrl: 'https://example.com/img.png',
        width: 100,
        height: 100,
        scaleMode: 'FILL',
        name: 'Image'
      })
    ).rejects.toThrow('Not connected to Figma');
  });

  it('handles FIT scale mode CSS', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      nodeId: 'img-456'
    });

    const result = await createRectangleWithImageFill({
      imageUrl: 'https://example.com/logo.svg',
      width: 200,
      height: 200,
      scaleMode: 'FIT',
      name: 'Logo'
    });

    expect(result.cssEquivalent).toContain('background-size: contain;');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Image load failed'));

    await expect(
      createRectangleWithImageFill({
        imageUrl: 'https://example.com/broken.png',
        width: 100,
        height: 100,
        scaleMode: 'FILL',
        name: 'Broken'
      })
    ).rejects.toThrow('Image load failed');
  });
});

// ─── CreateBooleanOperationInputSchema ────────────────────────────────────────

describe('CreateBooleanOperationInputSchema', () => {
  it('requires at least 2 nodeIds', () => {
    expect(
      CreateBooleanOperationInputSchema.safeParse({
        nodeIds: ['single'],
        operation: 'UNION'
      }).success
    ).toBe(false);
  });

  it('accepts exactly 2 nodeIds', () => {
    expect(
      CreateBooleanOperationInputSchema.safeParse({
        nodeIds: ['a', 'b'],
        operation: 'UNION'
      }).success
    ).toBe(true);
  });

  it('rejects empty nodeId strings in the array', () => {
    expect(
      CreateBooleanOperationInputSchema.safeParse({
        nodeIds: ['a', ''],
        operation: 'UNION'
      }).success
    ).toBe(false);
  });

  it('accepts all 4 operation types', () => {
    for (const op of ['UNION', 'SUBTRACT', 'INTERSECT', 'EXCLUDE']) {
      expect(
        CreateBooleanOperationInputSchema.safeParse({
          nodeIds: ['a', 'b'],
          operation: op
        }).success
      ).toBe(true);
    }
  });

  it('rejects invalid operation', () => {
    expect(
      CreateBooleanOperationInputSchema.safeParse({
        nodeIds: ['a', 'b'],
        operation: 'MERGE'
      }).success
    ).toBe(false);
  });

  it('defaults name to "Boolean Group" when omitted', () => {
    const result = CreateBooleanOperationInputSchema.safeParse({
      nodeIds: ['a', 'b'],
      operation: 'UNION'
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Boolean Group');
    }
  });
});

// ─── createBooleanOperation ──────────────────────────────────────────────────

describe('createBooleanOperation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends correct payload to bridge', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({ success: true, nodeId: 'bool-1' });

    await createBooleanOperation({
      nodeIds: ['circle-1', 'circle-2'],
      operation: 'UNION',
      name: 'Merged Shape'
    });

    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledWith(
      'create_boolean_operation',
      expect.objectContaining({
        nodeIds: ['circle-1', 'circle-2'],
        operation: 'UNION',
        name: 'Merged Shape'
      }),
      expect.anything()
    );
  });

  it('creates a UNION boolean operation', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      nodeId: 'bool-1'
    });

    const result = await createBooleanOperation({
      nodeIds: ['circle-1', 'circle-2'],
      operation: 'UNION',
      name: 'Merged Shape'
    });

    expect(result.booleanNodeId).toBe('bool-1');
    expect(result.operation).toBe('UNION');
    expect(result.nodeCount).toBe(2);
    expect(result.message).toContain('UNION');
    expect(result.message).toContain('2 shapes');
  });

  it('generates different messages for each operation type', async () => {
    const ops: Array<[string, string]> = [
      ['UNION', 'merged'],
      ['SUBTRACT', 'subtracted'],
      ['INTERSECT', 'intersect'],
      ['EXCLUDE', 'exclud']
    ];

    for (const [op, keyword] of ops) {
      __mockBridge.sendToFigmaValidated.mockResolvedValue({ success: true, nodeId: 'b' });
      const result = await createBooleanOperation({
        nodeIds: ['a', 'b'],
        operation: op as 'UNION' | 'SUBTRACT' | 'INTERSECT' | 'EXCLUDE',
        name: 'Test'
      });
      expect(result.message.toLowerCase()).toContain(keyword);
    }
  });

  it('creates a SUBTRACT boolean operation with 3 shapes', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      nodeId: 'bool-2'
    });

    const result = await createBooleanOperation({
      nodeIds: ['outer', 'inner-1', 'inner-2'],
      operation: 'SUBTRACT',
      name: 'Donut'
    });

    expect(result.operation).toBe('SUBTRACT');
    expect(result.nodeCount).toBe(3);
    expect(result.message).toContain('3 shapes');
  });

  it('rejects response when bridge returns no nodeId', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Required at "nodeId"'));

    await expect(
      createBooleanOperation({
        nodeIds: ['a', 'b'],
        operation: 'INTERSECT',
        name: 'Lens'
      })
    ).rejects.toThrow();
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Nodes not found'));

    await expect(
      createBooleanOperation({
        nodeIds: ['x', 'y'],
        operation: 'EXCLUDE',
        name: 'Test'
      })
    ).rejects.toThrow('Nodes not found');
  });
});
