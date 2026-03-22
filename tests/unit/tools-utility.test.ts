/**
 * Utility Tools Tests
 *
 * Tests execute functions for: set_visible, set_locked, set_export_settings,
 * export_node, set_plugin_data, get_plugin_data, create_page, list_pages, set_current_page
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the figma bridge
vi.mock('../../mcp-server/src/figma-bridge.js', () => {
  const mockBridge = {
    isConnected: vi.fn(() => true),
    sendToFigma: vi.fn(),
    sendToFigmaWithRetry: vi.fn(),
    sendToFigmaValidated: vi.fn(),
    sendToFigmaWithAbort: vi.fn(),
    getConnectionStatus: vi.fn(() => ({
      connected: true,
      pendingRequests: 0,
      circuitBreakerState: 'CLOSED',
      reconnectAttempts: 0
    })),
    connect: vi.fn(),
    disconnect: vi.fn()
  };

  return {
    getFigmaBridge: () => mockBridge,
    FigmaBridge: vi.fn(() => mockBridge),
    __mockBridge: mockBridge
  };
});

const { setVisible } = await import('../../mcp-server/src/tools/set_visible.js');
const { setLocked } = await import('../../mcp-server/src/tools/set_locked.js');
const { setExportSettings } = await import('../../mcp-server/src/tools/set_export_settings.js');
const { exportNode } = await import('../../mcp-server/src/tools/export_node.js');
const { setPluginData } = await import('../../mcp-server/src/tools/set_plugin_data.js');
const { getPluginData } = await import('../../mcp-server/src/tools/get_plugin_data.js');
const { createPage } = await import('../../mcp-server/src/tools/create_page.js');
const { listPages } = await import('../../mcp-server/src/tools/list_pages.js');
const { setCurrentPage } = await import('../../mcp-server/src/tools/set_current_page.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigmaWithRetry: ReturnType<typeof vi.fn>;
    sendToFigmaValidated: ReturnType<typeof vi.fn>;
  };
};

// ─── setVisible ──────────────────────────────────────────────────────────────

describe('setVisible', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaWithRetry.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hides a node and returns hidden CSS equivalent', async () => {
    const result = await setVisible({ nodeId: 'node-1', visible: false });

    expect(result.nodeId).toBe('node-1');
    expect(result.visible).toBe(false);
    expect(result.cssEquivalent).toContain('visibility: hidden;');
    expect(result.message).toBe('Hid node');
  });

  it('shows a node and returns visible CSS equivalent', async () => {
    const result = await setVisible({ nodeId: 'node-2', visible: true });

    expect(result.nodeId).toBe('node-2');
    expect(result.visible).toBe(true);
    expect(result.cssEquivalent).toBe('visibility: visible;');
    expect(result.message).toBe('Showed node');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaWithRetry.mockRejectedValue(new Error('Node not found'));

    await expect(setVisible({ nodeId: 'bad-id', visible: true })).rejects.toThrow('Node not found');
  });
});

// ─── setLocked ───────────────────────────────────────────────────────────────

describe('setLocked', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaWithRetry.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('locks a node and returns lock message', async () => {
    const result = await setLocked({ nodeId: 'node-1', locked: true });

    expect(result.nodeId).toBe('node-1');
    expect(result.locked).toBe(true);
    expect(result.message).toContain('Locked node');
  });

  it('unlocks a node and returns unlock message', async () => {
    const result = await setLocked({ nodeId: 'node-2', locked: false });

    expect(result.locked).toBe(false);
    expect(result.message).toContain('Unlocked node');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaWithRetry.mockRejectedValue(new Error('Connection lost'));

    await expect(setLocked({ nodeId: 'x', locked: true })).rejects.toThrow('Connection lost');
  });
});

// ─── setExportSettings ───────────────────────────────────────────────────────

describe('setExportSettings', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaWithRetry.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('configures multiple export settings and returns count', async () => {
    const result = await setExportSettings({
      nodeId: 'icon-1',
      settings: [
        { format: 'PNG', suffix: '', scale: 1 },
        { format: 'PNG', suffix: '@2x', scale: 2 },
        { format: 'SVG', scale: 1 }
      ]
    });

    expect(result.nodeId).toBe('icon-1');
    expect(result.settingsCount).toBe(3);
    expect(result.message).toContain('3 export setting(s)');
  });

  it('configures a single export setting', async () => {
    const result = await setExportSettings({
      nodeId: 'logo-1',
      settings: [{ format: 'PDF', suffix: '-print', scale: 1 }]
    });

    expect(result.settingsCount).toBe(1);
    expect(result.message).toContain('1 export setting(s)');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaWithRetry.mockRejectedValue(new Error('Timeout'));

    await expect(
      setExportSettings({
        nodeId: 'x',
        settings: [{ format: 'PNG', scale: 1 }]
      })
    ).rejects.toThrow('Timeout');
  });
});

// ─── exportNode ──────────────────────────────────────────────────────────────

describe('exportNode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports a node and returns base64 data', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      base64Data: 'iVBORw0KGgoAAAANSUhEUg=='
    });

    const result = await exportNode({
      nodeId: 'icon-1',
      format: 'PNG',
      scale: 2,
      returnBase64: true
    });

    expect(result.nodeId).toBe('icon-1');
    expect(result.format).toBe('PNG');
    expect(result.scale).toBe(2);
    expect(result.base64Data).toBe('iVBORw0KGgoAAAANSUhEUg==');
    expect(result.message).toBe('Exported node as PNG at 2x');
  });

  it('reports 1x scale label when scale is 1', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      base64Data: 'data'
    });

    const result = await exportNode({
      nodeId: 'logo-1',
      format: 'SVG',
      scale: 1,
      returnBase64: true
    });

    expect(result.message).toBe('Exported node as SVG at 1x');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Export failed'));

    await expect(
      exportNode({ nodeId: 'x', format: 'PNG', scale: 1, returnBase64: true })
    ).rejects.toThrow('Export failed');
  });
});

// ─── setPluginData ───────────────────────────────────────────────────────────

describe('setPluginData', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaWithRetry.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores plugin data and returns confirmation', async () => {
    const result = await setPluginData({
      nodeId: 'btn-1',
      key: 'version',
      value: '2.1.0'
    });

    expect(result.nodeId).toBe('btn-1');
    expect(result.key).toBe('version');
    expect(result.message).toContain('version');
    expect(result.message).toContain('Stored plugin data');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaWithRetry.mockRejectedValue(new Error('Write failed'));

    await expect(setPluginData({ nodeId: 'x', key: 'k', value: 'v' })).rejects.toThrow(
      'Write failed'
    );
  });
});

// ─── getPluginData ───────────────────────────────────────────────────────────

describe('getPluginData', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retrieves plugin data with a value', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      value: 'color.text.primary'
    });

    const result = await getPluginData({ nodeId: 'text-1', key: 'token' });

    expect(result.nodeId).toBe('text-1');
    expect(result.key).toBe('token');
    expect(result.value).toBe('color.text.primary');
    expect(result.message).toContain('Retrieved plugin data');
  });

  it('returns empty string when key does not exist', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      value: undefined
    });

    const result = await getPluginData({ nodeId: 'text-1', key: 'nonexistent' });

    expect(result.value).toBe('');
    expect(result.message).toContain('No data found');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Read failed'));

    await expect(getPluginData({ nodeId: 'x', key: 'k' })).rejects.toThrow('Read failed');
  });
});

// ─── createPage ──────────────────────────────────────────────────────────────

describe('createPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a page and returns page info with timestamp', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      pageId: 'page-abc',
      name: 'User Flow',
      message: 'Created'
    });

    const result = await createPage({ name: 'User Flow' });

    expect(result.success).toBe(true);
    expect(result.pageId).toBe('page-abc');
    expect(result.name).toBe('User Flow');
    expect(result.message).toContain('User Flow');
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Cannot create page'));

    await expect(createPage({ name: 'Test' })).rejects.toThrow('Cannot create page');
  });
});

// ─── listPages ───────────────────────────────────────────────────────────────

describe('listPages', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns list of pages with count', async () => {
    const mockPages = [
      { pageId: 'p1', name: 'Home', isCurrent: true },
      { pageId: 'p2', name: 'Settings', isCurrent: false }
    ];
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      pages: mockPages,
      message: 'OK'
    });

    const result = await listPages({});

    expect(result.success).toBe(true);
    expect(result.pageCount).toBe(2);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].pageId).toBe('p1');
    expect(result.pages[0].isCurrent).toBe(true);
    expect(result.pages[1].name).toBe('Settings');
    expect(result.message).toContain('2 page(s)');
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('handles empty document with zero pages', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      pages: [],
      message: 'OK'
    });

    const result = await listPages({});

    expect(result.pageCount).toBe(0);
    expect(result.pages).toHaveLength(0);
    expect(result.message).toContain('0 page(s)');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Plugin unavailable'));

    await expect(listPages({})).rejects.toThrow('Plugin unavailable');
  });
});

// ─── setCurrentPage ──────────────────────────────────────────────────────────

describe('setCurrentPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('switches page and returns page name from response', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      pageName: 'Mobile Screens'
    });

    const result = await setCurrentPage({ pageId: 'p2' });

    expect(result.pageId).toBe('p2');
    expect(result.pageName).toBe('Mobile Screens');
    expect(result.message).toContain('Mobile Screens');
  });

  it('returns generic message when pageName is absent', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true
    });

    const result = await setCurrentPage({ pageId: 'p3' });

    expect(result.pageId).toBe('p3');
    expect(result.pageName).toBeUndefined();
    expect(result.message).toBe('Page switched successfully');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Page not found'));

    await expect(setCurrentPage({ pageId: 'bad' })).rejects.toThrow('Page not found');
  });
});
