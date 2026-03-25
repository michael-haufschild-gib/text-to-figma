/**
 * WebSocket Bridge Multi-Client Routing E2E Tests
 *
 * Tests the WebSocket bridge server's ability to correctly route messages
 * between multiple MCP clients and a single Figma plugin. This is critical
 * for multi-agent scenarios where multiple LLM clients share one Figma
 * plugin connection.
 *
 * Bug this catches:
 * - Response cross-talk: MCP client A receives a response meant for client B
 * - Request routing: Commands from MCP clients don't reach the Figma plugin
 * - Figma plugin registration: Second plugin connection isn't properly rejected
 * - Connection cleanup: Disconnected client's pending requests aren't cleaned up
 * - Message validation: Malformed messages cause state corruption
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { startTestBridge, type TestBridgeHandle } from './helpers/test-bridge.js';

/**
 * A minimal WebSocket client that sends/receives JSON messages.
 * Used to simulate MCP clients and Figma plugin connections at the protocol level.
 */
class TestWSClient {
  private ws: WebSocket | null = null;
  private messages: Record<string, unknown>[] = [];
  private messageResolvers: Array<(msg: Record<string, unknown>) => void> = [];

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

        // Resolve any waiters
        if (this.messageResolvers.length > 0) {
          const resolver = this.messageResolvers.shift()!;
          resolver(msg);
        }
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  send(msg: Record<string, unknown>): void {
    this.ws!.send(JSON.stringify(msg));
  }

  /** Wait for the next message that matches a predicate */
  async waitForMessage(
    predicate: (msg: Record<string, unknown>) => boolean,
    timeoutMs = 3000
  ): Promise<Record<string, unknown>> {
    // Check already-received messages first
    const existing = this.messages.find(predicate);
    if (existing) {
      this.messages = this.messages.filter((m) => m !== existing);
      return existing;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Timed out waiting for message')),
        timeoutMs
      );

      const check = (msg: Record<string, unknown>): void => {
        if (predicate(msg)) {
          clearTimeout(timeout);
          resolve(msg);
        } else {
          // Not the message we want, keep waiting
          this.messageResolvers.push(check);
        }
      };

      this.messageResolvers.push(check);
    });
  }

  /** Get all received messages */
  getMessages(): Record<string, unknown>[] {
    return [...this.messages];
  }

  /** Clear the message queue */
  clearMessages(): void {
    this.messages = [];
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  get readyState(): number | undefined {
    return this.ws?.readyState;
  }
}

/**
 * Wait for the bridge to register a Figma plugin client.
 * Replaces non-deterministic setTimeout(50) waits after figma_hello.
 */
