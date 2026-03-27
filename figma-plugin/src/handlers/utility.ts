/**
 * Utility Command Handlers
 *
 * Handles: set_visible, set_locked, set_export_settings, export_node,
 * set_plugin_data, get_plugin_data, create_page, list_pages, set_current_page,
 * set_stroke_join, set_stroke_cap, set_clipping_mask, create_path,
 * create_boolean_operation
 */

import { z } from 'zod';
import { cacheNode, getNode, uncacheNode } from '../helpers.js';

// ── Return types ─────────────────────────────────────────────────────────────

interface OperationResult {
  message: string;
  [key: string]: unknown;
}

const STROKE_JOINS = ['MITER', 'BEVEL', 'ROUND'] as const;
const STROKE_CAPS = [
  'NONE',
  'ROUND',
  'SQUARE',
  'ARROW_LINES',
  'ARROW_EQUILATERAL',
  'DIAMOND_FILLED',
  'TRIANGLE_FILLED',
  'CIRCLE_FILLED'
] as const;
const BOOLEAN_OPS = ['UNION', 'INTERSECT', 'SUBTRACT', 'EXCLUDE'] as const;

const renameNodeSchema = z.object({
  nodeId: z.string(),
  name: z.string()
});

export function handleRenameNode(payload: Record<string, unknown>): OperationResult {
  const input = renameNodeSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node) throw new Error('Node not found');
  const oldName = node.name;
  node.name = input.name;
  return { nodeId: node.id, oldName, name: input.name, message: 'Node renamed successfully' };
}

const setVisibleSchema = z.object({
  nodeId: z.string(),
  visible: z.boolean()
});

export function handleSetVisible(payload: Record<string, unknown>): OperationResult {
  const input = setVisibleSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node) throw new Error('Node not found');
  node.visible = input.visible;
  return {
    nodeId: input.nodeId,
    visible: input.visible,
    message: 'Visibility set successfully'
  };
}

const setLockedSchema = z.object({
  nodeId: z.string(),
  locked: z.boolean()
});

export function handleSetLocked(payload: Record<string, unknown>): OperationResult {
  const input = setLockedSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node) throw new Error('Node not found');
  node.locked = input.locked;
  return { nodeId: input.nodeId, locked: input.locked, message: 'Lock state set successfully' };
}

const setExportSettingsSchema = z.object({
  nodeId: z.string(),
  settings: z.array(
    z.object({
      format: z.string().optional(),
      constraint: z.record(z.string(), z.unknown()).optional(),
      suffix: z.string().optional()
    })
  )
});

export function handleSetExportSettings(payload: Record<string, unknown>): OperationResult {
  const input = setExportSettingsSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node) throw new Error('Node not found');

  const settings: ExportSettings[] = input.settings.map((s) => {
    const fmt = s.format ?? 'PNG';
    const constraint =
      s.constraint !== undefined
        ? (s.constraint as unknown as ExportSettingsConstraints)
        : { type: 'SCALE' as const, value: 1 };
    const suffix = s.suffix ?? '';

    if (fmt === 'SVG') return { format: 'SVG' as const, constraint, suffix } as ExportSettings;
    if (fmt === 'PDF') return { format: 'PDF' as const, constraint, suffix } as ExportSettings;
    if (fmt === 'JPG') return { format: 'JPG' as const, constraint, suffix } as ExportSettings;
    return { format: 'PNG' as const, constraint, suffix } as ExportSettings;
  });

  node.exportSettings = settings;
  return {
    nodeId: input.nodeId,
    settingsCount: settings.length,
    message: 'Export settings applied successfully'
  };
}

const exportNodeSchema = z.object({
  nodeId: z.string(),
  format: z.string().optional(),
  scale: z.number().optional(),
  returnBase64: z.boolean().optional()
});

