/**
 * Export Tools — Unit Tests
 *
 * Covers export_node and export_nodes: how export payloads reach the caller
 * (inline data, SVG source, image blocks, files on disk) and how the tools
 * behave when the plugin omits data or the payload is too large to inline.
 */

import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../../mcp-server/src/figma-bridge.js', () => {
  const mockBridge = {
    isConnected: vi.fn(() => true),
    sendToFigma: vi.fn(),
    sendToFigmaWithRetry: vi.fn(),
    sendToFigmaValidated: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn()
  };

  return {
    FigmaAckResponseSchema: { parse: (v: unknown) => v },
    getFigmaBridge: () => mockBridge,
    FigmaBridge: vi.fn(() => mockBridge),
    __mockBridge: mockBridge
  };
});

const { resetConfig } = await import('../../mcp-server/src/config.js');
const { exportNode, formatExportNodeResponse, ExportNodeInputSchema } =
  await import('../../mcp-server/src/tools/export_node.js');
const { exportNodes, formatExportNodesResponse, ExportNodesInputSchema } =
  await import('../../mcp-server/src/tools/export_nodes.js');
/** The bridge call the export tools make; typed so mock implementations may be async. */
type SendToFigmaMock = Mock<(type: string, payload: Record<string, unknown>) => Promise<unknown>>;

const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as unknown as {
  __mockBridge: { sendToFigmaValidated: SendToFigmaMock };
};

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);
const SVG_SOURCE = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>';
const MIME_BY_FORMAT: Record<string, string> = {
  PNG: 'image/png',
  JPG: 'image/jpeg',
  SVG: 'image/svg+xml',
  PDF: 'application/pdf'
};

let root: string;
const createdRoots: string[] = [];

/** Build a plugin export response mirroring the real plugin handler. */
function pluginResponse(
  overrides: Record<string, unknown> = {},
  payload: Record<string, unknown> = {}
): Record<string, unknown> {
  const format = (payload.format as string) ?? 'PNG';
  const bytes = format === 'SVG' ? Buffer.from(SVG_SOURCE, 'utf8') : PNG_BYTES;
  const scaleApplied = format === 'PNG' || format === 'JPG';

  return {
    nodeId: payload.nodeId ?? 'node-1',
    nodeName: 'Header Icon',
    nodeType: 'FRAME',
    format,
    scale: scaleApplied ? ((payload.scale as number) ?? 1) : 1,
    scaleApplied,
    byteLength: bytes.byteLength,
    mimeType: MIME_BY_FORMAT[format] ?? 'image/png',
    width: 110,
    height: 99,
    ...(payload.returnBase64 === false ? {} : { base64Data: bytes.toString('base64') }),
    ...overrides
  };
}

/** Wire the mocked bridge to answer export_node like the plugin does. */
function mockPlugin(overrides: Record<string, unknown> = {}): void {
  __mockBridge.sendToFigmaValidated.mockImplementation(
    (_type: string, payload: Record<string, unknown>) =>
      Promise.resolve(pluginResponse(overrides, payload))
  );
}

/** Parse through the tool schema so defaults match production behaviour. */
function parseExportNodeInput(input: Record<string, unknown>) {
  return ExportNodeInputSchema.parse(input);
}

function parseExportNodesInput(input: Record<string, unknown>) {
  return ExportNodesInputSchema.parse(input);
}

beforeEach(async () => {
  resetConfig();
  root = await mkdtemp(join(tmpdir(), 'ttf-tool-export-'));
  createdRoots.push(root);
  process.env.EXPORT_OUTPUT_DIR = root;
  delete process.env.EXPORT_MAX_INLINE_BYTES;
  __mockBridge.sendToFigmaValidated.mockReset();
  mockPlugin();
});

afterEach(() => {
  delete process.env.EXPORT_OUTPUT_DIR;
  delete process.env.EXPORT_MAX_INLINE_BYTES;
  resetConfig();
  vi.clearAllMocks();
});

afterAll(async () => {
  await Promise.all(createdRoots.map((dir) => rm(dir, { recursive: true, force: true })));
});

// ─── export_node: inline data ───────────────────────────────────────────────

