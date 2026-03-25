/**
 * Creation Command Handlers
 *
 * Handles: create_frame, create_text, create_ellipse, create_line,
 * create_polygon, create_star, create_rectangle_with_image_fill
 */

import { z } from 'zod';
import { cacheNode, hexToRgb, loadFont, resolveParent } from '../helpers.js';

// ── Return types ─────────────────────────────────────────────────────────────

interface NodeCreatedResult {
  nodeId: string;
  message: string;
  note?: string;
}

const SIZING_VALUES = ['FIXED', 'HUG', 'FILL'] as const;
const TEXT_ALIGNS = ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'] as const;
const STROKE_CAPS = [
  'NONE',
  'ROUND',
  'SQUARE',
  'ARROW_LINES',
  'ARROW_EQUILATERAL',
  'DIAMOND_FILLED',
  'TRIANGLE_FILLED',
  'CIRCLE_FILLED'
] as const;

const createFrameSchema = z.object({
  name: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  layoutMode: z.enum(['HORIZONTAL', 'VERTICAL', 'NONE']).optional(),
  itemSpacing: z.number().optional(),
  padding: z.number().optional(),
  parentId: z.string().optional(),
  horizontalSizing: z.enum(SIZING_VALUES).optional(),
  verticalSizing: z.enum(SIZING_VALUES).optional()
});

function applyLayoutSizing(frame: FrameNode, input: z.infer<typeof createFrameSchema>): void {
  if (
    input.layoutMode === undefined ||
    input.layoutMode === 'NONE' ||
    input.parentId === undefined
  ) {
    return;
  }
  if (input.horizontalSizing !== undefined) {
    frame.layoutSizingHorizontal = input.horizontalSizing;
  } else if (input.width === undefined) {
    frame.layoutSizingHorizontal = 'FILL';
  }
  if (input.verticalSizing !== undefined) {
    frame.layoutSizingVertical = input.verticalSizing;
  } else if (input.height === undefined) {
    frame.layoutSizingVertical = 'HUG';
  }
}

export function handleCreateFrame(payload: Record<string, unknown>): NodeCreatedResult {
  const input = createFrameSchema.parse(payload);

  const frame = figma.createFrame();
  frame.name = input.name ?? 'Frame';
  frame.x = input.x ?? 0;
  frame.y = input.y ?? 0;
  frame.fills = [];

  if (input.width !== undefined && input.height !== undefined) {
    frame.resize(input.width, input.height);
  }

  if (input.layoutMode !== undefined && input.layoutMode !== 'NONE') {
    frame.layoutMode = input.layoutMode;
  }
  if (input.itemSpacing !== undefined) {
    frame.itemSpacing = input.itemSpacing;
  }
  if (input.padding !== undefined) {
    frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = input.padding;
  }

  const parent = resolveParent(input.parentId);
  parent.appendChild(frame);
  applyLayoutSizing(frame, input);

  cacheNode(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);

  return { nodeId: frame.id, message: `Frame created: ${frame.name}` };
}

const createTextSchema = z.object({
  content: z.string().optional(),
  name: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  fontFamily: z.string().optional(),
  fontWeight: z.number().optional(),
  fontSize: z.number().optional(),
  color: z.string().optional(),
  textAlign: z.enum(TEXT_ALIGNS).optional(),
  lineHeight: z.number().optional(),
  letterSpacing: z.number().optional(),
  parentId: z.string().optional()
});

export async function handleCreateText(
  payload: Record<string, unknown>
): Promise<NodeCreatedResult> {
  const input = createTextSchema.parse(payload);

  const fontFamily = input.fontFamily ?? 'Inter';
  const fontWeight = input.fontWeight ?? 400;
  const fontResult = await loadFont(fontFamily, fontWeight);

  const textNode = figma.createText();
  textNode.fontName = fontResult.fontName;
  textNode.characters = input.content ?? '';
  textNode.name = input.name ?? 'Text';
  textNode.x = input.x ?? 0;
  textNode.y = input.y ?? 0;

  if (input.fontSize !== undefined) {
    textNode.fontSize = input.fontSize;
  }
  if (input.color !== undefined) {
    textNode.fills = [{ type: 'SOLID', color: hexToRgb(input.color) }];
  }
  if (input.textAlign !== undefined) {
    textNode.textAlignHorizontal = input.textAlign;
  }
  if (input.lineHeight !== undefined) {
    textNode.lineHeight = { value: input.lineHeight, unit: 'PIXELS' };
  }
  if (input.letterSpacing !== undefined) {
    textNode.letterSpacing = { value: input.letterSpacing, unit: 'PIXELS' };
  }

  const parent = resolveParent(input.parentId);
  parent.appendChild(textNode);
  cacheNode(textNode);
  figma.viewport.scrollAndZoomIntoView([textNode]);

  return { nodeId: textNode.id, message: `Text created: "${textNode.characters}"` };
}

const createEllipseSchema = z.object({
  name: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  fillColor: z.string().optional(),
  strokeColor: z.string().optional(),
  strokeWeight: z.number().optional(),
  parentId: z.string().optional()
});

export function handleCreateEllipse(payload: Record<string, unknown>): NodeCreatedResult {
  const input = createEllipseSchema.parse(payload);

  const ellipse = figma.createEllipse();
  ellipse.name = input.name ?? 'Ellipse';
  ellipse.x = input.x ?? 0;
  ellipse.y = input.y ?? 0;
  const w = input.width ?? 100;
  const h = input.height ?? 100;
  ellipse.resize(w, h);

  if (input.fillColor !== undefined) {
    ellipse.fills = [{ type: 'SOLID', color: hexToRgb(input.fillColor) }];
  }
  if (input.strokeColor !== undefined && input.strokeWeight !== undefined) {
    ellipse.strokes = [{ type: 'SOLID', color: hexToRgb(input.strokeColor) }];
    ellipse.strokeWeight = input.strokeWeight;
  }

  const parent = resolveParent(input.parentId);
  parent.appendChild(ellipse);
  cacheNode(ellipse);
  figma.viewport.scrollAndZoomIntoView([ellipse]);

  return { nodeId: ellipse.id, message: `Ellipse created: ${ellipse.name}` };
}