export async function handleExportNode(payload: Record<string, unknown>): Promise<OperationResult> {
  const input = exportNodeSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node) throw new Error('Node not found');

  const format = input.format ?? 'PNG';
  const scale = input.scale ?? 1;

  const exportFormat = format === 'JPG' ? 'JPG' : format === 'SVG' ? 'SVG' : 'PNG';
  const bytes = await node.exportAsync({
    format: exportFormat,
    constraint: { type: 'SCALE', value: scale }
  });

  let base64Data = null;
  if (input.returnBase64 !== false) {
    base64Data = figma.base64Encode(bytes);
  }

  return {
    nodeId: input.nodeId,
    format,
    scale,
    base64Data,
    message: 'Node exported successfully'
  };
}

const setPluginDataSchema = z.object({
  nodeId: z.string(),
  key: z.string(),
  value: z.string()
});

export function handleSetPluginData(payload: Record<string, unknown>): OperationResult {
  const input = setPluginDataSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node) throw new Error('Node not found');

  node.setPluginData(input.key, input.value);
  return { nodeId: input.nodeId, key: input.key, message: 'Plugin data set successfully' };
}

const getPluginDataSchema = z.object({
  nodeId: z.string(),
  key: z.string()
});

export function handleGetPluginData(payload: Record<string, unknown>): OperationResult {
  const input = getPluginDataSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node) throw new Error('Node not found');

  const value = node.getPluginData(input.key);
  return {
    nodeId: input.nodeId,
    key: input.key,
    value,
    message: 'Plugin data retrieved successfully'
  };
}

const createPageSchema = z.object({
  name: z.string().optional()
});

export function handleCreatePageWithPayload(payload: Record<string, unknown>): OperationResult {
  const input = createPageSchema.parse(payload);

  const page = figma.createPage();
  page.name = input.name ?? 'Page';
  return { pageId: page.id, name: page.name, message: 'Page created successfully' };
}

export function handleListPages(): OperationResult {
  const pages = figma.root.children.map((page) => ({
    pageId: page.id,
    name: page.name,
    isCurrent: page === figma.currentPage
  }));
  return { pages, message: `Found ${String(pages.length)} page(s)` };
}

const setCurrentPageSchema = z.object({
  pageId: z.string()
});

export async function handleSetCurrentPage(
  payload: Record<string, unknown>
): Promise<OperationResult> {
  const input = setCurrentPageSchema.parse(payload);

  const page = figma.root.children.find((p) => p.id === input.pageId);
  if (!page) throw new Error('Page not found');
  await figma.setCurrentPageAsync(page);
  return { pageId: page.id, pageName: page.name, message: 'Current page set successfully' };
}

const setStrokeJoinSchema = z.object({
  nodeId: z.string(),
  strokeJoin: z.enum(STROKE_JOINS)
});

export function handleSetStrokeJoin(payload: Record<string, unknown>): OperationResult {
  const input = setStrokeJoinSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node || !('strokeJoin' in node)) throw new Error('Node does not support stroke join');
  (node as GeometryMixin).strokeJoin = input.strokeJoin;
  return {
    nodeId: input.nodeId,
    strokeJoin: input.strokeJoin,
    message: 'Stroke join set successfully'
  };
}

const setStrokeCapSchema = z.object({
  nodeId: z.string(),
  strokeCap: z.enum(STROKE_CAPS)
});

export function handleSetStrokeCap(payload: Record<string, unknown>): OperationResult {
  const input = setStrokeCapSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node || !('strokeCap' in node)) throw new Error('Node does not support stroke cap');
  (node as GeometryMixin).strokeCap = input.strokeCap;
  return {
    nodeId: input.nodeId,
    strokeCap: input.strokeCap,
    message: 'Stroke cap set successfully'
  };
}

const setClippingMaskSchema = z.object({
  nodeId: z.string(),
  enabled: z.boolean().optional()
});

