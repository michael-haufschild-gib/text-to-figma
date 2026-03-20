/**
 * Layout Command Handlers
 *
 * Handles: set_layout_properties, set_layout_align, set_layout_sizing,
 * set_constraints, set_layer_order, align_nodes, distribute_nodes,
 * connect_shapes, add_layout_grid
 */

import { getNode, getNodeDimensions, hexToRgb } from '../helpers.js';

export function handleSetLayoutProperties(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node || !('layoutMode' in node)) throw new Error('Node does not support auto-layout');

  const frame = node as FrameNode;
  if (typeof payload.layoutMode === 'string') {
    frame.layoutMode = payload.layoutMode as 'HORIZONTAL' | 'VERTICAL';
  }
  if (payload.itemSpacing !== undefined) frame.itemSpacing = payload.itemSpacing as number;
  if (payload.padding !== undefined) {
    const p = payload.padding as number;
    frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = p;
  }

  return { nodeId: payload.nodeId, message: 'Layout properties updated successfully' };
}

export function handleSetLayoutAlign(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node || !('primaryAxisAlignItems' in node))
    throw new Error('Node does not support layout alignment');

  const frame = node as FrameNode;
  if (typeof payload.primaryAxis === 'string') {
    frame.primaryAxisAlignItems = payload.primaryAxis as FrameNode['primaryAxisAlignItems'];
  }
  if (typeof payload.counterAxis === 'string') {
    frame.counterAxisAlignItems = payload.counterAxis as FrameNode['counterAxisAlignItems'];
  }

  return { nodeId: payload.nodeId, message: 'Layout alignment set successfully' };
}

export function handleSetLayoutSizing(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node || !('layoutSizingHorizontal' in node))
    throw new Error('Node does not support layout sizing');

  const frame = node as FrameNode;
  if (typeof payload.horizontal === 'string') {
    frame.layoutSizingHorizontal = payload.horizontal as 'FIXED' | 'HUG' | 'FILL';
  }
  if (typeof payload.vertical === 'string') {
    frame.layoutSizingVertical = payload.vertical as 'FIXED' | 'HUG' | 'FILL';
  }

  return { nodeId: payload.nodeId, message: 'Layout sizing set successfully' };
}

export function handleSetConstraints(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node || !('constraints' in node)) throw new Error('Node does not support constraints');

  const h = typeof payload.horizontal === 'string' ? payload.horizontal : 'MIN';
  const v = typeof payload.vertical === 'string' ? payload.vertical : 'MIN';

  (node as ConstraintMixin).constraints = {
    horizontal: h as ConstraintType,
    vertical: v as ConstraintType
  };

  return {
    nodeId: payload.nodeId,
    applied: [
      typeof payload.horizontal === 'string' ? `horizontal: ${payload.horizontal}` : '',
      typeof payload.vertical === 'string' ? `vertical: ${payload.vertical}` : ''
    ].filter((s) => s !== ''),
    message: 'Constraints applied successfully'
  };
}

export function handleSetLayerOrder(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node) throw new Error('Node not found');
  const parent = node.parent;
  if (!parent || !('children' in parent)) throw new Error('Node has no valid parent');

  const currentIndex = (parent as FrameNode).children.indexOf(node);

  switch (payload.action) {
    case 'BRING_TO_FRONT':
      (parent as FrameNode).insertChild((parent as FrameNode).children.length - 1, node);
      break;
    case 'BRING_FORWARD':
      (parent as FrameNode).insertChild(
        Math.min(currentIndex + 1, (parent as FrameNode).children.length - 1),
        node
      );
      break;
    case 'SEND_BACKWARD':
      (parent as FrameNode).insertChild(Math.max(currentIndex - 1, 0), node);
      break;
    case 'SEND_TO_BACK':
      (parent as FrameNode).insertChild(0, node);
      break;
    case 'SET_INDEX':
      (parent as FrameNode).insertChild(
        Math.max(0, Math.min(payload.index as number, (parent as FrameNode).children.length - 1)),
        node
      );
      break;
    default:
      throw new Error('Invalid layer order action');
  }

  return {
    newIndex: (parent as FrameNode).children.indexOf(node),
    message: 'Layer order updated successfully'
  };
}

