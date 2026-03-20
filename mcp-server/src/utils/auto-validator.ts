/**
 * Auto-Validator - Automatic design spec correction
 *
 * Validates and corrects design specs before creation to ensure
 * compliance with design system constraints (8pt grid, type scale).
 */

import { VALID_SPACING_VALUES, snapToGrid } from '../constraints/spacing.js';
import { VALID_FONT_SIZES, snapToTypeScale } from '../constraints/typography.js';

/**
 * Correction record for tracking what was changed
 */
export interface Correction {
  path: string;
  field: string;
  originalValue: number;
  correctedValue: number;
  reason: string;
}

/**
 * Result of auto-correction
 */
export interface AutoCorrectionResult {
  /** Original spec before corrections */
  original: NodeSpec;
  /** Corrected spec with fixes applied */
  corrected: NodeSpec;
  /** List of all corrections made */
  corrections: Correction[];
  /** Whether the spec was modified */
  wasModified: boolean;
}

/**
 * Node specification (matches create_design format)
 */
interface NodeSpec {
  type: 'frame' | 'text' | 'ellipse' | 'rectangle' | 'line';
  name?: string;
  props?: NodeProps;
  children?: NodeSpec[];
}

interface NodeProps {
  // Dimensions
  width?: number;
  height?: number;
  x?: number;
  y?: number;

  // Layout (frame only)
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  itemSpacing?: number;
  padding?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;

  // Text properties
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;

  // Corner radius
  cornerRadius?: number;

  [key: string]: unknown;
}

/**
 * Spacing fields that should be validated against the 8pt grid
 */
const SPACING_FIELDS = [
  'padding',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
  'itemSpacing',
  'gap'
] as const;

/**
 * Dimension fields that may need rounding (to nearest integer)
 */
const DIMENSION_FIELDS = ['width', 'height', 'x', 'y'] as const;

/**
 * Validates if a number is in the valid spacing values
 * @param value
 */
function isValidSpacing(value: number): boolean {
  return VALID_SPACING_VALUES.includes(value as (typeof VALID_SPACING_VALUES)[number]);
}

/**
 * Validates if a number is in the valid font sizes
 * @param value
 */
function isValidFontSize(value: number): boolean {
  return VALID_FONT_SIZES.includes(value as (typeof VALID_FONT_SIZES)[number]);
}

/**
 * Deep clone an object
 * @param obj
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Auto-correct a design spec to comply with design system constraints
 * @param spec
 */
export function autoCorrectSpec(spec: NodeSpec): AutoCorrectionResult {
  const corrections: Correction[] = [];
  const corrected = deepClone(spec);

  /**
   * Walk the node tree and apply corrections
   * @param node
   * @param path
   */
  function walkNode(node: NodeSpec, path: string): void {
    if (!node.props) {
      return;
    }

    const props = node.props;

    // Correct spacing values to 8pt grid
    for (const field of SPACING_FIELDS) {
      const value = props[field];
      if (typeof value === 'number' && !isValidSpacing(value)) {
        const snapped = snapToGrid(value);
        corrections.push({
          path,
          field,
          originalValue: value,
          correctedValue: snapped,
          reason: `Snapped to 8pt grid (was ${value}px, now ${snapped}px)`
        });
        props[field] = snapped;
      }
    }

    // Correct font sizes to type scale
    if (typeof props.fontSize === 'number' && !isValidFontSize(props.fontSize)) {
      const snapped = snapToTypeScale(props.fontSize);
      corrections.push({
        path,
        field: 'fontSize',
        originalValue: props.fontSize,
        correctedValue: snapped,
        reason: `Snapped to type scale (was ${props.fontSize}px, now ${snapped}px)`
      });
      props.fontSize = snapped;
    }

    // Correct corner radius to spacing scale (commonly uses same scale)
    if (typeof props.cornerRadius === 'number' && !isValidSpacing(props.cornerRadius)) {
      const snapped = snapToGrid(props.cornerRadius);
      corrections.push({
        path,
        field: 'cornerRadius',
        originalValue: props.cornerRadius,
        correctedValue: snapped,
        reason: `Snapped to 8pt grid (was ${props.cornerRadius}px, now ${snapped}px)`
      });
      props.cornerRadius = snapped;
    }

    // Round dimensions to whole pixels (for cleaner rendering)
    for (const field of DIMENSION_FIELDS) {
      const value = props[field];
      if (typeof value === 'number' && !Number.isInteger(value)) {
        const rounded = Math.round(value);
        corrections.push({
          path,
          field,
          originalValue: value,
          correctedValue: rounded,
          reason: `Rounded to whole pixel (was ${value}px, now ${rounded}px)`
        });
        props[field] = rounded;
      }
    }

    // Recurse to children
    if (node.children) {
      node.children.forEach((child, index) => {
        walkNode(child, `${path}.children[${index}]`);
      });
    }
  }

  // Start walking from root
  walkNode(corrected, 'root');

  return {
    original: spec,
    corrected,
    corrections,
    wasModified: corrections.length > 0
  };
}

