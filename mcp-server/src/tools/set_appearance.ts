/**
 * MCP Tool: set_appearance
 *
 * Consolidated appearance tool - sets blend mode, opacity, and clipping.
 * Replaces: set_blend_mode, set_opacity, set_clipping_mask
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema - all parameters optional
 */
export const SetAppearanceInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node'),
  blendMode: z
    .enum([
      'NORMAL',
      'DARKEN',
      'MULTIPLY',
      'LINEAR_BURN',
      'COLOR_BURN',
      'LIGHTEN',
      'SCREEN',
      'LINEAR_DODGE',
      'COLOR_DODGE',
      'OVERLAY',
      'SOFT_LIGHT',
      'HARD_LIGHT',
      'DIFFERENCE',
      'EXCLUSION',
      'HUE',
      'SATURATION',
      'COLOR',
      'LUMINOSITY'
    ])
    .optional()
    .describe('Blend mode for compositing'),
  opacity: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Node opacity (0 = transparent, 1 = opaque)'),
  clipping: z
    .object({
      enabled: z.boolean().describe('Enable or disable clipping'),
      useMask: z.boolean().default(false).describe('Use first child as vector mask')
    })
    .optional()
    .describe('Clipping mask settings')
});

export type SetAppearanceInput = z.infer<typeof SetAppearanceInputSchema>;

/**
 * Tool definition
 */
export const setAppearanceToolDefinition = {
  name: 'set_appearance',
  description: `Sets visual appearance properties (blend mode, opacity, clipping).

WHEN TO USE THIS TOOL:
- Styling an EXISTING node's appearance
- Adding transparency, blend effects, or masking
- Creating overlays, lighting effects, or visual compositing

DON'T use this for:
- Color changes (use set_fills)
- New node creation (use create_design)

CONSOLIDATED TOOL: Replaces set_blend_mode, set_opacity, set_clipping_mask

All parameters optional - only specify what you want to change:

Blend Mode (compositing):
Common modes:
- NORMAL: No blending (default)
- MULTIPLY: Darkening effect (like ink overlays)
- SCREEN: Lightening effect (like projected light)
- OVERLAY: Contrast enhancement
- SOFT_LIGHT: Subtle lighting effect
- HARD_LIGHT: Strong lighting effect
Full list: NORMAL, DARKEN, MULTIPLY, LINEAR_BURN, COLOR_BURN, LIGHTEN, SCREEN,
           LINEAR_DODGE, COLOR_DODGE, OVERLAY, SOFT_LIGHT, HARD_LIGHT,
           DIFFERENCE, EXCLUSION, HUE, SATURATION, COLOR, LUMINOSITY
- CSS: mix-blend-mode: multiply;

Opacity (transparency):
- 0.0 = Fully transparent (invisible)
- 0.5 = 50% transparent (semi-transparent)
- 1.0 = Fully opaque (default)
Common values: 0.1 (10%), 0.4 (disabled state), 0.8 (hover), 1.0 (normal)
- CSS: opacity: 0.5;

Clipping Mask:
Two modes:
1. Frame clipping (clipsContent): Crops children to frame bounds
   - Simple rectangular clipping
   - Use for: cards, image containers
2. Vector masking (useMask): Uses first child as mask shape
   - Complex shape clipping
   - Use for: circular avatars, custom shapes
- CSS: overflow: hidden; or mask-image: url(#mask);

Examples:

Set opacity for disabled state:
{
  nodeId: "button-123",
  opacity: 0.4
}

Multiply blend for shadow overlay:
{
  nodeId: "shadow-overlay-456",
  blendMode: "MULTIPLY",
  opacity: 0.3
}

Clip image to frame bounds:
{
  nodeId: "image-container-789",
  clipping: { enabled: true, useMask: false }
}

Circular avatar with vector mask:
{
  nodeId: "avatar-container-012",
  clipping: { enabled: true, useMask: true }
}
// Note: First child should be circle shape, second child is image

Complete appearance styling:
{
  nodeId: "glass-panel-345",
  blendMode: "OVERLAY",
  opacity: 0.8,
  clipping: { enabled: true, useMask: false }
}`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node'
      },
      blendMode: {
        type: 'string' as const,
        enum: [
          'NORMAL',
          'DARKEN',
          'MULTIPLY',
          'LINEAR_BURN',
          'COLOR_BURN',
          'LIGHTEN',
          'SCREEN',
          'LINEAR_DODGE',
          'COLOR_DODGE',
          'OVERLAY',
          'SOFT_LIGHT',
          'HARD_LIGHT',
          'DIFFERENCE',
          'EXCLUSION',
          'HUE',
          'SATURATION',
          'COLOR',
          'LUMINOSITY'
        ],
        description: 'Blend mode for compositing (optional)'
      },
      opacity: {
        type: 'number' as const,
        description: 'Opacity from 0 (transparent) to 1 (opaque) (optional)'
      },
      clipping: {
        type: 'object' as const,
        properties: {
          enabled: { type: 'boolean' as const, description: 'Enable or disable clipping' },
          useMask: {
            type: 'boolean' as const,
            description: 'Use first child as vector mask (default: false)'
          }
        },
        description: 'Clipping mask settings (optional)'
      }
    },
    required: ['nodeId']
  }
};

/**
 * Result type
 */
export interface SetAppearanceResult {
  nodeId: string;
  applied: string[];
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function setAppearance(input: SetAppearanceInput): Promise<SetAppearanceResult> {
  // Track what properties were applied
  const applied: string[] = [];
  const cssLines: string[] = [];

  // Build command payload for Figma
  const payload: Record<string, unknown> = { nodeId: input.nodeId };

  if (input.blendMode !== undefined) {
    payload.blendMode = input.blendMode;
    applied.push('blendMode');
    cssLines.push(`mix-blend-mode: ${input.blendMode.toLowerCase().replace('_', '-')};`);
  }

  if (input.opacity !== undefined) {
    payload.opacity = input.opacity;
    applied.push('opacity');
    cssLines.push(`opacity: ${input.opacity};`);
  }

  if (input.clipping !== undefined) {
    payload.clipping = input.clipping;
    applied.push('clipping');
    if (input.clipping.useMask) {
      cssLines.push('mask-image: url(#mask-shape);');
    } else {
      cssLines.push('overflow: hidden;');
    }
  }

  if (applied.length === 0) {
    throw new Error(
      'No appearance properties specified. Provide at least one of: blendMode, opacity, clipping'
    );
  }

  // Send to Figma
  const bridge = getFigmaBridge();
  await bridge.sendToFigmaWithRetry('set_appearance', payload);

  return {
    nodeId: input.nodeId,
    applied,
    cssEquivalent: cssLines.join('\n'),
    message: `Applied appearance properties: ${applied.join(', ')}`
  };
}
