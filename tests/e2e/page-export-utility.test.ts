/**
 * Page Management, Export, and Utility Tools E2E Tests
 *
 * Tests page creation/navigation, node export, export settings,
 * create_path, edit_path, batch_create_path, group_nodes, and
 * create_rectangle_with_image_fill through the full chain.
 *
 * Bug this catches:
 * - create_page doesn't forward page name correctly
 * - set_current_page doesn't send pageId/name to plugin
 * - list_pages response not parsed correctly
 * - export_node doesn't forward format/scale parameters
 * - set_export_settings doesn't send settings array
 * - create_path/edit_path command data or SVG path not forwarded
 * - batch_create_path response parsing or payload normalization breaks
 * - group_nodes does not preserve nodeIds/parentId through the bridge
 * - create_rectangle_with_image_fill doesn't send imageUrl
 * - Page workflow: create → switch → verify sequence breaks
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

// ─── create_page ─────────────────────────────────────────────────────────

describe('Page Tools E2E — create_page', () => {
  it('creates a page and returns pageId', async () => {
    const result = await routeToolCall('create_page', {
      name: 'Design V2'
    });

    expect(result[0].text).toContain('Page ID:');
    expect(result[0].text).toContain('Name: Design V2');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_page');
    expect(cmd).toEqual(expect.objectContaining({ type: 'create_page' }));
    expect(cmd!.payload.name).toBe('Design V2');
  });
});

// ─── set_current_page ────────────────────────────────────────────────────

describe('Page Tools E2E — set_current_page', () => {
  it('switches to a page by ID', async () => {
    const result = await routeToolCall('set_current_page', {
      pageId: 'page-2'
    });

    expect(result[0].text).toContain('Page ID:');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_current_page');
    expect(cmd).toEqual(expect.objectContaining({ type: 'set_current_page' }));
    expect(cmd!.payload.pageId).toBe('page-2');
  });
});

// ─── Page workflow ───────────────────────────────────────────────────────

describe('Page Tools E2E — page management workflow', () => {
  it('create page → switch to page → list pages shows new page', async () => {
    // Step 1: Create a page
    const createResult = await routeToolCall('create_page', { name: 'Mobile Designs' });
    expect(createResult[0].text).toContain('Mobile Designs');
    const pageId = extractId(createResult[0].text!, /Page ID:\s*(\S+)/);

    ctx.plugin.clearCommands();

    // Step 2: Switch to that page
    await routeToolCall('set_current_page', { pageId });

    const switchCmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_current_page');
    expect(switchCmd!.payload.pageId).toBe(pageId);

    ctx.plugin.clearCommands();

    // Step 3: List pages
    const listResult = await routeToolCall('list_pages', {});
    expect(listResult[0].text).toContain('Pages:');

    const listCmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'list_pages');
    expect(listCmd).toEqual(expect.objectContaining({ type: 'list_pages' }));
  });
});

// ─── export_node ─────────────────────────────────────────────────────────

describe('Export Tools E2E — export_node', () => {
  it('exports a node as PNG', async () => {
    const frameId = await createParentFrame('ExportTarget');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('export_node', {
      nodeId: frameId,
      format: 'PNG',
      scale: 2
    });

    expect(result[0].text).toContain('Node ID:');
    expect(result[0].text).toContain('Format: PNG');
    expect(result[0].text).toContain('Scale: 2x');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'export_node');
    expect(cmd).toEqual(expect.objectContaining({ type: 'export_node' }));
    expect(cmd!.payload.nodeId).toBe(frameId);
    expect(cmd!.payload.format).toBe('PNG');
    expect(cmd!.payload.scale).toBe(2);
  });

  it('exports as SVG format', async () => {
    const frameId = await createParentFrame('SVGExport');
    ctx.plugin.clearCommands();

    await routeToolCall('export_node', {
      nodeId: frameId,
      format: 'SVG'
    });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'export_node');
    expect(cmd!.payload.format).toBe('SVG');
  });
});

// ─── set_export_settings ─────────────────────────────────────────────────

describe('Export Tools E2E — set_export_settings', () => {
  it('configures export settings on a node', async () => {
    const frameId = await createParentFrame('ExportSettings');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('set_export_settings', {
      nodeId: frameId,
      settings: [
        { format: 'PNG', suffix: '@2x', constraint: { type: 'SCALE', value: 2 } },
        { format: 'SVG', suffix: '' }
      ]
    });

    expect(result[0].text).toContain('Node ID:');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_export_settings');
    expect(cmd).toEqual(expect.objectContaining({ type: 'set_export_settings' }));
    expect(cmd!.payload.nodeId).toBe(frameId);
    expect((cmd!.payload.settings as unknown[]).length).toBe(2);
  });
});

// ─── create_path ─────────────────────────────────────────────────────────

describe('Utility Tools E2E — create_path', () => {
  it('creates a vector path from path commands', async () => {
    const result = await routeToolCall('create_path', {
      name: 'Triangle',
      commands: [
        { type: 'M', x: 50, y: 0 },
        { type: 'L', x: 100, y: 100 },
        { type: 'L', x: 0, y: 100 },
        { type: 'Z' }
      ]
    });

    expect(result[0].type).toBe('text');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_path');
    expect(cmd).toEqual(expect.objectContaining({ type: 'create_path' }));
    expect(cmd!.payload.name).toBe('Triangle');
  });

  it('creates a path with cubic bezier curves', async () => {
    const result = await routeToolCall('create_path', {
      name: 'Curve',
      commands: [
        { type: 'M', x: 0, y: 100 },
        { type: 'C', x1: 0, y1: 0, x2: 100, y2: 0, x: 100, y: 100 },
        { type: 'Z' }
      ]
    });

    expect(result[0].type).toBe('text');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_path');
    expect(cmd!.payload.name).toBe('Curve');
  });

  it('exposes pathId so edit_path can chain from create_path', async () => {
    const created = await routeToolCall('create_path', {
      name: 'EditablePath',
      svgPath: 'M 0 0 L 10 10'
    });
    const pathId = extractId(created[0].text!, /Path ID:\s*(\S+)/);
    ctx.plugin.clearCommands();

    const result = await routeToolCall('edit_path', {
      nodeId: pathId,
      svgPath: '  M 0 0 L 20 20 Z  ',
      windingRule: 'EVENODD'
    });

    expect(result[0].text).toContain(`Node ID: ${pathId}`);
    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'edit_path');
    expect(cmd).toEqual(expect.objectContaining({ type: 'edit_path' }));
    expect(cmd!.payload.nodeId).toBe(pathId);
    expect(cmd!.payload.svgPath).toBe('M 0 0 L 20 20 Z');
    expect(cmd!.payload.windingRule).toBe('EVENODD');
  });

  it('forwards edit_path payload using trimmed SVG path data for a known vector id', async () => {
    const result = await routeToolCall('edit_path', {
      nodeId: 'path-existing',
      svgPath: '  M 0 0 L 20 20 Z  ',
      windingRule: 'EVENODD'
    });

    expect(result[0].text).toContain('Node ID: path-existing');
    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'edit_path');
    expect(cmd).toEqual(expect.objectContaining({ type: 'edit_path' }));
    expect(cmd!.payload.nodeId).toBe('path-existing');
    expect(cmd!.payload.svgPath).toBe('M 0 0 L 20 20 Z');
    expect(cmd!.payload.windingRule).toBe('EVENODD');
  });

  it('creates a batch of paths in one bridge round trip', async () => {
    const parentId = await createParentFrame('BatchPathParent');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('batch_create_path', {
      parentId,
      paths: [
        { name: 'Body', svgPath: ' M 0 0 L 100 0 Z ', fillColor: '#8B4513' },
        {
          name: 'Tail',
          commands: [
            { type: 'M', x: 100, y: 0 },
            { type: 'L', x: 130, y: 20 }
          ],
          strokeColor: '#000000',
          strokeWeight: 2
        }
      ]
    });

    expect(result[0].text).toContain('Batch created 2 path(s)');
    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'batch_create_path');
    expect(cmd).toEqual(expect.objectContaining({ type: 'batch_create_path' }));
    expect(cmd!.payload.parentId).toBe(parentId);
    expect((cmd!.payload.paths as Array<Record<string, unknown>>)[0]).toMatchObject({
      name: 'Body',
      svgPath: 'M 0 0 L 100 0 Z',
      fillColor: '#8B4513'
    });
    expect((cmd!.payload.paths as Array<Record<string, unknown>>)[1]).toMatchObject({
      name: 'Tail',
      strokeColor: '#000000',
      strokeWeight: 2
    });
  });
});

// ─── group_nodes ─────────────────────────────────────────────────────────

describe('Utility Tools E2E — group_nodes', () => {
  it('groups created nodes while preserving node order and parentId', async () => {
    const parentId = await createParentFrame('GroupParent');
    const first = await routeToolCall('create_frame', { name: 'FirstGroupedNode', parentId });
    const second = await routeToolCall('create_frame', { name: 'SecondGroupedNode', parentId });
    const firstId = extractId(first[0].text!, /Frame ID:\s*(\S+)/);
    const secondId = extractId(second[0].text!, /Frame ID:\s*(\S+)/);
    ctx.plugin.clearCommands();

    const result = await routeToolCall('group_nodes', {
      nodeIds: [firstId, secondId],
      name: 'Grouped Pair',
      parentId
    });

    expect(result[0].text).toContain('Grouped 2 node(s) into "Grouped Pair"');
    expect(result[0].text).toContain('Group ID:');
    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'group_nodes');
    expect(cmd).toEqual(expect.objectContaining({ type: 'group_nodes' }));
    expect(cmd!.payload.nodeIds).toEqual([firstId, secondId]);
    expect(cmd!.payload.parentId).toBe(parentId);
  });
});

// ─── create_rectangle_with_image_fill ────────────────────────────────────

describe('Utility Tools E2E — create_rectangle_with_image_fill', () => {
  it('creates a rectangle with an image fill', async () => {
    const result = await routeToolCall('create_rectangle_with_image_fill', {
      name: 'HeroImage',
      imageUrl: 'https://example.com/hero.jpg',
      width: 1200,
      height: 600,
      scaleMode: 'FILL'
    });

    expect(result[0].text).toContain('Rectangle ID:');
    expect(result[0].text).toContain('Image URL:');
    expect(result[0].text).toContain('Scale Mode: FILL');

    const cmd = ctx.plugin
      .getReceivedCommands()
      .find((c) => c.type === 'create_rectangle_with_image_fill');
    expect(cmd).toEqual(expect.objectContaining({ type: 'create_rectangle_with_image_fill' }));
    expect(cmd!.payload.name).toBe('HeroImage');
    expect(cmd!.payload.imageUrl).toBe('https://example.com/hero.jpg');
    expect(cmd!.payload.width).toBe(1200);
    expect(cmd!.payload.height).toBe(600);
    expect(cmd!.payload.scaleMode).toBe('FILL');
  });
});

// ─── Visibility & Lock edge cases ────────────────────────────────────────

describe('Utility Tools E2E — visibility and lock edge cases', () => {
  it('set_visible toggles: hide then show', async () => {
    const frameId = await createParentFrame('ToggleVisible');
    ctx.plugin.clearCommands();

    // Hide
    const hideResult = await routeToolCall('set_visible', { nodeId: frameId, visible: false });
    expect(hideResult[0].text).toContain('Visible: false');

    // Show
    const showResult = await routeToolCall('set_visible', { nodeId: frameId, visible: true });
    expect(showResult[0].text).toContain('Visible: true');

    const cmds = ctx.plugin.getReceivedCommands().filter((c) => c.type === 'set_visible');
    expect(cmds).toHaveLength(2);
    expect(cmds[0].payload.visible).toBe(false);
    expect(cmds[1].payload.visible).toBe(true);
  });

  it('set_locked toggles: lock then unlock', async () => {
    const frameId = await createParentFrame('ToggleLock');
    ctx.plugin.clearCommands();

    // Lock
    const lockResult = await routeToolCall('set_locked', { nodeId: frameId, locked: true });
    expect(lockResult[0].text).toContain('Locked: true');

    // Unlock
    const unlockResult = await routeToolCall('set_locked', { nodeId: frameId, locked: false });
    expect(unlockResult[0].text).toContain('Locked: false');

    const cmds = ctx.plugin.getReceivedCommands().filter((c) => c.type === 'set_locked');
    expect(cmds).toHaveLength(2);
    expect(cmds[0].payload.locked).toBe(true);
    expect(cmds[1].payload.locked).toBe(false);
  });
});

// ─── Full Export Workflow ────────────────────────────────────────────────

describe('Utility Tools E2E — export workflow', () => {
  it('create frame → configure export settings → export as PNG', async () => {
    // Step 1: Create frame
    const frameId = await createParentFrame('ExportWorkflow');

    // Step 2: Configure export settings
    await routeToolCall('set_export_settings', {
      nodeId: frameId,
      settings: [{ format: 'PNG', suffix: '@2x', constraint: { type: 'SCALE', value: 2 } }]
    });

    ctx.plugin.clearCommands();

    // Step 3: Export
    const result = await routeToolCall('export_node', {
      nodeId: frameId,
      format: 'PNG',
      scale: 2
    });

    expect(result[0].text).toContain('Format: PNG');
    expect(result[0].text).toContain('Scale: 2x');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'export_node');
    expect(cmd!.payload.nodeId).toBe(frameId);
  });
});
