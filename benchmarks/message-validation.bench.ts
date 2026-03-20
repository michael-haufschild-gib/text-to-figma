/**
 * WebSocket message validation and routing benchmarks.
 *
 * These measure the per-message overhead added by the bridge server.
 * In practice, Figma plugin execution dominates latency (100ms+),
 * so this overhead is negligible — but useful as a regression guard.
 */

import { bench, describe } from 'vitest';
import {
  validateMessage,
  routeMessage,
  routeRequest,
  routeResponse,
  createServerState,
  type ServerState
} from '../websocket-server/src/server.js';
import { WebSocket } from 'ws';
import { vi } from 'vitest';

// Pre-built message objects to avoid measuring object creation
const figmaHello = { type: 'figma_hello', source: 'figma-plugin' };
const request = {
  type: 'create_frame',
  payload: { x: 0, y: 0, width: 200, height: 100 },
  id: 'req-1'
};
const response = { id: 'req-1', success: true, nodeId: '1:2', data: { width: 200, height: 100 } };
const invalid = { foo: 'bar', baz: 42 };
const largeRequest = {
  type: 'create_design',
  payload: {
    spec: {
      type: 'frame',
      name: 'root',
      props: { width: 400, height: 600, layoutMode: 'VERTICAL', itemSpacing: 16, padding: 24 },
      children: Array.from({ length: 20 }, (_, i) => ({
        type: 'frame',
        name: `child-${i}`,
        props: { width: 380, height: 40, fillColor: '#FF5500' },
        children: [
          { type: 'text', name: `label-${i}`, props: { content: `Item ${i}`, fontSize: 16 } }
        ]
      }))
    }
  },
  id: 'req-large'
};

describe('validateMessage', () => {
  bench('FigmaHelloMessage', () => {
    validateMessage(figmaHello);
  });

  bench('RequestMessage', () => {
    validateMessage(request);
  });

  bench('ResponseMessage', () => {
    validateMessage(response);
  });

  bench('invalid message (null return)', () => {
    validateMessage(invalid);
  });

  bench('large nested request', () => {
    validateMessage(largeRequest);
  });
});

// Helper to build a state with mock clients for routing benchmarks
function setupRoutingState(): ServerState {
  const state = createServerState();

  const mockWs = {
    readyState: WebSocket.OPEN,
    send: vi.fn(),
    close: vi.fn(),
    ping: vi.fn(),
    terminate: vi.fn(),
    on: vi.fn(),
    emit: vi.fn()
  } as unknown as WebSocket;

  state.clients.set('figma-1', { ws: mockWs, isAlive: true, lastPong: Date.now(), isFigma: true });
  state.clients.set('mcp-1', { ws: mockWs, isAlive: true, lastPong: Date.now(), isMCP: true });
  state.figmaPluginClient = 'figma-1';
  state.pendingRequestOrigins.set('req-1', 'mcp-1');

  return state;
}

describe('routing', () => {
  const state = setupRoutingState();

  bench('routeRequest (MCP → Figma)', () => {
    routeRequest(state, request, 'mcp-1');
  });

  bench('routeResponse (Figma → MCP)', () => {
    // Re-add the pending origin since routeResponse deletes it
    state.pendingRequestOrigins.set('req-1', 'mcp-1');
    routeResponse(state, response, 'figma-1');
  });

  bench('routeMessage classification + dispatch', () => {
    routeMessage(state, request, 'mcp-1');
  });
});

describe('JSON parse + validate (realistic hot path)', () => {
  const requestJson = JSON.stringify(request);
  const responseJson = JSON.stringify(response);
  const largeJson = JSON.stringify(largeRequest);

  bench('parse + validate request', () => {
    validateMessage(JSON.parse(requestJson));
  });

  bench('parse + validate response', () => {
    validateMessage(JSON.parse(responseJson));
  });

  bench('parse + validate large nested request', () => {
    validateMessage(JSON.parse(largeJson));
  });
});
