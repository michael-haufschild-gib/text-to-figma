/**
 * Create Frame Tool - HTML Analogy: <div> container
 *
 * Creates a new frame in Figma with layout properties.
 * Frames in Figma are similar to <div> elements in HTML with flexbox layout.
 */

import { z } from 'zod';
import { spacingSchema, VALID_SPACING_VALUES } from '../constraints/spacing.js';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Layout modes for frames
 * - HORIZONTAL: Similar to `flex-direction: row`
 * - VERTICAL: Similar to `flex-direction: column`
 * - NONE: No auto-layout (absolute positioning)
 */
export const layoutModeSchema = z.enum(['HORIZONTAL', 'VERTICAL', 'NONE']);

export type LayoutMode = z.infer<typeof layoutModeSchema>;

/**
 * Input schema for create_frame tool
 */
export const createFrameInputSchema = z.object({
  name: z.string().min(1).describe('Name of the frame'),
  width: z.number().positive().optional().describe('Width in pixels (optional for auto-layout)'),
  height: z.number().positive().optional().describe('Height in pixels (optional for auto-layout)'),
  layoutMode: layoutModeSchema.default('VERTICAL').describe('Layout direction'),
  itemSpacing: spacingSchema.default(16).describe('Gap between children (like CSS gap property)'),
  padding: spacingSchema.default(16).describe('Internal padding (like CSS padding property)'),
  parentId: z.string().optional().describe('Parent frame ID to nest this frame inside')
});

export type CreateFrameInput = z.infer<typeof createFrameInputSchema>;

/**
 * Result of creating a frame
 */
export interface CreateFrameResult {
  frameId: string;
  htmlAnalogy: string;
  cssEquivalent: string;
}

/**
 * Generates HTML/CSS analogy for the frame configuration
 */
function generateHtmlAnalogy(input: CreateFrameInput): { htmlAnalogy: string; cssEquivalent: string } {
  const flexDirection = input.layoutMode === 'HORIZONTAL' ? 'row' :
                       input.layoutMode === 'VERTICAL' ? 'column' : 'none';

  const htmlAnalogy = input.layoutMode === 'NONE'
    ? `<div class="${input.name}"> (absolute positioning, no flexbox)`
    : `<div class="${input.name}"> with flexbox layout`;

  let cssEquivalent = '';
  if (input.layoutMode !== 'NONE') {
    cssEquivalent = `.${input.name} {
  display: flex;
  flex-direction: ${flexDirection};
  gap: ${input.itemSpacing}px;
  padding: ${input.padding}px;`;

    if (input.width) {
      cssEquivalent += `\n  width: ${input.width}px;`;
    }
    if (input.height) {
      cssEquivalent += `\n  height: ${input.height}px;`;
    }
    cssEquivalent += '\n}';
  } else {
    cssEquivalent = `.${input.name} {
  position: relative;${input.width ? `\n  width: ${input.width}px;` : ''}${input.height ? `\n  height: ${input.height}px;` : ''}
}`;
  }

  return { htmlAnalogy, cssEquivalent };
}

/**
 * Creates a frame in Figma
 */
export async function createFrame(input: CreateFrameInput): Promise<CreateFrameResult> {
  // Validate input
  const validated = createFrameInputSchema.parse(input);

  // Generate HTML analogy
  const { htmlAnalogy, cssEquivalent } = generateHtmlAnalogy(validated);

  // Send to Figma
  const bridge = getFigmaBridge();
  const response = await bridge.sendToFigma<{ nodeId: string }>('create_frame', {
    name: validated.name,
    width: validated.width,
    height: validated.height,
    layoutMode: validated.layoutMode,
    itemSpacing: validated.itemSpacing,
    padding: validated.padding,
    parentId: validated.parentId
  });

  return {
    frameId: response.nodeId,
    htmlAnalogy,
    cssEquivalent
  };
}

/**
 * Tool definition for MCP
 */
export const createFrameToolDefinition = {
  name: 'create_frame',
  description: `Creates a new frame in Figma with auto-layout properties.

HTML Analogy: A frame is like a <div> container with flexbox layout.

Layout Modes:
- HORIZONTAL: Similar to flex-direction: row (children arranged left-to-right)
- VERTICAL: Similar to flex-direction: column (children arranged top-to-bottom)
- NONE: No auto-layout (children positioned absolutely)

Properties:
- itemSpacing: Like CSS 'gap' property - space between children (must use 8pt grid)
- padding: Like CSS 'padding' property - internal spacing (must use 8pt grid)

Valid spacing values (8pt grid): ${VALID_SPACING_VALUES.join(', ')}

Example:
- layoutMode: VERTICAL, itemSpacing: 16, padding: 24
  → CSS equivalent: display: flex; flex-direction: column; gap: 16px; padding: 24px;`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string' as const,
        description: 'Name of the frame'
      },
      width: {
        type: 'number' as const,
        description: 'Width in pixels (optional for auto-layout frames)'
      },
      height: {
        type: 'number' as const,
        description: 'Height in pixels (optional for auto-layout frames)'
      },
      layoutMode: {
        type: 'string' as const,
        enum: ['HORIZONTAL', 'VERTICAL', 'NONE'],
        description: 'Layout direction: HORIZONTAL (flex-direction: row), VERTICAL (flex-direction: column), or NONE (no auto-layout)'
      },
      itemSpacing: {
        type: 'number' as const,
        description: `Gap between children in pixels (like CSS gap). Must be one of: ${VALID_SPACING_VALUES.join(', ')}`
      },
      padding: {
        type: 'number' as const,
        description: `Internal padding in pixels (like CSS padding). Must be one of: ${VALID_SPACING_VALUES.join(', ')}`
      },
      parentId: {
        type: 'string' as const,
        description: 'Optional parent frame ID to nest this frame inside'
      }
    },
    required: ['name']
  }
};
