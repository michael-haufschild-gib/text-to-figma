/**
 * MCP Tool: create_color_style
 *
 * Creates a reusable color style in the Figma file.
 *
 * PRIMITIVE: Raw Figma color style primitive.
 * In Figma: figma.createPaintStyle()
 * Use for: design systems, consistent color palettes, brand colors
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { defineHandler, textResponse } from '../routing/handler-utils.js';

/**
 * Input schema
 */
export const CreateColorStyleInputSchema = z.object({
  name: z.string().min(1).describe('Name for the color style'),
  color: z.string().describe('Color in hex format (e.g., #0066FF)'),
  description: z.string().optional().describe('Optional description of the color style')
});

export type CreateColorStyleInput = z.infer<typeof CreateColorStyleInputSchema>;

/**
 * Tool definition
 */
export const createColorStyleToolDefinition = {
  name: 'create_color_style',
  description: `Creates a reusable color style in the Figma file.

PRIMITIVE: Raw Figma paint style primitive - not a pre-made component.
Use for: design systems, consistent color palettes, brand colors, style guides.

Benefits:
- Single source of truth for colors
- Easy global updates (change once, update everywhere)
- Design system consistency
- Shared across team via libraries

Naming Conventions:
- Brand colors: "Primary", "Secondary", "Accent"
- Semantic colors: "Success", "Warning", "Error", "Info"
- Neutrals: "Gray/100", "Gray/200", etc.
- Text colors: "Text/Primary", "Text/Secondary"

Example - Primary Brand Color:
create_color_style({
  name: "Primary",
  color: "#0066FF",
  description: "Primary brand color for buttons and links"
})

Example - Semantic Color:
create_color_style({
  name: "Error",
  color: "#CC0000",
  description: "Error state and destructive actions"
})

Example - Neutral Scale:
create_color_style({
  name: "Gray/500",
  color: "#6B7280",
  description: "Mid-gray for secondary text"
})

After creating styles, use apply_fill_style to apply them to nodes.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string' as const,
        description: 'Name for the color style'
      },
      color: {
        type: 'string' as const,
        description: 'Color in hex format (e.g., #0066FF)'
      },
      description: {
        type: 'string' as const,
        description: 'Optional description of the color style'
      }
    },
    required: ['name', 'color']
  }
};

/**
 * Response schema for Figma bridge create_color_style response
 */
const CreateColorStyleResponseSchema = z
  .object({
    styleId: z.string()
  })
  .passthrough();

/**
 * Result type
 */
export interface CreateColorStyleResult {
  styleId: string;
  name: string;
  color: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function createColorStyle(
  input: CreateColorStyleInput
): Promise<CreateColorStyleResult> {
  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  const response = await bridge.sendToFigmaValidated(
    'create_color_style',
    {
      name: input.name,
      color: input.color,
      description: input.description
    },
    CreateColorStyleResponseSchema
  );

  return {
    styleId: response.styleId,
    name: input.name,
    color: input.color,
    message: `Created color style "${input.name}" (${input.color})`
  };
}

export const handler = defineHandler<CreateColorStyleInput, CreateColorStyleResult>({
  name: 'create_color_style',
  schema: CreateColorStyleInputSchema,
  execute: createColorStyle,
  formatResponse: (r) =>
    textResponse(`${r.message}\nStyle ID: ${r.styleId}\nName: ${r.name}\nColor: ${r.color}\n`),
  definition: createColorStyleToolDefinition
});
