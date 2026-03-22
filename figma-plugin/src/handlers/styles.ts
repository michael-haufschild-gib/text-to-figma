/**
 * Style System Command Handlers
 *
 * Handles: create_color_style, create_text_style, create_effect_style,
 * apply_fill_style, apply_text_style, apply_effect_style
 */

import { convertEffects, getNode, hexToRgb, loadFont } from '../helpers.js';
import { checkEnum, validatePayload, type ValidationRule } from '../validate.js';

const TEXT_CASES = [
  'ORIGINAL',
  'UPPER',
  'LOWER',
  'TITLE',
  'SMALL_CAPS',
  'SMALL_CAPS_FORCED'
] as const;
const TEXT_DECORATIONS = ['NONE', 'UNDERLINE', 'STRIKETHROUGH'] as const;

const createColorStyleRules: ValidationRule[] = [
  { field: 'name', type: 'string', required: true },
  { field: 'color', type: 'string', required: true }
];
const createTextStyleRules: ValidationRule[] = [
  { field: 'name', type: 'string', required: true },
  { field: 'fontSize', type: 'number', required: true }
];
const createEffectStyleRules: ValidationRule[] = [
  { field: 'name', type: 'string', required: true },
  { field: 'effects', type: 'array', required: true }
];
const applyStyleRules: ValidationRule[] = [
  { field: 'nodeId', type: 'string', required: true },
  { field: 'styleName', type: 'string', required: true }
];

export function handleCreateColorStyle(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, createColorStyleRules);
  if (error !== null) throw new Error(error);

  const paintStyle = figma.createPaintStyle();
  paintStyle.name = payload.name as string;
  paintStyle.paints = [{ type: 'SOLID', color: hexToRgb(payload.color as string) }];
  if (typeof payload.description === 'string') {
    paintStyle.description = payload.description;
  }

  return {
    styleId: paintStyle.id,
    name: paintStyle.name,
    color: payload.color,
    message: `Color style created: ${paintStyle.name}`
  };
}

export async function handleCreateTextStyle(payload: Record<string, unknown>): Promise<unknown> {
  const error = validatePayload(payload, createTextStyleRules);
  if (error !== null) throw new Error(error);

  const textStyle = figma.createTextStyle();
  textStyle.name = payload.name as string;

  const fontFamily = typeof payload.fontFamily === 'string' ? payload.fontFamily : 'Inter';
  const fontWeight = typeof payload.fontWeight === 'number' ? payload.fontWeight : 400;
  const fontName = await loadFont(fontFamily, fontWeight);
  textStyle.fontName = fontName;
  textStyle.fontSize = payload.fontSize as number;

  if (typeof payload.lineHeight === 'number') {
    textStyle.lineHeight = { value: payload.lineHeight, unit: 'PIXELS' };
  }
  if (typeof payload.letterSpacing === 'number') {
    textStyle.letterSpacing = { value: payload.letterSpacing, unit: 'PIXELS' };
  }
  const textCase = checkEnum(payload.textCase, TEXT_CASES);
  if (textCase !== undefined) {
    textStyle.textCase = textCase;
  }
  const textDecoration = checkEnum(payload.textDecoration, TEXT_DECORATIONS);
  if (textDecoration !== undefined) {
    textStyle.textDecoration = textDecoration;
  }
  if (typeof payload.description === 'string') {
    textStyle.description = payload.description;
  }

  return {
    styleId: textStyle.id,
    name: textStyle.name,
    fontSize: payload.fontSize,
    fontWeight: payload.fontWeight,
    message: `Text style created: ${textStyle.name}`
  };
}

export function handleCreateEffectStyle(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, createEffectStyleRules);
  if (error !== null) throw new Error(error);

  const effectStyle = figma.createEffectStyle();
  effectStyle.name = payload.name as string;

  const effects = convertEffects(payload.effects as Array<Record<string, unknown>>);
  effectStyle.effects = effects;
  if (typeof payload.description === 'string') {
    effectStyle.description = payload.description;
  }

  return {
    styleId: effectStyle.id,
    name: effectStyle.name,
    effectCount: effects.length,
    message: `Effect style created: ${effectStyle.name}`
  };
}

export async function handleApplyFillStyle(payload: Record<string, unknown>): Promise<unknown> {
  const error = validatePayload(payload, applyStyleRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
  if (!node || !('fillStyleId' in node)) throw new Error('Node does not support fill styles');

  const styles = await figma.getLocalPaintStylesAsync();
  const style = styles.find((s) => s.name === payload.styleName);
  if (!style) throw new Error(`Fill style not found: ${String(payload.styleName)}`);

  await (
    node as GeometryMixin & {
      fillStyleId: string;
      setFillStyleIdAsync: (id: string) => Promise<void>;
    }
  ).setFillStyleIdAsync(style.id);
  return {
    nodeId: payload.nodeId,
    styleName: payload.styleName,
    message: `Fill style applied: ${String(payload.styleName)}`
  };
}

export async function handleApplyTextStyle(payload: Record<string, unknown>): Promise<unknown> {
  const error = validatePayload(payload, applyStyleRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
  if (node?.type !== 'TEXT') throw new Error('Node is not a text node');

  const styles = await figma.getLocalTextStylesAsync();
  const style = styles.find((s) => s.name === payload.styleName);
  if (!style) throw new Error(`Text style not found: ${String(payload.styleName)}`);

  await node.setTextStyleIdAsync(style.id);
  return {
    nodeId: payload.nodeId,
    styleName: payload.styleName,
    message: `Text style applied: ${String(payload.styleName)}`
  };
}

export async function handleApplyEffectStyle(payload: Record<string, unknown>): Promise<unknown> {
  const error = validatePayload(payload, applyStyleRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
  if (!node || !('effectStyleId' in node)) throw new Error('Node does not support effect styles');

  const styles = await figma.getLocalEffectStylesAsync();
  const style = styles.find((s) => s.name === payload.styleName);
  if (!style) throw new Error(`Effect style not found: ${String(payload.styleName)}`);

  await (
    node as BlendMixin & {
      effectStyleId: string;
      setEffectStyleIdAsync: (id: string) => Promise<void>;
    }
  ).setEffectStyleIdAsync(style.id);
  return {
    nodeId: payload.nodeId,
    styleName: payload.styleName,
    message: `Effect style applied: ${String(payload.styleName)}`
  };
}
