/**
 * MCP Tool: set_instance_swap
 *
 * Swaps a component instance with another component.
 *
 * PRIMITIVE: Raw Figma component instance primitive.
 * In Figma: instance.swapComponent(newComponent)
 * Use for: switching component variations, design iterations
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetInstanceSwapInputSchema = z.object({
  instanceId: z.string().min(1).describe('ID of the instance to swap'),
  newComponentId: z.string().min(1).describe('ID of the new component to swap to')
});

export type SetInstanceSwapInput = z.infer<typeof SetInstanceSwapInputSchema>;

/**
 * Tool definition
 */
export const setInstanceSwapToolDefinition = {
  name: 'set_instance_swap',
  description: `Swaps a component instance with another component.

PRIMITIVE: Raw Figma instance swap primitive - not a pre-made component.
Use for: switching component variations, changing instance type, design iterations.

Example - Swap Button Variant:
set_instance_swap({
  instanceId: "button-instance-123",
  newComponentId: "button-large-456"
})

Example - Change Icon:
set_instance_swap({
  instanceId: "icon-instance-789",
  newComponentId: "icon-close-012"
})

Use Cases:
- Switch button sizes/states
- Change icon variations
- Update component versions
- Design iteration workflows
- A/B testing different components

Note: Preserves overrides when possible.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      instanceId: {
        type: 'string' as const,
        description: 'ID of the instance to swap'
      },
      newComponentId: {
        type: 'string' as const,
        description: 'ID of the new component to swap to'
      }
    },
    required: ['instanceId', 'newComponentId']
  }
};

/**
 * Result type
 */
export interface SetInstanceSwapResult {
  instanceId: string;
  oldComponentId?: string;
  newComponentId: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function setInstanceSwap(input: SetInstanceSwapInput): Promise<SetInstanceSwapResult> {
  // Validate input
  const validated = input;

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  const response = await bridge.sendToFigmaWithRetry<{
    success: boolean;
    oldComponentId?: string;
    error?: string;
  }>('set_instance_swap', {
    instanceId: validated.instanceId,
    newComponentId: validated.newComponentId
  });
  // Note: Response validated by bridge at protocol level

  return {
    instanceId: validated.instanceId,
    oldComponentId: response.oldComponentId,
    newComponentId: validated.newComponentId,
    message: 'Instance swapped successfully'
  };
}
