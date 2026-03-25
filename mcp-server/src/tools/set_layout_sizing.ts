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
import { FigmaAckResponseSchema, getFigmaBridge } from '../figma-bridge.js';
import { defineHandler, textResponse } from '../routing/handler-utils.js';

/**
 * Input schema
 */
export const SetLayoutSizingInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node'),
  horizontal: z.enum(['FIXED', 'HUG', 'FILL']).optional().describe('Horizontal sizing mode'),
  vertical: z.enum(['FIXED', 'HUG', 'FILL']).optional().describe('Vertical sizing mode'),
  layoutPositioning: z
    .enum(['AUTO', 'ABSOLUTE'])
    .optional()
    .describe(
      'Layout positioning: AUTO (participates in auto-layout flow) or ABSOLUTE (free positioning within auto-layout parent)'
    )
});

export type SetLayoutSizingInput = z.infer<typeof SetLayoutSizingInputSchema>;

/**
 * Tool definition
 */
export const setLayoutSizingToolDefinition = {
  name: 'set_layout_sizing',
  description: `Sets how a node's size and positioning are determined in auto-layout.

PRIMITIVE: Raw Figma auto-layout child primitive - not a pre-made component.
Use for: responsive layouts, flexible containers, content-based sizing, absolute positioning within auto-layout.

Sizing Modes:
- FIXED: Node has a fixed width/height
- HUG: Node hugs its content (shrink-wrap)
- FILL: Node fills available space in parent

Layout Positioning:
- AUTO: Node participates in auto-layout flow (default)
- ABSOLUTE: Node is removed from auto-layout flow, freely positionable via x/y.
  Use this to allow instance overrides of child positions within components.
  The parent MUST have auto-layout enabled (HORIZONTAL or VERTICAL).
  After setting ABSOLUTE, use set_transform to position the node.

Example - Absolute Positioning:
set_layout_sizing({
  nodeId: "badge-123",
  layoutPositioning: "ABSOLUTE"
})

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

CSS Equivalents:
- FIXED: width: 100px; height: 100px;
- HUG: width: fit-content; height: fit-content;
- FILL: flex: 1; (in flex container)
- ABSOLUTE: position: absolute; (within flex container)`,
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
      },
      layoutPositioning: {
        type: 'string' as const,
        enum: ['AUTO', 'ABSOLUTE'],
        description:
          'Layout positioning: AUTO (participates in auto-layout flow) or ABSOLUTE (free positioning, allows instance overrides of x/y)'
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
  layoutPositioning?: string;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function setLayoutSizing(input: SetLayoutSizingInput): Promise<SetLayoutSizingResult> {
  if (
    input.horizontal === undefined &&
    input.vertical === undefined &&
    input.layoutPositioning === undefined
  ) {
    throw new Error('Must specify at least one of horizontal, vertical, or layoutPositioning');
  }

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  // Note: Response input by bridge at protocol level
  await bridge.sendToFigmaValidated(
    'set_layout_sizing',
    {
      nodeId: input.nodeId,
      horizontal: input.horizontal,
      vertical: input.vertical,
      layoutPositioning: input.layoutPositioning
    },
    FigmaAckResponseSchema
  );

  // Build CSS equivalent
  const cssParts: string[] = [];
  if (input.horizontal !== undefined) {
    if (input.horizontal === 'FIXED') {
      cssParts.push('width: [fixed]px');
    } else if (input.horizontal === 'HUG') {
      cssParts.push('width: fit-content');
    } else {
      cssParts.push('flex: 1');
    }
  }
  if (input.vertical !== undefined) {
    if (input.vertical === 'FIXED') {
      cssParts.push('height: [fixed]px');
    } else if (input.vertical === 'HUG') {
      cssParts.push('height: fit-content');
    } else {
      cssParts.push('align-self: stretch');
    }
  }
  if (input.layoutPositioning !== undefined) {
    cssParts.push(
      input.layoutPositioning === 'ABSOLUTE' ? 'position: absolute' : 'position: relative'
    );
  }

  const cssEquivalent = cssParts.join('; ');

  return {
    nodeId: input.nodeId,
    horizontal: input.horizontal,
    vertical: input.vertical,
    layoutPositioning: input.layoutPositioning,
    cssEquivalent,
    message: `Layout sizing updated`
  };
}

export const handler = defineHandler<SetLayoutSizingInput, SetLayoutSizingResult>({
  name: 'set_layout_sizing',
  schema: SetLayoutSizingInputSchema,
  execute: setLayoutSizing,
  formatResponse: (r) => {
    let text = `${r.message}\nNode ID: ${r.nodeId}\n`;
    if (r.horizontal) {
      text += `Horizontal: ${r.horizontal}\n`;
    }
    if (r.vertical) {
      text += `Vertical: ${r.vertical}\n`;
    }
    text += `\nCSS Equivalent:\n${r.cssEquivalent}\n`;
    return textResponse(text);
  },
  definition: setLayoutSizingToolDefinition
});
