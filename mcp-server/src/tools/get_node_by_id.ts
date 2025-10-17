/**
 * MCP Tool: get_node_by_id
 *
 * Retrieves node information by its ID.
 *
 * PRIMITIVE: Raw Figma node access primitive.
 * In Figma: figma.getNodeById(id)
 * Use for: finding specific nodes, inspecting properties
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const GetNodeByIdInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node to retrieve')
});

export type GetNodeByIdInput = z.infer<typeof GetNodeByIdInputSchema>;

/**
 * Tool definition
 */
export const getNodeByIdToolDefinition = {
  name: 'get_node_by_id',
  description: `Retrieves node information by its ID.

PRIMITIVE: Raw Figma node access primitive - not a pre-made component.
Use for: finding nodes, inspecting properties, verifying existence.

Returns:
- Node type (FRAME, TEXT, ELLIPSE, etc.)
- Node name
- Basic properties (width, height, x, y)
- Parent information
- Children count

Example - Find Node:
get_node_by_id({
  nodeId: "123:456"
})

Example - Verify Node Exists:
get_node_by_id({
  nodeId: "frame-abc-123"
})

Use Cases:
- Verify node creation
- Inspect node properties before modifying
- Navigate node tree
- Validate references`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node to retrieve'
      }
    },
    required: ['nodeId']
  }
};

/**
 * Result type
 */
export interface GetNodeByIdResult {
  nodeId: string;
  name: string;
  type: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  parentId?: string;
  childrenCount?: number;
  message: string;
}

/**
 * Implementation
 */
export async function getNodeById(
  input: GetNodeByIdInput
): Promise<GetNodeByIdResult> {
  // Validate input
  const validated = GetNodeByIdInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  if (!bridge.isConnected()) {
    throw new Error('Not connected to Figma. Ensure the plugin is running.');
  }

  // Send command to Figma
  const response = await bridge.sendToFigma<{
    success: boolean;
    node?: {
      id: string;
      name: string;
      type: string;
      width?: number;
      height?: number;
      x?: number;
      y?: number;
      parentId?: string;
      childrenCount?: number;
    };
    error?: string;
  }>('get_node_by_id', {
    nodeId: validated.nodeId
  });

  if (!response.success || !response.node) {
    throw new Error(response.error || 'Node not found');
  }

  const node = response.node;

  return {
    nodeId: node.id,
    name: node.name,
    type: node.type,
    width: node.width,
    height: node.height,
    x: node.x,
    y: node.y,
    parentId: node.parentId,
    childrenCount: node.childrenCount,
    message: `Found ${node.type} node "${node.name}"`
  };
}
