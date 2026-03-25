/**
 * Set Fills Tool - HTML Analogy: background-color and color properties
 *
 * Sets fill colors on frames and text nodes in Figma.
 * Similar to setting CSS background-color or color properties.
 */

import { z } from 'zod';
import { hexToRgb, rgbToHex, rgbSchema, type RGB } from '../constraints/color.js';
import { FigmaAckResponseSchema, getFigmaBridge } from '../figma-bridge.js';
import { defineHandler, textResponse } from '../routing/handler-utils.js';

/**
 * Hex color schema with validation
 */
const hexColorSchema = z
  .string()
  .regex(/^#?[0-9A-Fa-f]{6}$/, {
    message: 'Color must be in hex format (e.g., #FF0000 or FF0000)'
  })
  .transform((val) => (val.startsWith('#') ? val : `#${val}`));

/**
 * Input schema for set_fills tool
 */
export const SetFillsInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node to set fills on'),
  color: z
    .union([hexColorSchema, rgbSchema])
    .describe('Color in hex format (#FF0000) or RGB object'),
  opacity: z.number().min(0).max(1).default(1).describe('Fill opacity (0-1)')
});

export type SetFillsInput = z.infer<typeof SetFillsInputSchema>;

/**
 * Result of setting fills
 */
export interface SetFillsResult {
  nodeId: string;
  appliedColor: string;
  cssEquivalent: string;
}

/**
 * Normalizes color input to RGB and hex
 * @param color
 */
function normalizeColor(color: string | RGB): { rgb: RGB; hex: string } {
  if (typeof color === 'string') {
    const rgb = hexToRgb(color);
    if (!rgb) {
      throw new Error(`Invalid hex color: ${color}`);
    }
    return { rgb, hex: color };
  } else {
    const hex = rgbToHex(color);
    return { rgb: color, hex };
  }
}

/**
 * Generates CSS equivalent for the fill
 * @param hex
 * @param opacity
 * @param isText
 */
function generateCssEquivalent(hex: string, opacity: number, isText: boolean): string {
  const property = isText ? 'color' : 'background-color';

  if (opacity < 1) {
    return `${property}: ${hex};\n  opacity: ${opacity};`;
  }

  return `${property}: ${hex};`;
}

/**
 * Sets fill color on a node in Figma with comprehensive error handling
 *
 * Applies solid color fills to frames or text nodes. Similar to setting
 * background-color or color in CSS. Supports both hex strings and RGB objects.
 *
 * @param input - Fill configuration parameters
 * @param input.nodeId - ID of the node (frame or text) to set fills on
 * @param input.color - Color in hex format (#FF0000) or RGB object {r, g, b}
 * @param input.opacity - Fill opacity from 0 (transparent) to 1 (opaque), defaults to 1
 * @param isText - Internal flag indicating text node vs frame (affects CSS generation)
 * @returns Promise resolving to fill result with applied color and CSS equivalent
 * @throws {ValidationError} When input validation fails (invalid hex, out of range values)
 * @throws {NetworkError} When communication with Figma bridge fails
 *
 * @example
 * Set frame background to solid blue:
 * ```typescript
 * const result = await setFills({
 *   nodeId: 'frame-123',
 *   color: '#0066FF',
 *   opacity: 1
 * });
 * console.log(result.cssEquivalent); // "background-color: #0066FF;"
 * ```
 *
 * @example
 * Set text color with transparency:
 * ```typescript
 * const result = await setFills({
 *   nodeId: 'text-456',
 *   color: { r: 255, g: 0, b: 0 },
 *   opacity: 0.8
 * }, true);
 * console.log(result.cssEquivalent); // "color: #ff0000;\n  opacity: 0.8;"
 * ```
 *
 * @remarks
 * Always validate color contrast for text using validate_contrast tool
 * to ensure WCAG AA/AAA accessibility compliance.
 */
export async function setFills(input: SetFillsInput, isText = false): Promise<SetFillsResult> {
  // Normalize color to RGB and hex
  const { rgb, hex } = normalizeColor(input.color);

  // Generate CSS equivalent
  const cssEquivalent = generateCssEquivalent(hex, input.opacity, isText);

  // Send to Figma
  const bridge = getFigmaBridge();
  await bridge.sendToFigmaValidated(
    'set_fills',
    {
      nodeId: input.nodeId,
      fills: [
        {
          type: 'SOLID',
          color: {
            r: rgb.r / 255,
            g: rgb.g / 255,
            b: rgb.b / 255
          },
          opacity: input.opacity
        }
      ]
    },
    FigmaAckResponseSchema
  );

  return {
    nodeId: input.nodeId,
    appliedColor: hex,
    cssEquivalent
  };
}

/**
 * Tool definition for MCP
 */
export const setFillsToolDefinition = {
  name: 'set_fills',
  description: `Sets fill colors on frames or text nodes in Figma.

WHEN TO USE THIS TOOL:
- Updating color on an EXISTING node
- Changing background color of an existing frame
- Changing text color of existing text
- Styling nodes created by individual create_* tools

DON'T use this for:
- New designs with multiple elements (use create_design with color props instead)
- Initial color during node creation (set color in create_* tool directly)

ALTERNATIVE: Use create_design to set all properties at once:
{
  type: 'frame',
  props: { fillColor: '#0066FF', ... },
  children: [...]
}

HTML/CSS Analogy:
- For frames: Similar to setting 'background-color' on a div
- For text: Similar to setting 'color' on text content

Color Input Formats:
1. Hex string: "#FF0000" or "FF0000"
2. RGB object: { r: 255, g: 0, b: 0 }

Opacity:
- 0 = fully transparent
- 1 = fully opaque (default)
- Similar to CSS 'opacity' property

Examples:

Set frame background to blue:
{
  nodeId: "frame-id",
  color: "#0066FF",
  opacity: 1
}
CSS equivalent: background-color: #0066FF;

Set text color to red with transparency:
{
  nodeId: "text-id",
  color: "#FF0000",
  opacity: 0.8
}
CSS equivalent: color: #FF0000; opacity: 0.8;

IMPORTANT: Always validate color contrast for text using the validate_contrast tool
to ensure accessibility compliance (WCAG AA/AAA).`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node (frame or text) to set fills on'
      },
      color: {
        oneOf: [
          {
            type: 'string' as const,
            description: 'Hex color format (e.g., #FF0000)',
            pattern: '^#?[0-9A-Fa-f]{6}$'
          },
          {
            type: 'object' as const,
            properties: {
              r: { type: 'number' as const, minimum: 0, maximum: 255 },
              g: { type: 'number' as const, minimum: 0, maximum: 255 },
              b: { type: 'number' as const, minimum: 0, maximum: 255 }
            },
            required: ['r', 'g', 'b'],
            description: 'RGB color object'
          }
        ],
        description: 'Color in hex format or RGB object'
      },
      opacity: {
        type: 'number' as const,
        minimum: 0,
        maximum: 1,
        description: 'Fill opacity from 0 (transparent) to 1 (opaque)'
      }
    },
    required: ['nodeId', 'color']
  }
};

export const handler = defineHandler<SetFillsInput, SetFillsResult>({
  name: 'set_fills',
  schema: SetFillsInputSchema,
  execute: setFills,
  formatResponse: (r) =>
    textResponse(
      `Fills Applied Successfully\nNode ID: ${r.nodeId}\nApplied Color: ${r.appliedColor}\n\nCSS Equivalent:\n  ${r.cssEquivalent}\n`
    ),
  definition: setFillsToolDefinition
});
