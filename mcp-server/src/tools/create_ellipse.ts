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

📋 RECOMMENDED WORKFLOW:
1. Option A (Multi-element): Use create_design to create ellipse + container together
2. Option B (Single ellipse):
   - Best practice: Create inside a parent frame for organization
   - Edge case: Can create at root for standalone decorative elements

🎯 WHEN TO USE THIS TOOL:
- Adding a single circle/oval to an existing design
- Creating avatars, icons, bullets, or decorative shapes
- Building UI step-by-step (for simple designs)

⚠️ For designs with shapes + other elements, prefer create_design instead.

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
  // Validate input
  const validated = input;

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma with response validation
  const response = await bridge.sendToFigmaValidated(
    'create_ellipse',
    {
      width: validated.width,
      height: validated.height,
      name: validated.name,
      parentId: validated.parentId,
      fillColor: validated.fillColor,
      strokeColor: validated.strokeColor,
      strokeWeight: validated.strokeWeight
    },
    z.object({ nodeId: z.string().optional(), error: z.string().optional() })
  );

  const isCircle = validated.width === validated.height;

  // Build CSS equivalent
  let cssEquivalent = `.${validated.name.toLowerCase().replace(/\s+/g, '-')} {
  width: ${validated.width}px;
  height: ${validated.height}px;
  border-radius: 50%; /* Makes it ${isCircle ? 'a circle' : 'an ellipse'} */`;

  if (validated.fillColor !== undefined) {
    cssEquivalent += `\n  background-color: ${validated.fillColor};`;
  }

  if (validated.strokeColor !== undefined && validated.strokeWeight !== undefined) {
    cssEquivalent += `\n  border: ${validated.strokeWeight}px solid ${validated.strokeColor};`;
  }

  cssEquivalent += '\n}';

  // Register node in hierarchy registry
  if (response.nodeId) {
    const registry = getNodeRegistry();
    registry.register(response.nodeId, {
      type: 'ELLIPSE',
      name: validated.name,
      parentId: validated.parentId ?? null,
      children: [],
      bounds: { x: 0, y: 0, width: validated.width, height: validated.height }
    });
  }

  return {
    ellipseId: response.nodeId ?? '',
    width: validated.width,
    height: validated.height,
    isCircle,
    cssEquivalent,
    message: `Created ${isCircle ? 'circle' : 'ellipse'} (${validated.width}x${validated.height})`
  };
}
