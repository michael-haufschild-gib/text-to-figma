/**
 * Layout Command Handlers
 *
 * Handles: set_layout_properties, set_layout_align, set_layout_sizing,
 * set_constraints, set_layer_order, add_layout_grid
 */

import { getNode, hexToRgb } from '../helpers.js';
import { validatePayload } from '../validate.js';
import type { ValidationRule } from '../validate.js';

const setLayoutPropertiesRules: ValidationRule[] = [
  { field: 'nodeId', type: 'string', required: true },
  { field: 'layoutMode', type: 'string' },
  { field: 'itemSpacing', type: 'number' },
  { field: 'padding', type: 'number' }
];

export function handleSetLayoutProperties(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, setLayoutPropertiesRules);
  if (error !== null) throw new Error(error);

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
