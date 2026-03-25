/**
 * Query Tools E2E Tests
 *
 * Tests all read/query tools through the full three-tier chain:
 *   MCP tool call → Router → FigmaBridge → WebSocket Bridge → Simulated Figma Plugin → Response
 *
 * Bug this catches:
 * - Query tools don't forward correct parameters to the Figma plugin
 * - Query responses are not parsed or formatted correctly
 * - get_node_info combines registry + plugin data incorrectly
 * - get_page_hierarchy returns wrong hierarchy shape
 * - Bounds queries don't propagate coordinate data
 * - Plugin data round-trip (set → get) loses data
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
import type { FigmaCommand } from './helpers/simulated-figma-plugin.js';

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

// ─── check_connection ────────────────────────────────────────────────────

describe('Query Tools E2E — check_connection', () => {
  it('returns connection status from the Figma plugin', async () => {
    // The FigmaBridge singleton auto-connects on first sendToFigmaWithRetry call.
    // Trigger connection by calling any tool that uses the bridge first.
    await createParentFrame('ConnectionTest');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('check_connection', {});

    expect(result[0].text).toContain('Connection Status: CONNECTED');
    expect(result[0].text).toContain('Diagnostics');

    // check_connection sends a 'ping' command to the plugin
    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'ping');
    expect(cmd).toEqual(expect.objectContaining({ type: 'ping' }));
  });

  it('reports diagnostic info when bridge is connected but plugin ping fails', async () => {
    // Ensure bridge is connected first
    await createParentFrame('PingTest');

    ctx.plugin.setCommandHandler(() => ({
      success: false,
      error: 'Plugin not responding'
    }));

    // check_connection catches ping errors and returns DEGRADED status
    const result = await routeToolCall('check_connection', {});
    // The WebSocket is connected, but plugin didn't respond — shows degraded
    expect(result[0].text).toContain('Connection Status: DEGRADED');
    expect(result[0].text).toContain('Diagnostics');
    expect(result[0].text).toContain('Warning');
  });
});

// ─── get_node_by_id ─────────────────────────────────────────────────────

describe('Query Tools E2E — get_node_by_id', () => {
  it('queries a node by ID and returns node details', async () => {
    const frameId = await createParentFrame('QueryTarget');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('get_node_by_id', { nodeId: frameId });

    expect(result[0].text).toContain('Node ID:');
    expect(result[0].text).toContain(frameId);

    // Verify the command was sent to the plugin with the correct nodeId
    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'get_node_by_id');
    expect(cmd).toEqual(expect.objectContaining({ type: 'get_node_by_id' }));
    expect(cmd!.payload.nodeId).toBe(frameId);
  });

  it('returns correct response format with name and type', async () => {
    const frameId = await createParentFrame('DetailedQuery');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('get_node_by_id', { nodeId: frameId });

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('text');
    expect(result[0].text).toContain('Name:');
    expect(result[0].text).toContain('Type:');
  });
});

// ─── get_node_by_name ───────────────────────────────────────────────────

describe('Query Tools E2E — get_node_by_name', () => {
  it('searches for nodes by name', async () => {
    const result = await routeToolCall('get_node_by_name', { name: 'TestNode' });

    expect(result[0].text).toContain('Found:');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'get_node_by_name');
    expect(cmd).toEqual(expect.objectContaining({ type: 'get_node_by_name' }));
    expect(cmd!.payload.name).toBe('TestNode');
  });

  it('propagates name search parameter correctly', async () => {
    const specialName = 'Button/Primary/Large';
    await routeToolCall('get_node_by_name', { name: specialName });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'get_node_by_name');
    expect(cmd!.payload.name).toBe(specialName);
  });
});

// ─── get_children ────────────────────────────────────────────────────────

describe('Query Tools E2E — get_children', () => {
  it('queries children of a node', async () => {
    const parentId = await createParentFrame('Parent');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('get_children', { nodeId: parentId });

    expect(result[0].text).toContain('Node ID:');
    expect(result[0].text).toContain('Child Count:');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'get_children');
    expect(cmd).toEqual(expect.objectContaining({ type: 'get_children' }));
    expect(cmd!.payload.nodeId).toBe(parentId);
  });

  it('returns children with custom plugin response', async () => {
    const parentId = await createParentFrame('ParentWithChildren');
    ctx.plugin.clearCommands();

    // Configure plugin to return children
    ctx.plugin.setCommandHandler((cmd: FigmaCommand) => {
      if (cmd.type === 'get_children') {
        return {
          success: true,
          data: {
            children: [
              { nodeId: 'child-1', type: 'TEXT', name: 'Title', visible: true, locked: false },
              { nodeId: 'child-2', type: 'FRAME', name: 'Body', visible: true, locked: true }
            ]
          }
        };
      }
      // Fall through to default for other types
      return { success: true, data: { updated: true } };
    });

    const result = await routeToolCall('get_children', { nodeId: parentId });

    expect(result[0].text).toContain('Child Count: 2');
    expect(result[0].text).toContain('Title');
    expect(result[0].text).toContain('Body');
  });
});

// ─── get_parent ──────────────────────────────────────────────────────────

describe('Query Tools E2E — get_parent', () => {
  it('queries the parent of a node', async () => {
    const parentId = await createParentFrame('Root');
    ctx.plugin.clearCommands();

    // Create a child frame so we have a node to query
    const childResult = await routeToolCall('create_frame', {
      name: 'Child',
      parentId
    });
    const childId = extractId(childResult[0].text!, /Frame ID:\s*(\S+)/);
    ctx.plugin.clearCommands();

    const result = await routeToolCall('get_parent', { nodeId: childId });

    expect(result[0].text).toContain('Node ID:');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'get_parent');
    expect(cmd).toEqual(expect.objectContaining({ type: 'get_parent' }));
    expect(cmd!.payload.nodeId).toBe(childId);
  });
});

// ─── get_selection ───────────────────────────────────────────────────────

describe('Query Tools E2E — get_selection', () => {
  it('returns empty selection by default', async () => {
    const result = await routeToolCall('get_selection', {});

    expect(result[0].text).toContain('No nodes selected');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'get_selection');
    expect(cmd).toEqual(expect.objectContaining({ type: 'get_selection' }));
  });

  it('returns selected nodes when plugin reports selection', async () => {
    ctx.plugin.setCommandHandler((cmd: FigmaCommand) => {
      if (cmd.type === 'get_selection') {
        return {
          success: true,
          data: {
            count: 2,
            selection: [
              {
                nodeId: 'sel-1',
                type: 'FRAME',
                name: 'Selected Frame',
                bounds: { x: 0, y: 0, width: 100, height: 50 }
              },
              {
                nodeId: 'sel-2',
                type: 'TEXT',
                name: 'Selected Text',
                bounds: { x: 0, y: 0, width: 80, height: 20 }
              }
            ]
          }
        };
      }
      return { success: true, data: { updated: true } };
    });

    const result = await routeToolCall('get_selection', {});

    expect(result[0].text).toContain('Selected: 2 node(s)');
    expect(result[0].text).toContain('FRAME "Selected Frame" [sel-1]');
    expect(result[0].text).toContain('TEXT "Selected Text" [sel-2]');
  });
});

// ─── get_page_hierarchy ──────────────────────────────────────────────────

describe('Query Tools E2E — get_page_hierarchy', () => {
  it('returns page hierarchy', async () => {
    // First create some nodes so the registry has content
    await createParentFrame('HierarchyRoot');

    const result = await routeToolCall('get_page_hierarchy', {});

    expect(result[0].text).toContain('Page Hierarchy');
    expect(result[0].text).toContain('Total Nodes:');
    expect(result[0].text).toContain('Root Nodes:');
  });

  it('reflects nodes created via create_frame in the hierarchy', async () => {
    const rootId = await createParentFrame('AppRoot');
    await routeToolCall('create_frame', {
      name: 'Header',
      parentId: rootId,
      layoutMode: 'HORIZONTAL',
      padding: 16
    });

    const result = await routeToolCall('get_page_hierarchy', {});

    expect(result[0].text).toContain('AppRoot');
    expect(result[0].text).toContain('Header');
  });
});

// ─── list_pages ──────────────────────────────────────────────────────────

describe('Query Tools E2E — list_pages', () => {
  it('lists available pages from the Figma plugin', async () => {
    const result = await routeToolCall('list_pages', {});

    expect(result[0].text).toContain('Pages:');
    expect(result[0].text).toContain('Page 1');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'list_pages');
    expect(cmd).toEqual(expect.objectContaining({ type: 'list_pages' }));
  });
});

// ─── get_absolute_bounds / get_relative_bounds ───────────────────────────

describe('Query Tools E2E — bounds queries', () => {
  it('get_absolute_bounds returns position and dimensions', async () => {
    const frameId = await createParentFrame('Bounded');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('get_absolute_bounds', { nodeId: frameId });

    expect(result[0].text).toContain('Node ID:');
    expect(result[0].text).toContain('Position:');
    expect(result[0].text).toContain('Dimensions:');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'get_absolute_bounds');
    expect(cmd).toEqual(expect.objectContaining({ type: 'get_absolute_bounds' }));
    expect(cmd!.payload.nodeId).toBe(frameId);
  });

  it('get_relative_bounds sends targetNodeId and referenceNodeId to plugin', async () => {
    const targetId = await createParentFrame('Target');
    const refId = await createParentFrame('Reference');
    ctx.plugin.clearCommands();

    await routeToolCall('get_relative_bounds', {
      targetNodeId: targetId,
      referenceNodeId: refId
    });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'get_relative_bounds');
    expect(cmd).toEqual(expect.objectContaining({ type: 'get_relative_bounds' }));
    expect(cmd!.payload.targetNodeId).toBe(targetId);
    expect(cmd!.payload.referenceNodeId).toBe(refId);
  });
});

// ─── get_plugin_data / set_plugin_data round-trip ────────────────────────

describe('Query Tools E2E — plugin data round-trip', () => {
  it('set_plugin_data sends key-value pair to plugin', async () => {
    const frameId = await createParentFrame('DataNode');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('set_plugin_data', {
      nodeId: frameId,
      key: 'custom-tag',
      value: 'hero-section'
    });

    expect(result[0].text).toContain('Node ID:');
    expect(result[0].text).toContain('Key: custom-tag');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_plugin_data');
    expect(cmd).toEqual(expect.objectContaining({ type: 'set_plugin_data' }));
    expect(cmd!.payload.nodeId).toBe(frameId);
    expect(cmd!.payload.key).toBe('custom-tag');
    expect(cmd!.payload.value).toBe('hero-section');
  });

  it('get_plugin_data queries key from plugin', async () => {
    const frameId = await createParentFrame('DataNode2');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('get_plugin_data', {
      nodeId: frameId,
      key: 'my-key'
    });

    expect(result[0].text).toContain('Key: my-key');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'get_plugin_data');
    expect(cmd).toEqual(expect.objectContaining({ type: 'get_plugin_data' }));
    expect(cmd!.payload.nodeId).toBe(frameId);
    expect(cmd!.payload.key).toBe('my-key');
  });

  it('set then get plugin data uses correct keys in both directions', async () => {
    const frameId = await createParentFrame('RoundTripData');
    ctx.plugin.clearCommands();

    // Simulate a plugin that stores and retrieves data
    const storedData = new Map<string, string>();
    ctx.plugin.setCommandHandler((cmd: FigmaCommand) => {
      if (cmd.type === 'set_plugin_data') {
        storedData.set(
          `${cmd.payload.nodeId as string}:${cmd.payload.key as string}`,
          cmd.payload.value as string
        );
        return {
          success: true,
          data: { nodeId: cmd.payload.nodeId, key: cmd.payload.key, value: cmd.payload.value }
        };
      }
      if (cmd.type === 'get_plugin_data') {
        const val =
          storedData.get(`${cmd.payload.nodeId as string}:${cmd.payload.key as string}`) ?? '';
        return {
          success: true,
          data: { nodeId: cmd.payload.nodeId, key: cmd.payload.key, value: val }
        };
      }
      return { success: true, data: { updated: true } };
    });

    await routeToolCall('set_plugin_data', {
      nodeId: frameId,
      key: 'component-type',
      value: 'navigation-bar'
    });

    const getResult = await routeToolCall('get_plugin_data', {
      nodeId: frameId,
      key: 'component-type'
    });

    expect(getResult[0].text).toContain('Value: navigation-bar');
  });
});

// ─── get_node_info (local registry) ──────────────────────────────────────

describe('Query Tools E2E — get_node_info', () => {
  it('returns node info from the local registry', async () => {
    const parentId = await createParentFrame('InfoRoot');
    await routeToolCall('create_frame', {
      name: 'InfoChild',
      parentId,
      layoutMode: 'HORIZONTAL',
      padding: 8
    });

    const result = await routeToolCall('get_node_info', { nodeId: parentId });

    expect(result[0].text).toContain('Node Information');
    expect(result[0].text).toContain('InfoRoot');
    expect(result[0].text).toContain('Children: 1');
  });

  it('returns path from root to node', async () => {
    const rootId = await createParentFrame('Root');
    const midResult = await routeToolCall('create_frame', {
      name: 'Mid',
      parentId: rootId,
      layoutMode: 'VERTICAL',
      padding: 8
    });
    const midId = extractId(midResult[0].text!, /Frame ID:\s*(\S+)/);

    const result = await routeToolCall('get_node_info', { nodeId: midId });

    expect(result[0].text).toContain('Path:');
    expect(result[0].text).toContain('Root');
    expect(result[0].text).toContain('Mid');
  });
});
