/**
 * Set Layout Properties Tool
 *
 * Updates layout properties on existing frames.
 * Allows modification of auto-layout settings after frame creation.
 */

import { z } from 'zod';
import { spacingSchema, VALID_SPACING_VALUES } from '../constraints/spacing.js';
import { FigmaAckResponseSchema, getFigmaBridge } from '../figma-bridge.js';
import { layoutModeSchema } from './create_frame.js';
import { defineHandler, textResponse } from '../routing/handler-utils.js';

/**
 * Input schema for set_layout_properties tool
 */
export const SetLayoutPropertiesInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the frame to modify'),
  layoutMode: layoutModeSchema.optional().describe('Layout direction'),
  itemSpacing: spacingSchema.optional().describe('Gap between children (8pt grid)'),
  padding: spacingSchema.optional().describe('Uniform internal padding (8pt grid)'),
  paddingTop: z.number().min(0).optional().describe('Top padding in pixels'),
  paddingRight: z.number().min(0).optional().describe('Right padding in pixels'),
  paddingBottom: z.number().min(0).optional().describe('Bottom padding in pixels'),
  paddingLeft: z.number().min(0).optional().describe('Left padding in pixels'),
  width: z.number().positive().optional().describe('Width in pixels'),
  height: z.number().positive().optional().describe('Height in pixels')
});

export type SetLayoutPropertiesInput = z.infer<typeof SetLayoutPropertiesInputSchema>;

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
 * @param input
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

  const hasIndividualPadding =
    input.paddingTop !== undefined ||
    input.paddingRight !== undefined ||
    input.paddingBottom !== undefined ||
    input.paddingLeft !== undefined;
  if (hasIndividualPadding) {
    updates.push(
      `padding: ${input.paddingTop ?? 0}px ${input.paddingRight ?? 0}px ${input.paddingBottom ?? 0}px ${input.paddingLeft ?? 0}px;`
    );
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
 * @param input
 */
export async function setLayoutProperties(
  input: SetLayoutPropertiesInput
): Promise<SetLayoutPropertiesResult> {
  // Track what was updated
  const updated: string[] = [];
  if (input.layoutMode !== undefined) {
    updated.push('layoutMode');
  }
  if (input.itemSpacing !== undefined) {
    updated.push('itemSpacing');
  }
  if (input.padding !== undefined) {
    updated.push('padding');
  }
  if (input.paddingTop !== undefined) updated.push('paddingTop');
  if (input.paddingRight !== undefined) updated.push('paddingRight');
  if (input.paddingBottom !== undefined) updated.push('paddingBottom');
  if (input.paddingLeft !== undefined) updated.push('paddingLeft');
  if (input.width !== undefined) {
    updated.push('width');
  }
  if (input.height !== undefined) {
    updated.push('height');
  }

  if (updated.length === 0) {
    throw new Error('No properties specified to update');
  }

  // Generate CSS equivalent
  const cssEquivalent = generateCssEquivalent(input);

  // Send to Figma
  const bridge = getFigmaBridge();
  await bridge.sendToFigmaValidated(
    'set_layout_properties',
    {
      nodeId: input.nodeId,
      layoutMode: input.layoutMode,
      itemSpacing: input.itemSpacing,
      padding: input.padding,
      paddingTop: input.paddingTop,
      paddingRight: input.paddingRight,
      paddingBottom: input.paddingBottom,
      paddingLeft: input.paddingLeft,
      width: input.width,
      height: input.height
    },
    FigmaAckResponseSchema
  );

  return {
    nodeId: input.nodeId,
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

WHEN TO USE THIS TOOL:
- Modifying layout on an EXISTING frame
- Changing spacing/padding after frame creation
- Adjusting dimensions of an existing container
- Switching layout direction (horizontal ↔ vertical)

DON'T use this for:
- New frame creation (use create_frame instead)
- Multi-element designs (use create_design with layout props)

ALTERNATIVE: Use create_design to set all properties at once:
{
  type: 'frame',
  props: { layoutMode: 'HORIZONTAL', itemSpacing: 24, padding: 16, ... },
  children: [...]
}

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
        description:
          'Layout direction: HORIZONTAL (row), VERTICAL (column), or NONE (no auto-layout)'
      },
      itemSpacing: {
        type: 'number' as const,
        description: `Gap between children in pixels. Must be one of: ${VALID_SPACING_VALUES.join(', ')}`
      },
      padding: {
        type: 'number' as const,
        description: `Uniform padding in pixels. Must be one of: ${VALID_SPACING_VALUES.join(', ')}`
      },
      paddingTop: {
        type: 'number' as const,
        description: 'Top padding in pixels (overrides uniform padding for top)'
      },
      paddingRight: {
        type: 'number' as const,
        description: 'Right padding in pixels (overrides uniform padding for right)'
      },
      paddingBottom: {
        type: 'number' as const,
        description: 'Bottom padding in pixels (overrides uniform padding for bottom)'
      },
      paddingLeft: {
        type: 'number' as const,
        description: 'Left padding in pixels (overrides uniform padding for left)'
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

export const handler = defineHandler<SetLayoutPropertiesInput, SetLayoutPropertiesResult>({
  name: 'set_layout_properties',
  schema: SetLayoutPropertiesInputSchema,
  execute: setLayoutProperties,
  formatResponse: (r) =>
    textResponse(
      `Layout Properties Updated\nNode ID: ${r.nodeId}\nUpdated Properties: ${r.updated.join(', ')}\n\nCSS Equivalent:\n  ${r.cssEquivalent}\n`
    ),
  definition: setLayoutPropertiesToolDefinition
});
