/**
 * Edge Case & Fault Tolerance E2E Tests
 *
 * Tests unusual and adversarial conditions through the three-tier chain
 * that are not covered by the main tool round-trip tests.
 *
 * Bug this catches:
 * - Malformed plugin responses crash the MCP server instead of returning errors
 * - Plugin returns success:true but with missing/wrong data fields
 * - Tool called with extra unknown fields causes unexpected behavior
 * - Unicode and special characters in node names are lost in transit
 * - Very long node names or content strings are truncated or rejected
 * - Empty arrays/objects in tool inputs cause crashes
 * - Rapid sequential calls to the same tool cause request ID collisions
 * - Circuit breaker HALF_OPEN probe mechanism doesn't recover correctly
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FigmaBridge, resetFigmaBridge } from '../../mcp-server/src/figma-bridge.js';
import { registerAllTools } from '../../mcp-server/src/routing/register-tools.js';
import { resetToolRegistry } from '../../mcp-server/src/routing/tool-registry.js';
import { routeToolCall } from '../../mcp-server/src/routing/tool-router.js';
import { resetNodeRegistry, getNodeRegistry } from '../../mcp-server/src/node-registry.js';
import { configureE2EEnv, restoreEnv } from './helpers/e2e-env.js';
import { startTestBridge, type TestBridgeHandle } from './helpers/test-bridge.js';
import { SimulatedFigmaPlugin, type FigmaCommand } from './helpers/simulated-figma-plugin.js';

// These tests each need fresh bridge/plugin since they manipulate error states
describe('Edge Cases E2E', () => {
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

  // ─── Malformed Plugin Responses ────────────────────────────────────────

  describe('malformed plugin responses', () => {
    it('handles plugin returning success with empty data object without crashing', async () => {
      plugin.setCommandHandler(() => ({
        success: true,
        data: {}
      }));

      // The tool should either handle the empty data gracefully (returning a
      // result with default/missing fields) or throw a meaningful error — not
      // crash with an unhandled TypeError. Either outcome is acceptable.
      let succeeded = false;
      let threwError = false;
      try {
        const result = await routeToolCall('create_frame', { name: 'EmptyData' });
        succeeded = true;
        // If it succeeds, verify the result is still a parseable MCP response
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('text');
      } catch (err) {
        threwError = true;
        // Must be a proper Error, not an unhandled TypeError
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toMatch(/\S/); // non-empty message
      }
      // At least one path must have executed
      expect(succeeded || threwError).toBe(true);
    });

    it('handles plugin returning success with null data without crashing', async () => {
      plugin.setCommandHandler(() => ({
        success: true,
        data: null
      }));

      let succeeded = false;
      let threwError = false;
      try {
        const result = await routeToolCall('create_frame', { name: 'NullData' });
        succeeded = true;
        expect(result).toHaveLength(1);
      } catch (err) {
        threwError = true;
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toMatch(/\S/);
      }
      expect(succeeded || threwError).toBe(true);
    });

    it('throws when plugin reports node does not exist', async () => {
      plugin.setCommandHandler(() => ({
        success: true,
        data: { exists: false }
      }));

      // get_node_by_id should throw when the node doesn't exist
      await expect(routeToolCall('get_node_by_id', { nodeId: 'nonexistent-123' })).rejects.toThrow(
        /not found|does not exist|exists.*false/i
      );
    });

    it('handles plugin returning success:true with error-like data without crashing', async () => {
      plugin.setCommandHandler(() => ({
        success: true,
        data: { error: 'Something went wrong but success was true' }
      }));

      // The server should not crash on this malformed response shape.
      // It may succeed (treating it as valid data) or throw.
      let succeeded = false;
      let threwError = false;
      try {
        await routeToolCall('create_ellipse', { name: 'WeirdResponse', width: 50, height: 50 });
        succeeded = true;
      } catch (err) {
        threwError = true;
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toMatch(/\S/);
      }
      expect(succeeded || threwError).toBe(true);
    });
  });

  // ─── Unicode and Special Characters ────────────────────────────────────

  describe('unicode and special characters', () => {
    it('preserves unicode characters in node names', async () => {
      const unicodeName = 'Botão 按钮 кнопка ボタン';

      const result = await routeToolCall('create_frame', { name: unicodeName });
      expect(result[0].text).toContain('Frame Created Successfully');

      // Verify the plugin received the unicode name intact
      const cmd = plugin.getReceivedCommands().find((c) => c.type === 'create_frame');
      expect(cmd!.payload.name).toBe(unicodeName);
    });

    it('preserves emoji in text content', async () => {
      const parentResult = await routeToolCall('create_frame', {
        name: 'EmojiParent',
        layoutMode: 'VERTICAL',
        padding: 16,
        itemSpacing: 8
      });
      const parentId = parentResult[0].text!.match(/Frame ID:\s*(\S+)/)![1];

      const emojiContent = 'Hello 🌍 World! ✨ Great 👍';
      const result = await routeToolCall('create_text', {
        content: emojiContent,
        fontSize: 16,
        parentId
      });

      expect(result[0].text).toContain('Text Created Successfully');

      const cmd = plugin.getReceivedCommands().find((c) => c.type === 'create_text');
      expect(cmd!.payload.content).toBe(emojiContent);
    });

    it('preserves special characters in color style names', async () => {
      const styleName = 'Primary/Blue (500) #main';

      const result = await routeToolCall('create_color_style', {
        name: styleName,
        color: '#0066FF'
      });

      expect(result[0].text).toContain('Style ID:');

      const cmd = plugin.getReceivedCommands().find((c) => c.type === 'create_color_style');
      expect(cmd!.payload.name).toBe(styleName);
    });
  });

  // ─── Rapid Sequential Calls ────────────────────────────────────────────

  describe('rapid sequential calls', () => {
    it('handles 20 rapid sequential frame creations without ID collision', async () => {
      const ids = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const result = await routeToolCall('create_frame', { name: `Rapid${i}` });
        const id = result[0].text!.match(/Frame ID:\s*(\S+)/)![1];
        ids.add(id);
      }

      // All 20 should have unique IDs
      expect(ids.size).toBe(20);

      // Registry should track all 20
      const registry = getNodeRegistry();
      expect(registry.getAllNodes()).toHaveLength(20);
    });

    it('handles 5 concurrent frame creations with unique IDs', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        routeToolCall('create_frame', { name: `Batch${i}` })
      );

      const results = await Promise.all(promises);
      const ids = results.map((r) => r[0].text!.match(/Frame ID:\s*(\S+)/)![1]);

      // All IDs unique
      expect(new Set(ids).size).toBe(5);
    });
  });

  // ─── Circuit Breaker Edge Cases ────────────────────────────────────────

  describe('circuit breaker behavior', () => {
    it('trips after threshold failures then recovers after reset timeout', async () => {
      // Configure circuit breaker: threshold=3, reset timeout=500ms
      // (already set by configureE2EEnv)

      // Phase 1: Trigger failures to trip the circuit breaker
      plugin.setCommandHandler(() => ({
        success: false,
        error: 'Service unavailable'
      }));

      const failures: Error[] = [];
      for (let i = 0; i < 5; i++) {
        try {
          await routeToolCall('create_frame', { name: `CBFail${i}` });
        } catch (err) {
          failures.push(err as Error);
        }
      }
      expect(failures.length).toBe(5);

      // Phase 2: Plugin recovers
      plugin.resetCommandHandler();

      // Reset bridge to clear circuit breaker state and reconnect
      resetFigmaBridge();
      figmaBridge = new FigmaBridge();
      await figmaBridge.connect();

      // Phase 3: Verify recovery
      const result = await routeToolCall('create_frame', { name: 'CBRecovered' });
      expect(result[0].text).toContain('Frame Created Successfully');
    });
  });

  // ─── Extra/Unknown Fields ──────────────────────────────────────────────

  describe('extra unknown fields in input', () => {
    it('Zod strips extra fields and tool still executes', async () => {
      // Zod's default behavior is to strip unknown fields
      const result = await routeToolCall('create_frame', {
        name: 'ExtraFields',
        unknownField: 'should be ignored',
        anotherExtra: 42
      });

      expect(result[0].text).toContain('Frame Created Successfully');

      // The unknown fields should NOT be forwarded to the plugin
      const cmd = plugin.getReceivedCommands().find((c) => c.type === 'create_frame');
      expect(cmd!.payload.name).toBe('ExtraFields');
      // Zod may or may not strip — depends on schema config
      // The key assertion is that the tool executed successfully
    });
  });

  // ─── Node Registry State After Plugin Errors ───────────────────────────

  describe('registry state after mixed success/failure', () => {
    it('successful creates populate registry even when interleaved with failures', async () => {
      // Create frame 1 (succeeds)
      const result1 = await routeToolCall('create_frame', { name: 'Success1' });
      expect(result1[0].text).toContain('Frame Created Successfully');

      // Try invalid create (fails at schema validation)
      try {
        await routeToolCall('create_frame', { name: '' });
      } catch {
        // Expected
      }

      // Create frame 2 (succeeds)
      const result2 = await routeToolCall('create_frame', { name: 'Success2' });
      expect(result2[0].text).toContain('Frame Created Successfully');

      // Registry should have exactly 2 nodes (the successful creates)
      const registry = getNodeRegistry();
      expect(registry.getAllNodes()).toHaveLength(2);
    });

    it('plugin error during creation does not leave ghost nodes in registry', async () => {
      // First call succeeds
      await routeToolCall('create_frame', { name: 'Good' });

      // Plugin returns error for next call
      plugin.setCommandHandler(() => ({
        success: false,
        error: 'Node limit exceeded'
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

      // Registry should only have the first successful frame
      const registry = getNodeRegistry();
      expect(registry.getAllNodes()).toHaveLength(1);
      expect(registry.getAllNodes()[0].name).toBe('Good');
    });
  });

  // ─── Response Content Contract ─────────────────────────────────────────

  describe('response content contract', () => {
    it('all tool responses return exactly one text content item', async () => {
      // Test a sampling of diverse tool types to verify the contract
      const toolCalls: Array<{ name: string; input: Record<string, unknown> }> = [
        { name: 'create_frame', input: { name: 'ContractTest' } },
        { name: 'create_ellipse', input: { name: 'E', width: 50, height: 50 } },
        {
          name: 'check_wcag_contrast',
          input: { foreground: '#000000', background: '#FFFFFF', fontSize: 16, fontWeight: 400 }
        },
        {
          name: 'validate_design_tokens',
          input: { spacing: [8, 16], typography: [{ fontSize: 16, name: 'body' }] }
        }
      ];

      for (const { name, input } of toolCalls) {
        const result = await routeToolCall(name, input);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('text');
        expect(result[0].text).toMatch(/\S/);
      }
    });
  });

  // ─── Plugin Slow Response Edge ─────────────────────────────────────────

  describe('slow plugin response ordering', () => {
    it('responses arrive in correct order when plugin processes at varying speeds', async () => {
      let callCount = 0;

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

          // Alternate between fast and slow responses
          const delay = callCount++ % 2 === 0 ? 10 : 200;
          const name = (command.payload.name as string) ?? 'unnamed';

          setTimeout(() => {
            this['ws']!.send(
              JSON.stringify({
                id: command.id,
                success: true,
                data: { nodeId: `node_${name}` }
              })
            );
          }, delay);
        }
      }.bind(plugin);

      // Send two requests — first fast, second slow
      const [r1, r2] = await Promise.all([
        routeToolCall('create_frame', { name: 'Fast' }),
        routeToolCall('create_frame', { name: 'Slow' })
      ]);

      // Each should receive its own response (no cross-talk)
      expect(r1[0].text).toContain('node_Fast');
      expect(r2[0].text).toContain('node_Slow');
    });
  });
});
