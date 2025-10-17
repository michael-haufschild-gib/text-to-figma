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

/**
 * Effect schema (simplified - matches apply_effects format)
 */
const EffectSchema = z.object({
  type: z.enum(['DROP_SHADOW', 'INNER_SHADOW', 'LAYER_BLUR', 'BACKGROUND_BLUR']),
  offsetX: z.number().optional(),
  offsetY: z.number().optional(),
  blur: z.number().min(0),
  spread: z.number().optional(),
  color: z.string().optional(),
  opacity: z.number().min(0).max(1).optional()
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

Example - Card Elevation:
create_effect_style({
  name: "Elevation/2",
  effects: [{
    type: "DROP_SHADOW",
    offsetX: 0,
    offsetY: 4,
    blur: 16,
    spread: 0,
    color: "#000000",
    opacity: 0.08
  }],
  description: "Card elevation shadow"
})

Example - Button Hover Shadow:
create_effect_style({
  name: "Shadow/Button Hover",
  effects: [{
    type: "DROP_SHADOW",
    offsetX: 0,
    offsetY: 8,
    blur: 24,
    spread: 0,
    color: "#000000",
    opacity: 0.12
  }],
  description: "Button hover state shadow"
})

Example - Glassmorphism Blur:
create_effect_style({
  name: "Blur/Glass",
  effects: [{
    type: "BACKGROUND_BLUR",
    blur: 20
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
            offsetX: { type: 'number' as const },
            offsetY: { type: 'number' as const },
            blur: { type: 'number' as const },
            spread: { type: 'number' as const },
            color: { type: 'string' as const },
            opacity: { type: 'number' as const }
          },
          required: ['type', 'blur']
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
 */
export async function createEffectStyle(
  input: CreateEffectStyleInput
): Promise<CreateEffectStyleResult> {
  // Validate input
  const validated = CreateEffectStyleInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  if (!bridge.isConnected()) {
    throw new Error('Not connected to Figma. Ensure the plugin is running.');
  }

  // Send command to Figma
  const response = await bridge.sendToFigma<{ success: boolean; styleId?: string; error?: string }>('create_effect_style', {
    name: validated.name,
    effects: validated.effects,
    description: validated.description
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to create effect style');
  }

  return {
    styleId: response.styleId || '',
    name: validated.name,
    effectCount: validated.effects.length,
    message: `Created effect style "${validated.name}" with ${validated.effects.length} effect(s)`
  };
}
