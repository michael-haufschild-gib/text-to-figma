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
      format: (s.format as ExportSettings['format']) || 'PNG',
      constraint: (s.constraint as ExportSettingsConstraints) || { type: 'SCALE', value: 1 },
      suffix: (s.suffix as string) || ''
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

  const format = (payload.format as string) || 'PNG';
  const scale = (payload.scale as number) || 1;

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
  page.name = (payload.name as string) || 'Page';
  return { pageId: page.id, name: page.name, message: 'Page created successfully' };
}

export function handleListPages(): unknown {
  const pages = figma.root.children.map((page) => ({
    pageId: page.id,
    name: page.name,
    isCurrent: page === figma.currentPage
  }));
  return { pages, message: `Found ${pages.length} page(s)` };
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
  vectorNode.name = (payload.name as string) || 'Path';

  const commands = payload.commands as Array<Record<string, unknown>>;
  if (!commands || commands.length === 0) throw new Error('Path requires at least one command');
  if (commands[0].type !== 'M') throw new Error('Path must start with M (Move) command');

  let pathData = '';

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    switch (cmd.type) {
      case 'M':
        validateCoord(cmd, 'x', i);
        validateCoord(cmd, 'y', i);
        pathData += `M ${cmd.x} ${cmd.y} `;
        break;
      case 'L':
        validateCoord(cmd, 'x', i);
        validateCoord(cmd, 'y', i);
        pathData += `L ${cmd.x} ${cmd.y} `;
        break;
      case 'C':
        for (const k of ['x1', 'y1', 'x2', 'y2', 'x', 'y']) validateCoord(cmd, k, i);
        pathData += `C ${cmd.x1} ${cmd.y1} ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y} `;
        break;
      case 'Q':
        for (const k of ['x1', 'y1', 'x', 'y']) validateCoord(cmd, k, i);
        pathData += `Q ${cmd.x1} ${cmd.y1} ${cmd.x} ${cmd.y} `;
        break;
      case 'Z':
        pathData += 'Z ';
        break;
      default:
        throw new Error(`Unknown path command type '${cmd.type}' at index ${i}`);
    }
  }

  if (payload.closed && !pathData.includes('Z')) pathData += 'Z';
  const trimmedPath = pathData.trim();
  if (!trimmedPath) throw new Error('Generated path data is empty');

  vectorNode.vectorPaths = [{ windingRule: 'NONZERO', data: trimmedPath }];

  if (payload.fillColor) {
    vectorNode.fills = [{ type: 'SOLID', color: hexToRgb(payload.fillColor as string) }];
  } else {
    vectorNode.fills = [];
  }
  if (payload.strokeColor) {
    vectorNode.strokes = [{ type: 'SOLID', color: hexToRgb(payload.strokeColor as string) }];
    vectorNode.strokeWeight = (payload.strokeWeight as number) || 1;
  }

  const parent = resolveParent(payload.parentId as string | undefined);
  parent.appendChild(vectorNode);
  figma.viewport.scrollAndZoomIntoView([vectorNode]);

  return {
    pathId: vectorNode.id,
    message: `Path created successfully with ${commands.length} commands`
  };
}

function validateCoord(cmd: Record<string, unknown>, key: string, index: number): void {
  const val = cmd[key];
  if (typeof val !== 'number')
    throw new Error(`Command ${index} (${cmd.type}): Property '${key}' must be a number`);
  if (!isFinite(val))
    throw new Error(`Command ${index} (${cmd.type}): Property '${key}' must be a finite number`);
}

export function handleCreateBooleanOperation(payload: Record<string, unknown>): unknown {
  const nodeIds = payload.nodeIds as string[];
  if (!nodeIds || nodeIds.length < 2)
    throw new Error('Boolean operation requires at least 2 nodes');

  const nodes = nodeIds.map((id) => getNode(id)).filter((n): n is SceneNode => n !== null);
  if (nodes.length < 2) throw new Error('Could not find all nodes for boolean operation');

  const booleanNode = figma.createBooleanOperation();
  booleanNode.name = (payload.name as string) || 'Boolean';
  booleanNode.booleanOperation =
    (payload.operation as 'UNION' | 'INTERSECT' | 'SUBTRACT' | 'EXCLUDE') || 'UNION';

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
