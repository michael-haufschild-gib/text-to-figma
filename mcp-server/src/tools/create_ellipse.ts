/**
 * MCP Tool: create_ellipse
 *
 * Creates an ellipse (circle or oval) shape.
 *
 * PRIMITIVE: Raw Figma shape primitive.
 * In Figma: figma.createEllipse()
 * Use for: circles, ovals, avatars, icons, decorative elements
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { getNodeRegistry } from '../node-registry.js';
import { defineHandler, textResponse } from '../routing/handler-utils.js';

/**
 * Input schema
 */
export const CreateEllipseInputSchema = z.object({
  width: z.number().positive().describe('Width of the ellipse in pixels'),
  height: z
    .number()
    .positive()
    .describe('Height of the ellipse in pixels (use same as width for perfect circle)'),
  name: z.string().optional().default('Ellipse').describe('Name for the ellipse node'),
  parentId: z.string().optional().describe('Parent frame ID (optional)'),
  fillColor: z.string().optional().describe('Fill color in hex format (e.g., #FF0000)'),
  strokeColor: z.string().optional().describe('Stroke color in hex format'),
  strokeWeight: z.number().optional().describe('Stroke width in pixels')
});

export type CreateEllipseInput = z.infer<typeof CreateEllipseInputSchema>;

/**
 * Tool definition
 */
export const createEllipseToolDefinition = {
  name: 'create_ellipse',
  description: `Creates an ellipse (circle or oval) shape.

PRIMITIVE: Raw Figma shape primitive - not a pre-made component.

RECOMMENDED WORKFLOW:
1. Option A (Multi-element): Use create_design to create ellipse + container together
2. Option B (Single ellipse):
   - Best practice: Create inside a parent frame for organization
   - Edge case: Can create at root for standalone decorative elements

WHEN TO USE THIS TOOL:
- Adding a single circle/oval to an existing design
- Creating avatars, icons, bullets, or decorative shapes
- Building UI step-by-step (for simple designs)

For designs with shapes + other elements, prefer create_design instead.

Perfect Circle: Set width = height
Oval: Set different width and height

Example - Avatar Circle:
create_ellipse({
  width: 48,
  height: 48,  // Same as width = perfect circle
  fillColor: "#E0E0E0",
  name: "Avatar",
  parentId: "container-id"  // ← Recommended for organization
})

Example - Decorative Oval:
create_ellipse({
  width: 120,
  height: 80,  // Different = oval
  fillColor: "#0066FF",
  name: "Oval Background"
})

CSS Equivalent:
border-radius: 50%; /* Makes any rectangle a circle/ellipse */`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      width: {
        type: 'number' as const,
        description: 'Width in pixels'
      },
      height: {
        type: 'number' as const,
        description: 'Height in pixels (same as width for circle)'
      },
      name: {
        type: 'string' as const,
        description: 'Name for the ellipse (default: "Ellipse")',
        default: 'Ellipse'
      },
      parentId: {
        type: 'string' as const,
        description:
          'Parent frame ID. RECOMMENDED: While technically optional, shapes should typically be placed inside frame containers for organized designs. Omit only for root-level decorative elements.'
      },
      fillColor: {
        type: 'string' as const,
        description: 'Fill color in hex (e.g., #FF0000)'
      },
      strokeColor: {
        type: 'string' as const,
        description: 'Stroke color in hex'
      },
      strokeWeight: {
        type: 'number' as const,
        description: 'Stroke width in pixels'
      }
    },
    required: ['width', 'height']
  }
};

/**
 * Result type
 */
export interface CreateEllipseResult {
  ellipseId: string;
  width: number;
  height: number;
  isCircle: boolean;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function createEllipse(input: CreateEllipseInput): Promise<CreateEllipseResult> {
  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma with response validation
  const response = await bridge.sendToFigmaValidated(
    'create_ellipse',
    {
      width: input.width,
      height: input.height,
      name: input.name,
      parentId: input.parentId,
      fillColor: input.fillColor,
      strokeColor: input.strokeColor,
      strokeWeight: input.strokeWeight
    },
    z.object({ nodeId: z.string() }).passthrough()
  );

  const isCircle = input.width === input.height;

  // Build CSS equivalent
  let cssEquivalent = `.${input.name.toLowerCase().replace(/\s+/g, '-')} {
  width: ${input.width}px;
  height: ${input.height}px;
  border-radius: 50%; /* Makes it ${isCircle ? 'a circle' : 'an ellipse'} */`;

  if (input.fillColor !== undefined) {
    cssEquivalent += `\n  background-color: ${input.fillColor};`;
  }

  if (input.strokeColor !== undefined && input.strokeWeight !== undefined) {
    cssEquivalent += `\n  border: ${input.strokeWeight}px solid ${input.strokeColor};`;
  }

  cssEquivalent += '\n}';

  // Register node in hierarchy registry
  const registry = getNodeRegistry();
  registry.register(response.nodeId, {
    type: 'ELLIPSE',
    name: input.name,
    parentId: input.parentId ?? null,
    children: [],
    bounds: { x: 0, y: 0, width: input.width, height: input.height }
  });

  return {
    ellipseId: response.nodeId,
    width: input.width,
    height: input.height,
    isCircle,
    cssEquivalent,
    message: `Created ${isCircle ? 'circle' : 'ellipse'} (${input.width}x${input.height})`
  };
}

export const handler = defineHandler<CreateEllipseInput, CreateEllipseResult>({
  name: 'create_ellipse',
  schema: CreateEllipseInputSchema,
  execute: createEllipse,
  formatResponse: (r) =>
    textResponse(
      `${r.message}\nEllipse ID: ${r.ellipseId}\nDimensions: ${r.width}x${r.height}\nIs Circle: ${r.isCircle}\n\nCSS Equivalent:\n${r.cssEquivalent}\n`
    ),
  definition: createEllipseToolDefinition
});
