/**
 * WebSocket Spawner — Unit Tests
 *
 * Tests the exported ensureWebSocketServer() and stopWebSocketServer() functions
 * with mocked dependencies (net, ws, child_process, config). Internal functions
 * (isPortInUse, canBindPort, isWebSocketServerReady, etc.) are not exported and
 * are tested indirectly through the public API.
 *
 * Limitations:
 * - waitForServerReady's polling loop uses real setTimeout intervals, making
 *   spawn-success tests require careful event timing.
 * - getWebSocketPort and getWebSocketServerPath are private; tested indirectly
 *   through ensureWebSocketServer behavior with different config URLs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';

// ── Shared instance trackers (reset in beforeEach) ────────────────────────────

const mockSockets: EventEmitter[] = [];
const mockServers: EventEmitter[] = [];
const mockWebSockets: Array<EventEmitter & { url: string; readyState: number }> = [];

// ── Mock: net module ──────────────────────────────────────────────────────────

vi.mock('net', () => {
  return {
    Socket: class extends EventEmitter {
      constructor() {
        super();
        mockSockets.push(this);
      }
      connect(): EventEmitter {
        return this;
      }
      destroy(): void {
        /* no-op */
      }
    },
    createServer: () => {
      const server = new (class extends EventEmitter {
        listen(): EventEmitter {
          return this;
        }
        close(cb?: () => void): EventEmitter {
          cb?.();
          return this;
        }
      })();
      mockServers.push(server);
      return server;
    }
  };
});

// ── Mock: ws module ───────────────────────────────────────────────────────────

vi.mock('ws', () => {
  const MockWS = class extends EventEmitter {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 3;

    readyState = 0;

    constructor(readonly url: string) {
      super();
      mockWebSockets.push(this);
    }
    close(): void {
      this.readyState = MockWS.CLOSED;
    }
  };
  return { default: MockWS, WebSocket: MockWS };
});

// ── Mock: fs module (PID file + log file operations) ─────────────────────────

vi.mock('fs', () => ({
  existsSync: () => false,
  readFileSync: () => '',
  writeFileSync: () => undefined,
  unlinkSync: () => undefined,
  openSync: () => 99,
  closeSync: () => undefined
}));

// ── Mock: child_process ───────────────────────────────────────────────────────

const spawnedProcesses: EventEmitter[] = [];

vi.mock('child_process', () => ({
  spawn: () => {
    const proc = new (class extends EventEmitter {
      pid = 12345;
      stdout = new EventEmitter();
      stderr = new EventEmitter();
      killed = false;
      kill(): boolean {
        this.killed = true;
        return true;
      }
      unref(): void {
        /* detached process — no-op in tests */
      }
    })();
    spawnedProcesses.push(proc);
    return proc;
  }
}));

// ── Mock: config ──────────────────────────────────────────────────────────────

vi.mock('../../mcp-server/src/config.js', () => ({
  getConfig: () => ({
    FIGMA_WS_URL: 'ws://localhost:9999'
  })
}));

// ── Import module under test (after all mocks) ───────────────────────────────

const { ensureWebSocketServer, stopWebSocketServer } =
  await import('../../mcp-server/src/websocket-spawner.js');

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  process.env.TEXT_TO_FIGMA_WS_PORT_SCAN_LIMIT = '1';
  mockSockets.length = 0;
  mockServers.length = 0;
  mockWebSockets.length = 0;
  spawnedProcesses.length = 0;
});

afterEach(() => {
  delete process.env.TEXT_TO_FIGMA_WS_PORT_SCAN_LIMIT;
  vi.restoreAllMocks();
});

/** Wait until the tracked array has at least `count` instances. */
async function waitForInstance<T>(arr: T[], count = 1): Promise<T> {
  await vi.waitFor(
    () => {
      if (arr.length < count) {
        throw new Error(`Expected ${count} instance(s), have ${arr.length}`);
      }
    },
    { timeout: 3000, interval: 10 }
  );
  return arr[count - 1] as T;
}

function bridgeWelcome(): string {
  return JSON.stringify({
    type: 'connection',
    server: 'text-to-figma-websocket-bridge',
    message: 'Connected to WebSocket bridge server'
  });
}

describe('stopWebSocketServer', () => {
  it('does not throw when no process has been spawned', () => {
    expect(() => {
      stopWebSocketServer();
    }).not.toThrow();
  });
});

