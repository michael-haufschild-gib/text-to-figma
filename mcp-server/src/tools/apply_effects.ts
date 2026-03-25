/**
 * Apply Effects Tool
 *
 * Applies visual effects to Figma nodes including shadows and blur effects.
 * Effects in Figma are similar to CSS box-shadow, text-shadow, and filter properties.
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Effect type enumeration
 */
export const effectTypeSchema = z.enum([
  'DROP_SHADOW',
  'INNER_SHADOW',
  'LAYER_BLUR',
  'BACKGROUND_BLUR'
]);

export type EffectType = z.infer<typeof effectTypeSchema>;

/**
 * Shadow effect parameters
 */
const shadowEffectSchema = z.object({
  type: z.enum(['DROP_SHADOW', 'INNER_SHADOW']),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .describe('Shadow color in hex format'),
  opacity: z.number().min(0).max(1).default(0.25).describe('Shadow opacity (0-1)'),
  x: z.number().describe('Horizontal offset in pixels'),
  y: z.number().describe('Vertical offset in pixels'),
  blur: z.number().min(0).describe('Blur radius in pixels'),
  spread: z.number().default(0).describe('Spread radius in pixels (drop shadow only)')
});

/**
 * Blur effect parameters
 */
const blurEffectSchema = z.object({
  type: z.enum(['LAYER_BLUR', 'BACKGROUND_BLUR']),
  radius: z.number().min(0).describe('Blur radius in pixels')
});

/**
 * Union type for all effect types
 */
const effectSchema = z.discriminatedUnion('type', [shadowEffectSchema, blurEffectSchema]);

export type Effect = z.infer<typeof effectSchema>;

/**
 * Input schema for apply_effects tool
 */
export const ApplyEffectsInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node to apply effects to'),
  effects: z.array(effectSchema).min(1).describe('Array of effects to apply')
});

export type ApplyEffectsInput = z.infer<typeof ApplyEffectsInputSchema>;

/**
 * Result of applying effects
 */
export interface ApplyEffectsResult {
  nodeId: string;
  effectsApplied: number;
  cssEquivalent: string;
  message: string;
}

/**
 * Generates CSS equivalent for effects
 * @param effects
 */
function generateCssEquivalent(effects: Effect[]): string {
  const cssLines: string[] = [];

  // Group shadows and blurs
  const dropShadows: string[] = [];
  const innerShadows: string[] = [];
  let layerBlur: string | null = null;
  let backgroundBlur: string | null = null;

  for (const effect of effects) {
    switch (effect.type) {
      case 'DROP_SHADOW': {
        const rgba = hexToRgba(effect.color, effect.opacity);
        const shadow = `${effect.x}px ${effect.y}px ${effect.blur}px ${effect.spread}px ${rgba}`;
        dropShadows.push(shadow);
        break;
      }
      case 'INNER_SHADOW': {
        const rgba = hexToRgba(effect.color, effect.opacity);
        innerShadows.push(
          `inset ${effect.x}px ${effect.y}px ${effect.blur}px ${effect.spread}px ${rgba}`
        );
        break;
      }
      case 'LAYER_BLUR':
        layerBlur = `blur(${effect.radius}px)`;
        break;
      case 'BACKGROUND_BLUR':
        backgroundBlur = `blur(${String(effect.radius)}px)`;
        break;
    }
  }

  // Combine shadows
  const allShadows = [...dropShadows, ...innerShadows];
  if (allShadows.length > 0) {
    cssLines.push(`box-shadow: ${allShadows.join(', ')};`);
  }

  // Layer blur
  if (layerBlur !== null) {
    cssLines.push(`filter: ${layerBlur};`);
  }

  // Background blur (requires backdrop-filter)
  if (backgroundBlur !== null) {
    cssLines.push(`backdrop-filter: ${backgroundBlur};`);
    cssLines.push('/* Note: backdrop-filter requires a semi-transparent background */');
  }

  return cssLines.join('\n  ');
}

/**
 * Converts hex color to rgba string
 * @param hex
 * @param opacity
 */
function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Applies effects to a node in Figma
 * @param input
 */
