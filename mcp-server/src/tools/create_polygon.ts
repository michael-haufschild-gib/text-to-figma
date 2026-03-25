/**
 * MCP Tool: create_polygon
 *
 * Creates a polygon shape with N sides.
 *
 * PRIMITIVE: Raw Figma polygon primitive.
 * In Figma: figma.createPolygon()
 * Use for: triangles, pentagons, hexagons, octagons, stop signs, etc.
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { getNodeRegistry } from '../node-registry.js';
import { defineHandler, textResponse } from '../routing/handler-utils.js';

/**
 * Input schema
 */
export const CreatePolygonInputSchema = z.object({
  sideCount: z
    .number()
    .int()
    .min(3)
    .max(100)
    .describe('Number of sides (3=triangle, 4=diamond, 5=pentagon, 6=hexagon, 8=octagon)'),
  radius: z.number().positive().describe('Radius from center to vertices in pixels'),
  name: z.string().optional().default('Polygon').describe('Name for the polygon node'),
  parentId: z.string().optional().describe('Parent frame ID (optional)'),
  fillColor: z.string().optional().describe('Fill color in hex format'),
  strokeColor: z.string().optional().describe('Stroke color in hex format'),
  strokeWeight: z.number().optional().describe('Stroke width in pixels')
});

export type CreatePolygonInput = z.infer<typeof CreatePolygonInputSchema>;

/**
 * Tool definition
 */
export const createPolygonToolDefinition = {
  name: 'create_polygon',
  description: `Creates a polygon shape with N sides.

PRIMITIVE: Raw Figma polygon primitive - not a pre-made component.
Use for: triangles, diamonds, pentagons, hexagons, octagons, stop signs, badges, icons.

Common Polygons:
- 3 sides = Triangle
- 4 sides = Diamond/Square (rotated 45°)
- 5 sides = Pentagon
- 6 sides = Hexagon
- 8 sides = Octagon

Example - Triangle:
create_polygon({
  sideCount: 3,
  radius: 50,
  fillColor: "#FF0000",
  name: "Triangle"
})

Example - Hexagon:
create_polygon({
  sideCount: 6,
  radius: 60,
  fillColor: "#0066FF",
  strokeColor: "#003399",
  strokeWeight: 2,
  name: "Hexagon Badge"
})

CSS Equivalent:
/* Requires clip-path or SVG */
clip-path: polygon(...);`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      sideCount: {
        type: 'number' as const,
        description: 'Number of sides (3=triangle, 6=hexagon, etc.)'
      },
      radius: {
        type: 'number' as const,
        description: 'Radius from center to vertices in pixels'
      },
      name: {
        type: 'string' as const,
        description: 'Name for the polygon (default: "Polygon")',
        default: 'Polygon'
      },
      parentId: {
        type: 'string' as const,
        description: 'Parent frame ID (optional)'
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
    required: ['sideCount', 'radius']
  }
};

/**
 * Result type
 */
export interface CreatePolygonResult {
  polygonId: string;
  sideCount: number;
  radius: number;
  polygonType: string;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function createPolygon(input: CreatePolygonInput): Promise<CreatePolygonResult> {
  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma with response validation
  const response = await bridge.sendToFigmaValidated(
    'create_polygon',
    {
      sideCount: input.sideCount,
      radius: input.radius,
      name: input.name,
      parentId: input.parentId,
      fillColor: input.fillColor,
      strokeColor: input.strokeColor,
      strokeWeight: input.strokeWeight
    },
    z.object({ nodeId: z.string() }).passthrough()
  );

  // Determine polygon type
  const polygonTypes: Record<number, string> = {
    3: 'triangle',
    4: 'diamond',
    5: 'pentagon',
    6: 'hexagon',
    8: 'octagon'
  };
  const polygonType = polygonTypes[input.sideCount] ?? `${input.sideCount}-sided polygon`;

  // Build CSS equivalent (simplified - actual implementation would need SVG)
  const cssEquivalent = `/* ${input.sideCount}-sided polygon requires SVG or clip-path */
.${input.name.toLowerCase().replace(/\s+/g, '-')} {
  width: ${input.radius * 2}px;
  height: ${input.radius * 2}px;
  clip-path: polygon(/* ${input.sideCount} vertices */);
  ${input.fillColor ? `background-color: ${input.fillColor};` : ''}
}`;

  const registry = getNodeRegistry();
  registry.register(response.nodeId, {
    type: 'POLYGON',
    name: input.name,
    parentId: input.parentId ?? null,
    children: [],
    bounds: { x: 0, y: 0, width: input.radius * 2, height: input.radius * 2 }
  });

  return {
    polygonId: response.nodeId,
    sideCount: input.sideCount,
    radius: input.radius,
    polygonType,
    cssEquivalent,
    message: `Created ${polygonType} with ${input.sideCount} sides (radius: ${input.radius}px)`
  };
}

export const handler = defineHandler<CreatePolygonInput, CreatePolygonResult>({
  name: 'create_polygon',
  schema: CreatePolygonInputSchema,
  execute: createPolygon,
  formatResponse: (r) =>
    textResponse(
      `${r.message}\nPolygon ID: ${r.polygonId}\nType: ${r.polygonType}\nSides: ${r.sideCount}\n\nCSS Equivalent:\n${r.cssEquivalent}\n`
    ),
  definition: createPolygonToolDefinition
});