export function handleSetClippingMask(payload: Record<string, unknown>): OperationResult {
  const input = setClippingMaskSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node || !('clipsContent' in node)) throw new Error('Node does not support clipping');
  (node as FrameNode).clipsContent = input.enabled === true;
  return {
    nodeId: input.nodeId,
    clipsContent: input.enabled === true,
    message:
      'Clip content toggled successfully. Note: This controls whether child content is clipped to frame bounds (clipsContent), not Figma mask layers.'
  };
}

// Path handlers (create_path, edit_path, batch_create_path) extracted to ./path.ts
export { handleCreatePath, handleEditPath, handleBatchCreatePath } from './path.js';

const groupNodesSchema = z.object({
  nodeIds: z.array(z.string()).min(1, 'Group requires at least 1 node'),
  name: z.string().optional(),
  parentId: z.string().optional()
});

export function handleGroupNodes(payload: Record<string, unknown>): OperationResult {
  const input = groupNodesSchema.parse(payload);

  const nodes = input.nodeIds.map((id) => getNode(id)).filter((n): n is SceneNode => n !== null);
  if (nodes.length === 0) throw new Error('Could not find any of the specified nodes');

  // Determine parent: explicit parentId, or first node's current parent
  let parent: BaseNode & ChildrenMixin;
  if (input.parentId !== undefined) {
    const p = getNode(input.parentId);
    if (!p || !('appendChild' in p)) throw new Error('Parent does not support children');
    parent = p as BaseNode & ChildrenMixin;
  } else {
    const firstNode = nodes[0];
    if (!firstNode) throw new Error('No valid nodes found');
    const firstParent = firstNode.parent;
    if (!firstParent || !('appendChild' in firstParent)) {
      throw new Error('First node has no valid parent for grouping');
    }
    parent = firstParent;
  }

  const group = figma.group(nodes, parent);
  group.name = input.name ?? 'Group';
  cacheNode(group);
  figma.viewport.scrollAndZoomIntoView([group]);

  return {
    groupId: group.id,
    nodeCount: nodes.length,
    message: `Grouped ${String(nodes.length)} node(s) into "${group.name}"`
  };
}

const reparentNodeSchema = z.object({
  nodeId: z.string(),
  parentId: z.string()
});

export function handleReparentNode(payload: Record<string, unknown>): OperationResult {
  const input = reparentNodeSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node) throw new Error('Node not found');

  const parent = getNode(input.parentId);
  if (!parent || !('appendChild' in parent)) throw new Error('Parent does not support children');

  const oldParentId = node.parent?.id ?? null;
  (parent as FrameNode).appendChild(node);

  return {
    nodeId: node.id,
    oldParentId,
    newParentId: parent.id,
    message: 'Node reparented successfully'
  };
}

const removeNodeSchema = z.object({
  nodeId: z.string()
});

export function handleRemoveNode(payload: Record<string, unknown>): OperationResult {
  const input = removeNodeSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node) throw new Error('Node not found');

  const parentId = node.parent?.id ?? null;
  const removedName = node.name;
  const removedType = node.type;
  uncacheNode(input.nodeId);
  node.remove();

  return {
    nodeId: input.nodeId,
    parentId,
    name: removedName,
    type: removedType,
    message: 'Node removed successfully'
  };
}

const createBooleanOperationSchema = z.object({
  nodeIds: z.array(z.string()).min(2, 'Boolean operation requires at least 2 nodes'),
  name: z.string().optional(),
  operation: z.enum(BOOLEAN_OPS).optional()
});

