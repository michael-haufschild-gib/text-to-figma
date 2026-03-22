/**
 * MCP Tool: get_relative_bounds
 *
 * Gets the bounding box of a target node relative to a reference node.
 * Useful for positioning elements relative to each other.
 *
 * HELPER TOOL: Builds on get_absolute_bounds primitive.
 * Use for: relative positioning, connecting shapes, spatial layout
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Response schema for Figma bridge get_relative_bounds response
 */
const pointSchema = z.object({ x: z.number(), y: z.number() }).passthrough();

const GetRelativeBoundsResponseSchema = z
  .object({
    relativeBounds: z
      .object({
        relativeX: z.number(),
        relativeY: z.number(),
        distanceFromRight: z.number(),
        distanceFromLeft: z.number(),
        distanceFromTop: z.number(),
        distanceFromBottom: z.number(),
        centerDistanceX: z.number(),
        centerDistanceY: z.number(),
        width: z.number(),
        height: z.number(),
        referencePoints: z
          .object({
            topLeft: pointSchema,
            topCenter: pointSchema,
            topRight: pointSchema,
            centerLeft: pointSchema,
            center: pointSchema,
            centerRight: pointSchema,
            bottomLeft: pointSchema,
            bottomCenter: pointSchema,
            bottomRight: pointSchema
          })
          .passthrough()
      })
      .passthrough(),
    message: z.string()
  })
  .passthrough();

/**
 * Input schema
 */
export const GetRelativeBoundsInputSchema = z.object({
  targetNodeId: z.string().min(1).describe('ID of the target node to measure'),
  referenceNodeId: z.string().min(1).describe('ID of the reference node to measure from')
});

export type GetRelativeBoundsInput = z.infer<typeof GetRelativeBoundsInputSchema>;

/**
 * Relative bounds info with positioning helpers
 */
export interface RelativeBoundsInfo {
  // Relative position of target to reference
  relativeX: number;
  relativeY: number;

  // Distance from reference node edges to target node edges
  distanceFromRight: number;
  distanceFromLeft: number;
  distanceFromTop: number;
  distanceFromBottom: number;

  // Center-to-center distances
  centerDistanceX: number;
  centerDistanceY: number;

  // Target dimensions
  width: number;
  height: number;

  // Useful positioning points on reference node
  referencePoints: {
    topLeft: { x: number; y: number };
    topCenter: { x: number; y: number };
    topRight: { x: number; y: number };
    centerLeft: { x: number; y: number };
    center: { x: number; y: number };
    centerRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
    bottomCenter: { x: number; y: number };
    bottomRight: { x: number; y: number };
  };
}

/**
 * Tool definition
 */
export const getRelativeBoundsToolDefinition = {
  name: 'get_relative_bounds',
  description: `Gets positioning information for a target node relative to a reference node.

HELPER TOOL: Calculates relative positions and provides positioning helpers.
Use for: connecting shapes, relative positioning, spatial layout calculations.

Returns comprehensive positioning data:
- Relative position (x, y offset from reference)
- Distances from each edge
- Center-to-center distances
- Reference points (top-left, center, etc.) for easy positioning

Example - Position node to the right of another:
const info = await get_relative_bounds({
  targetNodeId: "new-shape-123",
  referenceNodeId: "existing-shape-456"
});
// Use info.referencePoints.centerRight to position adjacent

Example - Connect shapes with overlap:
const info = await get_relative_bounds({
  targetNodeId: "head-789",
  referenceNodeId: "body-012"
});
// Position head at body's topCenter with slight overlap

Use Cases:
- Position elements relative to existing nodes
- Connect shapes seamlessly
- Calculate spacing between elements
- Align elements to reference points
- Create layouts based on existing structure`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      targetNodeId: {
        type: 'string' as const,
        description: 'ID of the target node to measure'
      },
      referenceNodeId: {
        type: 'string' as const,
        description: 'ID of the reference node to measure from'
      }
    },
    required: ['targetNodeId', 'referenceNodeId']
  }
};

/**
 * Result type
 */
export interface GetRelativeBoundsResult {
  success: true;
  targetNodeId: string;
  referenceNodeId: string;
  relativeBounds: RelativeBoundsInfo;
  message: string;
  timestamp: string;
}

/**
 * Implementation
 * @param input
 */
export async function getRelativeBounds(
  input: GetRelativeBoundsInput
): Promise<GetRelativeBoundsResult> {
  // Validate input
  const validated = input;

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  const response = await bridge.sendToFigmaValidated(
    'get_relative_bounds',
    {
      targetNodeId: validated.targetNodeId,
      referenceNodeId: validated.referenceNodeId
    },
    GetRelativeBoundsResponseSchema
  );

  const rb = response.relativeBounds;

  return {
    success: true as const,
    targetNodeId: validated.targetNodeId,
    referenceNodeId: validated.referenceNodeId,
    relativeBounds: rb,
    message: `Target is (${rb.relativeX.toFixed(1)}, ${rb.relativeY.toFixed(1)}) relative to reference. Center distance: (${rb.centerDistanceX.toFixed(1)}, ${rb.centerDistanceY.toFixed(1)}). Reference center point: (${rb.referencePoints.center.x.toFixed(1)}, ${rb.referencePoints.center.y.toFixed(1)})`,
    timestamp: new Date().toISOString()
  };
}
