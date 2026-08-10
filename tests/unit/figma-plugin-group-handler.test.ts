/**
 * Figma Plugin group_nodes Handler — Unit Tests
 *
 * Uses the real plugin utility handler with a small Figma API mock. This
 * complements MCP-side and simulator e2e tests by exercising the actual Figma
 * plugin grouping behavior.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface MockSceneNode {
  id: string;
  type: 'RECTANGLE' | 'GROUP' | 'FRAME';
  name: string;
  parent: MockParentNode | null;
}

interface MockParentNode {
  id: string;
  type: 'PAGE' | 'FRAME';
  appendChild: ReturnType<typeof vi.fn>;
}

interface MockFigmaApi {
  getNodeById: ReturnType<typeof vi.fn>;
  group: ReturnType<typeof vi.fn>;
  createBooleanOperation: ReturnType<typeof vi.fn>;
  viewport: { scrollAndZoomIntoView: ReturnType<typeof vi.fn> };
}

let nodesById: Map<string, MockSceneNode | MockParentNode>;
let mockFigma: MockFigmaApi;
let parent: MockParentNode;

const { cacheNode, resetNodeCache } = await import('../../figma-plugin/src/helpers.js');
const { handleCreateBooleanOperation, handleGroupNodes } =
  await import('../../figma-plugin/src/handlers/utility.js');

function makeNode(
  id: string,
  name: string,
  nodeParent: MockParentNode | null = parent
): MockSceneNode {
  const node: MockSceneNode = { id, type: 'RECTANGLE', name, parent: nodeParent };
  nodesById.set(id, node);
  cacheNode(node as unknown as SceneNode);
  return node;
}

beforeEach(() => {
  resetNodeCache();
  parent = { id: 'page-1', type: 'PAGE', appendChild: vi.fn() };
  nodesById = new Map<string, MockSceneNode | MockParentNode>([[parent.id, parent]]);
  mockFigma = {
    getNodeById: vi.fn((id: string) => nodesById.get(id) ?? null),
    group: vi.fn((nodes: MockSceneNode[], groupParent: MockParentNode) => {
      const groupNode: MockSceneNode = {
        id: 'group-1',
        type: 'GROUP',
        name: 'Group',
        parent: groupParent
      };
      nodesById.set(groupNode.id, groupNode);
      return groupNode;
    }),
    createBooleanOperation: vi.fn(() => {
      const booleanNode = {
        id: 'boolean-1',
        type: 'GROUP' as const,
        name: 'Boolean',
        parent: parent,
        booleanOperation: 'UNION',
        appendChild: vi.fn()
      };
      nodesById.set(booleanNode.id, booleanNode);
      return booleanNode;
    }),
    viewport: { scrollAndZoomIntoView: vi.fn() }
  };
  (globalThis as Record<string, unknown>)['figma'] = mockFigma;
});

afterEach(() => {
  resetNodeCache();
  delete (globalThis as Record<string, unknown>)['figma'];
});

describe('handleGroupNodes', () => {
  it('groups cached nodes into an explicit parent and names the resulting group', () => {
    const first = makeNode('node-1', 'Icon');
    const second = makeNode('node-2', 'Label');
    const explicitParent: MockParentNode = { id: 'frame-1', type: 'FRAME', appendChild: vi.fn() };
    nodesById.set(explicitParent.id, explicitParent);
    cacheNode(explicitParent as unknown as SceneNode);

    const result = handleGroupNodes({
      nodeIds: ['node-1', 'node-2'],
      name: 'Nav Item',
      parentId: 'frame-1'
    });

    expect(mockFigma.group).toHaveBeenCalledWith([first, second], explicitParent);
    expect(result).toMatchObject({
      groupId: 'group-1',
      nodeCount: 2,
      message: 'Grouped 2 node(s) into "Nav Item"'
    });
    expect((nodesById.get('group-1') as MockSceneNode).name).toBe('Nav Item');
    expect(mockFigma.viewport.scrollAndZoomIntoView).toHaveBeenCalledWith([
      nodesById.get('group-1')
    ]);
  });

  it('uses the first node parent when parentId is omitted', () => {
    const first = makeNode('node-1', 'Icon');
    const second = makeNode('node-2', 'Label');

    handleGroupNodes({ nodeIds: ['node-1', 'node-2'] });

    expect(mockFigma.group).toHaveBeenCalledWith([first, second], parent);
  });

  it('rejects requests where none of the requested nodes can be resolved', () => {
    expect(() => handleGroupNodes({ nodeIds: ['missing-1'], name: 'Missing' })).toThrow(
      'Could not find any of the specified nodes'
    );
    expect(mockFigma.group).not.toHaveBeenCalled();
  });

  it('rejects explicit parents that cannot contain children', () => {
    makeNode('node-1', 'Icon');
    nodesById.set('leaf-1', { id: 'leaf-1', type: 'RECTANGLE', name: 'Leaf', parent });
    cacheNode(nodesById.get('leaf-1') as SceneNode);

    expect(() => handleGroupNodes({ nodeIds: ['node-1'], parentId: 'leaf-1' })).toThrow(
      'Parent does not support children'
    );
  });
});

describe('handleCreateBooleanOperation', () => {
  it('creates a boolean node from all requested nodes and returns booleanNodeId', () => {
    const first = makeNode('node-1', 'Circle A');
    const second = makeNode('node-2', 'Circle B');

    const result = handleCreateBooleanOperation({
      nodeIds: ['node-1', 'node-2'],
      name: 'Lens',
      operation: 'INTERSECT'
    });

    const booleanNode = nodesById.get('boolean-1') as MockSceneNode & {
      booleanOperation: string;
      appendChild: ReturnType<typeof vi.fn>;
    };
    expect(mockFigma.createBooleanOperation).toHaveBeenCalledOnce();
    expect(booleanNode.name).toBe('Lens');
    expect(booleanNode.booleanOperation).toBe('INTERSECT');
    expect(booleanNode.appendChild).toHaveBeenCalledWith(first);
    expect(booleanNode.appendChild).toHaveBeenCalledWith(second);
    expect(result).toMatchObject({
      booleanNodeId: 'boolean-1',
      operation: 'INTERSECT',
      nodeCount: 2
    });
    expect(mockFigma.viewport.scrollAndZoomIntoView).toHaveBeenCalledWith([booleanNode]);
  });

  it('rejects boolean operations when any requested node is missing', () => {
    makeNode('node-1', 'Circle A');

    expect(() =>
      handleCreateBooleanOperation({
        nodeIds: ['node-1', 'missing-node'],
        operation: 'UNION'
      })
    ).toThrow('Could not find all nodes for boolean operation');
    expect(mockFigma.createBooleanOperation).not.toHaveBeenCalled();
  });
});
