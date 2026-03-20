/**
 * Creation Command Handlers
 *
 * Handles: create_frame, create_text, create_ellipse, create_line,
 * create_polygon, create_star, create_rectangle_with_image_fill
 */

import { cacheNode, hexToRgb, loadFont, resolveParent } from '../helpers.js';

export function handleCreateFrame(payload: Record<string, unknown>): unknown {
  const frame = figma.createFrame();
  frame.name = (payload.name as string) || 'Frame';
  frame.x = (payload.x as number) || 0;
  frame.y = (payload.y as number) || 0;
  frame.fills = [];

  if (payload.width && payload.height) {
    frame.resize(payload.width as number, payload.height as number);
  }

  if (payload.layoutMode && payload.layoutMode !== 'NONE') {
    frame.layoutMode = payload.layoutMode as 'HORIZONTAL' | 'VERTICAL';
  }
  if (payload.itemSpacing !== undefined) {
    frame.itemSpacing = payload.itemSpacing as number;
  }
  if (payload.padding !== undefined) {
    const p = payload.padding as number;
    frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = p;
  }

  const parent = resolveParent(payload.parentId as string | undefined);
  parent.appendChild(frame);

  // Layout sizing AFTER adding to parent (FILL requires auto-layout parent)
  if (payload.layoutMode && payload.layoutMode !== 'NONE' && payload.parentId) {
    if (payload.horizontalSizing) {
      frame.layoutSizingHorizontal = payload.horizontalSizing as 'FIXED' | 'HUG' | 'FILL';
    } else if (!payload.width) {
      frame.layoutSizingHorizontal = 'FILL';
    }
    if (payload.verticalSizing) {
      frame.layoutSizingVertical = payload.verticalSizing as 'FIXED' | 'HUG' | 'FILL';
    } else if (!payload.height) {
      frame.layoutSizingVertical = 'HUG';
    }
  }

  cacheNode(frame);
  figma.viewport.scrollAndZoomIntoView([frame]);

  return { nodeId: frame.id, message: `Frame created: ${frame.name}` };
}

export async function handleCreateText(payload: Record<string, unknown>): Promise<unknown> {
  const fontFamily = (payload.fontFamily as string) || 'Inter';
  const fontWeight = (payload.fontWeight as number) || 400;
  const fontName = await loadFont(fontFamily, fontWeight);

  const textNode = figma.createText();
  textNode.fontName = fontName;
  textNode.characters = (payload.content as string) || '';
  textNode.name = (payload.name as string) || 'Text';
  textNode.x = (payload.x as number) || 0;
  textNode.y = (payload.y as number) || 0;

  if (payload.fontSize) textNode.fontSize = payload.fontSize as number;
  if (payload.color) {
    textNode.fills = [{ type: 'SOLID', color: hexToRgb(payload.color as string) }];
  }
  if (payload.textAlign)
    textNode.textAlignHorizontal = payload.textAlign as TextNode['textAlignHorizontal'];
  if (payload.lineHeight)
    textNode.lineHeight = { value: payload.lineHeight as number, unit: 'PIXELS' };
  if (payload.letterSpacing)
    textNode.letterSpacing = { value: payload.letterSpacing as number, unit: 'PIXELS' };

  const parent = resolveParent(payload.parentId as string | undefined);
  parent.appendChild(textNode);
  cacheNode(textNode);
  figma.viewport.scrollAndZoomIntoView([textNode]);

  return { nodeId: textNode.id, message: `Text created: "${textNode.characters}"` };
}

export function handleCreateEllipse(payload: Record<string, unknown>): unknown {
  const ellipse = figma.createEllipse();
  ellipse.name = (payload.name as string) || 'Ellipse';
  ellipse.x = (payload.x as number) || 0;
  ellipse.y = (payload.y as number) || 0;
  ellipse.resize((payload.width as number) || 100, (payload.height as number) || 100);

  if (payload.fillColor) {
    ellipse.fills = [{ type: 'SOLID', color: hexToRgb(payload.fillColor as string) }];
  }
  if (payload.strokeColor && payload.strokeWeight) {
    ellipse.strokes = [{ type: 'SOLID', color: hexToRgb(payload.strokeColor as string) }];
    ellipse.strokeWeight = payload.strokeWeight as number;
  }

  const parent = resolveParent(payload.parentId as string | undefined);
  parent.appendChild(ellipse);
  cacheNode(ellipse);
  figma.viewport.scrollAndZoomIntoView([ellipse]);

  return { nodeId: ellipse.id, message: `Ellipse created: ${ellipse.name}` };
}

