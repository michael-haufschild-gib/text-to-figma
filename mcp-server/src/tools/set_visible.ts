/**
 * MCP Tool: set_visible
 *
 * Shows or hides a node (visibility control).
 *
 * PRIMITIVE: Raw Figma visibility primitive.
 * In Figma: node.visible = true | false
 * Use for: hiding elements, conditional visibility, layer management
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetVisibleInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node'),
  visible: z.boolean().describe('Show (true) or hide (false) the node')
});

export type SetVisibleInput = z.infer<typeof SetVisibleInputSchema>;

/**
 * Tool definition
 */
export const setVisibleToolDefinition = {
  name: 'set_visible',
  description: `Shows or hides a node (visibility control).

PRIMITIVE: Raw Figma visibility primitive - not a pre-made component.
Use for: hiding elements, conditional visibility, layer management, state variants.

Visibility:
- true: Node is visible (default)
- false: Node is hidden (not rendered, but still in tree)

Hidden nodes:
- Don't render in canvas
- Still occupy space in auto-layout parents
- Still accessible by ID
- Still have all properties

Example - Hide Element:
set_visible({
  nodeId: "optional-badge-123",
  visible: false
})

Example - Show Element:
set_visible({
  nodeId: "loading-spinner-456",
  visible: true
})

Use Cases:
- Hide loading states
- Conditional badges/labels
- Alternative layouts
- Debug helpers

CSS Equivalent:
visibility: hidden; /* false */
visibility: visible; /* true */
/* OR */
display: none; /* false - more aggressive */`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node'
      },
      visible: {
        type: 'boolean' as const,
        description: 'Show or hide the node'
      }
    },
    required: ['nodeId', 'visible']
  }
};

/**
 * Result type
 */
export interface SetVisibleResult {
  nodeId: string;
  visible: boolean;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function setVisible(input: SetVisibleInput): Promise<SetVisibleResult> {
  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  await bridge.sendToFigmaWithRetry('set_visible', {
    nodeId: input.nodeId,
    visible: input.visible
  });

  const cssEquivalent = input.visible
    ? 'visibility: visible;'
    : 'visibility: hidden;\n/* OR */\ndisplay: none;';

  return {
    nodeId: input.nodeId,
    visible: input.visible,
    cssEquivalent,
    message: input.visible ? 'Showed node' : 'Hid node'
  };
}
