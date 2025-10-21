/**
 * Create Text Tool - HTML Analogy: text content with typography
 *
 * Creates text nodes in Figma with typography constraints.
 * Similar to setting text content and CSS typography properties.
 */

import { z } from 'zod';
import {
  FONT_WEIGHTS,
  fontSizeSchema,
  fontWeightSchema,
  getRecommendedLineHeight,
  VALID_FONT_SIZES,
  type FontSize
} from '../constraints/typography.js';
import { getFigmaBridge } from '../figma-bridge.js';
import {
  validateParentRelationship,
  formatValidationError
} from '../utils/parent-validator.js';
import { getLogger } from '../monitoring/logger.js';

const logger = getLogger().child({ tool: 'create_text' });

/**
 * Supported text alignment values
 */
export const textAlignSchema = z.enum(['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED']);
export type TextAlign = z.infer<typeof textAlignSchema>;

/**
 * Input schema for create_text tool
 */
export const createTextInputSchema = z.object({
  content: z.string().min(1).describe('Text content to display'),
  fontSize: fontSizeSchema.default(16).describe('Font size in pixels (must be in type scale)'),
  fontFamily: z.string().default('Inter').describe('Font family name'),
  fontWeight: fontWeightSchema.default(400).describe('Font weight (100-900)'),
  lineHeight: z
    .number()
    .positive()
    .optional()
    .describe('Line height in pixels (auto-calculated if not provided)'),
  textAlign: textAlignSchema.default('LEFT').describe('Text alignment'),
  color: z.string().optional().describe('Text color in hex format (e.g., #000000)'),
  letterSpacing: z.number().optional().describe('Letter spacing in pixels'),
  parentId: z.string().optional().describe('Parent frame ID to place this text inside')
});

export type CreateTextInput = z.infer<typeof createTextInputSchema>;

/**
 * Result of creating text
 */
export interface CreateTextResult {
  textId: string;
  cssEquivalent: string;
  appliedLineHeight: number;
}

/**
 * Generates CSS equivalent for text properties
 */
function generateCssEquivalent(input: CreateTextInput, appliedLineHeight: number): string {
  const fontWeightName =
    Object.entries(FONT_WEIGHTS).find(([_, val]) => val === input.fontWeight)?.[0] || 'normal';

  let css = `font-family: ${input.fontFamily};
  font-size: ${input.fontSize}px;
  font-weight: ${fontWeightName} (${input.fontWeight});
  line-height: ${appliedLineHeight}px;`;

  if (input.textAlign !== 'LEFT') {
    css += `\n  text-align: ${input.textAlign.toLowerCase()};`;
  }

  if (input.color) {
    css += `\n  color: ${input.color};`;
  }

  if (input.letterSpacing) {
    css += `\n  letter-spacing: ${input.letterSpacing}px;`;
  }

  return css;
}

/**
 * Creates a text node in Figma
 */
export async function createText(input: CreateTextInput): Promise<CreateTextResult> {
  // Validate input
  const validated = createTextInputSchema.parse(input);

  // Validate parent relationship - STRICT MODE to enforce hierarchy
  const parentValidation = await validateParentRelationship('text', validated.parentId, {
    strict: true, // STRICT: Prevent creation without parent to maintain HTML-like hierarchy
    checkExists: true // Check if parent actually exists
  });

  // Throw error if parent validation failed
  if (!parentValidation.isValid) {
    const errorMessage = formatValidationError(parentValidation);
    logger.error('Parent validation failed - text must have a parent container', new Error(errorMessage), {
      input: validated
    });
    throw new Error(errorMessage);
  }

  // Calculate line height if not provided
  const appliedLineHeight =
    validated.lineHeight ?? getRecommendedLineHeight(validated.fontSize as FontSize);

  // Generate CSS equivalent
  const cssEquivalent = generateCssEquivalent(validated, appliedLineHeight);

  // Send to Figma
  const bridge = getFigmaBridge();
  const response = await bridge.sendToFigmaWithRetry<{ nodeId: string }>('create_text', {
    content: validated.content,
    fontSize: validated.fontSize,
    fontFamily: validated.fontFamily,
    fontWeight: validated.fontWeight,
    lineHeight: appliedLineHeight,
    textAlign: validated.textAlign,
    color: validated.color,
    letterSpacing: validated.letterSpacing,
    parentId: validated.parentId
  });

  // Validate response contains nodeId
  if (!response.nodeId) {
    throw new Error('Figma plugin returned invalid response: missing nodeId field');
  }

  return {
    textId: response.nodeId,
    cssEquivalent,
    appliedLineHeight
  };
}

/**
 * Tool definition for MCP
 */
export const createTextToolDefinition = {
  name: 'create_text',
  description: `Creates a text node in Figma with typography constraints.

HTML/CSS Analogy: Like setting text content with CSS font properties.

🚨 MANDATORY REQUIREMENT: parentId is REQUIRED
- Text nodes CANNOT exist at canvas root (just like text can't float outside HTML elements)
- You MUST specify parentId to place text inside a frame container
- Think HTML: text always lives inside <div>, <p>, <span>, etc.
- Without parentId, the tool will REJECT creation with an error

Typography Scale (valid font sizes): ${VALID_FONT_SIZES.join(', ')}

Font Weights:
${Object.entries(FONT_WEIGHTS)
  .map(([name, value]) => `  - ${name}: ${value}`)
  .join('\n')}

Line Height:
- Auto-calculated based on font size if not provided
- Body text (≤20px): 1.5x font size
- Headings (>20px): 1.2x font size

Example:
{
  content: "Hello World",
  fontSize: 24,
  fontWeight: 600,
  fontFamily: "Inter",
  parentId: "frame-id-123"  // ← Always specify parent!
}

CSS equivalent:
font-family: Inter;
font-size: 24px;
font-weight: semibold (600);
line-height: 29px; // auto-calculated`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      content: {
        type: 'string' as const,
        description: 'Text content to display'
      },
      fontSize: {
        type: 'number' as const,
        description: `Font size in pixels. Must be one of: ${VALID_FONT_SIZES.join(', ')}`
      },
      fontFamily: {
        type: 'string' as const,
        description: 'Font family name (default: Inter)'
      },
      fontWeight: {
        type: 'number' as const,
        description: 'Font weight: 100 (thin) to 900 (black) in steps of 100'
      },
      lineHeight: {
        type: 'number' as const,
        description: 'Line height in pixels (auto-calculated if not provided)'
      },
      textAlign: {
        type: 'string' as const,
        enum: ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'],
        description: 'Text alignment (default: LEFT)'
      },
      color: {
        type: 'string' as const,
        description: 'Text color in hex format (e.g., #000000)'
      },
      letterSpacing: {
        type: 'number' as const,
        description: 'Letter spacing in pixels'
      },
      parentId: {
        type: 'string' as const,
        description: '⚠️ RECOMMENDED: Parent frame ID to place text inside. Without this, text will be at canvas root.'
      }
    },
    required: ['content']
  }
};

/**
 * Handler export for tool registration
 */
export const createTextHandler: import('../routing/tool-handler.js').ToolHandler<
  CreateTextInput,
  CreateTextResult
> = {
  name: 'create_text',
  schema: createTextInputSchema as any,
  execute: createText,
  formatResponse: (result) => {
    let text = `Text Created Successfully\n`;
    text += `Text ID: ${result.textId}\n`;
    text += `Applied Line Height: ${result.appliedLineHeight}px\n\n`;
    text += `CSS Equivalent:\n  ${result.cssEquivalent}\n`;

    return [{ type: 'text', text }];
  },
  definition: createTextToolDefinition
};
