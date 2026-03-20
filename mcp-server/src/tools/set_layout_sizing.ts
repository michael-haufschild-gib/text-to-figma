/**
 * MCP Tool: set_layout_sizing
 *
 * Sets how a node's size is determined in auto-layout (Fixed, Hug, Fill).
 *
 * PRIMITIVE: Raw Figma auto-layout sizing primitive.
 * In Figma: node.layoutSizingHorizontal / layoutSizingVertical
 * Use for: responsive layouts, flexible containers, content-based sizing
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetLayoutSizingInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node'),
  horizontal: z.enum(['FIXED', 'HUG', 'FILL']).optional().describe('Horizontal sizing mode'),
  vertical: z.enum(['FIXED', 'HUG', 'FILL']).optional().describe('Vertical sizing mode')
});

export type SetLayoutSizingInput = z.infer<typeof SetLayoutSizingInputSchema>;

/**
 * Tool definition
 */
export const setLayoutSizingToolDefinition = {
  name: 'set_layout_sizing',
  description: `Sets how a node's size is determined in auto-layout.

PRIMITIVE: Raw Figma auto-layout sizing primitive - not a pre-made component.
Use for: responsive layouts, flexible containers, content-based sizing.

Sizing Modes:
- FIXED: Node has a fixed width/height
- HUG: Node hugs its content (shrink-wrap)
- FILL: Node fills available space in parent

Example - Hug Content:
set_layout_sizing({
  nodeId: "button-123",
  horizontal: "HUG",
  vertical: "HUG"
})

Example - Fill Container Width:
set_layout_sizing({
  nodeId: "card-456",
  horizontal: "FILL",
  vertical: "HUG"
})

Example - Fixed Size:
set_layout_sizing({
  nodeId: "avatar-789",
  horizontal: "FIXED",
  vertical: "FIXED"
})

CSS Equivalents:
- FIXED: width: 100px; height: 100px;
- HUG: width: fit-content; height: fit-content;
- FILL: flex: 1; (in flex container)

Use Cases:
- Responsive buttons (hug content)
- Full-width cards (fill container)
- Fixed-size avatars
- Flexible layouts`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node'
      },
      horizontal: {
        type: 'string' as const,
        enum: ['FIXED', 'HUG', 'FILL'],
        description: 'Horizontal sizing mode'
      },
      vertical: {
        type: 'string' as const,
        enum: ['FIXED', 'HUG', 'FILL'],
        description: 'Vertical sizing mode'
      }
    },
    required: ['nodeId']
  }
};

/**
 * Result type
 */
export interface SetLayoutSizingResult {
  nodeId: string;
  horizontal?: string;
  vertical?: string;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function setLayoutSizing(input: SetLayoutSizingInput): Promise<SetLayoutSizingResult> {
  // Validate input
  const validated = input;

  if (!validated.horizontal && !validated.vertical) {
    throw new Error('Must specify at least one of horizontal or vertical');
  }

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  // Note: Response validated by bridge at protocol level
  await bridge.sendToFigmaWithRetry('set_layout_sizing', {
    nodeId: validated.nodeId,
    horizontal: validated.horizontal,
    vertical: validated.vertical
  });

  // Build CSS equivalent
  const cssParts: string[] = [];
  if (validated.horizontal) {
    if (validated.horizontal === 'FIXED') {
      cssParts.push('width: [fixed]px');
    } else if (validated.horizontal === 'HUG') {
      cssParts.push('width: fit-content');
    } else if (validated.horizontal === 'FILL') {
      cssParts.push('flex: 1');
    }
  }
  if (validated.vertical) {
    if (validated.vertical === 'FIXED') {
      cssParts.push('height: [fixed]px');
    } else if (validated.vertical === 'HUG') {
      cssParts.push('height: fit-content');
    } else if (validated.vertical === 'FILL') {
      cssParts.push('align-self: stretch');
    }
  }

  const cssEquivalent = cssParts.join('; ');

  return {
    nodeId: validated.nodeId,
    horizontal: validated.horizontal,
    vertical: validated.vertical,
    cssEquivalent,
    message: `Layout sizing updated`
  };
}
