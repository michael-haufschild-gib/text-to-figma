/**
 * Figma Plugin Styling Handlers — Unit Tests
 *
 * Directly tests the real plugin styling handlers. The simulator can verify
 * bridge payloads, but only these tests verify actual Figma node mutation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface MockNode {
  id: string;
  type: string;
  name: string;
  fills?: unknown[];
  strokes?: unknown[];
  effects?: unknown[];
  opacity?: number;
  blendMode?: string;
  clipsContent?: boolean;
  children?: MockNode[];
  isMask?: boolean;
  [key: string]: unknown;
}

interface MockFigmaApi {
  getNodeById: ReturnType<typeof vi.fn>;
  createImage: ReturnType<typeof vi.fn>;
}

let mockFigma: MockFigmaApi;
let nodesById: Map<string, MockNode>;

const { cacheNode, resetNodeCache } = await import('../../figma-plugin/src/helpers.js');
const { handleAddGradientFill, handleSetAppearance, handleSetFills, handleSetImageFill } =
  await import('../../figma-plugin/src/handlers/styling.js');

function cacheMockNode(node: MockNode): MockNode {
  nodesById.set(node.id, node);
  cacheNode(node as unknown as SceneNode);
  return node;
}

beforeEach(() => {
  resetNodeCache();
  nodesById = new Map();
  mockFigma = {
    getNodeById: vi.fn((id: string) => nodesById.get(id) ?? null),
    createImage: vi.fn(() => ({ hash: 'image-hash-123' }))
  };
  (globalThis as Record<string, unknown>)['figma'] = mockFigma;
});

afterEach(() => {
  resetNodeCache();
  delete (globalThis as Record<string, unknown>)['figma'];
});

describe('handleSetFills', () => {
  it('applies solid hex fill with explicit opacity', () => {
    const node = cacheMockNode({ id: 'rect-1', type: 'RECTANGLE', name: 'Rect', fills: [] });

    const result = handleSetFills({ nodeId: 'rect-1', color: '#336699', opacity: 0.4 });

    expect(result.nodeId).toBe('rect-1');
    expect(node.fills).toEqual([
      { type: 'SOLID', color: { r: 0x33 / 255, g: 0x66 / 255, b: 0x99 / 255 }, opacity: 0.4 }
    ]);
  });

  it('rejects fill updates without either color or fills payload', () => {
    cacheMockNode({ id: 'rect-1', type: 'RECTANGLE', name: 'Rect', fills: [] });

    expect(() => handleSetFills({ nodeId: 'rect-1' })).toThrow(
      'Either color (hex string) or fills (array) must be provided'
    );
  });
});

describe('handleSetAppearance', () => {
  it('enables clipping masks on the first child when requested', () => {
    const maskChild = cacheMockNode({
      id: 'child-1',
      type: 'RECTANGLE',
      name: 'Mask',
      isMask: false
    });
    const frame = cacheMockNode({
      id: 'frame-1',
      type: 'FRAME',
      name: 'Frame',
      opacity: 1,
      blendMode: 'NORMAL',
      clipsContent: false,
      children: [maskChild]
    });

    handleSetAppearance({
      nodeId: 'frame-1',
      blendMode: 'MULTIPLY',
      opacity: 0.75,
      clipping: { useMask: true }
    });

    expect(frame).toMatchObject({
      blendMode: 'MULTIPLY',
      opacity: 0.75,
      clipsContent: true
    });
    expect(maskChild.isMask).toBe(true);
  });
});

describe('handleAddGradientFill', () => {
  it('builds a linear gradient transform from angle and color stops', () => {
    const node = cacheMockNode({ id: 'rect-1', type: 'RECTANGLE', name: 'Rect', fills: [] });

    const result = handleAddGradientFill({
      nodeId: 'rect-1',
      type: 'LINEAR',
      angle: 90,
      stops: [
        { position: 0, color: '#000000', opacity: 0.5 },
        { position: 1, color: '#FFFFFF' }
      ]
    });

    expect(result).toMatchObject({ type: 'GRADIENT_LINEAR', stopCount: 2 });
    expect(node.fills?.[0]).toMatchObject({
      type: 'GRADIENT_LINEAR',
      gradientStops: [
        { position: 0, color: { r: 0, g: 0, b: 0, a: 0.5 } },
        { position: 1, color: { r: 1, g: 1, b: 1, a: 1 } }
      ]
    });
    expect((node.fills?.[0] as { gradientTransform: number[][] }).gradientTransform).toEqual([
      [expect.closeTo(0, 10), expect.closeTo(1, 10), expect.closeTo(0, 10)],
      [expect.closeTo(-1, 10), expect.closeTo(0, 10), expect.closeTo(1, 10)]
    ]);
  });
});

describe('handleSetImageFill', () => {
  it('creates a Figma image from byte arrays and applies an image fill', () => {
    const node = cacheMockNode({ id: 'rect-1', type: 'RECTANGLE', name: 'Rect', fills: [] });

    const result = handleSetImageFill({
      nodeId: 'rect-1',
      imageBytes: [1, 2, 3, 255],
      scaleMode: 'FIT',
      opacity: 0.8
    });

    expect(mockFigma.createImage).toHaveBeenCalledWith(new Uint8Array([1, 2, 3, 255]));
    expect(result).toMatchObject({ scaleMode: 'FIT', opacity: 0.8 });
    expect(node.fills).toEqual([
      { type: 'IMAGE', imageHash: 'image-hash-123', scaleMode: 'FIT', opacity: 0.8 }
    ]);
  });

  it('rejects base64 image strings in the plugin main thread', () => {
    cacheMockNode({ id: 'rect-1', type: 'RECTANGLE', name: 'Rect', fills: [] });

    expect(() => handleSetImageFill({ nodeId: 'rect-1', imageBytes: 'abc123' })).toThrow(
      'Base64 strings not supported in plugin main thread'
    );
    expect(mockFigma.createImage).not.toHaveBeenCalled();
  });
});
