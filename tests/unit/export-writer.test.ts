/**
 * Export Writer — Unit Tests
 *
 * Covers path resolution, extension handling, file-name derivation and the
 * base64 → disk write used by export_node and export_nodes.
 */

import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetConfig } from '../../mcp-server/src/config.js';
import {
  buildFileName,
  decodeTextExport,
  EXPORT_FORMAT_META,
  getExportRoot,
  getMaxInlineBytes,
  isTextFormat,
  joinOutputDir,
  resolveOutputDir,
  resolveOutputPath,
  scaleSuffix,
  slugifyNodeName,
  writeExportFile
} from '../../mcp-server/src/utils/export-writer.js';

const TOOL = 'export_node';

let root: string;
const createdRoots: string[] = [];

beforeEach(async () => {
  resetConfig();
  root = await mkdtemp(join(tmpdir(), 'ttf-export-'));
  createdRoots.push(root);
  process.env.EXPORT_OUTPUT_DIR = root;
  delete process.env.EXPORT_MAX_INLINE_BYTES;
});

afterEach(() => {
  delete process.env.EXPORT_OUTPUT_DIR;
  delete process.env.EXPORT_MAX_INLINE_BYTES;
  resetConfig();
});

afterAll(async () => {
  await Promise.all(createdRoots.map((dir) => rm(dir, { recursive: true, force: true })));
});

// ─── configuration fallbacks ────────────────────────────────────────────────

describe('getExportRoot', () => {
  it('uses EXPORT_OUTPUT_DIR when configuration is not loaded', () => {
    expect(getExportRoot()).toBe(root);
  });

  it('falls back to the working directory when unset', () => {
    delete process.env.EXPORT_OUTPUT_DIR;
    expect(getExportRoot()).toBe(process.cwd());
  });
});

describe('getMaxInlineBytes', () => {
  it('defaults to 1MB', () => {
    expect(getMaxInlineBytes()).toBe(1024 * 1024);
  });

  it('honours EXPORT_MAX_INLINE_BYTES', () => {
    process.env.EXPORT_MAX_INLINE_BYTES = '2048';
    expect(getMaxInlineBytes()).toBe(2048);
  });

  it('ignores non-positive overrides', () => {
    process.env.EXPORT_MAX_INLINE_BYTES = '-5';
    expect(getMaxInlineBytes()).toBe(1024 * 1024);
  });
});

// ─── naming ─────────────────────────────────────────────────────────────────

describe('slugifyNodeName', () => {
  it('lowercases and hyphenates layer names', () => {
    expect(slugifyNodeName('Header Icon')).toBe('header-icon');
  });

  it('collapses separators and strips edge punctuation', () => {
    expect(slugifyNodeName('  Icon // Primary  ')).toBe('icon-primary');
  });

  it('replaces path separators so names cannot traverse directories', () => {
    expect(slugifyNodeName('../../etc/passwd')).toBe('etc-passwd');
  });

  it('falls back when nothing usable remains', () => {
    expect(slugifyNodeName('🎉🎉', 'node')).toBe('node');
  });

  it('caps length to keep paths reasonable', () => {
    expect(slugifyNodeName('a'.repeat(120)).length).toBe(60);
  });
});

describe('scaleSuffix', () => {
  it('omits a suffix at 1x', () => {
    expect(scaleSuffix(1)).toBe('');
  });

  it('uses the conventional @Nx suffix', () => {
    expect(scaleSuffix(2)).toBe('@2x');
    expect(scaleSuffix(3)).toBe('@3x');
  });

  it('keeps fractional scales filesystem-safe', () => {
    expect(scaleSuffix(1.5)).toBe('@1_5x');
  });
});

describe('buildFileName', () => {
  it('combines slug, scale suffix and extension', () => {
    expect(buildFileName({ nodeName: 'Header Icon', nodeId: '1:2', format: 'PNG', scale: 2 })).toBe(
      'header-icon@2x.png'
    );
  });

  it('falls back to the node ID when the name yields no slug', () => {
    expect(buildFileName({ nodeName: '///', nodeId: '2486:4475', format: 'SVG', scale: 1 })).toBe(
      '2486-4475.svg'
    );
  });
});

// ─── path resolution ────────────────────────────────────────────────────────

