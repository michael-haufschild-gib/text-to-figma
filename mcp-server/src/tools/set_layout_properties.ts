/**
 * Set Layout Properties Tool
 *
 * Updates layout properties on existing frames.
 * Allows modification of auto-layout settings after frame creation.
 */

import { z } from 'zod';
import { spacingSchema, VALID_SPACING_VALUES } from '../constraints/spacing.js';
import { layoutModeSchema } from './create_frame.js';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema for set_layout_properties tool
 */
export const setLayoutPropertiesInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the frame to modify'),
  layoutMode: layoutModeSchema.optional().describe('Layout direction'),
  itemSpacing: spacingSchema.optional().describe('Gap between children (8pt grid)'),
  padding: spacingSchema.optional().describe('Internal padding (8pt grid)'),
  width: z.number().positive().optional().describe('Width in pixels'),
  height: z.number().positive().optional().describe('Height in pixels')
});

export type SetLayoutPropertiesInput = z.infer<typeof setLayoutPropertiesInputSchema>;

/**
 * Result of updating layout properties
 */
export interface SetLayoutPropertiesResult {
  nodeId: string;
  updated: string[];
  cssEquivalent: string;
}

/**
 * Generates CSS equivalent for the updated properties
 */
function generateCssEquivalent(input: SetLayoutPropertiesInput): string {
  const updates: string[] = [];

  if (input.layoutMode !== undefined) {
    if (input.layoutMode === 'NONE') {
      updates.push('display: block;');
      updates.push('position: relative;');
    } else {
      updates.push('display: flex;');
      const direction = input.layoutMode === 'HORIZONTAL' ? 'row' : 'column';
      updates.push(`flex-direction: ${direction};`);
    }
  }

  if (input.itemSpacing !== undefined) {
    updates.push(`gap: ${input.itemSpacing}px;`);
  }

  if (input.padding !== undefined) {
    updates.push(`padding: ${input.padding}px;`);
  }

  if (input.width !== undefined) {
    updates.push(`width: ${input.width}px;`);
  }

  if (input.height !== undefined) {
    updates.push(`height: ${input.height}px;`);
  }

  return updates.length > 0 ? updates.join('\n  ') : 'No properties updated';
}

/**
 * Updates layout properties on an existing frame
 */
export async function setLayoutProperties(input: SetLayoutPropertiesInput): Promise<SetLayoutPropertiesResult> {
  // Validate input
  const validated = setLayoutPropertiesInputSchema.parse(input);

  // Track what was updated
  const updated: string[] = [];
  if (validated.layoutMode !== undefined) updated.push('layoutMode');
  if (validated.itemSpacing !== undefined) updated.push('itemSpacing');
  if (validated.padding !== undefined) updated.push('padding');
  if (validated.width !== undefined) updated.push('width');
  if (validated.height !== undefined) updated.push('height');

  if (updated.length === 0) {
    throw new Error('No properties specified to update');
  }

  // Generate CSS equivalent
  const cssEquivalent = generateCssEquivalent(validated);

  // Send to Figma
  const bridge = getFigmaBridge();
  await bridge.sendToFigma('set_layout_properties', {
    nodeId: validated.nodeId,
    layoutMode: validated.layoutMode,
    itemSpacing: validated.itemSpacing,
    padding: validated.padding,
    width: validated.width,
    height: validated.height
  });

  return {
    nodeId: validated.nodeId,
    updated,
    cssEquivalent
  };
}

/**
 * Tool definition for MCP
 */
export const setLayoutPropertiesToolDefinition = {
  name: 'set_layout_properties',
  description: `Updates layout properties on an existing frame in Figma.

Use this tool to modify auto-layout settings after a frame has been created.

HTML/CSS Analogy:
- layoutMode: Changes flex-direction (HORIZONTAL = row, VERTICAL = column, NONE = no flexbox)
- itemSpacing: Changes the 'gap' property between children
- padding: Changes the internal padding
- width/height: Changes dimensions

All spacing values must follow the 8pt grid: ${VALID_SPACING_VALUES.join(', ')}

Example:
To change a vertical stack to horizontal with 24px gap:
{
  nodeId: "frame-id",
  layoutMode: "HORIZONTAL",
  itemSpacing: 24
}

CSS equivalent: flex-direction: row; gap: 24px;`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the frame to modify'
      },
      layoutMode: {
        type: 'string' as const,
        enum: ['HORIZONTAL', 'VERTICAL', 'NONE'],
        description: 'Layout direction: HORIZONTAL (row), VERTICAL (column), or NONE (no auto-layout)'
      },
      itemSpacing: {
        type: 'number' as const,
        description: `Gap between children in pixels. Must be one of: ${VALID_SPACING_VALUES.join(', ')}`
      },
      padding: {
        type: 'number' as const,
        description: `Internal padding in pixels. Must be one of: ${VALID_SPACING_VALUES.join(', ')}`
      },
      width: {
        type: 'number' as const,
        description: 'Width in pixels'
      },
      height: {
        type: 'number' as const,
        description: 'Height in pixels'
      }
    },
    required: ['nodeId']
  }
};
