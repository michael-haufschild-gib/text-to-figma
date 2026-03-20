/**
 * Transform Command Handler
 *
 * Handles: set_transform (position, size, rotation, scale, flip)
 */

import { getNode } from '../helpers.js';

export function handleSetTransform(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node) throw new Error('Node not found');

  if (payload.position) {
    const pos = payload.position as { x: number; y: number };
    node.x = pos.x;
    node.y = pos.y;
  }
  if (payload.size && 'resize' in node) {
    const size = payload.size as { width: number; height: number };
    (node as FrameNode).resize(size.width, size.height);
  }
  if (payload.rotation !== undefined && 'rotation' in node) {
    (node as FrameNode).rotation = payload.rotation as number;
  }
  if (payload.scale && 'resize' in node) {
    const scale = payload.scale as { x: number; y: number };
    (node as FrameNode).resize(node.width * scale.x, node.height * scale.y);
  }
  if (payload.flip && 'resize' in node) {
    const direction = payload.flip as string;
    if (direction === 'HORIZONTAL' || direction === 'BOTH') {
      (node as FrameNode).resize(-node.width, node.height);
    }
    if (direction === 'VERTICAL' || direction === 'BOTH') {
      (node as FrameNode).resize(node.width, -node.height);
    }
  }

  return { nodeId: payload.nodeId, message: 'Transform applied successfully' };
}
