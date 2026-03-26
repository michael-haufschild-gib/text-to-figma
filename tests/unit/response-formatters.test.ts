/**
 * Response Formatters — Direct Unit Tests
 *
 * Tests uncovered branches in response-formatters.ts:
 * - formatSelectionNode with >10 children (reduced format)
 * - formatSelectionNode with opacity, strokes, mixed corner radii
 * - formatTextProps with styled segments, decoration, case
 * - formatTypographyValue for letter-spacing and line-height
 * - formatHierarchyTree edge cases (object with hierarchy, plain object, non-string)
 * - formatFill for gradient and image types
 */

import { describe, expect, it } from 'vitest';
import {
  rgbToHex,
  formatFill,
  formatFills,
  formatBounds,
  formatSelectionNode,
  formatHierarchyTree
} from '../../mcp-server/src/utils/response-formatters.js';

describe('rgbToHex', () => {
  it('clamps values outside 0-1 range', () => {
    expect(rgbToHex({ r: -0.1, g: 1.5, b: 0.5 })).toBe('#00FF80');
  });
});

describe('formatFill', () => {
  it('formats a solid fill with opacity', () => {
    expect(formatFill({ type: 'SOLID', color: { r: 1, g: 0, b: 0 }, opacity: 0.5 })).toBe(
      '#FF0000 50%'
    );
  });

  it('formats a linear gradient fill', () => {
    const result = formatFill({
      type: 'GRADIENT_LINEAR',
      gradientStops: [
        { color: { r: 1, g: 0, b: 0 }, position: 0 },
        { color: { r: 0, g: 0, b: 1 }, position: 1 }
      ]
    });
    expect(result).toBe('linear-gradient(#FF0000 → #0000FF)');
  });

  it('formats a radial gradient fill', () => {
    const result = formatFill({
      type: 'GRADIENT_RADIAL',
      gradientStops: [
        { color: { r: 0, g: 1, b: 0 }, position: 0 },
        { color: { r: 1, g: 1, b: 0 }, position: 1 }
      ]
    });
    expect(result).toBe('radial-gradient(#00FF00 → #FFFF00)');
  });

  it('formats an angular gradient fill', () => {
    const result = formatFill({
      type: 'GRADIENT_ANGULAR',
      gradientStops: [{ color: { r: 1, g: 1, b: 1 }, position: 0 }]
    });
    expect(result).toBe('angular-gradient(#FFFFFF)');
  });

  it('formats a gradient stop without color as ?', () => {
    const result = formatFill({
      type: 'GRADIENT_LINEAR',
      gradientStops: [{ position: 0 }, { color: { r: 0, g: 0, b: 0 }, position: 1 }]
    });
    expect(result).toBe('linear-gradient(? → #000000)');
  });

  it('formats an image fill', () => {
    expect(formatFill({ type: 'IMAGE' })).toBe('image-fill');
  });

  it('formats unknown fill type as lowercase', () => {
    expect(formatFill({ type: 'VIDEO' })).toBe('video');
  });

  it('returns null for invisible fills', () => {
    expect(formatFill({ type: 'SOLID', color: { r: 1, g: 0, b: 0 }, visible: false })).toBeNull();
  });

  it('defaults to SOLID type when type is undefined', () => {
    expect(formatFill({ color: { r: 0, g: 0, b: 0 } })).toBe('#000000');
  });
});

describe('formatFills', () => {
  it('returns empty string for undefined fills', () => {
    expect(formatFills(undefined, 'fill')).toBe('');
  });

  it('returns empty string when all fills are invisible', () => {
    expect(formatFills([{ visible: false }], 'fill')).toBe('');
  });

  it('formats multiple visible fills', () => {
    const result = formatFills(
      [
        { type: 'SOLID', color: { r: 1, g: 0, b: 0 } },
        { type: 'SOLID', color: { r: 0, g: 1, b: 0 } }
      ],
      'fill'
    );
    expect(result).toBe('fill: #FF0000, #00FF00');
  });
});

describe('formatBounds', () => {
  it('returns empty string for undefined bounds', () => {
    expect(formatBounds(undefined)).toBe('');
  });
});

