/**
 * Query Command Handlers
 *
 * Handles: get_node_by_id, get_node_by_name, get_children, get_parent,
 * get_absolute_bounds, get_relative_bounds, get_page_hierarchy, get_selection
 */

import { getNode, getNodeDimensions } from '../helpers.js';
import { validatePayload } from '../validate.js';
import type { ValidationRule } from '../validate.js';

const getNodeByIdRules: ValidationRule[] = [{ field: 'nodeId', type: 'string', required: true }];

export function handleGetNodeById(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, getNodeByIdRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
  if (!node) {
    return { exists: false, error: 'Node not found' };
  }
  const nodeData: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type,
    ...getNodeDimensions(node),
    x: node.x,
    y: node.y
  };

  if ('layoutMode' in node) {
    const frame = node as FrameNode;
    nodeData.layoutMode = frame.layoutMode;
    nodeData.itemSpacing = frame.itemSpacing;
    nodeData.primaryAxisSizingMode = frame.primaryAxisSizingMode;
    nodeData.counterAxisSizingMode = frame.counterAxisSizingMode;
  }
  if ('layoutPositioning' in node) {
    nodeData.layoutPositioning = (
      node as SceneNode & { layoutPositioning: string }
    ).layoutPositioning;
  }

  return {
    exists: true,
    node: nodeData,
    message: 'Node retrieved successfully'
  };
}

export function handleGetNodeByName(payload: Record<string, unknown>): unknown {
  const findAll = payload.findAll === true;
  const exactMatch = payload.exactMatch === true;
  if (typeof payload.name !== 'string') throw new Error('name must be a string');
  const searchName = payload.name.toLowerCase();

  const results: Array<{ nodeId: string; name: string; type: string }> = [];

  function searchNodes(node: BaseNode): boolean {
    const nodeName = node.name.toLowerCase();
    const matches = exactMatch ? nodeName === searchName : nodeName.includes(searchName);

    if (matches && 'id' in node) {
      results.push({ nodeId: node.id, name: node.name, type: node.type });
      if (!findAll) return true;
    }

    if ('children' in node) {
      for (const child of (node as FrameNode).children) {
        if (searchNodes(child)) return true;
      }
    }
    return false;
  }

  searchNodes(figma.root);

  return { found: results.length, nodes: results, message: `Found ${results.length} node(s)` };
}

export function handleGetChildren(payload: Record<string, unknown>): unknown {
  if (typeof payload.nodeId !== 'string') throw new Error('nodeId must be a string');
  const node = getNode(payload.nodeId);
  if (!node || !('children' in node)) throw new Error('Node does not have children');

  const children = (node as FrameNode).children.map((child) => ({
    nodeId: child.id,
    name: child.name,
    type: child.type,
    visible: child.visible,
    locked: child.locked
  }));

  return {
    nodeId: payload.nodeId,
    childCount: children.length,
    children,
    message: 'Children retrieved successfully'
  };
}

export function handleGetParent(payload: Record<string, unknown>): unknown {
  if (typeof payload.nodeId !== 'string') throw new Error('nodeId must be a string');
  const node = getNode(payload.nodeId);
  if (!node) throw new Error('Node not found');

  const parent = node.parent;
  return {
    nodeId: payload.nodeId,
    parentId: parent ? parent.id : null,
    parentName: parent ? parent.name : null,
    parentType: parent ? parent.type : null,
    message: 'Parent retrieved successfully'
  };
}

export function handleGetAbsoluteBounds(payload: Record<string, unknown>): unknown {
  if (typeof payload.nodeId !== 'string') throw new Error('nodeId must be a string');
  const node = getNode(payload.nodeId);
  if (!node) throw new Error('Node not found');

  const dim = getNodeDimensions(node);
  let absX = node.x;
  let absY = node.y;
  if ('absoluteTransform' in node) {
    const transform = (
      node as SceneNode & {
        absoluteTransform: [[number, number, number], [number, number, number]];
      }
    ).absoluteTransform;
    absX = transform[0][2];
    absY = transform[1][2];
  }
  return {
    nodeId: payload.nodeId,
    bounds: { x: absX, y: absY, width: dim.width, height: dim.height },
    message: 'Absolute bounds retrieved successfully'
  };
}

