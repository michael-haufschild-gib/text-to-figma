/**
 * Style System Command Handlers
 *
 * Handles: create_color_style, create_text_style, create_effect_style,
 * apply_fill_style, apply_text_style, apply_effect_style
 */

import { convertEffects, getNode, hexToRgb, loadFont } from '../helpers.js';

export function handleCreateColorStyle(payload: Record<string, unknown>): unknown {
  const paintStyle = figma.createPaintStyle();
  paintStyle.name = payload.name as string;
  paintStyle.paints = [{ type: 'SOLID', color: hexToRgb(payload.color as string) }];
  if (payload.description) paintStyle.description = payload.description as string;

  return {
    styleId: paintStyle.id,
    name: paintStyle.name,
    color: payload.color,
    message: `Color style created: ${paintStyle.name}`
  };
}

export async function handleCreateTextStyle(payload: Record<string, unknown>): Promise<unknown> {
  const textStyle = figma.createTextStyle();
  textStyle.name = payload.name as string;

  const fontFamily = (payload.fontFamily as string) || 'Inter';
  const fontWeight = (payload.fontWeight as number) || 400;
  const fontName = await loadFont(fontFamily, fontWeight);
  textStyle.fontName = fontName;
  textStyle.fontSize = payload.fontSize as number;

  if (payload.lineHeight)
    textStyle.lineHeight = { value: payload.lineHeight as number, unit: 'PIXELS' };
  if (payload.letterSpacing)
    textStyle.letterSpacing = { value: payload.letterSpacing as number, unit: 'PIXELS' };
  if (payload.textCase) textStyle.textCase = payload.textCase as TextCase;
  if (payload.textDecoration) textStyle.textDecoration = payload.textDecoration as TextDecoration;
  if (payload.description) textStyle.description = payload.description as string;

  return {
    styleId: textStyle.id,
    name: textStyle.name,
    fontSize: payload.fontSize,
    fontWeight: payload.fontWeight,
    message: `Text style created: ${textStyle.name}`
  };
}

export function handleCreateEffectStyle(payload: Record<string, unknown>): unknown {
  const effectStyle = figma.createEffectStyle();
  effectStyle.name = payload.name as string;

  const effects = convertEffects(payload.effects as Array<Record<string, unknown>>);
  effectStyle.effects = effects;
  if (payload.description) effectStyle.description = payload.description as string;

  return {
    styleId: effectStyle.id,
    name: effectStyle.name,
    effectCount: effects.length,
    message: `Effect style created: ${effectStyle.name}`
  };
}

export async function handleApplyFillStyle(payload: Record<string, unknown>): Promise<unknown> {
  const node = getNode(payload.nodeId as string);
  if (!node || !('fillStyleId' in node)) throw new Error('Node does not support fill styles');

  const styles = await figma.getLocalPaintStylesAsync();
  const style = styles.find((s) => s.name === payload.styleName);
  if (!style) throw new Error(`Fill style not found: ${payload.styleName}`);

  await (
    node as GeometryMixin & {
      fillStyleId: string;
      setFillStyleIdAsync: (id: string) => Promise<void>;
    }
  ).setFillStyleIdAsync(style.id);
  return {
    nodeId: payload.nodeId,
    styleName: payload.styleName,
    message: `Fill style applied: ${payload.styleName}`
  };
}

export async function handleApplyTextStyle(payload: Record<string, unknown>): Promise<unknown> {
  const node = getNode(payload.nodeId as string);
  if (!node || node.type !== 'TEXT') throw new Error('Node is not a text node');

  const styles = await figma.getLocalTextStylesAsync();
  const style = styles.find((s) => s.name === payload.styleName);
  if (!style) throw new Error(`Text style not found: ${payload.styleName}`);

  await node.setTextStyleIdAsync(style.id);
  return {
    nodeId: payload.nodeId,
    styleName: payload.styleName,
    message: `Text style applied: ${payload.styleName}`
  };
}

export async function handleApplyEffectStyle(payload: Record<string, unknown>): Promise<unknown> {
  const node = getNode(payload.nodeId as string);
  if (!node || !('effectStyleId' in node)) throw new Error('Node does not support effect styles');

  const styles = await figma.getLocalEffectStylesAsync();
  const style = styles.find((s) => s.name === payload.styleName);
  if (!style) throw new Error(`Effect style not found: ${payload.styleName}`);

  await (
    node as BlendMixin & {
      effectStyleId: string;
      setEffectStyleIdAsync: (id: string) => Promise<void>;
    }
  ).setEffectStyleIdAsync(style.id);
  return {
    nodeId: payload.nodeId,
    styleName: payload.styleName,
    message: `Effect style applied: ${payload.styleName}`
  };
}
