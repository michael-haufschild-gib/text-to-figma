/**
 * MCP Tool: set_text_case
 *
 * Sets text case transformation on text nodes.
 *
 * PRIMITIVE: Raw Figma text case primitive.
 * In Figma: textNode.textCase = 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE'
 * Use for: all caps labels, title case headings, lowercase text
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetTextCaseInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the text node'),
  textCase: z.enum(['ORIGINAL', 'UPPER', 'LOWER', 'TITLE']).describe('Text case transformation')
});

export type SetTextCaseInput = z.infer<typeof SetTextCaseInputSchema>;

/**
 * Tool definition
 */
export const setTextCaseToolDefinition = {
  name: 'set_text_case',
  description: `Sets text case transformation on text nodes.

PRIMITIVE: Raw Figma text case primitive - not a pre-made component.
Use for: all caps labels, title case headings, lowercase text, original case.

Text Case Options:
- ORIGINAL: No transformation (preserve original text)
- UPPER: ALL CAPS (uppercase)
- LOWER: all lowercase
- TITLE: Title Case (Capitalize Each Word)

Example - All Caps Label:
set_text_case({
  nodeId: "label-123",
  textCase: "UPPER"
})

Example - Title Case Heading:
set_text_case({
  nodeId: "heading-456",
  textCase: "TITLE"
})

Example - Lowercase Text:
set_text_case({
  nodeId: "text-789",
  textCase: "LOWER"
})

Example - Restore Original:
set_text_case({
  nodeId: "text-012",
  textCase: "ORIGINAL"
})

CSS Equivalent:
text-transform: uppercase;
text-transform: lowercase;
text-transform: capitalize;
text-transform: none;`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the text node'
      },
      textCase: {
        type: 'string' as const,
        enum: ['ORIGINAL', 'UPPER', 'LOWER', 'TITLE'],
        description: 'Text case transformation'
      }
    },
    required: ['nodeId', 'textCase']
  }
};

/**
 * Result type
 */
export interface SetTextCaseResult {
  nodeId: string;
  textCase: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE';
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 */
export async function setTextCase(input: SetTextCaseInput): Promise<SetTextCaseResult> {
  // Validate input
  const validated = SetTextCaseInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  // Note: bridge.sendToFigma validates success at protocol level
  // It only resolves if Figma returns success=true, otherwise rejects
  await bridge.sendToFigma(
    'set_text_case',
    {
    nodeId: validated.nodeId,
    textCase: validated.textCase
  }
  )

  // Build CSS equivalent
  const cssMap = {
    ORIGINAL: 'text-transform: none;',
    UPPER: 'text-transform: uppercase;',
    LOWER: 'text-transform: lowercase;',
    TITLE: 'text-transform: capitalize;'
  };

  const caseLabel = {
    ORIGINAL: 'original case',
    UPPER: 'UPPERCASE',
    LOWER: 'lowercase',
    TITLE: 'Title Case'
  };

  return {
    nodeId: validated.nodeId,
    textCase: validated.textCase,
    cssEquivalent: cssMap[validated.textCase],
    message: `Set text case to ${caseLabel[validated.textCase]}`
  };
}
