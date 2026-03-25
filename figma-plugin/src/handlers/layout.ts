/**
 * Layout Command Handlers
 *
 * Handles: set_layout_properties, set_layout_align, set_layout_sizing,
 * set_constraints, set_layer_order, add_layout_grid
 */

import { z } from 'zod';
import { getNode, hexToRgb } from '../helpers.js';

// ── Return types ─────────────────────────────────────────────────────────────

interface OperationResult {
  nodeId: unknown;
  message: string;
  [key: string]: unknown;
}

const LAYOUT_MODES = ['HORIZONTAL', 'VERTICAL'] as const;
const SIZING_VALUES = ['FIXED', 'HUG', 'FILL'] as const;
const LAYOUT_POSITIONING_VALUES = ['AUTO', 'ABSOLUTE'] as const;
const PRIMARY_AXIS_ALIGNS = ['MIN', 'MAX', 'CENTER', 'SPACE_BETWEEN'] as const;
const COUNTER_AXIS_ALIGNS = ['MIN', 'MAX', 'CENTER', 'BASELINE'] as const;
const CONSTRAINT_TYPES = ['MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE'] as const;
const GRID_PATTERNS = ['COLUMNS', 'ROWS', 'GRID'] as const;
const GRID_ALIGNS = ['MIN', 'MAX', 'STRETCH', 'CENTER'] as const;
const LAYER_ORDER_ACTIONS = [
  'BRING_TO_FRONT',
  'BRING_FORWARD',
  'SEND_BACKWARD',
  'SEND_TO_BACK',
  'SET_INDEX'
] as const;

const setLayoutPropertiesSchema = z.object({
  nodeId: z.string(),
  layoutMode: z.enum(LAYOUT_MODES).optional(),
  itemSpacing: z.number().optional(),
  padding: z.number().optional(),
  paddingTop: z.number().optional(),
  paddingRight: z.number().optional(),
  paddingBottom: z.number().optional(),
  paddingLeft: z.number().optional()
});

export function handleSetLayoutProperties(payload: Record<string, unknown>): OperationResult {
  const input = setLayoutPropertiesSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node || !('layoutMode' in node)) throw new Error('Node does not support auto-layout');

  const frame = node as FrameNode;
  if (input.layoutMode !== undefined) {
    frame.layoutMode = input.layoutMode;
  }
  if (input.itemSpacing !== undefined) frame.itemSpacing = input.itemSpacing;
  if (input.padding !== undefined) {
    const p = input.padding;
    frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = p;
  }
  if (input.paddingTop !== undefined) frame.paddingTop = input.paddingTop;
  if (input.paddingRight !== undefined) frame.paddingRight = input.paddingRight;
  if (input.paddingBottom !== undefined) frame.paddingBottom = input.paddingBottom;
  if (input.paddingLeft !== undefined) frame.paddingLeft = input.paddingLeft;

  return { nodeId: input.nodeId, message: 'Layout properties updated successfully' };
}

const setLayoutAlignSchema = z.object({
  nodeId: z.string(),
  primaryAxis: z.enum(PRIMARY_AXIS_ALIGNS).optional(),
  counterAxis: z.enum(COUNTER_AXIS_ALIGNS).optional()
});

export function handleSetLayoutAlign(payload: Record<string, unknown>): OperationResult {
  const input = setLayoutAlignSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node || !('primaryAxisAlignItems' in node))
    throw new Error('Node does not support layout alignment');

  const frame = node as FrameNode;
  if (input.primaryAxis !== undefined) {
    frame.primaryAxisAlignItems = input.primaryAxis;
  }
  if (input.counterAxis !== undefined) {
    frame.counterAxisAlignItems = input.counterAxis;
  }

  return { nodeId: input.nodeId, message: 'Layout alignment set successfully' };
}

const setLayoutSizingSchema = z.object({
  nodeId: z.string(),
  horizontal: z.enum(SIZING_VALUES).optional(),
  vertical: z.enum(SIZING_VALUES).optional(),
  layoutPositioning: z.enum(LAYOUT_POSITIONING_VALUES).optional()
});

