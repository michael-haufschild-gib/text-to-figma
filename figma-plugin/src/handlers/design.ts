/**
 * Batch Design Creation Handler
 *
 * Creates an entire design hierarchy in a single atomic operation.
 */

import { cacheNode, hexToRgb, loadFont, convertEffects } from '../helpers.js';
import { checkEnum, validatePayload, type ValidationRule } from '../validate.js';

const LAYOUT_MODES = ['HORIZONTAL', 'VERTICAL'] as const;
const SIZING_VALUES = ['FIXED', 'HUG', 'FILL'] as const;
const STROKE_ALIGNS = ['INSIDE', 'OUTSIDE', 'CENTER'] as const;
const PRIMARY_AXIS_ALIGNS = ['MIN', 'MAX', 'CENTER', 'SPACE_BETWEEN'] as const;
const COUNTER_AXIS_ALIGNS = ['MIN', 'MAX', 'CENTER', 'BASELINE'] as const;
const TEXT_ALIGNS = ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'] as const;

const createDesignRules: ValidationRule[] = [{ field: 'spec', type: 'object', required: true }];

interface NodeSpec {
  type: string;
  name?: string;
  props?: Record<string, unknown>;
  children?: NodeSpec[];
}

function instantiateNode(name: string, props: Record<string, unknown>, type: string): SceneNode {
  switch (type) {
    case 'frame':
      return createFrameNode(name, props);
    case 'ellipse':
      return createEllipseNode(name, props);
    case 'rectangle':
      return createRectangleNode(name, props);
    case 'line':
      return createLineNode(name, props);
    default:
      throw new Error(`Unsupported node type: ${type}`);
  }
}

async function buildNodeTree(
  nodeSpec: NodeSpec,
  nodeMap: Map<string, SceneNode>,
  counter: { value: number },
  parent?: FrameNode | GroupNode
): Promise<SceneNode> {
  const props = nodeSpec.props ?? {};
  const name = nodeSpec.name ?? `${nodeSpec.type}_${counter.value++}`;

  const node =
    nodeSpec.type === 'text'
      ? await createTextNode(name, props)
      : instantiateNode(name, props, nodeSpec.type);

  if (parent && 'appendChild' in parent) {
    parent.appendChild(node);
  } else {
    figma.currentPage.appendChild(node);
  }

  const hSizing = checkEnum(props.horizontalSizing, SIZING_VALUES);
  if (hSizing !== undefined && 'layoutSizingHorizontal' in node) {
    (node as FrameNode).layoutSizingHorizontal = hSizing;
  }
  const vSizing = checkEnum(props.verticalSizing, SIZING_VALUES);
  if (vSizing !== undefined && 'layoutSizingVertical' in node) {
    (node as FrameNode).layoutSizingVertical = vSizing;
  }

  cacheNode(node);
  nodeMap.set(name, node);

  if (nodeSpec.children !== undefined && nodeSpec.children.length > 0 && 'appendChild' in node) {
    for (const childSpec of nodeSpec.children) {
      await buildNodeTree(childSpec, nodeMap, counter, node as FrameNode);
    }
  }

  return node;
}

function buildDesignResponse(
  rootNode: SceneNode,
  nodeMap: Map<string, SceneNode>
): Record<string, unknown> {
  const nodeIds: Record<string, string> = {};
  const nodes: Array<Record<string, unknown>> = [];

  for (const [nodeName, n] of nodeMap) {
    nodeIds[nodeName] = n.id;

    let parentId: string | null = null;
    if (n.parent) {
      for (const potentialParent of nodeMap.values()) {
        if (potentialParent === n.parent) {
          parentId = potentialParent.id;
        }
      }
      if (parentId === null && n.parent.id !== figma.currentPage.id) {
        parentId = n.parent.id;
      }
    }

    nodes.push({
      nodeId: n.id,
      type: n.type,
      name: n.name,
      parentId,
      bounds: { x: n.x, y: n.y, width: n.width, height: n.height }
    });
  }

  return { rootNodeId: rootNode.id, nodeIds, nodes, totalNodes: nodeMap.size };
}

