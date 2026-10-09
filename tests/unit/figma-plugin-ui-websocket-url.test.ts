import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const storageKey = 'text-to-figma.wsUrl';

interface FakeElement {
  value?: string;
  hidden?: boolean;
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
  hint: FakeElement;
  bridgeUrls: Set<string>;
  submit: () => void;
  sockets: MockWebSocket[];
  storage: Map<string, string>;
  runDOMContentLoaded: () => void;
  runReconnectTimer: () => void;
}

interface HarnessOptions {
  initialStorage?: Record<string, string>;
  bridgeUrls?: string[];
  nonBridgeUrls?: string[];
  /** URLs whose server accepts the socket but never sends a welcome message. */
  silentUrls?: string[];
  /** Per-URL delay before the socket settles, emulating Chromium's WebSocket throttle. */
  connectDelays?: Record<string, number>;
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
    getBehavior: (url: string) => 'bridge' | 'non-bridge' | 'silent' | 'closed',
    connectDelayMs = 0
  ) {
    sockets.push(this);
    setTimeout(() => {
      if (this.readyState === MockWebSocket.CLOSED) return;
      const behavior = getBehavior(url);
      if (behavior === 'bridge') {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.();
        this.onmessage?.({
          data: JSON.stringify({
            type: 'connection',
            server: 'text-to-figma-websocket-bridge',
            message: 'Connected to WebSocket bridge server'
          })
        });
        return;
      }

      if (behavior === 'silent') {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.();
        return;
      }

      if (behavior === 'non-bridge') {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.();
        this.onmessage?.({
          data: JSON.stringify({
            type: 'connection',
            server: 'other-project',
            message: 'Connected to another WebSocket server'
          })
        });
        return;
      }

      this.readyState = MockWebSocket.CLOSED;
      this.onerror?.(new Error(`No bridge at ${url}`));
      this.onclose?.();
    }, connectDelayMs);
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

/** URLs of sockets the UI registered on with figma_hello, in send order. */
function registeredUrls(sockets: MockWebSocket[]): string[] {
  return sockets
    .filter((socket) => socket.sent.some((message) => message.includes('figma_hello')))
    .map((socket) => socket.url);
}

const defaultRange = Array.from({ length: 20 }, (_, offset) => `ws://localhost:${8080 + offset}`);

function createHarness(options: HarnessOptions = {}): Harness {
  const script = extractUiScript();
  const input = createElement('ws://localhost:8080');
  const form = createElement();
  const logContainer = createElement();
  const status = createElement();
  const hint = createElement();
  hint.hidden = true;
  const elements = new Map<string, FakeElement>([
    ['ws-url-input', input],
    ['ws-url-form', form],
    ['log-container', logContainer],
    ['ws-status', status],
    ['ws-hint', hint]
  ]);
  const storage = new Map<string, string>(Object.entries(options.initialStorage ?? {}));
  const sockets: MockWebSocket[] = [];
  const bridgeUrls = new Set(options.bridgeUrls ?? []);
  const nonBridgeUrls = new Set(options.nonBridgeUrls ?? []);
  const silentUrls = new Set(options.silentUrls ?? []);
  const connectDelays = options.connectDelays ?? {};
  const documentListeners = new Map<string, () => void>();
  const windowListeners = new Map<string, () => void>();
  let submitHandler: ((event: { preventDefault: () => void }) => void) | null = null;
  let reconnectTimer: (() => void) | null = null;

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
        super(
          url,
          sockets,
          (candidateUrl) => {
            if (bridgeUrls.has(candidateUrl)) return 'bridge';
            if (nonBridgeUrls.has(candidateUrl)) return 'non-bridge';
            if (silentUrls.has(candidateUrl)) return 'silent';
            return 'closed';
          },
          connectDelays[url] ?? 0
        );
      }
    },
    URL,
    Date,
    JSON,
    String,
    Boolean,
    setTimeout,
    clearTimeout,
    setInterval: vi.fn((callback: () => void) => {
      reconnectTimer = callback;
      return 1;
    }),
    clearInterval: vi.fn()
  });

  vm.runInContext(script, context);

  return {
    input,
    hint,
    bridgeUrls,
    sockets,
    storage,
    runDOMContentLoaded: () => documentListeners.get('DOMContentLoaded')?.(),
    runReconnectTimer: () => {
      if (!reconnectTimer) {
        throw new Error('Reconnect timer not scheduled');
      }
      reconnectTimer();
    },
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
    expect(harness.sockets.map((socket) => socket.url)).toEqual(defaultRange);
    expect(registeredUrls(harness.sockets)).toEqual(['ws://localhost:8082']);
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
    expect(registeredUrls(harness.sockets)).toEqual(['ws://localhost:8081']);
    expect(harness.sockets[0]?.url).toBe('ws://localhost:8080');
    expect(harness.sockets[0]?.readyState).toBe(MockWebSocket.CLOSED);
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
    await vi.waitFor(() => {
      expect(registeredUrls(harness.sockets)).toEqual([
        'ws://localhost:8080',
        'ws://localhost:9888'
      ]);
    });
  });

  it('shows the no-bridge hint after a scan finds no bridge', async () => {
    const harness = createHarness();

    harness.runDOMContentLoaded();

    await vi.waitFor(() => {
      expect(harness.hint.hidden).toBe(false);
    });
    expect(harness.sockets.map((socket) => socket.url)).toEqual(defaultRange);
  });

  it('hides the no-bridge hint once a reconnect scan reaches the bridge', async () => {
    const harness = createHarness();
    harness.runDOMContentLoaded();
    await vi.waitFor(() => {
      expect(harness.hint.hidden).toBe(false);
    });

    harness.bridgeUrls.add('ws://localhost:8083');
    harness.runReconnectTimer();

    await vi.waitFor(() => {
      expect(harness.hint.hidden).toBe(true);
    });
    expect(harness.storage.get(storageKey)).toBe('ws://localhost:8083');
  });

  it('keeps a throttled bridge socket pending instead of aborting it', async () => {
    // Chromium holds a new WebSocket in CONNECTING for up to 5s once earlier attempts failed.
    vi.useFakeTimers();
    try {
      const harness = createHarness({
        bridgeUrls: ['ws://localhost:8080'],
        connectDelays: { 'ws://localhost:8080': 4900 }
      });
      harness.runDOMContentLoaded();

      await vi.advanceTimersByTimeAsync(4899);
      expect(registeredUrls(harness.sockets)).toEqual([]);

      await vi.advanceTimersByTimeAsync(1);
      expect(registeredUrls(harness.sockets)).toEqual(['ws://localhost:8080']);
      expect(harness.storage.get(storageKey)).toBe('ws://localhost:8080');
    } finally {
      vi.useRealTimers();
    }
  });

  it('probes every candidate at once and prefers the earliest bridge', async () => {
    vi.useFakeTimers();
    try {
      const harness = createHarness({
        bridgeUrls: ['ws://localhost:8080', 'ws://localhost:8085'],
        connectDelays: { 'ws://localhost:8080': 3000 }
      });
      harness.runDOMContentLoaded();

      await vi.advanceTimersByTimeAsync(0);
      expect(harness.sockets.map((socket) => socket.url)).toEqual(defaultRange);
      expect(registeredUrls(harness.sockets)).toEqual([]);

      await vi.advanceTimersByTimeAsync(3000);
      expect(registeredUrls(harness.sockets)).toEqual(['ws://localhost:8080']);
      expect(harness.sockets[5]?.url).toBe('ws://localhost:8085');
      expect(harness.sockets[5]?.readyState).toBe(MockWebSocket.CLOSED);
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops a socket that opens but never sends the bridge welcome', async () => {
    vi.useFakeTimers();
    try {
      const harness = createHarness({
        bridgeUrls: ['ws://localhost:8081'],
        silentUrls: ['ws://localhost:8080']
      });
      harness.runDOMContentLoaded();

      await vi.advanceTimersByTimeAsync(1999);
      expect(registeredUrls(harness.sockets)).toEqual([]);

      await vi.advanceTimersByTimeAsync(1);
      expect(registeredUrls(harness.sockets)).toEqual(['ws://localhost:8081']);
      expect(harness.sockets[0]?.readyState).toBe(MockWebSocket.CLOSED);
    } finally {
      vi.useRealTimers();
    }
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
