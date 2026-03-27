/**
 * Path Command Handlers
 *
 * Handles: create_path, edit_path, batch_create_path
 * Supports structured command arrays (M, L, C, Q, A, Z) and raw SVG path strings.
 */

import { z } from 'zod';
import { cacheNode, getNode, hexToRgb, resolveParent } from '../helpers.js';

// ── Return types ─────────────────────────────────────────────────────────────

interface OperationResult {
  message: string;
  [key: string]: unknown;
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const pathCommandSchema = z.object({
  type: z.string(),
  x: z.number().optional(),
  y: z.number().optional(),
  x1: z.number().optional(),
  y1: z.number().optional(),
  x2: z.number().optional(),
  y2: z.number().optional(),
  rx: z.number().optional(),
  ry: z.number().optional(),
  rotation: z.number().optional(),
  largeArcFlag: z.number().optional(),
  sweepFlag: z.number().optional()
});

const createPathSchema = z.object({
  name: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  commands: z.array(pathCommandSchema).optional(),
  svgPath: z.string().optional(),
  closed: z.boolean().optional(),
  fillColor: z.string().optional(),
  fillOpacity: z.number().optional(),
  strokeColor: z.string().optional(),
  strokeWeight: z.number().optional(),
  parentId: z.string().optional()
});

// ── Handlers ─────────────────────────────────────────────────────────────────

export function handleCreatePath(payload: Record<string, unknown>): OperationResult {
  const input = createPathSchema.parse(payload);

  const vectorNode = createVectorFromItem(input);
  const parent = resolveParent(input.parentId);
  parent.appendChild(vectorNode);
  cacheNode(vectorNode);
  figma.viewport.scrollAndZoomIntoView([vectorNode]);

  const source =
    input.svgPath !== undefined
      ? 'SVG path string'
      : `${String(input.commands?.length ?? 0)} commands`;
  return {
    pathId: vectorNode.id,
    message: `Path created successfully with ${source}`
  };
}

export function handleEditPath(payload: Record<string, unknown>): OperationResult {
  const input = z
    .object({
      nodeId: z.string(),
      commands: z.array(pathCommandSchema).optional(),
      svgPath: z.string().optional(),
      closed: z.boolean().optional(),
      windingRule: z.enum(['NONZERO', 'EVENODD']).optional()
    })
    .parse(payload);

  const node = getNode(input.nodeId);
  if (!node) throw new Error('Node not found');
  if (node.type !== 'VECTOR') throw new Error(`Node is type ${node.type}, expected VECTOR`);

  let trimmedPath: string;

  if (input.svgPath !== undefined && input.svgPath.trim() !== '') {
    trimmedPath = input.svgPath.trim();
    if (input.closed === true && !trimmedPath.includes('Z')) {
      trimmedPath += ' Z';
    }
  } else if (input.commands !== undefined && input.commands.length > 0) {
    const firstCmd = input.commands[0];
    if (firstCmd?.type !== 'M') throw new Error('Path must start with M (Move) command');
    const pathData = buildPathData(input.commands);
    trimmedPath =
      input.closed === true && !pathData.includes('Z') ? (pathData + ' Z').trim() : pathData.trim();
  } else {
    throw new Error('Either "commands" or "svgPath" must be provided');
  }

  if (trimmedPath === '') throw new Error('Path data is empty');

  const windingRule = input.windingRule ?? 'NONZERO';
  node.vectorPaths = [{ windingRule, data: trimmedPath }];

  return {
    nodeId: node.id,
    message: `Path data updated on "${node.name}"`
  };
}

// ── Batch handler ────────────────────────────────────────────────────────────

const batchCreatePathSchema = z.object({
  paths: z.array(
    z.object({
      name: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      commands: z.array(pathCommandSchema).optional(),
      svgPath: z.string().optional(),
      closed: z.boolean().optional(),
      fillColor: z.string().optional(),
      fillOpacity: z.number().optional(),
      strokeColor: z.string().optional(),
      strokeWeight: z.number().optional()
    })
  ),
  parentId: z.string().optional()
});

export function handleBatchCreatePath(payload: Record<string, unknown>): OperationResult {
  const input = batchCreatePathSchema.parse(payload);
  const parent = resolveParent(input.parentId);
  const results: Array<{ index: number; pathId?: string; name: string; error?: string }> = [];

  for (let i = 0; i < input.paths.length; i++) {
    const item = input.paths[i];
    if (!item) continue;
    const name = item.name ?? 'Path';
    try {
      const vectorNode = createVectorFromItem(item);
      parent.appendChild(vectorNode);
      cacheNode(vectorNode);
      results.push({ index: i, pathId: vectorNode.id, name });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ index: i, name, error: msg });
    }
  }

  const created = results.filter((r) => r.pathId !== undefined).length;
  if (created > 0) {
    // Scroll to last successfully created path
    for (let j = results.length - 1; j >= 0; j--) {
      const r = results[j];
      if (!r) continue;
      if (r.pathId !== undefined) {
        const node = getNode(r.pathId);
        if (node) figma.viewport.scrollAndZoomIntoView([node]);
        break;
      }
    }
  }

  return {
    results,
    message:
      `Batch created ${String(created)} path(s)` +
      (results.length - created > 0 ? `, ${String(results.length - created)} failed` : '')
  };
}