export async function applyEffects(input: ApplyEffectsInput): Promise<ApplyEffectsResult> {
  // Generate CSS equivalent
  const cssEquivalent = generateCssEquivalent(input.effects);

  // Send to Figma
  const bridge = getFigmaBridge();
  await bridge.sendToFigmaWithRetry('apply_effects', {
    nodeId: input.nodeId,
    effects: input.effects
  });

  return {
    nodeId: input.nodeId,
    effectsApplied: input.effects.length,
    cssEquivalent,
    message: `Applied ${input.effects.length} effect(s) to node`
  };
}

/**
 * Tool definition for MCP
 */
export const applyEffectsToolDefinition = {
  name: 'apply_effects',
  description: `Applies visual effects to Figma nodes including shadows and blur effects.

Effect Types:

1. DROP_SHADOW (CSS: box-shadow)
   - Creates an outer shadow below the element
   - Parameters: color, opacity, x, y, blur, spread
   - Example: Drop shadow 2px down, 4px blur, black at 25% opacity
     { type: "DROP_SHADOW", color: "#000000", opacity: 0.25, x: 0, y: 2, blur: 4, spread: 0 }

2. INNER_SHADOW (CSS: box-shadow inset)
   - Creates an inner shadow inside the element
   - Parameters: color, opacity, x, y, blur, spread
   - Example: Inner shadow for depth
     { type: "INNER_SHADOW", color: "#000000", opacity: 0.1, x: 0, y: 1, blur: 2, spread: 0 }

3. LAYER_BLUR (CSS: filter: blur)
   - Blurs the entire element and its contents
   - Parameters: radius
   - Example: Blur effect 4px
     { type: "LAYER_BLUR", radius: 4 }

4. BACKGROUND_BLUR (CSS: backdrop-filter: blur)
   - Blurs content behind the element (frosted glass effect)
   - Parameters: radius
   - Requires semi-transparent background
   - Example: Frosted glass effect
     { type: "BACKGROUND_BLUR", radius: 10 }

Shadow Parameters:
- color: Hex color (e.g., "#000000" for black)
- opacity: 0-1 (0 = invisible, 1 = fully opaque)
- x: Horizontal offset in pixels (positive = right, negative = left)
- y: Vertical offset in pixels (positive = down, negative = up)
- blur: Blur radius in pixels (0 = hard edge, higher = softer)
- spread: Expands shadow in all directions (drop shadow only)

Common Shadow Presets:
- Subtle: { x: 0, y: 1, blur: 2, spread: 0, opacity: 0.1 }
- Medium: { x: 0, y: 2, blur: 8, spread: 0, opacity: 0.15 }
- Large: { x: 0, y: 4, blur: 16, spread: 0, opacity: 0.2 }
- Extra Large: { x: 0, y: 8, blur: 32, spread: 0, opacity: 0.25 }

You can apply multiple effects to a single node (they stack).`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node to apply effects to'
      },
      effects: {
        type: 'array' as const,
        description: 'Array of effects to apply (can combine multiple effects)',
        items: {
          type: 'object' as const,
          properties: {
            type: {
              type: 'string' as const,
              enum: ['DROP_SHADOW', 'INNER_SHADOW', 'LAYER_BLUR', 'BACKGROUND_BLUR'],
              description: 'Type of effect to apply'
            },
            color: {
              type: 'string' as const,
              description: 'Shadow color in hex format (shadow effects only)'
            },
            opacity: {
              type: 'number' as const,
              description: 'Shadow opacity from 0-1 (shadow effects only)'
            },
            x: {
              type: 'number' as const,
              description: 'Horizontal offset in pixels (shadow effects only)'
            },
            y: {
              type: 'number' as const,
              description: 'Vertical offset in pixels (shadow effects only)'
            },
            blur: {
              type: 'number' as const,
              description: 'Blur radius in pixels (shadow effects only)'
            },
            spread: {
              type: 'number' as const,
              description: 'Spread radius in pixels (drop shadow only)'
            },
            radius: {
              type: 'number' as const,
              description: 'Blur radius in pixels (blur effects only)'
            }
          },
          required: ['type']
        }
      }
    },
    required: ['nodeId', 'effects']
  }
};
