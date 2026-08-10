/**
 * Figma Plugin Export Handlers — Unit Tests
 *
 * Exercises the real plugin handlers against a small Figma API mock. These
 * cover the plugin half of the export path: which ExportSettings reach
 * exportAsync, and what the response envelope carries back over the bridge.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockExportableNode {
  id: string;
  type: string;
  name: string;
  width: number;
  height: number;
  exportSettings: unknown[];
  exportAsync: ReturnType<typeof vi.fn>;
}

const { cacheNode, resetNodeCache } = await import('../../figma-plugin/src/helpers.js');
const { handleExportNode, handleSetExportSettings } =
  await import('../../figma-plugin/src/handlers/utility.js');

let node: MockExportableNode;
let exportedBytes: Uint8Array;

/** Register a mock node in both the plugin cache and figma.getNodeById. */
function registerNode(overrides: Partial<MockExportableNode> = {}): MockExportableNode {
  const mock: MockExportableNode = {
    id: 'node-1',
    type: 'FRAME',
    name: 'Header Icon',
    width: 110,
    height: 99,
    exportSettings: [],
    exportAsync: vi.fn(() => Promise.resolve(exportedBytes)),
    ...overrides
  };
  cacheNode(mock as unknown as SceneNode);
  return mock;
}

beforeEach(() => {
  resetNodeCache();
  exportedBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x01, 0x02, 0x03]);
  node = registerNode();

  (globalThis as Record<string, unknown>)['figma'] = {
    getNodeById: vi.fn(() => null),
    base64Encode: vi.fn((bytes: Uint8Array) => Buffer.from(bytes).toString('base64'))
  };
});

// ─── handleExportNode ───────────────────────────────────────────────────────

describe('handleExportNode — export settings', () => {
  it('applies the scale constraint for PNG', async () => {
    await handleExportNode({ nodeId: 'node-1', format: 'PNG', scale: 2 });

    expect(node.exportAsync).toHaveBeenCalledWith({
      format: 'PNG',
      constraint: { type: 'SCALE', value: 2 }
    });
  });

  it('applies the scale constraint for JPG', async () => {
    await handleExportNode({ nodeId: 'node-1', format: 'JPG', scale: 3 });

    expect(node.exportAsync).toHaveBeenCalledWith({
      format: 'JPG',
      constraint: { type: 'SCALE', value: 3 }
    });
  });

  it('exports PDF as PDF rather than falling back to PNG', async () => {
    const result = await handleExportNode({ nodeId: 'node-1', format: 'PDF' });

    expect(node.exportAsync).toHaveBeenCalledWith({ format: 'PDF' });
    expect(result.format).toBe('PDF');
    expect(result.mimeType).toBe('application/pdf');
  });

  it('omits the constraint for SVG, which cannot carry one', async () => {
    await handleExportNode({ nodeId: 'node-1', format: 'SVG', scale: 2 });

    expect(node.exportAsync).toHaveBeenCalledWith({ format: 'SVG' });
  });

  it('reports that scale was not applied for SVG and PDF', async () => {
    const svg = await handleExportNode({ nodeId: 'node-1', format: 'SVG', scale: 2 });
    expect(svg.scaleApplied).toBe(false);
    expect(svg.scale).toBe(1);
    expect(svg.requestedScale).toBe(2);
    expect(String(svg.warning)).toContain('does not support scaling');

    const pdf = await handleExportNode({ nodeId: 'node-1', format: 'PDF', scale: 4 });
    expect(pdf.scaleApplied).toBe(false);
    expect(pdf.scale).toBe(1);
  });

  it('does not warn when a scaleless format is exported at 1x', async () => {
    const result = await handleExportNode({ nodeId: 'node-1', format: 'SVG' });
    expect(result.warning).toBeUndefined();
  });

  it('defaults to PNG at 1x', async () => {
    const result = await handleExportNode({ nodeId: 'node-1' });

    expect(node.exportAsync).toHaveBeenCalledWith({
      format: 'PNG',
      constraint: { type: 'SCALE', value: 1 }
    });
    expect(result.format).toBe('PNG');
    expect(result.scale).toBe(1);
  });

  it('forwards contentsOnly and useAbsoluteBounds', async () => {
    await handleExportNode({
      nodeId: 'node-1',
      format: 'PNG',
      scale: 1,
      contentsOnly: false,
      useAbsoluteBounds: true
    });

    expect(node.exportAsync).toHaveBeenCalledWith({
      format: 'PNG',
      constraint: { type: 'SCALE', value: 1 },
      contentsOnly: false,
      useAbsoluteBounds: true
    });
  });
});

