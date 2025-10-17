/**
 * MCP Tool: set_paragraph_spacing
 *
 * Sets paragraph spacing and indent for text nodes.
 *
 * PRIMITIVE: Raw Figma paragraph primitive.
 * In Figma: textNode.paragraphSpacing, textNode.paragraphIndent
 * Use for: multi-paragraph text, article formatting, lists
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetParagraphSpacingInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the text node'),
  paragraphSpacing: z.number().min(0).optional().describe('Space between paragraphs in pixels'),
  paragraphIndent: z.number().optional().describe('First line indent in pixels (can be negative)')
});

export type SetParagraphSpacingInput = z.infer<typeof SetParagraphSpacingInputSchema>;

/**
 * Tool definition
 */
export const setParagraphSpacingToolDefinition = {
  name: 'set_paragraph_spacing',
  description: `Sets paragraph spacing and indent for text nodes.

PRIMITIVE: Raw Figma paragraph primitive - not a pre-made component.
Use for: multi-paragraph text, articles, blog posts, documentation, lists.

Paragraph Spacing:
- Space added AFTER each paragraph
- Common values: 8, 12, 16, 24px
- Use 0 for tight text blocks

Paragraph Indent:
- First line indent (positive = indent, negative = outdent)
- Common values: 0 (none), 16, 24, 32px
- Negative for hanging indents (lists)

Example - Article Paragraphs:
set_paragraph_spacing({
  nodeId: "article-text-123",
  paragraphSpacing: 16,
  paragraphIndent: 0
})

Example - First Line Indent:
set_paragraph_spacing({
  nodeId: "story-text-456",
  paragraphSpacing: 12,
  paragraphIndent: 24
})

Example - Hanging Indent (Lists):
set_paragraph_spacing({
  nodeId: "list-text-789",
  paragraphSpacing: 8,
  paragraphIndent: -20
})

CSS Equivalent:
p {
  margin-bottom: 16px; /* paragraphSpacing */
  text-indent: 24px; /* paragraphIndent */
}`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the text node'
      },
      paragraphSpacing: {
        type: 'number' as const,
        description: 'Space between paragraphs in pixels'
      },
      paragraphIndent: {
        type: 'number' as const,
        description: 'First line indent in pixels (can be negative)'
      }
    },
    required: ['nodeId']
  }
};

/**
 * Result type
 */
export interface SetParagraphSpacingResult {
  nodeId: string;
  paragraphSpacing?: number;
  paragraphIndent?: number;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 */
export async function setParagraphSpacing(
  input: SetParagraphSpacingInput
): Promise<SetParagraphSpacingResult> {
  // Validate input
  const validated = SetParagraphSpacingInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  if (!bridge.isConnected()) {
    throw new Error('Not connected to Figma. Ensure the plugin is running.');
  }

  // Send command to Figma
  const response = await bridge.sendToFigma<{ success: boolean; error?: string }>('set_paragraph_spacing', {
    nodeId: validated.nodeId,
    paragraphSpacing: validated.paragraphSpacing,
    paragraphIndent: validated.paragraphIndent
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to set paragraph spacing');
  }

  // Build CSS equivalent
  let cssEquivalent = 'p {\n';
  if (validated.paragraphSpacing !== undefined) {
    cssEquivalent += `  margin-bottom: ${validated.paragraphSpacing}px;\n`;
  }
  if (validated.paragraphIndent !== undefined) {
    cssEquivalent += `  text-indent: ${validated.paragraphIndent}px;\n`;
  }
  cssEquivalent += '}';

  const parts: string[] = [];
  if (validated.paragraphSpacing !== undefined) {
    parts.push(`paragraph spacing: ${validated.paragraphSpacing}px`);
  }
  if (validated.paragraphIndent !== undefined) {
    const indentType = validated.paragraphIndent > 0 ? 'indent' : validated.paragraphIndent < 0 ? 'hanging indent' : 'no indent';
    parts.push(`${indentType}: ${Math.abs(validated.paragraphIndent)}px`);
  }

  return {
    nodeId: validated.nodeId,
    paragraphSpacing: validated.paragraphSpacing,
    paragraphIndent: validated.paragraphIndent,
    cssEquivalent,
    message: `Set ${parts.join(', ')}`
  };
}
