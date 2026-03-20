/**
 * MCP Tool: set_text_properties
 *
 * Consolidated text styling tool - sets decoration, spacing, case, and paragraph formatting.
 * Replaces: set_text_decoration, set_letter_spacing, set_text_case, set_paragraph_spacing
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema - all parameters optional
 */
export const SetTextPropertiesInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the text node'),
  decoration: z.enum(['NONE', 'UNDERLINE', 'STRIKETHROUGH']).optional().describe('Text decoration'),
  letterSpacing: z
    .object({
      value: z.number().describe('Letter spacing value'),
      unit: z.enum(['PIXELS', 'PERCENT']).default('PERCENT').describe('Unit (PIXELS or PERCENT)')
    })
    .optional()
    .describe('Letter spacing (tracking)'),
  textCase: z
    .enum(['ORIGINAL', 'UPPER', 'LOWER', 'TITLE'])
    .optional()
    .describe('Text case transformation'),
  paragraphSpacing: z.number().optional().describe('Space after paragraphs in pixels'),
  paragraphIndent: z
    .number()
    .optional()
    .describe('First line indent in pixels (negative for hanging indent)')
});

export type SetTextPropertiesInput = z.infer<typeof SetTextPropertiesInputSchema>;

/**
 * Tool definition
 */
export const setTextPropertiesToolDefinition = {
  name: 'set_text_properties',
  description: `Sets advanced text styling properties (decoration, spacing, case, paragraphs).

🎯 WHEN TO USE THIS TOOL:
- Styling an EXISTING text node
- Adding underlines, letter spacing, text transformations
- Formatting multi-paragraph text

⚠️ DON'T use this for:
- Basic text properties like fontSize, fontWeight (use create_text or set_fills for color)
- New text creation (use create_text or create_design)

CONSOLIDATED TOOL: Replaces set_text_decoration, set_letter_spacing, set_text_case, set_paragraph_spacing

All parameters optional - only specify what you want to change:

Decoration:
- NONE: No decoration (remove existing)
- UNDERLINE: Underline text (common for links)
- STRIKETHROUGH: Strike through text (old prices, deleted text)
- CSS: text-decoration: underline; or line-through;

Letter Spacing (tracking):
- value: Spacing amount
- unit: PIXELS (fixed) or PERCENT (relative to font size)
- Examples: { value: 5, unit: 'PERCENT' } for loose tracking
- CSS: letter-spacing: 0.05em; (5%) or letter-spacing: 2px;

Text Case:
- ORIGINAL: No transformation
- UPPER: ALL CAPS
- LOWER: all lowercase
- TITLE: Title Case (Capitalize Each Word)
- CSS: text-transform: uppercase/lowercase/capitalize/none;

Paragraph Spacing:
- paragraphSpacing: Space after each paragraph in pixels
- paragraphIndent: First line indent (positive = indent, negative = hanging)
- CSS: margin-bottom: 16px; text-indent: 24px;

Examples:

Underline link text:
{
  nodeId: "link-text-123",
  decoration: "UNDERLINE"
}

All caps with loose tracking:
{
  nodeId: "heading-456",
  textCase: "UPPER",
  letterSpacing: { value: 10, unit: "PERCENT" }
}

Price strikethrough:
{
  nodeId: "old-price-789",
  decoration: "STRIKETHROUGH"
}

Multi-paragraph formatting:
{
  nodeId: "article-text-012",
  paragraphSpacing: 16,
  paragraphIndent: 24
}

Complete text styling:
{
  nodeId: "fancy-text-345",
  decoration: "UNDERLINE",
  letterSpacing: { value: 2, unit: "PIXELS" },
  textCase: "TITLE",
  paragraphSpacing: 12
}`,
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
        description: 'Text decoration (optional)'
      },
      letterSpacing: {
        type: 'object' as const,
        properties: {
          value: { type: 'number' as const, description: 'Letter spacing value' },
          unit: {
            type: 'string' as const,
            enum: ['PIXELS', 'PERCENT'],
            description: 'Unit (PIXELS or PERCENT, default: PERCENT)'
          }
        },
        description: 'Letter spacing (optional)'
      },
      textCase: {
        type: 'string' as const,
        enum: ['ORIGINAL', 'UPPER', 'LOWER', 'TITLE'],
        description: 'Text case transformation (optional)'
      },
      paragraphSpacing: {
        type: 'number' as const,
        description: 'Space after paragraphs in pixels (optional)'
      },
      paragraphIndent: {
        type: 'number' as const,
        description: 'First line indent in pixels (optional, can be negative)'
      }
    },
    required: ['nodeId']
  }
};

/**
 * Result type
 */
export interface SetTextPropertiesResult {
  nodeId: string;
  applied: string[];
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function setTextProperties(
  input: SetTextPropertiesInput
): Promise<SetTextPropertiesResult> {
  // Validate input
  const validated = input;

  // Track what properties were applied
  const applied: string[] = [];
  const cssLines: string[] = [];

  // Build command payload for Figma
  const payload: Record<string, unknown> = { nodeId: validated.nodeId };

  if (validated.decoration !== undefined) {
    payload.decoration = validated.decoration;
    applied.push('decoration');
    if (validated.decoration === 'UNDERLINE') {
      cssLines.push('text-decoration: underline;');
    } else if (validated.decoration === 'STRIKETHROUGH') {
      cssLines.push('text-decoration: line-through;');
    } else {
      cssLines.push('text-decoration: none;');
    }
  }

  if (validated.letterSpacing !== undefined) {
    payload.letterSpacing = validated.letterSpacing;
    applied.push('letterSpacing');
    const value = validated.letterSpacing.value;
    const cssValue = validated.letterSpacing.unit === 'PIXELS' ? `${value}px` : `${value / 100}em`;
    cssLines.push(`letter-spacing: ${cssValue};`);
  }

  if (validated.textCase !== undefined) {
    payload.textCase = validated.textCase;
    applied.push('textCase');
    const caseMap: Record<string, string> = {
      UPPER: 'uppercase',
      LOWER: 'lowercase',
      TITLE: 'capitalize',
      ORIGINAL: 'none'
    };
    cssLines.push(`text-transform: ${caseMap[validated.textCase]};`);
  }

  if (validated.paragraphSpacing !== undefined) {
    payload.paragraphSpacing = validated.paragraphSpacing;
    applied.push('paragraphSpacing');
    cssLines.push(`margin-bottom: ${validated.paragraphSpacing}px;`);
  }

  if (validated.paragraphIndent !== undefined) {
    payload.paragraphIndent = validated.paragraphIndent;
    applied.push('paragraphIndent');
    cssLines.push(`text-indent: ${validated.paragraphIndent}px;`);
  }

  if (applied.length === 0) {
    throw new Error(
      'No text properties specified. Provide at least one of: decoration, letterSpacing, textCase, paragraphSpacing, paragraphIndent'
    );
  }

  // Send to Figma
  const bridge = getFigmaBridge();
  await bridge.sendToFigmaWithRetry('set_text_properties', payload);

  return {
    nodeId: validated.nodeId,
    applied,
    cssEquivalent: cssLines.join('\n'),
    message: `Applied text properties: ${applied.join(', ')}`
  };
}
