/**
 * Test Bridge
 *
 * Starts a real WebSocket bridge server on a random port for e2e testing.
 * Provides cleanup and port discovery for test setup/teardown.
 */

import { createServer, type ServerHandle } from '../../../websocket-server/src/server.js';

export interface TestBridgeHandle {
  /** The WebSocket URL clients should connect to */
  wsUrl: string;
  /** The port the bridge is listening on */
  port: number;
  /** The underlying server handle */
  server: ServerHandle;
  /** Shut down the bridge and clean up */
  close: () => Promise<void>;
}

/**
 * Start a WebSocket bridge server on a random available port.
 * Returns a handle for connecting clients and cleaning up.
 */
export function startTestBridge(): TestBridgeHandle {
  // Port 0 = OS assigns a random available port
  const handle = createServer(0);

  // Extract the actual assigned port
  const addr = handle.wss.address();
  const port = typeof addr === 'object' && addr !== null ? addr.port : 0;

  if (port === 0) {
    throw new Error('Failed to get assigned port from WebSocket server');
  }

  const wsUrl = `ws://127.0.0.1:${port}`;

  return {
    wsUrl,
    port,
    server: handle,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(handle.heartbeatInterval);

        // Close all client connections
        for (const [, client] of handle.state.clients.entries()) {
          client.ws.close();
        }

        handle.wss.close(() => resolve());
      })
  };
}
