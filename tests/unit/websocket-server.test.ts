/**
 * WebSocket Bridge Server Unit Tests
 *
 * Tests the exported pure functions and the createServer() lifecycle.
 * Pure function tests use mock WebSocket objects.
 * Server lifecycle tests spin up a real server on a random port.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import {
  validateMessage,
  handleFigmaRegistration,
  routeRequest,
  routeResponse,
  routeMessage,
  createServer,
  createServerState,
  type ServerState,
  type ServerHandle,
  type BridgeMessage,
  type ClientRecord
} from '../../websocket-server/src/server.js';

// Helper: create a mock WebSocket with spy methods
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

// Helper: create a ClientRecord with a mock ws
function mockClient(overrides: Partial<ClientRecord> = {}): ClientRecord {
  return {
    ws: mockWs(),
    isAlive: true,
    lastPong: Date.now(),
    ...overrides
  };
}

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

// ─── validateMessage ────────────────────────────────────────────────

describe('validateMessage', () => {
  it('returns null for null/undefined/primitives', () => {
    expect(validateMessage(null)).toBeNull();
    expect(validateMessage(undefined)).toBeNull();
    expect(validateMessage(42)).toBeNull();
    expect(validateMessage('string')).toBeNull();
    expect(validateMessage(true)).toBeNull();
  });

  it('returns null for empty objects and unrecognized shapes', () => {
    expect(validateMessage({})).toBeNull();
    expect(validateMessage({ foo: 'bar' })).toBeNull();
    expect(validateMessage({ type: 'hello' })).toBeNull(); // no payload or source
    expect(validateMessage({ id: 123, success: true })).toBeNull(); // id not string
  });

  it('classifies FigmaHelloMessage', () => {
    const msg = { type: 'figma_hello', source: 'figma-plugin' };
    const result = validateMessage(msg);
    expect(result).toEqual(msg);
  });

  it('rejects figma_hello with wrong source', () => {
    expect(validateMessage({ type: 'figma_hello', source: 'other' })).toBeNull();
  });

  it('classifies ResponseMessage (id + success)', () => {
    const msg = { id: 'req-1', success: true, data: { nodeId: '1:2' } };
    const result = validateMessage(msg);
    expect(result).toEqual(msg);
  });

  it('classifies failed ResponseMessage', () => {
    const msg = { id: 'req-2', success: false, error: 'not found' };
    expect(validateMessage(msg)).toEqual(msg);
  });

  it('classifies RequestMessage (type + payload)', () => {
    const msg = { type: 'create_frame', payload: { x: 0, y: 0 } };
    const result = validateMessage(msg);
    expect(result).toEqual(msg);
  });

  it('classifies RequestMessage with null payload', () => {
    const msg = { type: 'list_pages', payload: null };
    expect(validateMessage(msg)).toEqual(msg);
  });

  it('prefers FigmaHelloMessage over RequestMessage when both match', () => {
    // This message has type + source (FigmaHello) AND type + payload (Request).
    // FigmaHello is checked first, so it should win.
    const msg = { type: 'figma_hello', source: 'figma-plugin', payload: {} };
    const result = validateMessage(msg);
    expect(result).toEqual(msg);
    expect((result as { type: string }).type).toBe('figma_hello');
  });

  it('prefers ResponseMessage over RequestMessage when both match', () => {
    // Has id+success (Response) AND type+payload (Request). Response checked first.
    const msg = { type: 'some_type', payload: {}, id: 'req-1', success: true };
    const result = validateMessage(msg);
    // Response is checked before Request — but actually FigmaHello is first,
    // then Response, then Request. This has id+success so it's a Response.
    expect(result).toEqual(msg);
  });
});

// ─── handleFigmaRegistration ────────────────────────────────────────

describe('handleFigmaRegistration', () => {
  let state: ServerState;

  beforeEach(() => {
    state = createServerState();
  });

  it('returns false for non-figma_hello messages', () => {
    const ws = mockWs();
    const msg: BridgeMessage = { type: 'create_frame', payload: {} };
    expect(handleFigmaRegistration(state, msg, 'client-1', ws)).toBe(false);
  });

  it('registers the first Figma plugin as primary', () => {
    const ws = mockWs();
    state.clients.set('client-1', mockClient({ ws }));

    const msg: BridgeMessage = { type: 'figma_hello', source: 'figma-plugin' };
    const result = handleFigmaRegistration(state, msg, 'client-1', ws);

    expect(result).toBe(true);
    expect(state.figmaPluginClient).toBe('client-1');
    expect(state.clients.get('client-1')?.isFigma).toBe(true);
  });

  it('rejects duplicate Figma plugin and closes connection', () => {
    const ws1 = mockWs();
    const ws2 = mockWs();
    state.clients.set('client-1', mockClient({ ws: ws1 }));
    state.clients.set('client-2', mockClient({ ws: ws2 }));
    state.figmaPluginClient = 'client-1';

    const msg: BridgeMessage = { type: 'figma_hello', source: 'figma-plugin' };
    const result = handleFigmaRegistration(state, msg, 'client-2', ws2);

    expect(result).toBe(true);
    expect(state.figmaPluginClient).toBe('client-1'); // unchanged
    expect(ws2.send).toHaveBeenCalledWith(
      expect.stringContaining('Multiple Figma plugin instances')
    );
    expect(ws2.close).toHaveBeenCalled();
  });

  it('allows re-registration from the same client', () => {
    const ws = mockWs();
    state.clients.set('client-1', mockClient({ ws }));
    state.figmaPluginClient = 'client-1';

    const msg: BridgeMessage = { type: 'figma_hello', source: 'figma-plugin' };
    const result = handleFigmaRegistration(state, msg, 'client-1', ws);

    expect(result).toBe(true);
    expect(state.figmaPluginClient).toBe('client-1');
    expect(ws.close).not.toHaveBeenCalled();
  });

  it('handles registration when client is not in the map', () => {
    const ws = mockWs();
    // Don't add client-1 to state.clients
    const msg: BridgeMessage = { type: 'figma_hello', source: 'figma-plugin' };
    const result = handleFigmaRegistration(state, msg, 'client-1', ws);

    expect(result).toBe(true);
    expect(state.figmaPluginClient).toBeNull(); // not set because client not in map
  });
});

// ─── routeRequest ───────────────────────────────────────────────────

describe('routeRequest', () => {
  let state: ServerState;

  beforeEach(() => {
    state = createServerState();
  });

  it('marks sender as MCP client', () => {
    const senderClient = mockClient();
    state.clients.set('mcp-1', senderClient);

    routeRequest(state, { type: 'create_frame', payload: {} }, 'mcp-1');
    expect(senderClient.isMCP).toBe(true);
  });

  it('tracks request origin by message id', () => {
    state.clients.set('mcp-1', mockClient());

    routeRequest(state, { type: 'create_frame', payload: {}, id: 'req-42' }, 'mcp-1');
    expect(state.pendingRequestOrigins.get('req-42')).toBe('mcp-1');
  });

  it('forwards request to registered Figma plugin', () => {
    const figmaWs = mockWs();
    state.clients.set('figma-1', mockClient({ ws: figmaWs }));
    state.clients.set('mcp-1', mockClient());
    state.figmaPluginClient = 'figma-1';

    const msg: BridgeMessage = { type: 'create_frame', payload: { x: 0 } };
    routeRequest(state, msg, 'mcp-1');

    expect(figmaWs.send).toHaveBeenCalledWith(JSON.stringify(msg));
  });

  it('does not crash when no Figma plugin is connected', () => {
    state.clients.set('mcp-1', mockClient());
    // No figmaPluginClient set
    expect(() => routeRequest(state, { type: 'test', payload: {} }, 'mcp-1')).not.toThrow();
  });

  it('does not forward to closed Figma connection', () => {
    const figmaWs = mockWs(WebSocket.CLOSED);
    state.clients.set('figma-1', mockClient({ ws: figmaWs }));
    state.clients.set('mcp-1', mockClient());
    state.figmaPluginClient = 'figma-1';

    routeRequest(state, { type: 'test', payload: {} }, 'mcp-1');
    expect(figmaWs.send).not.toHaveBeenCalled();
  });
});

// ─── routeResponse ──────────────────────────────────────────────────

describe('routeResponse', () => {
  let state: ServerState;

  beforeEach(() => {
    state = createServerState();
  });

  it('routes response to originating MCP client', () => {
    const mcpWs = mockWs();
    state.clients.set('mcp-1', mockClient({ ws: mcpWs, isMCP: true }));
    state.figmaPluginClient = 'figma-1';
    state.pendingRequestOrigins.set('req-42', 'mcp-1');

    const response = { id: 'req-42', success: true, nodeId: '1:2' };
    routeResponse(state, response, 'figma-1');

    expect(mcpWs.send).toHaveBeenCalledWith(JSON.stringify(response));
    expect(state.pendingRequestOrigins.has('req-42')).toBe(false); // cleaned up
  });

  it('ignores response from non-Figma client', () => {
    const mcpWs = mockWs();
    state.clients.set('mcp-1', mockClient({ ws: mcpWs, isMCP: true }));
    state.figmaPluginClient = 'figma-1';
    state.pendingRequestOrigins.set('req-42', 'mcp-1');

    routeResponse(state, { id: 'req-42', success: true }, 'imposter-client');
    expect(mcpWs.send).not.toHaveBeenCalled();
  });

  it('broadcasts to all MCP clients when origin is unknown', () => {
    const mcpWs1 = mockWs();
    const mcpWs2 = mockWs();
    const nonMcpWs = mockWs();
    state.clients.set('mcp-1', mockClient({ ws: mcpWs1, isMCP: true }));
    state.clients.set('mcp-2', mockClient({ ws: mcpWs2, isMCP: true }));
    state.clients.set('other', mockClient({ ws: nonMcpWs }));
    // No figmaPluginClient set — so the guard `clientId !== figmaPluginClient` is skipped

    const response = { id: 'unknown-req', success: true };
    routeResponse(state, response, 'some-client');

    expect(mcpWs1.send).toHaveBeenCalledWith(JSON.stringify(response));
    expect(mcpWs2.send).toHaveBeenCalledWith(JSON.stringify(response));
    expect(nonMcpWs.send).not.toHaveBeenCalled();
  });

  it('does not send to closed MCP client', () => {
    const mcpWs = mockWs(WebSocket.CLOSED);
    state.clients.set('mcp-1', mockClient({ ws: mcpWs, isMCP: true }));
    state.pendingRequestOrigins.set('req-42', 'mcp-1');

    routeResponse(state, { id: 'req-42', success: true }, 'figma-1');
    expect(mcpWs.send).not.toHaveBeenCalled();
  });
});

// ─── routeMessage ───────────────────────────────────────────────────

describe('routeMessage', () => {
  let state: ServerState;

  beforeEach(() => {
    state = createServerState();
  });

  it('routes messages with type+payload as requests', () => {
    const figmaWs = mockWs();
    state.clients.set('figma-1', mockClient({ ws: figmaWs }));
    state.clients.set('mcp-1', mockClient());
    state.figmaPluginClient = 'figma-1';

    routeMessage(state, { type: 'create_frame', payload: { x: 0 } }, 'mcp-1');
    expect(figmaWs.send).toHaveBeenCalled();
  });

  it('routes messages with id+success as responses', () => {
    const mcpWs = mockWs();
    state.clients.set('mcp-1', mockClient({ ws: mcpWs, isMCP: true }));
    state.pendingRequestOrigins.set('req-1', 'mcp-1');

    // Cast needed because routeMessage checks 'id' in message
    const msg = { id: 'req-1', success: true } as BridgeMessage;
    routeMessage(state, msg, 'figma-1');
    expect(mcpWs.send).toHaveBeenCalled();
  });

  it('logs unknown messages without crashing', () => {
    // A figma_hello message is not a request or response, and is not handled by routeMessage
    // (it's handled by handleFigmaRegistration before routeMessage is called)
    const msg = { type: 'figma_hello', source: 'figma-plugin' } as BridgeMessage;
    expect(() => routeMessage(state, msg, 'client-1')).not.toThrow();
  });
});

// ─── createServer (integration-style) ───────────────────────────────

describe('createServer', () => {
  let handle: ServerHandle;
  const clients: WebSocket[] = [];

  // Use port 0 to let the OS assign a random available port
  function getPort(): number {
    const addr = handle.wss.address();
    if (typeof addr === 'object' && addr !== null) {
      return addr.port;
    }
    throw new Error('Server not listening');
  }

  beforeEach(() => {
    handle = createServer(0); // port 0 = random
  });

  afterEach(async () => {
    // Close all test clients
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
    clients.length = 0;

    // Shutdown server
    clearInterval(handle.heartbeatInterval);
    await new Promise<void>((resolve) => {
      handle.wss.close(() => resolve());
    });
  });

  it('sends welcome message with clientId on connection', async () => {
    const port = getPort();
    const { ws, welcome } = await connectClient(port);
    clients.push(ws);

    expect(welcome.type).toBe('connection');
    expect(welcome.message).toBe('Connected to WebSocket bridge server');
    expect(welcome.clientId).toMatch(/^client-/);
  });

  it('tracks connected clients in state', async () => {
    const port = getPort();
    const { ws } = await connectClient(port);
    clients.push(ws);

    expect(handle.state.clients.size).toBe(1);
  });

  it('removes client from state on disconnect', async () => {
    const port = getPort();
    const { ws } = await connectClient(port);

    await new Promise<void>((resolve) => {
      ws.on('close', () => resolve());
      ws.close();
    });

    // Small delay for server-side cleanup
    await new Promise((r) => setTimeout(r, 50));
    expect(handle.state.clients.size).toBe(0);
  });

  it('handles Figma plugin registration via WebSocket', async () => {
    const port = getPort();
    const { ws } = await connectClient(port);
    clients.push(ws);

    ws.send(JSON.stringify({ type: 'figma_hello', source: 'figma-plugin' }));

    // Give the server time to process
    await new Promise((r) => setTimeout(r, 50));
    expect(handle.state.figmaPluginClient).toMatch(/^client-/);
  });

  it('rejects invalid messages with error response', async () => {
    const port = getPort();
    const { ws } = await connectClient(port);
    clients.push(ws);

    const errorPromise = nextMessage(ws);
    ws.send(JSON.stringify({ invalid: 'structure' }));
    const error = await errorPromise;

    expect(error.type).toBe('error');
    expect(error.error).toBe('Unrecognized message format');
  });

  it('rejects malformed JSON with error response', async () => {
    const port = getPort();
    const { ws } = await connectClient(port);
    clients.push(ws);

    const errorPromise = nextMessage(ws);
    ws.send('not json{{{');
    const error = await errorPromise;

    expect(error.type).toBe('error');
    expect(error.error).toBe('Failed to parse message');
  });

  it('routes request from MCP to Figma and response back', async () => {
    const port = getPort();

    // Connect Figma plugin
    const { ws: figmaWs, welcome: figmaWelcome } = await connectClient(port);
    clients.push(figmaWs);
    figmaWs.send(JSON.stringify({ type: 'figma_hello', source: 'figma-plugin' }));
    await new Promise((r) => setTimeout(r, 50));

    // Connect MCP client
    const { ws: mcpWs } = await connectClient(port);
    clients.push(mcpWs);

    // MCP sends request — Figma should receive it
    const figmaReceived = nextMessage(figmaWs);
    mcpWs.send(JSON.stringify({ type: 'create_frame', payload: { x: 0 }, id: 'req-1' }));
    const request = await figmaReceived;

    expect(request.type).toBe('create_frame');
    expect(request.id).toBe('req-1');

    // Figma sends response — MCP should receive it
    const mcpReceived = nextMessage(mcpWs);
    figmaWs.send(JSON.stringify({ id: 'req-1', success: true, nodeId: '1:2' }));
    const response = await mcpReceived;

    expect(response.success).toBe(true);
    expect(response.nodeId).toBe('1:2');
  });

  it('enforces single Figma plugin instance', async () => {
    const port = getPort();

    // First Figma plugin connects and registers
    const { ws: figma1 } = await connectClient(port);
    clients.push(figma1);
    figma1.send(JSON.stringify({ type: 'figma_hello', source: 'figma-plugin' }));
    await new Promise((r) => setTimeout(r, 50));

    // Second Figma plugin tries to connect and register
    const { ws: figma2 } = await connectClient(port);
    clients.push(figma2);

    const errorPromise = nextMessage(figma2);
    figma2.send(JSON.stringify({ type: 'figma_hello', source: 'figma-plugin' }));
    const error = await errorPromise;

    expect(error.type).toBe('error');
    expect(error.message as string).toContain('Multiple Figma plugin instances');
  });

  it('cleans up pending request origins when client disconnects', async () => {
    const port = getPort();

    // Connect Figma
    const { ws: figmaWs } = await connectClient(port);
    clients.push(figmaWs);
    figmaWs.send(JSON.stringify({ type: 'figma_hello', source: 'figma-plugin' }));
    await new Promise((r) => setTimeout(r, 50));

    // Connect MCP and send request
    const { ws: mcpWs } = await connectClient(port);
    mcpWs.send(JSON.stringify({ type: 'test', payload: {}, id: 'req-orphan' }));
    await new Promise((r) => setTimeout(r, 50));

    expect(handle.state.pendingRequestOrigins.has('req-orphan')).toBe(true);

    // MCP client disconnects
    await new Promise<void>((resolve) => {
      mcpWs.on('close', () => resolve());
      mcpWs.close();
    });
    await new Promise((r) => setTimeout(r, 50));

    expect(handle.state.pendingRequestOrigins.has('req-orphan')).toBe(false);
  });
});