/**
 * Validation issue found during spec validation
 */
export interface ValidationIssue {
  path: string;
  field: string;
  value: unknown;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  stats: {
    totalNodes: number;
    nodesByType: Record<string, number>;
    maxDepth: number;
  };
}

/**
 * Validate a design spec without modifying it
 * @param spec
 */
export function validateSpec(spec: NodeSpec): ValidationResult {
  const issues: ValidationIssue[] = [];
  let totalNodes = 0;
  const nodesByType: Record<string, number> = {};
  let maxDepth = 0;

  function walkNode(node: NodeSpec, path: string, depth: number): void {
    totalNodes++;
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    maxDepth = Math.max(maxDepth, depth);

    // Validate type
    if (!['frame', 'text', 'ellipse', 'rectangle', 'line'].includes(node.type)) {
      issues.push({
        path,
        field: 'type',
        value: node.type,
        message: `Invalid node type: ${node.type}`,
        severity: 'error'
      });
    }

    // Children only allowed on frames
    if (node.children && node.children.length > 0 && node.type !== 'frame') {
      issues.push({
        path,
        field: 'children',
        value: node.children.length,
        message: `Only frames can have children. ${node.type} has ${node.children.length} children.`,
        severity: 'error'
      });
    }

    if (node.props) {
      const props = node.props;

      // Validate spacing values
      for (const field of SPACING_FIELDS) {
        const value = props[field];
        if (typeof value === 'number' && !isValidSpacing(value)) {
          issues.push({
            path,
            field,
            value,
            message: `${field} value ${value}px is not on 8pt grid. Nearest: ${snapToGrid(value)}px`,
            severity: 'warning'
          });
        }
      }

      // Validate font size
      if (typeof props.fontSize === 'number' && !isValidFontSize(props.fontSize)) {
        issues.push({
          path,
          field: 'fontSize',
          value: props.fontSize,
          message: `fontSize ${props.fontSize}px not in type scale. Nearest: ${snapToTypeScale(props.fontSize)}px`,
          severity: 'warning'
        });
      }

      // Validate text node has content
      if (node.type === 'text') {
        const content = props.content || props.text;
        if (!content || (typeof content === 'string' && content.trim() === '')) {
          issues.push({
            path,
            field: 'content',
            value: content,
            message: 'Text node has empty or missing content',
            severity: 'warning'
          });
        }
      }
    }

    // Recurse to children
    if (node.children) {
      node.children.forEach((child, index) => {
        walkNode(child, `${path}.children[${index}]`, depth + 1);
      });
    }
  }

  walkNode(spec, 'root', 0);

  return {
    valid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
    stats: {
      totalNodes,
      nodesByType,
      maxDepth
    }
  };
}

/**
 * Format corrections for display
 * @param corrections
 */
export function formatCorrections(corrections: Correction[]): string {
  if (corrections.length === 0) {
    return 'No corrections needed';
  }

  const lines = [`Applied ${corrections.length} auto-correction(s):`];
  for (const c of corrections) {
    lines.push(`  • ${c.path}.${c.field}: ${c.reason}`);
  }
  return lines.join('\n');
}
