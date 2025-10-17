/**
 * MCP Tool: set_text_decoration
 *
 * Sets text decoration (underline, strikethrough) on text nodes.
 *
 * PRIMITIVE: Raw Figma text decoration primitive.
 * In Figma: textNode.textDecoration = 'UNDERLINE' | 'STRIKETHROUGH'
 * Use for: links, emphasis, deleted text, price strikethrough
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetTextDecorationInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the text node'),
  decoration: z.enum(['NONE', 'UNDERLINE', 'STRIKETHROUGH']).describe('Text decoration style')
});

export type SetTextDecorationInput = z.infer<typeof SetTextDecorationInputSchema>;

/**
 * Tool definition
 */
export const setTextDecorationToolDefinition = {
  name: 'set_text_decoration',
  description: `Sets text decoration (underline, strikethrough) on text nodes.

PRIMITIVE: Raw Figma text decoration primitive - not a pre-made component.
Use for: links (underline), emphasis, deleted text, price strikethrough.

Decoration Options:
- NONE: No decoration (remove existing)
- UNDERLINE: Underline text (common for links)
- STRIKETHROUGH: Strike through text (common for old prices, deleted text)

Example - Link Underline:
set_text_decoration({
  nodeId: "text-link-123",
  decoration: "UNDERLINE"
})

Example - Price Strikethrough:
set_text_decoration({
  nodeId: "old-price-456",
  decoration: "STRIKETHROUGH"
})

Example - Remove Decoration:
set_text_decoration({
  nodeId: "text-789",
  decoration: "NONE"
})

CSS Equivalent:
text-decoration: underline;
text-decoration: line-through;`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the text node'
      },
      decoration: {
        type: 'string' as const,
        enum: ['NONE', 'UNDERLINE', 'STRIKETHROUGH'],
        description: 'Text decoration style'
      }
    },
    required: ['nodeId', 'decoration']
  }
};

/**
 * Result type
 */
export interface SetTextDecorationResult {
  nodeId: string;
  decoration: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 */
export async function setTextDecoration(
  input: SetTextDecorationInput
): Promise<SetTextDecorationResult> {
  // Validate input
  const validated = SetTextDecorationInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  if (!bridge.isConnected()) {
    throw new Error('Not connected to Figma. Ensure the plugin is running.');
  }

  // Send command to Figma
  const response = await bridge.sendToFigma<{ success: boolean; error?: string }>('set_text_decoration', {
    nodeId: validated.nodeId,
    decoration: validated.decoration
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to set text decoration');
  }

  // Build CSS equivalent
  const cssMap = {
    NONE: 'text-decoration: none;',
    UNDERLINE: 'text-decoration: underline;',
    STRIKETHROUGH: 'text-decoration: line-through;'
  };

  const decorationLabel = {
    NONE: 'no decoration',
    UNDERLINE: 'underline',
    STRIKETHROUGH: 'strikethrough'
  };

  return {
    nodeId: validated.nodeId,
    decoration: validated.decoration,
    cssEquivalent: cssMap[validated.decoration],
    message: `Applied ${decorationLabel[validated.decoration]} to text node`
  };
}
