/**
 * Text Command Handlers
 *
 * Handles: set_text_properties, set_text_decoration, set_text_case,
 * set_letter_spacing, set_paragraph_spacing
 */

import { z } from 'zod';
import { getNode } from '../helpers.js';

// ── Return types ─────────────────────────────────────────────────────────────

interface OperationResult {
  nodeId: unknown;
  message: string;
  [key: string]: unknown;
}

const TEXT_DECORATIONS = ['NONE', 'UNDERLINE', 'STRIKETHROUGH'] as const;
const TEXT_CASES = [
  'ORIGINAL',
  'UPPER',
  'LOWER',
  'TITLE',
  'SMALL_CAPS',
  'SMALL_CAPS_FORCED'
] as const;
const SPACING_UNITS = ['PIXELS', 'PERCENT'] as const;

const setTextPropertiesSchema = z.object({
  nodeId: z.string(),
  decoration: z.enum(TEXT_DECORATIONS).optional(),
  letterSpacing: z
    .object({
      value: z.number().optional(),
      unit: z.enum(SPACING_UNITS).optional()
    })
    .optional(),
  textCase: z.enum(TEXT_CASES).optional(),
  paragraphSpacing: z.number().optional(),
  paragraphIndent: z.number().optional()
});

export async function handleSetTextProperties(
  payload: Record<string, unknown>
): Promise<OperationResult> {
  const input = setTextPropertiesSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (node?.type !== 'TEXT') throw new Error('Node is not a text node');

  const fontName = node.fontName;
  if (fontName === figma.mixed) {
    const len = node.characters.length;
    if (len > 0) {
      const firstFont = node.getRangeFontName(0, 1) as FontName;
      await figma.loadFontAsync(firstFont);
    }
  } else {
    await figma.loadFontAsync(fontName);
  }

  if (input.decoration !== undefined) {
    node.textDecoration = input.decoration;
  }
  if (input.letterSpacing !== undefined) {
    const unit = input.letterSpacing.unit ?? 'PIXELS';
    if (input.letterSpacing.value !== undefined) {
      node.letterSpacing = { value: input.letterSpacing.value, unit };
    }
  }
  if (input.textCase !== undefined) {
    node.textCase = input.textCase;
  }
  if (input.paragraphSpacing !== undefined) node.paragraphSpacing = input.paragraphSpacing;
  if (input.paragraphIndent !== undefined) node.paragraphIndent = input.paragraphIndent;

  return { nodeId: input.nodeId, message: 'Text properties set successfully' };
}

const setTextDecorationSchema = z.object({
  nodeId: z.string(),
  decoration: z.enum(TEXT_DECORATIONS)
});

export function handleSetTextDecoration(payload: Record<string, unknown>): OperationResult {
  const input = setTextDecorationSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (node?.type !== 'TEXT') throw new Error('Node is not a text node');

  node.textDecoration = input.decoration;
  return {
    nodeId: input.nodeId,
    decoration: input.decoration,
    message: 'Text decoration set successfully (deprecated - use set_text_properties)'
  };
}

const setTextCaseSchema = z.object({
  nodeId: z.string(),
  textCase: z.enum(TEXT_CASES)
});

export function handleSetTextCase(payload: Record<string, unknown>): OperationResult {
  const input = setTextCaseSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (node?.type !== 'TEXT') throw new Error('Node is not a text node');

  node.textCase = input.textCase;
  return {
    nodeId: input.nodeId,
    textCase: input.textCase,
    message: 'Text case set successfully'
  };
}

const setLetterSpacingSchema = z.object({
  nodeId: z.string(),
  value: z.number(),
  unit: z.enum(SPACING_UNITS).optional()
});

export function handleSetLetterSpacing(payload: Record<string, unknown>): OperationResult {
  const input = setLetterSpacingSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (node?.type !== 'TEXT') throw new Error('Node is not a text node');

  const unit = input.unit ?? 'PERCENT';
  node.letterSpacing = { value: input.value, unit };
  return {
    nodeId: input.nodeId,
    value: input.value,
    unit,
    message: 'Letter spacing set successfully'
  };
}

const setParagraphSpacingSchema = z.object({
  nodeId: z.string(),
  paragraphSpacing: z.number().optional(),
  paragraphIndent: z.number().optional()
});

export function handleSetParagraphSpacing(payload: Record<string, unknown>): OperationResult {
  const input = setParagraphSpacingSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (node?.type !== 'TEXT') throw new Error('Node is not a text node');

  if (input.paragraphSpacing !== undefined) node.paragraphSpacing = input.paragraphSpacing;
  if (input.paragraphIndent !== undefined) node.paragraphIndent = input.paragraphIndent;

  return { nodeId: input.nodeId, message: 'Paragraph spacing set successfully' };
}
