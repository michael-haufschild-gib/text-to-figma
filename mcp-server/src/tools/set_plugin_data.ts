/**
 * MCP Tool: set_plugin_data
 *
 * Stores custom metadata on a node (key-value pairs).
 *
 * PRIMITIVE: Raw Figma plugin data primitive.
 * In Figma: node.setPluginData(key, value)
 * Use for: custom metadata, design tokens, tooling integration
 */

import { z } from 'zod';
import { FigmaAckResponseSchema, getFigmaBridge } from '../figma-bridge.js';
import { defineHandler, textResponse } from '../routing/handler-utils.js';

/**
 * Input schema
 */
export const SetPluginDataInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node'),
  key: z.string().min(1).describe('Data key'),
  value: z.string().describe('Data value (will be stored as string)')
});

export type SetPluginDataInput = z.infer<typeof SetPluginDataInputSchema>;

/**
 * Tool definition
 */
export const setPluginDataToolDefinition = {
  name: 'set_plugin_data',
  description: `Stores custom metadata on a node.

PRIMITIVE: Raw Figma plugin data primitive - not a pre-made component.
Use for: design tokens, component metadata, tooling integration, custom properties.

Plugin Data:
- Stored as key-value pairs (both strings)
- Persists with the node
- Private to this plugin
- Not visible in Figma UI
- Survives copy/paste

Common Use Cases:
- Design tokens: Store semantic names
- Component metadata: Version, status, changelog
- Tooling integration: Build flags, test IDs
- Custom properties: Anything not in Figma API

Example - Design Token:
set_plugin_data({
  nodeId: "text-123",
  key: "token",
  value: "color.text.primary"
})

Example - Component Version:
set_plugin_data({
  nodeId: "button-456",
  key: "version",
  value: "2.1.0"
})

Example - Test ID:
set_plugin_data({
  nodeId: "login-form-789",
  key: "testId",
  value: "login-form-submit"
})

Note: For JSON data, stringify before storing.
Use get_plugin_data to retrieve.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node'
      },
      key: {
        type: 'string' as const,
        description: 'Data key'
      },
      value: {
        type: 'string' as const,
        description: 'Data value'
      }
    },
    required: ['nodeId', 'key', 'value']
  }
};

/**
 * Result type
 */
export interface SetPluginDataResult {
  nodeId: string;
  key: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function setPluginData(input: SetPluginDataInput): Promise<SetPluginDataResult> {
  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  await bridge.sendToFigmaValidated(
    'set_plugin_data',
    {
      nodeId: input.nodeId,
      key: input.key,
      value: input.value
    },
    FigmaAckResponseSchema
  );

  return {
    nodeId: input.nodeId,
    key: input.key,
    message: `Stored plugin data "${input.key}" on node`
  };
}

export const handler = defineHandler<SetPluginDataInput, SetPluginDataResult>({
  name: 'set_plugin_data',
  schema: SetPluginDataInputSchema,
  execute: setPluginData,
  formatResponse: (r) => textResponse(`${r.message}\nNode ID: ${r.nodeId}\nKey: ${r.key}\n`),
  definition: setPluginDataToolDefinition
});
