/**
 * Three-Tier Round-Trip E2E Tests
 *
 * Tests the full data flow through all three tiers:
 *   MCP tool call → Router → FigmaBridge → WebSocket Bridge → Simulated Figma Plugin → Response
 *
 * These tests use a REAL WebSocket bridge server and a REAL FigmaBridge client.
 * The only mock is the Figma plugin itself, which is replaced by a simulated
 * plugin that responds to commands programmatically.
 *
 * Bug this catches: Any breakage in the message format, routing, serialization,
 * or response handling across the three-tier architecture.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FigmaBridge, resetFigmaBridge } from '../../mcp-server/src/figma-bridge.js';
import { routeToolCall } from '../../mcp-server/src/routing/tool-router.js';
import { getNodeRegistry } from '../../mcp-server/src/node-registry.js';
import {
  setupThreeTier,
  teardownThreeTier,
  resetPerTest,
  createParentFrame,
  type ThreeTierContext
} from './helpers/three-tier-setup.js';
import type { FigmaCommand } from './helpers/simulated-figma-plugin.js';

// FigmaBridge and resetFigmaBridge needed for error propagation afterEach reconnection

let ctx: ThreeTierContext;

beforeAll(async () => {
  ctx = await setupThreeTier();
});

afterAll(async () => {
  await teardownThreeTier(ctx);
});

beforeEach(() => {
  resetPerTest(ctx);
});

// ─── Creation Tool Round-Trips ────────────────────────────────────────

describe('Three-Tier Round-Trip — Creation & Workflows', () => {
  describe('creation tool round-trips', () => {
    it('create_frame: full round-trip from router to simulated plugin', async () => {
      const result = await routeToolCall('create_frame', {
        name: 'TestFrame',
        layoutMode: 'VERTICAL',
        itemSpacing: 16,
        padding: 24
      });

      // Verify MCP response format
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('text');
      expect(result[0].text).toContain('Frame Created Successfully');
      expect(result[0].text).toContain('Frame ID:');
      expect(result[0].text).toContain('flex-direction: column');
      expect(result[0].text).toContain('gap: 16px');
      expect(result[0].text).toContain('padding: 24px');

      // Verify the simulated plugin received the command
      const commands = ctx.plugin.getReceivedCommands();
      expect(commands).toHaveLength(1);
      expect(commands[0].type).toBe('create_frame');
      expect(commands[0].payload.name).toBe('TestFrame');
      expect(commands[0].payload.layoutMode).toBe('VERTICAL');
      expect(commands[0].payload.itemSpacing).toBe(16);
      expect(commands[0].payload.padding).toBe(24);

      // Verify the node was registered in the NodeRegistry
      const registry = getNodeRegistry();
      const nodes = registry.getAllNodes();
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('FRAME');
      expect(nodes[0].name).toBe('TestFrame');
    });

    it('create_text: requires parentId and sends correct payload', async () => {
      // create_text enforces hierarchy — must have a parent frame
      const parentId = await createParentFrame();
      ctx.plugin.clearCommands();

      const result = await routeToolCall('create_text', {
        content: 'Hello World',
        fontSize: 16,
        fontWeight: 400,
        parentId
      });

      expect(result[0].type).toBe('text');
      expect(result[0].text).toContain('Text Created Successfully');
      expect(result[0].text).toContain('Text ID:');

      // Find the create_text command (not the get_node_by_id validation call)
      const textCmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_text');
      expect(textCmd).toEqual(expect.objectContaining({ type: 'create_text' }));
      expect(textCmd!.payload.content).toBe('Hello World');
      expect(textCmd!.payload.fontSize).toBe(16);
      expect(textCmd!.payload.parentId).toBe(parentId);
    });

    it('create_ellipse: sends dimensions correctly', async () => {
      const result = await routeToolCall('create_ellipse', {
        name: 'Circle',
        width: 100,
        height: 100
      });

      expect(result[0].text).toContain('Ellipse ID:');

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_ellipse');
      expect(cmd).toEqual(expect.objectContaining({ type: 'create_ellipse' }));
      expect(cmd!.payload.name).toBe('Circle');
      expect(cmd!.payload.width).toBe(100);
      expect(cmd!.payload.height).toBe(100);
    });

    it('create_line: sends coordinate pairs', async () => {
      // create_line requires x1, y1, x2, y2 coordinates
      const result = await routeToolCall('create_line', {
        x1: 0,
        y1: 0,
        x2: 200,
        y2: 0,
        name: 'Divider'
      });

      expect(result[0].text).toContain('Line ID:');

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_line');
      expect(cmd).toEqual(expect.objectContaining({ type: 'create_line' }));
      expect(cmd!.payload.x1).toBe(0);
      expect(cmd!.payload.y1).toBe(0);
      expect(cmd!.payload.x2).toBe(200);
      expect(cmd!.payload.y2).toBe(0);
    });

    it('create_polygon: sends sideCount and radius', async () => {
      const result = await routeToolCall('create_polygon', {
        sideCount: 6,
        radius: 40,
        name: 'Hexagon'
      });

      expect(result[0].text).toContain('Polygon ID:');

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_polygon');
      expect(cmd).toEqual(expect.objectContaining({ type: 'create_polygon' }));
      expect(cmd!.payload.sideCount).toBe(6);
      expect(cmd!.payload.radius).toBe(40);
    });

    it('create_star: sends pointCount and radius', async () => {
      const result = await routeToolCall('create_star', {
        pointCount: 5,
        radius: 30,
        innerRadius: 12,
        name: 'Star5'
      });

      expect(result[0].text).toContain('Star ID:');

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_star');
      expect(cmd).toEqual(expect.objectContaining({ type: 'create_star' }));
      expect(cmd!.payload.pointCount).toBe(5);
      expect(cmd!.payload.radius).toBe(30);
      expect(cmd!.payload.innerRadius).toBe(12);
    });
  });

  // ─── Multi-Step Workflow ────────────────────────────────────────────

  describe('multi-step workflows', () => {
    it('create parent frame, then nest child frame with parentId', async () => {
      // Step 1: Create root frame
      const rootResult = await routeToolCall('create_frame', {
        name: 'Root',
        layoutMode: 'VERTICAL',
        padding: 16,
        itemSpacing: 8
      });

      const rootText = rootResult[0].text!;
      const rootIdMatch = rootText.match(/Frame ID:\s*(\S+)/);
      expect(rootIdMatch).toEqual(expect.arrayContaining([expect.stringMatching(/\S+/)]));
      const rootId = rootIdMatch![1];

      ctx.plugin.clearCommands();

      // Step 2: Create child frame nested inside root
      const childResult = await routeToolCall('create_frame', {
        name: 'Child',
        parentId: rootId,
        layoutMode: 'HORIZONTAL',
        padding: 8,
        itemSpacing: 8
      });

      const childText = childResult[0].text!;
      expect(childText).toContain('Frame Created Successfully');

      // Verify the create command was sent with correct parentId
      const createCmds = ctx.plugin.getReceivedCommands().filter((c) => c.type === 'create_frame');
      expect(createCmds).toHaveLength(1);
      expect(createCmds[0].payload.name).toBe('Child');
      expect(createCmds[0].payload.parentId).toBe(rootId);

      // Verify node registry tracks the hierarchy
      const registry = getNodeRegistry();
      const rootNode = registry.getNode(rootId);
      expect(rootNode).toEqual(expect.objectContaining({ name: 'Root' }));
      expect(rootNode!.name).toBe('Root');
      expect(rootNode!.children).toHaveLength(1);
    });

    it('create frame, then add text child, then verify hierarchy', async () => {
      // Create frame
      const frameId = await createParentFrame('Card');
      ctx.plugin.clearCommands();

      // Add text
      const textResult = await routeToolCall('create_text', {
        content: 'Card Title',
        fontSize: 24,
        parentId: frameId
      });
      expect(textResult[0].text).toContain('Text Created Successfully');

      // Verify the text command included the parentId
      const textCmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_text');
      expect(textCmd).toEqual(expect.objectContaining({ type: 'create_text' }));
      expect(textCmd!.payload.parentId).toBe(frameId);
      expect(textCmd!.payload.content).toBe('Card Title');
    });

    it('three-level deep hierarchy: page → section → card', async () => {
      // Level 1: Page container
      const pageId = await createParentFrame('Page');
      ctx.plugin.clearCommands();

      // Level 2: Section
      const sectionResult = await routeToolCall('create_frame', {
        name: 'Section',
        parentId: pageId,
        layoutMode: 'VERTICAL',
        padding: 24,
        itemSpacing: 16
      });
      const sectionId = sectionResult[0].text!.match(/Frame ID:\s*(\S+)/)![1];

      // Level 3: Card inside section
      const cardResult = await routeToolCall('create_frame', {
        name: 'Card',
        parentId: sectionId,
        layoutMode: 'VERTICAL',
        padding: 16,
        itemSpacing: 8
      });
      expect(cardResult[0].text).toContain('Frame Created Successfully');

      // Verify registry hierarchy
      const registry = getNodeRegistry();
      const pageNode = registry.getNode(pageId)!;
      expect(pageNode.children).toHaveLength(1);
      expect(pageNode.children[0]).toBe(sectionId);

      const sectionNode = registry.getNode(sectionId)!;
      expect(sectionNode.children).toHaveLength(1);
      expect(sectionNode.parentId).toBe(pageId);
    });
  });
});

// ─── Validation, Error, Payload, Response, Concurrency ──────────────────

describe('Three-Tier Round-Trip — Validation & Contracts', () => {
  describe('validation tools (no Figma needed)', () => {
    it('check_wcag_contrast: returns computed contrast ratio', async () => {
      const result = await routeToolCall('check_wcag_contrast', {
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });

      expect(result[0].text).toContain('Contrast Check');
      expect(result[0].text).toContain('21');
      expect(result[0].text).toContain('PASS');

      // No commands should reach the plugin — this is local-only
      expect(ctx.plugin.getReceivedCommands()).toHaveLength(0);
    });

    it('check_wcag_contrast: detects failing contrast', async () => {
      const result = await routeToolCall('check_wcag_contrast', {
        foreground: '#CCCCCC',
        background: '#FFFFFF',
        fontSize: 14,
        fontWeight: 400
      });

      expect(result[0].text).toContain('FAIL');
      expect(ctx.plugin.getReceivedCommands()).toHaveLength(0);
    });

    it('validate_design_tokens: validates spacing and typography', async () => {
      const result = await routeToolCall('validate_design_tokens', {
        spacing: [8, 16, 24, 15],
        typography: [
          { fontSize: 16, name: 'body' },
          { fontSize: 14, name: 'bad' }
        ]
      });

      expect(result[0].text).toContain('Validation Report');
      expect(result[0].text).toContain('Suggested');
      expect(result[0].text).toContain('TYPOGRAPHY');

      expect(ctx.plugin.getReceivedCommands()).toHaveLength(0);
    });

    it('validate_design_tokens: passes for valid tokens', async () => {
      const result = await routeToolCall('validate_design_tokens', {
        spacing: [0, 8, 16, 24, 32],
        typography: [
          { fontSize: 16, name: 'body' },
          { fontSize: 24, name: 'heading' }
        ]
      });

      expect(result[0].text).toContain('Validation Report');
      expect(ctx.plugin.getReceivedCommands()).toHaveLength(0);
    });
  });

  // ─── Schema Validation Through Router ────────────────────────────────

  describe('schema validation through the full router', () => {
    it('rejects invalid input before reaching the bridge', async () => {
      await expect(routeToolCall('create_frame', { name: '' })).rejects.toThrow();
      expect(ctx.plugin.getReceivedCommands()).toHaveLength(0);
    });

    it('rejects completely wrong input types', async () => {
      await expect(
        routeToolCall('check_wcag_contrast', { foreground: 12345, background: true })
      ).rejects.toThrow();
    });

    it('rejects unknown tool names with descriptive error', async () => {
      await expect(routeToolCall('nonexistent_tool_xyz', {})).rejects.toThrow('Unknown tool');
    });

    it('create_text without parentId is rejected (hierarchy enforcement)', async () => {
      await expect(
        routeToolCall('create_text', { content: 'Orphan Text', fontSize: 16 })
      ).rejects.toThrow('HIERARCHY VIOLATION');
    });

    it('off-grid spacing is rejected by Zod schema', async () => {
      await expect(routeToolCall('create_frame', { name: 'Bad', padding: 15 })).rejects.toThrow();
      expect(ctx.plugin.getReceivedCommands()).toHaveLength(0);
    });
  });

  // ─── Figma Plugin Error Propagation ──────────────────────────────────

  describe('error propagation from simulated plugin', () => {
    // Error tests trip the circuit breaker, so reconnect the bridge after each
    afterEach(async () => {
      ctx.plugin.resetCommandHandler();
      resetFigmaBridge();
      ctx.figmaBridge = new FigmaBridge();
      await ctx.figmaBridge.connect();
    });

    it('plugin error causes tool execution to fail', async () => {
      ctx.plugin.setCommandHandler(() => ({
        success: false,
        error: 'Cannot create frame: page is locked'
      }));

      await expect(routeToolCall('create_frame', { name: 'WillFail' })).rejects.toThrow();

      // Verify the command was sent (even though it failed)
      const cmds = ctx.plugin.getReceivedCommands().filter((c) => c.type === 'create_frame');
      expect(cmds.length).toBeGreaterThanOrEqual(1);
    });

    it('plugin error is wrapped as FigmaAPIError', async () => {
      ctx.plugin.setCommandHandler(() => ({
        success: false,
        error: 'Node limit exceeded in document'
      }));

      try {
        await routeToolCall('create_frame', { name: 'WillFail' });
        expect.fail('Should have thrown');
      } catch (err) {
        const errorObj = err as Error;
        expect(errorObj).toBeInstanceOf(Error);
        expect(errorObj.name).toBe('FigmaAPIError');
      }
    });
  });

  // ─── Payload Fidelity ────────────────────────────────────────────────

  describe('payload fidelity', () => {
    it('all create_frame fields are forwarded to the plugin', async () => {
      await routeToolCall('create_frame', {
        name: 'FullFrame',
        width: 400,
        height: 300,
        layoutMode: 'HORIZONTAL',
        itemSpacing: 24,
        padding: 32,
        horizontalSizing: 'FILL',
        verticalSizing: 'HUG'
      });

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_frame')!;
      expect(cmd.payload).toEqual(
        expect.objectContaining({
          name: 'FullFrame',
          width: 400,
          height: 300,
          layoutMode: 'HORIZONTAL',
          itemSpacing: 24,
          padding: 32,
          horizontalSizing: 'FILL',
          verticalSizing: 'HUG'
        })
      );
    });

    it('optional fields are omitted when not provided', async () => {
      await routeToolCall('create_frame', { name: 'MinimalFrame' });

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_frame')!;
      expect(cmd.payload.name).toBe('MinimalFrame');
      expect(cmd.payload.parentId).toBeUndefined();
    });
  });

  // ─── Response Format Contract ────────────────────────────────────────

  describe('response format contract', () => {
    it('create_frame returns text content with Frame ID and CSS', async () => {
      const result = await routeToolCall('create_frame', {
        name: 'TestContract',
        layoutMode: 'VERTICAL',
        padding: 16,
        itemSpacing: 8
      });

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('text');
      expect(result[0].text).toContain('Frame Created Successfully');
      expect(result[0].text).toContain('Frame ID:');
      expect(result[0].text).toContain('HTML Analogy:');
      expect(result[0].text).toContain('CSS Equivalent:');
    });

    it('create_text returns text content with Text ID', async () => {
      const parentId = await createParentFrame();
      ctx.plugin.clearCommands();

      const result = await routeToolCall('create_text', {
        content: 'Test',
        fontSize: 16,
        parentId
      });

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('text');
      expect(result[0].text).toContain('Text Created Successfully');
      expect(result[0].text).toContain('Text ID:');
      expect(result[0].text).toContain('CSS Equivalent:');
    });

    it('all creation tools return exactly one text content item', async () => {
      const parentId = await createParentFrame();
      ctx.plugin.clearCommands();

      const creationTools = [
        { name: 'create_frame', input: { name: 'F1' } },
        { name: 'create_ellipse', input: { name: 'E1', width: 50, height: 50 } },
        { name: 'create_line', input: { x1: 0, y1: 0, x2: 100, y2: 0 } },
        { name: 'create_polygon', input: { sideCount: 5, radius: 30 } },
        { name: 'create_star', input: { radius: 20 } }
      ];

      for (const { name, input } of creationTools) {
        const result = await routeToolCall(name, input);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('text');
        expect(result[0].text).toContain('ID:');
      }
    });
  });

  // ─── Concurrent Requests ──────────────────────────────────────────────

  describe('concurrent tool calls', () => {
    it('handles multiple simultaneous creation requests', async () => {
      const promises = [
        routeToolCall('create_frame', { name: 'Concurrent1' }),
        routeToolCall('create_frame', { name: 'Concurrent2' }),
        routeToolCall('create_frame', { name: 'Concurrent3' })
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      for (const result of results) {
        expect(result[0].text).toContain('Frame Created Successfully');
      }

      const createCmds = ctx.plugin.getReceivedCommands().filter((c) => c.type === 'create_frame');
      expect(createCmds).toHaveLength(3);

      const names = createCmds.map((c) => c.payload.name);
      expect(new Set(names).size).toBe(3);
    });

    it('responses are routed to correct callers (no cross-talk)', async () => {
      // Custom handler that tags each response with the frame name
      ctx.plugin.setCommandHandler((cmd: FigmaCommand) => ({
        success: true,
        data: { nodeId: `node_${cmd.payload.name as string}` }
      }));

      const results = await Promise.all([
        routeToolCall('create_frame', { name: 'FrameA' }),
        routeToolCall('create_frame', { name: 'FrameB' })
      ]);

      // Verify each result contains its own frame's ID, not the other's
      expect(results[0][0].text).toContain('node_FrameA');
      expect(results[1][0].text).toContain('node_FrameB');
    });
  });

  // ─── Node Registry Consistency ────────────────────────────────────────

  describe('node registry consistency across tool calls', () => {
    it('each create_frame adds exactly one node to registry', async () => {
      const registry = getNodeRegistry();
      expect(registry.getAllNodes()).toHaveLength(0);

      await routeToolCall('create_frame', { name: 'Frame1' });
      expect(registry.getAllNodes()).toHaveLength(1);

      await routeToolCall('create_frame', { name: 'Frame2' });
      expect(registry.getAllNodes()).toHaveLength(2);

      await routeToolCall('create_frame', { name: 'Frame3' });
      expect(registry.getAllNodes()).toHaveLength(3);
    });

    it('child nodes are tracked under their parent', async () => {
      const registry = getNodeRegistry();

      // Create parent
      const parentResult = await routeToolCall('create_frame', { name: 'Parent' });
      const parentId = parentResult[0].text!.match(/Frame ID:\s*(\S+)/)![1];

      // Create two children
      await routeToolCall('create_frame', { name: 'ChildA', parentId });
      await routeToolCall('create_frame', { name: 'ChildB', parentId });

      const parentNode = registry.getNode(parentId)!;
      expect(parentNode.children).toHaveLength(2);

      const rootNodes = registry.getRootNodes();
      expect(rootNodes).toHaveLength(1);
      expect(rootNodes[0].nodeId).toBe(parentId);
    });

    it('registry hierarchy matches the tree structure from getHierarchy', async () => {
      const registry = getNodeRegistry();

      const rootResult = await routeToolCall('create_frame', { name: 'Root' });
      const rootId = rootResult[0].text!.match(/Frame ID:\s*(\S+)/)![1];

      const childResult = await routeToolCall('create_frame', {
        name: 'Inner',
        parentId: rootId
      });
      const childId = childResult[0].text!.match(/Frame ID:\s*(\S+)/)![1];

      const hierarchy = registry.getHierarchy();
      expect(hierarchy).toHaveLength(1);
      expect(hierarchy[0].name).toBe('Root');
      expect(hierarchy[0].children).toHaveLength(1);
      expect(hierarchy[0].children[0].name).toBe('Inner');
      expect(hierarchy[0].children[0].nodeId).toBe(childId);
    });
  });
});
