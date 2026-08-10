/**
 * Export File Writer
 *
 * Turns base64 export payloads from the Figma plugin into files on disk.
 *
 * The plugin sandbox has no filesystem access, so every export crosses the
 * WebSocket bridge as base64 and is materialised here, in the Node process.
 * This module owns path resolution, extension correctness and directory
 * creation so the export tools stay focused on the bridge protocol.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { getConfig } from '../config.js';
import { ErrorCode, ValidationError } from '../errors/index.js';

/** Formats the Figma export API can produce. */
export const EXPORT_FORMATS = ['PNG', 'JPG', 'SVG', 'PDF'] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** File extension and MIME type per export format. */
export const EXPORT_FORMAT_META: Record<ExportFormat, { ext: string; mimeType: string }> = {
  PNG: { ext: '.png', mimeType: 'image/png' },
  JPG: { ext: '.jpg', mimeType: 'image/jpeg' },
  SVG: { ext: '.svg', mimeType: 'image/svg+xml' },
  PDF: { ext: '.pdf', mimeType: 'application/pdf' }
};

/** Extensions accepted for a given format (so ".jpeg" is not rewritten to ".jpg"). */
const ACCEPTED_EXTENSIONS: Record<ExportFormat, readonly string[]> = {
  PNG: ['.png'],
  JPG: ['.jpg', '.jpeg'],
  SVG: ['.svg'],
  PDF: ['.pdf']
};

/** Formats whose bytes are UTF-8 text rather than binary. */
export function isTextFormat(format: ExportFormat): boolean {
  return format === 'SVG';
}

/**
 * Root for relative export paths.
 *
 * Falls back to the environment and then the working directory so the helper
 * stays usable in unit tests, where loadConfig() may not have run.
 */
export function getExportRoot(): string {
  try {
    return getConfig().EXPORT_OUTPUT_DIR;
  } catch {
    return process.env.EXPORT_OUTPUT_DIR ?? process.cwd();
  }
}

/** Maximum payload returned inline to the agent instead of written to disk. */
export function getMaxInlineBytes(): number {
  try {
    return getConfig().EXPORT_MAX_INLINE_BYTES;
  } catch {
    const fromEnv = Number(process.env.EXPORT_MAX_INLINE_BYTES);
    return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 1024 * 1024;
  }
}

/**
 * Convert a Figma layer name into a filesystem- and URL-safe base name.
 *
 * Figma layer names routinely contain spaces, slashes and emoji, none of which
 * belong in an asset path consumed by a web bundler.
 */
export function slugifyNodeName(name: string, fallback = 'node'): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')
    .toLowerCase()
    .slice(0, 60);

  return slug.length > 0 ? slug : fallback;
}

/** Scale suffix following the conventional @2x / @3x asset naming. */
export function scaleSuffix(scale: number): string {
  if (scale === 1) return '';
  return `@${Number.isInteger(scale) ? String(scale) : String(scale).replace('.', '_')}x`;
}

/**
 * Build a file name from a node's name, its scale and the export format.
 *
 * @example buildFileName({ nodeName: 'Header Icon', format: 'PNG', scale: 2 }) → 'header-icon@2x.png'
 */
export function buildFileName(options: {
  nodeName: string;
  nodeId: string;
  format: ExportFormat;
  scale: number;
}): string {
  const base = slugifyNodeName(options.nodeName, slugifyNodeName(options.nodeId, 'node'));
  return `${base}${scaleSuffix(options.scale)}${EXPORT_FORMAT_META[options.format].ext}`;
}

/**
 * Resolve a caller-supplied output path to an absolute file path.
 *
 * Relative paths resolve against {@link getExportRoot} and may not escape it,
 * which keeps `../../etc/passwd` out of reach. Absolute paths are honoured as
 * given: writing generated assets straight into a local project directory is
 * the primary use case for these tools.
 *
 * @param target - File path (relative or absolute), with or without extension
 * @param format - Export format used to validate or append the extension
 * @param tool - Tool name for error attribution
 */
