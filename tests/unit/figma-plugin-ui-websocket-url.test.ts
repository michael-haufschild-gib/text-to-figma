import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const storageKey = 'text-to-figma.wsUrl';

interface FakeElement {
  value?: string;
  textContent: string;
  className: string;
  children: FakeElement[];
  firstChild: FakeElement | null;
  scrollTop: number;
  scrollHeight: number;
  addEventListener: (
    event: string,
    handler: (event: { preventDefault: () => void }) => void
  ) => void;
  appendChild: (child: FakeElement) => void;
  removeChild: (child: FakeElement | null) => void;
}

interface Harness {
  input: FakeElement;
  submit: () => void;
  sockets: MockWebSocket[];
  storage: Map<string, string>;
  runDOMContentLoaded: () => void;
}

interface HarnessOptions {
  initialStorage?: Record<string, string>;
  bridgeUrls?: string[];
  nonBridgeUrls?: string[];
}

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;

  readonly sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((error: Error) => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = MockWebSocket.CONNECTING;

  constructor(
    readonly url: string,
    sockets: MockWebSocket[],
    getBehavior: (url: string) => 'bridge' | 'non-bridge' | 'closed'
  ) {
    sockets.push(this);
    setTimeout(() => {
      const behavior = getBehavior(url);
      if (behavior === 'bridge') {
        this.readyState = MockWebSocket.OPEN;
        this.onmessage?.({
          data: JSON.stringify({
            type: 'connection',
            server: 'text-to-figma-websocket-bridge',
            message: 'Connected to WebSocket bridge server'
          })
        });
        return;
      }

      if (behavior === 'non-bridge') {
        this.readyState = MockWebSocket.OPEN;
        this.onmessage?.({
          data: JSON.stringify({
            type: 'connection',
            server: 'other-project',
            message: 'Connected to another WebSocket server'
          })
        });
        return;
      }

      this.onerror?.(new Error(`No bridge at ${url}`));
      this.onclose?.();
    }, 0);
  }

  send(message: string): void {
    this.sent.push(message);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

function extractUiScript(): string {
  const html = readFileSync(resolve('figma-plugin/ui.html'), 'utf8');
  const match = /<script>([\s\S]*)<\/script>/.exec(html);
  if (!match) {
    throw new Error('figma-plugin/ui.html script block not found');
  }
  const script = match[1];
  if (script === undefined) {
    throw new Error('figma-plugin/ui.html script block is empty');
  }
  return script;
}

function createElement(value?: string): FakeElement {
  const element: FakeElement = {
    value,
    textContent: '',
    className: '',
    children: [],
    firstChild: null,
    scrollTop: 0,
    scrollHeight: 0,
    addEventListener: vi.fn(),
    appendChild(child) {
      this.children.push(child);
      this.firstChild = this.children[0] ?? null;
    },
    removeChild(child) {
      if (!child) return;
      this.children = this.children.filter((entry) => entry !== child);
      this.firstChild = this.children[0] ?? null;
    }
  };
  return element;
}

function createHarness(options: HarnessOptions = {}): Harness {
  const script = extractUiScript();
  const input = createElement('ws://localhost:8080');
  const form = createElement();
  const logContainer = createElement();
  const status = createElement();
  const elements = new Map<string, FakeElement>([
    ['ws-url-input', input],
    ['ws-url-form', form],
    ['log-container', logContainer],
    ['ws-status', status]
  ]);
  const storage = new Map<string, string>(Object.entries(options.initialStorage ?? {}));
  const sockets: MockWebSocket[] = [];
  const bridgeUrls = new Set(options.bridgeUrls ?? []);
  const nonBridgeUrls = new Set(options.nonBridgeUrls ?? []);
  const documentListeners = new Map<string, () => void>();
  const windowListeners = new Map<string, () => void>();
  let submitHandler: ((event: { preventDefault: () => void }) => void) | null = null;

  form.addEventListener = (event, handler) => {
    if (event === 'submit') {
      submitHandler = handler;
    }
  };

  const context = vm.createContext({
    console: { error: vi.fn() },
    document: {
      readyState: 'loading',
      getElementById: (id: string) => elements.get(id) ?? null,
      createElement: () => createElement(),
      addEventListener: (event: string, handler: () => void) => {
        documentListeners.set(event, handler);
      }
    },
    window: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        }
      },
      addEventListener: (event: string, handler: () => void) => {
        windowListeners.set(event, handler);
      }
    },
    parent: { postMessage: vi.fn() },
    WebSocket: class extends MockWebSocket {
      constructor(url: string) {
        super(url, sockets, (candidateUrl) => {
          if (bridgeUrls.has(candidateUrl)) return 'bridge';
          if (nonBridgeUrls.has(candidateUrl)) return 'non-bridge';
          return 'closed';
        });
      }
    },
    URL,
    Date,
    JSON,
    String,
    Boolean,
    setTimeout,
    clearTimeout,
    setInterval: vi.fn(() => 1),
    clearInterval: vi.fn()
  });

  vm.runInContext(script, context);

  return {
    input,
    sockets,
    storage,
    runDOMContentLoaded: () => documentListeners.get('DOMContentLoaded')?.(),
    submit: () => {
      if (!submitHandler) {
        throw new Error('Submit handler not registered');
      }
      submitHandler({ preventDefault: vi.fn() });
    }
  };
}

