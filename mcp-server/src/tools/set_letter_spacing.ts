/**
 * MCP Tool: set_letter_spacing
 *
 * Sets letter spacing (tracking) on text nodes.
 *
 * PRIMITIVE: Raw Figma letter spacing primitive.
 * In Figma: textNode.letterSpacing = { value: number, unit: 'PIXELS' | 'PERCENT' }
 * Use for: tight/loose tracking, display text, headings
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetLetterSpacingInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the text node'),
  value: z.number().describe('Letter spacing value'),
  unit: z
    .enum(['PIXELS', 'PERCENT'])
    .optional()
    .default('PERCENT')
    .describe('Unit for letter spacing (PIXELS or PERCENT)')
});

export type SetLetterSpacingInput = z.infer<typeof SetLetterSpacingInputSchema>;

/**
 * Tool definition
 */
export const setLetterSpacingToolDefinition = {
  name: 'set_letter_spacing',
  description: `Sets letter spacing (tracking) on text nodes.

PRIMITIVE: Raw Figma letter spacing primitive - not a pre-made component.
Use for: tight tracking (display text), loose tracking (headings), normal tracking.

Units:
- PERCENT: Percentage of font size (default, most common)
  * 0% = Normal spacing
  * Negative = Tighter spacing (e.g., -2%)
  * Positive = Looser spacing (e.g., 5%)
- PIXELS: Fixed pixel spacing
  * 0 = Normal spacing
  * Negative = Tighter spacing (e.g., -1px)
  * Positive = Looser spacing (e.g., 2px)

Example - Tight Display Text:
set_letter_spacing({
  nodeId: "heading-123",
  value: -2,
  unit: "PERCENT"
})

Example - Loose All Caps:
set_letter_spacing({
  nodeId: "label-456",
  value: 10,
  unit: "PERCENT"
})

Example - Fixed Pixel Spacing:
set_letter_spacing({
  nodeId: "text-789",
  value: 1.5,
  unit: "PIXELS"
})

CSS Equivalent:
letter-spacing: 0.05em; (for 5% PERCENT)
letter-spacing: 2px; (for 2 PIXELS)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the text node'
      },
      value: {
        type: 'number' as const,
        description: 'Letter spacing value'
      },
      unit: {
        type: 'string' as const,
        enum: ['PIXELS', 'PERCENT'],
        description: 'Unit for letter spacing',
        default: 'PERCENT'
      }
    },
    required: ['nodeId', 'value']
  }
};

/**
 * Result type
 */
export interface SetLetterSpacingResult {
  nodeId: string;
  value: number;
  unit: 'PIXELS' | 'PERCENT';
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 */
export async function setLetterSpacing(
  input: SetLetterSpacingInput
): Promise<SetLetterSpacingResult> {
  // Validate input
  const validated = SetLetterSpacingInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  // Note: bridge.sendToFigma validates success at protocol level
  // It only resolves if Figma returns success=true, otherwise rejects
  await bridge.sendToFigma(
    'set_letter_spacing',
    {
      nodeId: validated.nodeId,
      value: validated.value,
      unit: validated.unit
    }
  )

  // Build CSS equivalent
  let cssEquivalent: string;
  if (validated.unit === 'PERCENT') {
    // Convert percent to em (0.01em per 1%)
    const emValue = (validated.value / 100).toFixed(3);
    cssEquivalent = `letter-spacing: ${emValue}em;`;
  } else {
    cssEquivalent = `letter-spacing: ${validated.value}px;`;
  }

  const direction = validated.value > 0 ? 'looser' : validated.value < 0 ? 'tighter' : 'normal';

  return {
    nodeId: validated.nodeId,
    value: validated.value,
    unit: validated.unit,
    cssEquivalent,
    message: `Set letter spacing to ${validated.value}${validated.unit === 'PERCENT' ? '%' : 'px'} (${direction} tracking)`
  };
}
