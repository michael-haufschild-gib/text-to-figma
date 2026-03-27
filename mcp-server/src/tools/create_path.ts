/**
 * MCP Tool: create_path
 *
 * Creates a custom vector path using Bezier curves, arc segments, and line segments.
 * Supports both structured command arrays and raw SVG path strings.
 *
 * PRIMITIVE: Raw Figma vector network primitive.
 * Use for: custom shapes, organic forms, smooth curves, complex illustrations
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { getNodeRegistry } from '../node-registry.js';
import {
  formatRepairReport,
  repairPathCommands,
  type PathCommand as RepairedPathCommand,
  type RawPathCommand
} from './utils/path-command-repair.js';
import { defineHandler, textResponse } from '../routing/handler-utils.js';

/**
 * Path command types (SVG-like)
 */
export const PathCommandSchema = z.discriminatedUnion('type', [
  // Move to point (start of path or new subpath)
  z.object({
    type: z.literal('M'),
    x: z.number(),
    y: z.number()
  }),

  // Line to point
  z.object({
    type: z.literal('L'),
    x: z.number(),
    y: z.number()
  }),

  // Cubic Bezier curve
  z.object({
    type: z.literal('C'),
    x1: z.number(), // First control point X
    y1: z.number(), // First control point Y
    x2: z.number(), // Second control point X
    y2: z.number(), // Second control point Y
    x: z.number(), // End point X
    y: z.number() // End point Y
  }),

  // Quadratic Bezier curve
  z.object({
    type: z.literal('Q'),
    x1: z.number(), // Control point X
    y1: z.number(), // Control point Y
    x: z.number(), // End point X
    y: z.number() // End point Y
  }),

  // Elliptical arc
  z.object({
    type: z.literal('A'),
    rx: z.number(), // X radius
    ry: z.number(), // Y radius
    rotation: z.number(), // X-axis rotation in degrees
    largeArcFlag: z.number(), // 0 or 1
    sweepFlag: z.number(), // 0 or 1
    x: z.number(), // End point X
    y: z.number() // End point Y
  }),

  // Close path (connect back to start)
  z.object({
    type: z.literal('Z')
  })
]);

export type PathCommand = z.infer<typeof PathCommandSchema>;

// Note: Path command normalization and repair is now handled by
// the intelligent repair system in utils/path-command-repair.ts
// which provides better error messages and automatic fixes.

/**
 * Input schema
 *
 * Either `commands` or `svgPath` must be provided. When `svgPath` is given,
 * the raw SVG path data string is sent directly to Figma, bypassing command
 * repair. This enables importing paths from external vectorization tools.
 */
export const CreatePathInputSchema = z
  .object({
    name: z.string().optional().describe('Name for the path (default: "Path")'),
    x: z.number().optional().describe('X position of the path node (default: 0)'),
    y: z.number().optional().describe('Y position of the path node (default: 0)'),
    commands: z
      .array(z.custom<RawPathCommand>())
      .optional()
      .describe('Array of path commands (M, L, C, Q, A, Z)'),
    svgPath: z
      .string()
      .optional()
      .describe(
        'Raw SVG path d attribute string — alternative to commands array. Example: "M 10 20 L 100 200 Z"'
      ),
    fillColor: z.string().optional().describe('Fill color in hex format'),
    fillOpacity: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Fill opacity from 0 (transparent) to 1 (opaque)'),
    strokeColor: z.string().optional().describe('Stroke color in hex format'),
    strokeWeight: z.number().optional().describe('Stroke width in pixels'),
    closed: z
      .boolean()
      .optional()
      .describe('Whether to close the path automatically (default: false)'),
    parentId: z.string().optional().describe('Parent frame ID (optional)')
  })
  .refine(
    (data) =>
      (data.commands !== undefined && data.commands.length >= 2) ||
      (data.svgPath !== undefined && data.svgPath.trim().length > 0),
    { message: 'Either "commands" (min 2) or "svgPath" must be provided' }
  );

export type CreatePathInput = z.infer<typeof CreatePathInputSchema>;

/**
 * Tool definition
 */
