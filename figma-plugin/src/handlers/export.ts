/**
 * Export Command Handlers
 *
 * Handles: export_node, set_export_settings
 *
 * Kept separate from utility.ts because export needs format-specific
 * ExportSettings construction: PNG/JPG carry a scale constraint, while SVG and
 * PDF have no constraint field at all.
 */

import { z } from 'zod';
import { getNode, getNodeDimensions } from '../helpers.js';

/** Handler return shape shared with the other plugin handler modules. */
interface OperationResult {
  message: string;
  [key: string]: unknown;
}

const EXPORT_FORMATS = ['PNG', 'JPG', 'SVG', 'PDF'] as const;
const CONSTRAINT_TYPES = ['SCALE', 'WIDTH', 'HEIGHT'] as const;

type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** MIME type per export format — sent back so the MCP server can label the payload. */
const EXPORT_MIME_TYPES: Record<ExportFormat, string> = {
  PNG: 'image/png',
  JPG: 'image/jpeg',
  SVG: 'image/svg+xml',
  PDF: 'application/pdf'
};

/**
 * Maximum raw export size we will base64-encode and push across the bridge.
 *
 * The WebSocket bridge rejects messages above 10MB (MAX_MESSAGE_SIZE) and
 * base64 inflates payloads by 4/3, so 7MB raw (~9.4MB encoded) is the largest
 * export that can safely round-trip with envelope overhead.
 */
const MAX_EXPORT_BYTES = 7 * 1024 * 1024;

/** Scale is only meaningful for raster formats — SVG and PDF have no size constraint. */
function formatSupportsScale(format: ExportFormat): boolean {
  return format === 'PNG' || format === 'JPG';
}

/**
 * Build format-correct Figma export settings.
 *
 * ExportSettingsSVG and ExportSettingsPDF have no `constraint` field, so the
 * scale constraint may only be attached to PNG/JPG exports.
 */
function buildExportSettings(options: {
  format: ExportFormat;
  scale: number;
  contentsOnly?: boolean;
  useAbsoluteBounds?: boolean;
  constraint?: ExportSettingsConstraints;
}): ExportSettings {
  const shared = {
    ...(options.contentsOnly !== undefined ? { contentsOnly: options.contentsOnly } : {}),
    ...(options.useAbsoluteBounds !== undefined
      ? { useAbsoluteBounds: options.useAbsoluteBounds }
      : {})
  };

  if (options.format === 'SVG') return { format: 'SVG', ...shared };
  if (options.format === 'PDF') return { format: 'PDF', ...shared };

  return {
    format: options.format,
    constraint: options.constraint ?? { type: 'SCALE', value: options.scale },
    ...shared
  };
}

const setExportSettingsSchema = z.object({
  nodeId: z.string(),
  settings: z
    .array(
      z.object({
        format: z.enum(EXPORT_FORMATS).optional(),
        scale: z.number().positive().optional(),
        constraint: z
          .object({
            type: z.enum(CONSTRAINT_TYPES),
            value: z.number().positive()
          })
          .optional(),
        suffix: z.string().optional(),
        contentsOnly: z.boolean().optional(),
        useAbsoluteBounds: z.boolean().optional()
      })
    )
    .min(1, 'At least one export setting is required')
});

export function handleSetExportSettings(payload: Record<string, unknown>): OperationResult {
  const input = setExportSettingsSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node) throw new Error('Node not found');
  // Read type before the `in` guard — narrowing to never hides it from the message.
  const nodeType: string = node.type;
  if (!('exportSettings' in node)) {
    throw new Error(`Node type ${nodeType} does not support export settings`);
  }

  // An explicit constraint wins; otherwise scale becomes a SCALE constraint.
  // buildExportSettings drops the constraint for SVG/PDF, which cannot carry one.
  const settings: ExportSettings[] = input.settings.map((s) =>
    buildExportSettings({
      format: s.format ?? 'PNG',
      scale: s.scale ?? 1,
      constraint:
        s.constraint ?? (s.scale !== undefined ? { type: 'SCALE', value: s.scale } : undefined),
      contentsOnly: s.contentsOnly,
      useAbsoluteBounds: s.useAbsoluteBounds
    })
  );

  // Suffix belongs to the stored preset (not to exportAsync), so it is merged here.
  const withSuffix = settings.map((setting, index) => {
    const suffix = input.settings[index]?.suffix;
    return suffix !== undefined ? { ...setting, suffix } : setting;
  });

  (node as SceneNode & ExportMixin).exportSettings = withSuffix;

  return {
    nodeId: input.nodeId,
    settingsCount: withSuffix.length,
    applied: withSuffix.map((s) => ({
      format: s.format,
      suffix: s.suffix ?? '',
      constraint: 'constraint' in s ? s.constraint : null
    })),
    message: 'Export settings applied successfully'
  };
}

const exportNodeSchema = z.object({
  nodeId: z.string(),
  format: z.enum(EXPORT_FORMATS).optional(),
  scale: z.number().positive().optional(),
  returnBase64: z.boolean().optional(),
  contentsOnly: z.boolean().optional(),
  useAbsoluteBounds: z.boolean().optional()
});

export async function handleExportNode(payload: Record<string, unknown>): Promise<OperationResult> {
  const input = exportNodeSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node) throw new Error(`Node not found: ${input.nodeId}`);
  // Read type before the `in` guard — narrowing to never hides it from the message.
  const nodeType: string = node.type;
  if (!('exportAsync' in node)) {
    throw new Error(`Node type ${nodeType} cannot be exported`);
  }

  const format: ExportFormat = input.format ?? 'PNG';
  const requestedScale = input.scale ?? 1;
  const scaleSupported = formatSupportsScale(format);
  const appliedScale = scaleSupported ? requestedScale : 1;

  const bytes = await (node as SceneNode & ExportMixin).exportAsync(
    buildExportSettings({
      format,
      scale: appliedScale,
      contentsOnly: input.contentsOnly,
      useAbsoluteBounds: input.useAbsoluteBounds
    }) as ExportSettingsImage
  );

  const byteLength = bytes.length;
  const wantsBase64 = input.returnBase64 !== false;
  const { width, height } = getNodeDimensions(node);

  // Reject before encoding: the bridge drops messages over 10MB and a rejected
  // frame surfaces as an opaque timeout rather than a usable error.
  if (wantsBase64 && byteLength > MAX_EXPORT_BYTES) {
    const megabytes = (byteLength / (1024 * 1024)).toFixed(1);
    throw new Error(
      `Export too large to transfer: ${megabytes}MB exceeds the ${String(
        MAX_EXPORT_BYTES / (1024 * 1024)
      )}MB bridge limit. Lower scale (currently ${String(appliedScale)}x), export a smaller node, or use format "SVG" for vector content.`
    );
  }

  const result: OperationResult = {
    nodeId: node.id,
    nodeName: node.name,
    nodeType,
    format,
    scale: appliedScale,
    requestedScale,
    scaleApplied: scaleSupported,
    byteLength,
    mimeType: EXPORT_MIME_TYPES[format],
    width,
    height,
    message: 'Node exported successfully'
  };

  // Omitted rather than null when not requested: the MCP response schema expects
  // `string | undefined`, and null previously failed validation outright.
  if (wantsBase64) {
    result.base64Data = figma.base64Encode(bytes);
  }

  if (!scaleSupported && requestedScale !== 1) {
    result.warning = `Format ${format} does not support scaling; exported at 1x. Use PNG or JPG for scaled raster output.`;
  }

  return result;
}
