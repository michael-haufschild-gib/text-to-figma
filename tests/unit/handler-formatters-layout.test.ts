/**
 * Handler formatResponse Tests — Layout, Utility & Registration
 *
 * Tests the MCP output formatting for layout, utility, additional creation,
 * and tool registration completeness.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { getToolRegistry, resetToolRegistry } from '../../mcp-server/src/routing/tool-registry.js';
import { registerAllTools } from '../../mcp-server/src/routing/register-tools.js';

describe('Handler formatResponse — layout, utility, registration', () => {
  beforeEach(() => {
    resetToolRegistry();
    registerAllTools();
  });

  function getHandler(name: string) {
    const handler = getToolRegistry().get(name);
    if (!handler) throw new Error(`Handler ${name} not registered`);
    return handler;
  }

  // ─── Layout / utility handlers ────────────────────────────────────────

  describe('set_layout_properties', () => {
    it('formats layout update result', () => {
      const handler = getHandler('set_layout_properties');
      const result = handler.formatResponse({
        nodeId: 'f1',
        updated: ['layoutMode', 'itemSpacing'],
        cssEquivalent: 'display: flex; gap: 16px;'
      });

      const text = result[0].text as string;
      expect(text).toContain('Layout Properties Updated');
      expect(text).toContain('layoutMode, itemSpacing');
    });
  });

  describe('list_pages', () => {
    it('formats page list with current page indicator', () => {
      const handler = getHandler('list_pages');
      const result = handler.formatResponse({
        message: 'Found 2 pages',
        pages: [
          { pageId: 'p1', name: 'Home', isCurrent: true },
          { pageId: 'p2', name: 'About', isCurrent: false }
        ]
      });

      const text = result[0].text as string;
      expect(text).toContain('Home (current)');
      expect(text).toContain('About');
      expect(text).not.toContain('About (current)');
    });
  });

  describe('validate_design_tokens', () => {
    it('formats a passing validation report', () => {
      const handler = getHandler('validate_design_tokens');
      const report = {
        spacing: {
          total: 3,
          valid: 3,
          invalid: 0,
          results: [
            { value: 8, isValid: true },
            { value: 16, isValid: true },
            { value: 24, isValid: true }
          ]
        },
        typography: {
          total: 2,
          valid: 2,
          invalid: 0,
          results: [
            { fontSize: 16, isValid: true, recommendedLineHeight: 24 },
            { fontSize: 24, isValid: true, recommendedLineHeight: 29 }
          ]
        },
        colors: { total: 0, passesAA: 0, passesAAA: 0, results: [] },
        summary: { allValid: true, issues: [], recommendations: [] }
      };
      const result = handler.formatResponse(report);
      const text = result[0].text as string;
      expect(text).toContain('Validation Report');
      expect(text).toContain('SPACING');
      expect(text).toContain('TYPOGRAPHY');
    });

    it('formats a report with invalid tokens', () => {
      const handler = getHandler('validate_design_tokens');
      const report = {
        spacing: {
          total: 2,
          valid: 1,
          invalid: 1,
          results: [
            { value: 8, isValid: true },
            { value: 10, isValid: false, suggestedValue: 8 }
          ]
        },
        typography: {
          total: 1,
          valid: 0,
          invalid: 1,
          results: [
            { fontSize: 15, isValid: false, suggestedFontSize: 16, recommendedLineHeight: 24 }
          ]
        },
        colors: {
          total: 1,
          passesAA: 0,
          passesAAA: 0,
          results: [
            {
              foreground: '#999999',
              background: '#FFFFFF',
              ratio: 2.85,
              passesAA: false,
              passesAAA: false,
              recommendation: 'Increase contrast'
            }
          ]
        },
        summary: {
          allValid: false,
          issues: ['spacing off-grid', 'contrast too low'],
          recommendations: ['Use 8pt grid']
        }
      };
      const result = handler.formatResponse(report);
      const text = result[0].text as string;
      // Spacing: valid 8px passes, invalid 10px gets suggestion
      expect(text).toContain('10px');
      expect(text).toContain('Suggested: 8px');
      // Typography: invalid 15px gets font size suggestion
      expect(text).toContain('15px');
      expect(text).toContain('Suggested: 16px');
      expect(text).toContain('line-height: 24px');
      // Color contrast: failing pair
      expect(text).toContain('#999999 / #FFFFFF');
      expect(text).toContain('2.85:1');
      expect(text).toContain('Increase contrast');
      // Summary: issues and recommendations
      expect(text).toContain('Issues found');
      expect(text).toContain('spacing off-grid');
      expect(text).toContain('Use 8pt grid');
    });

    it('formats report with zero-count sections (no spacing/typography tested)', () => {
      const handler = getHandler('validate_design_tokens');
      const report = {
        spacing: { total: 0, valid: 0, invalid: 0, results: [] },
        typography: { total: 0, valid: 0, invalid: 0, results: [] },
        colors: {
          total: 1,
          passesAA: 1,
          passesAAA: 1,
          results: [
            {
              foreground: '#000000',
              background: '#FFFFFF',
              ratio: 21,
              passesAA: true,
              passesAAA: true,
              recommendation: 'Excellent'
            }
          ]
        },
        summary: { allValid: true, issues: [], recommendations: [] }
      };
      const result = handler.formatResponse(report);
      const text = result[0].text as string;
      expect(text).toContain('Validation Report');
      expect(text).toContain('COLOR');
    });
  });

  describe('set_instance_swap', () => {
    it('formats instance swap with old component ID', () => {
      const handler = getHandler('set_instance_swap');
      const result = handler.formatResponse({
        message: 'Instance swapped',
        instanceId: 'i1',
        newComponentId: 'comp-new',
        oldComponentId: 'comp-old'
      });

      const text = result[0].text as string;
      expect(text).toContain('Instance swapped');
      expect(text).toContain('comp-new');
      expect(text).toContain('comp-old');
    });

    it('omits old component ID when absent', () => {
      const handler = getHandler('set_instance_swap');
      const result = handler.formatResponse({
        message: 'Instance swapped',
        instanceId: 'i1',
        newComponentId: 'comp-new'
      });

      const text = result[0].text as string;
      expect(text).not.toContain('Old Component ID');
    });
  });
});

describe('Handler formatResponse — additional tools & registration', () => {
  beforeEach(() => {
    resetToolRegistry();
    registerAllTools();
  });

  function getHandler(name: string) {
    const handler = getToolRegistry().get(name);
    if (!handler) throw new Error(`Handler ${name} not registered`);
    return handler;
  }

  describe('create_line', () => {
    it('formats line creation with all fields', () => {
      const handler = getHandler('create_line');
      const result = handler.formatResponse({
        lineId: 'line-1',
        message: 'Line created',
        length: 200,
        cssEquivalent: 'border-top: 1px solid black;'
      });
      const text = result[0].text as string;
      expect(text).toContain('Line ID: line-1');
      expect(text).toContain('Line created');
      expect(text).toContain('Length: 200px');
      expect(text).toContain('border-top: 1px solid black;');
    });
  });

  describe('create_polygon', () => {
    it('formats polygon with type and side count', () => {
      const handler = getHandler('create_polygon');
      const result = handler.formatResponse({
        polygonId: 'poly-1',
        message: 'Polygon created',
        polygonType: 'Hexagon',
        sideCount: 6,
        cssEquivalent: 'clip-path: polygon(...);'
      });
      const text = result[0].text as string;
      expect(text).toContain('Polygon ID: poly-1');
      expect(text).toContain('Polygon created');
      expect(text).toContain('Type: Hexagon');
      expect(text).toContain('Sides: 6');
      expect(text).toContain('clip-path: polygon(...);');
    });
  });

  describe('create_star', () => {
    it('formats star with point count and radius', () => {
      const handler = getHandler('create_star');
      const result = handler.formatResponse({
        starId: 'star-1',
        message: 'Star created',
        pointCount: 5,
        radius: 50,
        innerRadius: 25,
        cssEquivalent: 'clip-path: polygon(...);'
      });
      const text = result[0].text as string;
      expect(text).toContain('Star ID: star-1');
      expect(text).toContain('Star created');
      expect(text).toContain('Points: 5');
      expect(text).toContain('Radius: 50px (inner: 25px)');
      expect(text).toContain('clip-path: polygon(...);');
    });
  });

  describe('set_corner_radius', () => {
    it('formats corner radius with node ID and CSS equivalent', () => {
      const handler = getHandler('set_corner_radius');
      const result = handler.formatResponse({
        nodeId: 'n1',
        message: 'Corner radius set',
        isUniform: true,
        cssEquivalent: 'border-radius: 8px;'
      });
      const text = result[0].text as string;
      expect(text).toContain('Corner radius set');
      expect(text).toContain('Node ID: n1');
      expect(text).toContain('Is Uniform: true');
      expect(text).toContain('border-radius: 8px;');
    });
  });

  describe('set_stroke', () => {
    it('formats stroke with weight, alignment, and CSS', () => {
      const handler = getHandler('set_stroke');
      const result = handler.formatResponse({
        nodeId: 'n1',
        message: 'Stroke applied',
        strokeWeight: 2,
        strokeAlign: 'INSIDE',
        cssEquivalent: 'border: 2px solid #000;'
      });
      const text = result[0].text as string;
      expect(text).toContain('Stroke applied');
      expect(text).toContain('Node ID: n1');
      expect(text).toContain('Stroke Weight: 2px');
      expect(text).toContain('Alignment: INSIDE');
      expect(text).toContain('border: 2px solid #000;');
    });
  });

  describe('apply_effects', () => {
    it('formats effects with count, node ID, and CSS', () => {
      const handler = getHandler('apply_effects');
      const result = handler.formatResponse({
        nodeId: 'n1',
        effectsApplied: 2,
        cssEquivalent: 'box-shadow: 0 2px 4px rgba(0,0,0,0.25);'
      });
      const text = result[0].text as string;
      expect(text).toContain('Effects Applied Successfully');
      expect(text).toContain('Node ID: n1');
      expect(text).toContain('Effects Applied: 2');
      expect(text).toContain('box-shadow: 0 2px 4px rgba(0,0,0,0.25);');
    });
  });

  describe('set_text_properties', () => {
    it('formats text properties with applied list and CSS', () => {
      const handler = getHandler('set_text_properties');
      const result = handler.formatResponse({
        message: 'Text properties updated',
        nodeId: 'n1',
        applied: ['fontSize: 16', 'fontWeight: 700'],
        cssEquivalent: 'font-size: 16px; font-weight: 700;'
      });
      const text = result[0].text as string;
      expect(text).toContain('Text properties updated');
      expect(text).toContain('Node ID: n1');
      expect(text).toContain('fontSize: 16, fontWeight: 700');
      expect(text).toContain('font-size: 16px; font-weight: 700;');
    });
  });

  describe('export_node', () => {
    it('formats export with format, scale, and base64 length', () => {
      const handler = getHandler('export_node');
      const result = handler.formatResponse({
        message: 'Node exported',
        nodeId: 'n1',
        format: 'PNG',
        scale: 2,
        base64Data: 'iVBORw0KGgoAAAANSUhEUgAA'
      });
      const text = result[0].text as string;
      expect(text).toContain('Node exported');
      expect(text).toContain('Node ID: n1');
      expect(text).toContain('Format: PNG');
      expect(text).toContain('Scale: 2x');
      expect(text).toContain('Base64 Data:');
    });

    it('formats export with file path when present', () => {
      const handler = getHandler('export_node');
      const result = handler.formatResponse({
        message: 'Node exported',
        nodeId: 'n1',
        format: 'SVG',
        scale: 1,
        filePath: '/tmp/export.svg'
      });
      const text = result[0].text as string;
      expect(text).toContain('File Path: /tmp/export.svg');
    });
  });

  describe('set_visible', () => {
    it('formats visibility with state and CSS equivalent', () => {
      const handler = getHandler('set_visible');
      const result = handler.formatResponse({
        message: 'Visibility changed',
        nodeId: 'n1',
        visible: false,
        cssEquivalent: 'display: none;'
      });
      const text = result[0].text as string;
      expect(text).toContain('Visibility changed');
      expect(text).toContain('Node ID: n1');
      expect(text).toContain('Visible: false');
      expect(text).toContain('display: none;');
    });
  });

  describe('set_locked', () => {
    it('formats lock state with node ID and locked value', () => {
      const handler = getHandler('set_locked');
      const result = handler.formatResponse({
        message: 'Lock state changed',
        nodeId: 'n1',
        locked: true
      });
      const text = result[0].text as string;
      expect(text).toContain('Lock state changed');
      expect(text).toContain('Node ID: n1');
      expect(text).toContain('Locked: true');
    });
  });

  // ─── Additional untested handler formatResponse ────────────────────

  describe('create_path', () => {
    it('formats path creation using message field', () => {
      const handler = getHandler('create_path');
      const result = handler.formatResponse({
        message: 'Path created: path-1 with 5 commands'
      });
      const text = result[0].text as string;
      expect(text).toContain('Path created');
      expect(text).toContain('path-1');
    });
  });

  describe('create_boolean_operation', () => {
    it('formats boolean operation with all fields', () => {
      const handler = getHandler('create_boolean_operation');
      const result = handler.formatResponse({
        booleanNodeId: 'bool-1',
        message: 'Boolean created',
        operation: 'UNION',
        nodeCount: 3,
        cssEquivalent: 'clip-path: union;'
      });
      const text = result[0].text as string;
      expect(text).toContain('Boolean Node ID: bool-1');
      expect(text).toContain('Boolean created');
      expect(text).toContain('Operation: UNION');
      expect(text).toContain('Node Count: 3');
      expect(text).toContain('clip-path: union;');
    });
  });

  describe('create_component_set', () => {
    it('formats component set with name and variant count', () => {
      const handler = getHandler('create_component_set');
      const result = handler.formatResponse({
        componentSetId: 'cs-1',
        message: 'Component set created',
        name: 'Button',
        variantCount: 4
      });
      const text = result[0].text as string;
      expect(text).toContain('Component Set ID: cs-1');
      expect(text).toContain('Component set created');
      expect(text).toContain('Name: Button');
      expect(text).toContain('Variants: 4');
    });
  });

  describe('create_instance', () => {
    it('formats instance with component ID and overrides count', () => {
      const handler = getHandler('create_instance');
      const result = handler.formatResponse({
        instanceId: 'inst-1',
        message: 'Instance created',
        componentId: 'comp-1',
        overridesApplied: 2
      });
      const text = result[0].text as string;
      expect(text).toContain('Instance ID: inst-1');
      expect(text).toContain('Instance Created Successfully');
      expect(text).toContain('Component ID: comp-1');
      expect(text).toContain('Overrides Applied: 2');
    });
  });

  describe('align_nodes', () => {
    it('formats alignment message (message-only formatter)', () => {
      const handler = getHandler('align_nodes');
      const result = handler.formatResponse({
        message: 'Nodes aligned to CENTER_HORIZONTAL (3 nodes)',
        alignment: 'CENTER_HORIZONTAL',
        nodeCount: 3
      });
      const text = result[0].text as string;
      // align_nodes uses message-only formatResponse: textResponse(r.message)
      expect(text).toBe('Nodes aligned to CENTER_HORIZONTAL (3 nodes)');
    });
  });

  describe('distribute_nodes', () => {
    it('formats distribution message (message-only formatter)', () => {
      const handler = getHandler('distribute_nodes');
      const result = handler.formatResponse({
        message: 'Nodes distributed HORIZONTAL with 16px spacing (4 nodes)',
        direction: 'HORIZONTAL',
        nodeCount: 4,
        spacing: 16
      });
      const text = result[0].text as string;
      // distribute_nodes uses message-only formatResponse: textResponse(r.message)
      expect(text).toBe('Nodes distributed HORIZONTAL with 16px spacing (4 nodes)');
    });
  });

  describe('set_constraints', () => {
    it('formats constraints result with applied list', () => {
      const handler = getHandler('set_constraints');
      const result = handler.formatResponse({
        nodeId: 'n1',
        applied: ['horizontal: MIN', 'vertical: MIN'],
        description: 'Top-left constraints',
        cssEquivalent: 'position: absolute; top: 0; left: 0;'
      });
      const text = result[0].text as string;
      expect(text).toContain('Constraints Applied');
      expect(text).toContain('n1');
    });
  });

  describe('create_page', () => {
    it('formats page creation with ID and name', () => {
      const handler = getHandler('create_page');
      const result = handler.formatResponse({
        pageId: 'pg-1',
        message: 'Page created',
        name: 'New Page'
      });
      const text = result[0].text as string;
      expect(text).toContain('Page created');
      expect(text).toContain('Page ID: pg-1');
      expect(text).toContain('Name: New Page');
    });
  });

  describe('set_current_page', () => {
    it('formats page switch with ID and name', () => {
      const handler = getHandler('set_current_page');
      const result = handler.formatResponse({
        message: 'Switched to page',
        pageId: 'pg-1',
        pageName: 'Design Page'
      });
      const text = result[0].text as string;
      expect(text).toContain('Switched to page');
      expect(text).toContain('Page ID: pg-1');
      expect(text).toContain('Page Name: Design Page');
    });
  });
});
