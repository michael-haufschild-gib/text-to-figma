/**
 * Response Formatters
 *
 * Compact formatting utilities that minimize LLM token usage
 * by converting verbose Figma data into structured text.
 *
 * These are pure functions with no routing-layer dependencies,
 * so they can be safely imported by tool files.
 */

// ── Type Definitions ─────────────────────────────────────────────────────────

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

interface FigmaFillLike {
  type?: string;
  color?: RGBColor;
  opacity?: number;
  visible?: boolean;
  blendMode?: string;
  gradientStops?: Array<{ color?: RGBColor; position?: number }>;
}

interface BoundsLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HierarchyNodeLike {
  nodeId: string;
  type: string;
  name: string;
  bounds?: BoundsLike;
  children?: HierarchyNodeLike[];
}

interface SelectionNodeLike {
  nodeId: string;
  type: string;
  name: string;
  bounds?: BoundsLike;
  fills?: FigmaFillLike[];
  strokes?: FigmaFillLike[];
  strokeWeight?: number | Record<string, number>;
  strokeAlign?: string;
  cornerRadius?: number | Record<string, number>;
  opacity?: number;
  layoutMode?: string;
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  characters?: string;
  fontName?: { family: string; style: string };
  fontSize?: number;
  fontWeight?: number;
  textCase?: string;
  textDecoration?: string;
  textFills?: FigmaFillLike[];
  lineHeight?: Record<string, unknown>;
  letterSpacing?: Record<string, unknown>;
  styledSegments?: Array<{
    characters: string;
    start: number;
    end: number;
    fontSize: number;
    fontName: { family: string; style: string };
    fontWeight: number;
    fills?: FigmaFillLike[];
  }>;
  children?: SelectionNodeLike[];
}

// ── Primitive Formatters ─────────────────────────────────────────────────────

