/**
 * MCP Tool: set_opacity
 *
 * Sets node opacity (transparency).
 *
 * PRIMITIVE: Raw Figma opacity primitive.
 * In Figma: node.opacity = 0.0-1.0
 * Use for: transparency, fading, disabled states, overlays
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetOpacityInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node'),
  opacity: z
    .number()
    .min(0)
    .max(1)
    .describe('Opacity value from 0 (fully transparent) to 1 (fully opaque)')
});

export type SetOpacityInput = z.infer<typeof SetOpacityInputSchema>;

/**
 * Tool definition
 */
export const setOpacityToolDefinition = {
  name: 'set_opacity',
  description: `Sets node opacity (transparency).

PRIMITIVE: Raw Figma opacity primitive - not a pre-made component.
Use for: transparency, fading effects, disabled states, overlays, ghosting.

Opacity Values:
- 1.0 = Fully opaque (100%, default)
- 0.75 = 75% opacity (slightly transparent)
- 0.5 = 50% opacity (semi-transparent)
- 0.25 = 25% opacity (very transparent)
- 0.0 = Fully transparent (invisible but present)

Common Use Cases:
- Disabled state: 0.4-0.6 opacity
- Hover effect: 0.8-0.9 opacity
- Overlay: 0.3-0.5 opacity
- Ghost element: 0.2-0.3 opacity

Example - Disabled Button:
set_opacity({
  nodeId: "button-123",
  opacity: 0.5
})

Example - Overlay:
set_opacity({
  nodeId: "modal-backdrop-456",
  opacity: 0.4
})

Example - Hover Effect:
set_opacity({
  nodeId: "icon-789",
  opacity: 0.8
})

CSS Equivalent:
opacity: 0.5;`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node'
      },
      opacity: {
        type: 'number' as const,
        description: 'Opacity value from 0 to 1',
        minimum: 0,
        maximum: 1
      }
    },
    required: ['nodeId', 'opacity']
  }
};

/**
 * Result type
 */
export interface SetOpacityResult {
  nodeId: string;
  opacity: number;
  percentage: number;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 */
export async function setOpacity(input: SetOpacityInput): Promise<SetOpacityResult> {
  // Validate input
  const validated = SetOpacityInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  // Note: bridge.sendToFigma validates success at protocol level
  // It only resolves if Figma returns success=true, otherwise rejects
  await bridge.sendToFigma(
    'set_opacity',
    {
    nodeId: validated.nodeId,
    opacity: validated.opacity
  }
  )

  const percentage = Math.round(validated.opacity * 100);
  const cssEquivalent = `opacity: ${validated.opacity};`;

  return {
    nodeId: validated.nodeId,
    opacity: validated.opacity,
    percentage,
    cssEquivalent,
    message: `Set opacity to ${validated.opacity} (${percentage}%)`
  };
}
