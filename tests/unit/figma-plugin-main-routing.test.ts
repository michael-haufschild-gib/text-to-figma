/**
 * Figma Plugin Main Entrypoint — Unit Tests
 *
 * Exercises the real plugin routing side effects: UI setup, serial message
 * handling, page context envelopes, and document/page-change notifications.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface MockPage {
  id: string;
  name: string;
}

interface FigmaMainMock {
  root: { id: string; name: string; children: MockPage[] };
  currentPage: MockPage;
  ui: {
    onmessage?: (msg: Record<string, unknown>) => void;
    postMessage: ReturnType<typeof vi.fn>;
  };
  showUI: ReturnType<typeof vi.fn>;
  loadFontAsync: ReturnType<typeof vi.fn>;
  setCurrentPageAsync: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
}

let figmaMock: FigmaMainMock;
let eventHandlers: Record<string, () => void>;

async function importPluginMain(): Promise<void> {
  vi.resetModules();
  (globalThis as Record<string, unknown>)['__html__'] = '<html></html>';
  (globalThis as Record<string, unknown>)['__PLUGIN_VERSION__'] = 'test-version';
  await import('../../figma-plugin/src/main.js');
}

async function flushQueue(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  const pageOne = { id: 'page-1', name: 'Page 1' };
  const pageTwo = { id: 'page-2', name: 'Page 2' };
  eventHandlers = {};
  figmaMock = {
    root: { id: 'root', name: 'Design File', children: [pageOne, pageTwo] },
    currentPage: pageOne,
    ui: { postMessage: vi.fn() },
    showUI: vi.fn(),
    loadFontAsync: vi.fn().mockResolvedValue(undefined),
    setCurrentPageAsync: vi.fn((page: MockPage) => {
      figmaMock.currentPage = page;
      return Promise.resolve();
    }),
    on: vi.fn((event: string, handler: () => void) => {
      eventHandlers[event] = handler;
    })
  };
  (globalThis as Record<string, unknown>)['figma'] = figmaMock;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (globalThis as Record<string, unknown>)['figma'];
  delete (globalThis as Record<string, unknown>)['__html__'];
  delete (globalThis as Record<string, unknown>)['__PLUGIN_VERSION__'];
});

describe('plugin startup', () => {
  it('shows the plugin UI, preloads common fonts, and registers change listeners', async () => {
    await importPluginMain();
    await flushQueue();

    expect(figmaMock.showUI).toHaveBeenCalledWith('<html></html>', { width: 400, height: 300 });
    expect(figmaMock.loadFontAsync).toHaveBeenCalledWith({ family: 'Inter', style: 'Regular' });
    expect(figmaMock.on).toHaveBeenCalledWith('documentchange', expect.any(Function));
    expect(figmaMock.on).toHaveBeenCalledWith('currentpagechange', expect.any(Function));
  });
});

describe('message routing', () => {
  it('routes ping responses with request ids and current page/file context', async () => {
    await importPluginMain();

    figmaMock.ui.onmessage?.({ type: 'ping', requestId: 'req-1' });
    await flushQueue();

    const anyTimestamp = expect.any(Number) as unknown as number;
    expect(figmaMock.ui.postMessage).toHaveBeenCalledWith({
      id: 'req-1',
      success: true,
      data: {
        pong: true,
        timestamp: anyTimestamp,
        pluginVersion: 'test-version',
        fileName: 'Design File',
        currentPage: 'Page 1'
      },
      _ctx: { pageId: 'page-1', pageName: 'Page 1', fileName: 'Design File' }
    });
  });

  it('switches to the requested page before executing a command and creating the context envelope', async () => {
    await importPluginMain();

    figmaMock.ui.onmessage?.({ type: 'ping', requestId: 'req-2', _pageId: 'page-2' });
    await flushQueue();

    expect(figmaMock.setCurrentPageAsync).toHaveBeenCalledWith({
      id: 'page-2',
      name: 'Page 2'
    });
    const pageTwoDataMatcher = expect.objectContaining({
      currentPage: 'Page 2'
    }) as unknown as Record<string, unknown>;
    expect(figmaMock.ui.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'req-2',
        success: true,
        data: pageTwoDataMatcher,
        _ctx: { pageId: 'page-2', pageName: 'Page 2', fileName: 'Design File' }
      })
    );
  });

  it('returns structured errors for missing message types', async () => {
    await importPluginMain();

    figmaMock.ui.onmessage?.({ requestId: 'bad-1' });
    await flushQueue();

    expect(figmaMock.ui.postMessage).toHaveBeenCalledWith({
      id: 'bad-1',
      success: false,
      error: 'Missing or invalid message type',
      _ctx: { pageId: 'page-1', pageName: 'Page 1', fileName: 'Design File' }
    });
  });
});

describe('change notifications', () => {
  it('debounces document changes and includes the current context', async () => {
    vi.useFakeTimers();
    await importPluginMain();

    eventHandlers['documentchange']?.();
    eventHandlers['documentchange']?.();
    vi.advanceTimersByTime(1999);
    expect(figmaMock.ui.postMessage).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(figmaMock.ui.postMessage).toHaveBeenCalledWith({
      type: 'figma_notification',
      kind: 'document_changed',
      data: { _ctx: { pageId: 'page-1', pageName: 'Page 1', fileName: 'Design File' } }
    });
  });

  it('sends page-change notifications immediately for manual page switches', async () => {
    await importPluginMain();
    figmaMock.currentPage = figmaMock.root.children[1]!;

    eventHandlers['currentpagechange']?.();

    expect(figmaMock.ui.postMessage).toHaveBeenCalledWith({
      type: 'figma_notification',
      kind: 'page_changed',
      data: { _ctx: { pageId: 'page-2', pageName: 'Page 2', fileName: 'Design File' } }
    });
  });
});
