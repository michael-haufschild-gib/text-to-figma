/**
 * MCP Tool: edit_path
 *
 * Replaces the vector path data on an existing VECTOR node.
 * Accepts either a structured command array or raw SVG path string.
 *
 * PRIMITIVE: Raw Figma vector path editing primitive.
 * Use for: adjusting path shapes after creation, iterative refinement,
 * importing updated SVG data onto existing nodes.
 */

import { z } from 'zod';
import { FigmaAckResponseSchema, getFigmaBridge } from '../figma-bridge.js';
import {
  formatRepairReport,
  repairPathCommands,
  type PathCommand as RepairedPathCommand,
  type RawPathCommand
} from './utils/path-command-repair.js';
import { defineHandler, textResponse } from '../routing/handler-utils.js';

/**
 * Input schema
 */
export const EditPathInputSchema = z
  .object({
    nodeId: z.string().min(1).describe('ID of the VECTOR node to edit'),
    commands: z
      .array(z.custom<RawPathCommand>())
      .optional()
      .describe('New path commands (M, L, C, Q, A, Z)'),
    svgPath: z
      .string()
      .optional()
      .describe('Raw SVG path d attribute string — alternative to commands'),
    closed: z.boolean().optional().describe('Whether to close the path automatically'),
    windingRule: z
      .enum(['NONZERO', 'EVENODD'])
      .optional()
      .describe('Winding rule for fill (default: NONZERO)')
  })
  .refine(
    (data) =>
      (data.commands !== undefined && data.commands.length >= 2) ||
      (data.svgPath !== undefined && data.svgPath.trim().length > 0),
    { message: 'Either "commands" (min 2) or "svgPath" must be provided' }
  );

export type EditPathInput = z.infer<typeof EditPathInputSchema>;

/**
 * Tool definition
 */
export const editPathToolDefinition = {
  name: 'edit_path',
  description: `Replaces the path data on an existing VECTOR node.

Use for: adjusting curves after creation, iterative path refinement,
importing updated SVG path data onto an existing node.

Accepts the same input modes as create_path:
1. Command array: Structured path commands (M, L, C, Q, A, Z)
2. SVG path string: Raw SVG d attribute

Example - Replace path with new commands:
edit_path({
  nodeId: "vector-123",
  commands: [
    { type: 'M', x: 0, y: 0 },
    { type: 'C', x1: 50, y1: -30, x2: 100, y2: -30, x: 150, y: 0 },
    { type: 'Z' }
  ]
})

Example - Replace with SVG path string:
edit_path({
  nodeId: "vector-123",
  svgPath: "M 0 0 C 50 -30 100 -30 150 0 Z"
})

Example - Change winding rule:
edit_path({
  nodeId: "vector-123",
  svgPath: "M 0 0 L 100 0 L 100 100 L 0 100 Z",
  windingRule: "EVENODD"
})`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the VECTOR node to edit'
      },
      commands: {
        type: 'array' as const,
        description: 'New path commands (M, L, C, Q, A, Z)',
        items: { type: 'object' as const }
      },
      svgPath: {
        type: 'string' as const,
        description: 'Raw SVG path d attribute string — alternative to commands'
      },
      closed: {
        type: 'boolean' as const,
        description: 'Whether to close the path automatically'
      },
      windingRule: {
        type: 'string' as const,
        enum: ['NONZERO', 'EVENODD'],
        description: 'Winding rule for fill (default: NONZERO)'
      }
    },
    required: ['nodeId']
  }
};

/**
 * Result type
 */
export interface EditPathResult {
  nodeId: string;
  message: string;
}

/**
 * Implementation
 */
export async function editPath(input: EditPathInput): Promise<EditPathResult> {
  let normalizedCommands: RepairedPathCommand[] | undefined;
  let repairMessage = '';
  let svgPathData: string | undefined;

  if (input.svgPath !== undefined) {
    svgPathData = input.svgPath.trim();
    if (svgPathData === '') {
      throw new Error('svgPath cannot be empty');
    }
  } else if (input.commands !== undefined && input.commands.length >= 2) {
    try {
      const repairReport = repairPathCommands(input.commands);
      normalizedCommands = repairReport.commands;

      if (repairReport.totalFixed > 0) {
        repairMessage = '\n\n' + formatRepairReport(repairReport);
        console.error(`[edit_path] Applied automatic repairs:\n${repairMessage}`);
      }
    } catch (repairError) {
      const errMsg = repairError instanceof Error ? repairError.message : String(repairError);
      throw new Error(`Path command validation failed:\n\n${errMsg}`);
    }
  } else {
    throw new Error('Either "commands" (min 2) or "svgPath" must be provided');
  }

  const bridge = getFigmaBridge();

  await bridge.sendToFigmaValidated(
    'edit_path',
    {
      nodeId: input.nodeId,
      commands: normalizedCommands,
      svgPath: svgPathData,
      closed: input.closed,
      windingRule: input.windingRule
    },
    FigmaAckResponseSchema
  );

  const source = svgPathData ? 'SVG path string' : `${normalizedCommands?.length ?? 0} commands`;
  return {
    nodeId: input.nodeId,
    message: `Path data updated with ${source}` + repairMessage
  };
}

export const handler = defineHandler<EditPathInput, EditPathResult>({
  name: 'edit_path',
  schema: EditPathInputSchema,
  execute: editPath,
  formatResponse: (r) => textResponse(`${r.message}\nNode ID: ${r.nodeId}\n`),
  definition: editPathToolDefinition
});
