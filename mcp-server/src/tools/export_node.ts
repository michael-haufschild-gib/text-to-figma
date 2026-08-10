/**
 * MCP Tool: export_node
 *
 * Exports a single node as PNG, JPG, SVG or PDF and either writes it to a file
 * or returns the data inline.
 *
 * PRIMITIVE: Raw Figma export primitive.
 * In Figma: await node.exportAsync({ format: 'PNG' })
 * Use for: generating assets for a local project, visual verification, handoff
 */

import { z } from 'zod';
import { ErrorCode, FigmaAPIError } from '../errors/index.js';
import { getFigmaBridge } from '../figma-bridge.js';
import { defineHandler } from '../routing/handler-utils.js';
import type { ResponseContent } from '../routing/tool-handler.js';
import {
  decodeTextExport,
  EXPORT_FORMATS,
  EXPORT_FORMAT_META,
  getMaxInlineBytes,
  isTextFormat,
  resolveOutputPath,
  writeExportFile,
  type ExportFormat
} from '../utils/export-writer.js';

const TOOL_NAME = 'export_node';

/** Formats that can be returned to the agent as an MCP image content block. */
const IMAGE_FORMATS: ReadonlySet<ExportFormat> = new Set<ExportFormat>(['PNG', 'JPG']);

/**
 * Input schema
 */
export const ExportNodeInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node to export'),
  format: z.enum(EXPORT_FORMATS).default('PNG').describe('Export format (default: PNG)'),
  scale: z
    .number()
    .positive()
    .max(10)
    .optional()
    .default(1)
    .describe('Export scale for PNG/JPG (1 = 1x, 2 = 2x). Ignored by SVG and PDF.'),
  outputPath: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Write the export to this file. Relative paths resolve against EXPORT_OUTPUT_DIR (default: server working directory); absolute paths are used as given. The correct extension is appended when missing.'
    ),
  returnBase64: z
    .boolean()
    .optional()
    .describe(
      'Return the raw data inline. Defaults to true when no outputPath is given, false otherwise.'
    ),
  returnImage: z
    .boolean()
    .optional()
    .default(false)
    .describe('Also return the export as a viewable image block (PNG/JPG only).'),
  contentsOnly: z
    .boolean()
    .optional()
    .describe('Export only this node, excluding overlapping layers (Figma default: true).'),
  useAbsoluteBounds: z
    .boolean()
    .optional()
    .describe('Use full node bounds instead of the cropped/visible area. Useful for text nodes.')
});

export type ExportNodeInput = z.infer<typeof ExportNodeInputSchema>;

/**
 * Tool definition
 */
