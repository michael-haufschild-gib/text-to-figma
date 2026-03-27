/**
 * WebSocket Bridge — Peer Operation Broadcasting Unit Tests
 *
 * Tests routeResponse's peer_operation notification broadcasting:
 * when the bridge routes a successful response to the originator,
 * it also sends a lightweight notification to all other MCP clients.
 *
 * Bug this catches:
 * - Peer agents not learning about canvas mutations made by other agents
 * - peer_operation notification sent to originator (causing false staleness)
 * - peer_operation notification sent to Figma plugin (wastes bandwidth)
 * - Failed responses triggering spurious peer notifications
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import {
  routeResponse,
  createServerState,
  type ServerState,
  type ClientRecord
} from '../../websocket-server/src/server.js';

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

function mockClient(overrides: Partial<ClientRecord> = {}): ClientRecord {
  return {
    ws: mockWs(),
    isAlive: true,
    lastPong: Date.now(),
    ...overrides
  };
}

function parseSendCall(ws: WebSocket, callIndex = 0): Record<string, unknown> {
  const sendSpy = vi.mocked(ws.send);
  return JSON.parse(sendSpy.mock.calls[callIndex][0] as string) as Record<string, unknown>;
}

describe('routeResponse peer_operation broadcasting', () => {
  let state: ServerState;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    state = createServerState();
    state.figmaPluginClient = 'figma-1';
    state.clients.set('figma-1', mockClient({ isFigma: true }));
  });

  it('broadcasts peer_operation to other MCP clients on successful response', () => {
    const originWs = mockWs();
    const peerWs = mockWs();
    state.clients.set('mcp-origin', mockClient({ ws: originWs, isMCP: true }));
    state.clients.set('mcp-peer', mockClient({ ws: peerWs, isMCP: true }));
    state.pendingRequestOrigins.set('req-1', { clientId: 'mcp-origin', createdAt: Date.now() });

    routeResponse(state, { id: 'req-1', success: true, data: 'result' }, 'figma-1');

    // Origin gets the actual response
    expect(originWs.send).toHaveBeenCalledWith(
      JSON.stringify({ id: 'req-1', success: true, data: 'result' })
    );

    // Peer gets a peer_operation notification
    expect(peerWs.send).toHaveBeenCalledOnce();
    const notification = parseSendCall(peerWs);
    expect(notification).toMatchObject({
      type: 'figma_notification',
      kind: 'peer_operation',
      data: { requestId: 'req-1' }
    });
  });

  it('does not broadcast peer_operation on failed responses', () => {
    const originWs = mockWs();
    const peerWs = mockWs();
    state.clients.set('mcp-origin', mockClient({ ws: originWs, isMCP: true }));
    state.clients.set('mcp-peer', mockClient({ ws: peerWs, isMCP: true }));
    state.pendingRequestOrigins.set('req-fail', { clientId: 'mcp-origin', createdAt: Date.now() });

    routeResponse(state, { id: 'req-fail', success: false, error: 'err' }, 'figma-1');

    expect(originWs.send).toHaveBeenCalledOnce();
    expect(peerWs.send).not.toHaveBeenCalled();
  });

  it('does not send peer_operation to the Figma plugin client', () => {
    const originWs = mockWs();
    const figmaWs = mockWs();
    const peerWs = mockWs();
    state.clients.set('mcp-origin', mockClient({ ws: originWs, isMCP: true }));
    state.clients.set('figma-1', mockClient({ ws: figmaWs, isFigma: true }));
    state.clients.set('mcp-peer', mockClient({ ws: peerWs, isMCP: true }));
    state.pendingRequestOrigins.set('req-1', { clientId: 'mcp-origin', createdAt: Date.now() });

    routeResponse(state, { id: 'req-1', success: true, data: 'ok' }, 'figma-1');

    expect(figmaWs.send).not.toHaveBeenCalled();
    expect(peerWs.send).toHaveBeenCalledOnce();
  });

  it('peer_operation is sent to multiple peers', () => {
    const originWs = mockWs();
    const peer1Ws = mockWs();
    const peer2Ws = mockWs();
    state.clients.set('mcp-origin', mockClient({ ws: originWs, isMCP: true }));
    state.clients.set('mcp-peer-1', mockClient({ ws: peer1Ws, isMCP: true }));
    state.clients.set('mcp-peer-2', mockClient({ ws: peer2Ws, isMCP: true }));
    state.pendingRequestOrigins.set('req-1', { clientId: 'mcp-origin', createdAt: Date.now() });

    routeResponse(state, { id: 'req-1', success: true }, 'figma-1');

    expect(peer1Ws.send).toHaveBeenCalledOnce();
    expect(peer2Ws.send).toHaveBeenCalledOnce();

    // Origin only gets the response, not a notification
    expect(originWs.send).toHaveBeenCalledOnce();
    const originMsg = parseSendCall(originWs);
    expect(originMsg.kind).toBeUndefined();
  });

  it('notifies peers even when origin client has disconnected', () => {
    const peerWs = mockWs();
    state.clients.set('mcp-peer', mockClient({ ws: peerWs, isMCP: true }));
    // mcp-gone is NOT in state.clients
    state.pendingRequestOrigins.set('req-orphan', { clientId: 'mcp-gone', createdAt: Date.now() });

    routeResponse(state, { id: 'req-orphan', success: true, data: 'orphaned' }, 'figma-1');

    expect(peerWs.send).toHaveBeenCalledOnce();
    const notification = parseSendCall(peerWs);
    expect(notification).toMatchObject({
      type: 'figma_notification',
      kind: 'peer_operation'
    });
    expect(state.pendingRequestOrigins.has('req-orphan')).toBe(false);
  });

  it('does not send peer_operation when only one MCP client exists', () => {
    const originWs = mockWs();
    state.clients.set('mcp-origin', mockClient({ ws: originWs, isMCP: true }));
    state.pendingRequestOrigins.set('req-1', { clientId: 'mcp-origin', createdAt: Date.now() });

    routeResponse(state, { id: 'req-1', success: true, data: 'solo' }, 'figma-1');

    // Origin gets the response
    expect(originWs.send).toHaveBeenCalledOnce();
    const msg = parseSendCall(originWs);
    // It's the response, not a notification
    expect(msg.id).toBe('req-1');
    expect(msg.kind).toBeUndefined();
  });
});
