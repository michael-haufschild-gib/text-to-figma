/**
 * Text Command Handlers
 *
 * Handles: set_text_properties, set_text_decoration, set_text_case,
 * set_letter_spacing, set_paragraph_spacing
 */

import { getNode } from '../helpers.js';
import { validatePayload, type ValidationRule } from '../validate.js';

const nodeIdRules: ValidationRule[] = [{ field: 'nodeId', type: 'string', required: true }];

export async function handleSetTextProperties(payload: Record<string, unknown>): Promise<unknown> {
  const error = validatePayload(payload, nodeIdRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
  if (node?.type !== 'TEXT') throw new Error('Node is not a text node');

  await figma.loadFontAsync(node.fontName as FontName);

  if (typeof payload.decoration === 'string') {
    node.textDecoration = payload.decoration as TextDecoration;
  }
  if (payload.letterSpacing !== undefined) {
    const ls = payload.letterSpacing as { value: number; unit: string };
    node.letterSpacing = { value: ls.value, unit: ls.unit as 'PIXELS' | 'PERCENT' };
  }
  if (typeof payload.textCase === 'string') {
    node.textCase = payload.textCase as TextCase;
  }
  if (payload.paragraphSpacing !== undefined)
    node.paragraphSpacing = payload.paragraphSpacing as number;
  if (payload.paragraphIndent !== undefined)
    node.paragraphIndent = payload.paragraphIndent as number;

  return { nodeId: payload.nodeId, message: 'Text properties set successfully' };
}

export function handleSetTextDecoration(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, nodeIdRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
  if (node?.type !== 'TEXT') throw new Error('Node is not a text node');

  node.textDecoration = payload.decoration as TextDecoration;
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

  node.textCase = payload.textCase as TextCase;
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

  const unit =
    typeof payload.unit === 'string' ? (payload.unit as 'PIXELS' | 'PERCENT') : 'PERCENT';
  node.letterSpacing = { value: payload.value as number, unit };
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

  if (payload.paragraphSpacing !== undefined)
    node.paragraphSpacing = payload.paragraphSpacing as number;
  if (payload.paragraphIndent !== undefined)
    node.paragraphIndent = payload.paragraphIndent as number;

  return { nodeId: payload.nodeId, message: 'Paragraph spacing set successfully' };
}
