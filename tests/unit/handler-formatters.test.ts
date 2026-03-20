/**
 * Handler formatResponse Tests — Creation, Styling & Navigation
 *
 * Tests the MCP output formatting for creation, styling, and navigation
 * handler groups. Verifies that tool results are correctly serialized
 * into the text format returned to LLM agents.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { getToolRegistry, resetToolRegistry } from '../../mcp-server/src/routing/tool-registry.js';
import { registerAllTools } from '../../mcp-server/src/routing/register-tools.js';

describe('Handler formatResponse — creation, styling, navigation', () => {
  beforeEach(() => {
    resetToolRegistry();
    registerAllTools();
  });

  function getHandler(name: string) {
    const handler = getToolRegistry().get(name);
    if (!handler) throw new Error(`Handler ${name} not registered`);
    return handler;
  }

  // ─── Creation handlers ───────────────────────────────────────────────

  describe('check_connection', () => {
    it('formats connected state with diagnostics', () => {
      const handler = getHandler('check_connection');
      const result = handler.formatResponse({
        connected: true,
        figmaFile: 'Design.fig',
        currentPage: 'Page 1',
        latencyMs: 42,
        pluginVersion: '1.0.0',
        circuitBreakerState: 'CLOSED',
        pendingRequests: 0,
        wsReadyStateText: 'OPEN',
        message: 'Connected to Figma'
      });

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('text');
      const text = result[0].text as string;
      expect(text).toContain('CONNECTED');
      expect(text).toContain('Design.fig');
      expect(text).toContain('Page 1');
      expect(text).toContain('42ms');
      expect(text).toContain('1.0.0');
      expect(text).toContain('CLOSED');
    });

    it('formats disconnected state', () => {
      const handler = getHandler('check_connection');
      const result = handler.formatResponse({
        connected: false,
        circuitBreakerState: 'OPEN',
        pendingRequests: 0,
        error: 'Connection refused',
        message: 'Not connected'
      });

      const text = result[0].text as string;
      expect(text).toContain('DISCONNECTED');
      expect(text).toContain('Connection refused');
    });
  });

  describe('create_frame', () => {
    it('formats frame creation result', () => {
      const handler = getHandler('create_frame');
      const result = handler.formatResponse({
        frameId: '123:456',
        htmlAnalogy: '<div class="Container"> with flexbox layout',
        cssEquivalent: '.Container { display: flex; }'
      });

      const text = result[0].text as string;
      expect(text).toContain('Frame Created Successfully');
      expect(text).toContain('123:456');
      expect(text).toContain('display: flex');
    });
  });

  describe('create_text', () => {
    it('formats text creation result', () => {
      const handler = getHandler('create_text');
      const result = handler.formatResponse({
        textId: '789:012',
        appliedLineHeight: 24,
        cssEquivalent: 'font-size: 16px; line-height: 24px;'
      });

      const text = result[0].text as string;
      expect(text).toContain('Text Created Successfully');
      expect(text).toContain('789:012');
      expect(text).toContain('24px');
    });
  });

  describe('create_ellipse', () => {
    it('formats ellipse creation result', () => {
      const handler = getHandler('create_ellipse');
      const result = handler.formatResponse({
        message: 'Ellipse Created',
        ellipseId: 'e1',
        width: 100,
        height: 100,
        isCircle: true,
        cssEquivalent: 'border-radius: 50%'
      });

      const text = result[0].text as string;
      expect(text).toContain('Ellipse Created');
      expect(text).toContain('Is Circle: true');
    });
  });

  describe('create_component', () => {
    it('formats component with description', () => {
      const handler = getHandler('create_component');
      const result = handler.formatResponse({
        componentId: 'comp-1',
        name: 'Button',
        description: 'Primary button component',
        message: 'Component created'
      });

      const text = result[0].text as string;
      expect(text).toContain('Component Created Successfully');
      expect(text).toContain('comp-1');
      expect(text).toContain('Button');
      expect(text).toContain('Primary button component');
    });

    it('omits description when absent', () => {
      const handler = getHandler('create_component');
      const result = handler.formatResponse({
        componentId: 'comp-1',
        name: 'Button',
        message: 'Component created'
      });

      const text = result[0].text as string;
      expect(text).not.toContain('Description:');
    });
  });

  describe('create_design', () => {
    it('formats successful multi-node design', () => {
      const handler = getHandler('create_design');
      const result = handler.formatResponse({
        success: true,
        rootNodeId: 'root-1',
        totalNodes: 5,
        nodeIds: { Container: 'n1', Title: 'n2' },
        autoCorrections: [
          { path: 'root', field: 'padding', originalValue: 15, correctedValue: 16 }
        ],
        message: 'Design created'
      });

      const text = result[0].text as string;
      expect(text).toContain('Design Created Successfully');
      expect(text).toContain('root-1');
      expect(text).toContain('5');
      expect(text).toContain('Container: n1');
      expect(text).toContain('15 -> 16');
    });

    it('formats design creation error', () => {
      const handler = getHandler('create_design');
      const result = handler.formatResponse({
        success: false,
        error: 'Invalid spec',
        rootNodeId: '',
        totalNodes: 0,
        message: ''
      });

      const text = result[0].text as string;
      expect(text).toContain('Error: Invalid spec');
    });
  });

  // ─── Styling handlers ────────────────────────────────────────────────

  describe('set_fills', () => {
    it('formats fill application result', () => {
      const handler = getHandler('set_fills');
      const result = handler.formatResponse({
        nodeId: 'node-1',
        appliedColor: '#FF0000',
        cssEquivalent: 'background-color: #FF0000;'
      });

      const text = result[0].text as string;
      expect(text).toContain('Fills Applied Successfully');
      expect(text).toContain('#FF0000');
      expect(text).toContain('background-color');
    });
  });

  describe('set_transform', () => {
    it('formats transform result', () => {
      const handler = getHandler('set_transform');
      const result = handler.formatResponse({
        message: 'Transform applied',
        nodeId: 'node-1',
        applied: ['x: 100', 'y: 200', 'width: 300'],
        cssEquivalent: 'left: 100px; top: 200px; width: 300px;'
      });

      const text = result[0].text as string;
      expect(text).toContain('Transform applied');
      expect(text).toContain('x: 100, y: 200, width: 300');
    });
  });

  describe('set_appearance', () => {
    it('formats appearance result', () => {
      const handler = getHandler('set_appearance');
      const result = handler.formatResponse({
        message: 'Appearance updated',
        nodeId: 'node-1',
        applied: ['opacity: 0.5', 'blendMode: MULTIPLY'],
        cssEquivalent: 'opacity: 0.5; mix-blend-mode: multiply;'
      });

      const text = result[0].text as string;
      expect(text).toContain('Appearance updated');
      expect(text).toContain('opacity: 0.5');
    });
  });

  // ─── Navigation handlers ─────────────────────────────────────────────

  describe('get_page_hierarchy', () => {
    it('formats hierarchy result', () => {
      const handler = getHandler('get_page_hierarchy');
      const result = handler.formatResponse({
        hierarchy: 'Page 1\n  Frame A\n    Text B',
        source: 'figma',
        stats: {
          totalNodes: 3,
          rootNodes: 1,
          nodesByType: { FRAME: 1, TEXT: 1, PAGE: 1 }
        }
      });

      const text = result[0].text as string;
      expect(text).toContain('Page Hierarchy');
      expect(text).toContain('Total Nodes: 3');
      expect(text).toContain('FRAME: 1');
      expect(text).toContain('Frame A');
    });

    it('indicates cached vs fresh source', () => {
      const handler = getHandler('get_page_hierarchy');
      const cached = handler.formatResponse({
        hierarchy: '',
        source: 'cache',
        stats: { totalNodes: 0, rootNodes: 0, nodesByType: {} }
      });
      expect(cached[0].text as string).toContain('Cached Registry');

      const fresh = handler.formatResponse({
        hierarchy: '',
        source: 'figma',
        stats: { totalNodes: 0, rootNodes: 0, nodesByType: {} }
      });
      expect(fresh[0].text as string).toContain('Fresh from Figma');
    });
  });

  describe('get_selection', () => {
    it('formats empty selection', () => {
      const handler = getHandler('get_selection');
      const result = handler.formatResponse({
        count: 0,
        selection: []
      });

      const text = result[0].text as string;
      expect(text).toContain('Count: 0');
      expect(text).toContain('No nodes selected');
    });

    it('formats non-empty selection', () => {
      const handler = getHandler('get_selection');
      const result = handler.formatResponse({
        count: 1,
        selection: [{ id: 'n1', name: 'Frame', type: 'FRAME' }]
      });

      const text = result[0].text as string;
      expect(text).toContain('Count: 1');
      expect(text).toContain('Frame');
    });
  });

  describe('get_node_info', () => {
    it('formats node with parent and children', () => {
      const handler = getHandler('get_node_info');
      const result = handler.formatResponse({
        node: {
          nodeId: 'n1',
          name: 'Header',
          type: 'FRAME',
          bounds: { x: 10, y: 20, width: 300, height: 100 }
        },
        parent: { nodeId: 'p1', name: 'Page', type: 'PAGE' },
        children: [
          { nodeId: 'c1', name: 'Title', type: 'TEXT' },
          { nodeId: 'c2', name: 'Logo', type: 'FRAME' }
        ],
        path: ['Page', 'Header']
      });

      const text = result[0].text as string;
      expect(text).toContain('Header');
      expect(text).toContain('FRAME');
      expect(text).toContain('(10, 20)');
      expect(text).toContain('300 x 100');
      expect(text).toContain('Page > Header');
      expect(text).toContain('Parent: Page');
      expect(text).toContain('Children: 2');
    });

    it('formats missing node', () => {
      const handler = getHandler('get_node_info');
      const result = handler.formatResponse({
        node: null,
        parent: null,
        children: [],
        path: []
      });

      const text = result[0].text as string;
      expect(text).toContain('Node not found');
    });

    it('formats node without parent or children', () => {
      const handler = getHandler('get_node_info');
      const result = handler.formatResponse({
        node: {
          nodeId: 'n1',
          name: 'Root',
          type: 'FRAME',
          bounds: { x: 0, y: 0, width: 100, height: 100 }
        },
        parent: null,
        children: [],
        path: ['Root']
      });

      const text = result[0].text as string;
      expect(text).toContain('Root');
      expect(text).toContain('Children: 0');
    });
  });

  describe('formatResponse return structure', () => {
    it('all formatResponse results are non-empty arrays of text content', () => {
      const testCases: [string, Record<string, unknown>][] = [
        [
          'check_connection',
          { connected: true, message: 'OK', circuitBreakerState: 'CLOSED', pendingRequests: 0 }
        ],
        ['create_frame', { frameId: 'f1', htmlAnalogy: '<div>', cssEquivalent: '' }],
        ['create_text', { textId: 't1', appliedLineHeight: 24, cssEquivalent: '' }],
        ['set_fills', { nodeId: 'n1', appliedColor: '#000', cssEquivalent: '' }],
        ['get_selection', { count: 0, selection: [] }]
      ];

      for (const [name, data] of testCases) {
        const handler = getHandler(name);
        const result = handler.formatResponse(data);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].type).toBe('text');
        expect((result[0].text as string).length).toBeGreaterThan(0);
      }
    });
  });

  describe('create_design edge cases', () => {
    it('formats design with empty nodeIds', () => {
      const handler = getHandler('create_design');
      const result = handler.formatResponse({
        success: true,
        rootNodeId: 'r1',
        totalNodes: 1,
        nodeIds: {},
        message: 'Created'
      });
      const text = result[0].text as string;
      expect(text).toContain('Design Created Successfully');
    });

    it('formats design with no autoCorrections', () => {
      const handler = getHandler('create_design');
      const result = handler.formatResponse({
        success: true,
        rootNodeId: 'r1',
        totalNodes: 1,
        nodeIds: { Root: 'r1' },
        message: 'Created'
      });
      const text = result[0].text as string;
      expect(text).not.toContain('Auto-Corrections');
    });
  });

  describe('check_connection edge cases', () => {
    it('formats with missing optional fields', () => {
      const handler = getHandler('check_connection');
      const result = handler.formatResponse({
        connected: false,
        circuitBreakerState: 'OPEN',
        pendingRequests: 5,
        message: 'Disconnected'
      });
      const text = result[0].text as string;
      expect(text).toContain('DISCONNECTED');
      expect(text).toContain('OPEN');
    });
  });
});
