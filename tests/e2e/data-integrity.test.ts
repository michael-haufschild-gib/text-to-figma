/**
 * Data Integrity E2E Tests
 *
 * Tests that data flows correctly across the three-tier architecture
 * without corruption, truncation, or field loss. These tests verify
 * that the serialization boundary between MCP server → WebSocket bridge →
 * Figma plugin preserves all data fields accurately.
 *
 * Bug this catches:
 * - Numeric values are stringified or rounded during JSON serialization
 * - Nested object fields are flattened or lost
 * - Array ordering is not preserved
 * - Boolean false is confused with undefined/null
 * - Optional fields present with value are stripped
 * - Optional fields absent are filled with defaults unexpectedly
 * - Hex color strings are normalized or lowercased
 * - Zero values are treated as falsy and dropped
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { routeToolCall } from '../../mcp-server/src/routing/tool-router.js';
import { getNodeRegistry } from '../../mcp-server/src/node-registry.js';
import {
  setupThreeTier,
  teardownThreeTier,
  resetPerTest,
  createParentFrame,
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

// ─── Numeric Precision ───────────────────────────────────────────────────

describe('Data Integrity — numeric precision', () => {
  it('rejects zero frame dimensions (must be positive)', async () => {
    // Frame width/height schema requires .positive() — zero is invalid
    await expect(
      routeToolCall('create_frame', { name: 'ZeroDims', width: 0, height: 0 })
    ).rejects.toThrow();

    // No command should reach the plugin
    expect(ctx.plugin.getReceivedCommands()).toHaveLength(0);
  });

  it('preserves small positive dimension values', async () => {
    await routeToolCall('create_frame', {
      name: 'SmallDims',
      width: 1,
      height: 1
    });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_frame');
    expect(cmd!.payload.width).toBe(1);
    expect(cmd!.payload.height).toBe(1);
  });

  it('preserves decimal opacity values through color conversion', async () => {
    const frameId = await createParentFrame('OpacityTest');
    ctx.plugin.clearCommands();

    await routeToolCall('set_fills', {
      nodeId: frameId,
      color: '#FF0000',
      opacity: 0.333
    });

    // set_fills converts color to Figma fills array format
    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_fills');
    const fills = cmd!.payload.fills as Array<{ opacity: number }>;
    expect(fills[0].opacity).toBe(0.333);
  });

  it('preserves negative coordinate values in line creation', async () => {
    await routeToolCall('create_line', {
      name: 'NegLine',
      x1: -100,
      y1: -50,
      x2: 100,
      y2: 50
    });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_line');
    expect(cmd!.payload.x1).toBe(-100);
    expect(cmd!.payload.y1).toBe(-50);
    expect(cmd!.payload.x2).toBe(100);
    expect(cmd!.payload.y2).toBe(50);
  });

  it('preserves large dimension values', async () => {
    await routeToolCall('create_ellipse', {
      name: 'LargeEllipse',
      width: 10000,
      height: 8000
    });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_ellipse');
    expect(cmd!.payload.width).toBe(10000);
    expect(cmd!.payload.height).toBe(8000);
  });
});

// ─── Boolean Field Integrity ─────────────────────────────────────────────

describe('Data Integrity — boolean fields', () => {
  it('preserves explicit false for visibility', async () => {
    const frameId = await createParentFrame('BoolTest');
    ctx.plugin.clearCommands();

    await routeToolCall('set_visible', { nodeId: frameId, visible: false });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_visible');
    expect(cmd!.payload.visible).toBe(false);
    // Should be strictly false, not undefined/null/0
    // Strictly false, not a falsy stand-in
    expect(cmd!.payload.visible).toStrictEqual(false);
  });

  it('preserves explicit false for locked state', async () => {
    const frameId = await createParentFrame('LockFalse');
    ctx.plugin.clearCommands();

    await routeToolCall('set_locked', { nodeId: frameId, locked: false });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_locked');
    expect(cmd!.payload.locked).toBe(false);
  });
});

// ─── Hex Color String Integrity ──────────────────────────────────────────

describe('Data Integrity — hex color strings', () => {
  it('preserves hex color through RGB conversion in set_fills', async () => {
    const frameId = await createParentFrame('HexConversion');
    ctx.plugin.clearCommands();

    await routeToolCall('set_fills', {
      nodeId: frameId,
      color: '#AABBCC'
    });

    // set_fills converts hex to Figma's normalized RGB format (0-1 range)
    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_fills');
    const fills = cmd!.payload.fills as Array<{ color: { r: number; g: number; b: number } }>;
    // #AABBCC = RGB(170, 187, 204) → normalized to (170/255, 187/255, 204/255)
    expect(fills[0].color.r).toBeCloseTo(170 / 255, 5);
    expect(fills[0].color.g).toBeCloseTo(187 / 255, 5);
    expect(fills[0].color.b).toBeCloseTo(204 / 255, 5);
  });

  it('preserves lowercase hex colors', async () => {
    const frameId = await createParentFrame('LowerHex');
    ctx.plugin.clearCommands();

    await routeToolCall('set_stroke', {
      nodeId: frameId,
      strokeColor: '#aabbcc',
      strokeWeight: 1
    });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_stroke');
    expect(cmd!.payload.strokeColor).toBe('#aabbcc');
  });

  it('preserves hex color in gradient stops', async () => {
    const frameId = await createParentFrame('GradientHex');
    ctx.plugin.clearCommands();

    await routeToolCall('add_gradient_fill', {
      nodeId: frameId,
      type: 'LINEAR',
      stops: [
        { position: 0, color: '#FF00FF' },
        { position: 1, color: '#00FFFF' }
      ]
    });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'add_gradient_fill');
    const stops = cmd!.payload.stops as Array<Record<string, unknown>>;
    expect(stops[0].color).toBe('#FF00FF');
    expect(stops[1].color).toBe('#00FFFF');
  });
});

// ─── Array Ordering ──────────────────────────────────────────────────────

describe('Data Integrity — array ordering', () => {
  it('preserves gradient stop order', async () => {
    const frameId = await createParentFrame('StopOrder');
    ctx.plugin.clearCommands();

    await routeToolCall('add_gradient_fill', {
      nodeId: frameId,
      type: 'LINEAR',
      stops: [
        { position: 0, color: '#FF0000' },
        { position: 0.25, color: '#FFFF00' },
        { position: 0.5, color: '#00FF00' },
        { position: 0.75, color: '#00FFFF' },
        { position: 1, color: '#0000FF' }
      ]
    });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'add_gradient_fill');
    const stops = cmd!.payload.stops as Array<{ position: number; color: string }>;
    expect(stops).toHaveLength(5);
    expect(stops[0].position).toBe(0);
    expect(stops[1].position).toBe(0.25);
    expect(stops[2].position).toBe(0.5);
    expect(stops[3].position).toBe(0.75);
    expect(stops[4].position).toBe(1);
  });

  it('preserves effect array ordering', async () => {
    const frameId = await createParentFrame('EffectOrder');
    ctx.plugin.clearCommands();

    await routeToolCall('apply_effects', {
      nodeId: frameId,
      effects: [
        { type: 'DROP_SHADOW', color: '#000000', opacity: 0.1, x: 0, y: 2, blur: 4, spread: 0 },
        { type: 'DROP_SHADOW', color: '#000000', opacity: 0.2, x: 0, y: 8, blur: 16, spread: 0 },
        { type: 'LAYER_BLUR', radius: 4 }
      ]
    });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'apply_effects');
    const effects = cmd!.payload.effects as Array<Record<string, unknown>>;
    expect(effects).toHaveLength(3);
    expect(effects[0].type).toBe('DROP_SHADOW');
    expect(effects[0].blur).toBe(4);
    expect(effects[1].type).toBe('DROP_SHADOW');
    expect(effects[1].blur).toBe(16);
    expect(effects[2].type).toBe('LAYER_BLUR');
    expect(effects[2].radius).toBe(4);
  });

  it('preserves nodeIds array order in align_nodes', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      ids.push(await createParentFrame(`Order${i}`));
    }
    ctx.plugin.clearCommands();

    await routeToolCall('align_nodes', {
      nodeIds: ids,
      alignment: 'LEFT'
    });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'align_nodes');
    expect(cmd!.payload.nodeIds).toEqual(ids);
  });
});

// ─── Optional Field Behavior ─────────────────────────────────────────────

describe('Data Integrity — optional field behavior', () => {
  it('omits optional fields that are not provided', async () => {
    // create_frame with only name — no layoutMode, padding, etc.
    await routeToolCall('create_frame', { name: 'MinimalFrame' });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_frame');
    expect(cmd!.payload.name).toBe('MinimalFrame');
    // Optional fields should be undefined, not null or empty string
    expect(cmd!.payload.parentId).toBeUndefined();
  });

  it('includes optional fields when explicitly provided', async () => {
    await routeToolCall('create_frame', {
      name: 'FullFrame',
      width: 400,
      height: 300,
      layoutMode: 'HORIZONTAL',
      padding: 16,
      itemSpacing: 8,
      horizontalSizing: 'FILL',
      verticalSizing: 'HUG'
    });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_frame');
    expect(cmd!.payload.width).toBe(400);
    expect(cmd!.payload.height).toBe(300);
    expect(cmd!.payload.layoutMode).toBe('HORIZONTAL');
    expect(cmd!.payload.padding).toBe(16);
    expect(cmd!.payload.itemSpacing).toBe(8);
    expect(cmd!.payload.horizontalSizing).toBe('FILL');
    expect(cmd!.payload.verticalSizing).toBe('HUG');
  });
});

// ─── Node Registry Integrity ─────────────────────────────────────────────

describe('Data Integrity — registry tracks create_design nodes', () => {
  it('registry contains all nodes from a create_design batch', async () => {
    const result = await routeToolCall('create_design', {
      spec: {
        type: 'frame',
        name: 'RegistryCheck',
        children: [
          { type: 'text', name: 'A' },
          { type: 'text', name: 'B' },
          {
            type: 'frame',
            name: 'Inner',
            children: [{ type: 'text', name: 'C' }]
          }
        ]
      }
    });

    expect(result[0].text).toContain('Design Created Successfully');

    const registry = getNodeRegistry();
    const allNodes = registry.getAllNodes();
    // Should have at least 5 nodes: RegistryCheck, A, B, Inner, C
    expect(allNodes.length).toBeGreaterThanOrEqual(5);
  });

  it('getHierarchy returns correct tree after mixed operations', async () => {
    // Create root
    const rootResult = await routeToolCall('create_frame', {
      name: 'TreeRoot',
      layoutMode: 'VERTICAL',
      padding: 16,
      itemSpacing: 8
    });
    const rootId = extractId(rootResult[0].text!, /Frame ID:\s*(\S+)/);

    // Add two children
    await routeToolCall('create_frame', {
      name: 'Branch1',
      parentId: rootId,
      layoutMode: 'HORIZONTAL',
      padding: 8
    });
    await routeToolCall('create_frame', {
      name: 'Branch2',
      parentId: rootId,
      layoutMode: 'HORIZONTAL',
      padding: 8
    });

    // Also add a standalone root (no parent)
    await routeToolCall('create_frame', { name: 'StandaloneRoot' });

    const registry = getNodeRegistry();
    const hierarchy = registry.getHierarchy();

    // Should have 2 root-level entries: TreeRoot and StandaloneRoot
    expect(hierarchy).toHaveLength(2);

    // TreeRoot should have 2 children
    const treeRoot = hierarchy.find((n) => n.name === 'TreeRoot');
    expect(treeRoot!.children).toHaveLength(2);
  });
});

// ─── Cross-Tool Node ID Flow ─────────────────────────────────────────────

describe('Data Integrity — node IDs flow between tools', () => {
  it('frame ID from create_frame is accepted by set_fills', async () => {
    const result = await routeToolCall('create_frame', { name: 'IDFlow1' });
    const id = extractId(result[0].text!, /Frame ID:\s*(\S+)/);
    ctx.plugin.clearCommands();

    await routeToolCall('set_fills', { nodeId: id, color: '#000000' });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_fills');
    expect(cmd!.payload.nodeId).toBe(id);
  });

  it('text ID from create_text is accepted by set_text_properties', async () => {
    const parentId = await createParentFrame('IDFlowParent');
    const textResult = await routeToolCall('create_text', {
      content: 'Test',
      fontSize: 16,
      parentId
    });
    const textId = extractId(textResult[0].text!, /Text ID:\s*(\S+)/);
    ctx.plugin.clearCommands();

    await routeToolCall('set_text_properties', {
      nodeId: textId,
      decoration: 'UNDERLINE'
    });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_text_properties');
    expect(cmd!.payload.nodeId).toBe(textId);
  });

  it('ellipse ID from create_ellipse is accepted by set_transform', async () => {
    const result = await routeToolCall('create_ellipse', {
      name: 'IDFlowEllipse',
      width: 100,
      height: 100
    });
    const id = extractId(result[0].text!, /Ellipse ID:\s*(\S+)/);
    ctx.plugin.clearCommands();

    await routeToolCall('set_transform', {
      nodeId: id,
      position: { x: 200, y: 300 }
    });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_transform');
    expect(cmd!.payload.nodeId).toBe(id);
  });

  it('component ID from create_component flows through to create_instance', async () => {
    const frameId = await createParentFrame('CompFlow');
    const compResult = await routeToolCall('create_component', {
      frameId,
      name: 'FlowComp'
    });
    const compId = extractId(compResult[0].text!, /Component ID:\s*(\S+)/);
    ctx.plugin.clearCommands();

    const instResult = await routeToolCall('create_instance', {
      componentId: compId
    });
    expect(instResult[0].text).toContain(compId);

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_instance');
    expect(cmd!.payload.componentId).toBe(compId);
  });
});