export function handleGetRelativeBounds(payload: Record<string, unknown>): unknown {
  if (typeof payload.targetNodeId !== 'string') throw new Error('targetNodeId must be a string');
  if (typeof payload.referenceNodeId !== 'string')
    throw new Error('referenceNodeId must be a string');
  const targetNode = getNode(payload.targetNodeId);
  const referenceNode = getNode(payload.referenceNodeId);
  if (!targetNode || !referenceNode) throw new Error('Target or reference node not found');

  const td = getNodeDimensions(targetNode);
  const rd = getNodeDimensions(referenceNode);

  const tcx = targetNode.x + td.width / 2;
  const tcy = targetNode.y + td.height / 2;
  const rcx = referenceNode.x + rd.width / 2;
  const rcy = referenceNode.y + rd.height / 2;

  return {
    relativeBounds: {
      relativeX: targetNode.x - referenceNode.x,
      relativeY: targetNode.y - referenceNode.y,
      distanceFromRight: referenceNode.x + rd.width - (targetNode.x + td.width),
      distanceFromLeft: targetNode.x - referenceNode.x,
      distanceFromTop: targetNode.y - referenceNode.y,
      distanceFromBottom: referenceNode.y + rd.height - (targetNode.y + td.height),
      centerDistanceX: tcx - rcx,
      centerDistanceY: tcy - rcy,
      width: td.width,
      height: td.height,
      referencePoints: {
        topLeft: { x: referenceNode.x, y: referenceNode.y },
        topCenter: { x: rcx, y: referenceNode.y },
        topRight: { x: referenceNode.x + rd.width, y: referenceNode.y },
        centerLeft: { x: referenceNode.x, y: rcy },
        center: { x: rcx, y: rcy },
        centerRight: { x: referenceNode.x + rd.width, y: rcy },
        bottomLeft: { x: referenceNode.x, y: referenceNode.y + rd.height },
        bottomCenter: { x: rcx, y: referenceNode.y + rd.height },
        bottomRight: { x: referenceNode.x + rd.width, y: referenceNode.y + rd.height }
      }
    },
    message: 'Relative bounds calculated successfully'
  };
}

export function handleGetPageHierarchy(): unknown {
  function traverseNode(node: SceneNode): unknown {
    const base: Record<string, unknown> = {
      nodeId: node.id,
      type: node.type,
      name: node.name,
      bounds: { x: node.x, y: node.y, ...getNodeDimensions(node) },
      children: []
    };

    if ('children' in node) {
      base.children = (node as FrameNode).children.map(traverseNode);
    }
    return base;
  }

  const hierarchy = figma.currentPage.children.map(traverseNode);
  return {
    pageName: figma.currentPage.name,
    pageId: figma.currentPage.id,
    hierarchy,
    message: 'Page hierarchy retrieved successfully'
  };
}

/** Returns true if the value is figma.mixed (a Symbol) */
function isMixed(value: unknown): boolean {
  return typeof value === 'symbol';
}

/** Resolve cornerRadius: uniform number or per-corner breakdown */
function resolveCornerRadius(node: SceneNode): number | Record<string, number> | undefined {
  if (!('cornerRadius' in node)) return undefined;
  const r = (node as RectangleNode).cornerRadius;
  if (!isMixed(r)) return r as number;
  if ('topLeftRadius' in node) {
    const rect = node as RectangleNode;
    return {
      topLeft: rect.topLeftRadius,
      topRight: rect.topRightRadius,
      bottomLeft: rect.bottomLeftRadius,
      bottomRight: rect.bottomRightRadius
    };
  }
  return undefined;
}

/** Resolve strokeWeight: uniform number or per-side breakdown */
function resolveStrokeWeight(node: SceneNode): number | Record<string, number> | undefined {
  if (!('strokeWeight' in node)) return undefined;
  const w = (node as GeometryMixin).strokeWeight;
  if (!isMixed(w)) return w as number;
  if ('strokeTopWeight' in node) {
    const frame = node as FrameNode;
    return {
      top: frame.strokeTopWeight,
      right: frame.strokeRightWeight,
      bottom: frame.strokeBottomWeight,
      left: frame.strokeLeftWeight
    };
  }
  return undefined;
}

