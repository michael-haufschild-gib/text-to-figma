/**
 * MCP Tool: create_effect_style
 *
 * Creates a reusable effect style (shadows, blur) in the Figma file.
 *
 * PRIMITIVE: Raw Figma effect style primitive.
 * In Figma: figma.createEffectStyle()
 * Use for: consistent shadows, elevation systems, blur effects
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { defineHandler, textResponse } from '../routing/handler-utils.js';

/**
 * Effect schema — accepts both apply_effects field names (x/y, radius)
 * and legacy aliases (offsetX/offsetY, blur) for backwards compatibility.
 * The Figma plugin helper convertEffects() handles both forms.
 */
const EffectSchema = z
  .object({
    type: z.enum(['DROP_SHADOW', 'INNER_SHADOW', 'LAYER_BLUR', 'BACKGROUND_BLUR']),
    x: z.number().optional().describe('Horizontal offset (shadow only)'),
    y: z.number().optional().describe('Vertical offset (shadow only)'),
    offsetX: z.number().optional().describe('Alias for x (backwards compat)'),
    offsetY: z.number().optional().describe('Alias for y (backwards compat)'),
    radius: z.number().min(0).optional().describe('Blur radius (blur effects)'),
    blur: z.number().min(0).optional().describe('Blur radius for shadows, or alias for radius'),
    spread: z.number().optional(),
    color: z.string().optional(),
    opacity: z.number().min(0).max(1).optional()
  })
  .refine((e) => e.blur !== undefined || e.radius !== undefined, {
    message: 'Either blur or radius must be provided'
  });

/**
 * Input schema
 */
export const CreateEffectStyleInputSchema = z.object({
  name: z.string().min(1).describe('Name for the effect style'),
  effects: z.array(EffectSchema).min(1).describe('Array of effects (shadows, blur)'),
  description: z.string().optional().describe('Optional description of the effect style')
});

export type CreateEffectStyleInput = z.infer<typeof CreateEffectStyleInputSchema>;

/**
 * Tool definition
 */
export const createEffectStyleToolDefinition = {
  name: 'create_effect_style',
  description: `Creates a reusable effect style (shadows, blur) in the Figma file.

PRIMITIVE: Raw Figma effect style primitive - not a pre-made component.
Use for: elevation systems, consistent shadows, blur effects, design systems.

Benefits:
- Single source of truth for effects
- Easy global updates (change once, update everywhere)
- Consistent elevation/depth
- Shared styles across team

Naming Conventions:
- Elevation: "Elevation/1", "Elevation/2", "Elevation/3"
- Shadows: "Shadow/Small", "Shadow/Medium", "Shadow/Large"
- Blur: "Blur/Light", "Blur/Heavy"
- Glow: "Glow/Subtle", "Glow/Strong"

Shadow parameters (same as apply_effects):
- x (or offsetX): Horizontal offset in pixels
- y (or offsetY): Vertical offset in pixels
- blur (or radius): Blur radius in pixels
- spread: Spread radius in pixels (drop shadow only)
- color: Hex color (e.g., "#000000")
- opacity: 0-1

Blur parameters:
- radius (or blur): Blur radius in pixels

Example - Card Elevation:
create_effect_style({
  name: "Elevation/2",
  effects: [{
    type: "DROP_SHADOW",
    x: 0,
    y: 4,
    blur: 16,
    spread: 0,
    color: "#000000",
    opacity: 0.08
  }],
  description: "Card elevation shadow"
})

Example - Glassmorphism Blur:
create_effect_style({
  name: "Blur/Glass",
  effects: [{
    type: "BACKGROUND_BLUR",
    radius: 20
  }],
  description: "Glassmorphism backdrop blur"
})

After creating styles, use apply_effect_style to apply them to nodes.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string' as const,
        description: 'Name for the effect style'
      },
      effects: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            type: {
              type: 'string' as const,
              enum: ['DROP_SHADOW', 'INNER_SHADOW', 'LAYER_BLUR', 'BACKGROUND_BLUR']
            },
            x: {
              type: 'number' as const,
              description: 'Horizontal offset in pixels (shadow only)'
            },
            y: {
              type: 'number' as const,
              description: 'Vertical offset in pixels (shadow only)'
            },
            offsetX: {
              type: 'number' as const,
              description: 'Alias for x (backwards compatible)'
            },
            offsetY: {
              type: 'number' as const,
              description: 'Alias for y (backwards compatible)'
            },
            blur: {
              type: 'number' as const,
              description: 'Blur radius in pixels (shadow effects)'
            },
            radius: {
              type: 'number' as const,
              description: 'Blur radius in pixels (blur effects, or alias for blur)'
            },
            spread: { type: 'number' as const, description: 'Spread radius (drop shadow only)' },
            color: { type: 'string' as const, description: 'Shadow color in hex format' },
            opacity: { type: 'number' as const, description: 'Shadow opacity (0-1)' }
          },
          required: ['type']
        },
        description: 'Array of effects'
      },
      description: {
        type: 'string' as const,
        description: 'Optional description of the effect style'
      }
    },
    required: ['name', 'effects']
  }
};

/**
 * Response schema for Figma bridge create_effect_style response
 */
const CreateEffectStyleResponseSchema = z
  .object({
    styleId: z.string()
  })
  .passthrough();

/**
 * Result type
 */
export interface CreateEffectStyleResult {
  styleId: string;
  name: string;
  effectCount: number;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function createEffectStyle(
  input: CreateEffectStyleInput
): Promise<CreateEffectStyleResult> {
  // Normalize aliases: x→offsetX, y→offsetY, radius→blur
  // so the Figma plugin receives a consistent payload.
  const normalizedEffects = input.effects.map((e) => ({
    type: e.type,
    x: e.x ?? e.offsetX,
    y: e.y ?? e.offsetY,
    blur: e.blur ?? e.radius,
    radius: e.radius ?? e.blur,
    spread: e.spread,
    color: e.color,
    opacity: e.opacity
  }));

  const bridge = getFigmaBridge();

  const response = await bridge.sendToFigmaValidated(
    'create_effect_style',
    {
      name: input.name,
      effects: normalizedEffects,
      description: input.description
    },
    CreateEffectStyleResponseSchema
  );

  return {
    styleId: response.styleId,
    name: input.name,
    effectCount: input.effects.length,
    message: `Created effect style "${input.name}" with ${input.effects.length} effect(s)`
  };
}

export const handler = defineHandler<CreateEffectStyleInput, CreateEffectStyleResult>({
  name: 'create_effect_style',
  schema: CreateEffectStyleInputSchema,
  execute: createEffectStyle,
  formatResponse: (r) =>
    textResponse(
      `${r.message}\nStyle ID: ${r.styleId}\nName: ${r.name}\nEffects: ${r.effectCount}\n`
    ),
  definition: createEffectStyleToolDefinition
});