describe('handleExportNode — response envelope', () => {
  it('returns base64 data, size and dimensions by default', async () => {
    const result = await handleExportNode({ nodeId: 'node-1', format: 'PNG' });

    expect(result.base64Data).toBe(Buffer.from(exportedBytes).toString('base64'));
    expect(result.byteLength).toBe(exportedBytes.length);
    expect(result.mimeType).toBe('image/png');
    expect(result.nodeName).toBe('Header Icon');
    expect(result.nodeType).toBe('FRAME');
    expect(result.width).toBe(110);
    expect(result.height).toBe(99);
  });

  it('omits base64Data rather than returning null when not requested', async () => {
    const result = await handleExportNode({
      nodeId: 'node-1',
      format: 'PNG',
      returnBase64: false
    });

    expect('base64Data' in result).toBe(false);
    expect(result.byteLength).toBe(exportedBytes.length);
  });

  it('reports the JPG MIME type', async () => {
    const result = await handleExportNode({ nodeId: 'node-1', format: 'JPG' });
    expect(result.mimeType).toBe('image/jpeg');
  });
});

describe('handleExportNode — failures', () => {
  it('names the missing node in the error', async () => {
    await expect(handleExportNode({ nodeId: 'ghost', format: 'PNG' })).rejects.toThrow(
      'Node not found: ghost'
    );
  });

  it('rejects an unsupported format at the schema boundary', async () => {
    await expect(handleExportNode({ nodeId: 'node-1', format: 'WEBP' })).rejects.toThrow();
  });

  it('rejects exports too large to cross the bridge with actionable guidance', async () => {
    exportedBytes = new Uint8Array(8 * 1024 * 1024);

    await expect(handleExportNode({ nodeId: 'node-1', format: 'PNG', scale: 4 })).rejects.toThrow(
      /Export too large to transfer: 8\.0MB exceeds the 7MB bridge limit/
    );
  });

  it('still reports size when the payload is too large but data was not requested', async () => {
    exportedBytes = new Uint8Array(8 * 1024 * 1024);

    const result = await handleExportNode({
      nodeId: 'node-1',
      format: 'PNG',
      returnBase64: false
    });

    expect(result.byteLength).toBe(8 * 1024 * 1024);
    expect('base64Data' in result).toBe(false);
  });
});

// ─── handleSetExportSettings ────────────────────────────────────────────────

describe('handleSetExportSettings', () => {
  it('turns scale into a SCALE constraint instead of dropping it', () => {
    const result = handleSetExportSettings({
      nodeId: 'node-1',
      settings: [
        { format: 'PNG', suffix: '', scale: 1 },
        { format: 'PNG', suffix: '@2x', scale: 2 },
        { format: 'PNG', suffix: '@3x', scale: 3 }
      ]
    });

    expect(result.settingsCount).toBe(3);
    expect(node.exportSettings).toEqual([
      { format: 'PNG', constraint: { type: 'SCALE', value: 1 }, suffix: '' },
      { format: 'PNG', constraint: { type: 'SCALE', value: 2 }, suffix: '@2x' },
      { format: 'PNG', constraint: { type: 'SCALE', value: 3 }, suffix: '@3x' }
    ]);
  });

  it('honours an explicit constraint over scale', () => {
    handleSetExportSettings({
      nodeId: 'node-1',
      settings: [{ format: 'PNG', scale: 2, constraint: { type: 'WIDTH', value: 512 } }]
    });

    expect(node.exportSettings).toEqual([
      { format: 'PNG', constraint: { type: 'WIDTH', value: 512 } }
    ]);
  });

  it('omits the constraint for SVG and PDF presets', () => {
    handleSetExportSettings({
      nodeId: 'node-1',
      settings: [
        { format: 'SVG', suffix: '', scale: 2 },
        { format: 'PDF', suffix: '-print', scale: 2 }
      ]
    });

    expect(node.exportSettings).toEqual([
      { format: 'SVG', suffix: '' },
      { format: 'PDF', suffix: '-print' }
    ]);
  });

  it('defaults to a 1x PNG preset', () => {
    handleSetExportSettings({ nodeId: 'node-1', settings: [{}] });

    expect(node.exportSettings).toEqual([
      { format: 'PNG', constraint: { type: 'SCALE', value: 1 } }
    ]);
  });

  it('echoes the applied settings for verification', () => {
    const result = handleSetExportSettings({
      nodeId: 'node-1',
      settings: [{ format: 'PNG', suffix: '@2x', scale: 2 }]
    });

    expect(result.applied).toEqual([
      { format: 'PNG', suffix: '@2x', constraint: { type: 'SCALE', value: 2 } }
    ]);
  });

  it('rejects an empty settings array', () => {
    expect(() => handleSetExportSettings({ nodeId: 'node-1', settings: [] })).toThrow();
  });

  it('rejects a node that cannot hold export settings', () => {
    resetNodeCache();
    registerNode({ id: 'no-export', type: 'SLICE_LIKE' } as Partial<MockExportableNode>);
    const bare = { id: 'bare', type: 'PAGE', name: 'Page 1' };
    cacheNode(bare as unknown as SceneNode);

    expect(() =>
      handleSetExportSettings({ nodeId: 'bare', settings: [{ format: 'PNG' }] })
    ).toThrow(/does not support export settings/);
  });
});
