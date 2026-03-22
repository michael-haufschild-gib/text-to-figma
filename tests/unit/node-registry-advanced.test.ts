/**
 * Node Registry — Cycle Detection, Depth Limits, and JSON Serialization Tests
 *
 * Split from node-registry.test.ts to stay under the 500-line file limit.
 */

import { describe, expect, it } from 'vitest';
import { NodeRegistry } from '../../mcp-server/src/node-registry.js';

describe('NodeRegistry cycle detection and depth limits', () => {
  it('getDescendants detects cycles and stops traversal without infinite loop', () => {
    const registry = new NodeRegistry();
    // Create a cycle: A -> B -> C -> A (via manual children manipulation)
    registry.register('a', { type: 'FRAME', name: 'A', parentId: null, children: [] });
    registry.register('b', { type: 'FRAME', name: 'B', parentId: 'a', children: [] });
    registry.register('c', { type: 'FRAME', name: 'C', parentId: 'b', children: [] });

    // Manually inject cycle: make C point back to A in children list
    const nodeC = registry.getNode('c')!;
    nodeC.children.push('a');

    // getDescendants should NOT infinite loop — it uses a visited Set.
    const descendants = registry.getDescendants('a');
    const ids = descendants.map((d) => d.nodeId);
    expect(ids).toContain('b');
    expect(ids).toContain('c');
    // 'a' appears once (as c's child) but recursion stops — no infinite loop
    expect(ids.filter((id) => id === 'a')).toHaveLength(1);
    // Total count is bounded — proves no infinite loop
    expect(ids.length).toBeLessThanOrEqual(4);
  });

  it('getDescendants respects maxDepth parameter', () => {
    const registry = new NodeRegistry();
    // Build a chain: l0 -> l1 -> l2 -> l3 -> l4
    registry.register('l0', { type: 'FRAME', name: 'L0', parentId: null, children: [] });
    registry.register('l1', { type: 'FRAME', name: 'L1', parentId: 'l0', children: [] });
    registry.register('l2', { type: 'FRAME', name: 'L2', parentId: 'l1', children: [] });
    registry.register('l3', { type: 'FRAME', name: 'L3', parentId: 'l2', children: [] });
    registry.register('l4', { type: 'TEXT', name: 'L4', parentId: 'l3', children: [] });

    // maxDepth=2 should only get l1 and l2 (2 levels deep)
    const limited = registry.getDescendants('l0', 2);
    const ids = limited.map((d) => d.nodeId);
    expect(ids).toContain('l1');
    expect(ids).toContain('l2');
    // l3 and l4 are deeper than maxDepth=2
    expect(ids).not.toContain('l3');
    expect(ids).not.toContain('l4');
  });

  it('getDescendants with maxDepth=1 returns only direct children', () => {
    const registry = new NodeRegistry();
    registry.register('root', { type: 'FRAME', name: 'Root', parentId: null, children: [] });
    registry.register('child', { type: 'FRAME', name: 'Child', parentId: 'root', children: [] });
    registry.register('gc', { type: 'TEXT', name: 'GC', parentId: 'child', children: [] });

    const limited = registry.getDescendants('root', 1);
    expect(limited).toHaveLength(1);
    expect(limited[0].nodeId).toBe('child');
  });

  it('getDescendants with maxDepth=0 returns empty array', () => {
    const registry = new NodeRegistry();
    registry.register('root', { type: 'FRAME', name: 'Root', parentId: null, children: [] });
    registry.register('child', { type: 'TEXT', name: 'Child', parentId: 'root', children: [] });

    const limited = registry.getDescendants('root', 0);
    expect(limited).toHaveLength(0);
  });

  it('mutual cycle between two nodes terminates without infinite recursion', () => {
    const registry = new NodeRegistry();
    registry.register('x', { type: 'FRAME', name: 'X', parentId: null, children: [] });
    registry.register('y', { type: 'FRAME', name: 'Y', parentId: 'x', children: [] });

    // Create mutual cycle: x -> y -> x
    const nodeY = registry.getNode('y')!;
    nodeY.children.push('x');

    const descendants = registry.getDescendants('x');
    const ids = descendants.map((d) => d.nodeId);

    expect(ids).toContain('y');
    expect(ids).toContain('x'); // appears once from y's children list
    // The important thing: it terminates (no infinite loop)
    expect(ids.length).toBeLessThanOrEqual(3); // bounded, not infinite
  });
});

