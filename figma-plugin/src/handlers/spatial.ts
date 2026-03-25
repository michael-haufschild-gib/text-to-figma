/**
 * Spatial Arrangement Handlers
 *
 * Handles: align_nodes, distribute_nodes, connect_shapes
 * These operations position multiple nodes relative to each other.
 */

import { z } from 'zod';
import { getNode, getNodeDimensions } from '../helpers.js';

// ── Return types ─────────────────────────────────────────────────────────────

interface OperationResult {
  message: string;
  [key: string]: unknown;
}

const ALIGNMENTS = ['LEFT', 'CENTER_H', 'RIGHT', 'TOP', 'CENTER_V', 'BOTTOM'] as const;
const DISTRIBUTE_AXES = ['HORIZONTAL', 'VERTICAL'] as const;

const alignNodesSchema = z.object({
  nodeIds: z.array(z.string()),
  alignment: z.enum(ALIGNMENTS),
  alignTo: z.string().optional()
});

const distributeNodesSchema = z.object({
  nodeIds: z.array(z.string()),
  axis: z.enum(DISTRIBUTE_AXES),
  method: z.string().optional(),
  spacing: z.number().optional()
});

const connectShapesSchema = z.object({
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  method: z.string().optional(),
  overlap: z.number().optional(),
  targetAnchor: z.string().optional(),
  sourceAnchor: z.string().optional(),
  unionResult: z.boolean().optional()
});

export function handleAlignNodes(payload: Record<string, unknown>): OperationResult {
  const input = alignNodesSchema.parse(payload);

  const missingIds = input.nodeIds.filter((id) => getNode(id) === null);
  if (missingIds.length > 0) {
    throw new Error(
      `Nodes not found: ${missingIds.join(', ')}. Use get_page_hierarchy to verify node IDs.`
    );
  }
  const nodes = input.nodeIds.map((id) => getNode(id)).filter((n): n is SceneNode => n !== null);
  if (nodes.length < 2) throw new Error('At least 2 valid nodes required for alignment');

  const alignTo = input.alignTo ?? 'SELECTION_BOUNDS';
  const referenceValue = computeAlignmentReference(nodes, input.alignment, alignTo);

  for (const node of nodes) {
    const { width, height } = getNodeDimensions(node);
    switch (input.alignment) {
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

  return { message: `Aligned ${String(nodes.length)} nodes to ${input.alignment}` };
}

function computeAlignmentReference(nodes: SceneNode[], alignment: string, alignTo: string): number {
  if (alignTo === 'FIRST' || alignTo === 'LAST') {
    const refNode = alignTo === 'LAST' ? nodes[nodes.length - 1] : nodes[0];
    if (!refNode) {
      throw new Error('Cannot compute alignment reference: no nodes provided');
    }
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
      throw new Error(
        `Unknown alignment: ${alignment}. Valid values: LEFT, CENTER_H, RIGHT, TOP, CENTER_V, BOTTOM`
      );
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
      throw new Error(
        `Unknown alignment: ${alignment}. Valid values: LEFT, CENTER_H, RIGHT, TOP, CENTER_V, BOTTOM`
      );
  }
}

export function handleDistributeNodes(payload: Record<string, unknown>): OperationResult {
  const input = distributeNodesSchema.parse(payload);

  const missingIds = input.nodeIds.filter((id) => getNode(id) === null);
  if (missingIds.length > 0) {
    throw new Error(
      `Nodes not found: ${missingIds.join(', ')}. Use get_page_hierarchy to verify node IDs.`
    );
  }
  const nodes = input.nodeIds.map((id) => getNode(id)).filter((n): n is SceneNode => n !== null);
  if (nodes.length < 3) throw new Error('At least 3 valid nodes required for distribution');

  const method = input.method ?? 'SPACING';

  nodes.sort((a, b) => (input.axis === 'HORIZONTAL' ? a.x - b.x : a.y - b.y));

  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (!first || !last) {
    throw new Error('Cannot distribute: need at least 2 nodes');
  }

  if (method === 'SPACING') {
    return distributeBySpacing(nodes, first, last, input.axis, input.spacing);
  }
  return distributeByCenters(nodes, first, last, input.axis);
}

function distributeBySpacing(
  nodes: SceneNode[],
  first: SceneNode,
  last: SceneNode,
  axis: string,
  explicitSpacing?: number
): OperationResult {
  const dim = axis === 'HORIZONTAL' ? 'width' : 'height';
  const pos = axis === 'HORIZONTAL' ? 'x' : 'y';

  const firstEnd = first[pos] + getNodeDimensions(first)[dim];
  const lastStart = last[pos];
  const spacing = explicitSpacing ?? (lastStart - firstEnd) / (nodes.length - 1);

  let current = firstEnd;
  for (let i = 1; i < nodes.length - 1; i++) {
    const node = nodes[i];
    if (!node) {
      continue;
    }
    current += spacing;
    node[pos] = current;
    current += getNodeDimensions(node)[dim];
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
): OperationResult {
  const dim = axis === 'HORIZONTAL' ? 'width' : 'height';
  const pos = axis === 'HORIZONTAL' ? 'x' : 'y';

  const firstCenter = first[pos] + getNodeDimensions(first)[dim] / 2;
  const lastCenter = last[pos] + getNodeDimensions(last)[dim] / 2;
  const spacing = (lastCenter - firstCenter) / (nodes.length - 1);

  for (let i = 1; i < nodes.length - 1; i++) {
    const node = nodes[i];
    if (!node) {
      continue;
    }
    const targetCenter = firstCenter + spacing * i;
    node[pos] = targetCenter - getNodeDimensions(node)[dim] / 2;
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

export function handleConnectShapes(payload: Record<string, unknown>): OperationResult {
  const input = connectShapesSchema.parse(payload);

  const sourceNode = getNode(input.sourceNodeId);
  const targetNode = getNode(input.targetNodeId);
  if (!sourceNode || !targetNode) throw new Error('Source or target node not found');

  const method = input.method ?? 'POSITION_OVERLAP';
  const overlap = input.overlap ?? 5;
  const targetAnchor = input.targetAnchor ?? 'CENTER';
  const sourceAnchor = input.sourceAnchor ?? 'CENTER';

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
  if (method === 'UNION' && input.unionResult !== false) {
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
  return positions[anchor] ?? positions['CENTER'] ?? { x: x + w / 2, y: y + h / 2 };
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
  return offsets[anchor] ?? offsets['CENTER'] ?? { x: tx - sw / 2, y: ty - sh / 2 };
}