export async function handleCreateDesign(payload: Record<string, unknown>): Promise<unknown> {
  const error = validatePayload(payload, createDesignRules);
  if (error !== null) throw new Error(error);

  const spec = payload.spec as NodeSpec;
  const nodeMap = new Map<string, SceneNode>();

  let rootParent: FrameNode | GroupNode | undefined;
  if (typeof payload.parentId === 'string') {
    const parentNode = (await figma.getNodeByIdAsync(payload.parentId)) as SceneNode | null;
    if (parentNode !== null && 'appendChild' in parentNode) {
      rootParent = parentNode as FrameNode | GroupNode;
    } else {
      throw new Error(`Parent node not found or cannot contain children: ${payload.parentId}`);
    }
  }

  const rootNode = await buildNodeTree(spec, nodeMap, { value: 0 }, rootParent);
  figma.viewport.scrollAndZoomIntoView([rootNode]);

  const response = buildDesignResponse(rootNode, nodeMap);
  return { ...response, message: `Design created successfully with ${String(nodeMap.size)} nodes` };
}

function applyFrameFills(frame: FrameNode, props: Record<string, unknown>): void {
  if (Array.isArray(props.fills)) {
    frame.fills = props.fills as Paint[];
  } else if (typeof props.fillColor === 'string') {
    const rgb = hexToRgb(props.fillColor);
    const opacity = typeof props.fillOpacity === 'number' ? props.fillOpacity : 1;
    frame.fills = [{ type: 'SOLID', color: rgb, opacity }];
  }
}

function applyFrameStroke(frame: FrameNode, props: Record<string, unknown>): void {
  if (typeof props.strokeColor === 'string') {
    frame.strokes = [{ type: 'SOLID', color: hexToRgb(props.strokeColor) }];
    if (typeof props.strokeWeight === 'number') {
      frame.strokeWeight = props.strokeWeight;
    }
    const strokeAlign = checkEnum(props.strokeAlign, STROKE_ALIGNS);
    if (strokeAlign !== undefined) {
      frame.strokeAlign = strokeAlign;
    }
  }
}

function applyFrameLayout(frame: FrameNode, props: Record<string, unknown>): void {
  const layoutMode = checkEnum(props.layoutMode, LAYOUT_MODES);
  if (layoutMode !== undefined) {
    frame.layoutMode = layoutMode;
  }
  if (typeof props.itemSpacing === 'number') {
    frame.itemSpacing = props.itemSpacing;
  }
  const primaryAxisAlignItems = checkEnum(props.primaryAxisAlignItems, PRIMARY_AXIS_ALIGNS);
  if (primaryAxisAlignItems !== undefined) {
    frame.primaryAxisAlignItems = primaryAxisAlignItems;
  }
  const counterAxisAlignItems = checkEnum(props.counterAxisAlignItems, COUNTER_AXIS_ALIGNS);
  if (counterAxisAlignItems !== undefined) {
    frame.counterAxisAlignItems = counterAxisAlignItems;
  }
}

function applyFramePadding(frame: FrameNode, props: Record<string, unknown>): void {
  if (typeof props.padding === 'number') {
    const p = props.padding;
    frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = p;
  }
  if (typeof props.paddingLeft === 'number') frame.paddingLeft = props.paddingLeft;
  if (typeof props.paddingRight === 'number') frame.paddingRight = props.paddingRight;
  if (typeof props.paddingTop === 'number') frame.paddingTop = props.paddingTop;
  if (typeof props.paddingBottom === 'number') frame.paddingBottom = props.paddingBottom;
}

