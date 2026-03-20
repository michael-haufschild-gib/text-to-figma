/**
 * Utility Command Handlers
 *
 * Handles: set_visible, set_locked, set_export_settings, export_node,
 * set_plugin_data, get_plugin_data, create_page, list_pages, set_current_page,
 * set_stroke_join, set_stroke_cap, set_clipping_mask, create_path,
 * create_boolean_operation
 */

import { getNode, hexToRgb, resolveParent } from '../helpers.js';

export function handleSetVisible(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node) throw new Error('Node not found');
  node.visible = payload.visible as boolean;
  return {
    nodeId: payload.nodeId,
    visible: payload.visible,
    message: 'Visibility set successfully'
  };
}

export function handleSetLocked(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node) throw new Error('Node not found');
  node.locked = payload.locked as boolean;
  return { nodeId: payload.nodeId, locked: payload.locked, message: 'Lock state set successfully' };
}

export function handleSetExportSettings(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node) throw new Error('Node not found');

  const settings: ExportSettings[] = (payload.settings as Array<Record<string, unknown>>).map(
    (s) => ({
      format: typeof s.format === 'string' ? (s.format as ExportSettings['format']) : 'PNG',
      constraint:
        s.constraint !== undefined
          ? (s.constraint as ExportSettingsConstraints)
          : { type: 'SCALE', value: 1 },
      suffix: typeof s.suffix === 'string' ? s.suffix : ''
    })
  );

  node.exportSettings = settings;
  return {
    nodeId: payload.nodeId,
    settingsCount: settings.length,
    message: 'Export settings applied successfully'
  };
}

export async function handleExportNode(payload: Record<string, unknown>): Promise<unknown> {
  const node = getNode(payload.nodeId as string);
  if (!node) throw new Error('Node not found');

  const format = typeof payload.format === 'string' ? payload.format : 'PNG';
  const scale = typeof payload.scale === 'number' ? payload.scale : 1;

  const exportFormat = format === 'JPG' ? 'JPG' : format === 'SVG' ? 'SVG' : 'PNG';
  const bytes = await node.exportAsync({
    format: exportFormat,
    constraint: { type: 'SCALE', value: scale }
  });

  let base64Data = null;
  if (payload.returnBase64 !== false) {
    base64Data = figma.base64Encode(bytes);
  }

  return {
    nodeId: payload.nodeId,
    format,
    scale,
    base64Data,
    message: 'Node exported successfully'
  };
}

export function handleSetPluginData(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node) throw new Error('Node not found');

  node.setPluginData(payload.key as string, payload.value as string);
  return { nodeId: payload.nodeId, key: payload.key, message: 'Plugin data set successfully' };
}

export function handleGetPluginData(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node) throw new Error('Node not found');

  const value = node.getPluginData(payload.key as string);
  return {
    nodeId: payload.nodeId,
    key: payload.key,
    value,
    message: 'Plugin data retrieved successfully'
  };
}

export function handleCreatePageWithPayload(payload: Record<string, unknown>): unknown {
  const page = figma.createPage();
  page.name = typeof payload.name === 'string' ? payload.name : 'Page';
  return { pageId: page.id, name: page.name, message: 'Page created successfully' };
}

export function handleListPages(): unknown {
  const pages = figma.root.children.map((page) => ({
    pageId: page.id,
    name: page.name,
    isCurrent: page === figma.currentPage
  }));
  return { pages, message: `Found ${String(pages.length)} page(s)` };
}

export async function handleSetCurrentPage(payload: Record<string, unknown>): Promise<unknown> {
  const page = figma.root.children.find((p) => p.id === payload.pageId);
  if (!page) throw new Error('Page not found');
  await figma.setCurrentPageAsync(page);
  return { pageId: page.id, pageName: page.name, message: 'Current page set successfully' };
}

export function handleSetStrokeJoin(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node || !('strokeJoin' in node)) throw new Error('Node does not support stroke join');
  (node as GeometryMixin).strokeJoin = payload.strokeJoin as StrokeJoin;
  return {
    nodeId: payload.nodeId,
    strokeJoin: payload.strokeJoin,
    message: 'Stroke join set successfully'
  };
}

export function handleSetStrokeCap(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node || !('strokeCap' in node)) throw new Error('Node does not support stroke cap');
  (node as GeometryMixin).strokeCap = payload.strokeCap as StrokeCap;
  return {
    nodeId: payload.nodeId,
    strokeCap: payload.strokeCap,
    message: 'Stroke cap set successfully'
  };
}

export function handleSetClippingMask(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node || !('clipsContent' in node)) throw new Error('Node does not support clipping');
  (node as FrameNode).clipsContent = payload.enabled as boolean;
  return {
    nodeId: payload.nodeId,
    enabled: payload.enabled,
    useMask: payload.useMask,
    message: 'Clipping mask set successfully'
  };
}

