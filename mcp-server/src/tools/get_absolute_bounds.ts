/**
 * MCP Tool: get_absolute_bounds
 *
 * Gets the absolute bounding box of a node in screen coordinates.
 *
 * PRIMITIVE: Raw Figma bounds primitive.
 * In Figma: node.absoluteBoundingBox
 * Use for: measuring node positions, collision detection, layout calculations
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const GetAbsoluteBoundsInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node')
});

export type GetAbsoluteBoundsInput = z.infer<typeof GetAbsoluteBoundsInputSchema>;

/**
 * Bounds info
 */
export interface BoundsInfo {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Tool definition
 */
export const getAbsoluteBoundsToolDefinition = {
  name: 'get_absolute_bounds',
  description: `Gets the absolute bounding box of a node.

PRIMITIVE: Raw Figma bounds primitive - not a pre-made component.
Use for: measuring positions, collision detection, layout calculations.

Returns:
- x, y: Top-left corner in absolute coordinates
- width, height: Node dimensions

Example - Get Button Bounds:
get_absolute_bounds({
  nodeId: "button-123"
})

Use Cases:
- Measure absolute positions
- Calculate relative positions
- Collision detection
- Layout calculations
- Positioning adjacent elements
- Measuring gaps between nodes`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node'
      }
    },
    required: ['nodeId']
  }
};

/**
 * Result type
 */
export interface GetAbsoluteBoundsResult {
  success: true;
  nodeId: string;
  bounds: BoundsInfo;
  message: string;
  timestamp: string;
}

/**
 * Implementation
 */
export async function getAbsoluteBounds(
  input: GetAbsoluteBoundsInput
): Promise<GetAbsoluteBoundsResult> {
  // Validate input
  const validated = GetAbsoluteBoundsInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  // Note: Bridge unwraps response, returns data on success, throws on failure
  const response = await bridge.sendToFigmaWithRetry<{
    nodeId: string;
    bounds: BoundsInfo;
    message: string;
  }>('get_absolute_bounds', {
    nodeId: validated.nodeId
  });

  if (!response.bounds) {
    throw new Error('Failed to get absolute bounds');
  }

  return {
    success: true as const,
    nodeId: validated.nodeId,
    bounds: response.bounds,
    message: `Bounds: (${response.bounds.x}, ${response.bounds.y}) ${response.bounds.width}×${response.bounds.height}`,
    timestamp: new Date().toISOString()
  };
}