describe('Figma plugin WebSocket URL UI', () => {
  it('auto-discovers a bridge on a later default port', async () => {
    const harness = createHarness({ bridgeUrls: ['ws://localhost:8082'] });

    harness.runDOMContentLoaded();

    await vi.waitFor(() => {
      expect(harness.input.value).toBe('ws://localhost:8082');
    });
    expect(harness.storage.get(storageKey)).toBe('ws://localhost:8082');
    expect(harness.sockets.map((socket) => socket.url)).toEqual([
      'ws://localhost:8080',
      'ws://localhost:8081',
      'ws://localhost:8082'
    ]);
    expect(harness.sockets[2]?.sent[0]).toContain('figma_hello');
  });

  it('ignores a non-bridge WebSocket server and keeps scanning', async () => {
    const harness = createHarness({
      bridgeUrls: ['ws://localhost:8081'],
      nonBridgeUrls: ['ws://localhost:8080']
    });

    harness.runDOMContentLoaded();

    await vi.waitFor(() => {
      expect(harness.input.value).toBe('ws://localhost:8081');
    });
    expect(harness.storage.get(storageKey)).toBe('ws://localhost:8081');
    expect(harness.sockets.map((socket) => socket.url)).toEqual([
      'ws://localhost:8080',
      'ws://localhost:8081'
    ]);
  });

  it('connects to a persisted custom bridge URL first on startup', async () => {
    const harness = createHarness({
      initialStorage: { [storageKey]: 'ws://localhost:9777' },
      bridgeUrls: ['ws://localhost:9777']
    });

    harness.runDOMContentLoaded();

    await vi.waitFor(() => {
      expect(harness.input.value).toBe('ws://localhost:9777');
    });
    expect(harness.sockets[0]?.url).toBe('ws://localhost:9777');
  });

  it('persists submitted bridge URL and reconnects with it', async () => {
    const harness = createHarness({
      bridgeUrls: ['ws://localhost:8080', 'ws://localhost:9888']
    });
    harness.runDOMContentLoaded();

    await vi.waitFor(() => {
      expect(harness.storage.get(storageKey)).toBe('ws://localhost:8080');
    });

    harness.input.value = 'ws://localhost:9888';
    harness.submit();

    await vi.waitFor(() => {
      expect(harness.input.value).toBe('ws://localhost:9888');
    });
    expect(harness.storage.get(storageKey)).toBe('ws://localhost:9888');
    expect(harness.sockets.at(-1)?.url).toBe('ws://localhost:9888');
  });

  it('rejects non-WebSocket URLs without reconnecting', async () => {
    const harness = createHarness({ bridgeUrls: ['ws://localhost:8080'] });
    harness.runDOMContentLoaded();

    await vi.waitFor(() => {
      expect(harness.storage.get(storageKey)).toBe('ws://localhost:8080');
    });
    const socketCount = harness.sockets.length;

    harness.input.value = 'http://localhost:9888';
    harness.submit();

    expect(harness.input.value).toBe('ws://localhost:8080');
    expect(harness.storage.get(storageKey)).toBe('ws://localhost:8080');
    expect(harness.sockets).toHaveLength(socketCount);
  });
});
