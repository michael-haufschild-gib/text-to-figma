/**
 * FigmaBridge WebSocket Integration Tests
 *
 * Tests connection lifecycle, message routing, disconnect behavior,
 * and circuit breaker state transitions against a real WebSocket server.
 * No mocks — exercises the actual WebSocket code paths in FigmaBridge.
 */

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { WebSocketServer, WebSocket as WsClient } from 'ws';
import { loadConfig, resetConfig } from '../../mcp-server/src/config.js';
import { ErrorCode } from '../../mcp-server/src/errors/error-codes.js';
import { FigmaBridge, FigmaBridgeError } from '../../mcp-server/src/figma-bridge.js';

/** Start a WebSocket server on a random port, return it and the URL */
function createTestServer(): Promise<{ server: WebSocketServer; url: string; port: number }> {
  return new Promise((resolve) => {
    const server = new WebSocketServer({ port: 0 }, () => {
      const addr = server.address();
      const port = typeof addr === 'object' ? addr!.port : 0;
      resolve({ server, url: `ws://127.0.0.1:${port}`, port });
    });
  });
}

/** Configure FigmaBridge to point at a test server URL */
function configureForTest(wsUrl: string): void {
  resetConfig();
  process.env.FIGMA_WS_URL = wsUrl;
  process.env.FIGMA_REQUEST_TIMEOUT = '2000';
  process.env.FIGMA_MAX_RECONNECT_ATTEMPTS = '2';
  process.env.CIRCUIT_BREAKER_THRESHOLD = '3';
  process.env.CIRCUIT_BREAKER_RESET_TIMEOUT = '500';
  process.env.CIRCUIT_BREAKER_ENABLED = 'true';
  loadConfig();
}

/** Clean up env vars set by configureForTest */
function cleanupEnv(): void {
  delete process.env.FIGMA_WS_URL;
  delete process.env.FIGMA_REQUEST_TIMEOUT;
  delete process.env.FIGMA_MAX_RECONNECT_ATTEMPTS;
  delete process.env.CIRCUIT_BREAKER_THRESHOLD;
  delete process.env.CIRCUIT_BREAKER_RESET_TIMEOUT;
  delete process.env.CIRCUIT_BREAKER_ENABLED;
  resetConfig();
}