export function handleAlignNodes(payload: Record<string, unknown>): unknown {
  const nodeIds = payload.nodeIds as string[];
  const nodes = nodeIds.map((id) => getNode(id)).filter((n): n is SceneNode => n !== null);
  if (nodes.length < 2) throw new Error('At least 2 valid nodes required for alignment');

  const alignment = payload.alignment as string;
  const alignTo = typeof payload.alignTo === 'string' ? payload.alignTo : 'SELECTION_BOUNDS';

  const referenceValue = computeAlignmentReference(nodes, alignment, alignTo);

  for (const node of nodes) {
    const { width, height } = getNodeDimensions(node);
    switch (alignment) {
      case 'LEFT':
        node.x = referenceValue;
        break;
      case 'CENTER_H':
        node.x = referenceValue - width / 2;
        break;
      case 'RIGHT':
        node.x = referenceValue - width;
        break;
      case 'TOP':
        node.y = referenceValue;
        break;
      case 'CENTER_V':
        node.y = referenceValue - height / 2;
        break;
      case 'BOTTOM':
        node.y = referenceValue - height;
        break;
    }
  }

  return { message: `Aligned ${String(nodes.length)} nodes to ${alignment}` };
}

function computeAlignmentReference(nodes: SceneNode[], alignment: string, alignTo: string): number {
  if (alignTo === 'FIRST' || alignTo === 'LAST') {
    const refNode = alignTo === 'LAST' ? nodes[nodes.length - 1] : nodes[0];
    return computeRefFromNode(refNode, alignment);
  }

  // SELECTION_BOUNDS
  const bounds = nodes.map((n) => ({ x: n.x, y: n.y, ...getNodeDimensions(n) }));
  const minX = Math.min(...bounds.map((b) => b.x));
  const maxX = Math.max(...bounds.map((b) => b.x + b.width));
  const minY = Math.min(...bounds.map((b) => b.y));
  const maxY = Math.max(...bounds.map((b) => b.y + b.height));

  switch (alignment) {
    case 'LEFT':
      return minX;
    case 'CENTER_H':
      return (minX + maxX) / 2;
    case 'RIGHT':
      return maxX;
    case 'TOP':
      return minY;
    case 'CENTER_V':
      return (minY + maxY) / 2;
    case 'BOTTOM':
      return maxY;
    default:
      return 0;
  }
}

function computeRefFromNode(refNode: SceneNode, alignment: string): number {
  const { width, height } = getNodeDimensions(refNode);
  switch (alignment) {
    case 'LEFT':
      return refNode.x;
    case 'CENTER_H':
      return refNode.x + width / 2;
    case 'RIGHT':
      return refNode.x + width;
    case 'TOP':
      return refNode.y;
    case 'CENTER_V':
      return refNode.y + height / 2;
    case 'BOTTOM':
      return refNode.y + height;
    default:
      return 0;
  }
}

export function handleDistributeNodes(payload: Record<string, unknown>): unknown {
  const nodeIds = payload.nodeIds as string[];
  const nodes = nodeIds.map((id) => getNode(id)).filter((n): n is SceneNode => n !== null);
  if (nodes.length < 3) throw new Error('At least 3 valid nodes required for distribution');

  const axis = payload.axis as 'HORIZONTAL' | 'VERTICAL';
  const method = typeof payload.method === 'string' ? payload.method : 'SPACING';

  nodes.sort((a, b) => (axis === 'HORIZONTAL' ? a.x - b.x : a.y - b.y));

  const first = nodes[0];
  const last = nodes[nodes.length - 1];

  if (method === 'SPACING') {
    return distributeBySpacing(nodes, first, last, axis, payload.spacing as number | undefined);
  }
  return distributeByCenters(nodes, first, last, axis);
}

