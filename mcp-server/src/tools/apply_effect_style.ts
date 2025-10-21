/**
 * MCP Tool: apply_effect_style
 *
 * Applies an effect style to a node.
 *
 * PRIMITIVE: Raw Figma style application primitive.
 * In Figma: node.effectStyleId = styleId
 * Use for: applying consistent shadows/effects, maintaining design system
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const ApplyEffectStyleInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node to apply style to'),
  styleNameOrId: z.string().min(1).describe('Style name or style ID to apply')
});

export type ApplyEffectStyleInput = z.infer<typeof ApplyEffectStyleInputSchema>;

/**
 * Tool definition
 */
export const applyEffectStyleToolDefinition = {
  name: 'apply_effect_style',
  description: `Applies an effect style to a node.

PRIMITIVE: Raw Figma style application primitive - not a pre-made component.
Use for: applying consistent shadows/blur, elevation systems, design systems.

Benefits:
- Changes propagate automatically when style is updated
- Ensures consistent elevation/depth
- Easy to maintain and update globally
- Shared styles across team

Example - Apply Card Elevation:
apply_effect_style({
  nodeId: "card-123",
  styleNameOrId: "Elevation/2"
})

Example - Apply Button Shadow:
apply_effect_style({
  nodeId: "button-456",
  styleNameOrId: "Shadow/Button Hover"
})

Example - Apply by Style ID:
apply_effect_style({
  nodeId: "frame-789",
  styleNameOrId: "S:abc123..."
})

Note: Style must exist in the file (created via create_effect_style).`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node to apply style to'
      },
      styleNameOrId: {
        type: 'string' as const,
        description: 'Style name or style ID to apply'
      }
    },
    required: ['nodeId', 'styleNameOrId']
  }
};

/**
 * Result type
 */
export interface ApplyEffectStyleResult {
  nodeId: string;
  styleName: string;
  message: string;
}

/**
 * Implementation
 */
export async function applyEffectStyle(
  input: ApplyEffectStyleInput
): Promise<ApplyEffectStyleResult> {
  // Validate input
  const validated = ApplyEffectStyleInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  const response = await bridge.sendToFigmaWithRetry<{
    success: boolean;
    styleName?: string;
    error?: string;
  }>('apply_effect_style', {
    nodeId: validated.nodeId,
    styleNameOrId: validated.styleNameOrId
  });
  // Note: Response validated by bridge at protocol level

  return {
    nodeId: validated.nodeId,
    styleName: response.styleName || validated.styleNameOrId,
    message: `Applied effect style "${response.styleName || validated.styleNameOrId}" to node`
  };
}
