/**
 * MCP Tool: create_line
 *
 * Creates a line (straight path between two points).
 *
 * PRIMITIVE: Raw Figma line primitive.
 * In Figma: figma.createLine()
 * Use for: dividers, underlines, arrows, connections, borders
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const CreateLineInputSchema = z.object({
  x1: z.number().describe('Starting X coordinate'),
  y1: z.number().describe('Starting Y coordinate'),
  x2: z.number().describe('Ending X coordinate'),
  y2: z.number().describe('Ending Y coordinate'),
  strokeColor: z
    .string()
    .optional()
    .default('#000000')
    .describe('Line color in hex (default: black)'),
  strokeWeight: z
    .number()
    .positive()
    .optional()
    .default(1)
    .describe('Line thickness in pixels (default: 1)'),
  strokeCap: z
    .enum(['NONE', 'ROUND', 'SQUARE'])
    .optional()
    .default('NONE')
    .describe('Line end cap style'),
  dashPattern: z
    .array(z.number())
    .optional()
    .describe('Dash pattern [dashLength, gapLength] for dashed lines'),
  name: z.string().optional().default('Line').describe('Name for the line node'),
  parentId: z.string().optional().describe('Parent frame ID (optional)')
});

export type CreateLineInput = z.infer<typeof CreateLineInputSchema>;

/**
 * Tool definition
 */
export const createLineToolDefinition = {
  name: 'create_line',
  description: `Creates a straight line between two points.

PRIMITIVE: Raw Figma line primitive - not a pre-made component.
Use for: dividers, underlines, borders, connections, arrows (combine with shapes).

Coordinates: x1,y1 = start point, x2,y2 = end point
Horizontal line: y1 = y2
Vertical line: x1 = x2

Example - Horizontal Divider:
create_line({
  x1: 0,
  y1: 0,
  x2: 300,
  y2: 0,  // Same Y = horizontal
  strokeColor: "#E0E0E0",
  strokeWeight: 1
})

Example - Dashed Line:
create_line({
  x1: 0,
  y1: 0,
  x2: 200,
  y2: 0,
  strokeColor: "#999999",
  strokeWeight: 2,
  dashPattern: [5, 3]  // 5px dash, 3px gap
})

CSS Equivalent:
border-top: 1px solid #E0E0E0; /* for horizontal divider */`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      x1: {
        type: 'number' as const,
        description: 'Starting X coordinate'
      },
      y1: {
        type: 'number' as const,
        description: 'Starting Y coordinate'
      },
      x2: {
        type: 'number' as const,
        description: 'Ending X coordinate'
      },
      y2: {
        type: 'number' as const,
        description: 'Ending Y coordinate'
      },
      strokeColor: {
        type: 'string' as const,
        description: 'Line color in hex (default: #000000)',
        default: '#000000'
      },
      strokeWeight: {
        type: 'number' as const,
        description: 'Line thickness in pixels (default: 1)',
        default: 1
      },
      strokeCap: {
        type: 'string' as const,
        enum: ['NONE', 'ROUND', 'SQUARE'],
        description: 'Line end cap style (default: NONE)',
        default: 'NONE'
      },
      dashPattern: {
        type: 'array' as const,
        items: { type: 'number' as const },
        description: 'Dash pattern [dashLength, gapLength]'
      },
      name: {
        type: 'string' as const,
        description: 'Name for the line (default: "Line")',
        default: 'Line'
      },
      parentId: {
        type: 'string' as const,
        description: 'Parent frame ID (optional)'
      }
    },
    required: ['x1', 'y1', 'x2', 'y2']
  }
};

/**
 * Result type
 */
export interface CreateLineResult {
  lineId: string;
  length: number;
  isHorizontal: boolean;
  isVertical: boolean;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function createLine(input: CreateLineInput): Promise<CreateLineResult> {
  // Validate input
  const validated = input;

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma with response validation
  const response = await bridge.sendToFigmaValidated(
    'create_line',
    {
      x1: validated.x1,
      y1: validated.y1,
      x2: validated.x2,
      y2: validated.y2,
      strokeColor: validated.strokeColor,
      strokeWeight: validated.strokeWeight,
      strokeCap: validated.strokeCap,
      dashPattern: validated.dashPattern,
      name: validated.name,
      parentId: validated.parentId
    },
    z.object({ nodeId: z.string().optional(), error: z.string().optional() })
  );

  // Calculate line properties
  const dx = validated.x2 - validated.x1;
  const dy = validated.y2 - validated.y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const isHorizontal = dy === 0;
  const isVertical = dx === 0;

  // Build CSS equivalent
  let cssEquivalent = '';
  if (isHorizontal) {
    cssEquivalent = `border-top: ${validated.strokeWeight}px solid ${validated.strokeColor};`;
    if (validated.dashPattern !== undefined) {
      cssEquivalent += `\nborder-style: dashed;`;
    }
  } else if (isVertical) {
    cssEquivalent = `border-left: ${validated.strokeWeight}px solid ${validated.strokeColor};`;
    if (validated.dashPattern !== undefined) {
      cssEquivalent += `\nborder-style: dashed;`;
    }
  } else {
    // Diagonal line - use SVG or transform
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    cssEquivalent = `/* Diagonal line - use SVG or CSS transform */
width: ${length}px;
height: ${validated.strokeWeight}px;
background: ${validated.strokeColor};
transform: rotate(${angle}deg);`;
  }

  return {
    lineId: response.nodeId ?? '',
    length: Math.round(length),
    isHorizontal,
    isVertical,
    cssEquivalent,
    message: `Created ${isHorizontal ? 'horizontal' : isVertical ? 'vertical' : 'diagonal'} line (length: ${Math.round(length)}px)`
  };
}