function distributeBySpacing(
  nodes: SceneNode[],
  first: SceneNode,
  last: SceneNode,
  axis: string,
  explicitSpacing?: number
): unknown {
  const dim = axis === 'HORIZONTAL' ? 'width' : 'height';
  const pos = axis === 'HORIZONTAL' ? 'x' : 'y';

  const firstEnd = first[pos] + getNodeDimensions(first)[dim];
  const lastStart = last[pos];
  const spacing = explicitSpacing ?? (lastStart - firstEnd) / (nodes.length - 1);

  let current = firstEnd;
  for (let i = 1; i < nodes.length - 1; i++) {
    current += spacing;
    nodes[i][pos] = current;
    current += getNodeDimensions(nodes[i])[dim];
  }

  return {
    spacing,
    message: `Distributed ${String(nodes.length)} nodes ${axis === 'HORIZONTAL' ? 'horizontally' : 'vertically'} with ${spacing.toFixed(1)}px spacing`
  };
}

function distributeByCenters(
  nodes: SceneNode[],
  first: SceneNode,
  last: SceneNode,
  axis: string
): unknown {
  const dim = axis === 'HORIZONTAL' ? 'width' : 'height';
  const pos = axis === 'HORIZONTAL' ? 'x' : 'y';

  const firstCenter = first[pos] + getNodeDimensions(first)[dim] / 2;
  const lastCenter = last[pos] + getNodeDimensions(last)[dim] / 2;
  const spacing = (lastCenter - firstCenter) / (nodes.length - 1);

  for (let i = 1; i < nodes.length - 1; i++) {
    const targetCenter = firstCenter + spacing * i;
    nodes[i][pos] = targetCenter - getNodeDimensions(nodes[i])[dim] / 2;
  }

  return { spacing, message: `Distributed ${String(nodes.length)} nodes by centers` };
}

function applyOverlapOffset(
  pos: { x: number; y: number },
  overlap: number,
  targetAnchor: string,
  sourceAnchor: string
): { x: number; y: number } {
  let { x, y } = pos;
  if (targetAnchor.includes('TOP') && sourceAnchor.includes('BOTTOM')) y += overlap;
  else if (targetAnchor.includes('BOTTOM') && sourceAnchor.includes('TOP')) y -= overlap;
  else if (targetAnchor.includes('LEFT') && sourceAnchor.includes('RIGHT')) x += overlap;
  else if (targetAnchor.includes('RIGHT') && sourceAnchor.includes('LEFT')) x -= overlap;
  return { x, y };
}

function tryUnion(source: SceneNode, target: SceneNode): { merged: boolean; newNodeId?: string } {
  try {
    const booleanNode = figma.union([source, target], figma.currentPage);
    return { merged: true, newNodeId: booleanNode.id };
  } catch (e) {
    console.warn('Union operation failed:', e);
    return { merged: false };
  }
}

export function handleConnectShapes(payload: Record<string, unknown>): unknown {
  const sourceNode = getNode(payload.sourceNodeId as string);
  const targetNode = getNode(payload.targetNodeId as string);
  if (!sourceNode || !targetNode) throw new Error('Source or target node not found');

  const method = typeof payload.method === 'string' ? payload.method : 'POSITION_OVERLAP';
  const overlap = typeof payload.overlap === 'number' ? payload.overlap : 5;
  const targetAnchor = typeof payload.targetAnchor === 'string' ? payload.targetAnchor : 'CENTER';
  const sourceAnchor = typeof payload.sourceAnchor === 'string' ? payload.sourceAnchor : 'CENTER';

  const targetDims = getNodeDimensions(targetNode);
  const sourceDims = getNodeDimensions(sourceNode);

  const targetPos = anchorPosition(
    targetNode.x,
    targetNode.y,
    targetDims.width,
    targetDims.height,
    targetAnchor
  );
  let sourcePos = anchorOffset(
    targetPos.x,
    targetPos.y,
    sourceDims.width,
    sourceDims.height,
    sourceAnchor
  );

  if (method === 'POSITION_OVERLAP' || method === 'UNION') {
    sourcePos = applyOverlapOffset(sourcePos, overlap, targetAnchor, sourceAnchor);
  }

  sourceNode.x = sourcePos.x;
  sourceNode.y = sourcePos.y;

  let merged = false;
  let newNodeId: string | undefined;
  if (method === 'UNION' && payload.unionResult !== false) {
    ({ merged, newNodeId } = tryUnion(sourceNode, targetNode));
  }

  return {
    merged,
    newNodeId,
    message: merged ? 'Shapes connected and merged' : 'Shapes connected'
  };
}

