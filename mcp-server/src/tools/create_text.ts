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
  VALID_FONT_SIZES
} from '../constraints/typography.js';
import { getFigmaBridge } from '../figma-bridge.js';
import { getLogger } from '../monitoring/logger.js';
import { getNodeRegistry } from '../node-registry.js';
import {
  formatValidationError,
  validateParentRelationship,
  getHierarchyPatternExamples
} from '../utils/parent-validator.js';

const logger = getLogger().child({ tool: 'create_text' });

/**
 * Supported text alignment values
 */
export const textAlignSchema = z.enum(['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED']);
export type TextAlign = z.infer<typeof textAlignSchema>;

/**
 * Input schema for create_text tool
 */
export const CreateTextInputSchema = z.object({
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

export type CreateTextInput = z.infer<typeof CreateTextInputSchema>;

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
 * @param input
 * @param appliedLineHeight
 */
function generateCssEquivalent(input: CreateTextInput, appliedLineHeight: number): string {
  const fontWeightName =
    Object.entries(FONT_WEIGHTS).find(([_, val]) => val === input.fontWeight)?.[0] ?? 'normal';

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

  if (input.letterSpacing !== undefined) {
    css += `\n  letter-spacing: ${input.letterSpacing}px;`;
  }

  return css;
}

/**
 * Creates a text node in Figma
 * @param input
 */
export async function createText(input: CreateTextInput): Promise<CreateTextResult> {
  // Validate parent relationship - STRICT MODE to enforce hierarchy
  const parentValidation = await validateParentRelationship('text', input.parentId, {
    strict: true, // STRICT: Prevent creation without parent to maintain HTML-like hierarchy
    checkExists: true // Check if parent actually exists
  });

  // Throw error if parent validation failed
  if (!parentValidation.isValid) {
    const errorMessage = formatValidationError(parentValidation);
    const patternExamples = getHierarchyPatternExamples('text');
    const fullError = `${errorMessage}\n\n${patternExamples}`;

    logger.error(
      'Parent validation failed - text must have a parent container',
      new Error(errorMessage),
      {
        input: input
      }
    );
    throw new Error(fullError);
  }

  // Calculate line height if not provided
  const appliedLineHeight = input.lineHeight ?? getRecommendedLineHeight(input.fontSize);

  // Generate CSS equivalent
  const cssEquivalent = generateCssEquivalent(input, appliedLineHeight);

  // Send to Figma with response validation
  const bridge = getFigmaBridge();
  const response = await bridge.sendToFigmaValidated(
    'create_text',
    {
      content: input.content,
      fontSize: input.fontSize,
      fontFamily: input.fontFamily,
      fontWeight: input.fontWeight,
      lineHeight: appliedLineHeight,
      textAlign: input.textAlign,
      color: input.color,
      letterSpacing: input.letterSpacing,
      parentId: input.parentId
    },
    z.object({ nodeId: z.string().min(1) })
  );

  // Register node in hierarchy registry
  const registry = getNodeRegistry();
  registry.register(response.nodeId, {
    type: 'TEXT',
    name: input.content.substring(0, 50), // Use first 50 chars as name
    parentId: input.parentId ?? null,
    children: [],
    bounds: { x: 0, y: 0, width: 0, height: 0 } // Will be updated on next hierarchy refresh
  });

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

RECOMMENDED WORKFLOW:
1. Use get_page_hierarchy to see current structure
2. Option A (Multi-element): Use create_design to create text + container together
3. Option B (Single text node):
   - First: Create or identify parent frame
   - Then: Create text with parentId

WHEN TO USE THIS TOOL:
- Adding a single text element to an existing frame
- Building UI step-by-step (for simple designs)

For designs with text + other elements, prefer create_design instead.

MANDATORY REQUIREMENT: parentId is REQUIRED
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
        description:
          'REQUIRED: Parent frame ID to place text inside. Text nodes CANNOT exist at canvas root - you must create a frame first, then place text inside it with parentId.'
      }
    },
    required: ['content', 'parentId']
  }
};
