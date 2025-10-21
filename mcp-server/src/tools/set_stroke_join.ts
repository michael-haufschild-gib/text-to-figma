/**
 * MCP Tool: set_stroke_join
 *
 * Sets stroke join style (how corners are rendered).
 *
 * PRIMITIVE: Raw Figma stroke join primitive.
 * In Figma: node.strokeJoin = 'MITER' | 'BEVEL' | 'ROUND'
 * Use for: sharp corners, rounded corners, beveled corners
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetStrokeJoinInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node'),
  strokeJoin: z.enum(['MITER', 'BEVEL', 'ROUND']).describe('Stroke join style')
});

export type SetStrokeJoinInput = z.infer<typeof SetStrokeJoinInputSchema>;

/**
 * Tool definition
 */
export const setStrokeJoinToolDefinition = {
  name: 'set_stroke_join',
  description: `Sets stroke join style (how corners are rendered).

PRIMITIVE: Raw Figma stroke join primitive - not a pre-made component.
Use for: controlling corner appearance in stroked shapes.

Stroke Join Options:
- MITER: Sharp pointed corners (default)
  * Creates sharp points at corners
  * Best for: geometric shapes, technical drawings
- BEVEL: Flat angled corners
  * Cuts off corners at an angle
  * Best for: thick strokes, avoiding sharp points
- ROUND: Rounded corners
  * Smooth circular corners
  * Best for: organic shapes, friendly designs

Example - Sharp Corners (MITER):
set_stroke_join({
  nodeId: "rectangle-123",
  strokeJoin: "MITER"
})

Example - Rounded Corners:
set_stroke_join({
  nodeId: "path-456",
  strokeJoin: "ROUND"
})

Example - Beveled Corners:
set_stroke_join({
  nodeId: "polygon-789",
  strokeJoin: "BEVEL"
})

CSS Equivalent:
stroke-linejoin: miter;
stroke-linejoin: round;
stroke-linejoin: bevel;`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node'
      },
      strokeJoin: {
        type: 'string' as const,
        enum: ['MITER', 'BEVEL', 'ROUND'],
        description: 'Stroke join style'
      }
    },
    required: ['nodeId', 'strokeJoin']
  }
};

/**
 * Result type
 */
export interface SetStrokeJoinResult {
  nodeId: string;
  strokeJoin: 'MITER' | 'BEVEL' | 'ROUND';
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 */
export async function setStrokeJoin(input: SetStrokeJoinInput): Promise<SetStrokeJoinResult> {
  // Validate input
  const validated = SetStrokeJoinInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  // Note: bridge.sendToFigma validates success at protocol level
  // It only resolves if Figma returns success=true, otherwise rejects
  await bridge.sendToFigma(
    'set_stroke_join',
    {
      nodeId: validated.nodeId,
      strokeJoin: validated.strokeJoin
    }
  )

  const cssEquivalent = `stroke-linejoin: ${validated.strokeJoin.toLowerCase()};`;

  const joinLabel = {
    MITER: 'sharp pointed corners',
    BEVEL: 'flat beveled corners',
    ROUND: 'rounded corners'
  };

  return {
    nodeId: validated.nodeId,
    strokeJoin: validated.strokeJoin,
    cssEquivalent,
    message: `Set stroke join to ${validated.strokeJoin} (${joinLabel[validated.strokeJoin]})`
  };
}
