/**
 * Figma Plugin Transform, Spatial, and Text Handlers — Unit Tests
 *
 * Covers math-heavy and Figma-runtime-sensitive handlers directly rather than
 * relying on the e2e simulated plugin.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface MockSceneNode {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  [key: string]: unknown;
}

let nodesById: Map<string, MockSceneNode>;
let figmaMixed: symbol;
let loadFontAsync: ReturnType<typeof vi.fn>;
let union: ReturnType<typeof vi.fn>;

const { cacheNode, resetNodeCache } = await import('../../figma-plugin/src/helpers.js');
const { handleSetTransform } = await import('../../figma-plugin/src/handlers/transform.js');
const { handleAlignNodes, handleConnectShapes, handleDistributeNodes } =
  await import('../../figma-plugin/src/handlers/spatial.js');
const { handleSetLetterSpacing, handleSetTextProperties } =
  await import('../../figma-plugin/src/handlers/text.js');

function cacheMockNode<T extends MockSceneNode>(node: T): T {
  nodesById.set(node.id, node);
  cacheNode(node as unknown as SceneNode);
  return node;
}

function makeRectangle(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number
): MockSceneNode {
  return cacheMockNode({
    id,
    type: 'RECTANGLE',
    name: id,
    x,
    y,
    width,
    height,
    relativeTransform: [
      [1, 0, x],
      [0, 1, y]
    ],
    rotation: 0,
    resize: vi.fn(function resize(this: MockSceneNode, nextWidth: number, nextHeight: number) {
      this.width = nextWidth;
      this.height = nextHeight;
    })
  });
}

function makeTextNode(overrides: Partial<MockSceneNode> = {}): MockSceneNode {
  return cacheMockNode({
    id: 'text-1',
    type: 'TEXT',
    name: 'Text',
    x: 0,
    y: 0,
    width: 100,
    height: 24,
    characters: 'Hello',
    fontName: { family: 'Inter', style: 'Regular' },
    getRangeFontName: vi.fn(),
    textDecoration: 'NONE',
    letterSpacing: { value: 0, unit: 'PIXELS' },
    textCase: 'ORIGINAL',
    paragraphSpacing: 0,
    paragraphIndent: 0,
    ...overrides
  });
}

beforeEach(() => {
  resetNodeCache();
  nodesById = new Map();
  figmaMixed = Symbol('mixed');
  loadFontAsync = vi.fn().mockResolvedValue(undefined);
  union = vi.fn(() => ({ id: 'union-1' }));
  (globalThis as Record<string, unknown>)['figma'] = {
    mixed: figmaMixed,
    getNodeById: vi.fn((id: string) => nodesById.get(id) ?? null),
    loadFontAsync,
    union,
    currentPage: { id: 'page-1' }
  };
});

afterEach(() => {
  resetNodeCache();
  delete (globalThis as Record<string, unknown>)['figma'];
});

describe('handleSetTransform', () => {
  it('applies position, resize, scale, rotation, and both-axis flip in command order', () => {
    const node = makeRectangle('rect-1', 5, 10, 10, 20);

    handleSetTransform({
      nodeId: 'rect-1',
      position: { x: 100 },
      size: { width: 30 },
      scale: { x: 2, y: 3 },
      rotation: 45,
      flip: 'BOTH'
    });

    expect(node).toMatchObject({ x: 100, y: 10, width: 60, height: 60, rotation: 45 });
    expect(node.resize).toHaveBeenNthCalledWith(1, 30, 20);
    expect(node.resize).toHaveBeenNthCalledWith(2, 60, 60);
    expect(node.relativeTransform).toEqual([
      [-1, 0, 65],
      [0, -1, 70]
    ]);
  });
});

describe('handleAlignNodes', () => {
  it('aligns horizontal centers to the selection bounds rather than the first node', () => {
    const left = makeRectangle('left', 10, 0, 20, 10);
    const right = makeRectangle('right', 100, 0, 40, 10);

    handleAlignNodes({ nodeIds: ['left', 'right'], alignment: 'CENTER_H' });

    expect(left.x).toBe(65);
    expect(right.x).toBe(55);
  });
});

describe('handleDistributeNodes', () => {
  it('sorts nodes by axis before applying explicit edge spacing', () => {
    const last = makeRectangle('last', 80, 0, 10, 10);
    const first = makeRectangle('first', 0, 0, 10, 10);
    const middle = makeRectangle('middle', 30, 0, 10, 10);

    const result = handleDistributeNodes({
      nodeIds: ['last', 'first', 'middle'],
      axis: 'HORIZONTAL',
      method: 'SPACING',
      spacing: 5
    });

    expect(first.x).toBe(0);
    expect(middle.x).toBe(15);
    expect(last.x).toBe(80);
    expect(result.spacing).toBe(5);
  });
});

describe('handleConnectShapes', () => {
  it('positions source and optionally unions by opposing anchors with overlap', () => {
    const source = makeRectangle('source', 0, 0, 20, 10);
    const target = makeRectangle('target', 100, 50, 80, 20);

    const result = handleConnectShapes({
      sourceNodeId: 'source',
      targetNodeId: 'target',
      method: 'UNION',
      targetAnchor: 'TOP',
      sourceAnchor: 'BOTTOM',
      overlap: 4
    });

    expect(source.x).toBe(130);
    expect(source.y).toBe(44);
    expect(union).toHaveBeenCalledWith([source, target], { id: 'page-1' });
    expect(result).toMatchObject({ merged: true, newNodeId: 'union-1' });
  });
});

describe('handleSetTextProperties', () => {
  it('loads the first ranged font for mixed-font text before mutating text properties', async () => {
    const firstFont = { family: 'Inter', style: 'Bold' };
    const node = makeTextNode({
      fontName: figmaMixed,
      getRangeFontName: vi.fn(() => firstFont)
    });

    await handleSetTextProperties({
      nodeId: 'text-1',
      decoration: 'UNDERLINE',
      letterSpacing: { value: 1.5 },
      textCase: 'UPPER',
      paragraphSpacing: 12,
      paragraphIndent: 4
    });

    expect(node.getRangeFontName).toHaveBeenCalledWith(0, 1);
    expect(loadFontAsync).toHaveBeenCalledWith(firstFont);
    expect(node).toMatchObject({
      textDecoration: 'UNDERLINE',
      letterSpacing: { value: 1.5, unit: 'PIXELS' },
      textCase: 'UPPER',
      paragraphSpacing: 12,
      paragraphIndent: 4
    });
  });
});

describe('handleSetLetterSpacing', () => {
  it('keeps the legacy helper default of PERCENT when no unit is provided', () => {
    const node = makeTextNode();

    const result = handleSetLetterSpacing({ nodeId: 'text-1', value: 120 });

    expect(node.letterSpacing).toEqual({ value: 120, unit: 'PERCENT' });
    expect(result).toMatchObject({ value: 120, unit: 'PERCENT' });
  });
});
