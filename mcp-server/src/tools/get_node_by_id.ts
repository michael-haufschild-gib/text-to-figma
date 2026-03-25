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
 * Response schema for Figma bridge get_node_by_id response
 */
const GetNodeByIdResponseSchema = z
  .object({
    exists: z.boolean(),
    node: z
      .object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        width: z.number().optional(),
        height: z.number().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        parentId: z.string().optional(),
        childrenCount: z.number().optional(),
        layoutMode: z.string().optional(),
        layoutPositioning: z.string().optional(),
        itemSpacing: z.number().optional(),
        primaryAxisSizingMode: z.string().optional(),
        counterAxisSizingMode: z.string().optional()
      })
      .passthrough()
      .optional(),
    error: z.string().optional()
  })
  .passthrough();

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
  description: `Retrieves basic information about a node when you have its ID.

WHEN TO USE:
- Verifying a node still exists before modifying it
- Getting basic properties (type, name, dimensions) quickly
- Checking if a nodeId from a previous operation is valid
- Quick lookup when you already know the ID

RETURNS:
- type: FRAME, TEXT, ELLIPSE, RECTANGLE, GROUP, COMPONENT, etc.
- name: Layer name as shown in Figma
- width, height: Dimensions in pixels
- x, y: Position coordinates
- parentId: ID of containing node
- childrenCount: Number of direct children
- layoutMode: Auto-layout direction (HORIZONTAL, VERTICAL, or NONE) — frames only
- layoutPositioning: AUTO or ABSOLUTE — children of auto-layout frames
- itemSpacing: Gap between children — frames with auto-layout only

COMMON PATTERNS:

1. Verify node before modification:
   node = get_node_by_id({ nodeId: "123:456" })
   if (node.type === "TEXT") {
     set_text_properties({ nodeId: node.nodeId, ... })
   }

2. Check dimensions before positioning:
   node = get_node_by_id({ nodeId: targetId })
   newX = node.x + node.width + 16  // Position to the right

3. Validate references from create_design:
   result = create_design({ spec: {...} })
   node = get_node_by_id({ nodeId: result.rootNodeId })
   // Confirms creation succeeded

THROWS ERROR if node doesn't exist. Use try/catch if ID might be invalid.

🔗 RELATED TOOLS:
- get_node_by_name: Find nodes when you don't know the ID
- get_node_info: Get MORE detailed properties (fills, strokes, etc.)
- get_selection: Get info about user-selected nodes`,
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
  success: true;
  nodeId: string;
  name: string;
  type: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  parentId?: string;
  childrenCount?: number;
  layoutMode?: string;
  layoutPositioning?: string;
  itemSpacing?: number;
  primaryAxisSizingMode?: string;
  counterAxisSizingMode?: string;
  message: string;
  timestamp: string;
}

/**
 * Implementation
 * @param input
 */
export async function getNodeById(input: GetNodeByIdInput): Promise<GetNodeByIdResult> {
  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  const response = await bridge.sendToFigmaValidated(
    'get_node_by_id',
    { nodeId: input.nodeId },
    GetNodeByIdResponseSchema
  );

  if (response.exists !== true || response.node === undefined) {
    throw new Error(response.error ?? 'Node not found');
  }

  const node = response.node;

  return {
    success: true as const,
    nodeId: node.id,
    name: node.name,
    type: node.type,
    width: node.width,
    height: node.height,
    x: node.x,
    y: node.y,
    parentId: node.parentId,
    childrenCount: node.childrenCount,
    layoutMode: node.layoutMode,
    layoutPositioning: node.layoutPositioning,
    itemSpacing: node.itemSpacing,
    primaryAxisSizingMode: node.primaryAxisSizingMode,
    counterAxisSizingMode: node.counterAxisSizingMode,
    message: `Found ${node.type} node "${node.name}"`,
    timestamp: new Date().toISOString()
  };
}
