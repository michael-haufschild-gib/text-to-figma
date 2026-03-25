/**
 * MCP Tool: detach_component
 *
 * Converts a COMPONENT or COMPONENT_SET back into regular frames.
 *
 * PRIMITIVE: Reverses component creation.
 * In Figma: no built-in API — creates frames, copies properties/children, removes originals.
 * Use for: breaking components back into editable frames
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { getNodeRegistry } from '../node-registry.js';

export const DetachComponentInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the COMPONENT or COMPONENT_SET to detach')
});

export type DetachComponentInput = z.infer<typeof DetachComponentInputSchema>;

export const detachComponentToolDefinition = {
  name: 'detach_component',
  description: `Converts a COMPONENT or COMPONENT_SET into regular frames.

For a single COMPONENT: replaces it with a FRAME containing the same children and properties.
For a COMPONENT_SET: replaces it with a FRAME, and converts each variant COMPONENT inside to a FRAME too.

WARNING: Existing instances of these components will lose their source. The user can undo via Ctrl+Z in Figma.

Example:
detach_component({ nodeId: "2052:3953" })`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the COMPONENT or COMPONENT_SET to detach'
      }
    },
    required: ['nodeId']
  }
};

export interface DetachComponentResult {
  type: string;
  frameId?: string;
  detached: Array<{ oldId: string; newId: string; name: string }>;
  message: string;
}

const DetachComponentResponseSchema = z
  .object({
    type: z.string(),
    frameId: z.string().optional(),
    detached: z.array(
      z.object({
        oldId: z.string(),
        newId: z.string(),
        name: z.string()
      })
    ),
    message: z.string()
  })
  .passthrough();

export async function detachComponent(input: DetachComponentInput): Promise<DetachComponentResult> {
  const bridge = getFigmaBridge();
  const response = await bridge.sendToFigmaValidated(
    'detach_component',
    { nodeId: input.nodeId },
    DetachComponentResponseSchema
  );

  const registry = getNodeRegistry();
  // Remove old component IDs from registry
  for (const entry of response.detached) {
    registry.remove(entry.oldId);
  }
  // Remove the component set ID if applicable
  if (response.frameId) {
    registry.remove(input.nodeId);
  }

  return {
    type: response.type,
    frameId: response.frameId,
    detached: response.detached,
    message: response.message
  };
}
