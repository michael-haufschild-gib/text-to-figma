/**
 * MCP Tool: rename_node
 *
 * Renames a node in the Figma document.
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { getNodeRegistry } from '../node-registry.js';

export const RenameNodeInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node to rename'),
  name: z.string().min(1).describe('New name for the node')
});

export type RenameNodeInput = z.infer<typeof RenameNodeInputSchema>;

export const renameNodeToolDefinition = {
  name: 'rename_node',
  description: `Renames a node in the Figma document.

Example:
rename_node({ nodeId: "frame-123", name: "Header" })`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: { type: 'string' as const, description: 'ID of the node to rename' },
      name: { type: 'string' as const, description: 'New name' }
    },
    required: ['nodeId', 'name']
  }
};

export interface RenameNodeResult {
  nodeId: string;
  oldName: string;
  name: string;
  message: string;
}

const RenameNodeResponseSchema = z
  .object({
    oldName: z.string().optional()
  })
  .passthrough();

export async function renameNode(input: RenameNodeInput): Promise<RenameNodeResult> {
  const bridge = getFigmaBridge();
  const response = await bridge.sendToFigmaValidated(
    'rename_node',
    { nodeId: input.nodeId, name: input.name },
    RenameNodeResponseSchema
  );

  const registry = getNodeRegistry();
  registry.update(input.nodeId, { name: input.name });

  return {
    nodeId: input.nodeId,
    oldName: response.oldName ?? 'unknown',
    name: input.name,
    message: 'Node renamed successfully'
  };
}
