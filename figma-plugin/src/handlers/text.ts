/**
 * Text Command Handlers
 *
 * Handles: set_text_properties, set_text_decoration, set_text_case,
 * set_letter_spacing, set_paragraph_spacing
 */

import { getNode } from '../helpers.js';
import { checkEnum, validatePayload, type ValidationRule } from '../validate.js';

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

const nodeIdRules: ValidationRule[] = [{ field: 'nodeId', type: 'string', required: true }];

export async function handleSetTextProperties(payload: Record<string, unknown>): Promise<unknown> {
  const error = validatePayload(payload, nodeIdRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
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

  const decoration = checkEnum(payload.decoration, TEXT_DECORATIONS);
  if (decoration !== undefined) {
    node.textDecoration = decoration;
  }
  if (typeof payload.letterSpacing === 'object' && payload.letterSpacing !== null) {
    const ls = payload.letterSpacing as Record<string, unknown>;
    const unit = checkEnum(ls.unit, SPACING_UNITS) ?? 'PIXELS';
    if (typeof ls.value === 'number') {
      node.letterSpacing = { value: ls.value, unit };
    }
  }
  const textCase = checkEnum(payload.textCase, TEXT_CASES);
  if (textCase !== undefined) {
    node.textCase = textCase;
  }
  if (typeof payload.paragraphSpacing === 'number')
    node.paragraphSpacing = payload.paragraphSpacing;
  if (typeof payload.paragraphIndent === 'number') node.paragraphIndent = payload.paragraphIndent;

  return { nodeId: payload.nodeId, message: 'Text properties set successfully' };
}

export function handleSetTextDecoration(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, nodeIdRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
  if (node?.type !== 'TEXT') throw new Error('Node is not a text node');

  const decoration = checkEnum(payload.decoration, TEXT_DECORATIONS);
  if (decoration === undefined)
    throw new Error(`Invalid decoration: ${String(payload.decoration)}`);
  node.textDecoration = decoration;
  return {
    nodeId: payload.nodeId,
    decoration: payload.decoration,
    message: 'Text decoration set successfully (deprecated - use set_text_properties)'
  };
}

export function handleSetTextCase(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, nodeIdRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
  if (node?.type !== 'TEXT') throw new Error('Node is not a text node');

  const textCase = checkEnum(payload.textCase, TEXT_CASES);
  if (textCase === undefined) throw new Error(`Invalid textCase: ${String(payload.textCase)}`);
  node.textCase = textCase;
  return {
    nodeId: payload.nodeId,
    textCase: payload.textCase,
    message: 'Text case set successfully'
  };
}

export function handleSetLetterSpacing(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, nodeIdRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
  if (node?.type !== 'TEXT') throw new Error('Node is not a text node');

  const unit = checkEnum(payload.unit, SPACING_UNITS) ?? 'PERCENT';
  if (typeof payload.value !== 'number') throw new Error('value must be a number');
  node.letterSpacing = { value: payload.value, unit };
  return {
    nodeId: payload.nodeId,
    value: payload.value,
    unit,
    message: 'Letter spacing set successfully'
  };
}

export function handleSetParagraphSpacing(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, nodeIdRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
  if (node?.type !== 'TEXT') throw new Error('Node is not a text node');

  if (typeof payload.paragraphSpacing === 'number')
    node.paragraphSpacing = payload.paragraphSpacing;
  if (typeof payload.paragraphIndent === 'number') node.paragraphIndent = payload.paragraphIndent;

  return { nodeId: payload.nodeId, message: 'Paragraph spacing set successfully' };
}