describe('formatSelectionNode', () => {
  it('renders opacity when less than 1', () => {
    const result = formatSelectionNode({
      nodeId: 'n1',
      type: 'FRAME',
      name: 'Faded',
      opacity: 0.75
    });
    expect(result).toContain('opacity: 75%');
  });

  it('renders stroke with uniform weight and non-INSIDE align', () => {
    const result = formatSelectionNode({
      nodeId: 'n1',
      type: 'FRAME',
      name: 'Bordered',
      strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }],
      strokeWeight: 2,
      strokeAlign: 'CENTER'
    });
    expect(result).toContain('stroke: #000000 2px center');
  });

  it('renders stroke with per-side weight (uniform values)', () => {
    const result = formatSelectionNode({
      nodeId: 'n1',
      type: 'FRAME',
      name: 'Bordered',
      strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }],
      strokeWeight: { top: 2, right: 2, bottom: 2, left: 2 },
      strokeAlign: 'INSIDE'
    });
    expect(result).toContain('stroke: #000000 2px');
  });

  it('renders stroke with per-side weight (mixed values)', () => {
    const result = formatSelectionNode({
      nodeId: 'n1',
      type: 'FRAME',
      name: 'Bordered',
      strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }],
      strokeWeight: { top: 1, right: 2, bottom: 3, left: 4 }
    });
    expect(result).toContain('1,2,3,4px');
  });

  it('renders mixed corner radius', () => {
    const result = formatSelectionNode({
      nodeId: 'n1',
      type: 'FRAME',
      name: 'Mixed',
      cornerRadius: { topLeft: 8, topRight: 4, bottomRight: 8, bottomLeft: 4 }
    });
    expect(result).toContain('radius: 8,4,8,4');
  });

  it('renders uniform corner radius from per-corner object', () => {
    const result = formatSelectionNode({
      nodeId: 'n1',
      type: 'FRAME',
      name: 'Uniform',
      cornerRadius: { topLeft: 12, topRight: 12, bottomRight: 12, bottomLeft: 12 }
    });
    expect(result).toContain('radius: 12');
    expect(result).not.toContain('12,12,12,12');
  });

  it('omits corner radius when all zeros from per-corner object', () => {
    const result = formatSelectionNode({
      nodeId: 'n1',
      type: 'FRAME',
      name: 'Sharp',
      cornerRadius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 }
    });
    expect(result).not.toContain('radius');
  });

  it('renders layout with symmetric horizontal padding', () => {
    const result = formatSelectionNode({
      nodeId: 'n1',
      type: 'FRAME',
      name: 'Padded',
      layoutMode: 'VERTICAL',
      paddingTop: 16,
      paddingRight: 24,
      paddingBottom: 16,
      paddingLeft: 24
    });
    expect(result).toContain('pad=16,24');
  });

  it('renders layout with asymmetric padding', () => {
    const result = formatSelectionNode({
      nodeId: 'n1',
      type: 'FRAME',
      name: 'Padded',
      layoutMode: 'HORIZONTAL',
      paddingTop: 8,
      paddingRight: 12,
      paddingBottom: 16,
      paddingLeft: 24
    });
    expect(result).toContain('pad=8,12,16,24');
  });

  it('renders TEXT node with styled segments', () => {
    const result = formatSelectionNode({
      nodeId: 'n1',
      type: 'TEXT',
      name: 'Rich',
      characters: 'Hello World',
      styledSegments: [
        {
          characters: 'Hello',
          start: 0,
          end: 5,
          fontSize: 16,
          fontName: { family: 'Inter', style: 'Bold' },
          fontWeight: 700,
          fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }]
        },
        {
          characters: ' World',
          start: 5,
          end: 11,
          fontSize: 14,
          fontName: { family: 'Inter', style: 'Regular' },
          fontWeight: 400
        }
      ]
    });
    expect(result).toContain('segments:');
    expect(result).toContain('[0-5] Inter Bold 16 #FF0000');
    expect(result).toContain('[5-11] Inter Regular 14');
  });

  it('renders TEXT node with text decoration and case', () => {
    const result = formatSelectionNode({
      nodeId: 'n1',
      type: 'TEXT',
      name: 'Styled',
      characters: 'underlined',
      fontName: { family: 'Arial', style: 'Regular' },
      fontSize: 14,
      textDecoration: 'UNDERLINE',
      textCase: 'UPPER'
    });
    expect(result).toContain('decoration: underline');
    expect(result).toContain('case: upper');
  });

  it('renders TEXT node with line-height and letter-spacing in pixels', () => {
    const result = formatSelectionNode({
      nodeId: 'n1',
      type: 'TEXT',
      name: 'Spaced',
      characters: 'test',
      fontName: { family: 'Inter', style: 'Regular' },
      fontSize: 16,
      lineHeight: { unit: 'PIXELS', value: 24 },
      letterSpacing: { unit: 'PIXELS', value: 1.5 }
    });
    expect(result).toContain('line-height: 24px');
    expect(result).toContain('letter-spacing: 1.5px');
  });

  it('renders TEXT node with line-height and letter-spacing in percent', () => {
    const result = formatSelectionNode({
      nodeId: 'n1',
      type: 'TEXT',
      name: 'Percent',
      characters: 'test',
      fontName: { family: 'Inter', style: 'Regular' },
      fontSize: 16,
      lineHeight: { unit: 'PERCENT', value: 150 },
      letterSpacing: { unit: 'PERCENT', value: 5 }
    });
    expect(result).toContain('line-height: 150%');
    expect(result).toContain('letter-spacing: 5%');
  });

  it('omits line-height when AUTO', () => {
    const result = formatSelectionNode({
      nodeId: 'n1',
      type: 'TEXT',
      name: 'Auto',
      characters: 'test',
      fontName: { family: 'Inter', style: 'Regular' },
      fontSize: 16,
      lineHeight: { unit: 'AUTO' }
    });
    expect(result).not.toContain('line-height');
  });

  it('omits letter-spacing when 0%', () => {
    const result = formatSelectionNode({
      nodeId: 'n1',
      type: 'TEXT',
      name: 'NoSpacing',
      characters: 'test',
      fontName: { family: 'Inter', style: 'Regular' },
      fontSize: 16,
      letterSpacing: { unit: 'PERCENT', value: 0 }
    });
    expect(result).not.toContain('letter-spacing');
  });

  it('renders TEXT node with text color fills', () => {
    const result = formatSelectionNode({
      nodeId: 'n1',
      type: 'TEXT',
      name: 'Colored',
      characters: 'colored text',
      fontName: { family: 'Inter', style: 'Regular' },
      fontSize: 14,
      textFills: [{ type: 'SOLID', color: { r: 0, g: 0.5, b: 1 } }]
    });
    expect(result).toContain('color: #0080FF');
  });

  it('truncates long text content', () => {
    const longText = 'A'.repeat(200);
    const result = formatSelectionNode({
      nodeId: 'n1',
      type: 'TEXT',
      name: 'Long',
      characters: longText,
      fontName: { family: 'Inter', style: 'Regular' },
      fontSize: 14
    });
    expect(result).toContain('...');
    expect(result).not.toContain('A'.repeat(200));
  });

  it('uses reduced format for >10 children', () => {
    const children = Array.from({ length: 12 }, (_, i) => ({
      nodeId: `c${i}`,
      type: 'FRAME',
      name: `Child ${i}`,
      bounds: { x: 0, y: i * 50, width: 100, height: 40 }
    }));

    const result = formatSelectionNode({
      nodeId: 'parent',
      type: 'FRAME',
      name: 'BigParent',
      children
    });

    expect(result).toContain('12 children');
    expect(result).toContain('get_node_by_id');
    expect(result).toContain('Child 0');
    expect(result).toContain('Child 11');
  });

  it('reduced format renders child without bounds', () => {
    const children = Array.from({ length: 11 }, (_, i) => ({
      nodeId: `c${i}`,
      type: 'TEXT',
      name: `Item ${i}`
    }));

    const result = formatSelectionNode({
      nodeId: 'parent',
      type: 'FRAME',
      name: 'NoSizes',
      children
    });

    expect(result).toContain('11 children');
    expect(result).toContain('TEXT "Item 0" [c0]');
    // No bounds suffix
    const lines = result.split('\n');
    const childLine = lines.find((l) => l.includes('Item 0'));
    expect(childLine).not.toContain('×');
  });
});

