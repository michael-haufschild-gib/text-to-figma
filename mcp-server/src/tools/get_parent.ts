/**
 * MCP Tool: get_parent
 *
 * Gets the parent node of a given node.
 *
 * PRIMITIVE: Raw Figma node tree primitive.
 * In Figma: node.parent
 * Use for: navigating up the tree, finding containers
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const GetParentInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the child node')
});

export type GetParentInput = z.infer<typeof GetParentInputSchema>;

/**
 * Tool definition
 */
export const getParentToolDefinition = {
  name: 'get_parent',
  description: `Gets the parent container of any node in the Figma hierarchy.

🎯 WHEN TO USE:
- Finding what frame/group contains a specific element
- Navigating UP the node tree (child → parent → grandparent)
- Understanding context before modifying a node
- Verifying hierarchy relationships

📋 RETURNS:
- parentId: ID of the parent node (use for subsequent operations)
- parentName: Name as shown in Figma layers panel
- parentType: FRAME, GROUP, COMPONENT, PAGE, etc.

💡 COMMON PATTERNS:

1. Find container to add siblings:
   parent = get_parent({ nodeId: "existing-button-123" })
   create_frame({ name: "New Button", parentId: parent.parentId })

2. Navigate up multiple levels:
   child = get_parent({ nodeId: "text-node" })      // → Button frame
   grandparent = get_parent({ nodeId: child.parentId }) // → Card container

3. Check if node is at root:
   result = get_parent({ nodeId: "some-node" })
   if (!result.parentId) { /* node is at page root */ }

⚠️ NOTE: Returns empty parentId for root-level nodes (direct children of the page).

🔗 RELATED TOOLS:
- get_children: Navigate DOWN the tree
- get_node_info: Get full details about a node
- get_page_hierarchy: See entire tree structure`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the child node'
      }
    },
    required: ['nodeId']
  }
};

/**
 * Result type
 */
export interface GetParentResult {
  nodeId: string;
  parentId?: string;
  parentName?: string;
  parentType?: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function getParent(input: GetParentInput): Promise<GetParentResult> {
  // Validate input
  const validated = input;

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  const response = await bridge.sendToFigmaWithRetry<{
    success: boolean;
    parent?: {
      id: string;
      name: string;
      type: string;
    };
    error?: string;
  }>('get_parent', {
    nodeId: validated.nodeId
  });
  // Note: Response validated by bridge at protocol level

  if (!response.parent) {
    return {
      nodeId: validated.nodeId,
      message: 'Node has no parent (root node or page)'
    };
  }

  return {
    nodeId: validated.nodeId,
    parentId: response.parent.id,
    parentName: response.parent.name,
    parentType: response.parent.type,
    message: `Parent: ${response.parent.name} (${response.parent.type})`
  };
}
