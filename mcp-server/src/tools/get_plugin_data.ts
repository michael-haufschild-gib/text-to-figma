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
  // Validate input
  const validated = input;

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  const response = await bridge.sendToFigmaWithRetry<{
    success: boolean;
    value?: string;
    error?: string;
  }>('get_plugin_data', {
    nodeId: validated.nodeId,
    key: validated.key
  });
  // Note: Response validated by bridge at protocol level

  const value = response.value || '';
  const hasValue = value.length > 0;

  return {
    nodeId: validated.nodeId,
    key: validated.key,
    value,
    message: hasValue
      ? `Retrieved plugin data "${validated.key}"`
      : `No data found for key "${validated.key}"`
  };
}
