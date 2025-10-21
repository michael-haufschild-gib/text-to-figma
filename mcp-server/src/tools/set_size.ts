/**
 * MCP Tool: set_size
 *
 * Sets precise width and height dimensions for a node.
 *
 * PRIMITIVE: Raw Figma resize primitive.
 * In Figma: node.resize(width, height)
 * Use for: precise sizing, fixed dimensions, responsive sizing
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetSizeInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node to resize'),
  width: z.number().positive().describe('Width in pixels'),
  height: z.number().positive().describe('Height in pixels')
});

export type SetSizeInput = z.infer<typeof SetSizeInputSchema>;

/**
 * Tool definition
 */
export const setSizeToolDefinition = {
  name: 'set_size',
  description: `Sets precise width and height dimensions for a node.

PRIMITIVE: Raw Figma resize primitive - not a pre-made component.
Use for: precise sizing, fixed dimensions, aspect ratio control.

Common Sizes:
- Mobile: 375×667 (iPhone), 360×800 (Android)
- Tablet: 768×1024 (iPad), 810×1080 (Android)
- Desktop: 1440×900, 1920×1080
- Icons: 24×24, 32×32, 48×48, 64×64
- Buttons: 120×40, 200×48, 300×56
- Cards: 320×400, 400×500

Example - Mobile Frame:
set_size({
  nodeId: "frame-123",
  width: 375,
  height: 667
})

Example - Icon:
set_size({
  nodeId: "icon-456",
  width: 24,
  height: 24
})

Example - Button:
set_size({
  nodeId: "button-789",
  width: 200,
  height: 48
})

Example - Card:
set_size({
  nodeId: "card-012",
  width: 320,
  height: 400
})

CSS Equivalent:
width: 375px;
height: 667px;`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node to resize'
      },
      width: {
        type: 'number' as const,
        description: 'Width in pixels'
      },
      height: {
        type: 'number' as const,
        description: 'Height in pixels'
      }
    },
    required: ['nodeId', 'width', 'height']
  }
};

/**
 * Result type
 */
export interface SetSizeResult {
  nodeId: string;
  width: number;
  height: number;
  aspectRatio: string;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 */
export async function setSize(input: SetSizeInput): Promise<SetSizeResult> {
  // Validate input
  const validated = SetSizeInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  // Note: bridge.sendToFigma validates success at protocol level
  // It only resolves if Figma returns success=true, otherwise rejects
  await bridge.sendToFigma(
    'set_size',
    {
    nodeId: validated.nodeId,
    width: validated.width,
    height: validated.height
  }
  )

  // Calculate aspect ratio
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(Math.round(validated.width), Math.round(validated.height));
  const aspectRatio = `${Math.round(validated.width / divisor)}:${Math.round(validated.height / divisor)}`;

  const cssEquivalent = `width: ${validated.width}px;\nheight: ${validated.height}px;`;

  return {
    nodeId: validated.nodeId,
    width: validated.width,
    height: validated.height,
    aspectRatio,
    cssEquivalent,
    message: `Set size to ${validated.width}×${validated.height}px (${aspectRatio})`
  };
}
