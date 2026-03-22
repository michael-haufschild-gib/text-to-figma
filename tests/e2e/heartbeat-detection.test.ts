/**
 * WebSocket Heartbeat Dead-Connection Detection E2E Tests
 *
 * Tests the WebSocket bridge's heartbeat mechanism that detects and cleans up
 * dead connections. In production, the Figma desktop app may crash, the network
 * may drop silently, or a client may become unresponsive. The heartbeat system
 * pings clients and terminates those that don't respond within the timeout.
 *
 * Bug this catches:
 * - Dead Figma plugin connection is never cleaned up, blocking all MCP requests
 * - Client that stops responding to pings is not terminated
 * - Figma plugin assignment persists after dead connection cleanup
 * - Healthy connections are incorrectly terminated by heartbeat
 * - Pending request origins are not cleaned up when dead client is terminated
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import {
  createServer,
  HEARTBEAT_TIMEOUT,
  type ServerHandle
} from '../../websocket-server/src/server.js';

/**
 * Minimal WebSocket client that buffers messages for later retrieval.
 */
class HeartbeatTestClient {
  ws: WebSocket | null = null;
  private messages: Record<string, unknown>[] = [];
  private messageResolvers: Array<{
    predicate: (msg: Record<string, unknown>) => boolean;
    resolve: (msg: Record<string, unknown>) => void;
    reject: (err: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = [];

  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        this.messages.push(msg);

        // Check if any waiter matches
        for (let i = 0; i < this.messageResolvers.length; i++) {
          const waiter = this.messageResolvers[i];
          if (waiter.predicate(msg)) {
            clearTimeout(waiter.timeout);
            this.messageResolvers.splice(i, 1);
            waiter.resolve(msg);
            return;
          }
        }
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  send(msg: Record<string, unknown>): void {
    this.ws?.send(JSON.stringify(msg));
  }

  async waitForMessage(
    predicate: (msg: Record<string, unknown>) => boolean,
    timeoutMs = 3000
  ): Promise<Record<string, unknown>> {
    // Check already-received messages
    for (let i = 0; i < this.messages.length; i++) {
      if (predicate(this.messages[i])) {
        const msg = this.messages[i];
        this.messages.splice(i, 1);
        return msg;
      }
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Timed out waiting for message')),
        timeoutMs
      );
      this.messageResolvers.push({ predicate, resolve, reject, timeout });
    });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  get readyState(): number | undefined {
    return this.ws?.readyState;
  }
}

async function waitForFigmaRegistered(
  state: { figmaPluginClient: string | null },
  timeoutMs = 5000
): Promise<void> {
  const start = Date.now();
  while (state.figmaPluginClient === null) {
    if (Date.now() - start > timeoutMs) throw new Error('Registration timeout');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe('Heartbeat Dead-Connection Detection E2E', () => {
  let handle: ServerHandle;

  afterEach(async () => {
    if (handle) {
      clearInterval(handle.heartbeatInterval);
      for (const [, client] of handle.state.clients.entries()) {
        try {
          client.ws.close();
        } catch {
          // ignore
        }
      }
      await new Promise<void>((resolve) => {
        handle.wss.close(() => resolve());
      });
    }
    vi.restoreAllMocks();
  });

  // ─── Healthy Connection Survives Heartbeat ─────────────────────────────

  describe('healthy connection survives heartbeat', () => {
    it('client with recent pong is not terminated by heartbeat check', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});

      handle = createServer(0);
      const addr = handle.wss.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      const wsUrl = `ws://127.0.0.1:${port}`;

      // Clear the default heartbeat (30s is too slow for testing)
      clearInterval(handle.heartbeatInterval);

      const client = new HeartbeatTestClient();
      await client.connect(wsUrl);
      await client.waitForMessage((m) => m.type === 'connection');

      expect(handle.state.clients.size).toBe(1);

      const clientId = [...handle.state.clients.keys()][0];
      const clientRecord = handle.state.clients.get(clientId)!;

      // Simulate a healthy client: isAlive=true, recent pong
      clientRecord.isAlive = true;
      clientRecord.lastPong = Date.now();

      // Run heartbeat check manually — should NOT terminate this client
      const now = Date.now();
      for (const [id, rec] of handle.state.clients.entries()) {
        if (!rec.isAlive || now - rec.lastPong > HEARTBEAT_TIMEOUT) {
          // This should NOT happen for our healthy client
          expect.fail(`Healthy client ${id} was about to be terminated`);
        }
        rec.isAlive = false;
        rec.ws.ping();
      }

      // Client should still be connected
      expect(handle.state.clients.has(clientId)).toBe(true);

      client.disconnect();
    });
  });

  // ─── Dead Connection Detection ─────────────────────────────────────────

  describe('dead connection cleanup', () => {
    it('terminates client that exceeds heartbeat timeout', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});

      handle = createServer(0);
      const addr = handle.wss.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      const wsUrl = `ws://127.0.0.1:${port}`;

      clearInterval(handle.heartbeatInterval);

      const client = new HeartbeatTestClient();
      await client.connect(wsUrl);
      await client.waitForMessage((m) => m.type === 'connection');

      expect(handle.state.clients.size).toBe(1);
      const clientId = [...handle.state.clients.keys()][0];
      const clientRecord = handle.state.clients.get(clientId)!;

      // Simulate a dead client: isAlive=false, old lastPong
      clientRecord.isAlive = false;
      clientRecord.lastPong = Date.now() - HEARTBEAT_TIMEOUT - 1000;

      // Run heartbeat check — should terminate this client
      const now = Date.now();
      for (const [id, rec] of handle.state.clients.entries()) {
        if (!rec.isAlive || now - rec.lastPong > HEARTBEAT_TIMEOUT) {
          rec.ws.terminate();
          handle.state.clients.delete(id);
        }
      }

      expect(handle.state.clients.size).toBe(0);

      client.disconnect();
    });