export function resolveOutputPath(target: string, format: ExportFormat, tool: string): string {
  const trimmed = target.trim();

  if (trimmed.length === 0) {
    throw new ValidationError('outputPath must not be empty', tool, { outputPath: target });
  }
  if (trimmed.includes('\0')) {
    throw new ValidationError('outputPath must not contain null bytes', tool, {
      outputPath: target
    });
  }
  if (trimmed.endsWith('/') || trimmed.endsWith(sep)) {
    throw new ValidationError(
      `outputPath must be a file path, not a directory: "${target}"`,
      tool,
      { outputPath: target }
    );
  }

  const root = getExportRoot();
  const absolute = isAbsolute(trimmed) ? resolve(trimmed) : resolve(root, trimmed);

  if (!isAbsolute(trimmed)) {
    const relativeToRoot = relative(root, absolute);
    if (relativeToRoot.startsWith('..')) {
      throw new ValidationError(
        `outputPath escapes the export root "${root}". Use an absolute path to write elsewhere.`,
        tool,
        { outputPath: target, exportRoot: root }
      );
    }
  }

  return withCorrectExtension(absolute, format, tool);
}

/**
 * Ensure the path carries an extension matching the export format.
 *
 * A missing extension is appended; a mismatched known extension is an error,
 * because silently writing PNG bytes to "icon.svg" breaks downstream tooling.
 */
function withCorrectExtension(absolutePath: string, format: ExportFormat, tool: string): string {
  const ext = extname(absolutePath).toLowerCase();
  const accepted = ACCEPTED_EXTENSIONS[format];

  if (ext === '') {
    return `${absolutePath}${EXPORT_FORMAT_META[format].ext}`;
  }
  if (accepted.includes(ext)) {
    return absolutePath;
  }

  const knownExtensions = Object.values(EXPORT_FORMAT_META).map((m) => m.ext);
  if (knownExtensions.includes(ext) || ext === '.jpeg') {
    throw new ValidationError(
      `outputPath extension "${ext}" does not match format ${format} (expected ${accepted.join(' or ')})`,
      tool,
      { outputPath: absolutePath, format }
    );
  }

  // Unknown extension (e.g. "icon.v2") — treat it as part of the name.
  return `${absolutePath}${EXPORT_FORMAT_META[format].ext}`;
}

/** Result of writing an export to disk. */
export interface WrittenExport {
  /** Absolute path of the written file. */
  filePath: string;
  /** Path relative to the export root, suitable for referencing in a project. */
  relativePath: string;
  /** Number of bytes written. */
  bytes: number;
}

/**
 * Decode base64 export data and write it to disk, creating parent directories.
 *
 * @param absolutePath - Fully resolved destination path
 * @param base64Data - Base64 payload from the Figma plugin
 * @param tool - Tool name for error attribution
 */
export async function writeExportFile(
  absolutePath: string,
  base64Data: string,
  tool: string
): Promise<WrittenExport> {
  const buffer = Buffer.from(base64Data, 'base64');

  if (buffer.byteLength === 0) {
    throw new ValidationError(
      'Export payload decoded to zero bytes — nothing was written',
      tool,
      { filePath: absolutePath },
      undefined,
      ErrorCode.OP_EXPORT_FAILED
    );
  }

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  const root = getExportRoot();
  const relativeToRoot = relative(root, absolutePath);

  return {
    filePath: absolutePath,
    relativePath: relativeToRoot.startsWith('..') ? absolutePath : relativeToRoot,
    bytes: buffer.byteLength
  };
}

/** Decode a base64 payload produced from UTF-8 text (SVG). */
export function decodeTextExport(base64Data: string): string {
  return Buffer.from(base64Data, 'base64').toString('utf8');
}

/** Join a directory and file name into an absolute path under the export root. */
export function resolveOutputDir(dir: string, tool: string): string {
  const trimmed = dir.trim();

  if (trimmed.length === 0) {
    throw new ValidationError('outputDir must not be empty', tool, { outputDir: dir });
  }
  if (trimmed.includes('\0')) {
    throw new ValidationError('outputDir must not contain null bytes', tool, { outputDir: dir });
  }

  const root = getExportRoot();
  const absolute = isAbsolute(trimmed) ? resolve(trimmed) : resolve(root, trimmed);

  if (!isAbsolute(trimmed) && relative(root, absolute).startsWith('..')) {
    throw new ValidationError(
      `outputDir escapes the export root "${root}". Use an absolute path to write elsewhere.`,
      tool,
      { outputDir: dir, exportRoot: root }
    );
  }

  return absolute;
}

/** Compose a directory and file name, keeping the result inside that directory. */
export function joinOutputDir(directory: string, fileName: string, tool: string): string {
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('\0')) {
    throw new ValidationError(`File name must not contain path separators: "${fileName}"`, tool, {
      fileName
    });
  }
  return join(directory, fileName);
}