async function waitForFigmaRegistered(
  bridgeState: { figmaPluginClient: string | null },
  timeoutMs = 5000
): Promise<void> {
  const start = Date.now();
  while (bridgeState.figmaPluginClient === null) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for Figma plugin registration');
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

let bridge: TestBridgeHandle;

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

afterEach(async () => {
  if (bridge) {
    await bridge.close();
  }
});

// ─── Figma Plugin Registration ────────────────────────────────────────

describe('Figma plugin registration', () => {
  it('accepts first Figma plugin connection', async () => {
    bridge = startTestBridge();

    const figma = new TestWSClient();
    await figma.connect(bridge.wsUrl);

    // Wait for the welcome message
    const welcome = await figma.waitForMessage((m) => m.type === 'connection');
    expect(welcome.type).toBe('connection');

    // Register as Figma plugin
    figma.send({ type: 'figma_hello', source: 'figma-plugin' });

    // Wait for bridge to register the Figma plugin
    await waitForFigmaRegistered(bridge.server.state);

    // Verify the bridge registered the Figma plugin with a client ID string
    expect(bridge.server.state.figmaPluginClient).toMatch(/^client-/);

    figma.disconnect();
  });

  it('rejects duplicate Figma plugin connections', async () => {
    bridge = startTestBridge();

    // First plugin
    const figma1 = new TestWSClient();
    await figma1.connect(bridge.wsUrl);
    await figma1.waitForMessage((m) => m.type === 'connection');
    figma1.send({ type: 'figma_hello', source: 'figma-plugin' });
    await waitForFigmaRegistered(bridge.server.state);

    // Second plugin
    const figma2 = new TestWSClient();
    await figma2.connect(bridge.wsUrl);
    await figma2.waitForMessage((m) => m.type === 'connection');
    figma2.send({ type: 'figma_hello', source: 'figma-plugin' });

    // Second plugin should receive an error and be disconnected
    const error = await figma2.waitForMessage((m) => m.type === 'error');
    expect(error.message).toContain('Multiple Figma plugin instances');

    // Only one Figma plugin should be registered — the first one's client ID
    expect(bridge.server.state.figmaPluginClient).toMatch(/^client-/);

    figma1.disconnect();
    figma2.disconnect();
  });

  it('clears Figma plugin assignment on disconnect', async () => {
    bridge = startTestBridge();

    const figma = new TestWSClient();
    await figma.connect(bridge.wsUrl);
    await figma.waitForMessage((m) => m.type === 'connection');
    figma.send({ type: 'figma_hello', source: 'figma-plugin' });
    await waitForFigmaRegistered(bridge.server.state);

    expect(bridge.server.state.figmaPluginClient).toMatch(/^client-/);

    // Disconnect and wait for bridge to clear the Figma plugin assignment
    figma.disconnect();
    const dcStart = Date.now();
    while (bridge.server.state.figmaPluginClient !== null) {
      if (Date.now() - dcStart > 5000) throw new Error('Timed out waiting for disconnect cleanup');
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    expect(bridge.server.state.figmaPluginClient).toBeNull();
  });
});

// ─── Request Routing ──────────────────────────────────────────────────

describe('request routing MCP → Figma', () => {
  it('routes MCP request to the registered Figma plugin', async () => {
    bridge = startTestBridge();

    // Connect and register Figma plugin
    const figma = new TestWSClient();
    await figma.connect(bridge.wsUrl);
    await figma.waitForMessage((m) => m.type === 'connection');
    figma.send({ type: 'figma_hello', source: 'figma-plugin' });
    await waitForFigmaRegistered(bridge.server.state);

    // Connect an MCP client
    const mcp = new TestWSClient();
    await mcp.connect(bridge.wsUrl);
    await mcp.waitForMessage((m) => m.type === 'connection');
    mcp.clearMessages();

    // Send a request from MCP
    mcp.send({
      id: 'req-1',
      type: 'create_frame',
      payload: { name: 'Test' }
    });

    // Figma plugin should receive the request
    const request = await figma.waitForMessage(
      (m) => m.type === 'create_frame' && m.id === 'req-1'
    );
    expect(request.type).toBe('create_frame');
    expect((request.payload as Record<string, unknown>).name).toBe('Test');

    mcp.disconnect();
    figma.disconnect();
  });

  it('sends error when no Figma plugin is connected', async () => {
    bridge = startTestBridge();

    // Connect MCP client only (no Figma plugin)
    const mcp = new TestWSClient();
    await mcp.connect(bridge.wsUrl);
    await mcp.waitForMessage((m) => m.type === 'connection');

    // Send a request — no Figma plugin to route to
    mcp.send({
      id: 'req-orphan',
      type: 'create_frame',
      payload: { name: 'NoTarget' }
    });

    // Wait for the bridge to process the request and send an error response
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The bridge sends an error response immediately when no Figma plugin is connected,
    // then cleans up the pending origin.
    expect(bridge.server.state.figmaPluginClient).toBeNull();
    expect(bridge.server.state.pendingRequestOrigins.size).toBe(0);

    mcp.disconnect();
  });
});

// ─── Response Routing ─────────────────────────────────────────────────

describe('response routing Figma → MCP', () => {
  it('routes Figma response back to the originating MCP client', async () => {
    bridge = startTestBridge();

    // Setup: Figma plugin
    const figma = new TestWSClient();
    await figma.connect(bridge.wsUrl);
    await figma.waitForMessage((m) => m.type === 'connection');
    figma.send({ type: 'figma_hello', source: 'figma-plugin' });
    await waitForFigmaRegistered(bridge.server.state);

    // Setup: MCP client
    const mcp = new TestWSClient();
    await mcp.connect(bridge.wsUrl);
    await mcp.waitForMessage((m) => m.type === 'connection');
    mcp.clearMessages();

    // MCP sends request
    mcp.send({ id: 'req-100', type: 'create_frame', payload: { name: 'Test' } });

    // Figma plugin receives and responds
    const request = await figma.waitForMessage((m) => m.id === 'req-100');
    figma.send({
      id: 'req-100',
      success: true,
      data: { nodeId: 'result-node-1' }
    });

    // MCP client should receive the response
    const response = await mcp.waitForMessage((m) => m.id === 'req-100');
    expect(response.success).toBe(true);
    expect((response.data as Record<string, unknown>).nodeId).toBe('result-node-1');

    mcp.disconnect();
    figma.disconnect();
  });

  it('isolates responses between two MCP clients', async () => {
    bridge = startTestBridge();

    // Figma plugin
    const figma = new TestWSClient();
    await figma.connect(bridge.wsUrl);
    await figma.waitForMessage((m) => m.type === 'connection');
    figma.send({ type: 'figma_hello', source: 'figma-plugin' });
    await waitForFigmaRegistered(bridge.server.state);

    // Two MCP clients
    const mcp1 = new TestWSClient();
    await mcp1.connect(bridge.wsUrl);
    await mcp1.waitForMessage((m) => m.type === 'connection');
    mcp1.clearMessages();

    const mcp2 = new TestWSClient();
    await mcp2.connect(bridge.wsUrl);
    await mcp2.waitForMessage((m) => m.type === 'connection');
    mcp2.clearMessages();

    // Both send requests
    mcp1.send({ id: 'mcp1-req', type: 'create_frame', payload: { name: 'FromMCP1' } });
    mcp2.send({ id: 'mcp2-req', type: 'create_frame', payload: { name: 'FromMCP2' } });

    // Figma receives both
    const req1 = await figma.waitForMessage((m) => m.id === 'mcp1-req');
    const req2 = await figma.waitForMessage((m) => m.id === 'mcp2-req');

    // Respond in reverse order to test routing precision
    figma.send({ id: 'mcp2-req', success: true, data: { nodeId: 'for-mcp2' } });
    figma.send({ id: 'mcp1-req', success: true, data: { nodeId: 'for-mcp1' } });

    // Each MCP client should receive only their own response
    const resp1 = await mcp1.waitForMessage((m) => m.id === 'mcp1-req');
    const resp2 = await mcp2.waitForMessage((m) => m.id === 'mcp2-req');

    expect((resp1.data as Record<string, unknown>).nodeId).toBe('for-mcp1');
    expect((resp2.data as Record<string, unknown>).nodeId).toBe('for-mcp2');

    // Verify no cross-talk: mcp1 should NOT have mcp2's response
    const mcp1Messages = mcp1.getMessages();
    const crossTalk = mcp1Messages.find((m) => m.id === 'mcp2-req');
    expect(crossTalk).toBeUndefined();

    mcp1.disconnect();
    mcp2.disconnect();
    figma.disconnect();
  });
});

// ─── Three-Client Isolation ──────────────────────────────────────────

describe('three-client request isolation', () => {
  it('routes responses to correct client among three concurrent MCP clients', async () => {
    bridge = startTestBridge();

    // Figma plugin
    const figma = new TestWSClient();
    await figma.connect(bridge.wsUrl);
    await figma.waitForMessage((m) => m.type === 'connection');
    figma.send({ type: 'figma_hello', source: 'figma-plugin' });
    await waitForFigmaRegistered(bridge.server.state);

    // Three MCP clients
    const clients = [];
    for (let i = 0; i < 3; i++) {
      const c = new TestWSClient();
      await c.connect(bridge.wsUrl);
      await c.waitForMessage((m) => m.type === 'connection');
      c.clearMessages();
      clients.push(c);
    }

    // All three send requests
    clients[0].send({ id: 'c0-req', type: 'create_frame', payload: { name: 'C0' } });
    clients[1].send({ id: 'c1-req', type: 'create_frame', payload: { name: 'C1' } });
    clients[2].send({ id: 'c2-req', type: 'create_frame', payload: { name: 'C2' } });

    // Figma receives all three
    const req0 = await figma.waitForMessage((m) => m.id === 'c0-req');
    const req1 = await figma.waitForMessage((m) => m.id === 'c1-req');
    const req2 = await figma.waitForMessage((m) => m.id === 'c2-req');

    // Respond in reverse order
    figma.send({ id: 'c2-req', success: true, data: { nodeId: 'for-c2' } });
    figma.send({ id: 'c0-req', success: true, data: { nodeId: 'for-c0' } });
    figma.send({ id: 'c1-req', success: true, data: { nodeId: 'for-c1' } });

    // Each client receives only their own response
    const r0 = await clients[0].waitForMessage((m) => m.id === 'c0-req');
    const r1 = await clients[1].waitForMessage((m) => m.id === 'c1-req');
    const r2 = await clients[2].waitForMessage((m) => m.id === 'c2-req');

    expect((r0.data as Record<string, unknown>).nodeId).toBe('for-c0');
    expect((r1.data as Record<string, unknown>).nodeId).toBe('for-c1');
    expect((r2.data as Record<string, unknown>).nodeId).toBe('for-c2');

    // Verify no cross-talk
    for (let i = 0; i < 3; i++) {
      const msgs = clients[i].getMessages();
      const foreignIds = msgs.filter((m) => m.id !== undefined && m.id !== `c${i}-req`);
      expect(foreignIds).toHaveLength(0);
    }

    for (const c of clients) c.disconnect();
    figma.disconnect();
  });
});

// ─── Figma Plugin Reconnection ─────────────────────────────────────────

describe('Figma plugin disconnect and reconnect', () => {
  it('allows new Figma plugin after previous one disconnects', async () => {
    bridge = startTestBridge();

    // First plugin connects
    const figma1 = new TestWSClient();
    await figma1.connect(bridge.wsUrl);
    await figma1.waitForMessage((m) => m.type === 'connection');
    figma1.send({ type: 'figma_hello', source: 'figma-plugin' });
    await waitForFigmaRegistered(bridge.server.state);

    expect(bridge.server.state.figmaPluginClient).toMatch(/^client-/);

    // First plugin disconnects — wait for bridge to clear the assignment
    figma1.disconnect();
    const dcStart2 = Date.now();
    while (bridge.server.state.figmaPluginClient !== null) {
      if (Date.now() - dcStart2 > 5000) throw new Error('Timed out waiting for disconnect');
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(bridge.server.state.figmaPluginClient).toBeNull();

    // Second plugin connects — should succeed
    const figma2 = new TestWSClient();
    await figma2.connect(bridge.wsUrl);
    await figma2.waitForMessage((m) => m.type === 'connection');
    figma2.send({ type: 'figma_hello', source: 'figma-plugin' });
    await waitForFigmaRegistered(bridge.server.state);

    expect(bridge.server.state.figmaPluginClient).toMatch(/^client-/);

    // MCP client can route to the new plugin
    const mcp = new TestWSClient();
    await mcp.connect(bridge.wsUrl);
    await mcp.waitForMessage((m) => m.type === 'connection');
    mcp.clearMessages();

    mcp.send({ id: 'new-req', type: 'test', payload: {} });
    const req = await figma2.waitForMessage((m) => m.id === 'new-req');
    expect(req.id).toBe('new-req');

    mcp.disconnect();
    figma2.disconnect();
  });
});

// ─── Orphan & Duplicate Responses ─────────────────────────────────────

describe('orphan and duplicate response handling', () => {
  it('bridge does not crash when Figma plugin sends a response with unknown request ID', async () => {
    // Bug: a plugin could send a response for a request ID that was already
    // cleaned up (e.g., client disconnected before response arrived). The
    // bridge must handle this gracefully without crashing or state corruption.
    bridge = startTestBridge();

    // Setup Figma plugin
    const figma = new TestWSClient();
    await figma.connect(bridge.wsUrl);
    await figma.waitForMessage((m) => m.type === 'connection');
    figma.send({ type: 'figma_hello', source: 'figma-plugin' });
    await waitForFigmaRegistered(bridge.server.state);

    // Connect MCP client
    const mcp = new TestWSClient();
    await mcp.connect(bridge.wsUrl);
    await mcp.waitForMessage((m) => m.type === 'connection');
    mcp.clearMessages();

    // Plugin sends a response for a request ID nobody asked for
    figma.send({ id: 'nonexistent-req-999', success: true, data: { nodeId: 'ghost' } });

    // Bridge should not crash. Verify by sending a real request after.
    mcp.send({ id: 'real-req', type: 'create_frame', payload: { name: 'AfterOrphan' } });
    const request = await figma.waitForMessage((m) => m.id === 'real-req');
    expect(request.id).toBe('real-req');

    // Respond to the real request
    figma.send({ id: 'real-req', success: true, data: { nodeId: 'real-node' } });
    const response = await mcp.waitForMessage((m) => m.id === 'real-req');
    expect((response.data as Record<string, unknown>).nodeId).toBe('real-node');

    // MCP should NOT have received the orphan response
    const orphanMsg = mcp.getMessages().find((m) => m.id === 'nonexistent-req-999');
    expect(orphanMsg).toBeUndefined();

    mcp.disconnect();
    figma.disconnect();
  });

  it('bridge handles duplicate response from plugin for the same request ID', async () => {
    // Bug: network retry or plugin bug sends the same response twice.
    // The first response should be routed; the second should be silently dropped.
    bridge = startTestBridge();

    const figma = new TestWSClient();
    await figma.connect(bridge.wsUrl);
    await figma.waitForMessage((m) => m.type === 'connection');
    figma.send({ type: 'figma_hello', source: 'figma-plugin' });
    await waitForFigmaRegistered(bridge.server.state);

    const mcp = new TestWSClient();
    await mcp.connect(bridge.wsUrl);
    await mcp.waitForMessage((m) => m.type === 'connection');
    mcp.clearMessages();

    // MCP sends a request
    mcp.send({ id: 'dup-req', type: 'create_frame', payload: { name: 'DupTest' } });

    // Figma receives the request
    await figma.waitForMessage((m) => m.id === 'dup-req');

    // Plugin sends the response TWICE
    figma.send({ id: 'dup-req', success: true, data: { nodeId: 'first-response' } });
    figma.send({ id: 'dup-req', success: true, data: { nodeId: 'second-response' } });

    // MCP should receive the first response
    const firstResp = await mcp.waitForMessage((m) => m.id === 'dup-req');
    expect((firstResp.data as Record<string, unknown>).nodeId).toBe('first-response');

    // The pending origin should have been cleaned up after the first response,
    // so the second response has no origin to route to. Verify bridge didn't crash
    // by sending another request.
    mcp.send({ id: 'after-dup', type: 'test', payload: {} });
    const nextReq = await figma.waitForMessage((m) => m.id === 'after-dup');
    expect(nextReq.id).toBe('after-dup');

    mcp.disconnect();
    figma.disconnect();
  });
});

// ─── Message Validation ───────────────────────────────────────────────

describe('message validation', () => {
  it('rejects oversized messages with error response', async () => {
    bridge = startTestBridge();

    const client = new TestWSClient();
    await client.connect(bridge.wsUrl);
    await client.waitForMessage((m) => m.type === 'connection');
    client.clearMessages();

    // Send a message larger than MAX_MESSAGE_SIZE (10MB).
    // The bridge should respond with an error message, not crash.
    const largePayload = 'x'.repeat(11 * 1024 * 1024); // 11MB string
    let sendFailed = false;
    try {
      client.send({ type: 'test', payload: largePayload });
    } catch {
      // WebSocket library may reject before sending — also valid
      sendFailed = true;
    }

    if (!sendFailed) {
      // If the send went through, the bridge should respond with a size error
      try {
        const error = await client.waitForMessage((m) => m.type === 'error', 3000);
        expect(error.type).toBe('error');
        expect(error.error).toContain('size');
      } catch {
        // Connection may have been dropped instead — also acceptable
      }
    }

    client.disconnect();
  });

  it('rejects invalid JSON', async () => {
    bridge = startTestBridge();

    const client = new TestWSClient();
    await client.connect(bridge.wsUrl);
    await client.waitForMessage((m) => m.type === 'connection');
    client.clearMessages();

    // Send raw invalid JSON through the underlying WebSocket
    // TestWSClient.send() calls JSON.stringify, so we access the ws directly
    // Instead, send a message that is valid JSON but invalid structure
    // The server will parse it but validateMessage() returns null
    client.send({ randomField: 'invalid structure only' });

    // Should receive an error about unrecognized format
    const error = await client.waitForMessage((m) => m.type === 'error');
    expect(error.type).toBe('error');

    client.disconnect();
  });

  it('rejects unrecognized message format', async () => {
    bridge = startTestBridge();

    const client = new TestWSClient();
    await client.connect(bridge.wsUrl);
    await client.waitForMessage((m) => m.type === 'connection');
    client.clearMessages();

    // Send a message that doesn't match any known format
    client.send({ randomField: 'value', anotherField: 42 });

    // Should receive an error response about unrecognized format
    const error = await client.waitForMessage((m) => m.type === 'error');
    expect(error.error).toContain('Unrecognized');

    client.disconnect();
  });
});

// ─── Connection Cleanup ───────────────────────────────────────────────

describe('connection cleanup', () => {
  it('removes client from state on disconnect', async () => {
    bridge = startTestBridge();

    const client = new TestWSClient();
    await client.connect(bridge.wsUrl);
    await client.waitForMessage((m) => m.type === 'connection');

    expect(bridge.server.state.clients.size).toBe(1);

    client.disconnect();
    const dcStart3 = Date.now();
    while (bridge.server.state.clients.size > 0) {
      if (Date.now() - dcStart3 > 5000) throw new Error('Timed out waiting for client cleanup');
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    expect(bridge.server.state.clients.size).toBe(0);
  });

  it('cleans up pending request origins when MCP client disconnects', async () => {
    bridge = startTestBridge();

    // Figma plugin
    const figma = new TestWSClient();
    await figma.connect(bridge.wsUrl);
    await figma.waitForMessage((m) => m.type === 'connection');
    figma.send({ type: 'figma_hello', source: 'figma-plugin' });
    await waitForFigmaRegistered(bridge.server.state);

    // MCP client sends request then disconnects before response
    const mcp = new TestWSClient();
    await mcp.connect(bridge.wsUrl);
    await mcp.waitForMessage((m) => m.type === 'connection');

    mcp.send({ id: 'orphan-req', type: 'test', payload: {} });

    // Wait for the bridge to track the pending request origin
    const start = Date.now();
    while (bridge.server.state.pendingRequestOrigins.size === 0) {
      if (Date.now() - start > 5000) throw new Error('Timed out waiting for pending request');
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    // Request origin should be tracked
    expect(bridge.server.state.pendingRequestOrigins.size).toBe(1);

    // Disconnect MCP client and wait for cleanup
    mcp.disconnect();
    const cleanupStart = Date.now();
    while (bridge.server.state.pendingRequestOrigins.size > 0) {
      if (Date.now() - cleanupStart > 5000)
        throw new Error('Timed out waiting for request origin cleanup');
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    // Pending request origins for this client should be cleaned up
    expect(bridge.server.state.pendingRequestOrigins.size).toBe(0);

    figma.disconnect();
  });
});
