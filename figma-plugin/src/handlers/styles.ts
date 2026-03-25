/**
 * Style System Command Handlers
 *
 * Handles: create_color_style, create_text_style, create_effect_style,
 * apply_fill_style, apply_text_style, apply_effect_style
 */

import { z } from 'zod';
import { convertEffects, getNode, hexToRgb, loadFont } from '../helpers.js';

// ── Return types ─────────────────────────────────────────────────────────────

interface StyleResult {
  message: string;
  [key: string]: unknown;
}

const TEXT_CASES = [
  'ORIGINAL',
  'UPPER',
  'LOWER',
  'TITLE',
  'SMALL_CAPS',
  'SMALL_CAPS_FORCED'
] as const;
const TEXT_DECORATIONS = ['NONE', 'UNDERLINE', 'STRIKETHROUGH'] as const;

const createColorStyleSchema = z.object({
  name: z.string(),
  color: z.string(),
  description: z.string().optional()
});

const createTextStyleSchema = z.object({
  name: z.string(),
  fontSize: z.number(),
  fontFamily: z.string().optional(),
  fontWeight: z.number().optional(),
  lineHeight: z.number().optional(),
  letterSpacing: z.number().optional(),
  textCase: z.enum(TEXT_CASES).optional(),
  textDecoration: z.enum(TEXT_DECORATIONS).optional(),
  description: z.string().optional()
});

const createEffectStyleSchema = z.object({
  name: z.string(),
  effects: z.array(z.record(z.string(), z.unknown())),
  description: z.string().optional()
});

const applyStyleSchema = z.object({
  nodeId: z.string(),
  styleName: z.string()
});

export function handleCreateColorStyle(payload: Record<string, unknown>): StyleResult {
  const input = createColorStyleSchema.parse(payload);

  const paintStyle = figma.createPaintStyle();
  paintStyle.name = input.name;
  paintStyle.paints = [{ type: 'SOLID', color: hexToRgb(input.color) }];
  if (input.description !== undefined) {
    paintStyle.description = input.description;
  }

  return {
    styleId: paintStyle.id,
    name: paintStyle.name,
    color: input.color,
    message: `Color style created: ${paintStyle.name}`
  };
}

export async function handleCreateTextStyle(
  payload: Record<string, unknown>
): Promise<StyleResult> {
  const input = createTextStyleSchema.parse(payload);

  const textStyle = figma.createTextStyle();
  textStyle.name = input.name;

  const fontFamily = input.fontFamily ?? 'Inter';
  const fontWeight = input.fontWeight ?? 400;
  const fontResult = await loadFont(fontFamily, fontWeight);
  textStyle.fontName = fontResult.fontName;
  textStyle.fontSize = input.fontSize;

  if (input.lineHeight !== undefined) {
    textStyle.lineHeight = { value: input.lineHeight, unit: 'PIXELS' };
  }
  if (input.letterSpacing !== undefined) {
    textStyle.letterSpacing = { value: input.letterSpacing, unit: 'PIXELS' };
  }
  if (input.textCase !== undefined) {
    textStyle.textCase = input.textCase;
  }
  if (input.textDecoration !== undefined) {
    textStyle.textDecoration = input.textDecoration;
  }
  if (input.description !== undefined) {
    textStyle.description = input.description;
  }

  return {
    styleId: textStyle.id,
    name: textStyle.name,
    fontSize: input.fontSize,
    fontWeight: input.fontWeight,
    message: `Text style created: ${textStyle.name}`
  };
}

export function handleCreateEffectStyle(payload: Record<string, unknown>): StyleResult {
  const input = createEffectStyleSchema.parse(payload);

  const effectStyle = figma.createEffectStyle();
  effectStyle.name = input.name;

  const effects = convertEffects(input.effects);
  effectStyle.effects = effects;
  if (input.description !== undefined) {
    effectStyle.description = input.description;
  }

  return {
    styleId: effectStyle.id,
    name: effectStyle.name,
    effectCount: effects.length,
    message: `Effect style created: ${effectStyle.name}`
  };
}

export async function handleApplyFillStyle(payload: Record<string, unknown>): Promise<StyleResult> {
  const input = applyStyleSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node || !('fillStyleId' in node)) throw new Error('Node does not support fill styles');

  const styles = await figma.getLocalPaintStylesAsync();
  const matching = styles.filter((s) => s.name === input.styleName);
  if (matching.length === 0) throw new Error(`Fill style not found: ${input.styleName}`);
  if (matching.length > 1)
    throw new Error(
      `Multiple fill styles named "${input.styleName}" found (${matching.length}). Use a unique style name or apply by style ID.`
    );
  const style = matching[0];
  if (!style) throw new Error('Fill style match was empty');

  await (
    node as GeometryMixin & {
      fillStyleId: string;
      setFillStyleIdAsync: (id: string) => Promise<void>;
    }
  ).setFillStyleIdAsync(style.id);
  return {
    nodeId: input.nodeId,
    styleName: input.styleName,
    message: `Fill style applied: ${input.styleName}`
  };
}

export async function handleApplyTextStyle(payload: Record<string, unknown>): Promise<StyleResult> {
  const input = applyStyleSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (node?.type !== 'TEXT') throw new Error('Node is not a text node');

  const styles = await figma.getLocalTextStylesAsync();
  const matching = styles.filter((s) => s.name === input.styleName);
  if (matching.length === 0) throw new Error(`Text style not found: ${input.styleName}`);
  if (matching.length > 1)
    throw new Error(
      `Multiple text styles named "${input.styleName}" found (${matching.length}). Use a unique style name or apply by style ID.`
    );
  const style = matching[0];
  if (!style) throw new Error('Text style match was empty');

  await node.setTextStyleIdAsync(style.id);
  return {
    nodeId: input.nodeId,
    styleName: input.styleName,
    message: `Text style applied: ${input.styleName}`
  };
}

export async function handleApplyEffectStyle(
  payload: Record<string, unknown>
): Promise<StyleResult> {
  const input = applyStyleSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node || !('effectStyleId' in node)) throw new Error('Node does not support effect styles');

  const styles = await figma.getLocalEffectStylesAsync();
  const matching = styles.filter((s) => s.name === input.styleName);
  if (matching.length === 0) throw new Error(`Effect style not found: ${input.styleName}`);
  if (matching.length > 1)
    throw new Error(
      `Multiple effect styles named "${input.styleName}" found (${matching.length}). Use a unique style name or apply by style ID.`
    );
  const style = matching[0];
  if (!style) throw new Error('Effect style match was empty');

  await (
    node as BlendMixin & {
      effectStyleId: string;
      setEffectStyleIdAsync: (id: string) => Promise<void>;
    }
  ).setEffectStyleIdAsync(style.id);
  return {
    nodeId: input.nodeId,
    styleName: input.styleName,
    message: `Effect style applied: ${input.styleName}`
  };
}