describe('exportNode — inline data', () => {
  it('returns base64 data when no destination is given', async () => {
    const result = await exportNode(parseExportNodeInput({ nodeId: 'node-1', format: 'PNG' }));

    expect(result.base64Data).toBe(PNG_BYTES.toString('base64'));
    expect(result.byteLength).toBe(PNG_BYTES.byteLength);
    expect(result.mimeType).toBe('image/png');
    expect(result.filePath).toBeUndefined();
  });

  it('puts the base64 payload in the MCP response instead of only its length', () => {
    const content = formatExportNodeResponse({
      nodeId: 'node-1',
      format: 'PNG',
      scale: 1,
      requestedScale: 1,
      byteLength: PNG_BYTES.byteLength,
      mimeType: 'image/png',
      base64Data: PNG_BYTES.toString('base64'),
      notes: [],
      message: 'Exported node as PNG at 1x'
    });

    const joined = content.map((c) => c.text ?? '').join('\n');
    expect(joined).toContain(PNG_BYTES.toString('base64'));
  });

  it('requests data from the plugin when returning it inline', async () => {
    await exportNode(parseExportNodeInput({ nodeId: 'node-1', format: 'PNG' }));

    const payload = __mockBridge.sendToFigmaValidated.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.returnBase64).toBe(true);
  });

  it('returns metadata only when the caller opts out of data', async () => {
    const result = await exportNode(
      parseExportNodeInput({ nodeId: 'node-1', format: 'PNG', returnBase64: false })
    );

    expect(result.base64Data).toBeUndefined();
    expect(result.svgText).toBeUndefined();
    expect(result.byteLength).toBe(PNG_BYTES.byteLength);

    const payload = __mockBridge.sendToFigmaValidated.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.returnBase64).toBe(false);
  });

  it('tolerates a null base64Data from older plugin builds', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      base64Data: null,
      byteLength: 0,
      format: 'PNG'
    });

    const result = await exportNode(
      parseExportNodeInput({ nodeId: 'node-1', format: 'PNG', returnBase64: false })
    );

    expect(result.base64Data).toBeUndefined();
    expect(result.message).toContain('Exported node as PNG');
  });

  it('fails with rebuild guidance when data is needed but missing', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({ format: 'PNG' });

    await expect(
      exportNode(parseExportNodeInput({ nodeId: 'node-1', format: 'PNG' }))
    ).rejects.toThrow(/Rebuild the plugin/);
  });

  it('omits inline data above the inline size limit and explains why', async () => {
    process.env.EXPORT_MAX_INLINE_BYTES = '4';

    const result = await exportNode(parseExportNodeInput({ nodeId: 'node-1', format: 'PNG' }));

    expect(result.base64Data).toBeUndefined();
    expect(result.notes.join(' ')).toMatch(/exceeds the .* inline limit/);
    expect(result.notes.join(' ')).toMatch(/outputPath/);
  });
});

// ─── export_node: SVG and PDF ───────────────────────────────────────────────

describe('exportNode — vector and print formats', () => {
  it('returns decoded SVG source rather than base64', async () => {
    const result = await exportNode(parseExportNodeInput({ nodeId: 'node-1', format: 'SVG' }));

    expect(result.svgText).toBe(SVG_SOURCE);
    expect(result.base64Data).toBeUndefined();
    expect(
      formatExportNodeResponse(result)
        .map((c) => c.text ?? '')
        .join('\n')
    ).toContain(SVG_SOURCE);
  });

  it('forwards PDF as PDF instead of silently exporting PNG', async () => {
    const result = await exportNode(parseExportNodeInput({ nodeId: 'node-1', format: 'PDF' }));

    const payload = __mockBridge.sendToFigmaValidated.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.format).toBe('PDF');
    expect(result.format).toBe('PDF');
    expect(result.mimeType).toBe('application/pdf');
  });

  it('surfaces the plugin warning when a format ignores scale', async () => {
    mockPlugin({ warning: 'Format SVG does not support scaling; exported at 1x.' });

    const result = await exportNode(
      parseExportNodeInput({ nodeId: 'node-1', format: 'SVG', scale: 3 })
    );

    expect(result.scale).toBe(1);
    expect(result.requestedScale).toBe(3);
    expect(result.notes.join(' ')).toContain('does not support scaling');
  });

  it('notes that image previews are unavailable for non-raster formats', async () => {
    const result = await exportNode(
      parseExportNodeInput({ nodeId: 'node-1', format: 'PDF', returnImage: true })
    );

    expect(result.image).toBeUndefined();
    expect(result.notes.join(' ')).toContain('only supported for PNG and JPG');
  });
});

// ─── export_node: files and image blocks ────────────────────────────────────

