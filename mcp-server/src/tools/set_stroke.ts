/**
 * MCP Tool: set_stroke
 *
 * Sets stroke (border/outline) properties on a node.
 *
 * PRIMITIVE: Raw Figma stroke primitive.
 * In Figma: node.strokes, node.strokeWeight, node.strokeAlign, node.dashPattern
 * Use for: borders, outlines, dividers, emphasis
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetStrokeInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node'),
  strokeWeight: z.number().positive().describe('Stroke width in pixels'),
  strokeColor: z.string().describe('Stroke color in hex format (e.g., #000000)'),
  strokeAlign: z
    .enum(['INSIDE', 'OUTSIDE', 'CENTER'])
    .optional()
    .default('INSIDE')
    .describe('Stroke alignment'),
  dashPattern: z
    .array(z.number())
    .optional()
    .describe('Dash pattern [dash, gap] for dashed strokes'),
  opacity: z.number().min(0).max(1).optional().default(1).describe('Stroke opacity (0-1)'),
  strokeJoin: z
    .enum(['MITER', 'BEVEL', 'ROUND'])
    .optional()
    .describe('How corners are rendered (sharp/flat/rounded)'),
  strokeCap: z
    .enum(['NONE', 'ROUND', 'SQUARE'])
    .optional()
    .describe('How line endings are rendered')
});

export type SetStrokeInput = z.infer<typeof SetStrokeInputSchema>;

/**
 * Tool definition
 */
export const setStrokeToolDefinition = {
  name: 'set_stroke',
  description: `Sets stroke (border/outline) properties on a node.

WHEN TO USE THIS TOOL:
- Adding or updating strokes on EXISTING nodes
- Styling borders, outlines, dividers

DON'T use this for:
- New node creation (set stroke in create_* tools)

CONSOLIDATED TOOL: Now includes strokeJoin and strokeCap (replaces set_stroke_join, set_stroke_cap)

PRIMITIVE: Raw Figma stroke primitive - not a pre-made component.
Use for: borders, outlines, dividers, emphasis, stroked shapes.

Stroke Alignment:
- INSIDE: Stroke inside the shape boundary (most common for UI)
- OUTSIDE: Stroke outside the shape boundary
- CENTER: Stroke centered on the boundary

Stroke Join (corners):
- MITER: Sharp pointed corners (default)
- BEVEL: Flat angled corners
- ROUND: Rounded corners

Stroke Cap (line endings):
- NONE: Flat square ending at path endpoint (default)
- ROUND: Circular rounded ending
- SQUARE: Square ending that extends beyond path

Example - Solid Border:
set_stroke({
  nodeId: "frame-123",
  strokeWeight: 1,
  strokeColor: "#E0E0E0",
  strokeAlign: "INSIDE"
})

Example - Dashed Border:
set_stroke({
  nodeId: "frame-456",
  strokeWeight: 2,
  strokeColor: "#0066FF",
  strokeAlign: "CENTER",
  dashPattern: [5, 3]  // 5px dash, 3px gap
})

Example - Rounded Corners:
set_stroke({
  nodeId: "path-789",
  strokeWeight: 3,
  strokeColor: "#FF0000",
  strokeJoin: "ROUND",
  strokeCap: "ROUND"
})

CSS Equivalent (Solid):
border: 1px solid #E0E0E0;

CSS Equivalent (Dashed):
border: 2px dashed #0066FF;`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node'
      },
      strokeWeight: {
        type: 'number' as const,
        description: 'Stroke width in pixels'
      },
      strokeColor: {
        type: 'string' as const,
        description: 'Stroke color in hex (e.g., #000000)'
      },
      strokeAlign: {
        type: 'string' as const,
        enum: ['INSIDE', 'OUTSIDE', 'CENTER'],
        description: 'Stroke alignment (default: INSIDE)',
        default: 'INSIDE'
      },
      dashPattern: {
        type: 'array' as const,
        items: { type: 'number' as const },
        description: 'Dash pattern [dashLength, gapLength]'
      },
      opacity: {
        type: 'number' as const,
        description: 'Stroke opacity 0-1 (default: 1)',
        minimum: 0,
        maximum: 1,
        default: 1
      },
      strokeJoin: {
        type: 'string' as const,
        enum: ['MITER', 'BEVEL', 'ROUND'],
        description: 'How corners are rendered (optional)'
      },
      strokeCap: {
        type: 'string' as const,
        enum: ['NONE', 'ROUND', 'SQUARE'],
        description: 'How line endings are rendered (optional)'
      }
    },
    required: ['nodeId', 'strokeWeight', 'strokeColor']
  }
};

/**
 * Result type
 */
export interface SetStrokeResult {
  nodeId: string;
  strokeWeight: number;
  strokeAlign: string;
  isDashed: boolean;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function setStroke(input: SetStrokeInput): Promise<SetStrokeResult> {
  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  await bridge.sendToFigmaWithRetry('set_stroke', {
    nodeId: input.nodeId,
    strokeWeight: input.strokeWeight,
    strokeColor: input.strokeColor,
    strokeAlign: input.strokeAlign,
    dashPattern: input.dashPattern,
    opacity: input.opacity,
    strokeJoin: input.strokeJoin,
    strokeCap: input.strokeCap
  });

  const isDashed = !!input.dashPattern;

  // Build CSS equivalent
  const borderStyle = isDashed ? 'dashed' : 'solid';
  let cssEquivalent = `border: ${input.strokeWeight}px ${borderStyle} ${input.strokeColor};`;

  if (input.opacity < 1) {
    // Convert hex to rgba for opacity
    const r = parseInt(input.strokeColor.slice(1, 3), 16);
    const g = parseInt(input.strokeColor.slice(3, 5), 16);
    const b = parseInt(input.strokeColor.slice(5, 7), 16);
    cssEquivalent = `border: ${input.strokeWeight}px ${borderStyle} rgba(${r}, ${g}, ${b}, ${input.opacity});`;
  }

  // Note about alignment
  if (input.strokeAlign !== 'INSIDE') {
    cssEquivalent += `\n/* Note: CSS borders are like INSIDE alignment. ${input.strokeAlign} requires different approach */`;
  }

  return {
    nodeId: input.nodeId,
    strokeWeight: input.strokeWeight,
    strokeAlign: input.strokeAlign,
    isDashed,
    cssEquivalent,
    message: `Applied ${isDashed ? 'dashed' : 'solid'} stroke (${input.strokeWeight}px, ${input.strokeAlign})`
  };
}