function anchorPosition(
  x: number,
  y: number,
  w: number,
  h: number,
  anchor: string
): { x: number; y: number } {
  const positions: Record<string, { x: number; y: number }> = {
    TOP_LEFT: { x, y },
    TOP: { x: x + w / 2, y },
    TOP_RIGHT: { x: x + w, y },
    LEFT: { x, y: y + h / 2 },
    CENTER: { x: x + w / 2, y: y + h / 2 },
    RIGHT: { x: x + w, y: y + h / 2 },
    BOTTOM_LEFT: { x, y: y + h },
    BOTTOM: { x: x + w / 2, y: y + h },
    BOTTOM_RIGHT: { x: x + w, y: y + h }
  };
  return positions[anchor] ?? positions.CENTER;
}

function anchorOffset(
  tx: number,
  ty: number,
  sw: number,
  sh: number,
  anchor: string
): { x: number; y: number } {
  const offsets: Record<string, { x: number; y: number }> = {
    TOP_LEFT: { x: tx, y: ty },
    TOP: { x: tx - sw / 2, y: ty },
    TOP_RIGHT: { x: tx - sw, y: ty },
    LEFT: { x: tx, y: ty - sh / 2 },
    CENTER: { x: tx - sw / 2, y: ty - sh / 2 },
    RIGHT: { x: tx - sw, y: ty - sh / 2 },
    BOTTOM_LEFT: { x: tx, y: ty - sh },
    BOTTOM: { x: tx - sw / 2, y: ty - sh },
    BOTTOM_RIGHT: { x: tx - sw, y: ty - sh }
  };
  return offsets[anchor] ?? offsets.CENTER;
}

export function handleAddLayoutGrid(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node || !('layoutGrids' in node)) throw new Error('Node does not support layout grids');

  const frame = node as FrameNode;
  const pattern = typeof payload.pattern === 'string' ? payload.pattern : 'COLUMNS';
  const gridColor =
    typeof payload.color === 'string'
      ? { ...hexToRgb(payload.color), a: 0.1 }
      : { r: 1, g: 0, b: 0, a: 0.1 };

  let grid: LayoutGrid;
  let responseCount: number | undefined;
  let responseGutter: number | undefined;
  let responseMargin: number | undefined;

  if (pattern === 'GRID') {
    grid = {
      pattern: 'GRID',
      sectionSize: typeof payload.sectionSize === 'number' ? payload.sectionSize : 64,
      visible: payload.visible !== false,
      color: gridColor
    };
  } else {
    const count = typeof payload.count === 'number' ? payload.count : 12;
    const gutterSize = typeof payload.gutter === 'number' ? payload.gutter : 16;
    const offset = typeof payload.margin === 'number' ? payload.margin : 0;
    const alignment =
      typeof payload.alignment === 'string'
        ? (payload.alignment as RowsColsLayoutGrid['alignment'])
        : 'MIN';

    grid = {
      pattern: pattern as 'COLUMNS' | 'ROWS',
      sectionSize: typeof payload.sectionSize === 'number' ? payload.sectionSize : 64,
      visible: payload.visible !== false,
      color: gridColor,
      alignment,
      gutterSize,
      offset,
      count
    };
    responseCount = count;
    responseGutter = gutterSize;
    responseMargin = offset;
  }

  frame.layoutGrids = [...frame.layoutGrids, grid];

  return {
    nodeId: payload.nodeId,
    pattern,
    count: responseCount,
    gutter: responseGutter,
    margin: responseMargin,
    message: 'Layout grid added successfully'
  };
}
