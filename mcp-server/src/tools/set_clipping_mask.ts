/**
 * MCP Tool: set_clipping_mask
 *
 * Sets a node as a clipping mask or enables/disables clipping on a frame.
 *
 * PRIMITIVE: Raw Figma clipping primitive.
 * In Figma: frame.clipsContent = true | node as mask
 * Use for: image cropping, circular avatars, complex masks
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetClippingMaskInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the frame or node'),
  enabled: z.boolean().describe('Enable or disable clipping'),
  useMask: z.boolean().optional().default(false).describe('Use first child as mask (vector masking)')
});

export type SetClippingMaskInput = z.infer<typeof SetClippingMaskInputSchema>;

/**
 * Tool definition
 */
export const setClippingMaskToolDefinition = {
  name: 'set_clipping_mask',
  description: `Sets a node as a clipping mask or enables/disables clipping on a frame.

PRIMITIVE: Raw Figma clipping primitive - not a pre-made component.
Use for: image cropping, circular avatars, shape masks, complex cutouts.

Two Modes:
1. Frame Clipping (clipsContent): Crops children to frame bounds
   - Simple rectangular clipping
   - Use for: cards, image containers
2. Vector Masking (useMask): Uses first child as mask shape
   - Complex shape clipping
   - Use for: circular avatars, custom shapes

Example - Clip to Frame Bounds:
set_clipping_mask({
  nodeId: "image-frame-123",
  enabled: true,
  useMask: false
})

Example - Circular Avatar (Vector Mask):
set_clipping_mask({
  nodeId: "avatar-container-456",
  enabled: true,
  useMask: true
})
// Note: First child should be circle shape, second child is image

Example - Disable Clipping:
set_clipping_mask({
  nodeId: "frame-789",
  enabled: false
})

CSS Equivalent:
/* Frame clipping */
overflow: hidden;

/* Vector masking */
mask-image: url(#mask-shape);
clip-path: circle(50%);`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the frame or node'
      },
      enabled: {
        type: 'boolean' as const,
        description: 'Enable or disable clipping'
      },
      useMask: {
        type: 'boolean' as const,
        description: 'Use first child as mask (vector masking)',
        default: false
      }
    },
    required: ['nodeId', 'enabled']
  }
};

/**
 * Result type
 */
export interface SetClippingMaskResult {
  nodeId: string;
  enabled: boolean;
  useMask: boolean;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 */
export async function setClippingMask(
  input: SetClippingMaskInput
): Promise<SetClippingMaskResult> {
  // Validate input
  const validated = SetClippingMaskInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  if (!bridge.isConnected()) {
    throw new Error('Not connected to Figma. Ensure the plugin is running.');
  }

  // Send command to Figma
  const response = await bridge.sendToFigma<{ success: boolean; error?: string }>('set_clipping_mask', {
    nodeId: validated.nodeId,
    enabled: validated.enabled,
    useMask: validated.useMask
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to set clipping mask');
  }

  // Build CSS equivalent
  let cssEquivalent: string;
  if (!validated.enabled) {
    cssEquivalent = 'overflow: visible;';
  } else if (validated.useMask) {
    cssEquivalent = `/* Vector masking */\nmask-image: url(#mask-shape);\n/* OR */\nclip-path: circle(50%); /* for circular masks */`;
  } else {
    cssEquivalent = 'overflow: hidden;';
  }

  const modeLabel = validated.useMask ? 'vector mask' : 'frame clipping';

  return {
    nodeId: validated.nodeId,
    enabled: validated.enabled,
    useMask: validated.useMask,
    cssEquivalent,
    message: `${validated.enabled ? 'Enabled' : 'Disabled'} ${modeLabel} on node`
  };
}
