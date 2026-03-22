/**
 * Layout Command Handlers
 *
 * Handles: set_layout_properties, set_layout_align, set_layout_sizing,
 * set_constraints, set_layer_order, add_layout_grid
 */

import { getNode, hexToRgb } from '../helpers.js';
import { checkEnum, validatePayload } from '../validate.js';
import type { ValidationRule } from '../validate.js';

const LAYOUT_MODES = ['HORIZONTAL', 'VERTICAL'] as const;
const SIZING_VALUES = ['FIXED', 'HUG', 'FILL'] as const;
const PRIMARY_AXIS_ALIGNS = ['MIN', 'MAX', 'CENTER', 'SPACE_BETWEEN'] as const;
const COUNTER_AXIS_ALIGNS = ['MIN', 'MAX', 'CENTER', 'BASELINE'] as const;
const CONSTRAINT_TYPES = ['MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE'] as const;
const GRID_PATTERNS = ['COLUMNS', 'ROWS', 'GRID'] as const;
const GRID_ALIGNS = ['MIN', 'MAX', 'STRETCH', 'CENTER'] as const;

const setLayoutPropertiesRules: ValidationRule[] = [
  { field: 'nodeId', type: 'string', required: true },
  { field: 'layoutMode', type: 'string', enum: LAYOUT_MODES },
  { field: 'itemSpacing', type: 'number' },
  { field: 'padding', type: 'number' }
];

export function handleSetLayoutProperties(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, setLayoutPropertiesRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
  if (!node || !('layoutMode' in node)) throw new Error('Node does not support auto-layout');

  const frame = node as FrameNode;
  const layoutMode = checkEnum(payload.layoutMode, LAYOUT_MODES);
  if (layoutMode !== undefined) {
    frame.layoutMode = layoutMode;
  }
  if (typeof payload.itemSpacing === 'number') frame.itemSpacing = payload.itemSpacing;
  if (typeof payload.padding === 'number') {
    const p = payload.padding;
    frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = p;
  }

  return { nodeId: payload.nodeId, message: 'Layout properties updated successfully' };
}

export function handleSetLayoutAlign(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node || !('primaryAxisAlignItems' in node))
    throw new Error('Node does not support layout alignment');

  const frame = node as FrameNode;
  const primaryAxis = checkEnum(payload.primaryAxis, PRIMARY_AXIS_ALIGNS);
  if (primaryAxis !== undefined) {
    frame.primaryAxisAlignItems = primaryAxis;
  }
  const counterAxis = checkEnum(payload.counterAxis, COUNTER_AXIS_ALIGNS);
  if (counterAxis !== undefined) {
    frame.counterAxisAlignItems = counterAxis;
  }

  return { nodeId: payload.nodeId, message: 'Layout alignment set successfully' };
}

export function handleSetLayoutSizing(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node || !('layoutSizingHorizontal' in node))
    throw new Error('Node does not support layout sizing');

  const frame = node as FrameNode;
  const horizontal = checkEnum(payload.horizontal, SIZING_VALUES);
  if (horizontal !== undefined) {
    frame.layoutSizingHorizontal = horizontal;
  }
  const vertical = checkEnum(payload.vertical, SIZING_VALUES);
  if (vertical !== undefined) {
    frame.layoutSizingVertical = vertical;
  }

  return { nodeId: payload.nodeId, message: 'Layout sizing set successfully' };
}

export function handleSetConstraints(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node || !('constraints' in node)) throw new Error('Node does not support constraints');

  const h = checkEnum(payload.horizontal, CONSTRAINT_TYPES) ?? 'MIN';
  const v = checkEnum(payload.vertical, CONSTRAINT_TYPES) ?? 'MIN';

  (node as ConstraintMixin).constraints = { horizontal: h, vertical: v };

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
      if (typeof payload.index !== 'number') throw new Error('index must be a number');
      (parent as FrameNode).insertChild(
        Math.max(0, Math.min(payload.index, (parent as FrameNode).children.length - 1)),
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
  const pattern = checkEnum(payload.pattern, GRID_PATTERNS) ?? 'COLUMNS';
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
    const alignment = checkEnum(payload.alignment, GRID_ALIGNS) ?? 'MIN';

    grid = {
      pattern,
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
