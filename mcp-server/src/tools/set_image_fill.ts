/**
 * MCP Tool: set_image_fill
 *
 * Applies an image fill to an existing node (frame or rectangle).
 *
 * PRIMITIVE: Raw Figma primitive for applying image fills.
 * In Figma: node.fills = [{ type: 'IMAGE', imageHash, scaleMode }]
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetImageFillInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node to apply image fill to'),
  imageUrl: z.string().url().describe('URL of the image to load'),
  scaleMode: z.enum(['FILL', 'FIT', 'CROP', 'TILE']).optional().default('FILL').describe('How the image should scale'),
  opacity: z.number().min(0).max(1).optional().default(1).describe('Image opacity (0-1, default: 1)')
});

export type SetImageFillInput = z.infer<typeof SetImageFillInputSchema>;

/**
 * Tool definition
 */
export const setImageFillToolDefinition = {
  name: 'set_image_fill',
  description: `Applies an image fill to an existing frame or rectangle.

PRIMITIVE: Raw Figma image fill primitive.
Use this to add images to existing shapes.

Scale Modes:
- FILL: Image fills entire shape (may crop)
- FIT: Image fits within shape (may have empty space)
- CROP: Image fills and crops to center
- TILE: Image tiles to fill space

Example:
// First create a rectangle
const rect = await create_frame({ width: 300, height: 200 });

// Then apply image fill
await set_image_fill({
  nodeId: rect.frameId,
  imageUrl: "https://example.com/photo.jpg",
  scaleMode: "FILL"
});

CSS Equivalent:
background-image: url('photo.jpg');
background-size: cover; /* for FILL */`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node to apply image fill to'
      },
      imageUrl: {
        type: 'string' as const,
        description: 'URL of the image (must be publicly accessible)'
      },
      scaleMode: {
        type: 'string' as const,
        enum: ['FILL', 'FIT', 'CROP', 'TILE'],
        description: 'How the image should scale (default: FILL)',
        default: 'FILL'
      },
      opacity: {
        type: 'number' as const,
        description: 'Image opacity 0-1 (default: 1)',
        minimum: 0,
        maximum: 1,
        default: 1
      }
    },
    required: ['nodeId', 'imageUrl']
  }
};

/**
 * Result type
 */
export interface SetImageFillResult {
  nodeId: string;
  imageUrl: string;
  scaleMode: string;
  opacity: number;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 */
export async function setImageFill(
  input: SetImageFillInput
): Promise<SetImageFillResult> {
  // Validate input
  const validated = SetImageFillInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  if (!bridge.isConnected()) {
    throw new Error('Not connected to Figma. Ensure the plugin is running.');
  }

  // Send command to Figma
  const response = await bridge.sendToFigma<{ success: boolean; error?: string }>('set_image_fill', {
    nodeId: validated.nodeId,
    imageUrl: validated.imageUrl,
    scaleMode: validated.scaleMode,
    opacity: validated.opacity
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to set image fill');
  }

  // Map scale mode to CSS
  const scaleModeToCSS: Record<string, string> = {
    'FILL': 'background-size: cover;',
    'FIT': 'background-size: contain;',
    'CROP': 'background-size: cover; background-position: center;',
    'TILE': 'background-repeat: repeat;'
  };

  const cssEquivalent = `background-image: url('${validated.imageUrl}');
${scaleModeToCSS[validated.scaleMode]}
opacity: ${validated.opacity};`;

  return {
    nodeId: validated.nodeId,
    imageUrl: validated.imageUrl,
    scaleMode: validated.scaleMode,
    opacity: validated.opacity,
    cssEquivalent,
    message: `Applied image fill to node ${validated.nodeId} (${validated.scaleMode} mode)`
  };
}
