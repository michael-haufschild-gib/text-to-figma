/**
 * Figma Plugin create_design Handler — Unit Tests
 *
 * Verifies the real plugin-side batch hierarchy builder rather than the e2e
 * simulator's synthetic create_design response.
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
  parent: MockContainerNode | null;
  [key: string]: unknown;
}

interface MockContainerNode extends MockSceneNode {
  children: MockSceneNode[];
  appendChild: ReturnType<typeof vi.fn>;
}

let nodeSeq: number;
let currentPage: MockContainerNode;
let createdNodes: MockSceneNode[];
let getNodeByIdAsync: ReturnType<typeof vi.fn>;
let scrollAndZoomIntoView: ReturnType<typeof vi.fn>;

const { resetNodeCache } = await import('../../figma-plugin/src/helpers.js');
const { handleCreateDesign } = await import('../../figma-plugin/src/handlers/design.js');

function makeBaseNode(type: string): MockSceneNode {
  const node: MockSceneNode = {
    id: `${type.toLowerCase()}-${nodeSeq++}`,
    type,
    name: type,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    parent: null,
    fills: [],
    strokes: [],
    effects: [],
    resize: vi.fn(function resize(this: MockSceneNode, width: number, height: number) {
      this.width = width;
      this.height = height;
    })
  };
  createdNodes.push(node);
  return node;
}

function makeContainer(type: string): MockContainerNode {
  const node = {
    ...makeBaseNode(type),
    layoutMode: 'NONE',
    itemSpacing: 0,
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 0,
    paddingBottom: 0,
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'MIN',
    primaryAxisSizingMode: 'FIXED',
    counterAxisSizingMode: 'FIXED',
    layoutSizingHorizontal: 'FIXED',
    layoutSizingVertical: 'FIXED',
    children: [],
    appendChild: vi.fn(function appendChild(this: MockContainerNode, child: MockSceneNode) {
      this.children.push(child);
      child.parent = this;
    })
  } satisfies MockContainerNode;
  return node;
}

beforeEach(() => {
  resetNodeCache();
  nodeSeq = 1;
  createdNodes = [];
  currentPage = makeContainer('PAGE');
  currentPage.id = 'page-1';
  currentPage.name = 'Page';
  getNodeByIdAsync = vi.fn().mockResolvedValue(null);
  scrollAndZoomIntoView = vi.fn();

  (globalThis as Record<string, unknown>)['figma'] = {
    currentPage,
    createFrame: vi.fn(() => makeContainer('FRAME')),
    createRectangle: vi.fn(() => makeBaseNode('RECTANGLE')),
    createEllipse: vi.fn(() => makeBaseNode('ELLIPSE')),
    createLine: vi.fn(() => makeBaseNode('LINE')),
    createText: vi.fn(() => ({
      ...makeBaseNode('TEXT'),
      characters: '',
      fontName: null,
      fontSize: 0
    })),
    loadFontAsync: vi.fn().mockResolvedValue(undefined),
    getNodeByIdAsync,
    viewport: { scrollAndZoomIntoView }
  };
});

afterEach(() => {
  resetNodeCache();
  delete (globalThis as Record<string, unknown>)['figma'];
});

describe('handleCreateDesign', () => {
  it('builds nested designs, preserves parent links, and de-duplicates response keys', async () => {
    const result = await handleCreateDesign({
      spec: {
        type: 'frame',
        name: 'Card',
        props: {
          width: 320,
          height: 160,
          layoutMode: 'VERTICAL',
          padding: 16,
          paddingLeft: 8,
          itemSpacing: 12,
          fillColor: '#336699'
        },
        children: [
          {
            type: 'text',
            name: 'Label',
            props: {
              content: 'Hello',
              fontFamily: 'Inter',
              fontWeight: 700,
              fontSize: 18,
              color: '#FFFFFF'
            }
          },
          {
            type: 'rectangle',
            name: 'Label',
            props: { width: 20, height: 8, cornerRadius: 4 }
          }
        ]
      }
    });

    const root = currentPage.children[0];
    const text = (root as MockContainerNode).children[0];
    const duplicateNameRect = (root as MockContainerNode).children[1];

    expect(root).toMatchObject({
      name: 'Card',
      width: 320,
      height: 160,
      layoutMode: 'VERTICAL',
      itemSpacing: 12,
      paddingLeft: 8,
      paddingRight: 16,
      fills: [{ type: 'SOLID', color: { r: 0x33 / 255, g: 0x66 / 255, b: 0x99 / 255 }, opacity: 1 }]
    });
    expect(text).toMatchObject({
      type: 'TEXT',
      name: 'Label',
      characters: 'Hello',
      fontName: { family: 'Inter', style: 'Bold' },
      fontSize: 18,
      parent: root
    });
    expect(duplicateNameRect).toMatchObject({
      type: 'RECTANGLE',
      name: 'Label',
      width: 20,
      height: 8,
      cornerRadius: 4,
      parent: root
    });
    expect(result).toMatchObject({
      rootNodeId: root?.id,
      totalNodes: 3,
      nodeIds: {
        Card: root?.id,
        Label: text?.id,
        'Label (2)': duplicateNameRect?.id
      }
    });
    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nodeId: root?.id, parentId: null }),
        expect.objectContaining({ nodeId: text?.id, parentId: root?.id }),
        expect.objectContaining({ nodeId: duplicateNameRect?.id, parentId: root?.id })
      ])
    );
    expect(scrollAndZoomIntoView).toHaveBeenCalledWith([root]);
  });

  it('attaches the root design under an explicit container parent', async () => {
    const parent = makeContainer('FRAME');
    parent.id = 'parent-1';
    getNodeByIdAsync.mockResolvedValue(parent);

    const result = await handleCreateDesign({
      parentId: 'parent-1',
      spec: { type: 'rectangle', name: 'Child', props: { width: 12, height: 14 } }
    });

    expect(parent.children).toHaveLength(1);
    expect(parent.children[0]).toMatchObject({ name: 'Child', width: 12, height: 14, parent });
    expect(result.nodes).toEqual([
      expect.objectContaining({ nodeId: parent.children[0]?.id, parentId: 'parent-1' })
    ]);
  });

  it.fails(
    'KNOWN BUG: rolls back already-created nodes when a nested child spec is unsupported',
    async () => {
      await expect(
        handleCreateDesign({
          spec: {
            type: 'frame',
            name: 'Partially created root',
            children: [{ type: 'unsupported-shape', name: 'Bad child' }]
          }
        })
      ).rejects.toThrow('Unsupported node type: unsupported-shape');

      expect(currentPage.children).toHaveLength(0);
    }
  );
});
