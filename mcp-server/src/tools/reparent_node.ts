/**
 * MCP Tool: reparent_node
 *
 * Moves a node to a new parent (appendChild).
 *
 * PRIMITIVE: Raw Figma reparenting primitive.
 * In Figma: newParent.appendChild(node)
 * Use for: restructuring hierarchy, wrapping nodes in containers
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { getNodeRegistry } from '../node-registry.js';
import { defineHandler, textResponse } from '../routing/handler-utils.js';

export const ReparentNodeInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node to move'),
  parentId: z.string().min(1).describe('ID of the new parent node')
});

export type ReparentNodeInput = z.infer<typeof ReparentNodeInputSchema>;

export const reparentNodeToolDefinition = {
  name: 'reparent_node',
  description: `Moves a node to a new parent (reparenting via appendChild).

Use for: restructuring node hierarchy, wrapping nodes in new containers,
moving children between frames.

The node is removed from its current parent and appended as the last
child of the new parent.

Example:
reparent_node({
  nodeId: "rect-123",
  parentId: "wrapper-frame-456"
})`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node to move'
      },
      parentId: {
        type: 'string' as const,
        description: 'ID of the new parent node'
      }
    },
    required: ['nodeId', 'parentId']
  }
};

export interface ReparentNodeResult {
  nodeId: string;
  oldParentId: string | null;
  newParentId: string;
  message: string;
}

const ReparentNodeResponseSchema = z
  .object({
    oldParentId: z.string().optional(),
    newParentId: z.string().optional()
  })
  .passthrough();

export async function reparentNode(input: ReparentNodeInput): Promise<ReparentNodeResult> {
  const bridge = getFigmaBridge();
  const response = await bridge.sendToFigmaValidated(
    'reparent_node',
    { nodeId: input.nodeId, parentId: input.parentId },
    ReparentNodeResponseSchema
  );

  // Use register() instead of update() — register() correctly removes
  // the node from the old parent's children and adds it to the new parent's.
  const registry = getNodeRegistry();
  const existing = registry.getNode(input.nodeId);
  if (existing) {
    registry.register(input.nodeId, {
      type: existing.type,
      name: existing.name,
      parentId: input.parentId,
      children: existing.children,
      bounds: existing.bounds,
      metadata: existing.metadata
    });
  }

  return {
    nodeId: input.nodeId,
    oldParentId: response.oldParentId ?? null,
    newParentId: input.parentId,
    message: `Node reparented successfully`
  };
}

export const handler = defineHandler<ReparentNodeInput, ReparentNodeResult>({
  name: 'reparent_node',
  schema: ReparentNodeInputSchema,
  execute: reparentNode,
  formatResponse: (r) =>
    textResponse(
      `${r.message}\nNode ID: ${r.nodeId}\nOld Parent: ${r.oldParentId ?? 'none'}\nNew Parent: ${r.newParentId}\n`
    ),
  definition: reparentNodeToolDefinition
});
