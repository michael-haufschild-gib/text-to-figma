/**
 * Layout Tools E2E Tests
 *
 * Tests layout management, alignment, distribution, layer ordering,
 * constraints, and grid tools through the full three-tier chain.
 *
 * Bug this catches:
 * - set_layout_sizing doesn't forward horizontal/vertical sizing modes
 * - set_layout_align doesn't forward axis alignment values
 * - align_nodes doesn't send all nodeIds in the array
 * - distribute_nodes sends wrong axis or spacing parameters
 * - connect_shapes doesn't send fromId/toId correctly
 * - set_layer_order sends wrong order value
 * - add_layout_grid doesn't forward grid configuration
 * - set_constraints doesn't forward constraint values
 * - Layout workflow: create frame → set layout → add children → align fails
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { routeToolCall } from '../../mcp-server/src/routing/tool-router.js';
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

// ─── set_layout_sizing ───────────────────────────────────────────────────

describe('Layout Tools E2E — set_layout_sizing', () => {
  it('sends horizontal and vertical sizing modes', async () => {
    const frameId = await createParentFrame('SizingFrame');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('set_layout_sizing', {
      nodeId: frameId,
      horizontal: 'FILL',
      vertical: 'HUG'
    });

    expect(result[0].text).toContain('Node ID:');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_layout_sizing');
    expect(cmd).toEqual(expect.objectContaining({ type: 'set_layout_sizing' }));
    expect(cmd!.payload.nodeId).toBe(frameId);
    expect(cmd!.payload.horizontal).toBe('FILL');
    expect(cmd!.payload.vertical).toBe('HUG');
  });

  it('sends only horizontal when vertical is omitted', async () => {
    const frameId = await createParentFrame('HorizOnly');
    ctx.plugin.clearCommands();

    await routeToolCall('set_layout_sizing', {
      nodeId: frameId,
      horizontal: 'FIXED'
    });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_layout_sizing');
    expect(cmd!.payload.horizontal).toBe('FIXED');
    expect(cmd!.payload.vertical).toBeUndefined();
  });
});

// ─── set_layout_align ────────────────────────────────────────────────────

describe('Layout Tools E2E — set_layout_align', () => {
  it('sends alignment values for both axes', async () => {
    const frameId = await createParentFrame('AlignFrame');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('set_layout_align', {
      nodeId: frameId,
      primaryAxis: 'CENTER',
      counterAxis: 'MAX'
    });

    expect(result[0].text).toContain('Node ID:');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_layout_align');
    expect(cmd).toEqual(expect.objectContaining({ type: 'set_layout_align' }));
    expect(cmd!.payload.nodeId).toBe(frameId);
    expect(cmd!.payload.primaryAxis).toBe('CENTER');
    expect(cmd!.payload.counterAxis).toBe('MAX');
  });
});

// ─── align_nodes ─────────────────────────────────────────────────────────

describe('Layout Tools E2E — align_nodes', () => {
  it('sends all nodeIds and alignment direction to the plugin', async () => {
    const f1 = await createParentFrame('Align1');
    const f2 = await createParentFrame('Align2');
    const f3 = await createParentFrame('Align3');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('align_nodes', {
      nodeIds: [f1, f2, f3],
      alignment: 'TOP'
    });

    expect(result[0].text).toContain('Aligned 3 nodes');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'align_nodes');
    expect(cmd).toEqual(expect.objectContaining({ type: 'align_nodes' }));
    expect(cmd!.payload.nodeIds).toEqual([f1, f2, f3]);
    expect(cmd!.payload.alignment).toBe('TOP');
  });

  it('supports all alignment directions', async () => {
    for (const alignment of ['TOP', 'BOTTOM', 'LEFT', 'RIGHT', 'CENTER_H', 'CENTER_V']) {
      resetPerTest(ctx);

      const f1 = await createParentFrame('A');
      const f2 = await createParentFrame('B');
      ctx.plugin.clearCommands();

      await routeToolCall('align_nodes', {
        nodeIds: [f1, f2],
        alignment
      });

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'align_nodes');
      expect(cmd!.payload.alignment).toBe(alignment);
    }
  });
});

// ─── distribute_nodes ────────────────────────────────────────────────────

describe('Layout Tools E2E — distribute_nodes', () => {
  it('sends nodeIds and axis to the plugin', async () => {
    const f1 = await createParentFrame('Dist1');
    const f2 = await createParentFrame('Dist2');
    const f3 = await createParentFrame('Dist3');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('distribute_nodes', {
      nodeIds: [f1, f2, f3],
      axis: 'HORIZONTAL'
    });

    expect(result[0].type).toBe('text');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'distribute_nodes');
    expect(cmd).toEqual(expect.objectContaining({ type: 'distribute_nodes' }));
    expect(cmd!.payload.nodeIds).toEqual([f1, f2, f3]);
    expect(cmd!.payload.axis).toBe('HORIZONTAL');
  });
});

// ─── connect_shapes ──────────────────────────────────────────────────────

describe('Layout Tools E2E — connect_shapes', () => {
  it('sends fromId and toId to the plugin', async () => {
    const f1 = await createParentFrame('ShapeA');
    const f2 = await createParentFrame('ShapeB');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('connect_shapes', {
      sourceNodeId: f1,
      targetNodeId: f2,
      sourceAnchor: 'RIGHT',
      targetAnchor: 'LEFT'
    });

    expect(result[0].type).toBe('text');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'connect_shapes');
    expect(cmd).toEqual(expect.objectContaining({ type: 'connect_shapes' }));
    expect(cmd!.payload.sourceNodeId).toBe(f1);
    expect(cmd!.payload.targetNodeId).toBe(f2);
    expect(cmd!.payload.sourceAnchor).toBe('RIGHT');
    expect(cmd!.payload.targetAnchor).toBe('LEFT');
  });
});

// ─── set_layer_order ─────────────────────────────────────────────────────

describe('Layout Tools E2E — set_layer_order', () => {
  it('sends nodeId and order direction', async () => {
    const frameId = await createParentFrame('LayerFrame');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('set_layer_order', {
      nodeId: frameId,
      action: 'BRING_TO_FRONT'
    });

    expect(result[0].type).toBe('text');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_layer_order');
    expect(cmd).toEqual(expect.objectContaining({ type: 'set_layer_order' }));
    expect(cmd!.payload.nodeId).toBe(frameId);
    expect(cmd!.payload.action).toBe('BRING_TO_FRONT');
  });

  it('supports SEND_TO_BACK action', async () => {
    const frameId = await createParentFrame('BackFrame');
    ctx.plugin.clearCommands();

    await routeToolCall('set_layer_order', {
      nodeId: frameId,
      action: 'SEND_TO_BACK'
    });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_layer_order');
    expect(cmd!.payload.action).toBe('SEND_TO_BACK');
  });
});

// ─── add_layout_grid ─────────────────────────────────────────────────────

describe('Layout Tools E2E — add_layout_grid', () => {
  it('sends grid configuration to the plugin', async () => {
    const frameId = await createParentFrame('GridFrame');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('add_layout_grid', {
      nodeId: frameId,
      pattern: 'COLUMNS',
      count: 12,
      gutter: 16,
      margin: 24
    });

    expect(result[0].text).toContain('Node ID:');
    expect(result[0].text).toContain('Pattern:');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'add_layout_grid');
    expect(cmd).toEqual(expect.objectContaining({ type: 'add_layout_grid' }));
    expect(cmd!.payload.nodeId).toBe(frameId);
    expect(cmd!.payload.pattern).toBe('COLUMNS');
    expect(cmd!.payload.count).toBe(12);
    expect(cmd!.payload.gutter).toBe(16);
    expect(cmd!.payload.margin).toBe(24);
  });

  it('sends ROWS pattern', async () => {
    const frameId = await createParentFrame('RowGrid');
    ctx.plugin.clearCommands();

    await routeToolCall('add_layout_grid', {
      nodeId: frameId,
      pattern: 'ROWS',
      count: 4,
      gutter: 8,
      margin: 16
    });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'add_layout_grid');
    expect(cmd!.payload.pattern).toBe('ROWS');
    expect(cmd!.payload.count).toBe(4);
  });
});

// ─── set_constraints ─────────────────────────────────────────────────────

describe('Layout Tools E2E — set_constraints', () => {
  it('sends constraint values to the plugin', async () => {
    const frameId = await createParentFrame('ConstrainedFrame');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('set_constraints', {
      nodeId: frameId,
      horizontal: 'STRETCH',
      vertical: 'CENTER'
    });

    expect(result[0].text).toContain('Constraints Applied');
    expect(result[0].text).toContain('Node ID:');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_constraints');
    expect(cmd).toEqual(expect.objectContaining({ type: 'set_constraints' }));
    expect(cmd!.payload.nodeId).toBe(frameId);
    // The tool nests horizontal/vertical under a `constraints` object
    const constraints = cmd!.payload.constraints as Record<string, string>;
    expect(constraints.horizontal).toBe('STRETCH');
    expect(constraints.vertical).toBe('CENTER');
  });
});

// ─── Full Layout Workflow ────────────────────────────────────────────────

describe('Layout Tools E2E — multi-step layout workflow', () => {
  it('create container → set layout → add grid → create children → align → set constraints', async () => {
    // Step 1: Container frame
    const containerId = await createParentFrame('LayoutContainer');

    // Step 2: Configure layout
    await routeToolCall('set_layout_properties', {
      nodeId: containerId,
      layoutMode: 'VERTICAL',
      itemSpacing: 16,
      padding: 24
    });

    // Step 3: Add layout grid
    await routeToolCall('add_layout_grid', {
      nodeId: containerId,
      pattern: 'COLUMNS',
      count: 4,
      gutter: 16,
      margin: 16
    });

    // Step 4: Create child frames
    const child1Result = await routeToolCall('create_frame', {
      name: 'Col1',
      parentId: containerId,
      layoutMode: 'VERTICAL',
      padding: 8
    });
    const child1Id = extractId(child1Result[0].text!, /Frame ID:\s*(\S+)/);

    const child2Result = await routeToolCall('create_frame', {
      name: 'Col2',
      parentId: containerId,
      layoutMode: 'VERTICAL',
      padding: 8
    });
    const child2Id = extractId(child2Result[0].text!, /Frame ID:\s*(\S+)/);

    // Step 5: Set sizing on children
    await routeToolCall('set_layout_sizing', {
      nodeId: child1Id,
      horizontal: 'FILL'
    });

    await routeToolCall('set_layout_sizing', {
      nodeId: child2Id,
      horizontal: 'FILL'
    });

    // Step 6: Set constraints
    await routeToolCall('set_constraints', {
      nodeId: child1Id,
      horizontal: 'STRETCH'
    });

    ctx.plugin.clearCommands();

    // Step 7: Align children
    await routeToolCall('align_nodes', {
      nodeIds: [child1Id, child2Id],
      alignment: 'TOP'
    });

    // Verify the align command used the correct IDs from earlier steps
    const alignCmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'align_nodes');
    expect(alignCmd!.payload.nodeIds).toEqual([child1Id, child2Id]);
  });
});