describe('exportNode — file output', () => {
  it('writes the export to disk and reports both paths', async () => {
    const result = await exportNode(
      parseExportNodeInput({
        nodeId: 'node-1',
        format: 'PNG',
        scale: 2,
        outputPath: 'public/images/icon@2x.png'
      })
    );

    const expected = resolve(root, 'public/images/icon@2x.png');
    expect(result.filePath).toBe(expected);
    expect(result.relativePath).toBe(join('public', 'images', 'icon@2x.png'));
    expect(result.byteLength).toBe(PNG_BYTES.byteLength);

    const onDisk = await readFile(expected);
    expect(onDisk.equals(PNG_BYTES)).toBe(true);
  });

  it('does not inline data by default once a file is written', async () => {
    const result = await exportNode(
      parseExportNodeInput({ nodeId: 'node-1', format: 'PNG', outputPath: 'icon.png' })
    );

    expect(result.base64Data).toBeUndefined();
    expect(result.filePath).toBe(resolve(root, 'icon.png'));
  });

  it('writes a file and inlines data when both are requested', async () => {
    const result = await exportNode(
      parseExportNodeInput({
        nodeId: 'node-1',
        format: 'PNG',
        outputPath: 'icon.png',
        returnBase64: true
      })
    );

    expect(result.base64Data).toBe(PNG_BYTES.toString('base64'));
    expect(result.filePath).toBe(resolve(root, 'icon.png'));
  });

  it('validates the output path before contacting Figma', async () => {
    await expect(
      exportNode(
        parseExportNodeInput({ nodeId: 'node-1', format: 'PNG', outputPath: '../escape.png' })
      )
    ).rejects.toThrow(/escapes the export root/);

    expect(__mockBridge.sendToFigmaValidated).not.toHaveBeenCalled();
  });

  it('returns a viewable image block when requested', async () => {
    const result = await exportNode(
      parseExportNodeInput({ nodeId: 'node-1', format: 'PNG', returnImage: true })
    );

    const content = formatExportNodeResponse(result);
    const image = content.find((c) => c.type === 'image');
    expect(image?.data).toBe(PNG_BYTES.toString('base64'));
    expect(image?.mimeType).toBe('image/png');
  });

  it('forwards contentsOnly and useAbsoluteBounds to the plugin', async () => {
    await exportNode(
      parseExportNodeInput({
        nodeId: 'node-1',
        format: 'PNG',
        contentsOnly: false,
        useAbsoluteBounds: true
      })
    );

    const payload = __mockBridge.sendToFigmaValidated.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.contentsOnly).toBe(false);
    expect(payload.useAbsoluteBounds).toBe(true);
  });

  it('omits optional flags when unset so Figma defaults apply', async () => {
    await exportNode(parseExportNodeInput({ nodeId: 'node-1', format: 'PNG' }));

    const payload = __mockBridge.sendToFigmaValidated.mock.calls[0]?.[1] as Record<string, unknown>;
    expect('contentsOnly' in payload).toBe(false);
    expect('useAbsoluteBounds' in payload).toBe(false);
  });
});

describe('exportNode — schema', () => {
  it('defaults to PNG at 1x', () => {
    const parsed = parseExportNodeInput({ nodeId: 'node-1' });
    expect(parsed.format).toBe('PNG');
    expect(parsed.scale).toBe(1);
    expect(parsed.returnImage).toBe(false);
  });

  it('rejects an empty nodeId', () => {
    expect(ExportNodeInputSchema.safeParse({ nodeId: '' }).success).toBe(false);
  });

  it('rejects an unsupported format', () => {
    expect(ExportNodeInputSchema.safeParse({ nodeId: 'n', format: 'WEBP' }).success).toBe(false);
  });

  it('rejects a non-positive scale', () => {
    expect(ExportNodeInputSchema.safeParse({ nodeId: 'n', scale: 0 }).success).toBe(false);
  });
});

// ─── export_nodes ───────────────────────────────────────────────────────────

