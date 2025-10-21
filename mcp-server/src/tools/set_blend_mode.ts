/**
 * MCP Tool: set_blend_mode
 *
 * Sets blend mode for visual compositing effects.
 *
 * PRIMITIVE: Raw Figma blend mode primitive.
 * In Figma: node.blendMode = 'NORMAL' | 'MULTIPLY' | 'SCREEN' | ...
 * Use for: overlays, lighting effects, color adjustments
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetBlendModeInputSchema = z.object({
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
    .describe('Blend mode for compositing')
});

export type SetBlendModeInput = z.infer<typeof SetBlendModeInputSchema>;

/**
 * Tool definition
 */
export const setBlendModeToolDefinition = {
  name: 'set_blend_mode',
  description: `Sets blend mode for visual compositing effects.

PRIMITIVE: Raw Figma blend mode primitive - not a pre-made component.
Use for: overlays, lighting effects, color grading, creative compositing.

Common Blend Modes:
- NORMAL: No blending (default)
- MULTIPLY: Darkening effect (like ink overlays)
- SCREEN: Lightening effect (like projected light)
- OVERLAY: Contrast enhancement (combination of multiply/screen)
- SOFT_LIGHT: Subtle lighting effect (softer than overlay)
- HARD_LIGHT: Strong lighting effect (harsher than overlay)
- DARKEN: Keep darker pixels
- LIGHTEN: Keep lighter pixels
- COLOR_BURN: Intense darkening with color
- COLOR_DODGE: Intense lightening with color
- LINEAR_BURN: Linear darkening
- LINEAR_DODGE: Linear lightening (Add mode)
- DIFFERENCE: Invert colors based on brightness
- EXCLUSION: Lower contrast difference
- HUE: Replace hue only
- SATURATION: Replace saturation only
- COLOR: Replace hue and saturation
- LUMINOSITY: Replace brightness only

Example - Overlay Effect:
set_blend_mode({
  nodeId: "gradient-overlay-123",
  blendMode: "OVERLAY"
})

Example - Multiply Shadow:
set_blend_mode({
  nodeId: "shadow-456",
  blendMode: "MULTIPLY"
})

Example - Screen Highlight:
set_blend_mode({
  nodeId: "highlight-789",
  blendMode: "SCREEN"
})

CSS Equivalent:
mix-blend-mode: multiply;
mix-blend-mode: screen;
mix-blend-mode: overlay;`,
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
        description: 'Blend mode for compositing'
      }
    },
    required: ['nodeId', 'blendMode']
  }
};

/**
 * Result type
 */
export interface SetBlendModeResult {
  nodeId: string;
  blendMode: string;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 */
export async function setBlendMode(input: SetBlendModeInput): Promise<SetBlendModeResult> {
  // Validate input
  const validated = SetBlendModeInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  // Note: bridge.sendToFigma validates success at protocol level
  // It only resolves if Figma returns success=true, otherwise rejects
  await bridge.sendToFigma(
    'set_blend_mode',
    {
      nodeId: validated.nodeId,
      blendMode: validated.blendMode
    }
  )

  // Map Figma blend modes to CSS (most are 1:1, some need conversion)
  const cssBlendModeMap: Record<string, string> = {
    NORMAL: 'normal',
    DARKEN: 'darken',
    MULTIPLY: 'multiply',
    LINEAR_BURN: 'linear-burn',
    COLOR_BURN: 'color-burn',
    LIGHTEN: 'lighten',
    SCREEN: 'screen',
    LINEAR_DODGE: 'linear-dodge',
    COLOR_DODGE: 'color-dodge',
    OVERLAY: 'overlay',
    SOFT_LIGHT: 'soft-light',
    HARD_LIGHT: 'hard-light',
    DIFFERENCE: 'difference',
    EXCLUSION: 'exclusion',
    HUE: 'hue',
    SATURATION: 'saturation',
    COLOR: 'color',
    LUMINOSITY: 'luminosity'
  };

  const cssBlendMode =
    cssBlendModeMap[validated.blendMode] || validated.blendMode.toLowerCase().replace(/_/g, '-');
  const cssEquivalent = `mix-blend-mode: ${cssBlendMode};`;

  return {
    nodeId: validated.nodeId,
    blendMode: validated.blendMode,
    cssEquivalent,
    message: `Set blend mode to ${validated.blendMode}`
  };
}