export const createPathToolDefinition = {
  name: 'create_path',
  description: `Creates a custom vector path using Bezier curves, arcs, and line segments.

PRIMITIVE: Raw Figma vector network primitive - not a pre-made component.
Use for: organic shapes, smooth curves, custom illustrations, logos, characters.

TWO INPUT MODES:
1. Command array: Structured path commands (M, L, C, Q, A, Z)
2. SVG path string: Raw SVG d attribute (e.g., "M 10 20 C 30 40 50 60 70 80 Z")

Path Commands (SVG-like syntax):
- M (Move): Move to point { type: 'M', x: 100, y: 100 }
- L (Line): Draw line to point { type: 'L', x: 200, y: 100 }
- C (Cubic Bezier): Smooth curve { type: 'C', x1: cp1x, y1: cp1y, x2: cp2x, y2: cp2y, x: endx, y: endy }
- Q (Quadratic Bezier): Simple curve { type: 'Q', x1: cpx, y1: cpy, x: endx, y: endy }
- A (Arc): Elliptical arc { type: 'A', rx: 50, ry: 50, rotation: 0, largeArcFlag: 1, sweepFlag: 1, x: endx, y: endy }
- Z (Close): Close path back to start { type: 'Z' }

Positioning:
- x/y sets the node position on the canvas. Path coordinates are relative to the node origin.
- If omitted, the node is placed at (0, 0) within its parent.

Example - Using command array:
create_path({
  name: "Horse Body",
  x: 200,
  y: 100,
  commands: [
    { type: 'M', x: 0, y: 0 },
    { type: 'C', x1: 50, y1: -50, x2: 150, y2: -50, x: 200, y: -20 },
    { type: 'Z' }
  ],
  fillColor: "#8B4513"
})

Example - Using SVG path string:
create_path({
  name: "Imported Shape",
  svgPath: "M 100 200 C 150 150 250 150 300 180 Z",
  fillColor: "#8B4513"
})

Example - Arc command (semicircle):
create_path({
  name: "Semicircle",
  commands: [
    { type: 'M', x: 0, y: 50 },
    { type: 'A', rx: 50, ry: 50, rotation: 0, largeArcFlag: 1, sweepFlag: 1, x: 100, y: 50 },
    { type: 'Z' }
  ],
  fillColor: "#0066FF"
})

Example - With fill opacity:
create_path({
  name: "Semi-transparent overlay",
  svgPath: "M 0 0 L 100 0 L 100 100 L 0 100 Z",
  fillColor: "#000000",
  fillOpacity: 0.3
})`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string' as const,
        description: 'Name for the path (default: "Path")'
      },
      x: {
        type: 'number' as const,
        description: 'X position of the path node (default: 0)'
      },
      y: {
        type: 'number' as const,
        description: 'Y position of the path node (default: 0)'
      },
      commands: {
        type: 'array' as const,
        description: 'Array of path commands (M, L, C, Q, A, Z)',
        items: {
          type: 'object' as const
        }
      },
      svgPath: {
        type: 'string' as const,
        description:
          'Raw SVG path d attribute string — alternative to commands. Example: "M 10 20 L 100 200 Z"'
      },
      fillColor: {
        type: 'string' as const,
        description: 'Fill color in hex format'
      },
      fillOpacity: {
        type: 'number' as const,
        description: 'Fill opacity 0-1 (default: 1)',
        minimum: 0,
        maximum: 1
      },
      strokeColor: {
        type: 'string' as const,
        description: 'Stroke color in hex format'
      },
      strokeWeight: {
        type: 'number' as const,
        description: 'Stroke width in pixels'
      },
      closed: {
        type: 'boolean' as const,
        description: 'Whether to close the path automatically (default: false)'
      },
      parentId: {
        type: 'string' as const,
        description: 'Parent frame ID (optional)'
      }
    },
    required: [] as string[]
  }
};

/**
 * Response schema for Figma bridge create_path response
 */
const CreatePathResponseSchema = z
  .object({
    pathId: z.string().optional(),
    message: z.string().optional()
  })
  .passthrough();

/**
 * Result type
 */
export interface CreatePathResult {
  pathId: string;
  name: string;
  commandCount: number;
  closed: boolean;
  message: string;
}

/**
 * Implementation
 */
export async function createPath(input: CreatePathInput): Promise<CreatePathResult> {
  let normalizedCommands: RepairedPathCommand[] | undefined;
  let repairMessage = '';
  let svgPathData: string | undefined;

  if (input.svgPath !== undefined) {
    // Direct SVG path string — pass through to plugin without repair
    svgPathData = input.svgPath.trim();
    if (svgPathData === '') {
      throw new Error('svgPath cannot be empty');
    }
  } else if (input.commands !== undefined && input.commands.length >= 2) {
    // Command array — use intelligent repair system
    try {
      const repairReport = repairPathCommands(input.commands);
      normalizedCommands = repairReport.commands;

      if (repairReport.totalFixed > 0) {
        repairMessage = '\n\n' + formatRepairReport(repairReport);
        console.error(`[create_path] Applied automatic repairs:\n${repairMessage}`);
      }
    } catch (repairError) {
      const errMsg = repairError instanceof Error ? repairError.message : String(repairError);
      throw new Error(`Path command validation failed:\n\n${errMsg}`);
    }
  } else {
    throw new Error('Either "commands" (min 2) or "svgPath" must be provided');
  }

  const bridge = getFigmaBridge();
  const name = input.name ?? 'Path';
  const closed = input.closed ?? false;

  const response = await bridge.sendToFigmaValidated(
    'create_path',
    {
      name,
      x: input.x,
      y: input.y,
      commands: normalizedCommands,
      svgPath: svgPathData,
      fillColor: input.fillColor,
      fillOpacity: input.fillOpacity,
      strokeColor: input.strokeColor,
      strokeWeight: input.strokeWeight,
      closed,
      parentId: input.parentId
    },
    CreatePathResponseSchema
  );

  if (!response.pathId) {
    throw new Error('Failed to create path: No pathId returned');
  }

  const registry = getNodeRegistry();
  registry.register(response.pathId, {
    type: 'VECTOR',
    name,
    parentId: input.parentId ?? null,
    children: []
  });

  const commandCount = normalizedCommands?.length ?? 0;
  const pathSource = svgPathData ? 'SVG path string' : `${commandCount} commands`;

  return {
    pathId: response.pathId,
    name,
    commandCount,
    closed,
    message: `Created path "${name}" with ${pathSource}${closed ? ' (closed)' : ''}` + repairMessage
  };
}

export const handler = defineHandler<CreatePathInput, CreatePathResult>({
  name: 'create_path',
  schema: CreatePathInputSchema,
  execute: createPath,
  formatResponse: (r) => textResponse(r.message),
  definition: createPathToolDefinition
});
