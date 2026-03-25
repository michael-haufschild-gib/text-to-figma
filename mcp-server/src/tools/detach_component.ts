/**
 * MCP Tool: detach_component
 *
 * Detaches an INSTANCE from its component, or converts a COMPONENT/COMPONENT_SET into frames.
 *
 * INSTANCE: uses Figma's detachInstance() — result is a standalone frame.
 * COMPONENT: creates a frame, copies properties/children, removes the component.
 * COMPONENT_SET: same as COMPONENT but for the set and all its variant children.
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { getNodeRegistry } from '../node-registry.js';
import { defineHandler, textResponse } from '../routing/handler-utils.js';

export const DetachComponentInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the INSTANCE, COMPONENT, or COMPONENT_SET to detach')
});

export type DetachComponentInput = z.infer<typeof DetachComponentInputSchema>;

export const detachComponentToolDefinition = {
  name: 'detach_component',
  description: `Detaches an INSTANCE from its component, or converts a COMPONENT/COMPONENT_SET into regular frames.

For an INSTANCE: detaches it from its source component, turning it into a standalone FRAME.
For a single COMPONENT: replaces it with a FRAME containing the same children and properties.
For a COMPONENT_SET: replaces it with a FRAME, and converts each variant COMPONENT inside to a FRAME too.

WARNING: Detaching a COMPONENT or COMPONENT_SET breaks existing instances. The user can undo via Ctrl+Z in Figma.

Example:
detach_component({ nodeId: "2052:3953" })`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the INSTANCE, COMPONENT, or COMPONENT_SET to detach'
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

export const handler = defineHandler<DetachComponentInput, DetachComponentResult>({
  name: 'detach_component',
  schema: DetachComponentInputSchema,
  execute: detachComponent,
  formatResponse: (r) => {
    const lines = [r.message];
    for (const d of r.detached) {
      lines.push(`  ${d.name}: ${d.oldId} → ${d.newId}`);
    }
    return textResponse(lines.join('\n') + '\n');
  },
  definition: detachComponentToolDefinition
});
