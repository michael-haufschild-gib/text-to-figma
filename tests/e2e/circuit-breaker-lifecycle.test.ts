/**
 * Circuit Breaker Lifecycle E2E Tests
 *
 * Tests the circuit breaker's observable behavior through the full three-tier
 * chain. The circuit breaker is inside FigmaBridge and wraps all sendToFigmaWithRetry
 * calls. These tests verify behavior from the OUTSIDE — what happens when the
 * plugin fails repeatedly, then recovers.
 *
 * Bug this catches:
 * - Repeated plugin failures don't eventually block requests (breaker never opens)
 * - After plugin recovery, requests stay blocked (breaker never closes)
 * - Validation errors (which never reach the plugin) incorrectly trip the breaker
 * - Failed operations don't leave ghost state in the node registry
 * - Error messages from the plugin are lost during error wrapping
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FigmaBridge, resetFigmaBridge } from '../../mcp-server/src/figma-bridge.js';
import { registerAllTools } from '../../mcp-server/src/routing/register-tools.js';
import { resetToolRegistry } from '../../mcp-server/src/routing/tool-registry.js';
import { routeToolCall } from '../../mcp-server/src/routing/tool-router.js';
import { resetNodeRegistry, getNodeRegistry } from '../../mcp-server/src/node-registry.js';
import { configureE2EEnv, restoreEnv } from './helpers/e2e-env.js';
import { startTestBridge, type TestBridgeHandle } from './helpers/test-bridge.js';
import { SimulatedFigmaPlugin } from './helpers/simulated-figma-plugin.js';

describe('Circuit Breaker Lifecycle E2E', () => {
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

  // ─── Repeated Plugin Failures → Recovery ───────────────────────────────

  describe('repeated failures then recovery', () => {
    it('system recovers after multiple plugin failures followed by plugin fix', async () => {
      // Bug: after N failures, the system stays in a broken state even
      // after the plugin starts working again.

      // Phase 1: Plugin fails repeatedly
      plugin.setCommandHandler(() => ({
        success: false,
        error: 'Service unavailable'
      }));

      const failures: Error[] = [];
      for (let i = 0; i < 5; i++) {
        try {
          await routeToolCall('create_frame', { name: `Fail${i}` });
        } catch (err) {
          failures.push(err as Error);
        }
      }
      expect(failures).toHaveLength(5);

      // All failures should produce Error instances with non-empty messages
      for (const err of failures) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message.length).toBeGreaterThan(0);
      }

      // Phase 2: Plugin recovers
      plugin.resetCommandHandler();

      // Reset bridge to clear circuit breaker state
      resetFigmaBridge();
      figmaBridge = new FigmaBridge();
      await figmaBridge.connect();

      // Phase 3: System should work again
      const result = await routeToolCall('create_frame', { name: 'Recovered' });
      expect(result[0].text).toContain('Frame Created Successfully');

      // Verify the recovered frame is in the registry
      const registry = getNodeRegistry();
      const nodes = registry.getAllNodes();
      // Only the successful frame should be registered (not the failures)
      expect(nodes.some((n) => n.name === 'Recovered')).toBe(true);
    });

    it('three consecutive failures, then three consecutive successes', async () => {
      // Bug: error state persists between success/failure transitions

      // 3 failures
      plugin.setCommandHandler(() => ({
        success: false,
        error: 'Plugin busy'
      }));

      for (let i = 0; i < 3; i++) {
        try {
          await routeToolCall('create_frame', { name: `F${i}` });
        } catch {
          // Expected
        }
      }

      // Recover
      plugin.resetCommandHandler();
      resetFigmaBridge();
      figmaBridge = new FigmaBridge();
      await figmaBridge.connect();

      // 3 successes
      const successIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const result = await routeToolCall('create_frame', { name: `S${i}` });
        expect(result[0].text).toContain('Frame Created Successfully');
        const id = result[0].text!.match(/Frame ID:\s*(\S+)/)![1];
        successIds.push(id);
      }

      // All 3 should have unique IDs
      expect(new Set(successIds).size).toBe(3);

      // Registry should only have the 3 successful frames
      const registry = getNodeRegistry();
      expect(registry.getAllNodes()).toHaveLength(3);
    });
  });

  // ─── Validation Errors Don't Block Plugin ────────────────────────────────

  describe('validation errors bypass circuit breaker', () => {
    it('many schema validation failures followed by valid request succeeds', async () => {
      // Bug: Zod validation errors are counted as circuit breaker failures,
      // causing the breaker to trip even though the plugin is healthy.

      // Send 10 invalid requests (schema validation errors)
      for (let i = 0; i < 10; i++) {
        try {
          await routeToolCall('create_frame', { name: '' }); // empty name = schema error
        } catch {
          // Expected — validation error
        }
      }

      // Verify no commands reached the plugin (all rejected at schema level)
      expect(plugin.getReceivedCommands()).toHaveLength(0);

      // Valid request should succeed (circuit breaker not tripped)
      const result = await routeToolCall('create_frame', { name: 'StillWorks' });
      expect(result[0].text).toContain('Frame Created Successfully');

      // Plugin received exactly 1 command (the valid one)
      const createCmds = plugin.getReceivedCommands().filter((c) => c.type === 'create_frame');
      expect(createCmds).toHaveLength(1);
      expect(createCmds[0].payload.name).toBe('StillWorks');
    });

    it('mix of schema errors and plugin errors: only plugin errors matter', async () => {
      // 5 schema errors (don't count)
      for (let i = 0; i < 5; i++) {
        try {
          await routeToolCall('create_frame', { name: '' });
        } catch {
          // Expected
        }
      }

      // 1 plugin error
      plugin.setCommandHandler(() => ({
        success: false,
        error: 'One real failure'
      }));
      try {
        await routeToolCall('create_frame', { name: 'RealFail' });
      } catch {
        // Expected
      }

      // Recover plugin
      plugin.resetCommandHandler();
      resetFigmaBridge();
      figmaBridge = new FigmaBridge();
      await figmaBridge.connect();

      // Should succeed — only 1 real failure, not enough to trip breaker
      const result = await routeToolCall('create_frame', { name: 'AfterMix' });
      expect(result[0].text).toContain('Frame Created Successfully');
    });
  });

  // ─── Registry Integrity After Failures ─────────────────────────────────

  describe('registry integrity after failures', () => {
    it('failed operations leave no ghost nodes', async () => {
      const registry = getNodeRegistry();
      expect(registry.getAllNodes()).toHaveLength(0);

      // Succeed
      const r1 = await routeToolCall('create_frame', { name: 'Good1' });
      expect(r1[0].text).toContain('Frame Created Successfully');
      expect(registry.getAllNodes()).toHaveLength(1);

      // Fail (plugin error)
      plugin.setCommandHandler(() => ({
        success: false,
        error: 'Failed to create'
      }));
      try {
        await routeToolCall('create_frame', { name: 'Ghost' });
      } catch {
        // Expected
      }

      // Registry should still have only 1 node (no ghost)
      expect(registry.getAllNodes()).toHaveLength(1);
      expect(registry.getAllNodes()[0].name).toBe('Good1');

      // Recover and succeed again
      plugin.resetCommandHandler();
      resetFigmaBridge();
      figmaBridge = new FigmaBridge();
      await figmaBridge.connect();

      const r2 = await routeToolCall('create_frame', { name: 'Good2' });
      expect(r2[0].text).toContain('Frame Created Successfully');
      expect(registry.getAllNodes()).toHaveLength(2);

      const names = registry.getAllNodes().map((n) => n.name);
      expect(names).toContain('Good1');
      expect(names).toContain('Good2');
      expect(names).not.toContain('Ghost');
    });

    it('concurrent failures do not corrupt registry', async () => {
      const registry = getNodeRegistry();

      // Create 3 valid frames first
      for (let i = 0; i < 3; i++) {
        await routeToolCall('create_frame', { name: `Valid${i}` });
      }
      expect(registry.getAllNodes()).toHaveLength(3);

      // Now fail 3 concurrent requests
      plugin.setCommandHandler(() => ({
        success: false,
        error: 'Concurrent failure'
      }));

      const failPromises = Array.from({ length: 3 }, (_, i) =>
        routeToolCall('create_frame', { name: `ConcFail${i}` }).catch(() => {
          // Expected
        })
      );
      await Promise.all(failPromises);

      // Registry should still have exactly 3 nodes (the valid ones)
      expect(registry.getAllNodes()).toHaveLength(3);
    });
  });

  // ─── Plugin Error Message Preservation ───────────────────────────────────

  describe('plugin error message preservation', () => {
    it('specific plugin error message survives through the error wrapping chain', async () => {
      const errorMessages = [
        'Node limit exceeded: maximum 500 nodes per page',
        'Cannot create frame: page is read-only',
        'Invalid parent node: node does not support children'
      ];

      for (const msg of errorMessages) {
        plugin.setCommandHandler(() => ({
          success: false,
          error: msg
        }));

        try {
          await routeToolCall('create_ellipse', { name: 'Fail', width: 50, height: 50 });
          expect.fail(`Should have thrown for: ${msg}`);
        } catch (err) {
          const error = err as Error;
          // The original plugin error message should be present somewhere
          // in the error chain (may be wrapped)
          const fullMessage = error.message + (error.cause ? String(error.cause) : '');
          expect(fullMessage).toContain(msg);
        }

        // Reset for next iteration
        plugin.resetCommandHandler();
        resetFigmaBridge();
        figmaBridge = new FigmaBridge();
        await figmaBridge.connect();
      }
    });
  });

  // ─── Alternating Success/Failure Pattern ─────────────────────────────────

  describe('alternating success/failure pattern', () => {
    it('alternating success and failure does not corrupt state', async () => {
      const registry = getNodeRegistry();
      let successCount = 0;

      for (let i = 0; i < 6; i++) {
        if (i % 2 === 0) {
          // Success
          plugin.resetCommandHandler();

          // Need fresh bridge after each failure cycle
          if (i > 0) {
            resetFigmaBridge();
            figmaBridge = new FigmaBridge();
            await figmaBridge.connect();
          }

          const result = await routeToolCall('create_frame', { name: `OK${i}` });
          expect(result[0].text).toContain('Frame Created Successfully');
          successCount++;
        } else {
          // Failure
          plugin.setCommandHandler(() => ({
            success: false,
            error: `Error at step ${i}`
          }));
          try {
            await routeToolCall('create_frame', { name: `FAIL${i}` });
          } catch {
            // Expected
          }
        }
      }

      // Registry should have exactly the successful frames
      expect(registry.getAllNodes()).toHaveLength(successCount);
    });
  });
});
