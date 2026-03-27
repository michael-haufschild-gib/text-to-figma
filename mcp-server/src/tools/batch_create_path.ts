/**
 * MCP Tool: batch_create_path
 *
 * Creates multiple vector paths in a single round-trip to the Figma plugin.
 * Dramatically reduces latency when building illustrations with many paths.
 *
 * Each path item supports the same options as create_path (commands or svgPath,
 * fill, stroke, positioning). A shared parentId applies to all items.
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
 * Schema for a single path item within the batch
 */
const BatchPathItemSchema = z
  .object({
    name: z.string().optional().describe('Name for the path (default: "Path")'),
    x: z.number().optional().describe('X position of the path node'),
    y: z.number().optional().describe('Y position of the path node'),
    commands: z
      .array(z.custom<RawPathCommand>())
      .optional()
      .describe('Array of path commands (M, L, C, Q, A, Z)'),
    svgPath: z
      .string()
      .optional()
      .describe('Raw SVG path d attribute string — alternative to commands'),
    fillColor: z.string().optional().describe('Fill color in hex format'),
    fillOpacity: z.number().min(0).max(1).optional().describe('Fill opacity from 0 to 1'),
    strokeColor: z.string().optional().describe('Stroke color in hex format'),
    strokeWeight: z.number().optional().describe('Stroke width in pixels'),
    closed: z.boolean().optional().describe('Whether to close the path automatically')
  })
  .refine(
    (data) =>
      (data.commands !== undefined && data.commands.length >= 2) ||
      (data.svgPath !== undefined && data.svgPath.trim().length > 0),
    { message: 'Each path item must have "commands" (min 2) or "svgPath"' }
  );

/**
 * Input schema
 */
export const BatchCreatePathInputSchema = z.object({
  paths: z
    .array(BatchPathItemSchema)
    .min(1)
    .max(200)
    .describe('Array of path definitions to create'),
  parentId: z.string().optional().describe('Parent frame ID — applied to all paths in the batch')
});

export type BatchCreatePathInput = z.infer<typeof BatchCreatePathInputSchema>;

/**
 * Processed path item sent to the Figma plugin
 */
interface ProcessedPathItem {
  name: string;
  x?: number;
  y?: number;
  commands?: RepairedPathCommand[];
  svgPath?: string;
  fillColor?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeWeight?: number;
  closed: boolean;
}

/**
 * Tool definition
 */
export const batchCreatePathToolDefinition = {
  name: 'batch_create_path',
  description: `Creates multiple vector paths in a single operation. Use instead of repeated create_path calls when building illustrations with many shapes.

All paths share the same parent frame. Each path item accepts the same options as create_path.

Limits: 1-200 paths per batch.

Example:
batch_create_path({
  parentId: "frame-123",
  paths: [
    { name: "Body", svgPath: "M 0 0 C 50 -30 100 -30 150 0 Z", fillColor: "#8B4513" },
    { name: "Head", x: 150, y: -40, svgPath: "M 0 20 A 20 20 0 1 1 40 20 A 20 20 0 1 1 0 20 Z", fillColor: "#8B4513" },
    { name: "Tail", x: -10, y: -10, svgPath: "M 0 0 C -20 -30 -10 -40 5 -35", strokeColor: "#8B4513", strokeWeight: 3 }
  ]
})`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      paths: {
        type: 'array' as const,
        description: 'Array of path definitions (1-200)',
        items: {
          type: 'object' as const,
          properties: {
            name: { type: 'string' as const, description: 'Path name' },
            x: { type: 'number' as const, description: 'X position' },
            y: { type: 'number' as const, description: 'Y position' },
            commands: {
              type: 'array' as const,
              description: 'Path commands (M, L, C, Q, A, Z)',
              items: { type: 'object' as const }
            },
            svgPath: { type: 'string' as const, description: 'SVG path d attribute' },
            fillColor: { type: 'string' as const, description: 'Fill hex color' },
            fillOpacity: { type: 'number' as const, description: 'Fill opacity 0-1' },
            strokeColor: { type: 'string' as const, description: 'Stroke hex color' },
            strokeWeight: { type: 'number' as const, description: 'Stroke width' },
            closed: { type: 'boolean' as const, description: 'Close path automatically' }
          }
        }
      },
      parentId: {
        type: 'string' as const,
        description: 'Parent frame ID for all paths'
      }
    },
    required: ['paths']
  }
};

