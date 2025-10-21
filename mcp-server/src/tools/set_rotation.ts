/**
 * MCP Tool: set_rotation
 *
 * Rotates a node by specified degrees.
 *
 * PRIMITIVE: Raw Figma rotation primitive.
 * In Figma: node.rotation = degrees
 * Use for: angled elements, decorative layouts, dynamic compositions
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetRotationInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node to rotate'),
  rotation: z.number().describe('Rotation angle in degrees (0-360, positive = clockwise)')
});

export type SetRotationInput = z.infer<typeof SetRotationInputSchema>;

/**
 * Tool definition
 */
export const setRotationToolDefinition = {
  name: 'set_rotation',
  description: `Rotates a node by specified degrees.

PRIMITIVE: Raw Figma rotation primitive - not a pre-made component.
Use for: angled text, diagonal elements, rotated icons, dynamic layouts.

Rotation:
- 0° = No rotation
- 90° = Quarter turn clockwise
- 180° = Upside down
- 270° = Quarter turn counter-clockwise
- 45° = Diagonal
- Positive values = Clockwise
- Negative values = Counter-clockwise

Example - Diagonal Badge:
set_rotation({
  nodeId: "badge-123",
  rotation: 45  // 45° clockwise
})

Example - Upside Down:
set_rotation({
  nodeId: "text-456",
  rotation: 180
})

CSS Equivalent:
transform: rotate(45deg);`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node to rotate'
      },
      rotation: {
        type: 'number' as const,
        description: 'Rotation angle in degrees'
      }
    },
    required: ['nodeId', 'rotation']
  }
};

/**
 * Result type
 */
export interface SetRotationResult {
  nodeId: string;
  rotation: number;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 */
export async function setRotation(input: SetRotationInput): Promise<SetRotationResult> {
  // Validate input
  const validated = SetRotationInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  // Note: bridge.sendToFigma validates success at protocol level
  // It only resolves if Figma returns success=true, otherwise rejects
  await bridge.sendToFigma(
    'set_rotation',
    {
    nodeId: validated.nodeId,
    rotation: validated.rotation
  }
  )

  // Normalize rotation for display
  const normalizedRotation = ((validated.rotation % 360) + 360) % 360;

  const cssEquivalent = `transform: rotate(${validated.rotation}deg);`;

  return {
    nodeId: validated.nodeId,
    rotation: normalizedRotation,
    cssEquivalent,
    message: `Rotated node ${validated.rotation}° (${validated.rotation > 0 ? 'clockwise' : 'counter-clockwise'})`
  };
}
