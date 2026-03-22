/**
 * Design Workflow E2E Tests
 *
 * Tests complex, multi-step design workflows through the full three-tier chain:
 *   create_design (batch), styling operations, component creation, querying.
 *
 * Bug this catches:
 * - create_design spec is not forwarded correctly to the Figma plugin
 * - Auto-correction modifies the spec before forwarding but results differ
 * - Node registry not populated from create_design response
 * - Styling tools send wrong payloads after querying existing nodes
 * - Multi-step workflows break when tool outputs feed into subsequent tool inputs
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { routeToolCall } from '../../mcp-server/src/routing/tool-router.js';
import { getNodeRegistry } from '../../mcp-server/src/node-registry.js';
import {
  setupThreeTier,
  teardownThreeTier,
  resetPerTest,
  extractId,
  type ThreeTierContext
} from './helpers/three-tier-setup.js';

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

// ─── create_design ────────────────────────────────────────────────────

describe('Design Workflow E2E — create_design', () => {
  describe('create_design batch operations', () => {
    it('creates a simple card design with frame + text children', async () => {
      const result = await routeToolCall('create_design', {
        spec: {
          type: 'frame',
          name: 'Card',
          props: { layoutMode: 'VERTICAL', padding: 16, itemSpacing: 8 },
          children: [
            { type: 'text', name: 'Title', props: { content: 'Hello', fontSize: 24 } },
            { type: 'text', name: 'Body', props: { content: 'World', fontSize: 16 } }
          ]
        }
      });

      expect(result[0].text).toContain('Design Created Successfully');
      expect(result[0].text).toContain('Total Nodes:');
      expect(result[0].text).toContain('Node IDs:');

      // Verify the create_design command was sent to the plugin
      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_design');
      expect(cmd).toEqual(expect.objectContaining({ type: 'create_design' }));
      const spec = cmd!.payload.spec as Record<string, unknown>;
      expect(spec.name).toBe('Card');
      expect((spec.children as unknown[]).length).toBe(2);
    });

    it('creates a nested button design with auto-correction', async () => {
      const result = await routeToolCall('create_design', {
        spec: {
          type: 'frame',
          name: 'Button',
          props: {
            layoutMode: 'HORIZONTAL',
            padding: 16,
            itemSpacing: 8,
            fillColor: '#0066FF',
            cornerRadius: 8
          },
          children: [
            {
              type: 'text',
              name: 'Label',
              props: { content: 'Click Me', fontSize: 16, color: '#FFFFFF' }
            }
          ]
        }
      });

      expect(result[0].text).toContain('Design Created Successfully');

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_design');
      expect(cmd).toEqual(expect.objectContaining({ type: 'create_design' }));
      const spec = cmd!.payload.spec as Record<string, unknown>;
      const props = spec.props as Record<string, unknown>;
      // Auto-correction should preserve valid values
      expect(props.padding).toBe(16);
      expect(props.itemSpacing).toBe(8);
    });

    it('auto-corrects off-grid spacing in create_design specs', async () => {
      const result = await routeToolCall('create_design', {
        spec: {
          type: 'frame',
          name: 'BadSpacing',
          props: { padding: 15, itemSpacing: 10 }
        },
        autoCorrect: true
      });

      expect(result[0].text).toContain('Design Created Successfully');

      // Check if auto-corrections were reported
      const text = result[0].text!;
      if (text.includes('Auto-Corrections')) {
        // Auto-corrections were applied — this is the correct behavior
        expect(text).toContain('Auto-Corrections Applied');
      }

      // The plugin should receive corrected values
      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_design');
      const spec = cmd!.payload.spec as Record<string, unknown>;
      const props = spec.props as Record<string, unknown>;
      // 15 should be corrected to 16, 10 should be corrected to 8
      expect(props.padding).toBe(16);
      expect(props.itemSpacing).toBe(8);
    });

    it('skips auto-correction when explicitly disabled', async () => {
      const result = await routeToolCall('create_design', {
        spec: {
          type: 'frame',
          name: 'RawSpacing',
          props: { padding: 15, itemSpacing: 10 }
        },
        autoCorrect: false
      });

      expect(result[0].text).toContain('Design Created Successfully');

      // Plugin should receive the original (uncorrected) values
      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_design');
      const spec = cmd!.payload.spec as Record<string, unknown>;
      const props = spec.props as Record<string, unknown>;
      expect(props.padding).toBe(15);
      expect(props.itemSpacing).toBe(10);
    });

    it('populates node registry from create_design response', async () => {
      await routeToolCall('create_design', {
        spec: {
          type: 'frame',
          name: 'Container',
          children: [
            { type: 'text', name: 'Label' },
            { type: 'ellipse', name: 'Icon' }
          ]
        }
      });

      const registry = getNodeRegistry();
      const allNodes = registry.getAllNodes();
      // create_design handler registers nodes from the response
      expect(allNodes.length).toBeGreaterThanOrEqual(3);
    });

    it('creates a deeply nested design hierarchy', async () => {
      const result = await routeToolCall('create_design', {
        spec: {
          type: 'frame',
          name: 'Page',
          props: { layoutMode: 'VERTICAL', padding: 32 },
          children: [
            {
              type: 'frame',
              name: 'Header',
              props: { layoutMode: 'HORIZONTAL', padding: 16 },
              children: [{ type: 'text', name: 'Logo', props: { content: 'App', fontSize: 24 } }]
            },
            {
              type: 'frame',
              name: 'Content',
              props: { layoutMode: 'VERTICAL', padding: 16, itemSpacing: 16 },
              children: [
                {
                  type: 'frame',
                  name: 'Card1',
                  props: { layoutMode: 'VERTICAL', padding: 16 },
                  children: [
                    { type: 'text', name: 'CardTitle', props: { content: 'Title', fontSize: 20 } }
                  ]
                },
                {
                  type: 'frame',
                  name: 'Card2',
                  props: { layoutMode: 'VERTICAL', padding: 16 },
                  children: [
                    {
                      type: 'text',
                      name: 'CardTitle2',
                      props: { content: 'Title 2', fontSize: 20 }
                    }
                  ]
                }
              ]
            }
          ]
        }
      });

      expect(result[0].text).toContain('Design Created Successfully');
      // Should have at least 7 nodes: Page, Header, Logo, Content, Card1, CardTitle, Card2, CardTitle2
      expect(result[0].text).toMatch(/Total Nodes:\s*[7-9]/);

      // Verify the full spec was sent to the plugin
      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_design');
      const spec = cmd!.payload.spec as Record<string, unknown>;
      const children = spec.children as Record<string, unknown>[];
      expect(children).toHaveLength(2);
      expect((children[0] as Record<string, unknown>).name).toBe('Header');
      expect((children[1] as Record<string, unknown>).name).toBe('Content');
    });

    it('propagates plugin error for invalid create_design spec', async () => {
      ctx.plugin.setCommandHandler(() => ({
        success: false,
        error: 'Invalid spec: unsupported node type'
      }));

      // Bridge errors now propagate to the router for proper error tracking.
      // The router re-throws, so routeToolCall rejects with the bridge error.
      await expect(
        routeToolCall('create_design', {
          spec: {
            type: 'frame',
            name: 'WillFail'
          }
        })
      ).rejects.toThrow('Invalid spec: unsupported node type');
    });
  });
});

// ─── Styling Tools ────────────────────────────────────────────────────

describe('Design Workflow E2E — Styling & Utility', () => {
  describe('styling tools through full chain', () => {
    it('set_fills sends correct color payload to Figma plugin', async () => {
      const frameResult = await routeToolCall('create_frame', { name: 'Styleable' });
      const frameId = frameResult[0].text!.match(/Frame ID:\s*(\S+)/)![1];
      ctx.plugin.clearCommands();

      // set_fills takes a hex color string and opacity, not a fills array
      const result = await routeToolCall('set_fills', {
        nodeId: frameId,
        color: '#0066FF',
        opacity: 0.9
      });

      expect(result[0].text).toContain('Fills Applied');

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_fills');
      expect(cmd).toEqual(expect.objectContaining({ type: 'set_fills' }));
      expect(cmd!.payload.nodeId).toBe(frameId);
    });

    it('set_stroke sends correct stroke configuration', async () => {
      const frameResult = await routeToolCall('create_frame', { name: 'Bordered' });
      const frameId = frameResult[0].text!.match(/Frame ID:\s*(\S+)/)![1];
      ctx.plugin.clearCommands();

      // set_stroke schema uses strokeWeight and strokeColor
      const result = await routeToolCall('set_stroke', {
        nodeId: frameId,
        strokeColor: '#FF0000',
        strokeWeight: 2,
        strokeAlign: 'INSIDE'
      });

      expect(result[0].text).toContain('Stroke');

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_stroke');
      expect(cmd).toEqual(expect.objectContaining({ type: 'set_stroke' }));
      expect(cmd!.payload.nodeId).toBe(frameId);
      expect(cmd!.payload.strokeWeight).toBe(2);
      expect(cmd!.payload.strokeAlign).toBe('INSIDE');
    });

    it('set_corner_radius sends radius values', async () => {
      const frameResult = await routeToolCall('create_frame', { name: 'Rounded' });
      const frameId = frameResult[0].text!.match(/Frame ID:\s*(\S+)/)![1];
      ctx.plugin.clearCommands();

      const result = await routeToolCall('set_corner_radius', {
        nodeId: frameId,
        radius: 8
      });

      expect(result[0].text).toContain('corner radius');

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_corner_radius');
      expect(cmd).toEqual(expect.objectContaining({ type: 'set_corner_radius' }));
      expect(cmd!.payload.nodeId).toBe(frameId);
      expect(cmd!.payload.radius).toBe(8);
    });

    it('set_layout_properties sends layout configuration', async () => {
      const frameResult = await routeToolCall('create_frame', { name: 'LayoutTarget' });
      const frameId = frameResult[0].text!.match(/Frame ID:\s*(\S+)/)![1];
      ctx.plugin.clearCommands();

      const result = await routeToolCall('set_layout_properties', {
        nodeId: frameId,
        layoutMode: 'HORIZONTAL',
        itemSpacing: 24,
        padding: 16
      });

      expect(result[0].text).toContain('Layout Properties');

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_layout_properties');
      expect(cmd).toEqual(expect.objectContaining({ type: 'set_layout_properties' }));
      expect(cmd!.payload.nodeId).toBe(frameId);
      expect(cmd!.payload.layoutMode).toBe('HORIZONTAL');
      expect(cmd!.payload.itemSpacing).toBe(24);
      expect(cmd!.payload.padding).toBe(16);
    });

    it('apply_effects sends shadow effect configuration', async () => {
      const frameResult = await routeToolCall('create_frame', { name: 'Shadowed' });
      const frameId = frameResult[0].text!.match(/Frame ID:\s*(\S+)/)![1];
      ctx.plugin.clearCommands();

      // apply_effects schema: shadow uses hex color, x/y, blur, spread, opacity
      const result = await routeToolCall('apply_effects', {
        nodeId: frameId,
        effects: [
          {
            type: 'DROP_SHADOW',
            color: '#000000',
            opacity: 0.25,
            x: 0,
            y: 4,
            blur: 8,
            spread: 0
          }
        ]
      });

      expect(result[0].text).toContain('Effects Applied');

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'apply_effects');
      expect(cmd).toEqual(expect.objectContaining({ type: 'apply_effects' }));
      expect(cmd!.payload.nodeId).toBe(frameId);
    });
  });

  // ─── Complete Design → Style Workflow ─────────────────────────────────

  describe('complete design-then-style workflow', () => {
    it('create_design → set_fills → set_corner_radius chain', async () => {
      // Step 1: Create a design
      const designResult = await routeToolCall('create_design', {
        spec: {
          type: 'frame',
          name: 'StyledCard',
          props: { layoutMode: 'VERTICAL', padding: 16 },
          children: [{ type: 'text', name: 'CardTitle', props: { content: 'Hello', fontSize: 20 } }]
        }
      });

      expect(designResult[0].text).toContain('Design Created Successfully');

      // Extract the root node ID
      const nodeIdMatch = designResult[0].text!.match(/Root Node ID:\s*(\S+)/);
      expect(nodeIdMatch).toEqual(expect.arrayContaining([expect.stringMatching(/\S+/)]));
      const rootId = nodeIdMatch![1];

      ctx.plugin.clearCommands();

      // Step 2: Style the card
      await routeToolCall('set_fills', {
        nodeId: rootId,
        color: '#FFFFFF',
        opacity: 1
      });

      // Step 3: Round the corners
      await routeToolCall('set_corner_radius', {
        nodeId: rootId,
        radius: 12
      });

      // Verify both styling commands were sent
      const cmds = ctx.plugin.getReceivedCommands();
      const fillCmd = cmds.find((c) => c.type === 'set_fills');
      const radiusCmd = cmds.find((c) => c.type === 'set_corner_radius');

      expect(fillCmd).toEqual(expect.objectContaining({ type: 'set_fills' }));
      expect(fillCmd!.payload.nodeId).toBe(rootId);
      expect(radiusCmd).toEqual(expect.objectContaining({ type: 'set_corner_radius' }));
      expect(radiusCmd!.payload.nodeId).toBe(rootId);
    });
  });

  // ─── create_design Validation ────────────────────────────────────────

  describe('create_design input validation', () => {
    it('rejects spec with invalid node type', async () => {
      await expect(
        routeToolCall('create_design', {
          spec: {
            type: 'invalid_type' as 'frame',
            name: 'Bad'
          }
        })
      ).rejects.toThrow();

      expect(ctx.plugin.getReceivedCommands()).toHaveLength(0);
    });

    it('rejects spec without type field', async () => {
      await expect(
        routeToolCall('create_design', {
          spec: { name: 'NoType' }
        })
      ).rejects.toThrow();
    });

    it('accepts minimal spec with just type', async () => {
      const result = await routeToolCall('create_design', {
        spec: { type: 'frame' }
      });

      expect(result[0].text).toContain('Design Created Successfully');
    });
  });

  // ─── Auto-Correction Boundary Cases ─────────────────────────────────

  describe('create_design auto-correction edge cases', () => {
    it('auto-corrects multiple off-grid values in nested specs', async () => {
      const result = await routeToolCall('create_design', {
        spec: {
          type: 'frame',
          name: 'DeepAutoCorrect',
          props: { padding: 15, itemSpacing: 10 },
          children: [
            {
              type: 'frame',
              name: 'Inner',
              props: { padding: 13, itemSpacing: 7 }
            }
          ]
        },
        autoCorrect: true
      });

      expect(result[0].text).toContain('Design Created Successfully');

      // Check that corrected values reached the plugin
      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_design');
      const spec = cmd!.payload.spec as Record<string, unknown>;
      const rootProps = spec.props as Record<string, unknown>;

      // 15 → 16 (nearest 8pt grid), 10 → 8 (nearest 8pt grid)
      expect(rootProps.padding).toBe(16);
      expect(rootProps.itemSpacing).toBe(8);

      // Check inner frame props
      const children = spec.children as Array<Record<string, unknown>>;
      const innerProps = children[0].props as Record<string, unknown>;
      // 13 → 16, 7 → 8
      expect(innerProps.padding).toBe(16);
      expect(innerProps.itemSpacing).toBe(8);
    });

    it('does not auto-correct when values are already on grid', async () => {
      const result = await routeToolCall('create_design', {
        spec: {
          type: 'frame',
          name: 'OnGrid',
          props: { padding: 24, itemSpacing: 16 }
        },
        autoCorrect: true
      });

      expect(result[0].text).toContain('Design Created Successfully');

      // On-grid values should NOT trigger auto-corrections
      expect(result[0].text).not.toContain('Auto-Corrections Applied');
    });
  });

  // ─── Response Parsing (What an LLM Agent Would Extract) ────────────────

  describe('response format for LLM agent consumption', () => {
    it('create_frame response contains extractable Frame ID', async () => {
      const result = await routeToolCall('create_frame', {
        name: 'AgentParseable',
        layoutMode: 'VERTICAL',
        padding: 16,
        itemSpacing: 8
      });

      // An LLM agent would parse this with a regex like /Frame ID: (\S+)/
      const text = result[0].text!;
      const idMatch = text.match(/Frame ID:\s*(\S+)/);
      expect(idMatch).toEqual(expect.arrayContaining([expect.stringMatching(/\S+/)]));
      expect(idMatch![1]).toMatch(/\S+/);

      // The ID should be a non-whitespace string
      expect(idMatch![1]).toMatch(/\S+/);
    });

    it('create_design response contains extractable Root Node ID and child IDs', async () => {
      const result = await routeToolCall('create_design', {
        spec: {
          type: 'frame',
          name: 'Parseable',
          children: [
            { type: 'text', name: 'Label' },
            { type: 'ellipse', name: 'Icon' }
          ]
        }
      });

      const text = result[0].text!;

      // Root Node ID
      const rootMatch = text.match(/Root Node ID:\s*(\S+)/);
      expect(rootMatch).toEqual(expect.arrayContaining([expect.stringMatching(/\S+/)]));

      // Total Nodes
      const totalMatch = text.match(/Total Nodes:\s*(\d+)/);
      expect(totalMatch).toEqual(expect.arrayContaining([expect.stringMatching(/\d+/)]));
      expect(parseInt(totalMatch![1])).toBeGreaterThanOrEqual(3);

      // Node IDs section
      expect(text).toContain('Node IDs:');
    });

    it('check_wcag_contrast response has clear PASS/FAIL verdict', async () => {
      const result = await routeToolCall('check_wcag_contrast', {
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });

      const text = result[0].text!;
      // Should contain clear PASS or FAIL verdict
      expect(text).toMatch(/PASS|FAIL/);
      // Should contain the ratio
      expect(text).toMatch(/\d+(\.\d+)?/);
    });
  });

  // ─── Visibility and Lock Tools ────────────────────────────────────────

  describe('visibility and lock tools', () => {
    it('set_visible sends correct visibility state', async () => {
      const frameResult = await routeToolCall('create_frame', { name: 'Hideable' });
      const frameId = frameResult[0].text!.match(/Frame ID:\s*(\S+)/)![1];
      ctx.plugin.clearCommands();

      await routeToolCall('set_visible', { nodeId: frameId, visible: false });

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_visible');
      expect(cmd).toEqual(expect.objectContaining({ type: 'set_visible' }));
      expect(cmd!.payload.nodeId).toBe(frameId);
      expect(cmd!.payload.visible).toBe(false);
    });

    it('set_locked sends correct lock state', async () => {
      const frameResult = await routeToolCall('create_frame', { name: 'Lockable' });
      const frameId = frameResult[0].text!.match(/Frame ID:\s*(\S+)/)![1];
      ctx.plugin.clearCommands();

      await routeToolCall('set_locked', { nodeId: frameId, locked: true });

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_locked');
      expect(cmd).toEqual(expect.objectContaining({ type: 'set_locked' }));
      expect(cmd!.payload.locked).toBe(true);
    });
  });
});
