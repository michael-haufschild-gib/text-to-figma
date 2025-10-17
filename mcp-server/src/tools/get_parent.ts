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
  description: `Gets the parent node of a given node.

PRIMITIVE: Raw Figma node tree primitive - not a pre-made component.
Use for: navigating up hierarchy, finding containers, context awareness.

Example - Find Parent Frame:
get_parent({
  nodeId: "text-node-123"
})

Example - Navigate Up Tree:
get_parent({
  nodeId: "button-component-456"
})

Use Cases:
- Find containing frame
- Navigate to parent component
- Understand node context
- Validate hierarchy
- Climb node tree`,
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
 */
export async function getParent(
  input: GetParentInput
): Promise<GetParentResult> {
  // Validate input
  const validated = GetParentInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  if (!bridge.isConnected()) {
    throw new Error('Not connected to Figma. Ensure the plugin is running.');
  }

  // Send command to Figma
  const response = await bridge.sendToFigma<{
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

  if (!response.success) {
    throw new Error(response.error || 'Failed to get parent');
  }

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
