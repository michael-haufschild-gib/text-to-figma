/**
 * Figma Plugin Creation Handlers — Unit Tests
 *
 * Exercises real creation handlers with a small Figma API mock. These tests
 * cover behavior the simulated e2e plugin cannot verify: layout sizing defaults,
 * font/text property application, line geometry safeguards, and star radius math.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface MockNode {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parent: MockParentNode | null;
  fills: unknown[];
  strokes: unknown[];
  resize: ReturnType<typeof vi.fn>;
  [key: string]: unknown;
}

interface MockParentNode {
  id: string;
  type: 'PAGE' | 'FRAME';
  appendChild: ReturnType<typeof vi.fn>;
}

interface MockFigmaApi {
  createFrame: ReturnType<typeof vi.fn>;
  createText: ReturnType<typeof vi.fn>;
  createLine: ReturnType<typeof vi.fn>;
  createStar: ReturnType<typeof vi.fn>;
  getNodeById: ReturnType<typeof vi.fn>;
  loadFontAsync: ReturnType<typeof vi.fn>;
  currentPage: MockParentNode;
  viewport: { scrollAndZoomIntoView: ReturnType<typeof vi.fn> };
}

let mockFigma: MockFigmaApi;
let nodesById: Map<string, MockNode | MockParentNode>;
let sequence: number;

const { cacheNode, resetNodeCache } = await import('../../figma-plugin/src/helpers.js');
const { handleCreateFrame, handleCreateLine, handleCreateStar, handleCreateText } =
  await import('../../figma-plugin/src/handlers/creation.js');

function makeParent(id: string): MockParentNode {
  const parent: MockParentNode = {
    id,
    type: 'FRAME',
    appendChild: vi.fn((node: MockNode) => {
      node.parent = parent;
    })
  };
  nodesById.set(id, parent);
  cacheNode(parent as unknown as SceneNode);
  return parent;
}

function makeNode(type: string): MockNode {
  const node: MockNode = {
    id: `${type.toLowerCase()}-${++sequence}`,
    type,
    name: type,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    parent: null,
    fills: [],
    strokes: [],
    resize: vi.fn((width: number, height: number) => {
      node.width = width;
      node.height = height;
    })
  };
  nodesById.set(node.id, node);
  return node;
}

beforeEach(() => {
  resetNodeCache();
  sequence = 0;
  nodesById = new Map();
  const currentPage: MockParentNode = {
    id: 'page-1',
    type: 'PAGE',
    appendChild: vi.fn((node: MockNode) => {
      node.parent = currentPage;
    })
  };
  nodesById.set(currentPage.id, currentPage);

  mockFigma = {
    createFrame: vi.fn(() => makeNode('FRAME')),
    createText: vi.fn(() => makeNode('TEXT')),
    createLine: vi.fn(() => makeNode('LINE')),
    createStar: vi.fn(() => makeNode('STAR')),
    getNodeById: vi.fn((id: string) => nodesById.get(id) ?? null),
    loadFontAsync: vi.fn().mockResolvedValue(undefined),
    currentPage,
    viewport: { scrollAndZoomIntoView: vi.fn() }
  };
  (globalThis as Record<string, unknown>)['figma'] = mockFigma;
});

afterEach(() => {
  resetNodeCache();
  delete (globalThis as Record<string, unknown>)['figma'];
});

describe('handleCreateFrame', () => {
  it('appends to an explicit parent and defaults auto-layout sizing when dimensions are omitted', () => {
    const parent = makeParent('parent-frame');

    const result = handleCreateFrame({
      name: 'Auto Layout Child',
      layoutMode: 'VERTICAL',
      padding: 16,
      itemSpacing: 8,
      parentId: 'parent-frame'
    });

    const frame = nodesById.get(result.nodeId) as MockNode;
    expect(parent.appendChild).toHaveBeenCalledWith(frame);
    expect(frame).toMatchObject({
      name: 'Auto Layout Child',
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 16,
      paddingBottom: 16,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'HUG'
    });
    expect(frame.resize).not.toHaveBeenCalled();
    expect(mockFigma.viewport.scrollAndZoomIntoView).toHaveBeenCalledWith([frame]);
  });
});

describe('handleCreateText', () => {
  it('loads the requested font and applies text styling before appending', async () => {
    const parent = makeParent('text-parent');

    const result = await handleCreateText({
      content: 'Hello',
      name: 'Greeting',
      fontFamily: 'Roboto',
      fontWeight: 700,
      fontSize: 24,
      color: '#336699',
      textAlign: 'CENTER',
      lineHeight: 32,
      letterSpacing: 1.5,
      parentId: 'text-parent'
    });

    const text = nodesById.get(result.nodeId) as MockNode;
    expect(mockFigma.loadFontAsync).toHaveBeenCalledWith({ family: 'Roboto', style: 'Bold' });
    expect(parent.appendChild).toHaveBeenCalledWith(text);
    expect(text).toMatchObject({
      characters: 'Hello',
      name: 'Greeting',
      fontName: { family: 'Roboto', style: 'Bold' },
      fontSize: 24,
      textAlignHorizontal: 'CENTER',
      lineHeight: { value: 32, unit: 'PIXELS' },
      letterSpacing: { value: 1.5, unit: 'PIXELS' }
    });
    expect(text.fills).toEqual([
      { type: 'SOLID', color: { r: 0x33 / 255, g: 0x66 / 255, b: 0x99 / 255 } }
    ]);
  });
});

describe('handleCreateLine', () => {
  it('uses a minimum non-zero size for zero-length lines', () => {
    const result = handleCreateLine({
      name: 'Point Line',
      x1: 10,
      y1: 20,
      x2: 10,
      y2: 20,
      strokeCap: 'ROUND',
      dashPattern: [4, 2]
    });

    const line = nodesById.get(result.nodeId) as MockNode;
    expect(line).toMatchObject({
      x: 10,
      y: 20,
      width: 0.01,
      height: 0.01,
      strokeCap: 'ROUND',
      dashPattern: [4, 2]
    });
  });
});

describe('handleCreateStar', () => {
  it('converts absolute innerRadius input into Figma innerRadius ratio', () => {
    const result = handleCreateStar({
      name: 'Badge Star',
      pointCount: 6,
      radius: 80,
      innerRadius: 20,
      fillColor: '#FFCC00'
    });

    const star = nodesById.get(result.nodeId) as MockNode;
    expect(star).toMatchObject({
      name: 'Badge Star',
      pointCount: 6,
      width: 160,
      height: 160,
      innerRadius: 0.25
    });
    expect(star.fills).toEqual([{ type: 'SOLID', color: { r: 1, g: 0xcc / 255, b: 0 } }]);
  });
});