/**
 * Creates a VectorNode from a path item definition (shared by single and batch handlers).
 * Does NOT append to parent or scroll viewport — caller handles that.
 */
function createVectorFromItem(item: {
  name?: string;
  x?: number;
  y?: number;
  commands?: z.infer<typeof pathCommandSchema>[];
  svgPath?: string;
  closed?: boolean;
  fillColor?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeWeight?: number;
}): VectorNode {
  const vectorNode = figma.createVector();
  vectorNode.name = item.name ?? 'Path';
  vectorNode.x = item.x ?? 0;
  vectorNode.y = item.y ?? 0;

  let trimmedPath: string;

  if (item.svgPath !== undefined && item.svgPath.trim() !== '') {
    trimmedPath = item.svgPath.trim();
    if (item.closed === true && !trimmedPath.includes('Z')) {
      trimmedPath += ' Z';
    }
  } else if (item.commands !== undefined && item.commands.length > 0) {
    const firstCmd = item.commands[0];
    if (firstCmd?.type !== 'M') throw new Error('Path must start with M (Move) command');
    const pathData = buildPathData(item.commands);
    trimmedPath =
      item.closed === true && !pathData.includes('Z') ? (pathData + ' Z').trim() : pathData.trim();
  } else {
    throw new Error('Either "commands" or "svgPath" must be provided');
  }

  if (trimmedPath === '') throw new Error('Generated path data is empty');

  vectorNode.vectorPaths = [{ windingRule: 'NONZERO', data: trimmedPath }];

  if (item.fillColor !== undefined) {
    const fill: SolidPaint =
      item.fillOpacity !== undefined
        ? { type: 'SOLID', color: hexToRgb(item.fillColor), opacity: item.fillOpacity }
        : { type: 'SOLID', color: hexToRgb(item.fillColor) };
    vectorNode.fills = [fill];
  } else {
    vectorNode.fills = [];
  }

  if (item.strokeColor !== undefined) {
    vectorNode.strokes = [{ type: 'SOLID', color: hexToRgb(item.strokeColor) }];
    vectorNode.strokeWeight = item.strokeWeight ?? 1;
  }

  return vectorNode;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

interface PathCommand {
  type: string;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  rx?: number;
  ry?: number;
  rotation?: number;
  largeArcFlag?: number;
  sweepFlag?: number;
}

function buildPathData(commands: PathCommand[]): string {
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
      case 'A':
        for (const k of ['rx', 'ry', 'rotation', 'largeArcFlag', 'sweepFlag', 'x', 'y']) {
          validateCoord(cmd, k, i);
        }
        pathData += `A ${String(cmd.rx)} ${String(cmd.ry)} ${String(cmd.rotation)} ${String(cmd.largeArcFlag)} ${String(cmd.sweepFlag)} ${String(cmd.x)} ${String(cmd.y)} `;
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

function validateCoord(cmd: PathCommand, key: string, index: number): void {
  const val = cmd[key as keyof PathCommand];
  if (typeof val !== 'number')
    throw new Error(
      `Command ${String(index)} (${String(cmd.type)}): Property '${key}' must be a number`
    );
  if (!isFinite(val))
    throw new Error(
      `Command ${String(index)} (${String(cmd.type)}): Property '${key}' must be a finite number`
    );
}
