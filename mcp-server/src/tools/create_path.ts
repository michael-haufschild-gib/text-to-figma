/**
 * MCP Tool: create_path
 *
 * Creates a custom vector path using Bezier curves and line segments.
 * Essential for creating organic, smooth shapes like animals, characters, and logos.
 *
 * PRIMITIVE: Raw Figma vector network primitive.
 * Use for: custom shapes, organic forms, smooth curves, complex illustrations
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import {
  formatRepairReport,
  repairPathCommands,
  type PathCommand as RepairedPathCommand,
  type RawPathCommand
} from './utils/path-command-repair.js';

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
 */
export const CreatePathInputSchema = z.object({
  name: z.string().optional().describe('Name for the path (default: "Path")'),
  commands: z.array(z.custom<RawPathCommand>()).min(2).describe('Array of path commands'),
  fillColor: z.string().optional().describe('Fill color in hex format'),
  strokeColor: z.string().optional().describe('Stroke color in hex format'),
  strokeWeight: z.number().optional().describe('Stroke width in pixels'),
  closed: z
    .boolean()
    .optional()
    .describe('Whether to close the path automatically (default: false)'),
  parentId: z.string().optional().describe('Parent frame ID (optional)')
});

export type CreatePathInput = z.infer<typeof CreatePathInputSchema>;

/**
 * Tool definition
 */
export const createPathToolDefinition = {
  name: 'create_path',
  description: `Creates a custom vector path using Bezier curves and line segments.

PRIMITIVE: Raw Figma vector network primitive - not a pre-made component.
Use for: organic shapes, smooth curves, custom illustrations, logos, characters.

Path Commands (SVG-like syntax):
- M (Move): Move to point { type: 'M', x: 100, y: 100 }
- L (Line): Draw line to point { type: 'L', x: 200, y: 100 }
- C (Cubic Bezier): Smooth curve { type: 'C', x1: cp1x, y1: cp1y, x2: cp2x, y2: cp2y, x: endx, y: endy }
- Q (Quadratic Bezier): Simple curve { type: 'Q', x1: cpx, y1: cpy, x: endx, y: endy }
- Z (Close): Close path back to start { type: 'Z' }

Example - Smooth Curved Shape (Horse Body):
create_path({
  name: "Horse Body",
  commands: [
    { type: 'M', x: 100, y: 200 },  // Start at back
    { type: 'C', x1: 150, y1: 150, x2: 250, y2: 150, x: 300, y: 180 },  // Smooth top curve
    { type: 'C', x1: 320, y1: 200, x2: 320, y2: 250, x: 300, y: 270 },  // Front curve down
    { type: 'L', x: 280, y: 280 },  // Belly line
    { type: 'C', x1: 200, y1: 290, x2: 120, y2: 280, x: 100, y: 260 },  // Back curve
    { type: 'Z' }  // Close path
  ],
  fillColor: "#8B4513",
  strokeColor: "#654321",
  strokeWeight: 2
})

Example - Simple Curved Line (Tail):
create_path({
  name: "Tail Curve",
  commands: [
    { type: 'M', x: 400, y: 300 },  // Start
    { type: 'Q', x1: 450, y1: 250, x: 480, y: 320 }  // Smooth curve
  ],
  strokeColor: "#654321",
  strokeWeight: 3,
  closed: false
})

Example - Complex Shape with Multiple Curves:
create_path({
  name: "Horse Head Profile",
  commands: [
    { type: 'M', x: 100, y: 150 },  // Forehead
    { type: 'C', x1: 105, y1: 140, x2: 110, y2: 135, x: 120, y: 138 },  // Ear curve
    { type: 'L', x: 125, y: 145 },  // Ear tip
    { type: 'C', x1: 130, y1: 155, x2: 140, y2: 165, x: 145, y: 180 },  // Nose curve
    { type: 'C', x1: 140, y1: 190, x2: 130, y2: 195, x: 120, y: 195 },  // Jaw
    { type: 'C', x1: 110, y1: 190, x2: 100, y2: 175, x: 100, y: 150 },  // Neck
    { type: 'Z' }  // Close
  ],
  fillColor: "#8B4513"
})

Use Cases:
- Create smooth animal bodies (horses, dogs, cats)
- Draw character outlines
- Create logos with smooth curves
- Draw organic shapes (leaves, clouds, water)
- Create complex illustrations
- Draw smooth connecting shapes`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string' as const,
        description: 'Name for the path (default: "Path")'
      },
      commands: {
        type: 'array' as const,
        description: 'Array of path commands (M, L, C, Q, Z)',
        items: {
          type: 'object' as const
        }
      },
      fillColor: {
        type: 'string' as const,
        description: 'Fill color in hex format'
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
    required: ['commands']
  }
};

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
 * @param input
 */
export async function createPath(input: CreatePathInput): Promise<CreatePathResult> {
  // Validate input schema
  const validated = input;

  // Use intelligent repair system to normalize and fix common issues
  let normalizedCommands: RepairedPathCommand[];
  let repairMessage = '';
  try {
    const repairReport = repairPathCommands(validated.commands);
    normalizedCommands = repairReport.commands;

    // Generate repair message if fixes were applied
    if (repairReport.totalFixed > 0) {
      repairMessage = '\n\n' + formatRepairReport(repairReport);
      // MCP: Use console.error to send logs to stderr, not stdout
      console.error(`[create_path] Applied automatic repairs:\n${repairMessage}`);
    }
  } catch (repairError) {
    const errMsg = repairError instanceof Error ? repairError.message : String(repairError);
    throw new Error(`Path command validation failed:\n\n${errMsg}`);
  }

  // Get Figma bridge
  const bridge = getFigmaBridge();

  const name = validated.name ?? 'Path';
  const closed = validated.closed ?? false;

  // Send command to Figma with normalized commands
  const response = await bridge.sendToFigmaWithRetry<{
    pathId: string;
    message: string;
  }>('create_path', {
    name,
    commands: normalizedCommands,
    fillColor: validated.fillColor,
    strokeColor: validated.strokeColor,
    strokeWeight: validated.strokeWeight,
    closed,
    parentId: validated.parentId
  });

  if (response.pathId === '') {
    throw new Error('Failed to create path: No pathId returned');
  }

  return {
    pathId: response.pathId,
    name,
    commandCount: normalizedCommands.length,
    closed,
    message:
      `Created path "${name}" with ${normalizedCommands.length} commands${closed ? ' (closed)' : ''}` +
      repairMessage
  };
}