export function handleCreateLine(payload: Record<string, unknown>): unknown {
  const line = figma.createLine();
  line.name = (payload.name as string) || 'Line';

  const x1 = (payload.x1 as number) || 0;
  const y1 = (payload.y1 as number) || 0;
  const x2 = (payload.x2 as number) || 100;
  const y2 = (payload.y2 as number) || 0;

  line.x = Math.min(x1, x2);
  line.y = Math.min(y1, y2);
  line.resize(Math.max(Math.abs(x2 - x1), 0.01), Math.max(Math.abs(y2 - y1), 0.01));

  if (payload.strokeColor) {
    line.strokes = [{ type: 'SOLID', color: hexToRgb(payload.strokeColor as string) }];
  }
  if (payload.strokeWeight) line.strokeWeight = payload.strokeWeight as number;
  if (payload.strokeCap) line.strokeCap = payload.strokeCap as StrokeCap;
  if (payload.dashPattern) line.dashPattern = payload.dashPattern as number[];

  const parent = resolveParent(payload.parentId as string | undefined);
  parent.appendChild(line);
  cacheNode(line);
  figma.viewport.scrollAndZoomIntoView([line]);

  return { nodeId: line.id, message: `Line created: ${line.name}` };
}

export function handleCreatePolygon(payload: Record<string, unknown>): unknown {
  const polygon = figma.createPolygon();
  polygon.name = (payload.name as string) || 'Polygon';
  polygon.x = (payload.x as number) || 0;
  polygon.y = (payload.y as number) || 0;
  polygon.pointCount = (payload.sideCount as number) || 3;
  const r = (payload.radius as number) || 50;
  polygon.resize(r * 2, r * 2);

  if (payload.fillColor) {
    polygon.fills = [{ type: 'SOLID', color: hexToRgb(payload.fillColor as string) }];
  }
  if (payload.strokeColor && payload.strokeWeight) {
    polygon.strokes = [{ type: 'SOLID', color: hexToRgb(payload.strokeColor as string) }];
    polygon.strokeWeight = payload.strokeWeight as number;
  }

  const parent = resolveParent(payload.parentId as string | undefined);
  parent.appendChild(polygon);
  cacheNode(polygon);

  return { nodeId: polygon.id, message: `Polygon created: ${polygon.name}` };
}

export function handleCreateStar(payload: Record<string, unknown>): unknown {
  const star = figma.createStar();
  star.name = (payload.name as string) || 'Star';
  star.x = (payload.x as number) || 0;
  star.y = (payload.y as number) || 0;
  star.pointCount = (payload.pointCount as number) || 5;
  const r = (payload.radius as number) || 50;
  star.resize(r * 2, r * 2);

  if (payload.innerRadius) {
    star.innerRadius = (payload.innerRadius as number) / r;
  }
  if (payload.fillColor) {
    star.fills = [{ type: 'SOLID', color: hexToRgb(payload.fillColor as string) }];
  }
  if (payload.strokeColor && payload.strokeWeight) {
    star.strokes = [{ type: 'SOLID', color: hexToRgb(payload.strokeColor as string) }];
    star.strokeWeight = payload.strokeWeight as number;
  }

  const parent = resolveParent(payload.parentId as string | undefined);
  parent.appendChild(star);
  cacheNode(star);

  return { nodeId: star.id, message: `Star created: ${star.name}` };
}

export function handleCreateRectangleWithImageFill(payload: Record<string, unknown>): unknown {
  const rect = figma.createRectangle();
  rect.name = (payload.name as string) || 'Image';
  rect.x = (payload.x as number) || 0;
  rect.y = (payload.y as number) || 0;
  rect.resize((payload.width as number) || 100, (payload.height as number) || 100);
  rect.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];

  const parent = resolveParent(payload.parentId as string | undefined);
  parent.appendChild(rect);
  cacheNode(rect);

  return {
    nodeId: rect.id,
    message: `Rectangle created for image: ${rect.name}`,
    note: 'Image fill requires async loading - use set_image_fill separately'
  };
}
