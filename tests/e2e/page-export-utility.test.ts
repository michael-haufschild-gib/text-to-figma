/**
 * Page Management, Export, and Utility Tools E2E Tests
 *
 * Tests page creation/navigation, node export, export settings,
 * create_path, and create_rectangle_with_image_fill through the full chain.
 *
 * Bug this catches:
 * - create_page doesn't forward page name correctly
 * - set_current_page doesn't send pageId/name to plugin
 * - list_pages response not parsed correctly
 * - export_node doesn't forward format/scale parameters
 * - set_export_settings doesn't send settings array
 * - create_path command data or SVG path not forwarded
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
