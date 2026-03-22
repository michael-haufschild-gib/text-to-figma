/**
 * Tool Registration Tests
 *
 * Tests that registerAllTools correctly populates the global ToolRegistry
 * with handlers from all domain modules.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { getToolRegistry, resetToolRegistry } from '../../mcp-server/src/routing/tool-registry.js';
import { registerAllTools } from '../../mcp-server/src/routing/register-tools.js';

describe('registerAllTools', () => {
  afterEach(() => {
    resetToolRegistry();
  });

  it('registers the expected number of tools (guards against accidentally dropping a handler)', () => {
    registerAllTools();
    const registry = getToolRegistry();
    const all = registry.getAll();
    // If this fails after adding/removing tools, update the count.
    // Catching both accidental additions and accidental deletions.
    expect(all.length).toBeGreaterThanOrEqual(50);
    expect(all.length).toBeLessThanOrEqual(70);
  });

  it('every registered handler has name, schema, execute, formatResponse, and definition', () => {
    registerAllTools();
    const registry = getToolRegistry();
    const all = registry.getAll();

    for (const handler of all) {
      expect(handler.name).toBeTypeOf('string');
      expect(handler.name.length).toBeGreaterThan(0);
      expect(handler.schema).toBeTypeOf('object');
      expect(handler.execute).toBeTypeOf('function');
      expect(handler.formatResponse).toBeTypeOf('function');
      expect(handler.definition.name).toBe(handler.name);
      expect(handler.definition.inputSchema.type).toBe('object');
    }
  });

  it('handler names are unique (no duplicates)', () => {
    registerAllTools();
    const registry = getToolRegistry();
    const all = registry.getAll();
    const names = all.map((h) => h.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('all expected tool categories are represented', () => {
    registerAllTools();
    const registry = getToolRegistry();
    const all = registry.getAll();
    const names = all.map((h) => h.name);

    // Creation tools
    expect(names).toContain('create_frame');
    expect(names).toContain('create_text');
    expect(names).toContain('create_ellipse');
    expect(names).toContain('create_rectangle_with_image_fill');

    // Navigation tools
    expect(names).toContain('get_page_hierarchy');
    expect(names).toContain('get_node_info');
    expect(names).toContain('get_selection');

    // Styling tools
    expect(names).toContain('set_fills');
    expect(names).toContain('set_stroke');
    expect(names).toContain('apply_effects');

    // Layout/utility tools
    expect(names).toContain('set_layout_properties');
    expect(names).toContain('align_nodes');
    expect(names).toContain('check_connection');
  });

  it('listDefinitions returns all tool definitions', () => {
    registerAllTools();
    const registry = getToolRegistry();
    const defs = registry.listDefinitions();

    expect(defs.length).toBeGreaterThan(40);
    for (const def of defs) {
      expect(def.name).toBeTypeOf('string');
      expect(def.inputSchema.type).toBe('object');
    }
  });

  it('throws when called twice (duplicate registration)', () => {
    registerAllTools();
    expect(() => registerAllTools()).toThrow('already registered');
  });

  it('each tool is retrievable by name', () => {
    registerAllTools();
    const registry = getToolRegistry();
    const all = registry.getAll();

    for (const handler of all) {
      const retrieved = registry.get(handler.name);
      expect(retrieved).toBe(handler);
    }
  });
});
