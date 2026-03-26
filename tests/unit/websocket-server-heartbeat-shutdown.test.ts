/**
 * WebSocket Bridge Server — Heartbeat, Shutdown & Rate Limiter Tests
 *
 * Covers TokenBucket, the heartbeat interval callback (dead connection
 * detection, ping failures), the graceful shutdown function, and server
 * error handling.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import {
  createServer,
  TokenBucket,
  type ServerHandle,
  type ClientRecord
} from '../../websocket-server/src/server.js';

// Helper: connect a WebSocket client and wait for welcome message
function connectClient(port: number): Promise<{ ws: WebSocket; welcome: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const timeout = setTimeout(() => {
      ws.terminate();
      reject(new Error('Connection timeout'));
    }, 5000);

    ws.on('message', (data) => {
      clearTimeout(timeout);
      const welcome = JSON.parse(data.toString()) as Record<string, unknown>;
      resolve({ ws, welcome });
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// Helper: mock WebSocket for direct state manipulation
function mockWs(readyState = WebSocket.OPEN): WebSocket {
  return {
    readyState,
    send: vi.fn(),
    close: vi.fn(),
    ping: vi.fn(),
    terminate: vi.fn(),
    on: vi.fn(),
    emit: vi.fn()
  } as unknown as WebSocket;
}

describe('TokenBucket', () => {
  it('allows burst tokens then rejects', () => {
    const bucket = new TokenBucket(3, 1);
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(false);
  });

  it('refills tokens over time', async () => {
    const bucket = new TokenBucket(2, 1000);
    bucket.consume();
    bucket.consume();
    expect(bucket.consume()).toBe(false);

    await new Promise((r) => setTimeout(r, 15));

    expect(bucket.consume()).toBe(true);
  });
});

describe('Heartbeat interval callback', () => {
  let handle: ServerHandle;
  let heartbeatCallback: () => void;

  afterEach(async () => {
    clearInterval(handle.heartbeatInterval);
    await new Promise<void>((resolve) => {
      handle.wss.close(() => resolve());
    });
  });

  /**
   * Create a server while capturing the heartbeat setInterval callback.
   * We spy on setInterval, create the server, then extract the callback
   * so we can invoke it directly without waiting 30 seconds.
   */
  function createServerWithHeartbeatCapture(): ServerHandle {
    const originalSetInterval = global.setInterval;
    let captured: (() => void) | undefined;

    // Temporarily intercept setInterval to capture the heartbeat callback
    global.setInterval = ((fn: () => void, delay?: number) => {
      captured = fn;
      return originalSetInterval(fn, delay);
    }) as typeof global.setInterval;

    const h = createServer(0);

    global.setInterval = originalSetInterval;

    if (!captured) {
      throw new Error('Failed to capture heartbeat callback');
    }
    heartbeatCallback = captured;
    return h;
  }

  it('terminates dead clients (isAlive=false + timed out)', () => {
    handle = createServerWithHeartbeatCapture();

    // Add a dead mock client directly to state
    const deadWs = mockWs();
    const deadClient: ClientRecord = {
      ws: deadWs,
      isAlive: false,
      lastPong: Date.now() - 120_000, // well past 60s timeout
      rateLimiter: new TokenBucket()
    };
    handle.state.clients.set('dead-client', deadClient);

    heartbeatCallback();

    expect(deadWs.terminate).toHaveBeenCalled();
    expect(handle.state.clients.has('dead-client')).toBe(false);
  });

  it('pings alive clients and sets isAlive=false', () => {
    handle = createServerWithHeartbeatCapture();

    const aliveWs = mockWs();
    const aliveClient: ClientRecord = {
      ws: aliveWs,
      isAlive: true,
      lastPong: Date.now(),
      rateLimiter: new TokenBucket()
    };
    handle.state.clients.set('alive-client', aliveClient);

    heartbeatCallback();

    expect(aliveWs.ping).toHaveBeenCalled();
    expect(aliveClient.isAlive).toBe(false);
  });

  it('terminates client when ping() throws', () => {
    handle = createServerWithHeartbeatCapture();

    const brokenWs = mockWs();
    brokenWs.ping = () => {
      throw new Error('Connection reset');
    };
    const client: ClientRecord = {
      ws: brokenWs,
      isAlive: true,
      lastPong: Date.now(),
      rateLimiter: new TokenBucket()
    };
    handle.state.clients.set('broken-client', client);

    heartbeatCallback();

    expect(brokenWs.terminate).toHaveBeenCalled();
    expect(handle.state.clients.has('broken-client')).toBe(false);
  });

  it('handles mix of alive, dead, and broken clients', () => {
    handle = createServerWithHeartbeatCapture();

    // Alive client — should be pinged
    const aliveWs = mockWs();
    handle.state.clients.set('alive', {
      ws: aliveWs,
      isAlive: true,
      lastPong: Date.now(),
      rateLimiter: new TokenBucket()
    });

    // Dead client — should be terminated
    const deadWs = mockWs();
    handle.state.clients.set('dead', {
      ws: deadWs,
      isAlive: false,
      lastPong: Date.now() - 120_000,
      rateLimiter: new TokenBucket()
    });

    heartbeatCallback();

    expect(aliveWs.ping).toHaveBeenCalled();
    expect(deadWs.terminate).toHaveBeenCalled();
    expect(handle.state.clients.has('alive')).toBe(true);
    expect(handle.state.clients.has('dead')).toBe(false);
  });
});