describe('exportNodes', () => {
  it('writes one file per node using slugified layer names', async () => {
    __mockBridge.sendToFigmaValidated.mockImplementation(
      (_type: string, payload: Record<string, unknown>) =>
        Promise.resolve(
          pluginResponse({ nodeName: payload.nodeId === 'a' ? 'Collecting' : 'Breakable' }, payload)
        )
    );

    const result = await exportNodes(
      parseExportNodesInput({ nodeIds: ['a', 'b'], outputDir: 'assets/icons', format: 'PNG' })
    );

    expect(result.files.map((f) => f.relativePath)).toEqual([
      join('assets', 'icons', 'collecting.png'),
      join('assets', 'icons', 'breakable.png')
    ]);
    expect(result.failures).toEqual([]);
    expect(result.totalBytes).toBe(PNG_BYTES.byteLength * 2);
    expect(await readdir(join(root, 'assets', 'icons'))).toHaveLength(2);
  });

  it('writes an @2x variant for each requested scale', async () => {
    const result = await exportNodes(
      parseExportNodesInput({
        nodeIds: ['a'],
        outputDir: 'assets',
        format: 'PNG',
        scales: [1, 2]
      })
    );

    expect(result.files.map((f) => f.relativePath)).toEqual([
      join('assets', 'header-icon.png'),
      join('assets', 'header-icon@2x.png')
    ]);
    const scalesSent = __mockBridge.sendToFigmaValidated.mock.calls.map(
      (call) => (call[1] as Record<string, unknown>).scale
    );
    expect(scalesSent).toEqual([1, 2]);
  });

  it('disambiguates duplicate layer names instead of overwriting', async () => {
    const result = await exportNodes(
      parseExportNodesInput({ nodeIds: ['2486:1', '2486:2'], outputDir: 'assets', format: 'PNG' })
    );

    expect(result.files[0]?.relativePath).toBe(join('assets', 'header-icon.png'));
    expect(result.files[1]?.relativePath).toBe(join('assets', 'header-icon-2486-2.png'));
    expect(await readdir(join(root, 'assets'))).toHaveLength(2);
  });

  it('honours explicit file names', async () => {
    const result = await exportNodes(
      parseExportNodesInput({
        nodeIds: ['a', 'b'],
        outputDir: 'assets',
        format: 'PNG',
        fileNames: ['Coin Front', 'coin-back']
      })
    );

    expect(result.files.map((f) => f.relativePath)).toEqual([
      join('assets', 'coin-front.png'),
      join('assets', 'coin-back.png')
    ]);
  });

  it('collapses scales for formats without a size constraint', async () => {
    const result = await exportNodes(
      parseExportNodesInput({
        nodeIds: ['a'],
        outputDir: 'assets',
        format: 'SVG',
        scales: [1, 2, 3]
      })
    );

    expect(result.scales).toEqual([1]);
    expect(result.files).toHaveLength(1);
    expect(result.notes.join(' ')).toContain('does not support scaling');
  });

  it('records per-node failures and keeps going by default', async () => {
    __mockBridge.sendToFigmaValidated.mockImplementation(
      (_type: string, payload: Record<string, unknown>) =>
        payload.nodeId === 'bad'
          ? Promise.reject(new Error('Node not found: bad'))
          : Promise.resolve(pluginResponse({}, payload))
    );

    const result = await exportNodes(
      parseExportNodesInput({ nodeIds: ['bad', 'good'], outputDir: 'assets', format: 'PNG' })
    );

    expect(result.failures).toEqual([{ nodeId: 'bad', scale: 1, error: 'Node not found: bad' }]);
    expect(result.files).toHaveLength(1);
    expect(result.message).toContain('1 failed');
  });

  it('stops at the first failure when continueOnError is false', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('bridge down'));

    const result = await exportNodes(
      parseExportNodesInput({
        nodeIds: ['a', 'b', 'c'],
        outputDir: 'assets',
        format: 'PNG',
        continueOnError: false
      })
    );

    expect(result.failures).toHaveLength(1);
    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledTimes(1);
  });

  it('lists written files in the MCP response', async () => {
    const result = await exportNodes(
      parseExportNodesInput({ nodeIds: ['a'], outputDir: 'assets', format: 'PNG' })
    );

    const text = formatExportNodesResponse(result)[0]?.text ?? '';
    expect(text).toContain('Exported 1 file(s) as PNG');
    expect(text).toContain(join('assets', 'header-icon.png'));
  });

  it('rejects a fileNames array of the wrong length', () => {
    const parsed = ExportNodesInputSchema.safeParse({
      nodeIds: ['a', 'b'],
      outputDir: 'assets',
      fileNames: ['only-one']
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an empty nodeIds array', () => {
    expect(ExportNodesInputSchema.safeParse({ nodeIds: [], outputDir: 'assets' }).success).toBe(
      false
    );
  });

  it('always requests data from the plugin because it must write files', async () => {
    await exportNodes(
      parseExportNodesInput({ nodeIds: ['a'], outputDir: 'assets', format: 'PNG' })
    );

    const payload = __mockBridge.sendToFigmaValidated.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.returnBase64).toBe(true);
  });
});
