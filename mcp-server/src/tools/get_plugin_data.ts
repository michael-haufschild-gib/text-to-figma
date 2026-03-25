/**
 * MCP Tool: get_plugin_data
 *
 * Retrieves custom metadata from a node.
 *
 * PRIMITIVE: Raw Figma plugin data primitive.
 * In Figma: node.getPluginData(key)
 * Use for: reading design tokens, metadata, custom properties
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { defineHandler, textResponse } from '../routing/handler-utils.js';

/**
 * Input schema
 */
export const GetPluginDataInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node'),
  key: z.string().min(1).describe('Data key to retrieve')
});

export type GetPluginDataInput = z.infer<typeof GetPluginDataInputSchema>;

/**
 * Tool definition
 */
export const getPluginDataToolDefinition = {
  name: 'get_plugin_data',
  description: `Retrieves custom metadata from a node.

PRIMITIVE: Raw Figma plugin data primitive - not a pre-made component.
Use for: reading design tokens, component metadata, custom properties.

Example - Get Design Token:
get_plugin_data({
  nodeId: "text-123",
  key: "token"
})

Example - Get Component Version:
get_plugin_data({
  nodeId: "button-456",
  key: "version"
})

Example - Get Test ID:
get_plugin_data({
  nodeId: "form-789",
  key: "testId"
})

Returns empty string if key doesn't exist.
Use set_plugin_data to store data.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node'
      },
      key: {
        type: 'string' as const,
        description: 'Data key to retrieve'
      }
    },
    required: ['nodeId', 'key']
  }
};

/**
 * Response schema for Figma bridge get_plugin_data response
 */
const GetPluginDataResponseSchema = z
  .object({
    value: z.string().optional()
  })
  .passthrough();

/**
 * Result type
 */
export interface GetPluginDataResult {
  nodeId: string;
  key: string;
  value: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function getPluginData(input: GetPluginDataInput): Promise<GetPluginDataResult> {
  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  const response = await bridge.sendToFigmaValidated(
    'get_plugin_data',
    {
      nodeId: input.nodeId,
      key: input.key
    },
    GetPluginDataResponseSchema
  );

  const value = response.value ?? '';
  const hasValue = value.length > 0;

  return {
    nodeId: input.nodeId,
    key: input.key,
    value,
    message: hasValue
      ? `Retrieved plugin data "${input.key}"`
      : `No data found for key "${input.key}"`
  };
}

export const handler = defineHandler<GetPluginDataInput, GetPluginDataResult>({
  name: 'get_plugin_data',
  schema: GetPluginDataInputSchema,
  execute: getPluginData,
  formatResponse: (r) => {
    let text = `${r.message}\nNode ID: ${r.nodeId}\nKey: ${r.key}\n`;
    if (r.value !== '') {
      text += `Value: ${r.value}\n`;
    }
    return textResponse(text);
  },
  definition: getPluginDataToolDefinition
});