/**
 * Response schema from Figma plugin
 */
const BatchCreatePathResponseSchema = z.object({
  results: z.array(
    z.object({
      index: z.number(),
      pathId: z.string().optional(),
      name: z.string(),
      error: z.string().optional()
    })
  )
});

/**
 * Result type
 */
export interface BatchCreatePathResult {
  created: number;
  failed: number;
  results: Array<{
    index: number;
    pathId?: string;
    name: string;
    error?: string;
  }>;
  message: string;
}

/**
 * Implementation
 */
export async function batchCreatePath(input: BatchCreatePathInput): Promise<BatchCreatePathResult> {
  const processedItems: ProcessedPathItem[] = [];
  const repairMessages: string[] = [];

  for (let i = 0; i < input.paths.length; i++) {
    const item = input.paths[i];
    if (!item) continue;
    let normalizedCommands: RepairedPathCommand[] | undefined;
    let svgPathData: string | undefined;

    if (item.svgPath !== undefined) {
      svgPathData = item.svgPath.trim();
      if (svgPathData === '') {
        throw new Error(`Path item ${i}: svgPath cannot be empty`);
      }
    } else if (item.commands !== undefined && item.commands.length >= 2) {
      try {
        const repairReport = repairPathCommands(item.commands);
        normalizedCommands = repairReport.commands;
        if (repairReport.totalFixed > 0) {
          repairMessages.push(
            `Item ${i} ("${item.name ?? 'Path'}"): ${formatRepairReport(repairReport)}`
          );
        }
      } catch (repairError) {
        const errMsg = repairError instanceof Error ? repairError.message : String(repairError);
        throw new Error(`Path item ${i} command validation failed: ${errMsg}`);
      }
    }

    processedItems.push({
      name: item.name ?? 'Path',
      x: item.x,
      y: item.y,
      commands: normalizedCommands,
      svgPath: svgPathData,
      fillColor: item.fillColor,
      fillOpacity: item.fillOpacity,
      strokeColor: item.strokeColor,
      strokeWeight: item.strokeWeight,
      closed: item.closed ?? false
    });
  }

  if (repairMessages.length > 0) {
    console.error(`[batch_create_path] Applied repairs:\n${repairMessages.join('\n')}`);
  }

  const bridge = getFigmaBridge();
  const response = await bridge.sendToFigmaValidated(
    'batch_create_path',
    {
      paths: processedItems,
      parentId: input.parentId
    },
    BatchCreatePathResponseSchema
  );

  const registry = getNodeRegistry();
  let created = 0;
  let failed = 0;

  for (const result of response.results) {
    if (result.pathId) {
      created++;
      registry.register(result.pathId, {
        type: 'VECTOR',
        name: result.name,
        parentId: input.parentId ?? null,
        children: []
      });
    } else {
      failed++;
    }
  }

  const repairSuffix =
    repairMessages.length > 0 ? `\n\nRepairs applied:\n${repairMessages.join('\n')}` : '';

  return {
    created,
    failed,
    results: response.results,
    message:
      `Batch created ${created} path(s)` + (failed > 0 ? `, ${failed} failed` : '') + repairSuffix
  };
}

export const handler = defineHandler<BatchCreatePathInput, BatchCreatePathResult>({
  name: 'batch_create_path',
  schema: BatchCreatePathInputSchema,
  execute: batchCreatePath,
  formatResponse: (r) => {
    const lines = [r.message, ''];
    for (const item of r.results) {
      if (item.pathId) {
        lines.push(`  [${item.index}] "${item.name}" → ${item.pathId}`);
      } else {
        lines.push(`  [${item.index}] "${item.name}" FAILED: ${item.error ?? 'unknown'}`);
      }
    }
    return textResponse(lines.join('\n'));
  },
  definition: batchCreatePathToolDefinition
});
