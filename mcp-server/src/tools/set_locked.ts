/**
 * MCP Tool: set_locked
 *
 * Locks or unlocks a node (prevents editing).
 *
 * PRIMITIVE: Raw Figma lock primitive.
 * In Figma: node.locked = true | false
 * Use for: protecting elements, preventing accidental edits
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetLockedInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node'),
  locked: z.boolean().describe('Lock (true) or unlock (false) the node')
});

export type SetLockedInput = z.infer<typeof SetLockedInputSchema>;

/**
 * Tool definition
 */
export const setLockedToolDefinition = {
  name: 'set_locked',
  description: `Locks or unlocks a node (prevents editing).

PRIMITIVE: Raw Figma lock primitive - not a pre-made component.
Use for: protecting elements, preventing accidental edits, layer management.

Lock Status:
- true: Node is locked (cannot be selected or edited)
- false: Node is unlocked (default, fully editable)

Locked nodes:
- Cannot be selected in canvas
- Cannot be moved or resized
- Cannot be deleted
- Properties cannot be changed
- Still visible and rendered

Example - Lock Background:
set_locked({
  nodeId: "background-image-123",
  locked: true
})

Example - Unlock for Editing:
set_locked({
  nodeId: "header-456",
  locked: false
})

Use Cases:
- Protect backgrounds
- Lock base layout
- Prevent accidental changes
- Lock guidelines/grids
- Preserve completed sections

Note: No direct CSS equivalent (UI/editor concern)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node'
      },
      locked: {
        type: 'boolean' as const,
        description: 'Lock or unlock the node'
      }
    },
    required: ['nodeId', 'locked']
  }
};

/**
 * Result type
 */
export interface SetLockedResult {
  nodeId: string;
  locked: boolean;
  message: string;
}

/**
 * Implementation
 */
export async function setLocked(
  input: SetLockedInput
): Promise<SetLockedResult> {
  // Validate input
  const validated = SetLockedInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  if (!bridge.isConnected()) {
    throw new Error('Not connected to Figma. Ensure the plugin is running.');
  }

  // Send command to Figma
  const response = await bridge.sendToFigma<{ success: boolean; error?: string }>('set_locked', {
    nodeId: validated.nodeId,
    locked: validated.locked
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to set lock status');
  }

  return {
    nodeId: validated.nodeId,
    locked: validated.locked,
    message: validated.locked ? 'Locked node (protected from editing)' : 'Unlocked node (editable)'
  };
}
