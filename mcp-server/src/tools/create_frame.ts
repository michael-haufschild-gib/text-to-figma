/**
 * Create Frame Tool - HTML Analogy: <div> container
 *
 * Creates a new frame in Figma with layout properties.
 * Frames in Figma are similar to <div> elements in HTML with flexbox layout.
 */

import { z } from 'zod';
import { spacingSchema, VALID_SPACING_VALUES } from '../constraints/spacing.js';
import { FigmaAPIError, NetworkError, ValidationError, wrapError } from '../errors/index.js';
import { getFigmaBridge } from '../figma-bridge.js';
import { getLogger } from '../monitoring/logger.js';
import { getNodeRegistry } from '../node-registry.js';
import { formatValidationError, validateParentRelationship } from '../utils/parent-validator.js';

const logger = getLogger().child({ tool: 'create_frame' });

/**
 * Layout modes for frames
 * - HORIZONTAL: Similar to `flex-direction: row`
 * - VERTICAL: Similar to `flex-direction: column`
 * - NONE: No auto-layout (absolute positioning)
 */
export const layoutModeSchema = z.enum(['HORIZONTAL', 'VERTICAL', 'NONE']);

export type LayoutMode = z.infer<typeof layoutModeSchema>;

/**
 * Layout sizing modes (how elements behave in auto-layout)
 * - FILL: Fill available space (like `width: 100%` or `flex: 1`)
 * - HUG: Wrap content (like `width: fit-content`)
 * - FIXED: Fixed size (like `width: 400px`)
 */
export const layoutSizingSchema = z.enum(['FILL', 'HUG', 'FIXED']).optional();

export type LayoutSizing = z.infer<typeof layoutSizingSchema>;

/**
 * Input schema for create_frame tool
 */
export const CreateFrameInputSchema = z.object({
  name: z.string().min(1).describe('Name of the frame'),
  width: z.number().positive().optional().describe('Width in pixels (optional for auto-layout)'),
  height: z.number().positive().optional().describe('Height in pixels (optional for auto-layout)'),
  layoutMode: layoutModeSchema.default('VERTICAL').describe('Layout direction'),
  itemSpacing: spacingSchema.default(16).describe('Gap between children (like CSS gap property)'),
  padding: spacingSchema.default(16).describe('Internal padding (like CSS padding property)'),
  parentId: z.string().optional().describe('Parent frame ID to nest this frame inside'),
  horizontalSizing: layoutSizingSchema.describe(
    'How width behaves (FILL = 100%, HUG = fit-content, FIXED = explicit width)'
  ),
  verticalSizing: layoutSizingSchema.describe(
    'How height behaves (FILL = 100%, HUG = fit-content, FIXED = explicit height)'
  )
});

export type CreateFrameInput = z.infer<typeof CreateFrameInputSchema>;

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
 * @param input
 */