export function handleCreatePath(payload: Record<string, unknown>): unknown {
  const vectorNode = figma.createVector();
  vectorNode.name = typeof payload.name === 'string' ? payload.name : 'Path';

  const commands = payload.commands as Array<Record<string, unknown>>;
  if (!Array.isArray(commands) || commands.length === 0) {
    throw new Error('Path requires at least one command');
  }
  if (commands[0].type !== 'M') throw new Error('Path must start with M (Move) command');

  const pathData = buildPathData(commands);
  const finalPath = payload.closed === true && !pathData.includes('Z') ? pathData + ' Z' : pathData;
  const trimmedPath = finalPath.trim();
  if (trimmedPath === '') throw new Error('Generated path data is empty');

  vectorNode.vectorPaths = [{ windingRule: 'NONZERO', data: trimmedPath }];

  if (typeof payload.fillColor === 'string') {
    vectorNode.fills = [{ type: 'SOLID', color: hexToRgb(payload.fillColor) }];
  } else {
    vectorNode.fills = [];
  }
  if (typeof payload.strokeColor === 'string') {
    vectorNode.strokes = [{ type: 'SOLID', color: hexToRgb(payload.strokeColor) }];
    vectorNode.strokeWeight = typeof payload.strokeWeight === 'number' ? payload.strokeWeight : 1;
  }

  const parent = resolveParent(payload.parentId as string | undefined);
  parent.appendChild(vectorNode);
  figma.viewport.scrollAndZoomIntoView([vectorNode]);

  return {
    pathId: vectorNode.id,
    message: `Path created successfully with ${String(commands.length)} commands`
  };
}

function buildPathData(commands: Array<Record<string, unknown>>): string {
  let pathData = '';

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    switch (cmd.type) {
      case 'M':
        validateCoord(cmd, 'x', i);
        validateCoord(cmd, 'y', i);
        pathData += `M ${String(cmd.x)} ${String(cmd.y)} `;
        break;
      case 'L':
        validateCoord(cmd, 'x', i);
        validateCoord(cmd, 'y', i);
        pathData += `L ${String(cmd.x)} ${String(cmd.y)} `;
        break;
      case 'C':
        for (const k of ['x1', 'y1', 'x2', 'y2', 'x', 'y']) validateCoord(cmd, k, i);
        pathData += `C ${String(cmd.x1)} ${String(cmd.y1)} ${String(cmd.x2)} ${String(cmd.y2)} ${String(cmd.x)} ${String(cmd.y)} `;
        break;
      case 'Q':
        for (const k of ['x1', 'y1', 'x', 'y']) validateCoord(cmd, k, i);
        pathData += `Q ${String(cmd.x1)} ${String(cmd.y1)} ${String(cmd.x)} ${String(cmd.y)} `;
        break;
      case 'Z':
        pathData += 'Z ';
        break;
      default:
        throw new Error(`Unknown path command type '${String(cmd.type)}' at index ${String(i)}`);
    }
  }

  return pathData;
}

function validateCoord(cmd: Record<string, unknown>, key: string, index: number): void {
  const val = cmd[key];
  if (typeof val !== 'number')
    throw new Error(
      `Command ${String(index)} (${String(cmd.type)}): Property '${key}' must be a number`
    );
  if (!isFinite(val))
    throw new Error(
      `Command ${String(index)} (${String(cmd.type)}): Property '${key}' must be a finite number`
    );
}

export function handleCreateBooleanOperation(payload: Record<string, unknown>): unknown {
  const nodeIds = payload.nodeIds as string[];
  if (!Array.isArray(nodeIds) || nodeIds.length < 2)
    throw new Error('Boolean operation requires at least 2 nodes');

  const nodes = nodeIds.map((id) => getNode(id)).filter((n): n is SceneNode => n !== null);
  if (nodes.length < 2) throw new Error('Could not find all nodes for boolean operation');

  const booleanNode = figma.createBooleanOperation();
  booleanNode.name = typeof payload.name === 'string' ? payload.name : 'Boolean';
  booleanNode.booleanOperation =
    typeof payload.operation === 'string'
      ? (payload.operation as 'UNION' | 'INTERSECT' | 'SUBTRACT' | 'EXCLUDE')
      : 'UNION';

  for (const node of nodes) {
    booleanNode.appendChild(node);
  }

  figma.viewport.scrollAndZoomIntoView([booleanNode]);

  return {
    booleanNodeId: booleanNode.id,
    operation: booleanNode.booleanOperation,
    nodeCount: nodes.length,
    message: `Boolean operation created: ${booleanNode.booleanOperation}`
  };
}
