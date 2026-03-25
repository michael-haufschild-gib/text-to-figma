/**
 * MCP Tool: set_layout_align
 *
 * Sets alignment for auto-layout children (align-items).
 *
 * PRIMITIVE: Raw Figma auto-layout alignment primitive.
 * In Figma: node.primaryAxisAlignItems / counterAxisAlignItems
 * Use for: centering content, aligning items in flex containers
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetLayoutAlignInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the frame with auto-layout'),
  primaryAxis: z
    .enum(['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN'])
    .optional()
    .describe('Alignment along primary axis (justify-content)'),
  counterAxis: z
    .enum(['MIN', 'CENTER', 'MAX'])
    .optional()
    .describe('Alignment along counter axis (align-items)')
});

export type SetLayoutAlignInput = z.infer<typeof SetLayoutAlignInputSchema>;

/**
 * Tool definition
 */
export const setLayoutAlignToolDefinition = {
  name: 'set_layout_align',
  description: `Sets alignment for auto-layout children.

PRIMITIVE: Raw Figma auto-layout alignment primitive - not a pre-made component.
Use for: centering content, distributing space, aligning flex items.

Primary Axis (justify-content):
- MIN: Start (flex-start)
- CENTER: Center
- MAX: End (flex-end)
- SPACE_BETWEEN: Space between items

Counter Axis (align-items):
- MIN: Start (flex-start)
- CENTER: Center (default for most layouts)
- MAX: End (flex-end)

Example - Center Both Axes:
set_layout_align({
  nodeId: "card-123",
  primaryAxis: "CENTER",
  counterAxis: "CENTER"
})

Example - Space Between:
set_layout_align({
  nodeId: "navbar-456",
  primaryAxis: "SPACE_BETWEEN",
  counterAxis: "CENTER"
})

CSS Equivalents:
primaryAxis: MIN → justify-content: flex-start
primaryAxis: CENTER → justify-content: center
primaryAxis: MAX → justify-content: flex-end
primaryAxis: SPACE_BETWEEN → justify-content: space-between

counterAxis: MIN → align-items: flex-start
counterAxis: CENTER → align-items: center
counterAxis: MAX → align-items: flex-end`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the frame with auto-layout'
      },
      primaryAxis: {
        type: 'string' as const,
        enum: ['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN'],
        description: 'Alignment along primary axis'
      },
      counterAxis: {
        type: 'string' as const,
        enum: ['MIN', 'CENTER', 'MAX'],
        description: 'Alignment along counter axis'
      }
    },
    required: ['nodeId']
  }
};

/**
 * Result type
 */
export interface SetLayoutAlignResult {
  nodeId: string;
  primaryAxis?: string;
  counterAxis?: string;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function setLayoutAlign(input: SetLayoutAlignInput): Promise<SetLayoutAlignResult> {
  if (input.primaryAxis === undefined && input.counterAxis === undefined) {
    throw new Error('Must specify at least one of primaryAxis or counterAxis');
  }

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  // Note: Response input by bridge at protocol level
  await bridge.sendToFigmaWithRetry('set_layout_align', {
    nodeId: input.nodeId,
    primaryAxis: input.primaryAxis,
    counterAxis: input.counterAxis
  });

  // Build CSS equivalent
  const cssParts: string[] = [];

  if (input.primaryAxis !== undefined) {
    const primaryMap: Record<string, string> = {
      MIN: 'flex-start',
      CENTER: 'center',
      MAX: 'flex-end',
      SPACE_BETWEEN: 'space-between'
    };
    cssParts.push(`justify-content: ${primaryMap[input.primaryAxis]}`);
  }

  if (input.counterAxis !== undefined) {
    const counterMap: Record<string, string> = {
      MIN: 'flex-start',
      CENTER: 'center',
      MAX: 'flex-end'
    };
    cssParts.push(`align-items: ${counterMap[input.counterAxis]}`);
  }

  const cssEquivalent = cssParts.join('; ');

  return {
    nodeId: input.nodeId,
    primaryAxis: input.primaryAxis,
    counterAxis: input.counterAxis,
    cssEquivalent,
    message: 'Layout alignment updated'
  };
}