const createLineSchema = z.object({
  name: z.string().optional(),
  x1: z.number().optional(),
  y1: z.number().optional(),
  x2: z.number().optional(),
  y2: z.number().optional(),
  strokeColor: z.string().optional(),
  strokeWeight: z.number().optional(),
  strokeCap: z.enum(STROKE_CAPS).optional(),
  dashPattern: z.array(z.number()).optional(),
  parentId: z.string().optional()
});

export function handleCreateLine(payload: Record<string, unknown>): NodeCreatedResult {
  const input = createLineSchema.parse(payload);

  const line = figma.createLine();
  line.name = input.name ?? 'Line';

  const x1 = input.x1 ?? 0;
  const y1 = input.y1 ?? 0;
  const x2 = input.x2 ?? 100;
  const y2 = input.y2 ?? 0;

  line.x = Math.min(x1, x2);
  line.y = Math.min(y1, y2);
  line.resize(Math.max(Math.abs(x2 - x1), 0.01), Math.max(Math.abs(y2 - y1), 0.01));

  if (input.strokeColor !== undefined) {
    line.strokes = [{ type: 'SOLID', color: hexToRgb(input.strokeColor) }];
  }
  if (input.strokeWeight !== undefined) {
    line.strokeWeight = input.strokeWeight;
  }
  if (input.strokeCap !== undefined) {
    line.strokeCap = input.strokeCap;
  }
  if (input.dashPattern !== undefined) {
    line.dashPattern = input.dashPattern;
  }

  const parent = resolveParent(input.parentId);
  parent.appendChild(line);
  cacheNode(line);
  figma.viewport.scrollAndZoomIntoView([line]);

  return { nodeId: line.id, message: `Line created: ${line.name}` };
}

const createPolygonSchema = z.object({
  name: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  sideCount: z.number().optional(),
  radius: z.number().optional(),
  fillColor: z.string().optional(),
  strokeColor: z.string().optional(),
  strokeWeight: z.number().optional(),
  parentId: z.string().optional()
});

export function handleCreatePolygon(payload: Record<string, unknown>): NodeCreatedResult {
  const input = createPolygonSchema.parse(payload);

  const polygon = figma.createPolygon();
  polygon.name = input.name ?? 'Polygon';
  polygon.x = input.x ?? 0;
  polygon.y = input.y ?? 0;
  polygon.pointCount = input.sideCount ?? 3;
  const r = input.radius ?? 50;
  polygon.resize(r * 2, r * 2);

  if (input.fillColor !== undefined) {
    polygon.fills = [{ type: 'SOLID', color: hexToRgb(input.fillColor) }];
  }
  if (input.strokeColor !== undefined && input.strokeWeight !== undefined) {
    polygon.strokes = [{ type: 'SOLID', color: hexToRgb(input.strokeColor) }];
    polygon.strokeWeight = input.strokeWeight;
  }

  const parent = resolveParent(input.parentId);
  parent.appendChild(polygon);
  cacheNode(polygon);

  return { nodeId: polygon.id, message: `Polygon created: ${polygon.name}` };
}

const createStarSchema = z.object({
  name: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  pointCount: z.number().optional(),
  radius: z.number().optional(),
  innerRadius: z.number().optional(),
  fillColor: z.string().optional(),
  strokeColor: z.string().optional(),
  strokeWeight: z.number().optional(),
  parentId: z.string().optional()
});

export function handleCreateStar(payload: Record<string, unknown>): NodeCreatedResult {
  const input = createStarSchema.parse(payload);

  const star = figma.createStar();
  star.name = input.name ?? 'Star';
  star.x = input.x ?? 0;
  star.y = input.y ?? 0;
  star.pointCount = input.pointCount ?? 5;
  const r = input.radius ?? 50;
  star.resize(r * 2, r * 2);

  if (input.innerRadius !== undefined) {
    star.innerRadius = input.innerRadius / r;
  }
  if (input.fillColor !== undefined) {
    star.fills = [{ type: 'SOLID', color: hexToRgb(input.fillColor) }];
  }
  if (input.strokeColor !== undefined && input.strokeWeight !== undefined) {
    star.strokes = [{ type: 'SOLID', color: hexToRgb(input.strokeColor) }];
    star.strokeWeight = input.strokeWeight;
  }

  const parent = resolveParent(input.parentId);
  parent.appendChild(star);
  cacheNode(star);

  return { nodeId: star.id, message: `Star created: ${star.name}` };
}

const createRectangleWithImageFillSchema = z.object({
  name: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  parentId: z.string().optional()
});

export function handleCreateRectangleWithImageFill(
  payload: Record<string, unknown>
): NodeCreatedResult {
  const input = createRectangleWithImageFillSchema.parse(payload);

  const rect = figma.createRectangle();
  rect.name = input.name ?? 'Image';
  rect.x = input.x ?? 0;
  rect.y = input.y ?? 0;
  const w = input.width ?? 100;
  const h = input.height ?? 100;
  rect.resize(w, h);
  rect.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];

  const parent = resolveParent(input.parentId);
  parent.appendChild(rect);
  cacheNode(rect);

  return {
    nodeId: rect.id,
    message: `Rectangle created for image: ${rect.name}`,
    note: 'Image fill requires async loading - use set_image_fill separately'
  };
}