function generateHtmlAnalogy(input: CreateFrameInput): {
  htmlAnalogy: string;
  cssEquivalent: string;
} {
  const flexDirection =
    input.layoutMode === 'HORIZONTAL' ? 'row' : input.layoutMode === 'VERTICAL' ? 'column' : 'none';

  const htmlAnalogy =
    input.layoutMode === 'NONE'
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
 * Creates a frame in Figma with comprehensive error handling, logging, and metrics
 *
 * @param input - Frame creation parameters
 * @returns Frame creation result with ID and HTML/CSS analogies
 * @throws {ValidationError} When input validation fails
 * @throws {FigmaAPIError} When Figma operation fails
 * @throws {NetworkError} When communication with Figma bridge fails
 *
 * @example
 * ```typescript
 * const frame = await createFrame({
 *   name: 'Button Container',
 *   layoutMode: 'HORIZONTAL',
 *   itemSpacing: 16,
 *   padding: 24
 * });
 * console.log(frame.frameId); // "123:456"
 * ```
 */
export async function createFrame(input: CreateFrameInput): Promise<CreateFrameResult> {
  logger.info('Creating frame', { input });

  // Input is already validated by the routing layer (tool-router.ts)
  const validated = input;

  // Validate parent relationship if parentId provided
  if (validated.parentId) {
    const parentValidation = await validateParentRelationship('frame', validated.parentId, {
      strict: true,
      checkExists: true
    });

    if (!parentValidation.isValid) {
      throw new ValidationError(
        formatValidationError(parentValidation),
        'create_frame',
        validated,
        [{ message: parentValidation.error || 'Parent validation failed' }]
      );
    }
  }

  // Generate HTML analogy
  const { htmlAnalogy, cssEquivalent } = generateHtmlAnalogy(validated);

  // Send to Figma
  const bridge = getFigmaBridge();
  let response: { nodeId: string };

  try {
    response = await bridge.sendToFigmaWithRetry<{ nodeId: string }>('create_frame', {
      name: validated.name,
      width: validated.width,
      height: validated.height,
      layoutMode: validated.layoutMode,
      itemSpacing: validated.itemSpacing,
      padding: validated.padding,
      parentId: validated.parentId,
      horizontalSizing: validated.horizontalSizing,
      verticalSizing: validated.verticalSizing
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Not connected') || error.message.includes('Connection')) {
        throw new NetworkError(
          'Failed to communicate with Figma',
          'create_frame',
          'figma-bridge',
          validated,
          error
        );
      }
      throw new FigmaAPIError(
        'Figma frame creation failed',
        'create_frame',
        'create_frame',
        validated,
        error
      );
    }
    throw wrapError(error, 'create_frame', validated);
  }

  // Register node in hierarchy registry
  const registry = getNodeRegistry();
  registry.register(response.nodeId, {
    type: 'FRAME',
    name: validated.name,
    parentId: validated.parentId || null,
    children: [],
    bounds:
      validated.width && validated.height
        ? { x: 0, y: 0, width: validated.width, height: validated.height }
        : undefined
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
  description: `[TIER 2 - ESSENTIAL] ⭐ Core building block for single containers

Creates a new frame in Figma with auto-layout properties.

HTML Analogy: A frame is like a <div> container with flexbox layout.

📋 RECOMMENDED WORKFLOW:
1. Use get_page_hierarchy to understand current structure
2. Option A (Multi-element design): Use create_design for entire hierarchy at once
3. Option B (Single frame creation):
   - First frame: create_frame with NO parentId (creates root container)
   - Nested frames: create_frame WITH parentId (nests inside parent)

🎯 WHEN TO USE THIS TOOL:
- Creating a single, isolated frame container
- Adding one container to an existing design structure
- Building layouts step-by-step (for simple designs)

⚠️ For designs with 2+ elements, prefer create_design instead (faster, atomic, no coordination issues).

🚨 CRITICAL HIERARCHY RULE (Think Like HTML):
- In HTML, you don't create dozens of <div>s as direct children of <body>
- Instead, you create a ROOT container, then nest children inside it
- FIRST create a parent frame (no parentId), THEN create children (with parentId)
- Avoid creating multiple root-level frames - maintain a clear hierarchy!

Layout Modes:
- HORIZONTAL: Similar to flex-direction: row (children arranged left-to-right)
- VERTICAL: Similar to flex-direction: column (children arranged top-to-bottom)
- NONE: No auto-layout (children positioned absolutely)

Properties:
- itemSpacing: Like CSS 'gap' property - space between children (must use 8pt grid)
- padding: Like CSS 'padding' property - internal spacing (must use 8pt grid)

Valid spacing values (8pt grid): ${VALID_SPACING_VALUES.join(', ')}

Example Workflow (HTML-like):
1. Create root container: create_frame({ name: "Page", layoutMode: "VERTICAL" })
2. Create children INSIDE root: create_frame({ name: "Header", parentId: "root-id", ... })
3. Add content to children: create_text({ content: "Title", parentId: "header-id" })

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
        description:
          'Layout direction: HORIZONTAL (flex-direction: row), VERTICAL (flex-direction: column), or NONE (no auto-layout)'
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
        description:
          'Parent frame ID to nest this frame inside. OMIT for root-level containers (first frame in your design). PROVIDE for all nested frames. Tip: Create root container first, then nest children inside with parentId.'
      },
      horizontalSizing: {
        type: 'string' as const,
        enum: ['FILL', 'HUG', 'FIXED'],
        description:
          'How width behaves: FILL (width: 100%), HUG (width: fit-content), FIXED (explicit width). If not specified, defaults based on context.'
      },
      verticalSizing: {
        type: 'string' as const,
        enum: ['FILL', 'HUG', 'FIXED'],
        description:
          'How height behaves: FILL (height: 100%), HUG (height: fit-content), FIXED (explicit height). If not specified, defaults based on context.'
      }
    },
    required: ['name']
  },
  metadata: {
    tier: 2,
    category: 'creation',
    usageFrequency: 'high',
    complexity: 'simple',
    tags: ['container', 'layout', 'primitive']
  }
};
