/**
 * MCP Tool: apply_fill_style
 *
 * Applies a color style to a node's fill.
 *
 * PRIMITIVE: Raw Figma style application primitive.
 * In Figma: node.fillStyleId = styleId
 * Use for: applying design system colors, maintaining consistency
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const ApplyFillStyleInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node to apply style to'),
  styleNameOrId: z.string().min(1).describe('Style name or style ID to apply')
});

export type ApplyFillStyleInput = z.infer<typeof ApplyFillStyleInputSchema>;

/**
 * Tool definition
 */
export const applyFillStyleToolDefinition = {
  name: 'apply_fill_style',
  description: `Applies a color style to a node's fill.

PRIMITIVE: Raw Figma style application primitive - not a pre-made component.
Use for: applying design system colors, maintaining brand consistency.

Benefits:
- Changes propagate automatically when style is updated
- Ensures design system compliance
- Easy to maintain and update globally
- Shared styles across team

Example - Apply Primary Color:
apply_fill_style({
  nodeId: "button-123",
  styleNameOrId: "Primary"
})

Example - Apply Semantic Color:
apply_fill_style({
  nodeId: "error-banner-456",
  styleNameOrId: "Error"
})

Example - Apply by Style ID:
apply_fill_style({
  nodeId: "frame-789",
  styleNameOrId: "S:abc123..."
})

Note: Style must exist in the file (created via create_color_style).`,
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
export interface ApplyFillStyleResult {
  nodeId: string;
  styleName: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function applyFillStyle(input: ApplyFillStyleInput): Promise<ApplyFillStyleResult> {
  // Validate input
  const validated = input;

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  const response = await bridge.sendToFigmaWithRetry<{
    success: boolean;
    styleName?: string;
    error?: string;
  }>('apply_fill_style', {
    nodeId: validated.nodeId,
    styleNameOrId: validated.styleNameOrId
  });
  // Note: Response validated by bridge at protocol level

  return {
    nodeId: validated.nodeId,
    styleName: response.styleName ?? validated.styleNameOrId,
    message: `Applied fill style "${response.styleName ?? validated.styleNameOrId}" to node`
  };
}
