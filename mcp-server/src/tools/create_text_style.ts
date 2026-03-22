/**
 * MCP Tool: create_text_style
 *
 * Creates a reusable text style in the Figma file.
 *
 * PRIMITIVE: Raw Figma text style primitive.
 * In Figma: figma.createTextStyle()
 * Use for: typography systems, consistent text formatting
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const CreateTextStyleInputSchema = z.object({
  name: z.string().min(1).describe('Name for the text style'),
  fontFamily: z.string().optional().default('Inter').describe('Font family'),
  fontSize: z.number().positive().describe('Font size in pixels'),
  fontWeight: z
    .number()
    .int()
    .min(100)
    .max(900)
    .optional()
    .default(400)
    .describe('Font weight (100-900)'),
  lineHeight: z
    .number()
    .positive()
    .optional()
    .describe('Line height in pixels (auto if not specified)'),
  letterSpacing: z.number().optional().describe('Letter spacing in pixels or percent'),
  textCase: z
    .enum(['ORIGINAL', 'UPPER', 'LOWER', 'TITLE'])
    .optional()
    .default('ORIGINAL')
    .describe('Text case transformation'),
  textDecoration: z
    .enum(['NONE', 'UNDERLINE', 'STRIKETHROUGH'])
    .optional()
    .default('NONE')
    .describe('Text decoration'),
  description: z.string().optional().describe('Optional description of the text style')
});

export type CreateTextStyleInput = z.infer<typeof CreateTextStyleInputSchema>;

/**
 * Tool definition
 */
export const createTextStyleToolDefinition = {
  name: 'create_text_style',
  description: `Creates a reusable text style in the Figma file.

PRIMITIVE: Raw Figma text style primitive - not a pre-made component.
Use for: typography systems, consistent text formatting, design systems.

Benefits:
- Single source of truth for typography
- Easy global updates (change once, update everywhere)
- Design system consistency
- Type scale management

Naming Conventions:
- Headings: "H1", "H2", "H3", "H4", "H5", "H6"
- Body text: "Body/Regular", "Body/Bold", "Body/Small"
- UI text: "Button", "Label", "Caption", "Overline"
- Display: "Display/Large", "Display/Medium"

Example - Heading Style:
create_text_style({
  name: "H1",
  fontFamily: "Inter",
  fontSize: 48,
  fontWeight: 700,
  lineHeight: 56,
  description: "Main page heading"
})

Example - Body Text:
create_text_style({
  name: "Body/Regular",
  fontFamily: "Inter",
  fontSize: 16,
  fontWeight: 400,
  lineHeight: 24,
  description: "Regular body text"
})

Example - Button Text:
create_text_style({
  name: "Button",
  fontFamily: "Inter",
  fontSize: 16,
  fontWeight: 600,
  textCase: "UPPER",
  letterSpacing: 0.5,
  description: "Button label text"
})

After creating styles, use apply_text_style to apply them to text nodes.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string' as const,
        description: 'Name for the text style'
      },
      fontFamily: {
        type: 'string' as const,
        description: 'Font family',
        default: 'Inter'
      },
      fontSize: {
        type: 'number' as const,
        description: 'Font size in pixels'
      },
      fontWeight: {
        type: 'number' as const,
        description: 'Font weight (100-900)',
        default: 400
      },
      lineHeight: {
        type: 'number' as const,
        description: 'Line height in pixels (auto if not specified)'
      },
      letterSpacing: {
        type: 'number' as const,
        description: 'Letter spacing in pixels or percent'
      },
      textCase: {
        type: 'string' as const,
        enum: ['ORIGINAL', 'UPPER', 'LOWER', 'TITLE'],
        description: 'Text case transformation',
        default: 'ORIGINAL'
      },
      textDecoration: {
        type: 'string' as const,
        enum: ['NONE', 'UNDERLINE', 'STRIKETHROUGH'],
        description: 'Text decoration',
        default: 'NONE'
      },
      description: {
        type: 'string' as const,
        description: 'Optional description of the text style'
      }
    },
    required: ['name', 'fontSize']
  }
};

/**
 * Response schema for Figma bridge create_text_style response
 */
const CreateTextStyleResponseSchema = z
  .object({
    styleId: z.string().optional()
  })
  .passthrough();

/**
 * Result type
 */
export interface CreateTextStyleResult {
  styleId: string;
  name: string;
  fontSize: number;
  fontWeight: number;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function createTextStyle(input: CreateTextStyleInput): Promise<CreateTextStyleResult> {
  // Validate input
  const validated = input;

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  const response = await bridge.sendToFigmaValidated(
    'create_text_style',
    {
      name: validated.name,
      fontFamily: validated.fontFamily,
      fontSize: validated.fontSize,
      fontWeight: validated.fontWeight,
      lineHeight: validated.lineHeight,
      letterSpacing: validated.letterSpacing,
      textCase: validated.textCase,
      textDecoration: validated.textDecoration,
      description: validated.description
    },
    CreateTextStyleResponseSchema
  );

  return {
    styleId: response.styleId ?? '',
    name: validated.name,
    fontSize: validated.fontSize,
    fontWeight: validated.fontWeight,
    message: `Created text style "${validated.name}" (${validated.fontSize}px, ${validated.fontWeight})`
  };
}
