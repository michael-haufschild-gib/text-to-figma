/**
 * Creation Command Handlers
 *
 * Handles: create_frame, create_text, create_ellipse, create_line,
 * create_polygon, create_star, create_rectangle_with_image_fill
 */

import { cacheNode, hexToRgb, loadFont, resolveParent } from '../helpers.js';
import { checkEnum, validatePayload } from '../validate.js';
import type { ValidationRule } from '../validate.js';

const SIZING_VALUES = ['FIXED', 'HUG', 'FILL'] as const;
const LAYOUT_MODES = ['HORIZONTAL', 'VERTICAL'] as const;
const TEXT_ALIGNS = ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'] as const;
const STROKE_CAPS: readonly string[] = [
  'NONE',
  'ROUND',
  'SQUARE',
  'ARROW_LINES',
  'ARROW_EQUILATERAL',
  'DIAMOND_FILLED',
  'TRIANGLE_FILLED',
  'CIRCLE_FILLED'
];

function applyLayoutSizing(frame: FrameNode, payload: Record<string, unknown>): void {
  if (
    typeof payload.layoutMode !== 'string' ||
    payload.layoutMode === 'NONE' ||
    payload.parentId === undefined
  ) {
    return;
  }
  const hSizing = checkEnum(payload.horizontalSizing, SIZING_VALUES);
  if (hSizing !== undefined) {
    frame.layoutSizingHorizontal = hSizing;
  } else if (payload.width === undefined) {
    frame.layoutSizingHorizontal = 'FILL';
  }
  const vSizing = checkEnum(payload.verticalSizing, SIZING_VALUES);
  if (vSizing !== undefined) {
    frame.layoutSizingVertical = vSizing;
  } else if (payload.height === undefined) {
    frame.layoutSizingVertical = 'HUG';
  }
}

const createFrameRules: ValidationRule[] = [
  { field: 'name', type: 'string' },
  { field: 'x', type: 'number' },
  { field: 'y', type: 'number' },
  { field: 'width', type: 'number' },
  { field: 'height', type: 'number' },
  { field: 'layoutMode', type: 'string', enum: ['HORIZONTAL', 'VERTICAL', 'NONE'] },
  { field: 'itemSpacing', type: 'number' },
  { field: 'padding', type: 'number' },
  { field: 'parentId', type: 'string' },
  { field: 'horizontalSizing', type: 'string', enum: SIZING_VALUES },
  { field: 'verticalSizing', type: 'string', enum: SIZING_VALUES }
];

export function handleCreateFrame(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, createFrameRules);
  if (error !== null) throw new Error(error);

  const frame = figma.createFrame();
  frame.name = typeof payload.name === 'string' ? payload.name : 'Frame';
  frame.x = typeof payload.x === 'number' ? payload.x : 0;
  frame.y = typeof payload.y === 'number' ? payload.y : 0;
  frame.fills = [];

  if (typeof payload.width === 'number' && typeof payload.height === 'number') {
    frame.resize(payload.width, payload.height);
  }

  const layoutMode = checkEnum(payload.layoutMode, LAYOUT_MODES);
  if (layoutMode !== undefined) {
    frame.layoutMode = layoutMode;
  }
  if (typeof payload.itemSpacing === 'number') {
    frame.itemSpacing = payload.itemSpacing;
  }
  if (typeof payload.padding === 'number') {
    const p = payload.padding;
    frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = p;
  }

  const parent = resolveParent(typeof payload.parentId === 'string' ? payload.parentId : undefined);
  parent.appendChild(frame);
  applyLayoutSizing(frame, payload);

  cacheNode(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);

  return { nodeId: frame.id, message: `Frame created: ${frame.name}` };
}

const createTextRules: ValidationRule[] = [
  { field: 'content', type: 'string' },
  { field: 'name', type: 'string' },
  { field: 'x', type: 'number' },
  { field: 'y', type: 'number' },
  { field: 'fontFamily', type: 'string' },
  { field: 'fontWeight', type: 'number' },
  { field: 'fontSize', type: 'number' },
  { field: 'color', type: 'string' },
  { field: 'textAlign', type: 'string', enum: TEXT_ALIGNS },
  { field: 'lineHeight', type: 'number' },
  { field: 'letterSpacing', type: 'number' },
  { field: 'parentId', type: 'string' }
];

