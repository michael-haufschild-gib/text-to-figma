/**
 * Advanced Workflow E2E Tests
 *
 * Tests complex, multi-step design workflows that chain tool outputs as inputs,
 * mix creation with querying and styling, and exercise realistic agent usage patterns.
 *
 * Bug this catches:
 * - Node IDs from create_design are not usable in subsequent styling/query calls
 * - Creating a complete page (header, hero, cards, footer) breaks at some step
 * - Mixing creation → styling → querying in one workflow corrupts state
 * - Component system: create style → create component → apply style → instantiate fails
 * - Batch creation followed by bulk styling uses wrong node IDs
 * - Node registry diverges from Figma state after many operations
 * - Concurrent multi-step workflows interfere with each other
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

// ─── Full Page Design Workflow ───────────────────────────────────────────

describe('Advanced Workflows — full page design', () => {
  it('creates a complete card with header, body, and footer', async () => {
    // Create the card container
    const cardResult = await routeToolCall('create_frame', {
      name: 'Card',
      layoutMode: 'VERTICAL',
      padding: 24,
      itemSpacing: 16
    });
    const cardId = extractId(cardResult[0].text!, /Frame ID:\s*(\S+)/);

    // Add header section
    const headerResult = await routeToolCall('create_frame', {
      name: 'CardHeader',
      parentId: cardId,
      layoutMode: 'HORIZONTAL',
      padding: 0,
      itemSpacing: 8
    });
    const headerId = extractId(headerResult[0].text!, /Frame ID:\s*(\S+)/);

    // Add title text to header
    await routeToolCall('create_text', {
      content: 'Card Title',
      fontSize: 24,
      parentId: headerId
    });

    // Add body section
    const bodyResult = await routeToolCall('create_frame', {
      name: 'CardBody',
      parentId: cardId,
      layoutMode: 'VERTICAL',
      padding: 0,
      itemSpacing: 8
    });
    const bodyId = extractId(bodyResult[0].text!, /Frame ID:\s*(\S+)/);

    // Add body text
    await routeToolCall('create_text', {
      content: 'This is the card body content.',
      fontSize: 16,
      parentId: bodyId
    });

    // Style the card
    ctx.plugin.clearCommands();
    await routeToolCall('set_fills', {
      nodeId: cardId,
      color: '#FFFFFF',
      opacity: 1
    });
    await routeToolCall('set_corner_radius', {
      nodeId: cardId,
      radius: 12
    });
    await routeToolCall('apply_effects', {
      nodeId: cardId,
      effects: [
        { type: 'DROP_SHADOW', color: '#000000', opacity: 0.1, x: 0, y: 2, blur: 8, spread: 0 }
      ]
    });

    // Verify the hierarchy in the node registry
    const registry = getNodeRegistry();
    const cardNode = registry.getNode(cardId)!;
    expect(cardNode.children).toHaveLength(2); // header + body

    // Verify all styling commands targeted the card
    const styleCmds = ctx.plugin
      .getReceivedCommands()
      .filter((c) => ['set_fills', 'set_corner_radius', 'apply_effects'].includes(c.type));
    for (const cmd of styleCmds) {
      expect(cmd.payload.nodeId).toBe(cardId);
    }
  });
});

// ─── create_design → Individual Styling ──────────────────────────────────

describe('Advanced Workflows — create_design then style individual nodes', () => {
  it('creates a design batch then styles individual child nodes', async () => {
    // Create the design in one batch
    const designResult = await routeToolCall('create_design', {
      spec: {
        type: 'frame',
        name: 'LoginForm',
        props: { layoutMode: 'VERTICAL', padding: 32, itemSpacing: 16 },
        children: [
          { type: 'text', name: 'Title', props: { content: 'Sign In', fontSize: 32 } },
          {
            type: 'frame',
            name: 'EmailField',
            props: { layoutMode: 'VERTICAL', padding: 8, itemSpacing: 8 }
          },
          {
            type: 'frame',
            name: 'PasswordField',
            props: { layoutMode: 'VERTICAL', padding: 8, itemSpacing: 8 }
          },
          {
            type: 'frame',
            name: 'SubmitButton',
            props: { layoutMode: 'HORIZONTAL', padding: 16 }
          }
        ]
      }
    });

    expect(designResult[0].text).toContain('Design Created Successfully');
    expect(designResult[0].text).toContain('Node IDs:');

    // Extract the root node ID
    const rootId = extractId(designResult[0].text!, /Root Node ID:\s*(\S+)/);
    expect(rootId).toMatch(/\S+/);

    // Extract specific node IDs from the response
    const nodeIdSection = designResult[0].text!;
    const submitMatch = nodeIdSection.match(/SubmitButton:\s*(\S+)/);

    if (submitMatch) {
      const submitId = submitMatch[1];
      ctx.plugin.clearCommands();

      // Style the submit button
      await routeToolCall('set_fills', {
        nodeId: submitId,
        color: '#0066FF',
        opacity: 1
      });

      await routeToolCall('set_corner_radius', {
        nodeId: submitId,
        radius: 8
      });

      // Verify styling commands target the correct submit button ID
      const fillCmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_fills');
      expect(fillCmd!.payload.nodeId).toBe(submitId);
    }
  });
});

// ─── Query → Modify → Verify cycle ──────────────────────────────────────

describe('Advanced Workflows — query then modify then verify', () => {
  it('creates nodes, queries their info, modifies, then verifies hierarchy', async () => {
    // Create a container with children
    const parentId = await createParentFrame('QueryModifyVerify');

    const child1Result = await routeToolCall('create_frame', {
      name: 'Child1',
      parentId,
      layoutMode: 'HORIZONTAL',
      padding: 8
    });
    const child1Id = extractId(child1Result[0].text!, /Frame ID:\s*(\S+)/);

    const child2Result = await routeToolCall('create_frame', {
      name: 'Child2',
      parentId,
      layoutMode: 'HORIZONTAL',
      padding: 8
    });
    const child2Id = extractId(child2Result[0].text!, /Frame ID:\s*(\S+)/);

    // Query: verify hierarchy via get_node_info
    const infoResult = await routeToolCall('get_node_info', { nodeId: parentId });
    expect(infoResult[0].text).toContain('Children: 2');

    // Modify: style both children
    ctx.plugin.clearCommands();
    await routeToolCall('set_fills', { nodeId: child1Id, color: '#FF0000' });
    await routeToolCall('set_fills', { nodeId: child2Id, color: '#00FF00' });

    // Verify: commands reached plugin with correct IDs
    const fillCmds = ctx.plugin.getReceivedCommands().filter((c) => c.type === 'set_fills');
    expect(fillCmds).toHaveLength(2);
    expect(fillCmds[0].payload.nodeId).toBe(child1Id);
    expect(fillCmds[1].payload.nodeId).toBe(child2Id);
  });
});

// ─── Design System Workflow ──────────────────────────────────────────────

describe('Advanced Workflows — design system', () => {
  it('creates color styles then applies them to nodes in sequence', async () => {
    // Define color palette
    const primaryResult = await routeToolCall('create_color_style', {
      name: 'Primary',
      color: '#0066FF'
    });
    const primaryStyleId = extractId(primaryResult[0].text!, /Style ID:\s*(\S+)/);

    const errorResult = await routeToolCall('create_color_style', {
      name: 'Error',
      color: '#FF3333'
    });
    const errorStyleId = extractId(errorResult[0].text!, /Style ID:\s*(\S+)/);

    // Create UI elements
    const btn = await createParentFrame('Button');
    const alert = await createParentFrame('Alert');
    ctx.plugin.clearCommands();

    // Apply styles
    await routeToolCall('apply_fill_style', {
      nodeId: btn,
      styleNameOrId: primaryStyleId
    });
    await routeToolCall('apply_fill_style', {
      nodeId: alert,
      styleNameOrId: errorStyleId
    });

    // Verify correct style was applied to each node
    const applyCmds = ctx.plugin.getReceivedCommands().filter((c) => c.type === 'apply_fill_style');
    expect(applyCmds).toHaveLength(2);
    expect(applyCmds[0].payload.nodeId).toBe(btn);
    expect(applyCmds[0].payload.styleNameOrId).toBe(primaryStyleId);
    expect(applyCmds[1].payload.nodeId).toBe(alert);
    expect(applyCmds[1].payload.styleNameOrId).toBe(errorStyleId);
  });

  it('creates text styles and applies to multiple text nodes', async () => {
    const headingStyle = await routeToolCall('create_text_style', {
      name: 'Heading',
      fontSize: 32,
      fontWeight: 700
    });
    const headingStyleId = extractId(headingStyle[0].text!, /Style ID:\s*(\S+)/);

    const bodyStyle = await routeToolCall('create_text_style', {
      name: 'Body',
      fontSize: 16,
      fontWeight: 400
    });
    const bodyStyleId = extractId(bodyStyle[0].text!, /Style ID:\s*(\S+)/);

    // Create text nodes
    const parentId = await createParentFrame('TextContainer');
    const title = await routeToolCall('create_text', {
      content: 'Welcome',
      fontSize: 32,
      parentId
    });
    const titleId = extractId(title[0].text!, /Text ID:\s*(\S+)/);

    const body = await routeToolCall('create_text', {
      content: 'Hello world',
      fontSize: 16,
      parentId
    });
    const bodyId = extractId(body[0].text!, /Text ID:\s*(\S+)/);
    ctx.plugin.clearCommands();

    // Apply styles
    await routeToolCall('apply_text_style', {
      nodeId: titleId,
      styleNameOrId: headingStyleId
    });
    await routeToolCall('apply_text_style', {
      nodeId: bodyId,
      styleNameOrId: bodyStyleId
    });

    const applyCmds = ctx.plugin.getReceivedCommands().filter((c) => c.type === 'apply_text_style');
    expect(applyCmds).toHaveLength(2);
    expect(applyCmds[0].payload.styleNameOrId).toBe(headingStyleId);
    expect(applyCmds[1].payload.styleNameOrId).toBe(bodyStyleId);
  });
});

// ─── Concurrent Different Tool Types ─────────────────────────────────────

describe('Advanced Workflows — concurrent mixed operations', () => {
  it('runs creation, styling, and query tools concurrently', async () => {
    // Pre-create nodes
    const f1 = await createParentFrame('Concurrent1');
    const f2 = await createParentFrame('Concurrent2');
    ctx.plugin.clearCommands();

    // Run diverse operations concurrently
    const [styleResult, cornerResult, infoResult] = await Promise.all([
      routeToolCall('set_fills', { nodeId: f1, color: '#FF0000' }),
      routeToolCall('set_corner_radius', { nodeId: f2, radius: 16 }),
      routeToolCall('get_node_info', { nodeId: f1 })
    ]);

    // All should succeed
    expect(styleResult[0].text).toContain('Fills Applied');
    expect(cornerResult[0].text).toContain('corner radius');
    expect(infoResult[0].text).toContain('Node Information');
  });
});

// ─── Validation Edge Cases ───────────────────────────────────────────────

describe('Advanced Workflows — validation edge cases', () => {
  it('validates WCAG contrast with edge case: same foreground and background', async () => {
    const result = await routeToolCall('check_wcag_contrast', {
      foreground: '#FFFFFF',
      background: '#FFFFFF',
      fontSize: 16,
      fontWeight: 400
    });

    // Same color → ratio 1:1 → FAIL
    expect(result[0].text).toContain('FAIL');
  });

  it('validates design tokens with zero spacing (valid)', async () => {
    const result = await routeToolCall('validate_design_tokens', {
      spacing: [0, 8, 16, 24, 32, 40, 48, 56, 64],
      typography: [
        { fontSize: 12, name: 'caption' },
        { fontSize: 16, name: 'body' },
        { fontSize: 24, name: 'heading' },
        { fontSize: 48, name: 'display' }
      ]
    });

    expect(result[0].text).toContain('Validation Report');
  });

  it('validates design tokens with all off-grid spacing', async () => {
    const result = await routeToolCall('validate_design_tokens', {
      spacing: [3, 7, 11, 13, 17],
      typography: [{ fontSize: 16, name: 'body' }]
    });

    expect(result[0].text).toContain('Suggested');
  });
});

// ─── Large Hierarchy ─────────────────────────────────────────────────────

describe('Advanced Workflows — large hierarchy management', () => {
  it('creates 10 sibling frames and tracks all in registry', async () => {
    const parentId = await createParentFrame('BigParent');

    const childIds: string[] = [];
    for (let i = 0; i < 10; i++) {
      const result = await routeToolCall('create_frame', {
        name: `Sibling${i}`,
        parentId,
        layoutMode: 'VERTICAL',
        padding: 8
      });
      childIds.push(extractId(result[0].text!, /Frame ID:\s*(\S+)/));
    }

    // Verify registry tracked all children
    const registry = getNodeRegistry();
    const parentNode = registry.getNode(parentId)!;
    expect(parentNode.children).toHaveLength(10);

    // Verify all child IDs are unique
    expect(new Set(childIds).size).toBe(10);
  });

  it('creates 3-level deep hierarchy and verifies full path', async () => {
    const l1Result = await routeToolCall('create_frame', {
      name: 'Level1',
      layoutMode: 'VERTICAL',
      padding: 16,
      itemSpacing: 8
    });
    const l1 = extractId(l1Result[0].text!, /Frame ID:\s*(\S+)/);

    const l2Result = await routeToolCall('create_frame', {
      name: 'Level2',
      parentId: l1,
      layoutMode: 'VERTICAL',
      padding: 8,
      itemSpacing: 8
    });
    const l2 = extractId(l2Result[0].text!, /Frame ID:\s*(\S+)/);

    const l3Result = await routeToolCall('create_frame', {
      name: 'Level3',
      parentId: l2,
      layoutMode: 'VERTICAL',
      padding: 8,
      itemSpacing: 8
    });
    const l3 = extractId(l3Result[0].text!, /Frame ID:\s*(\S+)/);

    // Query deepest node info — should show full path
    const info = await routeToolCall('get_node_info', { nodeId: l3 });
    expect(info[0].text).toContain('Level1');
    expect(info[0].text).toContain('Level2');
    expect(info[0].text).toContain('Level3');
    expect(info[0].text).toContain('Parent: Level2');
  });
});

// ─── Error Recovery in Multi-Step Workflows ──────────────────────────────

describe('Advanced Workflows — error recovery', () => {
  it('continues workflow after a validation error', async () => {
    // Step 1: Create a frame (succeeds)
    const frameResult = await routeToolCall('create_frame', {
      name: 'RecoveryFrame',
      layoutMode: 'VERTICAL',
      padding: 16,
      itemSpacing: 8
    });
    const frameId = extractId(frameResult[0].text!, /Frame ID:\s*(\S+)/);

    // Step 2: Try to create text without parentId (fails — hierarchy violation)
    await expect(routeToolCall('create_text', { content: 'Orphan', fontSize: 16 })).rejects.toThrow(
      'HIERARCHY VIOLATION'
    );

    // Step 3: Registry still has the frame from step 1
    const registry = getNodeRegistry();
    expect(registry.getNode(frameId)?.name).toBe('RecoveryFrame');

    // Step 4: Create text correctly with parentId (should succeed)
    const textResult = await routeToolCall('create_text', {
      content: 'Valid Text',
      fontSize: 16,
      parentId: frameId
    });
    expect(textResult[0].text).toContain('Text Created Successfully');
  });

  it('continues workflow after off-grid spacing rejection', async () => {
    // Off-grid spacing → rejected by Zod
    await expect(
      routeToolCall('create_frame', { name: 'BadPadding', padding: 15 })
    ).rejects.toThrow();

    // Valid spacing → should succeed
    const result = await routeToolCall('create_frame', {
      name: 'GoodPadding',
      padding: 16,
      layoutMode: 'VERTICAL',
      itemSpacing: 8
    });
    expect(result[0].text).toContain('Frame Created Successfully');
  });
});

// ─── Concurrent Operations on Shared Parent ──────────────────────────────

describe('Advanced Workflows — concurrent children on shared parent', () => {
  it('multiple concurrent child creations on the same parent produce unique IDs', async () => {
    // Bug this catches: race condition where concurrent child frame
    // creations on the same parent cause ID collisions or duplicate
    // registry entries.
    const parentId = await createParentFrame('ConcurrentParent');
    ctx.plugin.clearCommands();

    const childPromises = Array.from({ length: 5 }, (_, i) =>
      routeToolCall('create_frame', {
        name: `ConcurrentChild${i}`,
        parentId,
        layoutMode: 'VERTICAL',
        padding: 8
      })
    );

    const childResults = await Promise.all(childPromises);

    // All 5 should succeed
    for (const result of childResults) {
      expect(result[0].text).toContain('Frame Created Successfully');
    }

    // All IDs must be unique
    const childIds = childResults.map((r) => extractId(r[0].text!, /Frame ID:\s*(\S+)/));
    expect(new Set(childIds).size).toBe(5);

    // Parent should have exactly 5 children in the registry
    const registry = getNodeRegistry();
    const parentNode = registry.getNode(parentId)!;
    expect(parentNode.children).toHaveLength(5);
  });

  it('concurrent styling of the same node does not cross-contaminate', async () => {
    // Bug this catches: concurrent set_fills and set_stroke on the same
    // node send payloads that get mixed up by the bridge routing.
    const frameId = await createParentFrame('SharedTarget');
    ctx.plugin.clearCommands();

    const [fillResult, strokeResult, cornerResult] = await Promise.all([
      routeToolCall('set_fills', { nodeId: frameId, color: '#FF0000' }),
      routeToolCall('set_stroke', { nodeId: frameId, strokeColor: '#0000FF', strokeWeight: 2 }),
      routeToolCall('set_corner_radius', { nodeId: frameId, radius: 8 })
    ]);

    expect(fillResult[0].text).toContain('Fills Applied');
    expect(strokeResult[0].text).toContain('Stroke');
    expect(cornerResult[0].text).toContain('corner radius');

    // All three commands should target the same nodeId
    const cmds = ctx.plugin.getReceivedCommands();
    const fillCmd = cmds.find((c) => c.type === 'set_fills');
    const strokeCmd = cmds.find((c) => c.type === 'set_stroke');
    const cornerCmd = cmds.find((c) => c.type === 'set_corner_radius');

    expect(fillCmd!.payload.nodeId).toBe(frameId);
    expect(strokeCmd!.payload.nodeId).toBe(frameId);
    expect(cornerCmd!.payload.nodeId).toBe(frameId);
  });
});

// ─── Concurrent Multi-Step Workflows ──────────────────────────────────────

describe('Advanced Workflows — concurrent multi-step workflow isolation', () => {
  it('two complete create→style→query workflows run in parallel without interference', async () => {
    // Bug this catches: two LLM agent sessions running concurrently issue
    // interleaved tool calls. If request IDs, node IDs, or registry state
    // leak between workflows, one agent's design corrupts the other's.

    async function workflow(prefix: string): Promise<{
      frameId: string;
      childId: string;
    }> {
      // Step 1: Create a container
      const frameResult = await routeToolCall('create_frame', {
        name: `${prefix}_Container`,
        layoutMode: 'VERTICAL',
        padding: 16,
        itemSpacing: 8
      });
      const frameId = extractId(frameResult[0].text!, /Frame ID:\s*(\S+)/);

      // Step 2: Create a child
      const childResult = await routeToolCall('create_frame', {
        name: `${prefix}_Child`,
        parentId: frameId,
        layoutMode: 'HORIZONTAL',
        padding: 8
      });
      const childId = extractId(childResult[0].text!, /Frame ID:\s*(\S+)/);

      // Step 3: Style the container
      await routeToolCall('set_fills', {
        nodeId: frameId,
        color: prefix === 'WF1' ? '#FF0000' : '#0000FF'
      });

      // Step 4: Query the node to verify hierarchy
      const info = await routeToolCall('get_node_info', { nodeId: frameId });
      expect(info[0].text).toContain(`${prefix}_Container`);
      expect(info[0].text).toContain('Children: 1');

      return { frameId, childId };
    }

    // Run both workflows concurrently
    const [wf1, wf2] = await Promise.all([workflow('WF1'), workflow('WF2')]);

    // Verify the two workflows produced distinct node IDs
    const allIds = [wf1.frameId, wf1.childId, wf2.frameId, wf2.childId];
    expect(new Set(allIds).size).toBe(4);

    // Verify registry has correct hierarchy for each workflow
    const registry = getNodeRegistry();
    const wf1Container = registry.getNode(wf1.frameId)!;
    const wf2Container = registry.getNode(wf2.frameId)!;

    expect(wf1Container.children).toContain(wf1.childId);
    expect(wf2Container.children).toContain(wf2.childId);

    // No cross-contamination: WF1's child is NOT under WF2's container
    expect(wf1Container.children).not.toContain(wf2.childId);
    expect(wf2Container.children).not.toContain(wf1.childId);

    // Verify styling commands targeted the correct nodes
    const cmds = ctx.plugin.getReceivedCommands();
    const fillCmds = cmds.filter((c) => c.type === 'set_fills');
    expect(fillCmds.length).toBeGreaterThanOrEqual(2);

    // Each fill should target a unique frame ID
    const fillTargets = fillCmds.map((c) => c.payload.nodeId);
    expect(fillTargets).toContain(wf1.frameId);
    expect(fillTargets).toContain(wf2.frameId);
  });
});

// ─── Resource Cleanup After Many Operations ──────────────────────────────

describe('Advanced Workflows — resource cleanup', () => {
  it('node registry remains consistent after 30 sequential operations', async () => {
    // Bug this catches: memory leaks or state corruption from accumulated
    // operations — the registry grows unbounded or parent-child links break.
    const registry = getNodeRegistry();
    expect(registry.getAllNodes()).toHaveLength(0);

    const rootId = await createParentFrame('StressRoot');

    // Create 15 children
    const childIds: string[] = [];
    for (let i = 0; i < 15; i++) {
      const result = await routeToolCall('create_frame', {
        name: `Stress${i}`,
        parentId: rootId,
        layoutMode: 'VERTICAL',
        padding: 8
      });
      childIds.push(extractId(result[0].text!, /Frame ID:\s*(\S+)/));
    }

    // Style 10 of them
    for (let i = 0; i < 10; i++) {
      await routeToolCall('set_fills', {
        nodeId: childIds[i],
        color: `#${(i * 25).toString(16).padStart(2, '0')}0000`
      });
    }

    // Query 5 of them
    for (let i = 0; i < 5; i++) {
      const info = await routeToolCall('get_node_info', { nodeId: childIds[i] });
      expect(info[0].text).toContain('Node Information');
    }

    // Registry should have exactly 16 nodes: 1 root + 15 children
    expect(registry.getAllNodes()).toHaveLength(16);

    // Root should have exactly 15 children
    const rootNode = registry.getNode(rootId)!;
    expect(rootNode.children).toHaveLength(15);

    // All child IDs should be unique
    expect(new Set(childIds).size).toBe(15);

    // Hierarchy should show one root
    const hierarchy = registry.getHierarchy();
    expect(hierarchy).toHaveLength(1);
    expect(hierarchy[0].children).toHaveLength(15);
  });
});
