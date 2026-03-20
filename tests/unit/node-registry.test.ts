/**
 * Node Registry Unit Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  NodeRegistry,
  getNodeRegistry,
  resetNodeRegistry
} from '../../mcp-server/src/node-registry.js';

describe('NodeRegistry', () => {
  let registry: NodeRegistry;

  beforeEach(() => {
    registry = new NodeRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  describe('register', () => {
    it('stores a node and retrieves it by ID', () => {
      registry.register('n1', { type: 'FRAME', name: 'Root', parentId: null, children: [] });
      const node = registry.getNode('n1');
      expect(node?.nodeId).toBe('n1');
      expect(node?.type).toBe('FRAME');
      expect(node?.name).toBe('Root');
    });

    it('tracks root nodes (parentId === null)', () => {
      registry.register('n1', { type: 'FRAME', name: 'Root', parentId: null, children: [] });
      const roots = registry.getRootNodes();
      expect(roots).toHaveLength(1);
      expect(roots[0].nodeId).toBe('n1');
    });

    it('adds child to parent children list', () => {
      registry.register('p', { type: 'FRAME', name: 'Parent', parentId: null, children: [] });
      registry.register('c', { type: 'TEXT', name: 'Child', parentId: 'p', children: [] });

      const parent = registry.getNode('p');
      expect(parent?.children).toContain('c');
    });
  });

  describe('getChildren', () => {
    it('returns direct children', () => {
      registry.register('p', { type: 'FRAME', name: 'Parent', parentId: null, children: [] });
      registry.register('c1', { type: 'TEXT', name: 'Child 1', parentId: 'p', children: [] });
      registry.register('c2', { type: 'TEXT', name: 'Child 2', parentId: 'p', children: [] });

      const children = registry.getChildren('p');
      expect(children).toHaveLength(2);
      expect(children.map((c) => c.nodeId)).toEqual(['c1', 'c2']);
    });

    it('returns empty array for node without children', () => {
      registry.register('leaf', { type: 'TEXT', name: 'Leaf', parentId: null, children: [] });
      expect(registry.getChildren('leaf')).toHaveLength(0);
    });

    it('returns empty array for non-existent node', () => {
      expect(registry.getChildren('missing')).toHaveLength(0);
    });
  });

  describe('getDescendants', () => {
    it('returns all nested descendants', () => {
      registry.register('root', { type: 'FRAME', name: 'Root', parentId: null, children: [] });
      registry.register('child', { type: 'FRAME', name: 'Child', parentId: 'root', children: [] });
      registry.register('grandchild', {
        type: 'TEXT',
        name: 'GC',
        parentId: 'child',
        children: []
      });

      const descendants = registry.getDescendants('root');
      expect(descendants).toHaveLength(2);
      expect(descendants.map((d) => d.nodeId)).toEqual(['child', 'grandchild']);
    });
  });

  describe('remove', () => {
    it('removes node and all descendants', () => {
      registry.register('root', { type: 'FRAME', name: 'Root', parentId: null, children: [] });
      registry.register('child', { type: 'FRAME', name: 'Child', parentId: 'root', children: [] });
      registry.register('gc', { type: 'TEXT', name: 'GC', parentId: 'child', children: [] });

      registry.remove('root');

      expect(registry.getNode('root')).toBeNull();
      expect(registry.getNode('child')).toBeNull();
      expect(registry.getNode('gc')).toBeNull();
      expect(registry.getRootNodes()).toHaveLength(0);
    });

    it('removes child from parent children list', () => {
      registry.register('p', { type: 'FRAME', name: 'Parent', parentId: null, children: [] });
      registry.register('c', { type: 'TEXT', name: 'Child', parentId: 'p', children: [] });

      registry.remove('c');

      const parent = registry.getNode('p');
      expect(parent?.children).not.toContain('c');
    });
  });

  describe('findByType', () => {
    it('returns nodes matching the type', () => {
      registry.register('f1', { type: 'FRAME', name: 'F1', parentId: null, children: [] });
      registry.register('t1', { type: 'TEXT', name: 'T1', parentId: null, children: [] });
      registry.register('f2', { type: 'FRAME', name: 'F2', parentId: null, children: [] });

      const frames = registry.findByType('FRAME');
      expect(frames).toHaveLength(2);
    });
  });

  describe('findByName', () => {
    it('finds by partial name match', () => {
      registry.register('n1', {
        type: 'FRAME',
        name: 'Header Section',
        parentId: null,
        children: []
      });
      registry.register('n2', { type: 'TEXT', name: 'Footer', parentId: null, children: [] });

      const found = registry.findByName('Header');
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe('Header Section');
    });

    it('finds by exact name match', () => {
      registry.register('n1', { type: 'FRAME', name: 'Header', parentId: null, children: [] });
      registry.register('n2', {
        type: 'FRAME',
        name: 'Header Section',
        parentId: null,
        children: []
      });

      const found = registry.findByName('Header', true);
      expect(found).toHaveLength(1);
    });
  });

  describe('getStats', () => {
    it('returns accurate node counts', () => {
      registry.register('f1', { type: 'FRAME', name: 'F1', parentId: null, children: [] });
      registry.register('t1', { type: 'TEXT', name: 'T1', parentId: 'f1', children: [] });
      registry.register('t2', { type: 'TEXT', name: 'T2', parentId: 'f1', children: [] });

      const stats = registry.getStats();
      expect(stats.totalNodes).toBe(3);
      expect(stats.rootNodes).toBe(1);
      expect(stats.nodesByType).toEqual({ FRAME: 1, TEXT: 2 });
    });
  });

  describe('getHierarchy', () => {
    it('returns tree structure from root nodes', () => {
      registry.register('root', { type: 'FRAME', name: 'Root', parentId: null, children: [] });
      registry.register('child', { type: 'TEXT', name: 'Child', parentId: 'root', children: [] });

      const hierarchy = registry.getHierarchy();
      expect(hierarchy).toHaveLength(1);
      expect(hierarchy[0].nodeId).toBe('root');
      expect(hierarchy[0].children).toHaveLength(1);
      expect(hierarchy[0].children[0].nodeId).toBe('child');
    });
  });

  describe('toJSON / fromJSON', () => {
    it('serializes and deserializes registry state', () => {
      registry.register('r', { type: 'FRAME', name: 'R', parentId: null, children: [] });
      registry.register('c', { type: 'TEXT', name: 'C', parentId: 'r', children: [] });

      const json = registry.toJSON();
      const newRegistry = new NodeRegistry();
      newRegistry.fromJSON(json);

      expect(newRegistry.getNode('r')?.name).toBe('R');
      expect(newRegistry.getNode('c')?.name).toBe('C');
      expect(newRegistry.getAllNodes()).toHaveLength(2);
    });

    it('preserves parent-child relationships through serialization', () => {
      registry.register('p', { type: 'FRAME', name: 'P', parentId: null, children: [] });
      registry.register('c', { type: 'TEXT', name: 'C', parentId: 'p', children: [] });

      const json = registry.toJSON();
      const restored = new NodeRegistry();
      restored.fromJSON(json);

      expect(restored.getChildren('p')).toHaveLength(1);
      expect(restored.getChildren('p')[0].nodeId).toBe('c');
    });
  });
});

describe('NodeRegistry edge cases', () => {
  let registry: NodeRegistry;

  beforeEach(() => {
    registry = new NodeRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  describe('basic edge cases', () => {
    it('getNode returns null for non-existent ID', () => {
      expect(registry.getNode('does-not-exist')).toBeNull();
    });

    it('remove is a no-op for non-existent ID', () => {
      expect(() => registry.remove('does-not-exist')).not.toThrow();
    });

    it('handles deep hierarchy (5 levels)', () => {
      registry.register('l0', { type: 'FRAME', name: 'L0', parentId: null, children: [] });
      registry.register('l1', { type: 'FRAME', name: 'L1', parentId: 'l0', children: [] });
      registry.register('l2', { type: 'FRAME', name: 'L2', parentId: 'l1', children: [] });
      registry.register('l3', { type: 'FRAME', name: 'L3', parentId: 'l2', children: [] });
      registry.register('l4', { type: 'TEXT', name: 'L4', parentId: 'l3', children: [] });

      const descendants = registry.getDescendants('l0');
      expect(descendants).toHaveLength(4);
      expect(descendants.map((d) => d.nodeId)).toEqual(['l1', 'l2', 'l3', 'l4']);
    });

    it('getDescendants returns empty for non-existent node', () => {
      expect(registry.getDescendants('missing')).toHaveLength(0);
    });

    it('findByType returns empty for unmatched type', () => {
      registry.register('n1', { type: 'FRAME', name: 'F1', parentId: null, children: [] });
      expect(registry.findByType('ELLIPSE')).toHaveLength(0);
    });

    it('findByName with empty string matches all nodes (empty is substring of everything)', () => {
      registry.register('n1', { type: 'FRAME', name: 'Test', parentId: null, children: [] });
      registry.register('n2', { type: 'TEXT', name: 'Other', parentId: null, children: [] });
      // String.includes('') returns true for any string
      const found = registry.findByName('');
      expect(found).toHaveLength(2);
    });

    it('clear empties the registry completely', () => {
      registry.register('a', { type: 'FRAME', name: 'A', parentId: null, children: [] });
      registry.register('b', { type: 'TEXT', name: 'B', parentId: 'a', children: [] });
      registry.clear();

      expect(registry.getAllNodes()).toHaveLength(0);
      expect(registry.getRootNodes()).toHaveLength(0);
      expect(registry.getStats().totalNodes).toBe(0);
    });

    it('re-registering same ID overwrites the previous value', () => {
      registry.register('n1', { type: 'FRAME', name: 'V1', parentId: null, children: [] });
      registry.register('n1', { type: 'FRAME', name: 'V2', parentId: null, children: [] });

      const allNodes = registry.getAllNodes();
      const n1Nodes = allNodes.filter((n) => n.nodeId === 'n1');
      expect(n1Nodes).toHaveLength(1);
      expect(n1Nodes[0].name).toBe('V2');
    });

    it('re-registering root node does not duplicate rootNodes entry', () => {
      registry.register('r1', { type: 'FRAME', name: 'V1', parentId: null, children: [] });
      registry.register('r1', { type: 'FRAME', name: 'V2', parentId: null, children: [] });

      expect(registry.getRootNodes()).toHaveLength(1);
    });

    it('re-registering child under different parent leaves orphan entry in old parent children list', () => {
      // This tests actual behavior: Map.set overwrites the node but doesn't clean old parent
      registry.register('p1', { type: 'FRAME', name: 'P1', parentId: null, children: [] });
      registry.register('p2', { type: 'FRAME', name: 'P2', parentId: null, children: [] });
      registry.register('child', { type: 'TEXT', name: 'C', parentId: 'p1', children: [] });

      const p1Before = registry.getNode('p1');
      expect(p1Before?.children).toContain('child');

      // Re-register under p2 — production code does NOT clean up p1.children
      registry.register('child', { type: 'TEXT', name: 'C', parentId: 'p2', children: [] });

      const p1After = registry.getNode('p1');
      const p2After = registry.getNode('p2');
      // Bug exposure: p1 still has 'child' in its children despite child now pointing to p2
      expect(p1After?.children).toContain('child');
      expect(p2After?.children).toContain('child');
    });

    it('getHierarchy with multiple roots', () => {
      registry.register('r1', { type: 'FRAME', name: 'Root1', parentId: null, children: [] });
      registry.register('r2', { type: 'FRAME', name: 'Root2', parentId: null, children: [] });

      const hierarchy = registry.getHierarchy();
      expect(hierarchy).toHaveLength(2);
    });

    it('update modifies node fields without changing nodeId or createdAt', () => {
      registry.register('n1', { type: 'FRAME', name: 'Original', parentId: null, children: [] });
      const originalCreatedAt = registry.getNode('n1')!.createdAt;

      registry.update('n1', { name: 'Updated' });

      const updated = registry.getNode('n1');
      expect(updated?.name).toBe('Updated');
      expect(updated?.nodeId).toBe('n1');
      expect(updated?.createdAt).toBe(originalCreatedAt);
    });

    it('update is a no-op for non-existent node', () => {
      expect(() => registry.update('missing', { name: 'X' })).not.toThrow();
    });

    it('has returns true for registered node and false for missing', () => {
      registry.register('n1', { type: 'FRAME', name: 'F', parentId: null, children: [] });
      expect(registry.has('n1')).toBe(true);
      expect(registry.has('n2')).toBe(false);
    });

    it('remove middle node detaches subtree but preserves parent', () => {
      registry.register('root', { type: 'FRAME', name: 'Root', parentId: null, children: [] });
      registry.register('mid', { type: 'FRAME', name: 'Mid', parentId: 'root', children: [] });
      registry.register('leaf', { type: 'TEXT', name: 'Leaf', parentId: 'mid', children: [] });

      registry.remove('mid');

      expect(registry.getNode('root')?.name).toBe('Root');
      expect(registry.getNode('root')?.children).not.toContain('mid');
      expect(registry.getNode('mid')).toBeNull();
      expect(registry.getNode('leaf')).toBeNull();
    });

    it('fromJSON with invalid JSON does not crash', () => {
      expect(() => registry.fromJSON('not valid json')).not.toThrow();
      expect(registry.getAllNodes()).toHaveLength(0);
    });

    it('getStats nodesByType is correct after mixed add/remove', () => {
      registry.register('f1', { type: 'FRAME', name: 'F1', parentId: null, children: [] });
      registry.register('t1', { type: 'TEXT', name: 'T1', parentId: 'f1', children: [] });
      registry.register('t2', { type: 'TEXT', name: 'T2', parentId: 'f1', children: [] });
      registry.remove('t1');

      const stats = registry.getStats();
      expect(stats.totalNodes).toBe(2);
      expect(stats.nodesByType).toEqual({ FRAME: 1, TEXT: 1 });
    });

    it('findByName case-sensitive partial match', () => {
      registry.register('n1', { type: 'FRAME', name: 'Header', parentId: null, children: [] });
      registry.register('n2', { type: 'FRAME', name: 'header', parentId: null, children: [] });

      expect(registry.findByName('Header')).toHaveLength(1);
      expect(registry.findByName('header')).toHaveLength(1);
      expect(registry.findByName('eader')).toHaveLength(2); // partial match both
    });

    it('getHierarchy includes bounds when present', () => {
      registry.register('n1', {
        type: 'FRAME',
        name: 'F',
        parentId: null,
        children: [],
        bounds: { x: 10, y: 20, width: 100, height: 50 }
      });

      const hierarchy = registry.getHierarchy();
      expect(hierarchy[0].bounds).toEqual({ x: 10, y: 20, width: 100, height: 50 });
    });

    it('getHierarchy omits bounds when not present', () => {
      registry.register('n1', { type: 'FRAME', name: 'F', parentId: null, children: [] });
      const hierarchy = registry.getHierarchy();
      expect(hierarchy[0].bounds).toBeUndefined();
    });
  });
});

describe('NodeRegistry singleton', () => {
  afterEach(() => {
    resetNodeRegistry();
  });

  it('getNodeRegistry returns the same instance', () => {
    const a = getNodeRegistry();
    const b = getNodeRegistry();
    expect(a).toBe(b);
  });

  it('resetNodeRegistry creates a fresh instance', () => {
    const a = getNodeRegistry();
    a.register('n1', { type: 'FRAME', name: 'F', parentId: null, children: [] });

    resetNodeRegistry();
    const b = getNodeRegistry();
    expect(b.getNode('n1')).toBeNull();
    expect(b.getAllNodes()).toHaveLength(0);
  });
});

describe('NodeRegistry advanced edge cases', () => {
  it('register child with non-existent parent ID does not crash', () => {
    const registry = new NodeRegistry();
    // Parent 'ghost' does not exist — child should still be registered
    registry.register('child', { type: 'TEXT', name: 'Orphan', parentId: 'ghost', children: [] });

    const child = registry.getNode('child');
    expect(child?.parentId).toBe('ghost');

    // But 'ghost' doesn't exist, so getChildren('ghost') returns []
    expect(registry.getChildren('ghost')).toHaveLength(0);
  });

  it('metadata is preserved through register and getNode', () => {
    const registry = new NodeRegistry();
    registry.register('m1', {
      type: 'FRAME',
      name: 'Meta',
      parentId: null,
      children: [],
      metadata: { version: 2, locked: false }
    });

    const node = registry.getNode('m1');
    expect(node?.metadata).toEqual({ version: 2, locked: false });
  });

  it('update preserves metadata while changing other fields', () => {
    const registry = new NodeRegistry();
    registry.register('m1', {
      type: 'FRAME',
      name: 'Original',
      parentId: null,
      children: [],
      metadata: { key: 'value' }
    });

    registry.update('m1', { name: 'Updated' });
    const node = registry.getNode('m1');
    expect(node?.name).toBe('Updated');
    expect(node?.metadata).toEqual({ key: 'value' });
  });

  it('update can change metadata', () => {
    const registry = new NodeRegistry();
    registry.register('m1', {
      type: 'FRAME',
      name: 'F',
      parentId: null,
      children: [],
      metadata: { old: true }
    });

    registry.update('m1', { metadata: { new: true } });
    expect(registry.getNode('m1')?.metadata).toEqual({ new: true });
  });

  it('bounds are preserved through register/getNode/getHierarchy', () => {
    const registry = new NodeRegistry();
    const bounds = { x: 10, y: 20, width: 100, height: 50 };
    registry.register('b1', {
      type: 'FRAME',
      name: 'Bounded',
      parentId: null,
      children: [],
      bounds
    });

    expect(registry.getNode('b1')?.bounds).toEqual(bounds);
    expect(registry.getHierarchy()[0].bounds).toEqual(bounds);
  });

  it('removing a root node with deep hierarchy cleans up everything', () => {
    const registry = new NodeRegistry();
    registry.register('r', { type: 'FRAME', name: 'Root', parentId: null, children: [] });
    registry.register('a', { type: 'FRAME', name: 'A', parentId: 'r', children: [] });
    registry.register('b', { type: 'FRAME', name: 'B', parentId: 'a', children: [] });
    registry.register('c', { type: 'TEXT', name: 'C', parentId: 'b', children: [] });

    registry.remove('r');

    expect(registry.getAllNodes()).toHaveLength(0);
    expect(registry.getRootNodes()).toHaveLength(0);
    expect(registry.getStats().totalNodes).toBe(0);
  });

  it('siblings remain when one sibling is removed', () => {
    const registry = new NodeRegistry();
    registry.register('p', { type: 'FRAME', name: 'P', parentId: null, children: [] });
    registry.register('s1', { type: 'TEXT', name: 'S1', parentId: 'p', children: [] });
    registry.register('s2', { type: 'TEXT', name: 'S2', parentId: 'p', children: [] });
    registry.register('s3', { type: 'TEXT', name: 'S3', parentId: 'p', children: [] });

    registry.remove('s2');

    const parent = registry.getNode('p');
    expect(parent?.children).toEqual(['s1', 's3']);
    expect(registry.getNode('s1')?.name).toBe('S1');
    expect(registry.getNode('s3')?.name).toBe('S3');
    expect(registry.getNode('s2')).toBeNull();
  });

  it('getDescendants returns nodes in depth-first order', () => {
    const registry = new NodeRegistry();
    registry.register('r', { type: 'FRAME', name: 'Root', parentId: null, children: [] });
    registry.register('a', { type: 'FRAME', name: 'A', parentId: 'r', children: [] });
    registry.register('a1', { type: 'TEXT', name: 'A1', parentId: 'a', children: [] });
    registry.register('b', { type: 'FRAME', name: 'B', parentId: 'r', children: [] });
    registry.register('b1', { type: 'TEXT', name: 'B1', parentId: 'b', children: [] });

    const descendants = registry.getDescendants('r');
    const ids = descendants.map((d) => d.nodeId);
    // DFS: a -> a1 -> b -> b1
    expect(ids).toEqual(['a', 'a1', 'b', 'b1']);
  });

  it('getStats counts multiple types correctly', () => {
    const registry = new NodeRegistry();
    registry.register('f1', { type: 'FRAME', name: 'F1', parentId: null, children: [] });
    registry.register('f2', { type: 'FRAME', name: 'F2', parentId: null, children: [] });
    registry.register('t1', { type: 'TEXT', name: 'T1', parentId: 'f1', children: [] });
    registry.register('e1', { type: 'ELLIPSE', name: 'E1', parentId: 'f1', children: [] });
    registry.register('e2', { type: 'ELLIPSE', name: 'E2', parentId: 'f2', children: [] });

    const stats = registry.getStats();
    expect(stats.totalNodes).toBe(5);
    expect(stats.rootNodes).toBe(2);
    expect(stats.nodesByType).toEqual({ FRAME: 2, TEXT: 1, ELLIPSE: 2 });
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

  it('fromJSON with invalid JSON preserves existing state', () => {
    const registry = new NodeRegistry();
    registry.register('n1', { type: 'FRAME', name: 'F', parentId: null, children: [] });

    registry.fromJSON('invalid json');
    // Failed import logs error but preserves existing state
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
});