describe('formatHierarchyTree', () => {
  it('returns string data as-is', () => {
    expect(formatHierarchyTree('raw hierarchy')).toBe('raw hierarchy');
  });

  it('formats object with hierarchy string property', () => {
    expect(formatHierarchyTree({ hierarchy: 'tree data' })).toBe('tree data');
  });

  it('JSON-stringifies object without hierarchy property', () => {
    const result = formatHierarchyTree({ foo: 'bar' });
    expect(result).toBe(JSON.stringify({ foo: 'bar' }, null, 2));
  });

  it('JSON-stringifies object with empty hierarchy property', () => {
    const result = formatHierarchyTree({ hierarchy: '', other: 'data' });
    expect(result).toContain('"other": "data"');
  });

  it('converts non-object/non-array values with String()', () => {
    expect(formatHierarchyTree(42)).toBe('42');
    expect(formatHierarchyTree(null)).toBe('null');
    expect(formatHierarchyTree(undefined)).toBe('undefined');
    expect(formatHierarchyTree(true)).toBe('true');
  });

  it('formats an array of hierarchy nodes as a tree', () => {
    const nodes = [
      {
        nodeId: 'n1',
        type: 'FRAME',
        name: 'Container',
        bounds: { x: 0, y: 0, width: 400, height: 300 },
        children: [
          {
            nodeId: 'n2',
            type: 'TEXT',
            name: 'Title',
            bounds: { x: 0, y: 0, width: 200, height: 24 }
          }
        ]
      }
    ];

    const result = formatHierarchyTree(nodes);
    expect(result).toContain('FRAME "Container"');
    expect(result).toContain('400×300');
    expect(result).toContain('TEXT "Title"');
    expect(result).toContain('└─');
  });

  it('JSON-stringifies array of non-node objects', () => {
    const result = formatHierarchyTree([1, 2, 3]);
    expect(result).toBe(JSON.stringify([1, 2, 3], null, 2));
  });

  it('JSON-stringifies empty array', () => {
    const result = formatHierarchyTree([]);
    expect(result).toBe('[]');
  });
});
