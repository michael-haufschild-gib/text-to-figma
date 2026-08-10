/**
 * Figma Plugin Layout Handlers — Unit Tests
 *
 * Directly verifies real layout handler mutations on mocked Figma nodes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface MockNode {
  id: string;
  type: string;
  name: string;
  parent: MockParentNode | null;
  [key: string]: unknown;
}

interface MockParentNode {
  id: string;
  type: 'FRAME';
  children: MockNode[];
  insertChild: ReturnType<typeof vi.fn>;
}

let nodesById: Map<string, MockNode | MockParentNode>;

const { cacheNode, resetNodeCache } = await import('../../figma-plugin/src/helpers.js');
const {
  handleAddLayoutGrid,
  handleSetConstraints,
  handleSetLayerOrder,
  handleSetLayoutProperties,
  handleSetLayoutSizing
} = await import('../../figma-plugin/src/handlers/layout.js');

function cacheMockNode<T extends MockNode | MockParentNode>(node: T): T {
  nodesById.set(node.id, node);
  cacheNode(node as unknown as SceneNode);
  return node;
}

function makeLayoutFrame(id = 'frame-1'): MockNode {
  return cacheMockNode({
    id,
    type: 'FRAME',
    name: 'Frame',
    parent: null,
    layoutMode: 'HORIZONTAL',
    itemSpacing: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    layoutSizingHorizontal: 'FIXED',
    layoutSizingVertical: 'FIXED',
    layoutPositioning: 'AUTO',
    constraints: { horizontal: 'MIN', vertical: 'MIN' },
    layoutGrids: []
  });
}

function makeParentWithChildren(): { parent: MockParentNode; children: MockNode[] } {
  const children = ['a', 'b', 'c'].map((id) => ({
    id,
    type: 'RECTANGLE',
    name: id,
    parent: null as MockParentNode | null
  }));
  const parent: MockParentNode = {
    id: 'parent',
    type: 'FRAME',
    children,
    insertChild: vi.fn((index: number, node: MockNode) => {
      parent.children = parent.children.filter((child) => child !== node);
      parent.children.splice(index, 0, node);
    })
  };
  for (const child of children) {
    child.parent = parent;
    cacheMockNode(child);
  }
  cacheMockNode(parent);
  return { parent, children };
}

beforeEach(() => {
  resetNodeCache();
  nodesById = new Map();
  (globalThis as Record<string, unknown>)['figma'] = {
    getNodeById: vi.fn((id: string) => nodesById.get(id) ?? null)
  };
});

afterEach(() => {
  resetNodeCache();
  delete (globalThis as Record<string, unknown>)['figma'];
});

describe('handleSetLayoutProperties', () => {
  it('applies shared padding first and then side-specific overrides', () => {
    const frame = makeLayoutFrame();

    handleSetLayoutProperties({
      nodeId: 'frame-1',
      layoutMode: 'VERTICAL',
      itemSpacing: 12,
      padding: 16,
      paddingLeft: 24,
      paddingBottom: 8
    });

    expect(frame).toMatchObject({
      layoutMode: 'VERTICAL',
      itemSpacing: 12,
      paddingTop: 16,
      paddingRight: 16,
      paddingBottom: 8,
      paddingLeft: 24
    });
  });
});

describe('handleSetLayoutSizing', () => {
  it('updates horizontal, vertical, and positioning independently', () => {
    const frame = makeLayoutFrame();

    handleSetLayoutSizing({
      nodeId: 'frame-1',
      horizontal: 'FILL',
      vertical: 'HUG',
      layoutPositioning: 'ABSOLUTE'
    });

    expect(frame).toMatchObject({
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'HUG',
      layoutPositioning: 'ABSOLUTE'
    });
  });
});

describe('handleSetConstraints', () => {
  it('defaults omitted axes to MIN while reporting only explicitly applied axes', () => {
    const frame = makeLayoutFrame();

    const result = handleSetConstraints({ nodeId: 'frame-1', horizontal: 'STRETCH' });

    expect(frame.constraints).toEqual({ horizontal: 'STRETCH', vertical: 'MIN' });
    expect(result.applied).toEqual(['horizontal: STRETCH']);
  });
});

describe('handleSetLayerOrder', () => {
  it('clamps SET_INDEX beyond the last child to the front-most index', () => {
    const { parent, children } = makeParentWithChildren();

    const result = handleSetLayerOrder({ nodeId: 'a', action: 'SET_INDEX', index: 99 });

    expect(parent.insertChild).toHaveBeenCalledWith(2, children[0]);
    expect(parent.children.map((child) => child.id)).toEqual(['b', 'c', 'a']);
    expect(result.newIndex).toBe(2);
  });
});

describe('handleAddLayoutGrid', () => {
  it('appends a row grid without replacing existing layout grids', () => {
    const frame = makeLayoutFrame();
    frame.layoutGrids = [
      { pattern: 'GRID', sectionSize: 8, visible: true, color: { r: 1, g: 0, b: 0, a: 0.1 } }
    ];

    const result = handleAddLayoutGrid({
      nodeId: 'frame-1',
      pattern: 'ROWS',
      count: 8,
      gutter: 12,
      margin: 24,
      color: '#336699',
      alignment: 'STRETCH',
      visible: false
    });

    expect(result).toMatchObject({ pattern: 'ROWS', count: 8, gutter: 12, margin: 24 });
    expect(frame.layoutGrids).toHaveLength(2);
    expect((frame.layoutGrids as unknown[])[1]).toMatchObject({
      pattern: 'ROWS',
      visible: false,
      alignment: 'STRETCH',
      gutterSize: 12,
      offset: 24,
      count: 8,
      color: { r: 0x33 / 255, g: 0x66 / 255, b: 0x99 / 255, a: 0.1 }
    });
  });
});