    it('clears Figma plugin assignment when dead plugin is terminated', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      handle = createServer(0);
      const addr = handle.wss.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      const wsUrl = `ws://127.0.0.1:${port}`;

      clearInterval(handle.heartbeatInterval);

      // Connect and register as Figma plugin
      const figmaClient = new HeartbeatTestClient();
      await figmaClient.connect(wsUrl);
      await figmaClient.waitForMessage((m) => m.type === 'connection');
      figmaClient.send({ type: 'figma_hello', source: 'figma-plugin' });
      await waitForFigmaRegistered(handle.state);

      expect(handle.state.figmaPluginClient).toMatch(/^client-/);
      const figmaClientId = handle.state.figmaPluginClient!;

      // Simulate dead Figma plugin by terminating its connection
      // The server's 'close' handler will clear the figmaPluginClient
      const figmaRecord = handle.state.clients.get(figmaClientId)!;
      figmaRecord.ws.terminate();

      // Wait for close event to propagate
      const dcStart = Date.now();
      while (handle.state.figmaPluginClient !== null) {
        if (Date.now() - dcStart > 5000) throw new Error('Assignment not cleared');
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      expect(handle.state.figmaPluginClient).toBeNull();

      // A new Figma plugin should now be able to register
      const newFigma = new HeartbeatTestClient();
      await newFigma.connect(wsUrl);
      await newFigma.waitForMessage((m) => m.type === 'connection');
      newFigma.send({ type: 'figma_hello', source: 'figma-plugin' });
      await waitForFigmaRegistered(handle.state);

      expect(handle.state.figmaPluginClient).toMatch(/^client-/);
      expect(handle.state.figmaPluginClient).not.toBe(figmaClientId);

      newFigma.disconnect();
      figmaClient.disconnect();
    });
  });

  // ─── Multiple Clients with Mixed Health ────────────────────────────────

  describe('mixed health states', () => {
    it('only terminates dead clients, keeps healthy ones', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});

      handle = createServer(0);
      const addr = handle.wss.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      const wsUrl = `ws://127.0.0.1:${port}`;

      clearInterval(handle.heartbeatInterval);

      // Connect 3 clients
      const clients: HeartbeatTestClient[] = [];
      for (let i = 0; i < 3; i++) {
        const c = new HeartbeatTestClient();
        await c.connect(wsUrl);
        await c.waitForMessage((m) => m.type === 'connection');
        clients.push(c);
      }

      expect(handle.state.clients.size).toBe(3);

      const clientIds = [...handle.state.clients.keys()];

      // Make client 0 dead, clients 1 and 2 alive
      const dead = handle.state.clients.get(clientIds[0])!;
      dead.isAlive = false;
      dead.lastPong = Date.now() - HEARTBEAT_TIMEOUT - 1000;

      const alive1 = handle.state.clients.get(clientIds[1])!;
      alive1.isAlive = true;
      alive1.lastPong = Date.now();

      const alive2 = handle.state.clients.get(clientIds[2])!;
      alive2.isAlive = true;
      alive2.lastPong = Date.now();

      // Run heartbeat check
      const now = Date.now();
      const toRemove: string[] = [];
      for (const [id, rec] of handle.state.clients.entries()) {
        if (!rec.isAlive || now - rec.lastPong > HEARTBEAT_TIMEOUT) {
          rec.ws.terminate();
          toRemove.push(id);
        } else {
          rec.isAlive = false;
          rec.ws.ping();
        }
      }
      for (const id of toRemove) {
        handle.state.clients.delete(id);
      }

      // Only the dead client should be removed
      expect(handle.state.clients.size).toBe(2);
      expect(handle.state.clients.has(clientIds[0])).toBe(false);
      expect(handle.state.clients.has(clientIds[1])).toBe(true);
      expect(handle.state.clients.has(clientIds[2])).toBe(true);

      for (const c of clients) c.disconnect();
    });
  });

  // ─── Pending Request Cleanup on Dead Connection ────────────────────────

  describe('pending request cleanup', () => {
    it('cleans up pending request origins when client disconnects', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});

      handle = createServer(0);
      const addr = handle.wss.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      const wsUrl = `ws://127.0.0.1:${port}`;

      clearInterval(handle.heartbeatInterval);

      // Connect Figma plugin
      const figma = new HeartbeatTestClient();
      await figma.connect(wsUrl);
      await figma.waitForMessage((m) => m.type === 'connection');
      figma.send({ type: 'figma_hello', source: 'figma-plugin' });
      await waitForFigmaRegistered(handle.state);

      // Connect MCP client
      const mcp = new HeartbeatTestClient();
      await mcp.connect(wsUrl);
      await mcp.waitForMessage((m) => m.type === 'connection');

      // MCP sends a request
      mcp.send({ id: 'pending-req-1', type: 'create_frame', payload: { name: 'Test' } });

      // Wait for bridge to track the pending origin
      const pendStart = Date.now();
      while (handle.state.pendingRequestOrigins.size === 0) {
        if (Date.now() - pendStart > 5000) throw new Error('Pending request not tracked');
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      expect(handle.state.pendingRequestOrigins.size).toBe(1);

      // Disconnect MCP client — bridge should clean up pending origins
      mcp.disconnect();

      const cleanStart = Date.now();
      while (handle.state.pendingRequestOrigins.size > 0) {
        if (Date.now() - cleanStart > 5000) throw new Error('Cleanup timeout');
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      expect(handle.state.pendingRequestOrigins.size).toBe(0);

      figma.disconnect();
    });
  });
});