export async function handleCreateText(payload: Record<string, unknown>): Promise<unknown> {
  const error = validatePayload(payload, createTextRules);
  if (error !== null) throw new Error(error);

  const fontFamily = typeof payload.fontFamily === 'string' ? payload.fontFamily : 'Inter';
  const fontWeight = typeof payload.fontWeight === 'number' ? payload.fontWeight : 400;
  const fontName = await loadFont(fontFamily, fontWeight);

  const textNode = figma.createText();
  textNode.fontName = fontName;
  textNode.characters = typeof payload.content === 'string' ? payload.content : '';
  textNode.name = typeof payload.name === 'string' ? payload.name : 'Text';
  textNode.x = typeof payload.x === 'number' ? payload.x : 0;
  textNode.y = typeof payload.y === 'number' ? payload.y : 0;

  if (typeof payload.fontSize === 'number') {
    textNode.fontSize = payload.fontSize;
  }
  if (typeof payload.color === 'string') {
    textNode.fills = [{ type: 'SOLID', color: hexToRgb(payload.color) }];
  }
  const textAlign = checkEnum(payload.textAlign, TEXT_ALIGNS);
  if (textAlign !== undefined) {
    textNode.textAlignHorizontal = textAlign;
  }
  if (typeof payload.lineHeight === 'number') {
    textNode.lineHeight = { value: payload.lineHeight, unit: 'PIXELS' };
  }
  if (typeof payload.letterSpacing === 'number') {
    textNode.letterSpacing = { value: payload.letterSpacing, unit: 'PIXELS' };
  }

  const parent = resolveParent(typeof payload.parentId === 'string' ? payload.parentId : undefined);
  parent.appendChild(textNode);
  cacheNode(textNode);
  figma.viewport.scrollAndZoomIntoView([textNode]);

  return { nodeId: textNode.id, message: `Text created: "${textNode.characters}"` };
}

export function handleCreateEllipse(payload: Record<string, unknown>): unknown {
  const ellipse = figma.createEllipse();
  ellipse.name = typeof payload.name === 'string' ? payload.name : 'Ellipse';
  ellipse.x = typeof payload.x === 'number' ? payload.x : 0;
  ellipse.y = typeof payload.y === 'number' ? payload.y : 0;
  const w = typeof payload.width === 'number' ? payload.width : 100;
  const h = typeof payload.height === 'number' ? payload.height : 100;
  ellipse.resize(w, h);

  if (typeof payload.fillColor === 'string') {
    ellipse.fills = [{ type: 'SOLID', color: hexToRgb(payload.fillColor) }];
  }
  if (typeof payload.strokeColor === 'string' && typeof payload.strokeWeight === 'number') {
    ellipse.strokes = [{ type: 'SOLID', color: hexToRgb(payload.strokeColor) }];
    ellipse.strokeWeight = payload.strokeWeight;
  }

  const parent = resolveParent(typeof payload.parentId === 'string' ? payload.parentId : undefined);
  parent.appendChild(ellipse);
  cacheNode(ellipse);
  figma.viewport.scrollAndZoomIntoView([ellipse]);

  return { nodeId: ellipse.id, message: `Ellipse created: ${ellipse.name}` };
}

export function handleCreateLine(payload: Record<string, unknown>): unknown {
  const line = figma.createLine();
  line.name = typeof payload.name === 'string' ? payload.name : 'Line';

  const x1 = typeof payload.x1 === 'number' ? payload.x1 : 0;
  const y1 = typeof payload.y1 === 'number' ? payload.y1 : 0;
  const x2 = typeof payload.x2 === 'number' ? payload.x2 : 100;
  const y2 = typeof payload.y2 === 'number' ? payload.y2 : 0;

  line.x = Math.min(x1, x2);
  line.y = Math.min(y1, y2);
  line.resize(Math.max(Math.abs(x2 - x1), 0.01), Math.max(Math.abs(y2 - y1), 0.01));

  if (typeof payload.strokeColor === 'string') {
    line.strokes = [{ type: 'SOLID', color: hexToRgb(payload.strokeColor) }];
  }
  if (typeof payload.strokeWeight === 'number') {
    line.strokeWeight = payload.strokeWeight;
  }
  if (typeof payload.strokeCap === 'string' && STROKE_CAPS.includes(payload.strokeCap)) {
    line.strokeCap = payload.strokeCap as StrokeCap;
  }
  if (
    Array.isArray(payload.dashPattern) &&
    payload.dashPattern.every((el: unknown) => typeof el === 'number')
  ) {
    line.dashPattern = payload.dashPattern;
  }

  const parent = resolveParent(typeof payload.parentId === 'string' ? payload.parentId : undefined);
  parent.appendChild(line);
  cacheNode(line);
  figma.viewport.scrollAndZoomIntoView([line]);

  return { nodeId: line.id, message: `Line created: ${line.name}` };
}