describe('ensureWebSocketServer', () => {
  it('returns alreadyRunning when port is in use and responds as WebSocket', async () => {
    const promise = ensureWebSocketServer();

    // isPortInUse: socket connects → port in use
    const socket = await waitForInstance(mockSockets);
    socket.emit('connect');

    // isWebSocketServerReady: bridge welcome → Text-to-Figma bridge is ready
    const ws = await waitForInstance(mockWebSockets);
    ws.emit('message', bridgeWelcome());

    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.alreadyRunning).toBe(true);
    expect(result.spawned).toBe(false);
    expect(result.port).toBe(9999);
    expect(result.url).toBe('ws://localhost:9999');
  });

  it('returns failure when only scanned port is occupied by non-bridge service', async () => {
    const promise = ensureWebSocketServer();

    // isPortInUse: socket connects → port in use
    const socket = await waitForInstance(mockSockets);
    socket.emit('connect');

    // isWebSocketServerReady: WebSocket errors → not a WS server
    const ws = await waitForInstance(mockWebSockets);
    ws.emit('error', new Error('Connection refused'));

    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.alreadyRunning).toBe(false);
    expect(result.error).toContain('No available local WebSocket bridge port');
    expect(result.port).toBe(9999);
  });

  it('returns failure when port is free but cannot bind', async () => {
    const promise = ensureWebSocketServer();

    // isPortInUse: ECONNREFUSED → port free
    const socket = await waitForInstance(mockSockets);
    const err = new Error('ECONNREFUSED') as NodeJS.ErrnoException;
    err.code = 'ECONNREFUSED';
    socket.emit('error', err);

    // canBindPort: cannot bind
    const server = await waitForInstance(mockServers);
    server.emit('error', new Error('EADDRINUSE'));

    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.alreadyRunning).toBe(false);
    expect(result.error).toContain('No available local WebSocket bridge port');
  });

  it('spawns server and succeeds when port is free and server becomes ready', async () => {
    const promise = ensureWebSocketServer();

    // isPortInUse: ECONNREFUSED → port free
    const socket = await waitForInstance(mockSockets);
    const err = new Error('ECONNREFUSED') as NodeJS.ErrnoException;
    err.code = 'ECONNREFUSED';
    socket.emit('error', err);

    // canBindPort: can bind
    const server = await waitForInstance(mockServers);
    server.emit('listening');

    // waitForServerReady polls isWebSocketServerReady every 200ms.
    // Each poll creates a new WebSocket. The first bridge welcome should succeed.
    const ws = await waitForInstance(mockWebSockets);
    ws.emit('message', bridgeWelcome());

    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.spawned).toBe(true);
    expect(result.port).toBe(9999);
    expect(result.url).toBe('ws://localhost:9999');
  });

  it('extracts port 9999 from configured ws://localhost:9999 URL', async () => {
    const promise = ensureWebSocketServer();

    // Just let the port check proceed and verify the port in the result
    const socket = await waitForInstance(mockSockets);
    socket.emit('connect');

    const ws = await waitForInstance(mockWebSockets);
    ws.emit('message', bridgeWelcome());

    const result = await promise;
    expect(result.port).toBe(9999);
  });

  it('skips a port occupied by another service and spawns on the next port', async () => {
    process.env.TEXT_TO_FIGMA_WS_PORT_SCAN_LIMIT = '2';

    const promise = ensureWebSocketServer();

    const occupiedSocket = await waitForInstance(mockSockets, 1);
    occupiedSocket.emit('connect');

    const nonBridgeWs = await waitForInstance(mockWebSockets, 1);
    nonBridgeWs.emit('error', new Error('not our bridge'));

    const freeSocket = await waitForInstance(mockSockets, 2);
    const err = new Error('ECONNREFUSED') as NodeJS.ErrnoException;
    err.code = 'ECONNREFUSED';
    freeSocket.emit('error', err);

    const bindServer = await waitForInstance(mockServers, 1);
    bindServer.emit('listening');

    const spawnedBridgeProbe = await waitForInstance(mockWebSockets, 2);
    spawnedBridgeProbe.emit('message', bridgeWelcome());

    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.spawned).toBe(true);
    expect(result.port).toBe(10000);
    expect(result.url).toBe('ws://localhost:10000');
  });

  it('prefers an existing bridge later in the range over spawning on an earlier free port', async () => {
    process.env.TEXT_TO_FIGMA_WS_PORT_SCAN_LIMIT = '2';

    const promise = ensureWebSocketServer();

    const freeSocket = await waitForInstance(mockSockets, 1);
    const err = new Error('ECONNREFUSED') as NodeJS.ErrnoException;
    err.code = 'ECONNREFUSED';
    freeSocket.emit('error', err);

    const bindServer = await waitForInstance(mockServers, 1);
    bindServer.emit('listening');

    const bridgePortSocket = await waitForInstance(mockSockets, 2);
    bridgePortSocket.emit('connect');

    const existingBridgeProbe = await waitForInstance(mockWebSockets, 1);
    existingBridgeProbe.emit('message', bridgeWelcome());

    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.alreadyRunning).toBe(true);
    expect(result.spawned).toBe(false);
    expect(result.port).toBe(10000);
    expect(result.url).toBe('ws://localhost:10000');
    expect(spawnedProcesses).toHaveLength(0);
  });
});
