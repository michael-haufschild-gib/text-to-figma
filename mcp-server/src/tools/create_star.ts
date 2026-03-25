/**
 * MCP Tool: create_star
 *
 * Creates a star shape with configurable points.
 *
 * PRIMITIVE: Raw Figma star primitive.
 * In Figma: figma.createStar()
 * Use for: ratings, decorations, badges, icons
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { getNodeRegistry } from '../node-registry.js';
import { defineHandler, textResponse } from '../routing/handler-utils.js';

/**
 * Input schema
 */
export const CreateStarInputSchema = z.object({
  pointCount: z
    .number()
    .int()
    .min(3)
    .max(100)
    .optional()
    .default(5)
    .describe('Number of star points (default: 5)'),
  radius: z.number().positive().describe('Radius of outer points in pixels'),
  innerRadius: z
    .number()
    .positive()
    .optional()
    .describe('Radius of inner points (if not provided, calculated as radius * 0.382)'),
  name: z.string().optional().default('Star').describe('Name for the star node'),
  parentId: z.string().optional().describe('Parent frame ID (optional)'),
  fillColor: z.string().optional().describe('Fill color in hex format'),
  strokeColor: z.string().optional().describe('Stroke color in hex format'),
  strokeWeight: z.number().optional().describe('Stroke width in pixels')
});

export type CreateStarInput = z.infer<typeof CreateStarInputSchema>;

/**
 * Tool definition
 */
export const createStarToolDefinition = {
  name: 'create_star',
  description: `Creates a star shape with configurable points.

PRIMITIVE: Raw Figma star primitive - not a pre-made component.
Use for: ratings (★★★★★), decorations, badges, icons, burst shapes.

Point Count:
- 5 points = Classic star (most common)
- 6 points = Star of David / Hexagram
- 8 points = Compass rose / Starburst
- 4 points = Cross/Plus shape

Example - Rating Star:
create_star({
  pointCount: 5,
  radius: 24,
  fillColor: "#FFD700",
  name: "Rating Star"
})

Example - Starburst:
create_star({
  pointCount: 12,
  radius: 60,
  innerRadius: 20,
  fillColor: "#FF6B00",
  name: "Starburst"
})

CSS Equivalent:
/* Requires SVG or clip-path */
clip-path: polygon(/* star points */);`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      pointCount: {
        type: 'number' as const,
        description: 'Number of star points (default: 5)'
      },
      radius: {
        type: 'number' as const,
        description: 'Radius of outer points in pixels'
      },
      innerRadius: {
        type: 'number' as const,
        description: 'Radius of inner points (optional, default: radius * 0.382)'
      },
      name: {
        type: 'string' as const,
        description: 'Name for the star (default: "Star")',
        default: 'Star'
      },
      parentId: {
        type: 'string' as const,
        description: 'Parent frame ID (optional)'
      },
      fillColor: {
        type: 'string' as const,
        description: 'Fill color in hex (e.g., #FFD700)'
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
    required: ['radius']
  }
};

/**
 * Result type
 */
export interface CreateStarResult {
  starId: string;
  pointCount: number;
  radius: number;
  innerRadius: number;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function createStar(input: CreateStarInput): Promise<CreateStarResult> {
  // Calculate inner radius if not provided (golden ratio approximation)
  const innerRadius = input.innerRadius ?? input.radius * 0.382;

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma with response validation
  const response = await bridge.sendToFigmaValidated(
    'create_star',
    {
      pointCount: input.pointCount,
      radius: input.radius,
      innerRadius,
      name: input.name,
      parentId: input.parentId,
      fillColor: input.fillColor,
      strokeColor: input.strokeColor,
      strokeWeight: input.strokeWeight
    },
    z.object({ nodeId: z.string() }).passthrough()
  );

  // Build CSS equivalent
  const cssEquivalent = `/* ${input.pointCount}-point star requires SVG or clip-path */
.${input.name.toLowerCase().replace(/\s+/g, '-')} {
  width: ${input.radius * 2}px;
  height: ${input.radius * 2}px;
  clip-path: polygon(/* ${input.pointCount * 2} vertices */);
  ${input.fillColor ? `background-color: ${input.fillColor};` : ''}
}

/* For rating stars, consider using Unicode: ★ (U+2605) or SVG */`;

  const registry = getNodeRegistry();
  registry.register(response.nodeId, {
    type: 'STAR',
    name: input.name,
    parentId: input.parentId ?? null,
    children: [],
    bounds: { x: 0, y: 0, width: input.radius * 2, height: input.radius * 2 }
  });

  return {
    starId: response.nodeId,
    pointCount: input.pointCount,
    radius: input.radius,
    innerRadius,
    cssEquivalent,
    message: `Created ${input.pointCount}-point star (radius: ${input.radius}px, inner: ${innerRadius}px)`
  };
}

export const handler = defineHandler<CreateStarInput, CreateStarResult>({
  name: 'create_star',
  schema: CreateStarInputSchema,
  execute: createStar,
  formatResponse: (r) =>
    textResponse(
      `${r.message}\nStar ID: ${r.starId}\nPoints: ${r.pointCount}\nRadius: ${r.radius}px (inner: ${r.innerRadius}px)\n\nCSS Equivalent:\n${r.cssEquivalent}\n`
    ),
  definition: createStarToolDefinition
});