export function handleCreatePolygon(payload: Record<string, unknown>): unknown {
  const polygon = figma.createPolygon();
  polygon.name = typeof payload.name === 'string' ? payload.name : 'Polygon';
  polygon.x = typeof payload.x === 'number' ? payload.x : 0;
  polygon.y = typeof payload.y === 'number' ? payload.y : 0;
  polygon.pointCount = typeof payload.sideCount === 'number' ? payload.sideCount : 3;
  const r = typeof payload.radius === 'number' ? payload.radius : 50;
  polygon.resize(r * 2, r * 2);

  if (typeof payload.fillColor === 'string') {
    polygon.fills = [{ type: 'SOLID', color: hexToRgb(payload.fillColor) }];
  }
  if (typeof payload.strokeColor === 'string' && typeof payload.strokeWeight === 'number') {
    polygon.strokes = [{ type: 'SOLID', color: hexToRgb(payload.strokeColor) }];
    polygon.strokeWeight = payload.strokeWeight;
  }

  const parent = resolveParent(typeof payload.parentId === 'string' ? payload.parentId : undefined);
  parent.appendChild(polygon);
  cacheNode(polygon);

  return { nodeId: polygon.id, message: `Polygon created: ${polygon.name}` };
}

export function handleCreateStar(payload: Record<string, unknown>): unknown {
  const star = figma.createStar();
  star.name = typeof payload.name === 'string' ? payload.name : 'Star';
  star.x = typeof payload.x === 'number' ? payload.x : 0;
  star.y = typeof payload.y === 'number' ? payload.y : 0;
  star.pointCount = typeof payload.pointCount === 'number' ? payload.pointCount : 5;
  const r = typeof payload.radius === 'number' ? payload.radius : 50;
  star.resize(r * 2, r * 2);

  if (typeof payload.innerRadius === 'number') {
    star.innerRadius = payload.innerRadius / r;
  }
  if (typeof payload.fillColor === 'string') {
    star.fills = [{ type: 'SOLID', color: hexToRgb(payload.fillColor) }];
  }
  if (typeof payload.strokeColor === 'string' && typeof payload.strokeWeight === 'number') {
    star.strokes = [{ type: 'SOLID', color: hexToRgb(payload.strokeColor) }];
    star.strokeWeight = payload.strokeWeight;
  }

  const parent = resolveParent(typeof payload.parentId === 'string' ? payload.parentId : undefined);
  parent.appendChild(star);
  cacheNode(star);

  return { nodeId: star.id, message: `Star created: ${star.name}` };
}

export function handleCreateRectangleWithImageFill(payload: Record<string, unknown>): unknown {
  const rect = figma.createRectangle();
  rect.name = typeof payload.name === 'string' ? payload.name : 'Image';
  rect.x = typeof payload.x === 'number' ? payload.x : 0;
  rect.y = typeof payload.y === 'number' ? payload.y : 0;
  const w = typeof payload.width === 'number' ? payload.width : 100;
  const h = typeof payload.height === 'number' ? payload.height : 100;
  rect.resize(w, h);
  rect.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];

  const parent = resolveParent(typeof payload.parentId === 'string' ? payload.parentId : undefined);
  parent.appendChild(rect);
  cacheNode(rect);

  return {
    nodeId: rect.id,
    message: `Rectangle created for image: ${rect.name}`,
    note: 'Image fill requires async loading - use set_image_fill separately'
  };
}
