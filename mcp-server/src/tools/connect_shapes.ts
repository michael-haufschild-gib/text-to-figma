/**
 * MCP Tool: connect_shapes
 *
 * Positions and optionally merges shapes to create seamless connections.
 * High-level helper that combines positioning, alignment, and boolean operations.
 *
 * HELPER TOOL: Combines multiple primitives for easy shape connection.
 * Use for: connecting body parts, creating seamless organic shapes
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Connection side/anchor point
 */
export const ConnectionPoint = z.enum([
  'TOP',
  'TOP_LEFT',
  'TOP_RIGHT',
  'BOTTOM',
  'BOTTOM_LEFT',
  'BOTTOM_RIGHT',
  'LEFT',
  'RIGHT',
  'CENTER'
]);

export type ConnectionPointValue = z.infer<typeof ConnectionPoint>;

/**
 * Connection method
 */
export const ConnectionMethod = z.enum([
  'POSITION_ONLY', // Just position shapes to touch
  'POSITION_OVERLAP', // Position with slight overlap
  'UNION' // Position and merge with boolean union
]);

export type ConnectionMethodValue = z.infer<typeof ConnectionMethod>;

/**
 * Input schema
 */
export const ConnectShapesInputSchema = z.object({
  sourceNodeId: z.string().min(1).describe('ID of the source node (will move to connect)'),
  targetNodeId: z.string().min(1).describe('ID of the target node (stays in place)'),
  sourceAnchor: ConnectionPoint.describe('Anchor point on source node'),
  targetAnchor: ConnectionPoint.describe('Anchor point on target node'),
  method: ConnectionMethod.optional().describe('Connection method (default: POSITION_OVERLAP)'),
  overlap: z
    .number()
    .optional()
    .describe('Overlap distance in pixels (default: 5, only for POSITION_OVERLAP and UNION)'),
  unionResult: z
    .boolean()
    .optional()
    .describe('For UNION method: keep result as single shape (default: true)')
});

export type ConnectShapesInput = z.infer<typeof ConnectShapesInputSchema>;

/**
 * Tool definition
 */
export const connectShapesToolDefinition = {
  name: 'connect_shapes',
  description: `Positions and optionally merges shapes to create seamless connections.

HELPER TOOL: High-level shape connection helper - combines positioning and boolean operations.
Use for: connecting body parts, creating smooth organic shapes, joining elements seamlessly.

Connection Points (Anchor Points):
- TOP, BOTTOM, LEFT, RIGHT: Center of each edge
- TOP_LEFT, TOP_RIGHT, BOTTOM_LEFT, BOTTOM_RIGHT: Corners
- CENTER: Center of shape

Connection Methods:
- POSITION_ONLY: Just move shapes to touch (no overlap)
  * Good for: adjacent elements that shouldn't overlap
- POSITION_OVERLAP (default): Position with slight overlap
  * Good for: visual smoothness, preparing for manual union
  * Default overlap: 5px
- UNION: Position with overlap AND merge into single shape
  * Good for: seamless body parts, unified organic shapes
  * Creates single smooth shape from two elements

Example - Connect horse head to neck:
connect_shapes({
  sourceNodeId: "head-123",
  targetNodeId: "neck-456",
  sourceAnchor: "BOTTOM",
  targetAnchor: "TOP",
  method: "UNION",
  overlap: 10
})
// Head moves to neck's top, overlaps 10px, merges into one shape

Example - Position legs under body:
connect_shapes({
  sourceNodeId: "leg-789",
  targetNodeId: "body-012",
  sourceAnchor: "TOP",
  targetAnchor: "BOTTOM",
  method: "POSITION_ONLY"
})
// Leg positioned to touch body bottom (no overlap)

Example - Connect neck to body with overlap:
connect_shapes({
  sourceNodeId: "neck-345",
  targetNodeId: "body-678",
  sourceAnchor: "BOTTOM_RIGHT",
  targetAnchor: "TOP_LEFT",
  method: "POSITION_OVERLAP",
  overlap: 15
})
// Neck overlaps body by 15px for visual smoothness

Use Cases:
- Connect head to neck smoothly
- Attach legs to body
- Join tail to body
- Connect arms/limbs to torso
- Create seamless organic shapes
- Build characters from parts

Common Drawing Pattern:
1. Create individual body parts
2. Connect with POSITION_OVERLAP to preview
3. Adjust overlap if needed
4. Use UNION for final seamless shape`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      sourceNodeId: {
        type: 'string' as const,
        description: 'ID of the source node (will move to connect)'
      },
      targetNodeId: {
        type: 'string' as const,
        description: 'ID of the target node (stays in place)'
      },
      sourceAnchor: {
        type: 'string' as const,
        enum: [
          'TOP',
          'TOP_LEFT',
          'TOP_RIGHT',
          'BOTTOM',
          'BOTTOM_LEFT',
          'BOTTOM_RIGHT',
          'LEFT',
          'RIGHT',
          'CENTER'
        ],
        description: 'Anchor point on source node'
      },
      targetAnchor: {
        type: 'string' as const,
        enum: [
          'TOP',
          'TOP_LEFT',
          'TOP_RIGHT',
          'BOTTOM',
          'BOTTOM_LEFT',
          'BOTTOM_RIGHT',
          'LEFT',
          'RIGHT',
          'CENTER'
        ],
        description: 'Anchor point on target node'
      },
      method: {
        type: 'string' as const,
        enum: ['POSITION_ONLY', 'POSITION_OVERLAP', 'UNION'],
        description: 'Connection method (default: POSITION_OVERLAP)'
      },
      overlap: {
        type: 'number' as const,
        description: 'Overlap distance in pixels (default: 5)'
      },
      unionResult: {
        type: 'boolean' as const,
        description: 'For UNION: keep result as single shape (default: true)'
      }
    },
    required: ['sourceNodeId', 'targetNodeId', 'sourceAnchor', 'targetAnchor']
  }
};

/**
 * Result type
 */
export interface ConnectShapesResult {
  success: true;
  sourceNodeId: string;
  targetNodeId: string;
  method: ConnectionMethodValue;
  merged: boolean;
  newNodeId?: string;
  message: string;
  timestamp: string;
}

/**
 * Implementation
 * @param input
 */
export async function connectShapes(input: ConnectShapesInput): Promise<ConnectShapesResult> {
  // Validate input
  const validated = input;

  // Get Figma bridge
  const bridge = getFigmaBridge();

  const method = validated.method ?? 'POSITION_OVERLAP';
  const overlap = validated.overlap ?? 5;
  const unionResult = validated.unionResult !== false; // Default true

  // Send command to Figma
  // Note: Bridge unwraps response, returns data on success, throws on failure
  const response = await bridge.sendToFigmaWithRetry<{
    merged?: boolean;
    newNodeId?: string;
    message: string;
  }>('connect_shapes', {
    sourceNodeId: validated.sourceNodeId,
    targetNodeId: validated.targetNodeId,
    sourceAnchor: validated.sourceAnchor,
    targetAnchor: validated.targetAnchor,
    method,
    overlap,
    unionResult
  });

  const merged = response.merged ?? false;

  return {
    success: true as const,
    sourceNodeId: validated.sourceNodeId,
    targetNodeId: validated.targetNodeId,
    method,
    merged,
    newNodeId: response.newNodeId,
    message: merged
      ? `Connected and merged shapes into single node (ID: ${response.newNodeId})`
      : `Connected shapes using ${method}${method !== 'POSITION_ONLY' ? ` with ${overlap}px overlap` : ''}`,
    timestamp: new Date().toISOString()
  };
}
