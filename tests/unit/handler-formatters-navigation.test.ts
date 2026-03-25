/**
 * Handler formatResponse Tests — Navigation & Registration
 *
 * Tests the MCP output formatting for navigation handlers
 * (get_node_by_id, get_node_by_name, get_children, get_parent)
 * and tool registration completeness.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { getToolRegistry, resetToolRegistry } from '../../mcp-server/src/routing/tool-registry.js';
import { registerAllTools } from '../../mcp-server/src/routing/register-tools.js';

describe('Handler formatResponse — navigation & registration', () => {
  beforeEach(() => {
    resetToolRegistry();
    registerAllTools();
  });

  function getHandler(name: string) {
    const handler = getToolRegistry().get(name);
    if (!handler) throw new Error(`Handler ${name} not registered`);
    return handler;
  }

  describe('get_node_by_id', () => {
    it('formats node with ID, name, type, and dimensions', () => {
      const handler = getHandler('get_node_by_id');
      const result = handler.formatResponse({
        message: 'Node found',
        nodeId: 'n1',
        name: 'Frame',
        type: 'FRAME',
        width: 320,
        height: 480,
        x: 10,
        y: 20
      });
      const text = result[0].text as string;
      expect(text).toContain('Node ID: n1');
      expect(text).toContain('Name: Frame');
      expect(text).toContain('Type: FRAME');
      expect(text).toContain('Dimensions: 320x480');
      expect(text).toContain('Position: (10, 20)');
    });

    it('formats node with layout properties', () => {
      const handler = getHandler('get_node_by_id');
      const result = handler.formatResponse({
        message: 'Node found',
        nodeId: 'n2',
        name: 'AutoFrame',
        type: 'FRAME',
        width: 200,
        height: 400,
        x: 0,
        y: 0,
        layoutMode: 'VERTICAL',
        layoutPositioning: 'AUTO',
        itemSpacing: 16
      });
      const text = result[0].text as string;
      expect(text).toContain('Layout Mode: VERTICAL');
      expect(text).toContain('Layout Positioning: AUTO');
      expect(text).toContain('Item Spacing: 16');
    });
  });

  describe('get_node_by_name', () => {
    it('formats name search with found count and node details', () => {
      const handler = getHandler('get_node_by_name');
      const result = handler.formatResponse({
        message: 'Found 2 nodes matching "Header"',
        found: 2,
        nodes: [
          { nodeId: 'n1', name: 'Header', type: 'FRAME' },
          { nodeId: 'n2', name: 'Header Copy', type: 'FRAME' }
        ],
        count: 2
      });
      const text = result[0].text as string;
      expect(text).toContain('Found: 2 node(s)');
      expect(text).toContain('Header (FRAME) - ID: n1');
      expect(text).toContain('Header Copy (FRAME) - ID: n2');
    });
  });

  describe('get_children', () => {
    it('formats children with name, type, visibility, and lock state', () => {
      const handler = getHandler('get_children');
      const result = handler.formatResponse({
        message: 'Found 2 children',
        nodeId: 'p1',
        childCount: 2,
        children: [
          { nodeId: 'c1', name: 'Title', type: 'TEXT', visible: true, locked: false },
          { nodeId: 'c2', name: 'Icon', type: 'FRAME', visible: false, locked: true }
        ],
        count: 2
      });
      const text = result[0].text as string;
      expect(text).toContain('Node ID: p1');
      expect(text).toContain('Child Count: 2');
      expect(text).toContain('Title (TEXT) - ID: c1');
      expect(text).toContain('Visible: true, Locked: false');
      expect(text).toContain('Icon (FRAME) - ID: c2');
      expect(text).toContain('Visible: false, Locked: true');
    });
  });

  describe('get_parent', () => {
    it('formats parent result with parent fields', () => {
      const handler = getHandler('get_parent');
      const result = handler.formatResponse({
        nodeId: 'c1',
        message: 'Parent found',
        parentId: 'p1',
        parentName: 'Container',
        parentType: 'FRAME'
      });
      const text = result[0].text as string;
      expect(text).toContain('Parent Name: Container');
      expect(text).toContain('Parent ID: p1');
      expect(text).toContain('Parent Type: FRAME');
      expect(text).toContain('Node ID: c1');
    });

    it('formats node without parent', () => {
      const handler = getHandler('get_parent');
      const result = handler.formatResponse({
        nodeId: 'root-1',
        message: 'No parent (root node)'
      });
      const text = result[0].text as string;
      expect(text).toContain('Node ID: root-1');
      expect(text).toContain('No parent (root node)');
    });
  });

  describe('tool registration', () => {
    it('registers all expected tools', () => {
      const registry = getToolRegistry();
      const definitions = registry.listDefinitions();

      const requiredTools = [
        'check_connection',
        'create_design',
        'create_frame',
        'create_text',
        'create_ellipse',
        'create_line',
        'create_polygon',
        'create_star',
        'create_path',
        'create_boolean_operation',
        'create_component',
        'create_instance',
        'create_component_set',
        'set_fills',
        'set_corner_radius',
        'set_stroke',
        'apply_effects',
        'set_transform',
        'set_appearance',
        'set_text_properties',
        'set_layout_properties',
        'set_layout_sizing',
        'set_layout_align',
        'align_nodes',
        'distribute_nodes',
        'get_page_hierarchy',
        'get_selection',
        'get_node_info',
        'get_node_by_id',
        'get_node_by_name',
        'get_children',
        'get_parent',
        'validate_design_tokens',
        'check_wcag_contrast',
        'create_page',
        'list_pages',
        'set_current_page',
        'export_node',
        'set_visible',
        'set_locked'
      ];

      const registeredNames = definitions.map((d) => d.name);
      for (const tool of requiredTools) {
        expect(registeredNames).toContain(tool);
      }
    });

    it('all definitions have name and inputSchema', () => {
      const definitions = getToolRegistry().listDefinitions();
      for (const def of definitions) {
        expect(def.name).toBeTypeOf('string');
        expect(def.inputSchema.type).toBe('object');
      }
    });
  });
});
