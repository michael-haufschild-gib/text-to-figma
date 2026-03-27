/**
 * Multi-Agent E2E Tests
 *
 * Tests the full three-tier stack (MCP clients -> WebSocket bridge -> Figma plugin)
 * with multiple concurrent AI agents sharing a single Figma plugin connection.
 *
 * Bugs these catch:
 * - peer_operation notifications not reaching non-originating agents
 * - Response cross-talk under concurrent multi-agent load
 * - _pageId not passed through the bridge to the Figma plugin
 * - Interleaved responses routed to wrong agent
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { startTestBridge, type TestBridgeHandle } from './helpers/test-bridge.js';

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

  async waitForMessage(
    predicate: (msg: Record<string, unknown>) => boolean,
    timeoutMs = 3000
  ): Promise<Record<string, unknown>> {
    const idx = this.messages.findIndex(predicate);
    if (idx !== -1) {
      return this.messages.splice(idx, 1)[0];
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
          this.messageResolvers.push(check);
        }
      };

      this.messageResolvers.push(check);
    });
  }

  /** Collect all messages received so far matching a predicate */
  drain(predicate: (msg: Record<string, unknown>) => boolean): Record<string, unknown>[] {
    const matching = this.messages.filter(predicate);
    this.messages = this.messages.filter((m) => !predicate(m));
    return matching;
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}

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

// ─── Helpers ────────────────────────────────────────────────────────

function isResponse(msg: Record<string, unknown>): boolean {
  return typeof msg.id === 'string' && typeof msg.success === 'boolean';
}

