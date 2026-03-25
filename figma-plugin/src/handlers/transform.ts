/**
 * Transform Command Handler
 *
 * Handles: set_transform (position, size, rotation, scale, flip)
 */

import { z } from 'zod';
import { getNode } from '../helpers.js';

// ── Return types ─────────────────────────────────────────────────────────────

interface OperationResult {
  nodeId: string;
  message: string;
}

const FLIP_DIRECTIONS = ['HORIZONTAL', 'VERTICAL', 'BOTH'] as const;

const setTransformSchema = z.object({
  nodeId: z.string(),
  position: z
    .object({
      x: z.number().optional(),
      y: z.number().optional()
    })
    .optional(),
  size: z
    .object({
      width: z.number().optional(),
      height: z.number().optional()
    })
    .optional(),
  rotation: z.number().optional(),
  scale: z
    .object({
      x: z.number(),
      y: z.number()
    })
    .optional(),
  flip: z.enum(FLIP_DIRECTIONS).optional()
});

function applyPosition(node: SceneNode, position: { x?: number; y?: number }): void {
  if (position.x !== undefined) node.x = position.x;
  if (position.y !== undefined) node.y = position.y;
}

function applySize(node: SceneNode, size: { width?: number; height?: number }): void {
  if (!('resize' in node)) return;
  if (size.width !== undefined || size.height !== undefined) {
    const w = size.width ?? node.width;
    const h = size.height ?? node.height;
    (node as FrameNode).resize(w, h);
  }
}

function applyScale(node: SceneNode, scale: { x: number; y: number }): void {
  if (!('resize' in node)) return;
  (node as FrameNode).resize(node.width * scale.x, node.height * scale.y);
}

/**
 * Apply flip by mutating the node's relativeTransform matrix.
 *
 * ORDER MATTERS: For 'BOTH', horizontal is applied first, then vertical
 * reads the post-horizontal transform. The two operations compose correctly
 * because H-flip negates row 0 col 0 while V-flip negates row 1 col 1 —
 * orthogonal axes that don't interfere. Do not reorder these blocks.
 */
function applyFlip(node: SceneNode, flip: (typeof FLIP_DIRECTIONS)[number]): void {
  if (!('relativeTransform' in node)) return;
  const n = node as SceneNode & { relativeTransform: Transform };
  const t = n.relativeTransform;
  if (flip === 'HORIZONTAL' || flip === 'BOTH') {
    n.relativeTransform = [
      [-t[0][0], t[0][1], t[0][2] + node.width],
      [t[1][0], t[1][1], t[1][2]]
    ];
  }
  if (flip === 'VERTICAL' || flip === 'BOTH') {
    const cur = n.relativeTransform;
    n.relativeTransform = [
      [cur[0][0], cur[0][1], cur[0][2]],
      [cur[1][0], -cur[1][1], cur[1][2] + node.height]
    ];
  }
}

export function handleSetTransform(payload: Record<string, unknown>): OperationResult {
  const input = setTransformSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node) throw new Error('Node not found');

  if (input.position !== undefined) applyPosition(node, input.position);
  if (input.size !== undefined) applySize(node, input.size);
  if (input.rotation !== undefined && 'rotation' in node) {
    (node as FrameNode).rotation = input.rotation;
  }
  if (input.scale !== undefined) applyScale(node, input.scale);
  if (input.flip !== undefined) applyFlip(node, input.flip);

  return { nodeId: input.nodeId, message: 'Transform applied successfully' };
}