/** Convert Figma float RGB (0–1) to #RRGGBB hex string. */
export function rgbToHex(color: RGBColor): string {
  const r = Math.round(Math.max(0, Math.min(1, color.r)) * 255);
  const g = Math.round(Math.max(0, Math.min(1, color.g)) * 255);
  const b = Math.round(Math.max(0, Math.min(1, color.b)) * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}

/** Format a single Figma fill into compact text. Returns null for invisible fills. */
export function formatFill(fill: FigmaFillLike): string | null {
  if (fill.visible === false) return null;
  const type = fill.type ?? 'SOLID';

  if (type === 'SOLID' && fill.color) {
    const hex = rgbToHex(fill.color);
    const opacity =
      fill.opacity !== undefined && fill.opacity < 1 ? ` ${Math.round(fill.opacity * 100)}%` : '';
    return `${hex}${opacity}`;
  }

  if (
    (type === 'GRADIENT_LINEAR' || type === 'GRADIENT_RADIAL' || type === 'GRADIENT_ANGULAR') &&
    fill.gradientStops
  ) {
    const kind = type.replace('GRADIENT_', '').toLowerCase();
    const stops = fill.gradientStops.map((s) => (s.color ? rgbToHex(s.color) : '?')).join(' → ');
    return `${kind}-gradient(${stops})`;
  }

  if (type === 'IMAGE') return 'image-fill';

  return type.toLowerCase();
}

/** Format fills array into compact string. */
export function formatFills(fills: FigmaFillLike[] | undefined, label: string): string {
  if (!fills || fills.length === 0) return '';
  const formatted = fills.map(formatFill).filter(Boolean);
  if (formatted.length === 0) return '';
  return `${label}: ${formatted.join(', ')}`;
}

/** Format bounds as compact string: WxH @(X,Y) */
export function formatBounds(bounds: BoundsLike | undefined): string {
  if (!bounds) return '';
  const x = Math.round(bounds.x);
  const y = Math.round(bounds.y);
  const w = Math.round(bounds.width);
  const h = Math.round(bounds.height);
  return `${w}×${h} @(${x},${y})`;
}

// ── Internal Helpers ─────────────────────────────────────────────────────────

/** Format corner radius compactly. */
function formatCornerRadius(cr: number | Record<string, number> | undefined): string {
  if (cr === undefined || cr === 0) return '';
  if (typeof cr === 'number') return `radius: ${cr}`;
  const { topLeft, topRight, bottomRight, bottomLeft } = cr as {
    topLeft: number;
    topRight: number;
    bottomRight: number;
    bottomLeft: number;
  };
  if (topLeft === topRight && topRight === bottomRight && bottomRight === bottomLeft) {
    return topLeft === 0 ? '' : `radius: ${topLeft}`;
  }
  return `radius: ${topLeft},${topRight},${bottomRight},${bottomLeft}`;
}

/** Format stroke compactly. */
function formatStroke(
  strokes: FigmaFillLike[] | undefined,
  weight: number | Record<string, number> | undefined,
  align: string | undefined
): string {
  if (!strokes || strokes.length === 0) return '';
  const colors = strokes.map(formatFill).filter(Boolean);
  if (colors.length === 0) return '';

  let w = '';
  if (typeof weight === 'number') {
    w = `${weight}px`;
  } else if (weight && typeof weight === 'object') {
    const vals = Object.values(weight);
    if (vals.every((v) => v === vals[0])) {
      w = `${vals[0]}px`;
    } else {
      w = `${weight.top},${weight.right},${weight.bottom},${weight.left}px`;
    }
  }

  const a = align && align !== 'INSIDE' ? ` ${align.toLowerCase()}` : '';
  return `stroke: ${colors.join(', ')} ${w}${a}`.trim();
}

/** Format auto-layout as a one-liner. */
function formatLayout(node: SelectionNodeLike): string {
  if (!node.layoutMode || node.layoutMode === 'NONE') return '';
  const parts = [node.layoutMode];
  if (node.itemSpacing !== undefined && node.itemSpacing !== 0) {
    parts.push(`gap=${node.itemSpacing}`);
  }
  const t = node.paddingTop ?? 0;
  const r = node.paddingRight ?? 0;
  const b = node.paddingBottom ?? 0;
  const l = node.paddingLeft ?? 0;
  if (t !== 0 || r !== 0 || b !== 0 || l !== 0) {
    if (t === b && r === l && t === r) {
      parts.push(`pad=${t}`);
    } else if (t === b && r === l) {
      parts.push(`pad=${t},${r}`);
    } else {
      parts.push(`pad=${t},${r},${b},${l}`);
    }
  }
  return `layout: ${parts.join(' ')}`;
}

/** Format a text-type value only if non-default. */
function formatTypographyValue(key: string, value: Record<string, unknown> | undefined): string {
  if (!value) return '';
  const v = value.value as number | undefined;
  if (key === 'lineHeight') {
    if (value.unit === 'AUTO') return '';
    if (value.unit === 'PIXELS') return `line-height: ${String(v)}px`;
    if (value.unit === 'PERCENT') return `line-height: ${String(v)}%`;
  }
  if (key === 'letterSpacing') {
    if (value.unit === 'PERCENT' && v === 0) return '';
    if (value.unit === 'PIXELS') return `letter-spacing: ${String(v)}px`;
    if (value.unit === 'PERCENT') return `letter-spacing: ${String(v)}%`;
  }
  return '';
}

/** Format text properties compactly. */
function formatTextProps(node: SelectionNodeLike): string[] {
  const lines: string[] = [];
  if (node.characters !== undefined) {
    const text =
      node.characters.length > 120 ? node.characters.slice(0, 117) + '...' : node.characters;
    lines.push(`text: "${text}"`);
  }

  if (node.styledSegments && node.styledSegments.length > 1) {
    const segs = node.styledSegments.map((s) => {
      const firstFill = s.fills?.[0];
      const fillStr = firstFill ? ` ${formatFill(firstFill) ?? ''}` : '';
      return `[${s.start}-${s.end}] ${s.fontName.family} ${s.fontName.style} ${s.fontSize}${fillStr}`;
    });
    lines.push(`segments: ${segs.join(' | ')}`);
  } else if (node.fontName) {
    const parts = [node.fontName.family, node.fontName.style];
    if (node.fontSize !== undefined) parts.push(String(node.fontSize));
    lines.push(`font: ${parts.join(' ')}`);

    const fillStr = formatFills(node.textFills, 'color');
    if (fillStr !== '') lines.push(fillStr);
  }

  if (node.textDecoration && node.textDecoration !== 'NONE') {
    lines.push(`decoration: ${node.textDecoration.toLowerCase()}`);
  }
  if (node.textCase && node.textCase !== 'ORIGINAL') {
    lines.push(`case: ${node.textCase.toLowerCase()}`);
  }

  const lh = formatTypographyValue('lineHeight', node.lineHeight);
  if (lh !== '') lines.push(lh);
  const ls = formatTypographyValue('letterSpacing', node.letterSpacing);
  if (ls !== '') lines.push(ls);

  return lines;
}

// ── Composite Formatters ─────────────────────────────────────────────────────

/**
 * When a node has more children than this threshold, children are rendered
 * in reduced format (header line only — type, name, id, bounds) instead of
 * full detail. The AI agent can then query specific children via
 * get_node_by_id for fills, layout, text properties, etc.
 */
const DETAIL_CHILDREN_THRESHOLD = 10;

/** Render a child node as a single header line (reduced format). */
function formatChildHeaderOnly(child: SelectionNodeLike, indent: string): string {
  const bounds = formatBounds(child.bounds);
  const suffix = bounds !== '' ? ` ${bounds}` : '';
  return `${indent}${child.type} "${child.name}" [${child.nodeId}]${suffix}`;
}

/**
 * Format a selection node tree into compact indented text.
 *
 * Children rendering strategy:
 * - ≤ DETAIL_CHILDREN_THRESHOLD children → full detail per child
 * - > threshold → reduced format (header line only) for ALL children,
 *   with a hint to use get_node_by_id for detailed properties
 */
export function formatSelectionNode(node: SelectionNodeLike, depth: number = 0): string {
  const indent = '  '.repeat(depth);
  const childIndent = '  '.repeat(depth + 1);
  const lines: string[] = [];

  // Header line: TYPE "Name" [id] WxH @(X,Y)
  const bounds = formatBounds(node.bounds);
  const boundsSuffix = bounds !== '' ? ` ${bounds}` : '';
  lines.push(`${indent}${node.type} "${node.name}" [${node.nodeId}]${boundsSuffix}`);

  // Properties (only non-default values)
  const props: string[] = [];

  const fillStr = formatFills(node.fills, 'fill');
  if (fillStr !== '') props.push(fillStr);

  const strokeStr = formatStroke(node.strokes, node.strokeWeight, node.strokeAlign);
  if (strokeStr !== '') props.push(strokeStr);

  const crStr = formatCornerRadius(node.cornerRadius);
  if (crStr !== '') props.push(crStr);

  if (node.opacity !== undefined && node.opacity < 1) {
    props.push(`opacity: ${Math.round(node.opacity * 100)}%`);
  }

  const layoutStr = formatLayout(node);
  if (layoutStr !== '') props.push(layoutStr);

  if (node.type === 'TEXT') {
    props.push(...formatTextProps(node));
  }

  for (const prop of props) {
    lines.push(`${childIndent}${prop}`);
  }

  // Children
  if (node.children && node.children.length > 0) {
    const count = node.children.length;

    if (count <= DETAIL_CHILDREN_THRESHOLD) {
      // Few children → full detail
      for (const child of node.children) {
        lines.push(formatSelectionNode(child, depth + 1));
      }
    } else {
      // Many children → reduced format (header only) for all
      lines.push(
        `${childIndent}[${count} children — use get_node_by_id on a specific child for full properties]`
      );
      for (const child of node.children) {
        lines.push(formatChildHeaderOnly(child, childIndent));
      }
    }
  }

  return lines.join('\n');
}

/**
 * Format a hierarchy node tree into compact indented text.
 * Uses tree-drawing characters for visual structure.
 */
function formatHierarchyNode(node: HierarchyNodeLike, prefix: string, isLast: boolean): string {
  const connector = isLast ? '└─ ' : '├─ ';
  const bounds = node.bounds
    ? ` ${Math.round(node.bounds.width)}×${Math.round(node.bounds.height)}`
    : '';
  const line = `${prefix}${connector}${node.type} "${node.name}" [${node.nodeId}]${bounds}`;

  const children = node.children ?? [];
  if (children.length === 0) return line;

  const childPrefix = prefix + (isLast ? '   ' : '│  ');
  const childLines = children.map((child, i) =>
    formatHierarchyNode(child, childPrefix, i === children.length - 1)
  );

  return [line, ...childLines].join('\n');
}

/** Type guard: value looks like a HierarchyNode (has nodeId, type, name). */
function isHierarchyNode(value: unknown): value is HierarchyNodeLike {
  if (value === null || value === undefined || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.nodeId === 'string' && typeof obj.type === 'string' && typeof obj.name === 'string'
  );
}

/**
 * Format hierarchy data into a compact printable tree.
 */
export function formatHierarchyTree(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }

  // Handle HierarchyNode[] — only if elements actually look like nodes
  if (Array.isArray(data) && data.length > 0 && isHierarchyNode(data[0])) {
    const nodes = data as HierarchyNodeLike[];
    return nodes.map((node, i) => formatHierarchyNode(node, '', i === nodes.length - 1)).join('\n');
  }

  if (data !== null && data !== undefined && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (typeof obj.hierarchy === 'string' && obj.hierarchy !== '') {
      return obj.hierarchy;
    }
    return JSON.stringify(data, null, 2);
  }

  return String(data);
}
