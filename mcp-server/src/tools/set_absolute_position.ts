/**
 * MCP Tool: set_absolute_position
 *
 * Sets absolute X, Y position of a node.
 *
 * PRIMITIVE: Raw Figma positioning primitive.
 * In Figma: node.x = x; node.y = y;
 * Use for: precise positioning, overlays, absolute layouts
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetAbsolutePositionInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node to position'),
  x: z.number().describe('X coordinate in pixels'),
  y: z.number().describe('Y coordinate in pixels')
});

export type SetAbsolutePositionInput = z.infer<typeof SetAbsolutePositionInputSchema>;

/**
 * Tool definition
 */
export const setAbsolutePositionToolDefinition = {
  name: 'set_absolute_position',
  description: `Sets absolute X, Y position of a node.

PRIMITIVE: Raw Figma positioning primitive - not a pre-made component.
Use for: precise positioning, overlays, tooltips, badges, absolute layouts.

Coordinates:
- X: Horizontal position (0 = left edge of canvas)
- Y: Vertical position (0 = top edge of canvas)
- Positive values move right/down
- Negative values move left/up

Example - Center Badge on Button:
set_absolute_position({
  nodeId: "badge-123",
  x: 100,  // Absolute X
  y: 50    // Absolute Y
})

Example - Tooltip Above Element:
set_absolute_position({
  nodeId: "tooltip-456",
  x: 200,
  y: 80
})

CSS Equivalent:
position: absolute;
left: 100px;
top: 50px;`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node to position'
      },
      x: {
        type: 'number' as const,
        description: 'X coordinate in pixels'
      },
      y: {
        type: 'number' as const,
        description: 'Y coordinate in pixels'
      }
    },
    required: ['nodeId', 'x', 'y']
  }
};

/**
 * Result type
 */
export interface SetAbsolutePositionResult {
  nodeId: string;
  x: number;
  y: number;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 */
export async function setAbsolutePosition(
  input: SetAbsolutePositionInput
): Promise<SetAbsolutePositionResult> {
  // Validate input
  const validated = SetAbsolutePositionInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  // Note: bridge.sendToFigma validates success at protocol level
  // It only resolves if Figma returns success=true, otherwise rejects
  await bridge.sendToFigma(
    'set_absolute_position',
    {
      nodeId: validated.nodeId,
      x: validated.x,
      y: validated.y
    }
  )

  const cssEquivalent = `position: absolute;\nleft: ${validated.x}px;\ntop: ${validated.y}px;`;

  return {
    nodeId: validated.nodeId,
    x: validated.x,
    y: validated.y,
    cssEquivalent,
    message: `Positioned node at (${validated.x}, ${validated.y})`
  };
}