function isPeerNotification(msg: Record<string, unknown>): boolean {
  return msg.type === 'figma_notification' && msg.kind === 'peer_operation';
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('multi-agent peer_operation broadcasting', () => {
  it('agent B receives peer_operation when agent A gets a successful response', async () => {
    bridge = startTestBridge();

    // Connect Figma plugin
    const figma = new TestWSClient();
    await figma.connect(bridge.wsUrl);
    await figma.waitForMessage((m) => m.type === 'connection');
    figma.send({ type: 'figma_hello', source: 'figma-plugin' });
    await waitForFigmaRegistered(bridge.server.state);

    // Connect two MCP agents
    const agentA = new TestWSClient();
    const agentB = new TestWSClient();
    await agentA.connect(bridge.wsUrl);
    await agentB.connect(bridge.wsUrl);
    await agentA.waitForMessage((m) => m.type === 'connection');
    await agentB.waitForMessage((m) => m.type === 'connection');

    // Agent A sends a request
    agentA.send({ type: 'create_frame', payload: { name: 'Frame1' }, id: 'req-a1' });
    await new Promise((r) => setTimeout(r, 50));

    // Figma responds to Agent A
    const figmaMsg = await figma.waitForMessage(
      (m) => (m as Record<string, unknown>).type === 'create_frame'
    );
    expect(figmaMsg.id).toBe('req-a1');

    figma.send({ id: 'req-a1', success: true, data: { nodeId: '1:1' } });

    // Agent A gets the response
    const responseA = await agentA.waitForMessage(isResponse);
    expect(responseA.id).toBe('req-a1');
    expect(responseA.success).toBe(true);

    // Agent B gets a peer_operation notification
    const peerNotification = await agentB.waitForMessage(isPeerNotification);
    expect(peerNotification.kind).toBe('peer_operation');
    expect((peerNotification.data as Record<string, unknown>).requestId).toBe('req-a1');

    agentA.disconnect();
    agentB.disconnect();
    figma.disconnect();
  });

  it('agent A does NOT receive peer_operation for its own request', async () => {
    bridge = startTestBridge();

    const figma = new TestWSClient();
    await figma.connect(bridge.wsUrl);
    await figma.waitForMessage((m) => m.type === 'connection');
    figma.send({ type: 'figma_hello', source: 'figma-plugin' });
    await waitForFigmaRegistered(bridge.server.state);

    const agentA = new TestWSClient();
    const agentB = new TestWSClient();
    await agentA.connect(bridge.wsUrl);
    await agentB.connect(bridge.wsUrl);
    await agentA.waitForMessage((m) => m.type === 'connection');
    await agentB.waitForMessage((m) => m.type === 'connection');

    agentA.send({ type: 'set_fills', payload: {}, id: 'req-fills' });
    await new Promise((r) => setTimeout(r, 50));

    // Consume the request at Figma side
    await figma.waitForMessage((m) => (m as Record<string, unknown>).type === 'set_fills');
    figma.send({ id: 'req-fills', success: true, data: {} });

    // Agent A gets the response
    const responseA = await agentA.waitForMessage(isResponse);
    expect(responseA.id).toBe('req-fills');

    // Wait a bit for any stray messages
    await new Promise((r) => setTimeout(r, 100));

    // Agent A should NOT have received a peer_operation (it was the originator)
    const strayNotifications = agentA.drain(isPeerNotification);
    expect(strayNotifications).toHaveLength(0);

    agentA.disconnect();
    agentB.disconnect();
    figma.disconnect();
  });

  it('failed responses do not trigger peer_operation', async () => {
    bridge = startTestBridge();

    const figma = new TestWSClient();
    await figma.connect(bridge.wsUrl);
    await figma.waitForMessage((m) => m.type === 'connection');
    figma.send({ type: 'figma_hello', source: 'figma-plugin' });
    await waitForFigmaRegistered(bridge.server.state);

    const agentA = new TestWSClient();
    const agentB = new TestWSClient();
    await agentA.connect(bridge.wsUrl);
    await agentB.connect(bridge.wsUrl);
    await agentA.waitForMessage((m) => m.type === 'connection');
    await agentB.waitForMessage((m) => m.type === 'connection');

    agentA.send({ type: 'remove_node', payload: {}, id: 'req-fail' });
    await new Promise((r) => setTimeout(r, 50));

    await figma.waitForMessage((m) => (m as Record<string, unknown>).type === 'remove_node');
    figma.send({ id: 'req-fail', success: false, error: 'Node not found' });

    // Agent A gets the error response
    const responseA = await agentA.waitForMessage(isResponse);
    expect(responseA.success).toBe(false);

    // Wait and check that Agent B did NOT receive peer_operation
    await new Promise((r) => setTimeout(r, 100));
    const notifications = agentB.drain(isPeerNotification);
    expect(notifications).toHaveLength(0);

    agentA.disconnect();
    agentB.disconnect();
    figma.disconnect();
  });
});

describe('multi-agent response isolation under concurrent load', () => {
  it('three agents sending simultaneous requests get correct responses', async () => {
    bridge = startTestBridge();

    const figma = new TestWSClient();
    await figma.connect(bridge.wsUrl);
    await figma.waitForMessage((m) => m.type === 'connection');
    figma.send({ type: 'figma_hello', source: 'figma-plugin' });
    await waitForFigmaRegistered(bridge.server.state);

    const agents = await Promise.all(
      [0, 1, 2].map(async () => {
        const agent = new TestWSClient();
        await agent.connect(bridge.wsUrl);
        await agent.waitForMessage((m) => m.type === 'connection');
        return agent;
      })
    );

    // All three agents send requests simultaneously
    agents[0].send({ type: 'create_frame', payload: {}, id: 'agent0-req' });
    agents[1].send({ type: 'create_text', payload: {}, id: 'agent1-req' });
    agents[2].send({ type: 'create_ellipse', payload: {}, id: 'agent2-req' });
    await new Promise((r) => setTimeout(r, 100));

    // Figma responds in reverse order
    const figmaMessages: Record<string, unknown>[] = [];
    for (let i = 0; i < 3; i++) {
      const msg = await figma.waitForMessage(
        (m) =>
          typeof (m as Record<string, unknown>).type === 'string' &&
          (m as Record<string, unknown>).type !== 'connection'
      );
      figmaMessages.push(msg);
    }

    // Respond in reverse order of request arrival
    for (const msg of figmaMessages.reverse()) {
      figma.send({
        id: msg.id,
        success: true,
        data: { result: `response-for-${String(msg.id)}` }
      });
    }

    // Each agent should get its own response
    for (let i = 0; i < 3; i++) {
      const resp = await agents[i].waitForMessage(isResponse);
      expect(resp.id).toBe(`agent${i}-req`);
      expect(resp.success).toBe(true);
      expect((resp.data as Record<string, unknown>).result).toBe(`response-for-agent${i}-req`);
    }

    for (const agent of agents) agent.disconnect();
    figma.disconnect();
  });
});

describe('_pageId passthrough', () => {
  it('bridge passes _pageId from MCP request through to Figma plugin', async () => {
    bridge = startTestBridge();

    const figma = new TestWSClient();
    await figma.connect(bridge.wsUrl);
    await figma.waitForMessage((m) => m.type === 'connection');
    figma.send({ type: 'figma_hello', source: 'figma-plugin' });
    await waitForFigmaRegistered(bridge.server.state);

    const agent = new TestWSClient();
    await agent.connect(bridge.wsUrl);
    await agent.waitForMessage((m) => m.type === 'connection');

    // Send request with _pageId
    agent.send({
      type: 'create_frame',
      payload: { name: 'Frame1' },
      id: 'req-paged',
      _pageId: '42:0'
    });

    // Figma should receive the message with _pageId preserved
    const figmaMsg = await figma.waitForMessage(
      (m) => (m as Record<string, unknown>).id === 'req-paged'
    );
    expect(figmaMsg._pageId).toBe('42:0');
    expect(figmaMsg.type).toBe('create_frame');

    agent.disconnect();
    figma.disconnect();
  });

  it('bridge passes requests without _pageId when not provided', async () => {
    bridge = startTestBridge();

    const figma = new TestWSClient();
    await figma.connect(bridge.wsUrl);
    await figma.waitForMessage((m) => m.type === 'connection');
    figma.send({ type: 'figma_hello', source: 'figma-plugin' });
    await waitForFigmaRegistered(bridge.server.state);

    const agent = new TestWSClient();
    await agent.connect(bridge.wsUrl);
    await agent.waitForMessage((m) => m.type === 'connection');

    agent.send({
      type: 'get_selection',
      payload: {},
      id: 'req-no-page'
    });

    const figmaMsg = await figma.waitForMessage(
      (m) => (m as Record<string, unknown>).id === 'req-no-page'
    );
    expect(figmaMsg._pageId).toBeUndefined();

    agent.disconnect();
    figma.disconnect();
  });
});

describe('multi-agent notification broadcasting', () => {
  it('all agents receive document_changed notifications from Figma', async () => {
    bridge = startTestBridge();

    const figma = new TestWSClient();
    await figma.connect(bridge.wsUrl);
    await figma.waitForMessage((m) => m.type === 'connection');
    figma.send({ type: 'figma_hello', source: 'figma-plugin' });
    await waitForFigmaRegistered(bridge.server.state);

    const agents = await Promise.all(
      [0, 1].map(async () => {
        const agent = new TestWSClient();
        await agent.connect(bridge.wsUrl);
        await agent.waitForMessage((m) => m.type === 'connection');
        return agent;
      })
    );

    // Figma plugin sends a document_changed notification
    figma.send({
      type: 'figma_notification',
      kind: 'document_changed',
      data: {}
    });

    // Both agents should receive it
    for (const agent of agents) {
      const notification = await agent.waitForMessage(
        (m) => m.type === 'figma_notification' && m.kind === 'document_changed'
      );
      expect(notification.kind).toBe('document_changed');
    }

    for (const agent of agents) agent.disconnect();
    figma.disconnect();
  });
});
