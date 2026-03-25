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
  description: `Gets the exact position and size of a node on the Figma canvas.

WHEN TO USE:
- Positioning new elements relative to existing ones
- Calculating gaps/spacing between elements
- Measuring element sizes for documentation
- Aligning elements that aren't in the same auto-layout

RETURNS:
- x: Left edge position on canvas (pixels from origin)
- y: Top edge position on canvas (pixels from origin)
- width: Element width in pixels
- height: Element height in pixels

COMMON PATTERNS:

1. Position element to the right of another:
   bounds = get_absolute_bounds({ nodeId: "button-123" })
   newX = bounds.x + bounds.width + 16  // 16px gap
   set_transform({ nodeId: "new-element", x: newX, y: bounds.y })

2. Center-align two elements:
   a = get_absolute_bounds({ nodeId: "element-a" })
   b = get_absolute_bounds({ nodeId: "element-b" })
   centerA = a.x + (a.width / 2)
   newX = centerA - (b.width / 2)

3. Measure gap between elements:
   top = get_absolute_bounds({ nodeId: "header" })
   bottom = get_absolute_bounds({ nodeId: "content" })
   gap = bottom.y - (top.y + top.height)

NOTE: These are ABSOLUTE coordinates (relative to canvas origin),
not relative to parent. For parent-relative positioning, use
get_relative_bounds or set_transform with x/y.

🔗 RELATED TOOLS:
- get_relative_bounds: Position relative to another node
- set_transform: Move/resize nodes
- align_nodes: Align multiple nodes automatically`,
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
 * Response schema for Figma bridge get_absolute_bounds response
 */
const GetAbsoluteBoundsResponseSchema = z
  .object({
    bounds: z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number()
      })
      .passthrough()
  })
  .passthrough();

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
 * @param input
 */
export async function getAbsoluteBounds(
  input: GetAbsoluteBoundsInput
): Promise<GetAbsoluteBoundsResult> {
  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  const response = await bridge.sendToFigmaValidated(
    'get_absolute_bounds',
    { nodeId: input.nodeId },
    GetAbsoluteBoundsResponseSchema
  );

  return {
    success: true as const,
    nodeId: input.nodeId,
    bounds: response.bounds,
    message: `Bounds: (${response.bounds.x}, ${response.bounds.y}) ${response.bounds.width}×${response.bounds.height}`,
    timestamp: new Date().toISOString()
  };
}
