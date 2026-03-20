/**
 * MCP Tool: set_layer_order
 *
 * Controls the stacking order (z-index) of nodes within their parent.
 * Essential for controlling which elements appear on top.
 *
 * PRIMITIVE: Raw Figma layer ordering primitive.
 * Use for: controlling overlap, stacking elements, layer management
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { getLogger } from '../monitoring/logger.js';
import { createToolResult, type ToolResult } from '../utils/tool-result.js';

const log = getLogger().child({ tool: 'set_layer_order' });

/**
 * Layer order options
 */
export const LayerOrderAction = z.enum([
  'BRING_TO_FRONT', // Move to top of stack
  'BRING_FORWARD', // Move up one level
  'SEND_BACKWARD', // Move down one level
  'SEND_TO_BACK', // Move to bottom of stack
  'SET_INDEX' // Set to specific index
]);

export type LayerOrderActionValue = z.infer<typeof LayerOrderAction>;

/**
 * Input schema
 */
export const SetLayerOrderInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node to reorder'),
  action: LayerOrderAction.describe('Layer order action'),
  index: z.number().optional().describe('Specific index (only for SET_INDEX action, 0 = bottom)')
});

export type SetLayerOrderInput = z.infer<typeof SetLayerOrderInputSchema>;

/**
 * Tool definition
 */
export const setLayerOrderToolDefinition = {
  name: 'set_layer_order',
  description: `Controls the stacking order (z-index) of a node within its parent.

PRIMITIVE: Raw Figma layer ordering primitive - not a pre-made component.
Use for: controlling which elements appear on top, managing overlap, layer organization.

Layer Order Actions:
- BRING_TO_FRONT: Move node to top of stack (renders last, appears on top)
- BRING_FORWARD: Move node up one level in stack
- SEND_BACKWARD: Move node down one level in stack
- SEND_TO_BACK: Move node to bottom of stack (renders first, appears behind)
- SET_INDEX: Set to specific index (0 = bottom, higher = closer to top)

Figma Layer Ordering:
- Lower index = renders first = appears behind
- Higher index = renders last = appears on top
- Index 0 is the bottom layer
- Index (parent.children.length - 1) is the top layer

Example - Bring mane to front (above head):
set_layer_order({
  nodeId: "mane-123",
  action: "BRING_TO_FRONT"
})
// Mane now renders on top of all siblings

Example - Send body to back (behind all parts):
set_layer_order({
  nodeId: "body-456",
  action: "SEND_TO_BACK"
})
// Body now renders behind all other elements

Example - Fine-tune stacking:
set_layer_order({
  nodeId: "neck-789",
  action: "BRING_FORWARD"
})
// Neck moves up one layer

Example - Set specific order:
set_layer_order({
  nodeId: "tail-012",
  action: "SET_INDEX",
  index: 2
})
// Tail is now at index 2 (third from bottom)

Use Cases:
- Ensure mane/hair appears on top of head
- Place body behind limbs
- Control detail layer order
- Manage overlapping shapes
- Create depth in illustrations
- Organize complex compositions

Common Drawing Pattern:
1. Create all base shapes
2. Send large elements (body) to back
3. Bring details (eyes, mane) to front
4. Fine-tune with specific indices`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node to reorder'
      },
      action: {
        type: 'string' as const,
        enum: ['BRING_TO_FRONT', 'BRING_FORWARD', 'SEND_BACKWARD', 'SEND_TO_BACK', 'SET_INDEX'],
        description: 'Layer order action'
      },
      index: {
        type: 'number' as const,
        description: 'Specific index (only for SET_INDEX action, 0 = bottom)'
      }
    },
    required: ['nodeId', 'action']
  }
};

/**
 * Result type
 */
export interface SetLayerOrderData {
  nodeId: string;
  action: LayerOrderActionValue;
  newIndex?: number;
}

export type SetLayerOrderResult = ToolResult<SetLayerOrderData>;

/**
 * Implementation
 * @param input
 */
export async function setLayerOrder(input: SetLayerOrderInput): Promise<SetLayerOrderResult> {
  const startTime = Date.now();

  // Validate input
  const validated = input;

  if (validated.action === 'SET_INDEX' && validated.index === undefined) {
    const error = new Error('index is required when action is SET_INDEX');
    log.error('Validation failed', error, { input });
    throw error;
  }

  log.debug('Setting layer order', { nodeId: validated.nodeId, action: validated.action });

  // Get Figma bridge
  const bridge = getFigmaBridge();

  try {
    // Send command to Figma
    // Note: Bridge unwraps response, returns data on success, throws on failure
    const response = await bridge.sendToFigmaWithRetry<{
      newIndex: number;
      message: string;
    }>('set_layer_order', {
      nodeId: validated.nodeId,
      action: validated.action,
      index: validated.index
    });

    const duration = Date.now() - startTime;
    const message = `Set layer order: ${validated.action} (now at index ${String(response.newIndex)})`;

    log.info('Layer order set successfully', {
      nodeId: validated.nodeId,
      action: validated.action,
      newIndex: response.newIndex,
      duration
    });

    return createToolResult<SetLayerOrderData>(
      {
        nodeId: validated.nodeId,
        action: validated.action,
        newIndex: response.newIndex
      },
      message
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    log.error('Failed to set layer order', error instanceof Error ? error : undefined, {
      nodeId: validated.nodeId,
      action: validated.action,
      duration
    });

    throw new Error(`Failed to set layer order for node ${validated.nodeId}: ${errorMessage}`);
  }
}
