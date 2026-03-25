/**
 * MCP Tool: remove_node
 *
 * Removes a node from the Figma document.
 *
 * PRIMITIVE: Raw Figma node removal primitive.
 * In Figma: node.remove()
 * Use for: deleting nodes, cleaning up temporary elements
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { getNodeRegistry } from '../node-registry.js';

export const RemoveNodeInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node to remove')
});

export type RemoveNodeInput = z.infer<typeof RemoveNodeInputSchema>;

export const removeNodeToolDefinition = {
  name: 'remove_node',
  description: `Removes a node from the Figma document.

WARNING: This is destructive and cannot be undone via the plugin API.
The user can still undo via Ctrl+Z in Figma.

Example:
remove_node({ nodeId: "old-rect-123" })`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node to remove'
      }
    },
    required: ['nodeId']
  }
};

export interface RemoveNodeResult {
  nodeId: string;
  parentId: string | null;
  name: string;
  type: string;
  message: string;
}

const RemoveNodeResponseSchema = z
  .object({
    parentId: z.string().optional(),
    name: z.string().optional(),
    type: z.string().optional()
  })
  .passthrough();

export async function removeNode(input: RemoveNodeInput): Promise<RemoveNodeResult> {
  const bridge = getFigmaBridge();
  const response = await bridge.sendToFigmaValidated(
    'remove_node',
    { nodeId: input.nodeId },
    RemoveNodeResponseSchema
  );

  const registry = getNodeRegistry();
  registry.remove(input.nodeId);

  return {
    nodeId: input.nodeId,
    parentId: response.parentId ?? null,
    name: response.name ?? 'unknown',
    type: response.type ?? 'unknown',
    message: `Node removed successfully`
  };
}
