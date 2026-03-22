/**
 * Transform Command Handler
 *
 * Handles: set_transform (position, size, rotation, scale, flip)
 */

import { getNode } from '../helpers.js';
import { validatePayload, type ValidationRule } from '../validate.js';

const FLIP_DIRECTIONS = ['HORIZONTAL', 'VERTICAL', 'BOTH'] as const;

const setTransformRules: ValidationRule[] = [{ field: 'nodeId', type: 'string', required: true }];

function applyPosition(node: SceneNode, position: unknown): void {
  if (typeof position !== 'object' || position === null) return;
  const pos = position as Record<string, unknown>;
  if (typeof pos.x === 'number') node.x = pos.x;
  if (typeof pos.y === 'number') node.y = pos.y;
}

function applySize(node: SceneNode, size: unknown): void {
  if (typeof size !== 'object' || size === null || !('resize' in node)) return;
  const s = size as Record<string, unknown>;
  if (typeof s.width === 'number' && typeof s.height === 'number') {
    (node as FrameNode).resize(s.width, s.height);
  }
}

function applyScale(node: SceneNode, scale: unknown): void {
  if (typeof scale !== 'object' || scale === null || !('resize' in node)) return;
  const s = scale as Record<string, unknown>;
  if (typeof s.x === 'number' && typeof s.y === 'number') {
    (node as FrameNode).resize(node.width * s.x, node.height * s.y);
  }
}

function applyFlip(node: SceneNode, flip: unknown): void {
  if (typeof flip !== 'string' || !('resize' in node)) return;
  if (!(FLIP_DIRECTIONS as readonly string[]).includes(flip)) return;
  if (flip === 'HORIZONTAL' || flip === 'BOTH') {
    (node as FrameNode).resize(-node.width, node.height);
  }
  if (flip === 'VERTICAL' || flip === 'BOTH') {
    (node as FrameNode).resize(node.width, -node.height);
  }
}

export function handleSetTransform(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, setTransformRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
  if (!node) throw new Error('Node not found');

  applyPosition(node, payload.position);
  applySize(node, payload.size);
  if (typeof payload.rotation === 'number' && 'rotation' in node) {
    (node as FrameNode).rotation = payload.rotation;
  }
  applyScale(node, payload.scale);
  applyFlip(node, payload.flip);

  return { nodeId: payload.nodeId, message: 'Transform applied successfully' };
}