function createFrameNode(name: string, props: Record<string, unknown>): FrameNode {
  const frame = figma.createFrame();
  frame.name = name;
  frame.x = typeof props.x === 'number' ? props.x : 0;
  frame.y = typeof props.y === 'number' ? props.y : 0;
  frame.fills = [];

  if (typeof props.width === 'number') frame.resize(props.width, frame.height);
  if (typeof props.height === 'number') frame.resize(frame.width, props.height);

  applyFrameLayout(frame, props);
  applyFramePadding(frame, props);
  applyFrameFills(frame, props);
  if (typeof props.cornerRadius === 'number') frame.cornerRadius = props.cornerRadius;
  applyFrameStroke(frame, props);
  if (Array.isArray(props.effects)) {
    frame.effects = convertEffects(props.effects as Array<Record<string, unknown>>);
  }

  return frame;
}

async function createTextNode(name: string, props: Record<string, unknown>): Promise<TextNode> {
  const fontFamily = typeof props.fontFamily === 'string' ? props.fontFamily : 'Inter';
  const fontWeight = typeof props.fontWeight === 'number' ? props.fontWeight : 400;
  const fontName = await loadFont(fontFamily, fontWeight);

  const text = figma.createText();
  text.name = name;
  text.fontName = fontName;
  const content = typeof props.content === 'string' ? props.content : undefined;
  const textProp = typeof props.text === 'string' ? props.text : undefined;
  text.characters = content ?? textProp ?? '';
  text.fontSize = typeof props.fontSize === 'number' ? props.fontSize : 16;

  if (typeof props.color === 'string') {
    text.fills = [{ type: 'SOLID', color: hexToRgb(props.color) }];
  }
  const textAlign = checkEnum(props.textAlign, TEXT_ALIGNS);
  if (textAlign !== undefined) {
    text.textAlignHorizontal = textAlign;
  }
  if (typeof props.lineHeight === 'number') {
    text.lineHeight = { value: props.lineHeight, unit: 'PIXELS' };
  }
  if (typeof props.letterSpacing === 'number') {
    text.letterSpacing = { value: props.letterSpacing, unit: 'PIXELS' };
  }

  return text;
}

function createEllipseNode(name: string, props: Record<string, unknown>): EllipseNode {
  const ellipse = figma.createEllipse();
  ellipse.name = name;
  const w = typeof props.width === 'number' ? props.width : 100;
  const h = typeof props.height === 'number' ? props.height : 100;
  ellipse.resize(w, h);

  if (typeof props.fillColor === 'string') {
    ellipse.fills = [{ type: 'SOLID', color: hexToRgb(props.fillColor) }];
  }
  if (typeof props.strokeColor === 'string') {
    ellipse.strokes = [{ type: 'SOLID', color: hexToRgb(props.strokeColor) }];
    if (typeof props.strokeWeight === 'number') {
      ellipse.strokeWeight = props.strokeWeight;
    }
  }

  return ellipse;
}

function createRectangleNode(name: string, props: Record<string, unknown>): RectangleNode {
  const rect = figma.createRectangle();
  rect.name = name;
  const w = typeof props.width === 'number' ? props.width : 100;
  const h = typeof props.height === 'number' ? props.height : 100;
  rect.resize(w, h);

  if (typeof props.fillColor === 'string') {
    rect.fills = [{ type: 'SOLID', color: hexToRgb(props.fillColor) }];
  }
  if (typeof props.cornerRadius === 'number') {
    rect.cornerRadius = props.cornerRadius;
  }
  if (typeof props.strokeColor === 'string') {
    rect.strokes = [{ type: 'SOLID', color: hexToRgb(props.strokeColor) }];
    if (typeof props.strokeWeight === 'number') {
      rect.strokeWeight = props.strokeWeight;
    }
  }

  return rect;
}

function createLineNode(name: string, props: Record<string, unknown>): LineNode {
  const line = figma.createLine();
  line.name = name;
  const w = typeof props.width === 'number' ? props.width : 100;
  line.resize(w, 0);

  if (typeof props.strokeColor === 'string') {
    line.strokes = [{ type: 'SOLID', color: hexToRgb(props.strokeColor) }];
    if (typeof props.strokeWeight === 'number') {
      line.strokeWeight = props.strokeWeight;
    }
  }

  return line;
}
