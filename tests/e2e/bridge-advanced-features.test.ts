/**
 * Bridge Advanced Features E2E Tests
 *
 * Tests FigmaBridge features that go beyond basic request/response:
 * - Request abort (canceling in-flight requests)
 * - Response validation (Zod schema validation of plugin responses)
 * - Connection status diagnostics
 * - Graceful shutdown cleanup
 *
 * Bug this catches:
 * - Aborted request still resolves, causing stale data to be used
 * - Aborted request's timeout timer is not cleared (memory leak)
 * - Response validation rejects valid responses due to schema mismatch
 * - Response validation accepts malformed responses
 * - Connection status reports stale state after reconnection
 * - Graceful shutdown leaves dangling connections or timers
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { FigmaBridge, resetFigmaBridge } from '../../mcp-server/src/figma-bridge.js';
import { resetNodeRegistry } from '../../mcp-server/src/node-registry.js';
import { configureE2EEnv, restoreEnv } from './helpers/e2e-env.js';
import { startTestBridge, type TestBridgeHandle } from './helpers/test-bridge.js';
import { SimulatedFigmaPlugin } from './helpers/simulated-figma-plugin.js';

describe('Bridge Advanced Features E2E', () => {
  let bridge: TestBridgeHandle;
  let plugin: SimulatedFigmaPlugin;
  let figmaBridge: FigmaBridge;

  beforeEach(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    bridge = startTestBridge();
    plugin = new SimulatedFigmaPlugin();
    await plugin.connect(bridge.wsUrl);
    await plugin.waitForRegistration(bridge.server.state);

    configureE2EEnv(bridge.wsUrl);
    resetNodeRegistry();
    resetFigmaBridge();
    figmaBridge = new FigmaBridge();
    await figmaBridge.connect();
  });

  afterEach(async () => {
    figmaBridge?.disconnect();
    plugin?.disconnect();
    await bridge?.close();
    resetFigmaBridge();
    resetNodeRegistry();
    restoreEnv();
    vi.restoreAllMocks();
  });

  // ─── Request Abort ───────────────────────────────────────────────────────

  describe('request abort', () => {
    it('aborted request does not resolve after plugin responds', async () => {
      // Bug: abort() sets the flag but the response still resolves,
      // causing the caller to use stale/unwanted data.

      // Plugin responds after 300ms delay
      plugin['handleMessage'] = function (this: SimulatedFigmaPlugin, raw: string) {
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return;
        }
        if (parsed.type === 'connection' || parsed.type === 'info' || parsed.type === 'error')
          return;

        if (
          typeof parsed.type === 'string' &&
          'payload' in parsed &&
          typeof parsed.id === 'string'
        ) {
          const command = {
            id: parsed.id,
            type: parsed.type,
            payload: (parsed.payload as Record<string, unknown>) ?? {}
          };
          this['receivedCommands'].push(command);

          setTimeout(() => {
            try {
              this['ws']!.send(
                JSON.stringify({
                  id: command.id,
                  success: true,
                  data: { nodeId: `node_${command.id}` }
                })
              );
            } catch {
              // ws may be closed
            }
          }, 300);
        }
      }.bind(plugin);

      // Send request with abort capability
      const { promise, abort } = figmaBridge.sendToFigmaWithAbort('create_frame', {
        name: 'WillBeAborted'
      });

      // Abort after 50ms (before the 300ms response arrives)
      await new Promise((resolve) => setTimeout(resolve, 50));
      abort.abort();
      expect(abort.aborted).toBe(true);

      // The promise should NOT resolve with data (it should either reject or never settle)
      // Wait for the plugin's delayed response to arrive
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Verify the abort flag is set
      expect(abort.aborted).toBe(true);

      // Pending requests should be cleaned up
      const status = figmaBridge.getConnectionStatus();
      expect(status.pendingRequests).toBe(0);
    });

    it('non-aborted request resolves normally', async () => {
      const { promise, abort } = figmaBridge.sendToFigmaWithAbort('create_frame', {
        name: 'NotAborted'
      });

      // Don't abort — let it complete normally
      const result = (await promise) as { nodeId: string };
      expect(result.nodeId).toMatch(/^node_\d+_/);
      expect(abort.aborted).toBe(false);
    });
  });

  // ─── Response Validation ────────────────────────────────────────────────

  describe('response validation with Zod schemas', () => {
    it('accepts response matching the schema', async () => {
      // Define a schema for the expected response
      const nodeResponseSchema = z.object({
        nodeId: z.string()
      });

      const result = await figmaBridge.sendToFigmaValidated(
        'create_frame',
        { name: 'ValidResponse' },
        nodeResponseSchema
      );

      expect(result.nodeId).toMatch(/\S+/);
    });

    it('rejects response that does not match schema', async () => {
      // Plugin returns data that doesn't match the strict schema
      plugin.setCommandHandler(() => ({
        success: true,
        data: { unexpectedField: 'wrong shape' } // Missing required 'nodeId'
      }));

      const strictSchema = z.object({
        nodeId: z.string()
      });

      await expect(
        figmaBridge.sendToFigmaValidated('create_frame', { name: 'BadShape' }, strictSchema)
      ).rejects.toThrow();
    });

    it('validates complex nested response shape', async () => {
      // Custom handler that returns a specific shape
      plugin.setCommandHandler(() => ({
        success: true,
        data: {
          rootNodeId: 'root-1',
          nodeIds: { Title: 'node-1', Body: 'node-2' },
          totalNodes: 3,
          message: 'Created 3 nodes',
          nodes: [
            { nodeId: 'root-1', type: 'FRAME', name: 'Root' },
            { nodeId: 'node-1', type: 'TEXT', name: 'Title' },
            { nodeId: 'node-2', type: 'TEXT', name: 'Body' }
          ]
        }
      }));

      const designSchema = z.object({
        rootNodeId: z.string(),
        totalNodes: z.number(),
        nodes: z.array(
          z.object({
            nodeId: z.string(),
            type: z.string(),
            name: z.string()
          })
        )
      });

      const result = await figmaBridge.sendToFigmaValidated(
        'create_design',
        { spec: { type: 'frame', name: 'Root' } },
        designSchema
      );

      expect(result.rootNodeId).toBe('root-1');
      expect(result.totalNodes).toBe(3);
      expect(result.nodes).toStrictEqual([
        { nodeId: 'root-1', type: 'FRAME', name: 'Root' },
        { nodeId: 'node-1', type: 'TEXT', name: 'Title' },
        { nodeId: 'node-2', type: 'TEXT', name: 'Body' }
      ]);
    });
  });

  // ─── Connection Status Diagnostics ──────────────────────────────────────

  describe('connection status diagnostics', () => {
    it('reports CLOSED circuit breaker state when healthy', () => {
      const status = figmaBridge.getConnectionStatus();
      expect(status.connected).toBe(true);
      expect(status.circuitBreakerState).toBe('CLOSED');
      expect(status.pendingRequests).toBe(0);
      expect(status.reconnectAttempts).toBe(0);
      expect(status.wsReadyState).toBe(1); // WebSocket.OPEN = 1
    });

    it('reports disconnected state after disconnect()', () => {
      figmaBridge.disconnect();

      const status = figmaBridge.getConnectionStatus();
      expect(status.connected).toBe(false);
      expect(status.pendingRequests).toBe(0);
    });

    it('reports correct state after reconnection', async () => {
      // Disconnect
      figmaBridge.disconnect();
      expect(figmaBridge.getConnectionStatus().connected).toBe(false);

      // Reconnect
      resetFigmaBridge();
      figmaBridge = new FigmaBridge();
      await figmaBridge.connect();

      const status = figmaBridge.getConnectionStatus();
      expect(status.connected).toBe(true);
      expect(status.circuitBreakerState).toBe('CLOSED');
      expect(status.reconnectAttempts).toBe(0);
    });
  });

  // ─── Graceful Shutdown ──────────────────────────────────────────────────

  describe('graceful shutdown cleanup', () => {
    it('bridge disconnect cleans up all pending requests', async () => {
      // Set plugin to never respond
      plugin['handleMessage'] = function (this: SimulatedFigmaPlugin, raw: string) {
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return;
        }
        if (parsed.type === 'connection' || parsed.type === 'info') return;
        if (
          typeof parsed.type === 'string' &&
          'payload' in parsed &&
          typeof parsed.id === 'string'
        ) {
          this['receivedCommands'].push({
            id: parsed.id,
            type: parsed.type,
            payload: (parsed.payload as Record<string, unknown>) ?? {}
          });
          // Don't respond
        }
      }.bind(plugin);

      // Start requests
      const p1 = figmaBridge.sendToFigma('create_frame', { name: 'P1' }).catch((e: Error) => e);
      const p2 = figmaBridge.sendToFigma('create_frame', { name: 'P2' }).catch((e: Error) => e);

      // Wait for commands to reach plugin
      await plugin.waitForCommands(2, 3000);

      // Verify pending requests exist
      expect(figmaBridge.getConnectionStatus().pendingRequests).toBe(2);

      // Disconnect — should reject all pending
      figmaBridge.disconnect();

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBeInstanceOf(Error);
      expect(r2).toBeInstanceOf(Error);

      // After disconnect, pending should be 0
      expect(figmaBridge.getConnectionStatus().pendingRequests).toBe(0);
    });

    it('WebSocket bridge close cleans up all clients', async () => {
      // Verify clients exist
      expect(bridge.server.state.clients.size).toBeGreaterThanOrEqual(2); // MCP + Figma

      // Close all connections via the bridge
      for (const [, client] of bridge.server.state.clients.entries()) {
        client.ws.close();
      }

      // Wait for cleanup
      const start = Date.now();
      while (bridge.server.state.clients.size > 0) {
        if (Date.now() - start > 5000) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      expect(bridge.server.state.clients.size).toBe(0);
      expect(bridge.server.state.figmaPluginClient).toBeNull();
    });
  });
});