describe('FigmaBridge WebSocket integration', () => {
  let server: WebSocketServer;
  let wsUrl: string;
  let bridge: FigmaBridge;

  // Suppress FigmaBridge console.error logs in test output
  let errorSpy: MockInstance;

  beforeEach(async () => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const testServer = await createTestServer();
    server = testServer.server;
    wsUrl = testServer.url;
    configureForTest(wsUrl);
  });

  afterEach(async () => {
    bridge?.disconnect();
    errorSpy.mockRestore();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    cleanupEnv();
  });

  // ─── Connection lifecycle ──────────────────────────────────────────

  describe('connection', () => {
    it('connects to a real WebSocket server', async () => {
      bridge = new FigmaBridge();
      await bridge.connect();

      expect(bridge.isConnected()).toBe(true);
      const status = bridge.getConnectionStatus();
      expect(status.connected).toBe(true);
      expect(status.wsReadyState).toBe(WsClient.OPEN);
      expect(status.reconnectAttempts).toBe(0);
    });

    it('concurrent connect() calls return the same promise', async () => {
      bridge = new FigmaBridge();
      const [r1, r2] = await Promise.all([bridge.connect(), bridge.connect()]);
      expect(r1).toBe(r2); // both undefined — same resolved promise
      expect(bridge.isConnected()).toBe(true);
    });

    it('connect() is idempotent when already connected', async () => {
      bridge = new FigmaBridge();
      await bridge.connect();
      // Second call should return immediately
      await bridge.connect();
      expect(bridge.isConnected()).toBe(true);
    });

    it('rejects when server is not running', async () => {
      // Close the test server first
      await new Promise<void>((resolve) => server.close(() => resolve()));
      configureForTest('ws://127.0.0.1:19999'); // non-existent

      bridge = new FigmaBridge();
      await expect(bridge.connect()).rejects.toThrow(FigmaBridgeError);
    });
  });

  // ─── Message handling ──────────────────────────────────────────────

  describe('message handling', () => {
    it('sends request and receives response via WebSocket', async () => {
      // Server echoes back with success
      server.on('connection', (ws) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString()) as Record<string, unknown>;
          ws.send(
            JSON.stringify({
              id: msg.id,
              success: true,
              data: { created: true, nodeId: 'test-node-1' }
            })
          );
        });
      });

      bridge = new FigmaBridge();
      await bridge.connect();

      const result = await bridge.sendToFigma<{ created: boolean; nodeId: string }>(
        'create_frame',
        { name: 'Test Frame', width: 100, height: 100 }
      );

      expect(result.created).toBe(true);
      expect(result.nodeId).toBe('test-node-1');
    });

    it('rejects when server returns success=false', async () => {
      server.on('connection', (ws) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString()) as Record<string, unknown>;
          ws.send(
            JSON.stringify({
              id: msg.id,
              success: false,
              error: 'Node not found'
            })
          );
        });
      });

      bridge = new FigmaBridge();
      await bridge.connect();

      try {
        await bridge.sendToFigma('get_node', { nodeId: 'nonexistent' });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(FigmaBridgeError);
        expect((err as FigmaBridgeError).code).toBe(ErrorCode.OP_FAILED);
        expect((err as FigmaBridgeError).message).toBe('Node not found');
      }
    });

    it('times out when server does not respond', async () => {
      // Server accepts but never replies
      server.on('connection', () => {
        // intentionally silent
      });

      bridge = new FigmaBridge();
      await bridge.connect();

      try {
        await bridge.sendToFigma('slow_command', {});
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(FigmaBridgeError);
        expect((err as FigmaBridgeError).code).toBe(ErrorCode.OP_TIMEOUT);
      }
    });

    it('routes responses to correct pending request by ID', async () => {
      // Server delays first response so second arrives first
      server.on('connection', (ws) => {
        const queue: Array<{ id: string; payload: unknown }> = [];
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString()) as Record<string, unknown>;
          queue.push(msg);

          if (queue.length === 2) {
            // Respond to second request first
            ws.send(JSON.stringify({ id: queue[1].id, success: true, data: 'second' }));
            ws.send(JSON.stringify({ id: queue[0].id, success: true, data: 'first' }));
          }
        });
      });

      bridge = new FigmaBridge();
      await bridge.connect();

      const [r1, r2] = await Promise.all([
        bridge.sendToFigma('cmd1', {}),
        bridge.sendToFigma('cmd2', {})
      ]);

      expect(r1).toBe('first');
      expect(r2).toBe('second');
    });

    it('ignores non-response messages (type=connection, type=info)', async () => {
      server.on('connection', (ws) => {
        // Send info message first
        ws.send(JSON.stringify({ type: 'connection', message: 'Plugin connected' }));

        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString()) as Record<string, unknown>;
          ws.send(JSON.stringify({ id: msg.id, success: true, data: 'ok' }));
        });
      });

      bridge = new FigmaBridge();
      await bridge.connect();

      const result = await bridge.sendToFigma('test', {});
      expect(result).toBe('ok');
    });
  });

  // ─── Disconnect behavior ──────────────────────────────────────────

  describe('disconnect', () => {
    it('rejects pending requests on disconnect', async () => {
      // Server never responds
      server.on('connection', () => {});

      bridge = new FigmaBridge();
      await bridge.connect();

      const pending = bridge.sendToFigma('slow_command', {});

      // Disconnect while request is pending
      bridge.disconnect();

      try {
        await pending;
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(FigmaBridgeError);
        expect((err as FigmaBridgeError).code).toBe(ErrorCode.CONN_LOST);
      }
    });

    it('rejects pending requests when server closes connection', async () => {
      server.on('connection', (ws) => {
        ws.on('message', () => {
          // Close the connection instead of responding
          ws.close();
        });
      });

      bridge = new FigmaBridge();
      await bridge.connect();

      try {
        await bridge.sendToFigma('trigger_close', {});
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(FigmaBridgeError);
        expect((err as FigmaBridgeError).code).toBe(ErrorCode.CONN_LOST);
      }
    });

    it('reports disconnected state after server-side close', async () => {
      let serverWs: WsClient | null = null;
      server.on('connection', (ws) => {
        serverWs = ws;
      });

      bridge = new FigmaBridge();
      await bridge.connect();
      expect(bridge.isConnected()).toBe(true);

      // Close from server side
      serverWs!.close();

      // Wait for close event to propagate
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(bridge.isConnected()).toBe(false);
    });
  });

  // ─── Abort controller ─────────────────────────────────────────────

  describe('sendToFigmaWithAbort', () => {
    it('abort cancels pending request', async () => {
      // Server never responds
      server.on('connection', () => {});

      bridge = new FigmaBridge();
      await bridge.connect();

      const { promise, abort } = bridge.sendToFigmaWithAbort('slow_command', {});

      abort.abort();

      // The promise should never resolve or reject (request was removed)
      // Verify by racing with a short timeout
      const result = await Promise.race([
        promise.then(() => 'resolved').catch(() => 'rejected'),
        new Promise<string>((resolve) => setTimeout(() => resolve('timeout'), 200))
      ]);

      expect(result).toBe('timeout');
    });
  });

  // ─── Circuit breaker ──────────────────────────────────────────────

  describe('circuit breaker', () => {
    it('opens after threshold failures and rejects immediately', async () => {
      // Server returns errors
      server.on('connection', (ws) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString()) as Record<string, unknown>;
          ws.send(JSON.stringify({ id: msg.id, success: false, error: 'Figma API error' }));
        });
      });

      bridge = new FigmaBridge();
      await bridge.connect();

      // Trigger 3 failures (CIRCUIT_BREAKER_THRESHOLD=3)
      for (let i = 0; i < 3; i++) {
        try {
          await bridge.sendToFigmaWithRetry(
            'fail_cmd',
            {},
            {
              maxRetries: 1,
              baseDelay: 10,
              maxDelay: 10
            }
          );
        } catch {
          // expected
        }
      }

      // Circuit should now be OPEN
      const status = bridge.getConnectionStatus();
      expect(status.circuitBreakerState).toBe('OPEN');

      // Next request through circuit breaker should fail immediately with SYS_CIRCUIT_OPEN
      try {
        await bridge.sendToFigmaWithRetry(
          'blocked_cmd',
          {},
          {
            maxRetries: 1,
            baseDelay: 10,
            maxDelay: 10
          }
        );
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(FigmaBridgeError);
        expect((err as FigmaBridgeError).code).toBe(ErrorCode.SYS_CIRCUIT_OPEN);
      }
    });

    it('transitions from OPEN to HALF_OPEN after reset timeout', async () => {
      let shouldSucceed = false;

      server.on('connection', (ws) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString()) as Record<string, unknown>;
          if (shouldSucceed) {
            ws.send(JSON.stringify({ id: msg.id, success: true, data: 'recovered' }));
          } else {
            ws.send(JSON.stringify({ id: msg.id, success: false, error: 'error' }));
          }
        });
      });

      bridge = new FigmaBridge();
      await bridge.connect();

      // Trip the circuit breaker (threshold=3)
      for (let i = 0; i < 3; i++) {
        try {
          await bridge.sendToFigmaWithRetry(
            'fail',
            {},
            {
              maxRetries: 1,
              baseDelay: 10,
              maxDelay: 10
            }
          );
        } catch {
          // expected
        }
      }

      expect(bridge.getConnectionStatus().circuitBreakerState).toBe('OPEN');

      // Wait for reset timeout (500ms) to allow HALF_OPEN transition
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Now switch server to succeed
      shouldSucceed = true;

      // This call should go through in HALF_OPEN state
      const result = await bridge.sendToFigmaWithRetry(
        'recover',
        {},
        {
          maxRetries: 1,
          baseDelay: 10,
          maxDelay: 10
        }
      );

      expect(result).toBe('recovered');
    });
  });
});
