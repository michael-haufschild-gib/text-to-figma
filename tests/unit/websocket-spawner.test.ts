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
const mockWebSockets: EventEmitter[] = [];

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
    constructor(_url: string) {
      super();
      mockWebSockets.push(this);
    }
    close(): void {
      /* no-op */
    }
  };
  return { default: MockWS, WebSocket: MockWS };
});

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
  mockSockets.length = 0;
  mockServers.length = 0;
  mockWebSockets.length = 0;
  spawnedProcesses.length = 0;
});

afterEach(() => {
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

    // isWebSocketServerReady: WebSocket connects → WS server is ready
    const ws = await waitForInstance(mockWebSockets);
    ws.emit('open');

    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.alreadyRunning).toBe(true);
    expect(result.spawned).toBe(false);
    expect(result.port).toBe(9999);
  });

  it('returns failure when port is in use by non-WebSocket service', async () => {
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
    expect(result.error).toContain('Port 9999 is already in use');
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
    expect(result.error).toContain('Port 9999 is already in use');
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
    // Each poll creates a new WebSocket. The first one should succeed.
    const ws = await waitForInstance(mockWebSockets);
    ws.emit('open');

    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.spawned).toBe(true);
    expect(result.port).toBe(9999);
  });

  it('extracts port 9999 from configured ws://localhost:9999 URL', async () => {
    const promise = ensureWebSocketServer();

    // Just let the port check proceed and verify the port in the result
    const socket = await waitForInstance(mockSockets);
    socket.emit('connect');

    const ws = await waitForInstance(mockWebSockets);
    ws.emit('open');

    const result = await promise;
    expect(result.port).toBe(9999);
  });
});
