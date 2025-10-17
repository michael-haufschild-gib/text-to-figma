/**
 * MCP Tool: set_stroke_cap
 *
 * Sets stroke cap style (how line endings are rendered).
 *
 * PRIMITIVE: Raw Figma stroke cap primitive.
 * In Figma: node.strokeCap = 'NONE' | 'ROUND' | 'SQUARE'
 * Use for: line endings, arrow styles, path terminations
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetStrokeCapInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node'),
  strokeCap: z.enum(['NONE', 'ROUND', 'SQUARE']).describe('Stroke cap style')
});

export type SetStrokeCapInput = z.infer<typeof SetStrokeCapInputSchema>;

/**
 * Tool definition
 */
export const setStrokeCapToolDefinition = {
  name: 'set_stroke_cap',
  description: `Sets stroke cap style (how line endings are rendered).

PRIMITIVE: Raw Figma stroke cap primitive - not a pre-made component.
Use for: controlling line ending appearance in strokes.

Stroke Cap Options:
- NONE: Flat square ending at path endpoint (default)
  * Ends exactly at path terminus
  * Best for: precise technical drawings
- ROUND: Circular rounded ending
  * Extends beyond path terminus by radius
  * Best for: organic shapes, friendly designs
- SQUARE: Square ending that extends beyond path
  * Projects beyond path terminus by half stroke width
  * Best for: bold geometric lines

Example - Round Line Caps:
set_stroke_cap({
  nodeId: "line-123",
  strokeCap: "ROUND"
})

Example - Square Extended Caps:
set_stroke_cap({
  nodeId: "path-456",
  strokeCap: "SQUARE"
})

Example - Flat Caps (NONE):
set_stroke_cap({
  nodeId: "line-789",
  strokeCap: "NONE"
})

CSS Equivalent:
stroke-linecap: butt; (for NONE)
stroke-linecap: round;
stroke-linecap: square;`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node'
      },
      strokeCap: {
        type: 'string' as const,
        enum: ['NONE', 'ROUND', 'SQUARE'],
        description: 'Stroke cap style'
      }
    },
    required: ['nodeId', 'strokeCap']
  }
};

/**
 * Result type
 */
export interface SetStrokeCapResult {
  nodeId: string;
  strokeCap: 'NONE' | 'ROUND' | 'SQUARE';
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 */
export async function setStrokeCap(
  input: SetStrokeCapInput
): Promise<SetStrokeCapResult> {
  // Validate input
  const validated = SetStrokeCapInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  if (!bridge.isConnected()) {
    throw new Error('Not connected to Figma. Ensure the plugin is running.');
  }

  // Send command to Figma
  const response = await bridge.sendToFigma<{ success: boolean; error?: string }>('set_stroke_cap', {
    nodeId: validated.nodeId,
    strokeCap: validated.strokeCap
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to set stroke cap');
  }

  // Map Figma NONE to CSS 'butt'
  const cssCapMap = {
    NONE: 'butt',
    ROUND: 'round',
    SQUARE: 'square'
  };

  const cssEquivalent = `stroke-linecap: ${cssCapMap[validated.strokeCap]};`;

  const capLabel = {
    NONE: 'flat caps',
    ROUND: 'rounded caps',
    SQUARE: 'square extended caps'
  };

  return {
    nodeId: validated.nodeId,
    strokeCap: validated.strokeCap,
    cssEquivalent,
    message: `Set stroke cap to ${validated.strokeCap} (${capLabel[validated.strokeCap]})`
  };
}
