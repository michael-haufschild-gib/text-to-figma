/**
 * MCP Tool: export_nodes
 *
 * Exports several nodes — typically the children of a selected frame — into an
 * output directory, optionally at multiple scales, and returns a manifest of
 * the written files.
 *
 * COMPOSITE: Batches the export_node primitive so an agent can populate an
 * asset directory in a local project with one call instead of N round-trips.
 */

import { z } from 'zod';
import { ValidationError } from '../errors/index.js';
import { getFigmaBridge } from '../figma-bridge.js';
import { defineHandler, textResponse } from '../routing/handler-utils.js';
import type { ResponseContent } from '../routing/tool-handler.js';
import {
  buildFileName,
  EXPORT_FORMATS,
  joinOutputDir,
  resolveOutputDir,
  slugifyNodeName,
  writeExportFile,
  type ExportFormat
} from '../utils/export-writer.js';
import { ExportNodeResponseSchema } from './export_node.js';

const TOOL_NAME = 'export_nodes';

/** Formats that honour a scale constraint. */
function formatHonoursScale(format: ExportFormat): boolean {
  return format === 'PNG' || format === 'JPG';
}

/**
 * Input schema
 */
export const ExportNodesInputSchema = z
  .object({
    nodeIds: z
      .array(z.string().min(1))
      .min(1)
      .max(64)
      .describe('IDs of the nodes to export (max 64)'),
    outputDir: z
      .string()
      .min(1)
      .describe(
        'Directory to write files into. Relative paths resolve against EXPORT_OUTPUT_DIR (default: server working directory); absolute paths are used as given. Created if missing.'
      ),
    format: z.enum(EXPORT_FORMATS).default('PNG').describe('Export format for every node'),
    scales: z
      .array(z.number().positive().max(10))
      .min(1)
      .max(4)
      .optional()
      .default([1])
      .describe('Scales to export each node at, e.g. [1, 2, 3]. PNG/JPG only.'),
    fileNames: z
      .array(z.string().min(1))
      .optional()
      .describe(
        'Optional base file names, one per nodeId, without extension or scale suffix. Defaults to slugified layer names.'
      ),
    contentsOnly: z
      .boolean()
      .optional()
      .describe('Export only each node, excluding overlapping layers (Figma default: true).'),
    useAbsoluteBounds: z
      .boolean()
      .optional()
      .describe('Use full node bounds instead of the cropped/visible area.'),
    continueOnError: z
      .boolean()
      .optional()
      .default(true)
      .describe('Keep exporting remaining nodes after a failure (default: true).')
  })
  .refine((v) => v.fileNames === undefined || v.fileNames.length === v.nodeIds.length, {
    message: 'fileNames must have exactly one entry per nodeId',
    path: ['fileNames']
  });

export type ExportNodesInput = z.infer<typeof ExportNodesInputSchema>;

/**
 * Tool definition
 */