export function handleCreateBooleanOperation(payload: Record<string, unknown>): OperationResult {
  const input = createBooleanOperationSchema.parse(payload);

  const nodes = input.nodeIds.map((id) => getNode(id)).filter((n): n is SceneNode => n !== null);
  if (nodes.length < 2) throw new Error('Could not find all nodes for boolean operation');

  const booleanNode = figma.createBooleanOperation();
  booleanNode.name = input.name ?? 'Boolean';
  booleanNode.booleanOperation = input.operation ?? 'UNION';

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

/** Copy visual and layout properties from a component/frame to a new frame */
function copyFrameProperties(
  source: FrameNode | ComponentNode | ComponentSetNode,
  target: FrameNode
): void {
  target.resize(source.width, source.height);
  target.x = source.x;
  target.y = source.y;
  target.fills = JSON.parse(JSON.stringify(source.fills)) as Paint[];
  target.strokes = JSON.parse(JSON.stringify(source.strokes)) as Paint[];
  target.effects = JSON.parse(JSON.stringify(source.effects)) as Effect[];
  target.strokeWeight = source.strokeWeight;
  target.strokeAlign = source.strokeAlign;
  target.cornerRadius = source.cornerRadius;
  target.clipsContent = source.clipsContent;
  target.opacity = source.opacity;
  if (source.layoutMode !== 'NONE') {
    target.layoutMode = source.layoutMode;
    target.primaryAxisSizingMode = source.primaryAxisSizingMode;
    target.counterAxisSizingMode = source.counterAxisSizingMode;
    target.primaryAxisAlignItems = source.primaryAxisAlignItems;
    target.counterAxisAlignItems = source.counterAxisAlignItems;
    target.itemSpacing = source.itemSpacing;
    target.paddingLeft = source.paddingLeft;
    target.paddingRight = source.paddingRight;
    target.paddingTop = source.paddingTop;
    target.paddingBottom = source.paddingBottom;
  }
}

/** Convert a single COMPONENT node to a FRAME, preserving children and properties */
function componentToFrame(component: ComponentNode): FrameNode {
  const frame = figma.createFrame();
  frame.name = component.name;
  copyFrameProperties(component, frame);

  const children = [...component.children];
  for (const child of children) {
    frame.appendChild(child);
  }

  return frame;
}

const detachComponentSchema = z.object({
  nodeId: z.string()
});

export function handleDetachComponent(payload: Record<string, unknown>): OperationResult {
  const input = detachComponentSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node) throw new Error('Node not found');

  if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET' && node.type !== 'INSTANCE') {
    throw new Error(
      `Cannot detach node of type ${node.type}. Must be INSTANCE, COMPONENT, or COMPONENT_SET.`
    );
  }

  const parent = node.parent;
  if (!parent) throw new Error('Node has no parent');

  const detached: Array<{ oldId: string; newId: string; name: string }> = [];

  if (node.type === 'INSTANCE') {
    const frame = node.detachInstance();
    uncacheNode(node.id);
    cacheNode(frame);
    detached.push({ oldId: input.nodeId, newId: frame.id, name: frame.name });

    return {
      type: 'INSTANCE',
      detached,
      message: `Detached instance "${frame.name}" from its component`
    };
  }

  const index = parent.children.indexOf(node as SceneNode);

  if (node.type === 'COMPONENT') {
    const frame = componentToFrame(node);
    parent.insertChild(index, frame);
    uncacheNode(node.id);
    node.remove();
    cacheNode(frame);
    detached.push({ oldId: input.nodeId, newId: frame.id, name: frame.name });

    return {
      type: 'COMPONENT',
      detached,
      message: `Detached component "${frame.name}" to frame`
    };
  }

  // COMPONENT_SET: convert the set and all its child components to frames
  const outerFrame = figma.createFrame();
  outerFrame.name = node.name;
  copyFrameProperties(node, outerFrame);

  const variants = [...node.children];
  for (const variant of variants) {
    if (variant.type === 'COMPONENT') {
      const frame = componentToFrame(variant);
      outerFrame.appendChild(frame);
      uncacheNode(variant.id);
      cacheNode(frame);
      detached.push({ oldId: variant.id, newId: frame.id, name: frame.name });
    } else {
      outerFrame.appendChild(variant);
    }
  }

  parent.insertChild(index, outerFrame);
  uncacheNode(node.id);
  node.remove();
  cacheNode(outerFrame);

  return {
    type: 'COMPONENT_SET',
    frameId: outerFrame.id,
    detached,
    message: `Detached component set "${outerFrame.name}" — ${detached.length} variant(s) converted to frames`
  };
}
