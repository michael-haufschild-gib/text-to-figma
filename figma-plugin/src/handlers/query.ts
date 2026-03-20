/**
 * Query Command Handlers
 *
 * Handles: get_node_by_id, get_node_by_name, get_children, get_parent,
 * get_absolute_bounds, get_relative_bounds, get_page_hierarchy, get_selection
 */

import { getNode, getNodeDimensions } from '../helpers.js';

export function handleGetNodeById(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node) {
    return { exists: false, error: 'Node not found' };
  }
  return {
    exists: true,
    node: {
      id: node.id,
      name: node.name,
      type: node.type,
      ...getNodeDimensions(node),
      x: node.x,
      y: node.y
    },
    message: 'Node retrieved successfully'
  };
}

export function handleGetNodeByName(payload: Record<string, unknown>): unknown {
  const findAll = (payload.findAll as boolean) || false;
  const exactMatch = (payload.exactMatch as boolean) || false;
  const searchName = (payload.name as string).toLowerCase();

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
  const node = getNode(payload.nodeId as string);
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
  const node = getNode(payload.nodeId as string);
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
  const node = getNode(payload.nodeId as string);
  if (!node) throw new Error('Node not found');

  return {
    nodeId: payload.nodeId,
    bounds: { x: node.x, y: node.y, ...getNodeDimensions(node) },
    message: 'Bounds retrieved successfully'
  };
}

export function handleGetRelativeBounds(payload: Record<string, unknown>): unknown {
  const targetNode = getNode(payload.targetNodeId as string);
  const referenceNode = getNode(payload.referenceNodeId as string);
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
      base.children = ((node as FrameNode).children as SceneNode[]).map(traverseNode);
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

export function handleGetSelection(payload: Record<string, unknown>): unknown {
  const selection = figma.currentPage.selection;
  const includeDetails = (payload.includeDetails as boolean) !== false;

  if (selection.length === 0) {
    return { count: 0, selection: [], message: 'No nodes selected' };
  }

  const nodes = selection.map((node) => {
    const base: Record<string, unknown> = {
      nodeId: node.id,
      name: node.name,
      type: node.type,
      bounds: { x: node.x, y: node.y, ...getNodeDimensions(node) }
    };

    if (includeDetails) {
      if ('fills' in node) base.fills = (node as GeometryMixin).fills;
      if ('strokes' in node) base.strokes = (node as GeometryMixin).strokes;
      if ('strokeWeight' in node) base.strokeWeight = (node as GeometryMixin).strokeWeight;
      if ('cornerRadius' in node) base.cornerRadius = (node as RectangleNode).cornerRadius;
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
        base.characters = node.characters;
        base.fontSize = node.fontSize;
        base.fontName = node.fontName;
      }
      if ('children' in node) {
        base.children = (node as FrameNode).children.map((c) => ({
          nodeId: c.id,
          name: c.name,
          type: c.type
        }));
      }
    }

    return base;
  });

  return { count: nodes.length, selection: nodes, message: `${nodes.length} node(s) selected` };
}
