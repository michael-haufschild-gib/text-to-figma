/**
 * MCP Tool: apply_text_style
 *
 * Applies a text style to a text node.
 *
 * PRIMITIVE: Raw Figma style application primitive.
 * In Figma: textNode.textStyleId = styleId
 * Use for: applying design system typography, maintaining consistency
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const ApplyTextStyleInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the text node to apply style to'),
  styleNameOrId: z.string().min(1).describe('Style name or style ID to apply')
});

export type ApplyTextStyleInput = z.infer<typeof ApplyTextStyleInputSchema>;

/**
 * Tool definition
 */
export const applyTextStyleToolDefinition = {
  name: 'apply_text_style',
  description: `Applies a text style to a text node.

PRIMITIVE: Raw Figma style application primitive - not a pre-made component.
Use for: applying design system typography, maintaining type consistency.

Benefits:
- Changes propagate automatically when style is updated
- Ensures typography system compliance
- Easy to maintain and update globally
- Shared styles across team

Example - Apply Heading Style:
apply_text_style({
  nodeId: "heading-123",
  styleNameOrId: "H1"
})

Example - Apply Body Text:
apply_text_style({
  nodeId: "paragraph-456",
  styleNameOrId: "Body/Regular"
})

Example - Apply by Style ID:
apply_text_style({
  nodeId: "text-789",
  styleNameOrId: "S:abc123..."
})

Note: Style must exist in the file (created via create_text_style).`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the text node to apply style to'
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
 * Response schema for Figma bridge apply_text_style response
 */
const ApplyTextStyleResponseSchema = z
  .object({
    styleName: z.string().optional()
  })
  .passthrough();

/**
 * Result type
 */
export interface ApplyTextStyleResult {
  nodeId: string;
  styleName: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function applyTextStyle(input: ApplyTextStyleInput): Promise<ApplyTextStyleResult> {
  // Validate input
  const validated = input;

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  const response = await bridge.sendToFigmaValidated(
    'apply_text_style',
    {
      nodeId: validated.nodeId,
      styleNameOrId: validated.styleNameOrId
    },
    ApplyTextStyleResponseSchema
  );

  return {
    nodeId: validated.nodeId,
    styleName: response.styleName ?? validated.styleNameOrId,
    message: `Applied text style "${response.styleName ?? validated.styleNameOrId}" to text node`
  };
}
