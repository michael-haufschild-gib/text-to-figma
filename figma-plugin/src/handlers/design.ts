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

export async function handleCreateDesign(payload: Record<string, unknown>): Promise<unknown> {
  const spec = payload.spec as NodeSpec;
  const nodeMap = new Map<string, SceneNode>();
  let nodeCounter = 0;

  async function createNode(
    nodeSpec: NodeSpec,
    parent?: FrameNode | GroupNode
  ): Promise<SceneNode> {
    const props = nodeSpec.props || {};
    const name = nodeSpec.name || `${nodeSpec.type}_${nodeCounter++}`;
    let node: SceneNode;

    switch (nodeSpec.type) {
      case 'frame':
        node = createFrameNode(name, props);
        break;
      case 'text':
        node = await createTextNode(name, props);
        break;
      case 'ellipse':
        node = createEllipseNode(name, props);
        break;
      case 'rectangle':
        node = createRectangleNode(name, props);
        break;
      case 'line':
        node = createLineNode(name, props);
        break;
      default:
        throw new Error(`Unsupported node type: ${nodeSpec.type}`);
    }

    if (parent && 'appendChild' in parent) {
      parent.appendChild(node);
    } else {
      figma.currentPage.appendChild(node);
    }

    // Layout sizing AFTER adding to parent
    if (props.horizontalSizing && 'layoutSizingHorizontal' in node) {
      (node as FrameNode).layoutSizingHorizontal = props.horizontalSizing as
        | 'FIXED'
        | 'HUG'
        | 'FILL';
    }
    if (props.verticalSizing && 'layoutSizingVertical' in node) {
      (node as FrameNode).layoutSizingVertical = props.verticalSizing as 'FIXED' | 'HUG' | 'FILL';
    }

    cacheNode(node);
    nodeMap.set(name, node);

    if (nodeSpec.children && nodeSpec.children.length > 0 && 'appendChild' in node) {
      for (const childSpec of nodeSpec.children) {
        await createNode(childSpec, node);
      }
    }

    return node;
  }

  // Resolve optional parent
  let rootParent: FrameNode | GroupNode | undefined;
  if (payload.parentId) {
    const parentNode = (await figma.getNodeByIdAsync(payload.parentId as string)) as SceneNode;
    if (parentNode && 'appendChild' in parentNode) {
      rootParent = parentNode as FrameNode | GroupNode;
    } else {
      throw new Error(`Parent node not found or cannot contain children: ${payload.parentId}`);
    }
  }

  const rootNode = await createNode(spec, rootParent);
  figma.viewport.scrollAndZoomIntoView([rootNode]);

  // Build response
  const nodeIds: Record<string, string> = {};
  const nodes: Array<Record<string, unknown>> = [];

  nodeMap.forEach((n, nodeName) => {
    nodeIds[nodeName] = n.id;

    let parentId: string | null = null;
    if (n.parent) {
      nodeMap.forEach((potentialParent) => {
        if (potentialParent === n.parent) parentId = potentialParent.id;
      });
      if (!parentId && n.parent.id !== figma.currentPage.id) {
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
  });

  return {
    rootNodeId: rootNode.id,
    nodeIds,
    nodes,
    totalNodes: nodeMap.size,
    message: `Design created successfully with ${nodeMap.size} nodes`
  };
}

function createFrameNode(name: string, props: Record<string, unknown>): FrameNode {
  const frame = figma.createFrame();
  frame.name = name;
  frame.x = (props.x as number) || 0;
  frame.y = (props.y as number) || 0;
  frame.fills = [];

  if (props.width) frame.resize(props.width as number, frame.height);
  if (props.height) frame.resize(frame.width, props.height as number);

  if (props.layoutMode && props.layoutMode !== 'NONE') {
    frame.layoutMode = props.layoutMode as 'HORIZONTAL' | 'VERTICAL';
  }
  if (props.itemSpacing !== undefined) frame.itemSpacing = props.itemSpacing as number;
  if (props.padding !== undefined) {
    const p = props.padding as number;
    frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = p;
  }
  if (props.paddingLeft !== undefined) frame.paddingLeft = props.paddingLeft as number;
  if (props.paddingRight !== undefined) frame.paddingRight = props.paddingRight as number;
  if (props.paddingTop !== undefined) frame.paddingTop = props.paddingTop as number;
  if (props.paddingBottom !== undefined) frame.paddingBottom = props.paddingBottom as number;
  if (props.primaryAxisAlignItems !== undefined)
    frame.primaryAxisAlignItems = props.primaryAxisAlignItems as FrameNode['primaryAxisAlignItems'];
  if (props.counterAxisAlignItems !== undefined)
    frame.counterAxisAlignItems = props.counterAxisAlignItems as FrameNode['counterAxisAlignItems'];

  if (props.fills) {
    frame.fills = props.fills as Paint[];
  } else if (props.fillColor) {
    const rgb = hexToRgb(props.fillColor as string);
    const opacity = (props.fillOpacity as number) ?? 1;
    frame.fills = [{ type: 'SOLID', color: rgb, opacity }];
  }

  if (props.cornerRadius !== undefined) frame.cornerRadius = props.cornerRadius as number;
  if (props.strokeColor) {
    frame.strokes = [{ type: 'SOLID', color: hexToRgb(props.strokeColor as string) }];
    if (props.strokeWeight) frame.strokeWeight = props.strokeWeight as number;
    if (props.strokeAlign) frame.strokeAlign = props.strokeAlign as 'INSIDE' | 'OUTSIDE' | 'CENTER';
  }
  if (props.effects)
    frame.effects = convertEffects(props.effects as Array<Record<string, unknown>>);

  return frame;
}

async function createTextNode(name: string, props: Record<string, unknown>): Promise<TextNode> {
  const fontFamily = (props.fontFamily as string) || 'Inter';
  const fontWeight = (props.fontWeight as number) || 400;
  const fontName = await loadFont(fontFamily, fontWeight);

  const text = figma.createText();
  text.name = name;
  text.fontName = fontName;
  text.characters = (props.content as string) || (props.text as string) || '';
  text.fontSize = (props.fontSize as number) || 16;

  if (props.color) text.fills = [{ type: 'SOLID', color: hexToRgb(props.color as string) }];
  if (props.textAlign)
    text.textAlignHorizontal = props.textAlign as TextNode['textAlignHorizontal'];
  if (props.lineHeight) text.lineHeight = { value: props.lineHeight as number, unit: 'PIXELS' };
  if (props.letterSpacing)
    text.letterSpacing = { value: props.letterSpacing as number, unit: 'PIXELS' };

  return text;
}

function createEllipseNode(name: string, props: Record<string, unknown>): EllipseNode {
  const ellipse = figma.createEllipse();
  ellipse.name = name;
  ellipse.resize((props.width as number) || 100, (props.height as number) || 100);

  if (props.fillColor)
    ellipse.fills = [{ type: 'SOLID', color: hexToRgb(props.fillColor as string) }];
  if (props.strokeColor) {
    ellipse.strokes = [{ type: 'SOLID', color: hexToRgb(props.strokeColor as string) }];
    if (props.strokeWeight) ellipse.strokeWeight = props.strokeWeight as number;
  }

  return ellipse;
}

function createRectangleNode(name: string, props: Record<string, unknown>): RectangleNode {
  const rect = figma.createRectangle();
  rect.name = name;
  rect.resize((props.width as number) || 100, (props.height as number) || 100);

  if (props.fillColor) rect.fills = [{ type: 'SOLID', color: hexToRgb(props.fillColor as string) }];
  if (props.cornerRadius !== undefined) rect.cornerRadius = props.cornerRadius as number;
  if (props.strokeColor) {
    rect.strokes = [{ type: 'SOLID', color: hexToRgb(props.strokeColor as string) }];
    if (props.strokeWeight) rect.strokeWeight = props.strokeWeight as number;
  }

  return rect;
}

function createLineNode(name: string, props: Record<string, unknown>): LineNode {
  const line = figma.createLine();
  line.name = name;
  line.resize((props.width as number) || 100, 0);

  if (props.strokeColor) {
    line.strokes = [{ type: 'SOLID', color: hexToRgb(props.strokeColor as string) }];
    if (props.strokeWeight) line.strokeWeight = props.strokeWeight as number;
  }

  return line;
}
