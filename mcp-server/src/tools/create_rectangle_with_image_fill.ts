/**
 * MCP Tool: create_rectangle_with_image_fill
 *
 * Creates a rectangle frame with an image fill from a URL.
 *
 * PRIMITIVE: This is a raw Figma primitive - a rectangle with image fill.
 * In Figma, you'd create a rectangle and set fills = [{ type: 'IMAGE', imageHash }]
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema for create_rectangle_with_image_fill
 */
export const CreateRectangleWithImageFillInputSchema = z.object({
  imageUrl: z.string().url().describe('URL of the image to load'),
  width: z.number().positive().describe('Width of the rectangle in pixels'),
  height: z.number().positive().describe('Height of the rectangle in pixels'),
  scaleMode: z.enum(['FILL', 'FIT', 'CROP', 'TILE']).optional().default('FILL').describe('How the image should scale within the rectangle'),
  name: z.string().optional().default('Image').describe('Name for the rectangle node'),
  parentId: z.string().optional().describe('Parent frame ID (optional)')
});

export type CreateRectangleWithImageFillInput = z.infer<typeof CreateRectangleWithImageFillInputSchema>;

/**
 * Tool definition for MCP
 */
export const createRectangleWithImageFillToolDefinition = {
  name: 'create_rectangle_with_image_fill',
  description: `Creates a rectangle with an image fill from a URL.

PRIMITIVE: This is a raw Figma primitive for displaying images.
Think of it as <img> tag in HTML or background-image in CSS.

Scale Modes:
- FILL: Image fills entire rectangle (may crop, default)
- FIT: Image fits within rectangle (may have empty space)
- CROP: Image fills and crops to center
- TILE: Image tiles to fill space

Example:
create_rectangle_with_image_fill({
  imageUrl: "https://example.com/photo.jpg",
  width: 320,
  height: 200,
  scaleMode: "FILL"
})

CSS Equivalent:
.image {
  width: 320px;
  height: 200px;
  background-image: url('photo.jpg');
  background-size: cover; /* FILL */
  background-position: center;
}`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      imageUrl: {
        type: 'string' as const,
        description: 'URL of the image to load (must be publicly accessible)'
      },
      width: {
        type: 'number' as const,
        description: 'Width of the rectangle in pixels'
      },
      height: {
        type: 'number' as const,
        description: 'Height of the rectangle in pixels'
      },
      scaleMode: {
        type: 'string' as const,
        enum: ['FILL', 'FIT', 'CROP', 'TILE'],
        description: 'How the image should scale (default: FILL)',
        default: 'FILL'
      },
      name: {
        type: 'string' as const,
        description: 'Name for the rectangle node (default: "Image")',
        default: 'Image'
      },
      parentId: {
        type: 'string' as const,
        description: 'Parent frame ID (optional)'
      }
    },
    required: ['imageUrl', 'width', 'height']
  }
};

/**
 * Result type
 */
export interface CreateRectangleWithImageFillResult {
  rectangleId: string;
  imageUrl: string;
  width: number;
  height: number;
  scaleMode: string;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 */
export async function createRectangleWithImageFill(
  input: CreateRectangleWithImageFillInput
): Promise<CreateRectangleWithImageFillResult> {
  // Validate input
  const validated = CreateRectangleWithImageFillInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  if (!bridge.isConnected()) {
    throw new Error('Not connected to Figma. Ensure the plugin is running and WebSocket bridge is active.');
  }

  // Send command to Figma
  const response = await bridge.sendToFigma<{ success: boolean; nodeId?: string; error?: string }>('create_rectangle_with_image_fill', {
    imageUrl: validated.imageUrl,
    width: validated.width,
    height: validated.height,
    scaleMode: validated.scaleMode,
    name: validated.name,
    parentId: validated.parentId
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to create rectangle with image fill');
  }

  // Map scale mode to CSS
  const scaleModeToCSS: Record<string, string> = {
    'FILL': 'background-size: cover;',
    'FIT': 'background-size: contain;',
    'CROP': 'background-size: cover; background-position: center;',
    'TILE': 'background-repeat: repeat;'
  };

  const cssEquivalent = `.image {
  width: ${validated.width}px;
  height: ${validated.height}px;
  background-image: url('${validated.imageUrl}');
  ${scaleModeToCSS[validated.scaleMode]}
}`;

  return {
    rectangleId: response.nodeId || '',
    imageUrl: validated.imageUrl,
    width: validated.width,
    height: validated.height,
    scaleMode: validated.scaleMode,
    cssEquivalent,
    message: `Created rectangle with image fill (${validated.scaleMode} mode)`
  };
}