describe('Graceful shutdown via handle.shutdown()', () => {
  const handles: ServerHandle[] = [];

  afterEach(() => {
    for (const h of handles) {
      clearInterval(h.heartbeatInterval);
      try {
        h.wss.close();
      } catch {
        // already closed
      }
    }
    handles.length = 0;
  });

  it('closes all client connections and resolves', async () => {
    const handle = createServer(0);
    handles.push(handle);
    const port = (handle.wss.address() as { port: number }).port;

    const { ws: ws1 } = await connectClient(port);
    const { ws: ws2 } = await connectClient(port);

    await new Promise((r) => setTimeout(r, 50));
    expect(handle.state.clients.size).toBe(2);

    const ws1Closed = new Promise<void>((resolve) => ws1.on('close', () => resolve()));
    const ws2Closed = new Promise<void>((resolve) => ws2.on('close', () => resolve()));

    await handle.shutdown('SIGTERM');
    await Promise.all([ws1Closed, ws2Closed]);
  });

  it('resolves cleanly with no connected clients', async () => {
    const handle = createServer(0);
    handles.push(handle);
    await handle.shutdown('SIGINT');
  });

  it('clears heartbeat interval on shutdown', async () => {
    const handle = createServer(0);
    handles.push(handle);
    const clearSpy = vi.spyOn(global, 'clearInterval');

    await handle.shutdown('SIGTERM');

    expect(clearSpy).toHaveBeenCalledWith(handle.heartbeatInterval);
    clearSpy.mockRestore();
  });

  it('server rejects new connections after shutdown', async () => {
    const handle = createServer(0);
    handles.push(handle);
    const port = (handle.wss.address() as { port: number }).port;

    await handle.shutdown('SIGTERM');

    await expect(
      new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}`);
        ws.on('error', reject);
        ws.on('open', () => resolve(ws));
      })
    ).rejects.toThrow();
  });
});

describe('Server error event', () => {
  it('handles wss error event without crashing', async () => {
    const handle = createServer(0);

    handle.wss.emit('error', new Error('test server error'));

    clearInterval(handle.heartbeatInterval);
    await new Promise<void>((resolve) => {
      handle.wss.close(() => resolve());
    });
  });
});

describe('Connection error and no-Figma paths', () => {
  let handle: ServerHandle;
  const clients: WebSocket[] = [];

  function getPort(): number {
    const addr = handle.wss.address();
    if (typeof addr === 'object' && addr !== null) {
      return addr.port;
    }
    throw new Error('Server not listening');
  }

  // Helper: wait for next message on a WebSocket
  function nextMessage(ws: WebSocket, timeoutMs = 3000): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Message timeout')), timeoutMs);
      ws.once('message', (data) => {
        clearTimeout(timeout);
        resolve(JSON.parse(data.toString()) as Record<string, unknown>);
      });
    });
  }

  afterEach(async () => {
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
    clients.length = 0;
    clearInterval(handle.heartbeatInterval);
    await new Promise<void>((resolve) => {
      handle.wss.close(() => resolve());
    });
  });

  it('cleans up client on WebSocket error event', async () => {
    handle = createServer(0);
    const port = getPort();
    const { ws } = await connectClient(port);
    clients.push(ws);

    await new Promise((r) => setTimeout(r, 50));
    expect(handle.state.clients.size).toBe(1);

    const serverWs = Array.from(handle.state.clients.values())[0].ws;
    serverWs.emit('error', new Error('simulated connection reset'));

    await new Promise((r) => setTimeout(r, 50));
    expect(handle.state.clients.size).toBe(0);
  });

  it('sends error to MCP client when no Figma plugin connected and request has id', async () => {
    handle = createServer(0);
    const port = getPort();
    const { ws: mcpWs } = await connectClient(port);
    clients.push(mcpWs);

    const errorPromise = nextMessage(mcpWs);
    mcpWs.send(JSON.stringify({ type: 'create_frame', payload: {}, id: 'req-fail' }));
    const error = await errorPromise;

    expect(error.success).toBe(false);
    expect(error.error).toContain('No Figma plugin connected');
    expect(error.id).toBe('req-fail');
  });
});
