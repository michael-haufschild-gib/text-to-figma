/**
 * MCP Tool: set_scale
 *
 * Scales a node by X and Y factors.
 *
 * PRIMITIVE: Raw Figma scale transform primitive.
 * In Figma: node.resize(width * scaleX, height * scaleY)
 * Use for: proportional/non-proportional scaling, mirroring
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetScaleInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node'),
  scaleX: z.number().describe('Horizontal scale factor (1 = 100%, 0.5 = 50%, 2 = 200%)'),
  scaleY: z.number().describe('Vertical scale factor (1 = 100%, 0.5 = 50%, 2 = 200%)')
});

export type SetScaleInput = z.infer<typeof SetScaleInputSchema>;

/**
 * Tool definition
 */
export const setScaleToolDefinition = {
  name: 'set_scale',
  description: `Scales a node by X and Y factors.

PRIMITIVE: Raw Figma scale transform primitive - not a pre-made component.
Use for: proportional scaling, non-proportional scaling, mirroring.

Scale Factors:
- 1.0 = 100% (original size)
- 0.5 = 50% (half size)
- 2.0 = 200% (double size)
- -1.0 = Mirror (flip)

Example - Proportional Scale (Double Size):
set_scale({
  nodeId: "icon-123",
  scaleX: 2.0,
  scaleY: 2.0
})

Example - Non-Proportional Scale (Stretch):
set_scale({
  nodeId: "banner-456",
  scaleX: 1.5,
  scaleY: 1.0
})

Example - Horizontal Mirror:
set_scale({
  nodeId: "arrow-789",
  scaleX: -1.0,
  scaleY: 1.0
})

CSS Equivalent:
transform: scale(scaleX, scaleY);

Use Cases:
- Resize icons proportionally
- Create responsive variations
- Mirror/flip elements
- Stretch/compress shapes`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node'
      },
      scaleX: {
        type: 'number' as const,
        description: 'Horizontal scale factor'
      },
      scaleY: {
        type: 'number' as const,
        description: 'Vertical scale factor'
      }
    },
    required: ['nodeId', 'scaleX', 'scaleY']
  }
};

/**
 * Result type
 */
export interface SetScaleResult {
  nodeId: string;
  scaleX: number;
  scaleY: number;
  newWidth?: number;
  newHeight?: number;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 */
export async function setScale(
  input: SetScaleInput
): Promise<SetScaleResult> {
  // Validate input
  const validated = SetScaleInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  if (!bridge.isConnected()) {
    throw new Error('Not connected to Figma. Ensure the plugin is running.');
  }

  // Send command to Figma
  const response = await bridge.sendToFigma<{
    success: boolean;
    newWidth?: number;
    newHeight?: number;
    error?: string;
  }>('set_scale', {
    nodeId: validated.nodeId,
    scaleX: validated.scaleX,
    scaleY: validated.scaleY
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to scale node');
  }

  const cssEquivalent = `transform: scale(${validated.scaleX}, ${validated.scaleY});`;
  const scaleXPercent = Math.round(validated.scaleX * 100);
  const scaleYPercent = Math.round(validated.scaleY * 100);

  return {
    nodeId: validated.nodeId,
    scaleX: validated.scaleX,
    scaleY: validated.scaleY,
    newWidth: response.newWidth,
    newHeight: response.newHeight,
    cssEquivalent,
    message: `Node scaled to ${scaleXPercent}% × ${scaleYPercent}%`
  };
}
