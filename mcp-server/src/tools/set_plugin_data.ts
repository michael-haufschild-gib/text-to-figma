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
import { getFigmaBridge } from '../figma-bridge.js';

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
 */
export async function setPluginData(
  input: SetPluginDataInput
): Promise<SetPluginDataResult> {
  // Validate input
  const validated = SetPluginDataInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  if (!bridge.isConnected()) {
    throw new Error('Not connected to Figma. Ensure the plugin is running.');
  }

  // Send command to Figma
  const response = await bridge.sendToFigma<{ success: boolean; error?: string }>('set_plugin_data', {
    nodeId: validated.nodeId,
    key: validated.key,
    value: validated.value
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to set plugin data');
  }

  return {
    nodeId: validated.nodeId,
    key: validated.key,
    message: `Stored plugin data "${validated.key}" on node`
  };
}
