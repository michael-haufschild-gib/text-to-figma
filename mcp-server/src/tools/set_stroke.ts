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
  strokeAlign: z.enum(['INSIDE', 'OUTSIDE', 'CENTER']).optional().default('INSIDE').describe('Stroke alignment'),
  dashPattern: z.array(z.number()).optional().describe('Dash pattern [dash, gap] for dashed strokes'),
  opacity: z.number().min(0).max(1).optional().default(1).describe('Stroke opacity (0-1)')
});

export type SetStrokeInput = z.infer<typeof SetStrokeInputSchema>;

/**
 * Tool definition
 */
export const setStrokeToolDefinition = {
  name: 'set_stroke',
  description: `Sets stroke (border/outline) properties on a node.

PRIMITIVE: Raw Figma stroke primitive - not a pre-made component.
Use for: borders, outlines, dividers, emphasis, stroked shapes.

Stroke Alignment:
- INSIDE: Stroke inside the shape boundary (most common for UI)
- OUTSIDE: Stroke outside the shape boundary
- CENTER: Stroke centered on the boundary

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
 */
export async function setStroke(
  input: SetStrokeInput
): Promise<SetStrokeResult> {
  // Validate input
  const validated = SetStrokeInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  if (!bridge.isConnected()) {
    throw new Error('Not connected to Figma. Ensure the plugin is running.');
  }

  // Send command to Figma
  const response = await bridge.sendToFigma<{ success: boolean; error?: string }>('set_stroke', {
    nodeId: validated.nodeId,
    strokeWeight: validated.strokeWeight,
    strokeColor: validated.strokeColor,
    strokeAlign: validated.strokeAlign,
    dashPattern: validated.dashPattern,
    opacity: validated.opacity
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to set stroke');
  }

  const isDashed = !!validated.dashPattern;

  // Build CSS equivalent
  const borderStyle = isDashed ? 'dashed' : 'solid';
  let cssEquivalent = `border: ${validated.strokeWeight}px ${borderStyle} ${validated.strokeColor};`;

  if (validated.opacity < 1) {
    // Convert hex to rgba for opacity
    const r = parseInt(validated.strokeColor.slice(1, 3), 16);
    const g = parseInt(validated.strokeColor.slice(3, 5), 16);
    const b = parseInt(validated.strokeColor.slice(5, 7), 16);
    cssEquivalent = `border: ${validated.strokeWeight}px ${borderStyle} rgba(${r}, ${g}, ${b}, ${validated.opacity});`;
  }

  // Note about alignment
  if (validated.strokeAlign !== 'INSIDE') {
    cssEquivalent += `\n/* Note: CSS borders are like INSIDE alignment. ${validated.strokeAlign} requires different approach */`;
  }

  return {
    nodeId: validated.nodeId,
    strokeWeight: validated.strokeWeight,
    strokeAlign: validated.strokeAlign,
    isDashed,
    cssEquivalent,
    message: `Applied ${isDashed ? 'dashed' : 'solid'} stroke (${validated.strokeWeight}px, ${validated.strokeAlign})`
  };
}
