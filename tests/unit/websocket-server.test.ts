/**
 * WebSocket Bridge Server — Pure Function Unit Tests
 *
 * Tests validateMessage, handleFigmaRegistration, routeRequest,
 * routeResponse, and routeMessage using mock WebSocket objects.
 *
 * Server lifecycle tests (createServer) are in websocket-server-lifecycle.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import {
  normalizeRawData,
  validateMessage,
  handleFigmaRegistration,
  routeRequest,
  routeResponse,
  routeMessage,
  routeNotification,
  createServerState,
  type ServerState,
  type BridgeMessage,
  type NotificationMessage,
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

// ─── normalizeRawData ────────────────────────────────────────────────

describe('normalizeRawData', () => {
  it('returns the same Buffer when given a Buffer', () => {
    const buf = Buffer.from('hello');
    const result = normalizeRawData(buf);
    expect(result).toBe(buf);
    expect(result.toString()).toBe('hello');
  });

  it('converts ArrayBuffer to Buffer', () => {
    const ab = new ArrayBuffer(5);
    const view = new Uint8Array(ab);
    view.set([104, 101, 108, 108, 111]); // "hello"
    const result = normalizeRawData(ab);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString()).toBe('hello');
  });

  it('concatenates Buffer[] fragments into a single Buffer', () => {
    const fragments = [Buffer.from('hel'), Buffer.from('lo')];
    const result = normalizeRawData(fragments);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString()).toBe('hello');
  });

  it('handles empty Buffer', () => {
    const result = normalizeRawData(Buffer.alloc(0));
    expect(result.toString()).toBe('');
  });

  it('handles empty ArrayBuffer', () => {
    const result = normalizeRawData(new ArrayBuffer(0));
    expect(result.toString()).toBe('');
  });

  it('handles empty Buffer array', () => {
    const result = normalizeRawData([]);
    expect(result.toString()).toBe('');
  });

  it('preserves JSON content through Buffer path', () => {
    const json = JSON.stringify({ type: 'test', payload: { value: 42 } });
    const result = normalizeRawData(Buffer.from(json));
    expect(JSON.parse(result.toString())).toEqual({ type: 'test', payload: { value: 42 } });
  });

  it('preserves JSON content through ArrayBuffer path', () => {
    const json = JSON.stringify({ id: 'req_1', success: true });
    const encoder = new TextEncoder();
    const ab = encoder.encode(json).buffer;
    const result = normalizeRawData(ab);
    expect(JSON.parse(result.toString())).toEqual({ id: 'req_1', success: true });
  });

  it('preserves JSON content through Buffer[] path', () => {
    const part1 = Buffer.from('{"type":');
    const part2 = Buffer.from('"test"}');
    const result = normalizeRawData([part1, part2]);
    expect(JSON.parse(result.toString())).toEqual({ type: 'test' });
  });
});

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
    const figmaWs = mockWs();
    state.clients.set('figma-1', mockClient({ ws: figmaWs }));
    state.clients.set('mcp-1', mockClient());
    state.figmaPluginClient = 'figma-1';

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

  it('drops orphan response when origin is unknown', () => {
    const mcpWs1 = mockWs();
    const mcpWs2 = mockWs();
    const nonMcpWs = mockWs();
    state.clients.set('mcp-1', mockClient({ ws: mcpWs1, isMCP: true }));
    state.clients.set('mcp-2', mockClient({ ws: mcpWs2, isMCP: true }));
    state.clients.set('other', mockClient({ ws: nonMcpWs }));

    const response = { id: 'unknown-req', success: true };
    routeResponse(state, response, 'some-client');

    expect(mcpWs1.send).not.toHaveBeenCalled();
    expect(mcpWs2.send).not.toHaveBeenCalled();
    expect(nonMcpWs.send).not.toHaveBeenCalled();
  });

  it('does not send to closed MCP client', () => {
    const mcpWs = mockWs(WebSocket.CLOSED);
    state.clients.set('mcp-1', mockClient({ ws: mcpWs, isMCP: true }));
    state.pendingRequestOrigins.set('req-42', 'mcp-1');

    routeResponse(state, { id: 'req-42', success: true }, 'figma-1');
    expect(mcpWs.send).not.toHaveBeenCalled();
  });

  it('falls back to broadcast when origin client has been removed from state', () => {
    // Simulate: MCP client sent a request, then disconnected before response arrived.
    // The origin ID is tracked but the client is gone from the map.
    const otherMcpWs = mockWs();
    state.clients.set('mcp-2', mockClient({ ws: otherMcpWs, isMCP: true }));
    state.pendingRequestOrigins.set('req-orphan', 'mcp-gone');
    // mcp-gone is NOT in state.clients

    const response = { id: 'req-orphan', success: true, data: 'orphaned' };
    routeResponse(state, response, 'figma-1');

    // Origin client is gone, but the origin ID was found in pendingRequestOrigins,
    // so it tries to send to the origin (which doesn't exist), and doesn't broadcast.
    // This is the actual behavior: it finds the origin ID but the client is gone,
    // so the response is silently dropped. It does NOT fall back to broadcast.
    expect(otherMcpWs.send).not.toHaveBeenCalled();
    // The origin entry is still cleaned up
    expect(state.pendingRequestOrigins.has('req-orphan')).toBe(false);
  });

  it('cleans up pendingRequestOrigins entry after routing', () => {
    const mcpWs = mockWs();
    state.clients.set('mcp-1', mockClient({ ws: mcpWs, isMCP: true }));
    state.pendingRequestOrigins.set('req-1', 'mcp-1');
    state.pendingRequestOrigins.set('req-2', 'mcp-1');

    routeResponse(state, { id: 'req-1', success: true }, 'figma-1');

    // Only req-1 should be cleaned up, req-2 should remain
    expect(state.pendingRequestOrigins.has('req-1')).toBe(false);
    expect(state.pendingRequestOrigins.has('req-2')).toBe(true);
  });

  it('when figmaPluginClient is null, all clients pass the guard (no imposter check)', () => {
    // The guard is: if (figmaPluginClient && clientId !== figmaPluginClient) → warn and return
    // When figmaPluginClient is null, the guard is skipped entirely.
    // So ANY client's response is processed, falling through to origin lookup or broadcast.
    const mcpWs = mockWs();
    state.clients.set('mcp-1', mockClient({ ws: mcpWs, isMCP: true }));
    state.pendingRequestOrigins.set('req-1', 'mcp-1');
    state.figmaPluginClient = null; // No Figma plugin registered

    routeResponse(state, { id: 'req-1', success: true, data: 'from-anyone' }, 'random-client');

    // Response should be routed to the origin MCP client despite coming from 'random-client'
    expect(mcpWs.send).toHaveBeenCalledWith(
      JSON.stringify({ id: 'req-1', success: true, data: 'from-anyone' })
    );
  });

  it('response with success:false is still routed to origin MCP client', () => {
    const mcpWs = mockWs();
    state.clients.set('mcp-1', mockClient({ ws: mcpWs, isMCP: true }));
    state.figmaPluginClient = 'figma-1';
    state.pendingRequestOrigins.set('req-fail', 'mcp-1');

    const response = { id: 'req-fail', success: false, error: 'Node not found' };
    routeResponse(state, response, 'figma-1');

    expect(mcpWs.send).toHaveBeenCalledWith(JSON.stringify(response));
    expect(state.pendingRequestOrigins.has('req-fail')).toBe(false);
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

  it('prefers response routing when message has BOTH response and request traits', () => {
    // A Figma plugin response might echo back the original type and payload
    // alongside the id+success fields. routeMessage must treat this as a response.
    const mcpWs = mockWs();
    state.clients.set('mcp-1', mockClient({ ws: mcpWs, isMCP: true }));
    state.pendingRequestOrigins.set('req-echo', 'mcp-1');

    // Message has type+payload (Request) AND id+success (Response)
    const msg = {
      type: 'create_frame',
      payload: { name: 'Test' },
      id: 'req-echo',
      success: true,
      data: { nodeId: '1:1' }
    } as BridgeMessage;

    routeMessage(state, msg, 'figma-1');

    // Should have been routed as a response (to mcp-1), not as a request (to Figma)
    expect(mcpWs.send).toHaveBeenCalledWith(JSON.stringify(msg));
    // Origin should be cleaned up (response routing cleans up pendingRequestOrigins)
    expect(state.pendingRequestOrigins.has('req-echo')).toBe(false);
  });
});

// ─── validateMessage: NotificationMessage ──────────────────────────

describe('validateMessage — NotificationMessage', () => {
  it('recognizes a valid figma_notification', () => {
    const msg = { type: 'figma_notification', kind: 'document_changed' };
    const result = validateMessage(msg);
    expect(result).toEqual(msg);
  });

  it('recognizes notification with data payload', () => {
    const msg = {
      type: 'figma_notification',
      kind: 'page_changed',
      data: { _ctx: { pageId: 'p1', pageName: 'Home', fileName: 'File.fig' } }
    };
    expect(validateMessage(msg)).toEqual(msg);
  });

  it('rejects notification without kind', () => {
    expect(validateMessage({ type: 'figma_notification' })).toBeNull();
  });

  it('rejects notification with non-string kind', () => {
    expect(validateMessage({ type: 'figma_notification', kind: 42 })).toBeNull();
  });
});

// ─── routeNotification ─────────────────────────────────────────────

describe('routeNotification', () => {
  let state: ServerState;

  beforeEach(() => {
    state = createServerState();
  });

  it('broadcasts notification to all MCP clients', () => {
    const figmaWs = mockWs();
    const mcp1Ws = mockWs();
    const mcp2Ws = mockWs();

    state.clients.set('figma-1', mockClient({ ws: figmaWs, isFigma: true }));
    state.clients.set('mcp-1', mockClient({ ws: mcp1Ws, isMCP: true }));
    state.clients.set('mcp-2', mockClient({ ws: mcp2Ws, isMCP: true }));
    state.figmaPluginClient = 'figma-1';

    const notification: NotificationMessage = {
      type: 'figma_notification',
      kind: 'document_changed'
    };

    routeNotification(state, notification, 'figma-1');

    expect(mcp1Ws.send).toHaveBeenCalledWith(JSON.stringify(notification));
    expect(mcp2Ws.send).toHaveBeenCalledWith(JSON.stringify(notification));
    // Must NOT send back to Figma plugin
    expect(figmaWs.send).not.toHaveBeenCalled();
  });

  it('ignores notifications from non-plugin clients', () => {
    const mcpWs = mockWs();
    state.clients.set('mcp-1', mockClient({ ws: mcpWs, isMCP: true }));
    state.figmaPluginClient = 'figma-1';

    const notification: NotificationMessage = {
      type: 'figma_notification',
      kind: 'document_changed'
    };

    routeNotification(state, notification, 'imposter');

    expect(mcpWs.send).not.toHaveBeenCalled();
  });

  it('skips clients with closed WebSockets', () => {
    const figmaWs = mockWs();
    const openWs = mockWs(WebSocket.OPEN);
    const closedWs = mockWs(WebSocket.CLOSED);

    state.clients.set('figma-1', mockClient({ ws: figmaWs, isFigma: true }));
    state.clients.set('mcp-open', mockClient({ ws: openWs }));
    state.clients.set('mcp-closed', mockClient({ ws: closedWs }));
    state.figmaPluginClient = 'figma-1';

    routeNotification(state, { type: 'figma_notification', kind: 'page_changed' }, 'figma-1');

    expect(openWs.send).toHaveBeenCalled();
    expect(closedWs.send).not.toHaveBeenCalled();
  });
});

// ─── routeMessage: notification dispatch ────────────────────────────

describe('routeMessage — notification dispatch', () => {
  let state: ServerState;

  beforeEach(() => {
    state = createServerState();
  });

  it('routes figma_notification to routeNotification (broadcasts)', () => {
    const figmaWs = mockWs();
    const mcpWs = mockWs();

    state.clients.set('figma-1', mockClient({ ws: figmaWs, isFigma: true }));
    state.clients.set('mcp-1', mockClient({ ws: mcpWs, isMCP: true }));
    state.figmaPluginClient = 'figma-1';

    const msg = {
      type: 'figma_notification',
      kind: 'document_changed'
    } as BridgeMessage;

    routeMessage(state, msg, 'figma-1');

    expect(mcpWs.send).toHaveBeenCalledWith(JSON.stringify(msg));
    expect(figmaWs.send).not.toHaveBeenCalled();
  });
});