export const exportNodeToolDefinition = {
  name: TOOL_NAME,
  description: `Exports a node as PNG, JPG, SVG or PDF — to a file on disk or inline.

PRIMITIVE: Raw Figma export primitive - not a pre-made component.
Use for: generating assets for a local project, visual verification, handoff.

Export Formats:
- PNG: Raster with transparency (honours scale)
- JPG: Raster without transparency (honours scale)
- SVG: Vector; scale is ignored, returned inline as SVG source text
- PDF: Print format; scale is ignored

Getting the result OUT:
- outputPath: writes the file and returns its absolute path (best for build assets)
- returnBase64: returns the data inline (default when no outputPath is given)
- returnImage: additionally returns a viewable image block (PNG/JPG only)

Example - Write an asset into a web project:
export_node({
  nodeId: "2486:4475",
  format: "PNG",
  scale: 2,
  outputPath: "public/images/header-icon@2x.png"
})

Example - Get SVG source text for inlining in a component:
export_node({ nodeId: "logo-456", format: "SVG" })

Example - Look at a frame to verify a design:
export_node({ nodeId: "frame-1", format: "PNG", scale: 1, returnImage: true })

Notes:
- Exports above 7MB cannot cross the plugin bridge; lower the scale or export a smaller node.
- Inline data above EXPORT_MAX_INLINE_BYTES (default 1MB) is omitted — use outputPath instead.
- To export several nodes at once, use export_nodes.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node to export'
      },
      format: {
        type: 'string' as const,
        enum: [...EXPORT_FORMATS],
        description: 'Export format',
        default: 'PNG'
      },
      scale: {
        type: 'number' as const,
        description: 'Export scale (PNG/JPG only)',
        default: 1
      },
      outputPath: {
        type: 'string' as const,
        description:
          'File path to write the export to (relative paths resolve against the export root)'
      },
      returnBase64: {
        type: 'boolean' as const,
        description: 'Return data inline (default: true when outputPath is omitted)'
      },
      returnImage: {
        type: 'boolean' as const,
        description: 'Also return a viewable image block (PNG/JPG only)',
        default: false
      },
      contentsOnly: {
        type: 'boolean' as const,
        description: 'Export only this node, excluding overlapping layers'
      },
      useAbsoluteBounds: {
        type: 'boolean' as const,
        description: 'Use full node bounds instead of the cropped area'
      }
    },
    required: ['nodeId']
  }
};

/**
 * Response schema for the Figma bridge export_node response.
 *
 * base64Data is nullish-tolerant: older plugin builds returned null when the
 * caller opted out of inline data, and a strict string check rejected them.
 */
export const ExportNodeResponseSchema = z
  .object({
    base64Data: z.string().nullish(),
    byteLength: z.number().nonnegative().optional(),
    mimeType: z.string().optional(),
    nodeName: z.string().optional(),
    nodeType: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    scale: z.number().optional(),
    scaleApplied: z.boolean().optional(),
    warning: z.string().optional()
  })
  .passthrough();

/**
 * Result type
 */
export interface ExportNodeResult {
  nodeId: string;
  nodeName?: string;
  format: ExportFormat;
  /** Scale actually applied by Figma (1 for SVG/PDF). */
  scale: number;
  /** Scale the caller asked for. */
  requestedScale: number;
  byteLength: number;
  mimeType: string;
  width?: number;
  height?: number;
  /** Base64 payload, when requested and within the inline size limit. */
  base64Data?: string;
  /** Decoded SVG source, when exporting SVG inline. */
  svgText?: string;
  /** Absolute path of the written file, when outputPath was given. */
  filePath?: string;
  /** Written path relative to the export root, for referencing in a project. */
  relativePath?: string;
  /** Viewable image payload, when returnImage was requested. */
  image?: { data: string; mimeType: string };
  /** Advisory messages (scale ignored, payload too large to inline, ...). */
  notes: string[];
  message: string;
}

/** Human-readable byte size for messages. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Where the caller wants the export to end up. */
interface ExportDestinations {
  /** A file path was given. */
  file: boolean;
  /** Raw data should be returned in the result. */
  inline: boolean;
  /** A viewable image block was requested and the format supports one. */
  image: boolean;
  /** The plugin must send the payload for any of the above. */
  data: boolean;
}

/**
 * Resolve which outputs the caller asked for.
 *
 * Inline data is the default only when no file destination was given, so a
 * caller writing build assets does not also pay for the payload in context.
 */
function resolveDestinations(input: ExportNodeInput): ExportDestinations {
  const file = input.outputPath !== undefined;
  const inline = input.returnBase64 ?? !file;
  const image = input.returnImage && IMAGE_FORMATS.has(input.format);

  return { file, inline, image, data: file || inline || image };
}

/**
 * Attach the inline payload and image block, or explain why they were withheld.
 *
 * Large payloads are dropped rather than streamed into the conversation: the
 * file on disk is the useful artefact once an export passes the inline limit.
 */
function attachPayloads(
  result: ExportNodeResult,
  base64Data: string,
  destinations: ExportDestinations,
  returnImageRequested: boolean
): void {
  const maxInline = getMaxInlineBytes();
  const withinLimit = result.byteLength <= maxInline;
  const limitLabel = `${formatBytes(result.byteLength)} exceeds the ${formatBytes(maxInline)} inline limit`;

  if (destinations.inline) {
    if (!withinLimit) {
      result.notes.push(
        `Inline data omitted: ${limitLabel}. Pass outputPath to write a file instead.`
      );
    } else if (isTextFormat(result.format)) {
      result.svgText = decodeTextExport(base64Data);
    } else {
      result.base64Data = base64Data;
    }
  }

  if (!destinations.image) {
    if (returnImageRequested) {
      result.notes.push(`returnImage is only supported for PNG and JPG, not ${result.format}.`);
    }
    return;
  }

  if (withinLimit) {
    result.image = { data: base64Data, mimeType: result.mimeType };
  } else if (!destinations.inline) {
    result.notes.push(
      `Image preview omitted: ${limitLabel}. Lower the scale for a viewable preview.`
    );
  }
}

/**
 * Implementation
 * @param input
 */
export async function exportNode(input: ExportNodeInput): Promise<ExportNodeResult> {
  const format = input.format;
  const destinations = resolveDestinations(input);

  // Fail before the round-trip: a bad path should not cost an export.
  const resolvedPath =
    input.outputPath !== undefined
      ? resolveOutputPath(input.outputPath, format, TOOL_NAME)
      : undefined;

  const bridge = getFigmaBridge();
  const response = await bridge.sendToFigmaValidated(
    'export_node',
    {
      nodeId: input.nodeId,
      format,
      scale: input.scale,
      returnBase64: destinations.data,
      ...(input.contentsOnly !== undefined ? { contentsOnly: input.contentsOnly } : {}),
      ...(input.useAbsoluteBounds !== undefined
        ? { useAbsoluteBounds: input.useAbsoluteBounds }
        : {})
    },
    ExportNodeResponseSchema
  );

  const base64Data = response.base64Data ?? undefined;

  if (destinations.data && base64Data === undefined) {
    throw new FigmaAPIError(
      'Figma plugin returned no export data. Rebuild the plugin (npm run build) and reload it in Figma, then retry.',
      TOOL_NAME,
      'export_node',
      { nodeId: input.nodeId, format },
      undefined,
      ErrorCode.OP_EXPORT_FAILED
    );
  }

  // base64 length is a reliable size proxy when the plugin omits byteLength.
  const byteLength =
    response.byteLength ??
    (base64Data !== undefined ? Buffer.from(base64Data, 'base64').byteLength : 0);
  const appliedScale =
    response.scale ?? (isTextFormat(format) || format === 'PDF' ? 1 : input.scale);

  const result: ExportNodeResult = {
    nodeId: input.nodeId,
    nodeName: response.nodeName,
    format,
    scale: appliedScale,
    requestedScale: input.scale,
    byteLength,
    // Derived from the requested format, not echoed from the plugin: it must stay
    // consistent with the extension written to disk and the image block's label.
    mimeType: EXPORT_FORMAT_META[format].mimeType,
    width: response.width,
    height: response.height,
    notes: response.warning !== undefined ? [response.warning] : [],
    message: ''
  };

  if (resolvedPath !== undefined && base64Data !== undefined) {
    const written = await writeExportFile(resolvedPath, base64Data, TOOL_NAME);
    result.filePath = written.filePath;
    result.relativePath = written.relativePath;
    result.byteLength = written.bytes;
  }

  if (base64Data !== undefined) {
    attachPayloads(result, base64Data, destinations, input.returnImage);
  }

  const scaleLabel = appliedScale === 1 ? '1x' : `${String(appliedScale)}x`;
  result.message =
    result.filePath !== undefined
      ? `Exported node as ${format} at ${scaleLabel} to ${result.filePath}`
      : `Exported node as ${format} at ${scaleLabel}`;

  return result;
}

/** Build the MCP response content for an export result. */
export function formatExportNodeResponse(r: ExportNodeResult): ResponseContent[] {
  const lines = [
    r.message,
    `Node ID: ${r.nodeId}`,
    ...(r.nodeName !== undefined ? [`Node Name: ${r.nodeName}`] : []),
    `Format: ${r.format}`,
    `Scale: ${String(r.scale)}x`,
    `Size: ${formatBytes(r.byteLength)}`,
    ...(r.width !== undefined && r.height !== undefined
      ? [`Dimensions: ${String(r.width)}×${String(r.height)} (at 1x)`]
      : [])
  ];

  if (r.filePath !== undefined) {
    lines.push(`File: ${r.filePath}`);
    if (r.relativePath !== undefined && r.relativePath !== r.filePath) {
      lines.push(`Relative Path: ${r.relativePath}`);
    }
  }

  for (const note of r.notes) {
    lines.push(`Note: ${note}`);
  }

  const content: ResponseContent[] = [{ type: 'text', text: `${lines.join('\n')}\n` }];

  if (r.svgText !== undefined) {
    content.push({ type: 'text', text: `SVG source:\n${r.svgText}` });
  }

  if (r.base64Data !== undefined) {
    content.push({
      type: 'text',
      text: `Base64 (${r.mimeType}, ${String(r.base64Data.length)} chars):\n${r.base64Data}`
    });
  }

  if (r.image !== undefined) {
    content.push({ type: 'image', data: r.image.data, mimeType: r.image.mimeType });
  }

  return content;
}

export const handler = defineHandler<ExportNodeInput, ExportNodeResult>({
  name: TOOL_NAME,
  schema: ExportNodeInputSchema,
  execute: exportNode,
  formatResponse: formatExportNodeResponse,
  definition: exportNodeToolDefinition
});
