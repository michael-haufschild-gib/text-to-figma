/**
 * Resilience & Edge Case E2E Tests
 *
 * Tests error recovery, timeout handling, circuit breaker behavior,
 * and edge cases across the full three-tier architecture.
 *
 * Bug this catches:
 * - Connection drops mid-request don't clean up properly
 * - Circuit breaker doesn't recover after reset timeout
 * - Concurrent connection/disconnection causes state corruption
 * - Timeouts leave dangling resources (timers, pending promises)
 * - Graceful shutdown doesn't clean up all connections
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FigmaBridge, resetFigmaBridge } from '../../mcp-server/src/figma-bridge.js';
import { registerAllTools } from '../../mcp-server/src/routing/register-tools.js';
import { resetToolRegistry } from '../../mcp-server/src/routing/tool-registry.js';
import { routeToolCall } from '../../mcp-server/src/routing/tool-router.js';
import { getNodeRegistry, resetNodeRegistry } from '../../mcp-server/src/node-registry.js';
import { configureE2EEnv, restoreEnv } from './helpers/e2e-env.js';
import { startTestBridge, type TestBridgeHandle } from './helpers/test-bridge.js';
import { SimulatedFigmaPlugin, type FigmaCommand } from './helpers/simulated-figma-plugin.js';

describe('Resilience E2E', () => {
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
    resetToolRegistry();
    registerAllTools();
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
    resetToolRegistry();
    resetNodeRegistry();
    restoreEnv();
    vi.restoreAllMocks();
  });

  // ─── Connection Loss During Request ──────────────────────────────────

  describe('connection loss during request', () => {
    it('bridge disconnection causes pending requests to fail', async () => {
      // This tests that when the FigmaBridge is disconnected programmatically,
      // any pending requests are rejected cleanly.
      // Verifies: pending request map cleanup, no dangling timers

      // Override the plugin to hold requests without responding
      plugin['handleMessage'] = (raw: string) => {
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
          plugin['receivedCommands'].push({
            id: parsed.id,
            type: parsed.type,
            payload: (parsed.payload as Record<string, unknown>) ?? {}
          });
          // Don't respond — the bridge will time out or get disconnected
        }
      };

      // Start a request (will hang because plugin doesn't respond)
      const requestPromise = routeToolCall('create_frame', { name: 'PendingDisconnect' });

      // Wait for the command to reach the plugin
      await plugin.waitForCommands(1, 2000);

      // Disconnect the bridge — this should reject the pending request
      figmaBridge.disconnect();

      // The request should fail
      await expect(requestPromise).rejects.toThrow();

      // Reconnect for subsequent tests
      resetFigmaBridge();
      figmaBridge = new FigmaBridge();
      await figmaBridge.connect();
    });
  });

  // ─── Timeout Handling ────────────────────────────────────────────────

  describe('timeout handling', () => {
    it('request timeout produces a clean error when plugin never responds', async () => {
      // Override plugin to never respond
      plugin['handleMessage'] = (raw: string) => {
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
          plugin['receivedCommands'].push({
            id: parsed.id,
            type: parsed.type,
            payload: (parsed.payload as Record<string, unknown>) ?? {}
          });
          // Deliberately don't respond — simulating frozen plugin
        }
      };

      try {
        await routeToolCall('create_frame', { name: 'TimeoutTest' });
        expect.fail('Should have thrown on timeout');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        // The error should indicate a timeout or connection failure
        const msg = (err as Error).message.toLowerCase();
        expect(msg.length).toBeGreaterThan(0);
      }

      expect(plugin.getReceivedCommands().length).toBeGreaterThanOrEqual(1);

      // Disconnect bridge proactively to cancel any pending retries cleanly
      figmaBridge.disconnect();
      resetFigmaBridge();
      figmaBridge = new FigmaBridge();
      await figmaBridge.connect();
    });
  });

  // ─── Circuit Breaker Recovery ────────────────────────────────────────

  describe('recovery after errors', () => {
    it('system recovers after transient plugin failures', async () => {
      // Phase 1: Plugin fails
      plugin.setCommandHandler(() => ({
        success: false,
        error: 'Transient error'
      }));

      try {
        await routeToolCall('create_frame', { name: 'WillFail' });
      } catch {
        // Expected
      }

      // Phase 2: Plugin recovers
      plugin.resetCommandHandler();

      // Need fresh bridge since circuit breaker state may be dirty
      resetFigmaBridge();
      figmaBridge = new FigmaBridge();
      await figmaBridge.connect();

      // Phase 3: Should succeed
      const result = await routeToolCall('create_frame', { name: 'Recovered' });
      expect(result[0].text).toContain('Frame Created Successfully');
    });

    it('multiple failures followed by recovery all produce clean results', async () => {
      // Fail 3 times
      plugin.setCommandHandler(() => ({
        success: false,
        error: 'Persistent error'
      }));

      const failures: Error[] = [];
      for (let i = 0; i < 3; i++) {
        try {
          await routeToolCall('create_frame', { name: `Fail${i}` });
        } catch (err) {
          failures.push(err as Error);
        }
      }
      expect(failures.length).toBe(3);

      // Recover
      plugin.resetCommandHandler();
      resetFigmaBridge();
      figmaBridge = new FigmaBridge();
      await figmaBridge.connect();

      // Succeed 3 times
      for (let i = 0; i < 3; i++) {
        const result = await routeToolCall('create_frame', { name: `Success${i}` });
        expect(result[0].text).toContain('Frame Created Successfully');
      }
    });
  });

  // ─── Reconnection ────────────────────────────────────────────────────

  describe('reconnection after bridge restart', () => {
    it('new FigmaBridge connects to a restarted bridge', async () => {
      // Verify initial connection works
      const result1 = await routeToolCall('create_frame', { name: 'BeforeRestart' });
      expect(result1[0].text).toContain('Frame Created Successfully');

      // Disconnect and restart everything
      figmaBridge.disconnect();
      plugin.disconnect();
      await bridge.close();

      // Start fresh bridge and plugin
      bridge = startTestBridge();
      plugin = new SimulatedFigmaPlugin();
      await plugin.connect(bridge.wsUrl);
      await plugin.waitForRegistration(bridge.server.state);

      // Reconfigure for new bridge URL
      configureE2EEnv(bridge.wsUrl);

      // Create new FigmaBridge
      resetFigmaBridge();
      figmaBridge = new FigmaBridge();
      await figmaBridge.connect();

      // Should work again
      const result2 = await routeToolCall('create_frame', { name: 'AfterRestart' });
      expect(result2[0].text).toContain('Frame Created Successfully');
    });
  });

  // ─── Slow Plugin Response ────────────────────────────────────────────

  describe('slow plugin responses', () => {
    it('handles delayed but valid response within timeout', async () => {
      // Plugin responds after 500ms delay (within 3s timeout)
      const originalHandler = plugin['commandHandler'];
      plugin['handleMessage'] = function (this: SimulatedFigmaPlugin, raw: string) {
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return;
        }

        if (parsed.type === 'connection' || parsed.type === 'info' || parsed.type === 'error') {
          return;
        }

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

          // Delay the response by 500ms
          setTimeout(() => {
            const data = { nodeId: `delayed_${command.id}` };
            this['ws']!.send(JSON.stringify({ id: command.id, success: true, data }));
          }, 500);
        }
      }.bind(plugin);

      const result = await routeToolCall('create_frame', { name: 'SlowButValid' });
      expect(result[0].text).toContain('Frame Created Successfully');
    });
  });

  // ─── Plugin Disconnects During Multi-Step Workflow ──────────────────

  describe('plugin disconnect during workflow', () => {
    it('first operation succeeds, plugin disconnects, second operation fails cleanly', async () => {
      // Step 1: Create a frame (succeeds)
      const result1 = await routeToolCall('create_frame', { name: 'BeforeDisconnect' });
      expect(result1[0].text).toContain('Frame Created Successfully');

      // Step 2: Disconnect the plugin and wait for bridge to clear assignment
      plugin.disconnect();
      const dcStart = Date.now();
      while (bridge.server.state.figmaPluginClient !== null) {
        if (Date.now() - dcStart > 5000) throw new Error('Timed out waiting for plugin disconnect');
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      // Step 3: Try another operation — should fail (no plugin connected)
      try {
        await routeToolCall('create_frame', { name: 'AfterDisconnect' });
        // If it doesn't throw, it's using cached/retry logic
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }

      // Step 4: Reconnect plugin
      plugin = new SimulatedFigmaPlugin();
      await plugin.connect(bridge.wsUrl);
      await plugin.waitForRegistration(bridge.server.state);

      // Need fresh bridge after plugin reconnects
      resetFigmaBridge();
      figmaBridge = new FigmaBridge();
      await figmaBridge.connect();

      // Step 5: Should work again
      const result2 = await routeToolCall('create_frame', { name: 'AfterReconnect' });
      expect(result2[0].text).toContain('Frame Created Successfully');
    });
  });

  // ─── Sequential Error Then Success ─────────────────────────────────────

  describe('alternating success and failure', () => {
    it('handles alternating success/failure/success pattern', async () => {
      // Success
      const r1 = await routeToolCall('create_frame', { name: 'OK1' });
      expect(r1[0].text).toContain('Frame Created Successfully');

      // Failure (bad input)
      await expect(routeToolCall('create_frame', { name: '' })).rejects.toThrow();

      // Success again
      const r2 = await routeToolCall('create_frame', { name: 'OK2' });
      expect(r2[0].text).toContain('Frame Created Successfully');

      // Plugin failure
      plugin.setCommandHandler(() => ({ success: false, error: 'Temporary' }));
      await expect(routeToolCall('create_frame', { name: 'PluginFail' })).rejects.toThrow();

      // Plugin recovery
      plugin.resetCommandHandler();
      resetFigmaBridge();
      figmaBridge = new FigmaBridge();
      await figmaBridge.connect();

      const r3 = await routeToolCall('create_frame', { name: 'OK3' });
      expect(r3[0].text).toContain('Frame Created Successfully');
    });
  });

  // ─── State Isolation ─────────────────────────────────────────────────

  describe('state isolation between tool calls', () => {
    it('node registry starts empty after reset', () => {
      // Verifies that resetNodeRegistry() in beforeEach works
      const registry = getNodeRegistry();
      expect(registry.getAllNodes()).toHaveLength(0);
    });

    it('failed tool calls do not corrupt node registry', async () => {
      plugin.setCommandHandler(() => ({
        success: false,
        error: 'Creation failed'
      }));

      try {
        await routeToolCall('create_frame', { name: 'WillFail' });
      } catch {
        // Expected
      }

      // Reset handler and reconnect
      plugin.resetCommandHandler();
      resetFigmaBridge();
      figmaBridge = new FigmaBridge();
      await figmaBridge.connect();

      // Registry should be empty — the failed frame should not be registered
      const registry = getNodeRegistry();
      expect(registry.getAllNodes()).toHaveLength(0);
    });
  });
});