/** Resolve text node: uniform props or styled segments for mixed values */
function resolveTextProperties(node: TextNode): Record<string, unknown> {
  const result: Record<string, unknown> = {
    characters: node.characters
  };

  const fontSize = node.fontSize;
  const fontName = node.fontName;

  if (!isMixed(fontSize) && !isMixed(fontName)) {
    result.fontSize = fontSize;
    result.fontName = fontName;
    if (!isMixed(node.fontWeight)) result.fontWeight = node.fontWeight;
    if (!isMixed(node.textCase)) result.textCase = node.textCase;
    if (!isMixed(node.textDecoration)) result.textDecoration = node.textDecoration;
    if (!isMixed(node.lineHeight)) result.lineHeight = node.lineHeight;
    if (!isMixed(node.letterSpacing)) result.letterSpacing = node.letterSpacing;
    if (!isMixed(node.fills)) result.textFills = node.fills;
  } else {
    const segments = node.getStyledTextSegments([
      'fontSize',
      'fontName',
      'fontWeight',
      'textDecoration',
      'textCase',
      'lineHeight',
      'letterSpacing',
      'fills'
    ]);
    result.styledSegments = segments.map((seg) => ({
      characters: seg.characters,
      start: seg.start,
      end: seg.end,
      fontSize: seg.fontSize,
      fontName: seg.fontName,
      fontWeight: seg.fontWeight,
      textDecoration: seg.textDecoration,
      textCase: seg.textCase,
      lineHeight: seg.lineHeight,
      letterSpacing: seg.letterSpacing,
      fills: seg.fills
    }));
  }

  return result;
}

function serializeNode(
  node: SceneNode,
  includeDetails: boolean,
  depth: number,
  maxDepth: number
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    nodeId: node.id,
    name: node.name,
    type: node.type
  };

  if ('x' in node && 'y' in node) {
    base.bounds = { x: node.x, y: node.y, ...getNodeDimensions(node) };
  }

  if (includeDetails) {
    if ('fills' in node && node.type !== 'TEXT') {
      const fills = (node as GeometryMixin).fills;
      if (!isMixed(fills)) base.fills = fills;
    }
    if ('strokes' in node) {
      const strokes = (node as GeometryMixin).strokes;
      if (!isMixed(strokes)) base.strokes = strokes;
    }

    const sw = resolveStrokeWeight(node);
    if (sw !== undefined) base.strokeWeight = sw;

    const cr = resolveCornerRadius(node);
    if (cr !== undefined) base.cornerRadius = cr;

    if ('opacity' in node) base.opacity = (node as BlendMixin).opacity;

    if ('layoutMode' in node) {
      const frame = node as FrameNode;
      base.layoutMode = frame.layoutMode;
      base.itemSpacing = frame.itemSpacing;
      base.paddingTop = frame.paddingTop;
      base.paddingRight = frame.paddingRight;
      base.paddingBottom = frame.paddingBottom;
      base.paddingLeft = frame.paddingLeft;
    }

    if (node.type === 'TEXT') {
      Object.assign(base, resolveTextProperties(node));
    }

    if ('children' in node && depth < maxDepth) {
      base.children = (node as FrameNode).children.map((c) =>
        serializeNode(c, includeDetails, depth + 1, maxDepth)
      );
    }
  }

  return base;
}

export function handleGetSelection(payload: Record<string, unknown>): unknown {
  const selection = figma.currentPage.selection;
  const includeDetails = payload.includeDetails !== false;
  const maxDepth = typeof payload.maxDepth === 'number' ? payload.maxDepth : 5;

  if (selection.length === 0) {
    return { count: 0, selection: [], message: 'No nodes selected' };
  }

  const nodes = selection.map((node) => serializeNode(node, includeDetails, 0, maxDepth));

  return { count: nodes.length, selection: nodes, message: `${nodes.length} node(s) selected` };
}
