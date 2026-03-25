/**
 * Shared Node Specification Types
 *
 * Canonical type definitions for design node specifications used by
 * create_design (Zod-validated input) and auto-validator (correction engine).
 *
 * The index signature on NodeProps allows auto-validator to iterate fields
 * dynamically while still providing explicit type hints for known properties.
 */

/**
 * Node types supported by the create_design batch creation tool.
 */
export type NodeType = 'frame' | 'text' | 'ellipse' | 'rectangle' | 'line';

/**
 * Properties for a design node specification.
 *
 * Explicit fields provide IDE autocompletion and documentation.
 * The index signature supports dynamic iteration in auto-validator.
 */
export interface NodeProps {
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
  horizontalSizing?: 'FILL' | 'HUG' | 'FIXED';
  verticalSizing?: 'FILL' | 'HUG' | 'FIXED';
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX';

  // Fills
  fillColor?: string;
  fillOpacity?: number;
  fills?: Array<{
    type: string;
    color?: { r: number; g: number; b: number };
    opacity?: number;
  }>;

  // Stroke
  strokeColor?: string;
  strokeWeight?: number;
  strokeAlign?: 'INSIDE' | 'OUTSIDE' | 'CENTER';

  // Effects
  effects?: Array<{
    type: string;
    color?: { r: number; g: number; b: number; a: number };
    offset?: { x: number; y: number };
    radius?: number;
    spread?: number;
    visible?: boolean;
  }>;
  cornerRadius?: number;

  // Text properties
  content?: string;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  color?: string;
  textAlign?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  lineHeight?: number;
  letterSpacing?: number;

  // Index signature for dynamic field iteration (used by auto-validator)
  [key: string]: unknown;
}

/**
 * Hierarchical node specification for batch design creation.
 *
 * Represents a single node in the design tree. Frames can have children;
 * leaf nodes (text, ellipse, rectangle, line) cannot.
 */
export interface NodeSpec {
  type: NodeType;
  name?: string;
  props?: NodeProps;
  children?: NodeSpec[];
}
