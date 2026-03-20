/**
 * MCP Tool: set_corner_radius
 *
 * Sets corner radius on a rectangle or frame (uniform or individual corners).
 *
 * PRIMITIVE: Raw Figma corner radius primitive.
 * In Figma: node.cornerRadius = number OR node.topLeftRadius, topRightRadius, etc.
 * Use for: rounded buttons, cards, images, containers
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetCornerRadiusInputSchema = z
  .object({
    nodeId: z.string().min(1).describe('ID of the node (rectangle or frame)'),
    radius: z.number().min(0).optional().describe('Uniform radius for all corners'),
    topLeft: z.number().min(0).optional().describe('Top-left corner radius'),
    topRight: z.number().min(0).optional().describe('Top-right corner radius'),
    bottomRight: z.number().min(0).optional().describe('Bottom-right corner radius'),
    bottomLeft: z.number().min(0).optional().describe('Bottom-left corner radius')
  })
  .refine(
    (data) =>
      data.radius !== undefined ||
      data.topLeft !== undefined ||
      data.topRight !== undefined ||
      data.bottomRight !== undefined ||
      data.bottomLeft !== undefined,
    {
      message: 'Must provide either radius (uniform) or at least one individual corner'
    }
  );

export type SetCornerRadiusInput = z.infer<typeof SetCornerRadiusInputSchema>;

/**
 * Tool definition
 */
export const setCornerRadiusToolDefinition = {
  name: 'set_corner_radius',
  description: `Sets corner radius on a rectangle or frame.

PRIMITIVE: Raw Figma corner radius primitive.
Use for: rounded buttons, cards, pills, images, containers.

Two modes:
1. Uniform: Set all corners to same value
2. Individual: Set each corner separately

Example - Uniform (Rounded Button):
set_corner_radius({
  nodeId: "button-123",
  radius: 8  // All corners
})

Example - Individual (Rounded Top Only):
set_corner_radius({
  nodeId: "card-456",
  topLeft: 16,
  topRight: 16,
  bottomLeft: 0,
  bottomRight: 0
})

Example - Pill Shape:
set_corner_radius({
  nodeId: "pill-789",
  radius: 999  // Very large = pill shape
})

CSS Equivalent (Uniform):
border-radius: 8px;

CSS Equivalent (Individual):
border-radius: 16px 16px 0 0; /* top-left, top-right, bottom-right, bottom-left */`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node'
      },
      radius: {
        type: 'number' as const,
        description: 'Uniform radius for all corners',
        minimum: 0
      },
      topLeft: {
        type: 'number' as const,
        description: 'Top-left corner radius',
        minimum: 0
      },
      topRight: {
        type: 'number' as const,
        description: 'Top-right corner radius',
        minimum: 0
      },
      bottomRight: {
        type: 'number' as const,
        description: 'Bottom-right corner radius',
        minimum: 0
      },
      bottomLeft: {
        type: 'number' as const,
        description: 'Bottom-left corner radius',
        minimum: 0
      }
    },
    required: ['nodeId']
  }
};

/**
 * Result type
 */
export interface SetCornerRadiusResult {
  nodeId: string;
  isUniform: boolean;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function setCornerRadius(input: SetCornerRadiusInput): Promise<SetCornerRadiusResult> {
  // Validate input
  const validated = input;

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Determine if uniform or individual
  const isUniform = validated.radius !== undefined;

  // Send command to Figma
  // Note: bridge.sendToFigma validates success at protocol level
  // It only resolves if Figma returns success=true, otherwise rejects
  await bridge.sendToFigmaWithRetry('set_corner_radius', {
    nodeId: validated.nodeId,
    radius: validated.radius,
    topLeft: validated.topLeft,
    topRight: validated.topRight,
    bottomRight: validated.bottomRight,
    bottomLeft: validated.bottomLeft
  });

  // Build CSS equivalent
  let cssEquivalent = '';

  if (isUniform) {
    cssEquivalent = `border-radius: ${validated.radius}px;`;
  } else {
    // Individual corners (CSS order: top-left, top-right, bottom-right, bottom-left)
    const tl = validated.topLeft ?? 0;
    const tr = validated.topRight ?? 0;
    const br = validated.bottomRight ?? 0;
    const bl = validated.bottomLeft ?? 0;

    cssEquivalent = `border-radius: ${tl}px ${tr}px ${br}px ${bl}px;`;
  }

  let message = '';
  if (isUniform) {
    message = `Set uniform corner radius: ${validated.radius}px`;
  } else {
    const corners: string[] = [];
    if (validated.topLeft !== undefined) {
      corners.push(`TL:${validated.topLeft}px`);
    }
    if (validated.topRight !== undefined) {
      corners.push(`TR:${validated.topRight}px`);
    }
    if (validated.bottomRight !== undefined) {
      corners.push(`BR:${validated.bottomRight}px`);
    }
    if (validated.bottomLeft !== undefined) {
      corners.push(`BL:${validated.bottomLeft}px`);
    }
    message = `Set individual corner radii: ${corners.join(', ')}`;
  }

  return {
    nodeId: validated.nodeId,
    isUniform,
    cssEquivalent,
    message
  };
}
