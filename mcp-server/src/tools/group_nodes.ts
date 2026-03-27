/**
 * MCP Tool: group_nodes
 *
 * Groups one or more nodes into a Figma GroupNode.
 * Unlike frames, groups have no layout properties — they are purely
 * organizational containers that preserve children's absolute positions.
 *
 * Uses figma.group() under the hood.
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { getNodeRegistry } from '../node-registry.js';
import { defineHandler, textResponse } from '../routing/handler-utils.js';

/**
 * Input schema
 */
export const GroupNodesInputSchema = z.object({
  nodeIds: z.array(z.string().min(1)).min(1).describe('Array of node IDs to group (minimum 1)'),
  name: z.string().optional().describe('Name for the group (default: "Group")'),
  parentId: z
    .string()
    .optional()
    .describe("Parent node for the group. If omitted, uses the first node's current parent.")
});

export type GroupNodesInput = z.infer<typeof GroupNodesInputSchema>;

/**
 * Tool definition
 */
export const groupNodesToolDefinition = {
  name: 'group_nodes',
  description: `Groups nodes into a visual container without layout properties.

Unlike frames, groups:
- Have no auto-layout, padding, or clipping
- Preserve children's absolute positions
- Are purely organizational (like Cmd+G in Figma)
- Cannot have fills, strokes, or effects directly

Use for: organizing related nodes in the layer panel, grouping illustration parts,
keeping related elements together without affecting their layout.

For layout containers, use create_frame instead.

Example - Group illustration parts:
group_nodes({
  nodeIds: ["body-path", "head-path", "tail-path"],
  name: "Horse"
})

Example - Group into a specific parent:
group_nodes({
  nodeIds: ["icon-1", "label-1"],
  name: "Nav Item",
  parentId: "nav-frame"
})`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeIds: {
        type: 'array' as const,
        items: { type: 'string' as const },
        description: 'Array of node IDs to group (minimum 1)'
      },
      name: {
        type: 'string' as const,
        description: 'Name for the group (default: "Group")'
      },
      parentId: {
        type: 'string' as const,
        description: "Parent node for the group. If omitted, uses the first node's current parent."
      }
    },
    required: ['nodeIds']
  }
};

/**
 * Response schema from Figma plugin
 */
const GroupNodesResponseSchema = z
  .object({
    groupId: z.string(),
    nodeCount: z.number()
  })
  .passthrough();

/**
 * Result type
 */
export interface GroupNodesResult {
  groupId: string;
  name: string;
  nodeCount: number;
  message: string;
}

/**
 * Implementation
 */
export async function groupNodes(input: GroupNodesInput): Promise<GroupNodesResult> {
  const bridge = getFigmaBridge();
  const name = input.name ?? 'Group';

  const response = await bridge.sendToFigmaValidated(
    'group_nodes',
    {
      nodeIds: input.nodeIds,
      name,
      parentId: input.parentId
    },
    GroupNodesResponseSchema
  );

  const registry = getNodeRegistry();
  registry.register(response.groupId, {
    type: 'GROUP',
    name,
    parentId: input.parentId ?? null,
    children: input.nodeIds
  });

  return {
    groupId: response.groupId,
    name,
    nodeCount: response.nodeCount,
    message: `Grouped ${response.nodeCount} node(s) into "${name}"`
  };
}

export const handler = defineHandler<GroupNodesInput, GroupNodesResult>({
  name: 'group_nodes',
  schema: GroupNodesInputSchema,
  execute: groupNodes,
  formatResponse: (r) => textResponse(`${r.message}\nGroup ID: ${r.groupId}\n`),
  definition: groupNodesToolDefinition
});
