/**
 * MCP Tool: flip_node
 *
 * Flips a node horizontally or vertically.
 *
 * PRIMITIVE: Raw Figma transform primitive.
 * In Figma: node.rescale(-1, 1) for horizontal, node.rescale(1, -1) for vertical
 * Use for: mirroring elements, RTL layouts, icon variations
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const FlipNodeInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node to flip'),
  direction: z.enum(['HORIZONTAL', 'VERTICAL', 'BOTH']).describe('Flip direction')
});

export type FlipNodeInput = z.infer<typeof FlipNodeInputSchema>;

/**
 * Tool definition
 */
export const flipNodeToolDefinition = {
  name: 'flip_node',
  description: `Flips a node horizontally or vertically.

PRIMITIVE: Raw Figma transform primitive - not a pre-made component.
Use for: mirroring elements, creating RTL layouts, icon variations.

Flip Directions:
- **HORIZONTAL**: Mirror left-to-right
  * Use for: RTL layouts, mirrored icons, symmetry
- **VERTICAL**: Mirror top-to-bottom
  * Use for: upside-down text, vertical mirroring
- **BOTH**: Mirror both axes (180° rotation equivalent)

Example - Horizontal Flip (RTL):
flip_node({
  nodeId: "arrow-icon-123",
  direction: "HORIZONTAL"
})

Example - Vertical Flip:
flip_node({
  nodeId: "dropdown-icon-456",
  direction: "VERTICAL"
})

Example - Both Axes:
flip_node({
  nodeId: "logo-789",
  direction: "BOTH"
})

CSS Equivalent:
transform: scaleX(-1); /* HORIZONTAL */
transform: scaleY(-1); /* VERTICAL */
transform: scale(-1, -1); /* BOTH */`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node to flip'
      },
      direction: {
        type: 'string' as const,
        enum: ['HORIZONTAL', 'VERTICAL', 'BOTH'],
        description: 'Flip direction'
      }
    },
    required: ['nodeId', 'direction']
  }
};

/**
 * Result type
 */
export interface FlipNodeResult {
  nodeId: string;
  direction: 'HORIZONTAL' | 'VERTICAL' | 'BOTH';
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 */
export async function flipNode(input: FlipNodeInput): Promise<FlipNodeResult> {
  // Validate input
  const validated = FlipNodeInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  // Note: bridge.sendToFigma validates success at protocol level
  // It only resolves if Figma returns success=true, otherwise rejects
  await bridge.sendToFigma(
    'flip_node',
    {
    nodeId: validated.nodeId,
    direction: validated.direction
  }
  )

  // Build CSS equivalent
  const cssMap = {
    HORIZONTAL: 'transform: scaleX(-1);',
    VERTICAL: 'transform: scaleY(-1);',
    BOTH: 'transform: scale(-1, -1);'
  };

  const directionLabel = {
    HORIZONTAL: 'horizontally',
    VERTICAL: 'vertically',
    BOTH: 'both axes'
  };

  return {
    nodeId: validated.nodeId,
    direction: validated.direction,
    cssEquivalent: cssMap[validated.direction],
    message: `Flipped node ${directionLabel[validated.direction]}`
  };
}
