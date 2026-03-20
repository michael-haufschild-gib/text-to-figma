/**
 * Batch Design Creation Handler
 *
 * Creates an entire design hierarchy in a single atomic operation.
 */

import { cacheNode, hexToRgb, loadFont, convertEffects } from '../helpers.js';

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

  if (props.horizontalSizing !== undefined && 'layoutSizingHorizontal' in node) {
    (node as FrameNode).layoutSizingHorizontal = props.horizontalSizing as 'FIXED' | 'HUG' | 'FILL';
  }
  if (props.verticalSizing !== undefined && 'layoutSizingVertical' in node) {
    (node as FrameNode).layoutSizingVertical = props.verticalSizing as 'FIXED' | 'HUG' | 'FILL';
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
    if (typeof props.strokeAlign === 'string') {
      frame.strokeAlign = props.strokeAlign as 'INSIDE' | 'OUTSIDE' | 'CENTER';
    }
  }
}

function applyFrameLayout(frame: FrameNode, props: Record<string, unknown>): void {
  if (typeof props.layoutMode === 'string' && props.layoutMode !== 'NONE') {
    frame.layoutMode = props.layoutMode as 'HORIZONTAL' | 'VERTICAL';
  }
  if (props.itemSpacing !== undefined) {
    frame.itemSpacing = props.itemSpacing as number;
  }
  if (props.primaryAxisAlignItems !== undefined) {
    frame.primaryAxisAlignItems = props.primaryAxisAlignItems as FrameNode['primaryAxisAlignItems'];
  }
  if (props.counterAxisAlignItems !== undefined) {
    frame.counterAxisAlignItems = props.counterAxisAlignItems as FrameNode['counterAxisAlignItems'];
  }
}

function applyFramePadding(frame: FrameNode, props: Record<string, unknown>): void {
  if (props.padding !== undefined) {
    const p = props.padding as number;
    frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = p;
  }
  if (props.paddingLeft !== undefined) frame.paddingLeft = props.paddingLeft as number;
  if (props.paddingRight !== undefined) frame.paddingRight = props.paddingRight as number;
  if (props.paddingTop !== undefined) frame.paddingTop = props.paddingTop as number;
  if (props.paddingBottom !== undefined) frame.paddingBottom = props.paddingBottom as number;
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
  if (props.cornerRadius !== undefined) frame.cornerRadius = props.cornerRadius as number;
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
  if (typeof props.textAlign === 'string') {
    text.textAlignHorizontal = props.textAlign as TextNode['textAlignHorizontal'];
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
  if (props.cornerRadius !== undefined) {
    rect.cornerRadius = props.cornerRadius as number;
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