describe('NodeRegistry remove edge cases', () => {
  it('remove parent after child was already independently removed', () => {
    const registry = new NodeRegistry();
    registry.register('p', { type: 'FRAME', name: 'Parent', parentId: null, children: [] });
    registry.register('c1', { type: 'TEXT', name: 'C1', parentId: 'p', children: [] });
    registry.register('c2', { type: 'TEXT', name: 'C2', parentId: 'p', children: [] });

    // Remove child c1 independently
    registry.remove('c1');
    expect(registry.getNode('c1')).toBeNull();
    // Parent's children array was updated by remove('c1')
    expect(registry.getNode('p')!.children).not.toContain('c1');

    // Now remove parent — should clean up c2 as descendant, not crash on missing c1
    registry.remove('p');
    expect(registry.getNode('p')).toBeNull();
    expect(registry.getNode('c2')).toBeNull();
    expect(registry.getAllNodes()).toHaveLength(0);
    expect(registry.getRootNodes()).toHaveLength(0);
  });

  it('remove node with stale child IDs in children array does not crash', () => {
    const registry = new NodeRegistry();
    registry.register('p', { type: 'FRAME', name: 'Parent', parentId: null, children: [] });
    registry.register('c', { type: 'TEXT', name: 'Child', parentId: 'p', children: [] });

    // Manually inject a stale child ID that doesn't exist in the map
    const parent = registry.getNode('p')!;
    parent.children.push('ghost-node');

    // remove('p') calls getDescendants which calls getChildren which filters
    // out nodes not in the map. 'ghost-node' should be silently skipped.
    expect(() => registry.remove('p')).not.toThrow();
    expect(registry.getAllNodes()).toHaveLength(0);
  });
});

describe('NodeRegistry JSON serialization', () => {
  it('toJSON produces valid JSON string', () => {
    const registry = new NodeRegistry();
    registry.register('n1', { type: 'FRAME', name: 'F', parentId: null, children: [] });

    const json = registry.toJSON();
    expect(() => JSON.parse(json) as unknown).not.toThrow();
  });

  it('empty registry serializes and deserializes', () => {
    const registry = new NodeRegistry();
    const json = registry.toJSON();

    const restored = new NodeRegistry();
    restored.fromJSON(json);
    expect(restored.getAllNodes()).toHaveLength(0);
  });

  it('fromJSON with invalid JSON throws and preserves existing state', () => {
    const registry = new NodeRegistry();
    registry.register('n1', { type: 'FRAME', name: 'F', parentId: null, children: [] });

    expect(() => registry.fromJSON('invalid json')).toThrow(SyntaxError);
    // Parse failure throws before mutating state — existing data preserved
    expect(registry.getAllNodes()).toHaveLength(1);
    expect(registry.getNode('n1')?.name).toBe('F');
  });

  it('round-trip preserves node count and hierarchy', () => {
    const registry = new NodeRegistry();
    registry.register('root', { type: 'FRAME', name: 'Root', parentId: null, children: [] });
    registry.register('child', { type: 'TEXT', name: 'Child', parentId: 'root', children: [] });

    const json = registry.toJSON();
    const restored = new NodeRegistry();
    restored.fromJSON(json);

    expect(restored.getAllNodes()).toHaveLength(2);
    expect(restored.getRootNodes()).toHaveLength(1);
    expect(restored.getNode('root')?.name).toBe('Root');
    expect(restored.getNode('child')?.parentId).toBe('root');
  });

  it('round-trip preserves bounds data', () => {
    const registry = new NodeRegistry();
    registry.register('n1', {
      type: 'FRAME',
      name: 'F',
      parentId: null,
      children: [],
      bounds: { x: 10, y: 20, width: 300, height: 200 }
    });

    const json = registry.toJSON();
    const restored = new NodeRegistry();
    restored.fromJSON(json);

    expect(restored.getNode('n1')?.bounds).toEqual({ x: 10, y: 20, width: 300, height: 200 });
  });

  it('fromJSON rejects structurally valid JSON that fails Zod schema', () => {
    const registry = new NodeRegistry();

    // Valid JSON but wrong structure — nodes should be array of tuples
    const badStructure = JSON.stringify({
      nodes: { n1: { type: 'FRAME' } }, // object instead of array of tuples
      rootNodes: ['n1']
    });

    expect(() => registry.fromJSON(badStructure)).toThrow();
  });

  it('fromJSON rejects when node data is missing required fields', () => {
    const registry = new NodeRegistry();

    // Missing 'name' field in node info
    const incompleteNode = JSON.stringify({
      nodes: [['n1', { nodeId: 'n1', type: 'FRAME', parentId: null, children: [], createdAt: 0 }]],
      rootNodes: ['n1']
    });

    expect(() => registry.fromJSON(incompleteNode)).toThrow();
  });

  it('fromJSON overwrites current state completely', () => {
    const registry = new NodeRegistry();
    registry.register('old', { type: 'FRAME', name: 'Old', parentId: null, children: [] });

    const newData = JSON.stringify({
      nodes: [
        [
          'new',
          {
            nodeId: 'new',
            type: 'TEXT',
            name: 'New',
            parentId: null,
            children: [],
            createdAt: 1000
          }
        ]
      ],
      rootNodes: ['new']
    });

    registry.fromJSON(newData);
    expect(registry.getNode('old')).toBeNull();
    expect(registry.getNode('new')?.name).toBe('New');
    expect(registry.getAllNodes()).toHaveLength(1);
  });
});