export function handleSetLayoutSizing(payload: Record<string, unknown>): OperationResult {
  const input = setLayoutSizingSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node || !('layoutSizingHorizontal' in node))
    throw new Error('Node does not support layout sizing');

  const frame = node as FrameNode;
  if (input.horizontal !== undefined) {
    frame.layoutSizingHorizontal = input.horizontal;
  }
  if (input.vertical !== undefined) {
    frame.layoutSizingVertical = input.vertical;
  }
  if (input.layoutPositioning !== undefined && 'layoutPositioning' in node) {
    (node as SceneNode & { layoutPositioning: 'AUTO' | 'ABSOLUTE' }).layoutPositioning =
      input.layoutPositioning;
  }

  return { nodeId: input.nodeId, message: 'Layout sizing set successfully' };
}

const setConstraintsSchema = z.object({
  nodeId: z.string(),
  horizontal: z.enum(CONSTRAINT_TYPES).optional(),
  vertical: z.enum(CONSTRAINT_TYPES).optional()
});

export function handleSetConstraints(payload: Record<string, unknown>): OperationResult {
  const input = setConstraintsSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node || !('constraints' in node)) throw new Error('Node does not support constraints');

  const h = input.horizontal ?? 'MIN';
  const v = input.vertical ?? 'MIN';

  (node as ConstraintMixin).constraints = { horizontal: h, vertical: v };

  return {
    nodeId: input.nodeId,
    applied: [
      input.horizontal !== undefined ? `horizontal: ${input.horizontal}` : '',
      input.vertical !== undefined ? `vertical: ${input.vertical}` : ''
    ].filter((s) => s !== ''),
    message: 'Constraints applied successfully'
  };
}

const setLayerOrderSchema = z.object({
  nodeId: z.string(),
  action: z.enum(LAYER_ORDER_ACTIONS),
  index: z.number().optional()
});

export function handleSetLayerOrder(payload: Record<string, unknown>): OperationResult {
  const input = setLayerOrderSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node) throw new Error('Node not found');
  const parent = node.parent;
  if (!parent || !('children' in parent)) throw new Error('Node has no valid parent');

  const currentIndex = parent.children.indexOf(node);

  switch (input.action) {
    case 'BRING_TO_FRONT':
      parent.insertChild(parent.children.length - 1, node);
      break;
    case 'BRING_FORWARD':
      parent.insertChild(Math.min(currentIndex + 1, parent.children.length - 1), node);
      break;
    case 'SEND_BACKWARD':
      parent.insertChild(Math.max(currentIndex - 1, 0), node);
      break;
    case 'SEND_TO_BACK':
      parent.insertChild(0, node);
      break;
    case 'SET_INDEX':
      if (input.index === undefined) throw new Error('index must be a number');
      parent.insertChild(Math.max(0, Math.min(input.index, parent.children.length - 1)), node);
      break;
  }

  return {
    nodeId: input.nodeId,
    newIndex: parent.children.indexOf(node),
    message: 'Layer order updated successfully'
  };
}

const addLayoutGridSchema = z.object({
  nodeId: z.string(),
  pattern: z.enum(GRID_PATTERNS).optional(),
  color: z.string().optional(),
  sectionSize: z.number().optional(),
  visible: z.boolean().optional(),
  count: z.number().optional(),
  gutter: z.number().optional(),
  margin: z.number().optional(),
  alignment: z.enum(GRID_ALIGNS).optional()
});

export function handleAddLayoutGrid(payload: Record<string, unknown>): OperationResult {
  const input = addLayoutGridSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node || !('layoutGrids' in node)) throw new Error('Node does not support layout grids');

  const frame = node as FrameNode;
  const pattern = input.pattern ?? 'COLUMNS';
  const gridColor =
    input.color !== undefined ? { ...hexToRgb(input.color), a: 0.1 } : { r: 1, g: 0, b: 0, a: 0.1 };

  let grid: LayoutGrid;
  let responseCount: number | undefined;
  let responseGutter: number | undefined;
  let responseMargin: number | undefined;

  if (pattern === 'GRID') {
    grid = {
      pattern: 'GRID',
      sectionSize: input.sectionSize ?? 64,
      visible: input.visible !== false,
      color: gridColor
    };
  } else {
    const count = input.count ?? 12;
    const gutterSize = input.gutter ?? 16;
    const offset = input.margin ?? 0;
    const alignment = input.alignment ?? 'MIN';

    grid = {
      pattern,
      sectionSize: input.sectionSize ?? 64,
      visible: input.visible !== false,
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
    nodeId: input.nodeId,
    pattern,
    count: responseCount,
    gutter: responseGutter,
    margin: responseMargin,
    message: 'Layout grid added successfully'
  };
}