export const exportNodesToolDefinition = {
  name: TOOL_NAME,
  description: `Exports multiple nodes to files in a directory and returns a manifest.

COMPOSITE: Batched export_node — use it to fill an asset folder in one call.
Use for: exporting the children of a selected frame into a local web project.

Behaviour:
- Every node is exported in the requested format and written to outputDir
- File names default to the slugified layer name ("Header Icon" → header-icon.png)
- Duplicate names are disambiguated with the node ID, never silently overwritten
- scales: [1, 2] additionally writes an "@2x" variant (PNG/JPG only)
- The directory is created if it does not exist

Typical workflow:
1. get_selection({ maxDepth: 1 })       → collect the child node IDs
2. export_nodes({ nodeIds: [...], outputDir: "public/assets/icons", format: "PNG", scales: [1, 2] })
3. Reference the returned relative paths in the project

Example:
export_nodes({
  nodeIds: ["2486:4475", "2486:4484"],
  outputDir: "public/assets/icons",
  format: "PNG",
  scales: [1, 2]
})

Notes:
- Exports above 7MB per file cannot cross the plugin bridge; lower the scale.
- SVG and PDF ignore scales and are always written once per node.
- For inline data or a viewable preview of a single node, use export_node.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeIds: {
        type: 'array' as const,
        items: { type: 'string' as const },
        description: 'IDs of the nodes to export (max 64)'
      },
      outputDir: {
        type: 'string' as const,
        description: 'Directory to write files into (created if missing)'
      },
      format: {
        type: 'string' as const,
        enum: [...EXPORT_FORMATS],
        description: 'Export format',
        default: 'PNG'
      },
      scales: {
        type: 'array' as const,
        items: { type: 'number' as const },
        description: 'Scales to export each node at (PNG/JPG only)',
        default: [1]
      },
      fileNames: {
        type: 'array' as const,
        items: { type: 'string' as const },
        description: 'Optional base file names, one per nodeId, without extension'
      },
      contentsOnly: {
        type: 'boolean' as const,
        description: 'Export only each node, excluding overlapping layers'
      },
      useAbsoluteBounds: {
        type: 'boolean' as const,
        description: 'Use full node bounds instead of the cropped area'
      },
      continueOnError: {
        type: 'boolean' as const,
        description: 'Keep exporting after a failure',
        default: true
      }
    },
    required: ['nodeIds', 'outputDir']
  }
};

/** One written file in the export manifest. */
export interface ExportedFile {
  nodeId: string;
  nodeName?: string;
  format: ExportFormat;
  scale: number;
  filePath: string;
  relativePath: string;
  bytes: number;
  width?: number;
  height?: number;
}

/** One failed export in the manifest. */
export interface FailedExport {
  nodeId: string;
  scale: number;
  error: string;
}

/**
 * Result type
 */
export interface ExportNodesResult {
  outputDir: string;
  format: ExportFormat;
  scales: number[];
  files: ExportedFile[];
  failures: FailedExport[];
  totalBytes: number;
  notes: string[];
  message: string;
}

/** Human-readable byte size for messages. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Pick a collision-free file name.
 *
 * Two sibling layers commonly share a name ("icon"), and silently overwriting
 * the first export would lose an asset — so the node ID disambiguates instead.
 */
function uniqueFileName(
  baseName: string,
  nodeId: string,
  scale: number,
  format: ExportFormat,
  used: Set<string>
): string {
  const preferred = buildFileName({ nodeName: baseName, nodeId, format, scale });
  if (!used.has(preferred)) {
    used.add(preferred);
    return preferred;
  }

  const withNodeId = buildFileName({
    nodeName: `${baseName}-${nodeId}`,
    nodeId,
    format,
    scale
  });
  if (!used.has(withNodeId)) {
    used.add(withNodeId);
    return withNodeId;
  }

  let counter = 2;
  let numbered = withNodeId;
  while (used.has(numbered)) {
    numbered = withNodeId.replace(/(\.[^.]+)$/, `-${String(counter)}$1`);
    counter++;
  }
  used.add(numbered);
  return numbered;
}

/**
 * Implementation
 * @param input
 */
export async function exportNodes(input: ExportNodesInput): Promise<ExportNodesResult> {
  const format = input.format;
  const notes: string[] = [];

  // SVG and PDF have no size constraint, so extra scales would write identical
  // files under misleading @2x names.
  let scales = [...new Set(input.scales)];
  if (!formatHonoursScale(format) && scales.some((s) => s !== 1)) {
    notes.push(`${format} does not support scaling; exported once per node at 1x.`);
    scales = [1];
  }

  const directory = resolveOutputDir(input.outputDir, TOOL_NAME);

  if (input.fileNames !== undefined && input.fileNames.length !== input.nodeIds.length) {
    throw new ValidationError('fileNames must have exactly one entry per nodeId', TOOL_NAME, {
      nodeIds: input.nodeIds.length,
      fileNames: input.fileNames.length
    });
  }

  const bridge = getFigmaBridge();
  const files: ExportedFile[] = [];
  const failures: FailedExport[] = [];
  const usedNames = new Set<string>();

  // Sequential by design: the plugin processes commands on a serial queue, so
  // parallel sends add no throughput and make partial failures harder to report.
  for (const [index, nodeId] of input.nodeIds.entries()) {
    for (const scale of scales) {
      try {
        const response = await bridge.sendToFigmaValidated(
          'export_node',
          {
            nodeId,
            format,
            scale,
            returnBase64: true,
            ...(input.contentsOnly !== undefined ? { contentsOnly: input.contentsOnly } : {}),
            ...(input.useAbsoluteBounds !== undefined
              ? { useAbsoluteBounds: input.useAbsoluteBounds }
              : {})
          },
          ExportNodeResponseSchema
        );

        const base64Data = response.base64Data ?? undefined;
        if (base64Data === undefined) {
          throw new Error(
            'Figma plugin returned no export data. Rebuild the plugin (npm run build) and reload it in Figma.'
          );
        }

        const explicitName = input.fileNames?.[index];
        const baseName =
          explicitName !== undefined
            ? slugifyNodeName(explicitName, slugifyNodeName(nodeId, 'node'))
            : slugifyNodeName(response.nodeName ?? nodeId, slugifyNodeName(nodeId, 'node'));

        const fileName = uniqueFileName(baseName, nodeId, scale, format, usedNames);

        const written = await writeExportFile(
          joinOutputDir(directory, fileName, TOOL_NAME),
          base64Data,
          TOOL_NAME
        );

        files.push({
          nodeId,
          nodeName: response.nodeName,
          format,
          scale: response.scale ?? scale,
          filePath: written.filePath,
          relativePath: written.relativePath,
          bytes: written.bytes,
          width: response.width,
          height: response.height
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ nodeId, scale, error: message });
        if (!input.continueOnError) {
          return buildResult(directory, format, scales, files, failures, notes);
        }
      }
    }
  }

  return buildResult(directory, format, scales, files, failures, notes);
}

/** Assemble the result object and its summary message. */
function buildResult(
  directory: string,
  format: ExportFormat,
  scales: number[],
  files: ExportedFile[],
  failures: FailedExport[],
  notes: string[]
): ExportNodesResult {
  const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
  const summary =
    failures.length === 0
      ? `Exported ${String(files.length)} file(s) as ${format} to ${directory}`
      : `Exported ${String(files.length)} file(s) as ${format} to ${directory}; ${String(failures.length)} failed`;

  return {
    outputDir: directory,
    format,
    scales,
    files,
    failures,
    totalBytes,
    notes,
    message: summary
  };
}

/** Build the MCP response content for a batch export result. */
export function formatExportNodesResponse(r: ExportNodesResult): ResponseContent[] {
  const lines = [
    r.message,
    `Output Directory: ${r.outputDir}`,
    `Format: ${r.format}`,
    `Scales: ${r.scales.map((s) => `${String(s)}x`).join(', ')}`,
    `Total Size: ${formatBytes(r.totalBytes)}`,
    ''
  ];

  if (r.files.length > 0) {
    lines.push('Files:');
    for (const file of r.files) {
      const label = file.nodeName !== undefined ? ` — ${file.nodeName}` : '';
      lines.push(
        `  ${file.relativePath} (${formatBytes(file.bytes)}, ${String(file.scale)}x, ${file.nodeId}${label})`
      );
    }
    lines.push('');
  }

  if (r.failures.length > 0) {
    lines.push('Failures:');
    for (const failure of r.failures) {
      lines.push(`  ${failure.nodeId} @${String(failure.scale)}x: ${failure.error}`);
    }
    lines.push('');
  }

  for (const note of r.notes) {
    lines.push(`Note: ${note}`);
  }

  return textResponse(`${lines.join('\n')}\n`);
}

export const handler = defineHandler<ExportNodesInput, ExportNodesResult>({
  name: TOOL_NAME,
  schema: ExportNodesInputSchema,
  execute: exportNodes,
  formatResponse: formatExportNodesResponse,
  definition: exportNodesToolDefinition
});
