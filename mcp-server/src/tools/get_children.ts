/**
 * MCP Tool: get_children
 *
 * Gets child nodes of a container (frame, group, etc.).
 *
 * PRIMITIVE: Raw Figma node tree primitive.
 * In Figma: node.children
 * Use for: navigating node tree, batch operations, hierarchy inspection
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const GetChildrenInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the parent node'),
  recursive: z.boolean().optional().default(false).describe('Get all descendants (recursive) or just direct children')
});

export type GetChildrenInput = z.infer<typeof GetChildrenInputSchema>;

/**
 * Child node info
 */
export interface ChildNodeInfo {
  nodeId: string;
  name: string;
  type: string;
  visible: boolean;
  locked: boolean;
}

/**
 * Tool definition
 */
export const getChildrenToolDefinition = {
  name: 'get_children',
  description: `Gets child nodes of a container.

PRIMITIVE: Raw Figma node tree primitive - not a pre-made component.
Use for: navigating hierarchy, batch operations, inspecting structure.

Options:
- recursive: false (default) = Direct children only
- recursive: true = All descendants (entire subtree)

Example - Get Direct Children:
get_children({
  nodeId: "card-frame-123",
  recursive: false
})

Example - Get All Descendants:
get_children({
  nodeId: "page-456",
  recursive: true
})

Use Cases:
- Inspect component structure
- Batch update child nodes
- Navigate design hierarchy
- Validate layer organization
- Find nested elements`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the parent node'
      },
      recursive: {
        type: 'boolean' as const,
        description: 'Get all descendants',
        default: false
      }
    },
    required: ['nodeId']
  }
};

/**
 * Result type
 */
export interface GetChildrenResult {
  nodeId: string;
  childCount: number;
  children: ChildNodeInfo[];
  message: string;
}

/**
 * Implementation
 */
export async function getChildren(
  input: GetChildrenInput
): Promise<GetChildrenResult> {
  // Validate input
  const validated = GetChildrenInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  if (!bridge.isConnected()) {
    throw new Error('Not connected to Figma. Ensure the plugin is running.');
  }

  // Send command to Figma
  const response = await bridge.sendToFigma<{
    success: boolean;
    children?: ChildNodeInfo[];
    error?: string;
  }>('get_children', {
    nodeId: validated.nodeId,
    recursive: validated.recursive
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to get children');
  }

  const children = response.children || [];
  const scope = validated.recursive ? 'descendants' : 'direct children';

  return {
    nodeId: validated.nodeId,
    childCount: children.length,
    children,
    message: `Found ${children.length} ${scope}`
  };
}
