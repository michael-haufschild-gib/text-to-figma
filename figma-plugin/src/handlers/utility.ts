/**
 * Utility Command Handlers
 *
 * Handles: set_visible, set_locked, set_export_settings, export_node,
 * set_plugin_data, get_plugin_data, create_page, list_pages, set_current_page,
 * set_stroke_join, set_stroke_cap, set_clipping_mask, create_path,
 * create_boolean_operation
 */

import { getNode, hexToRgb, resolveParent } from '../helpers.js';
import { checkEnum, validatePayload, type ValidationRule } from '../validate.js';

const STROKE_JOINS = ['MITER', 'BEVEL', 'ROUND'] as const;
const STROKE_CAPS: readonly string[] = [
  'NONE',
  'ROUND',
  'SQUARE',
  'ARROW_LINES',
  'ARROW_EQUILATERAL',
  'DIAMOND_FILLED',
  'TRIANGLE_FILLED',
  'CIRCLE_FILLED'
];
const BOOLEAN_OPS = ['UNION', 'INTERSECT', 'SUBTRACT', 'EXCLUDE'] as const;

const nodeIdRules: ValidationRule[] = [{ field: 'nodeId', type: 'string', required: true }];
const pluginDataRules: ValidationRule[] = [
  { field: 'nodeId', type: 'string', required: true },
  { field: 'key', type: 'string', required: true }
];
const setPluginDataRules: ValidationRule[] = [
  { field: 'nodeId', type: 'string', required: true },
  { field: 'key', type: 'string', required: true },
  { field: 'value', type: 'string', required: true }
];
const pageIdRules: ValidationRule[] = [{ field: 'pageId', type: 'string', required: true }];

export function handleSetVisible(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, nodeIdRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
  if (!node) throw new Error('Node not found');
  if (typeof payload.visible !== 'boolean') throw new Error('visible must be a boolean');
  node.visible = payload.visible;
  return {
    nodeId: payload.nodeId,
    visible: payload.visible,
    message: 'Visibility set successfully'
  };
}

export function handleSetLocked(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, nodeIdRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
  if (!node) throw new Error('Node not found');
  if (typeof payload.locked !== 'boolean') throw new Error('locked must be a boolean');
  node.locked = payload.locked;
  return { nodeId: payload.nodeId, locked: payload.locked, message: 'Lock state set successfully' };
}

export function handleSetExportSettings(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, nodeIdRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
  if (!node) throw new Error('Node not found');

  if (!Array.isArray(payload.settings)) throw new Error('settings must be an array');
  const settings: ExportSettings[] = (payload.settings as Array<Record<string, unknown>>).map(
    (s) => {
      const fmt = typeof s.format === 'string' ? s.format : 'PNG';
      const constraint =
        typeof s.constraint === 'object' && s.constraint !== null
          ? (s.constraint as ExportSettingsConstraints)
          : { type: 'SCALE' as const, value: 1 };
      const suffix = typeof s.suffix === 'string' ? s.suffix : '';

      if (fmt === 'SVG') return { format: 'SVG' as const, constraint, suffix } as ExportSettings;
      if (fmt === 'PDF') return { format: 'PDF' as const, constraint, suffix } as ExportSettings;
      if (fmt === 'JPG') return { format: 'JPG' as const, constraint, suffix } as ExportSettings;
      return { format: 'PNG' as const, constraint, suffix } as ExportSettings;
    }
  );

  node.exportSettings = settings;
  return {
    nodeId: payload.nodeId,
    settingsCount: settings.length,
    message: 'Export settings applied successfully'
  };
}

export async function handleExportNode(payload: Record<string, unknown>): Promise<unknown> {
  const error = validatePayload(payload, nodeIdRules);
  if (error !== null) throw new Error(error);

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
  const error = validatePayload(payload, setPluginDataRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
  if (!node) throw new Error('Node not found');

  node.setPluginData(payload.key as string, payload.value as string);
  return { nodeId: payload.nodeId, key: payload.key, message: 'Plugin data set successfully' };
}

export function handleGetPluginData(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, pluginDataRules);
  if (error !== null) throw new Error(error);

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
  const error = validatePayload(payload, pageIdRules);
  if (error !== null) throw new Error(error);

  const page = figma.root.children.find((p) => p.id === payload.pageId);
  if (!page) throw new Error('Page not found');
  await figma.setCurrentPageAsync(page);
  return { pageId: page.id, pageName: page.name, message: 'Current page set successfully' };
}

export function handleSetStrokeJoin(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, nodeIdRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
  if (!node || !('strokeJoin' in node)) throw new Error('Node does not support stroke join');
  const strokeJoin = checkEnum(payload.strokeJoin, STROKE_JOINS);
  if (strokeJoin === undefined)
    throw new Error(`Invalid strokeJoin: ${String(payload.strokeJoin)}`);
  (node as GeometryMixin).strokeJoin = strokeJoin;
  return {
    nodeId: payload.nodeId,
    strokeJoin: payload.strokeJoin,
    message: 'Stroke join set successfully'
  };
}

export function handleSetStrokeCap(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, nodeIdRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
  if (!node || !('strokeCap' in node)) throw new Error('Node does not support stroke cap');
  if (typeof payload.strokeCap !== 'string' || !STROKE_CAPS.includes(payload.strokeCap)) {
    throw new Error(`Invalid strokeCap: ${String(payload.strokeCap)}`);
  }
  (node as GeometryMixin).strokeCap = payload.strokeCap as StrokeCap;
  return {
    nodeId: payload.nodeId,
    strokeCap: payload.strokeCap,
    message: 'Stroke cap set successfully'
  };
}

export function handleSetClippingMask(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, nodeIdRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
  if (!node || !('clipsContent' in node)) throw new Error('Node does not support clipping');
  (node as FrameNode).clipsContent = payload.enabled === true;
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

  if (!Array.isArray(payload.commands)) {
    throw new Error('Path requires a commands array');
  }
  const commands = payload.commands as Array<Record<string, unknown>>;
  if (commands.length === 0) {
    throw new Error('Path requires at least one command');
  }
  const firstCmd = commands[0];
  if (firstCmd?.type !== 'M') throw new Error('Path must start with M (Move) command');

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

  const parent = resolveParent(typeof payload.parentId === 'string' ? payload.parentId : undefined);
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
    if (!cmd) {
      continue;
    }
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
        for (const k of ['x1', 'y1', 'x2', 'y2', 'x', 'y']) {
          validateCoord(cmd, k, i);
        }
        pathData += `C ${String(cmd.x1)} ${String(cmd.y1)} ${String(cmd.x2)} ${String(cmd.y2)} ${String(cmd.x)} ${String(cmd.y)} `;
        break;
      case 'Q':
        for (const k of ['x1', 'y1', 'x', 'y']) {
          validateCoord(cmd, k, i);
        }
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
  if (
    !Array.isArray(payload.nodeIds) ||
    !payload.nodeIds.every((el: unknown) => typeof el === 'string')
  ) {
    throw new Error('nodeIds must be an array of strings');
  }
  const nodeIds: string[] = payload.nodeIds;
  if (nodeIds.length < 2) throw new Error('Boolean operation requires at least 2 nodes');

  const nodes = nodeIds.map((id) => getNode(id)).filter((n): n is SceneNode => n !== null);
  if (nodes.length < 2) throw new Error('Could not find all nodes for boolean operation');

  const booleanNode = figma.createBooleanOperation();
  booleanNode.name = typeof payload.name === 'string' ? payload.name : 'Boolean';
  booleanNode.booleanOperation = checkEnum(payload.operation, BOOLEAN_OPS) ?? 'UNION';

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