describe('resolveOutputPath', () => {
  it('resolves relative paths against the export root', () => {
    expect(resolveOutputPath('public/icon.png', 'PNG', TOOL)).toBe(
      resolve(root, 'public/icon.png')
    );
  });

  it('appends the format extension when missing', () => {
    expect(resolveOutputPath('public/icon', 'PNG', TOOL)).toBe(resolve(root, 'public/icon.png'));
  });

  it('accepts .jpeg for JPG without rewriting it', () => {
    expect(resolveOutputPath('photo.jpeg', 'JPG', TOOL)).toBe(resolve(root, 'photo.jpeg'));
  });

  it('rejects an extension that contradicts the format', () => {
    expect(() => resolveOutputPath('icon.svg', 'PNG', TOOL)).toThrow(/does not match format PNG/);
  });

  it('treats an unknown extension as part of the name', () => {
    expect(resolveOutputPath('icon.v2', 'PNG', TOOL)).toBe(resolve(root, 'icon.v2.png'));
  });

  it('rejects relative traversal outside the export root', () => {
    expect(() => resolveOutputPath('../outside/icon.png', 'PNG', TOOL)).toThrow(
      /escapes the export root/
    );
  });

  it('allows absolute paths so assets can be written into a project', () => {
    const target = join(tmpdir(), 'ttf-abs-target', 'icon.png');
    expect(resolveOutputPath(target, 'PNG', TOOL)).toBe(resolve(target));
  });

  it('rejects empty paths', () => {
    expect(() => resolveOutputPath('   ', 'PNG', TOOL)).toThrow(/must not be empty/);
  });

  it('rejects directory-looking paths', () => {
    expect(() => resolveOutputPath(`assets${sep}`, 'PNG', TOOL)).toThrow(/not a directory/);
  });

  it('rejects null bytes', () => {
    expect(() => resolveOutputPath('icon\0.png', 'PNG', TOOL)).toThrow(/null bytes/);
  });
});

describe('resolveOutputDir', () => {
  it('resolves relative directories against the export root', () => {
    expect(resolveOutputDir('public/assets', TOOL)).toBe(resolve(root, 'public/assets'));
  });

  it('rejects traversal outside the export root', () => {
    expect(() => resolveOutputDir('../elsewhere', TOOL)).toThrow(/escapes the export root/);
  });

  it('rejects empty directories', () => {
    expect(() => resolveOutputDir('  ', TOOL)).toThrow(/must not be empty/);
  });
});

describe('joinOutputDir', () => {
  it('joins a directory and file name', () => {
    expect(joinOutputDir(root, 'icon.png', TOOL)).toBe(join(root, 'icon.png'));
  });

  it('rejects file names containing separators', () => {
    expect(() => joinOutputDir(root, '../icon.png', TOOL)).toThrow(/path separators/);
  });
});

// ─── writing ────────────────────────────────────────────────────────────────

describe('writeExportFile', () => {
  it('writes decoded bytes and creates missing directories', async () => {
    const payload = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const target = join(root, 'nested', 'deep', 'icon.png');

    const written = await writeExportFile(target, payload.toString('base64'), TOOL);

    expect(written.filePath).toBe(target);
    expect(written.relativePath).toBe(join('nested', 'deep', 'icon.png'));
    expect(written.bytes).toBe(payload.byteLength);

    const onDisk = await readFile(target);
    expect(onDisk.equals(payload)).toBe(true);
    expect((await stat(target)).size).toBe(payload.byteLength);
  });

  it('reports the absolute path when the target sits outside the export root', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'ttf-outside-'));
    createdRoots.push(outside);
    const target = join(outside, 'icon.png');

    const written = await writeExportFile(target, Buffer.from('abc').toString('base64'), TOOL);

    expect(written.relativePath).toBe(target);
  });

  it('rejects a payload that decodes to nothing', async () => {
    await expect(writeExportFile(join(root, 'empty.png'), '', TOOL)).rejects.toThrow(/zero bytes/);
  });
});

describe('decodeTextExport', () => {
  it('round-trips UTF-8 SVG source', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><title>Größe</title></svg>';
    expect(decodeTextExport(Buffer.from(svg, 'utf8').toString('base64'))).toBe(svg);
  });
});

describe('format metadata', () => {
  it('maps every format to an extension and MIME type', () => {
    expect(EXPORT_FORMAT_META.PNG).toEqual({ ext: '.png', mimeType: 'image/png' });
    expect(EXPORT_FORMAT_META.JPG).toEqual({ ext: '.jpg', mimeType: 'image/jpeg' });
    expect(EXPORT_FORMAT_META.SVG).toEqual({ ext: '.svg', mimeType: 'image/svg+xml' });
    expect(EXPORT_FORMAT_META.PDF).toEqual({ ext: '.pdf', mimeType: 'application/pdf' });
  });

  it('treats only SVG as text', () => {
    expect(isTextFormat('SVG')).toBe(true);
    expect(isTextFormat('PNG')).toBe(false);
    expect(isTextFormat('PDF')).toBe(false);
  });
});
