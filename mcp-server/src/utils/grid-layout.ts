/**
 * Grid-Based Layout Algorithm
 *
 * Provides a flexible grid system for automatic component placement
 * with support for responsive breakpoints and Figma frame conversion.
 */

import { z } from 'zod';

/**
 * Grid configuration schema
 */
export const gridConfigSchema = z.object({
  columns: z.number().int().positive().default(12).describe('Number of columns in the grid'),
  columnGap: z
    .number()
    .nonnegative()
    .default(16)
    .describe('Horizontal gap between columns in pixels'),
  rowGap: z.number().nonnegative().default(16).describe('Vertical gap between rows in pixels'),
  padding: z.number().nonnegative().default(24).describe('Container padding in pixels'),
  maxWidth: z.number().positive().optional().describe('Maximum container width in pixels')
});

export type GridConfig = z.infer<typeof gridConfigSchema>;

/**
 * Breakpoint configuration for responsive design
 */
export const breakpointSchema = z.object({
  name: z.string().describe('Breakpoint name (e.g., "mobile", "tablet", "desktop")'),
  minWidth: z.number().nonnegative().describe('Minimum viewport width in pixels'),
  maxWidth: z.number().positive().optional().describe('Maximum viewport width in pixels'),
  columns: z.number().int().positive().describe('Number of columns at this breakpoint'),
  columnGap: z.number().nonnegative().optional().describe('Column gap override'),
  rowGap: z.number().nonnegative().optional().describe('Row gap override'),
  padding: z.number().nonnegative().optional().describe('Padding override')
});

export type Breakpoint = z.infer<typeof breakpointSchema>;

/**
 * Grid item placement schema
 */
export const gridItemSchema = z.object({
  id: z.string().describe('Unique identifier for the grid item'),
  columnStart: z.number().int().positive().optional().describe('Starting column (1-indexed)'),
  columnSpan: z.number().int().positive().default(1).describe('Number of columns to span'),
  rowStart: z.number().int().positive().optional().describe('Starting row (1-indexed)'),
  rowSpan: z.number().int().positive().default(1).describe('Number of rows to span'),
  order: z.number().int().optional().describe('Display order for auto-placement'),
  width: z.number().positive().optional().describe('Item width in pixels'),
  height: z.number().positive().optional().describe('Item height in pixels')
});

export type GridItem = z.infer<typeof gridItemSchema>;

/**
 * Positioned grid item with calculated coordinates
 */
export interface PositionedGridItem extends GridItem {
  x: number;
  y: number;
  calculatedWidth: number;
  calculatedHeight: number;
  columnStart: number;
  rowStart: number;
}

/**
 * Grid layout result
 */
export interface GridLayoutResult {
  items: PositionedGridItem[];
  containerWidth: number;
  containerHeight: number;
  rows: number;
  columns: number;
}

/**
 * Default responsive breakpoints
 */
export const DEFAULT_BREAKPOINTS: Breakpoint[] = [
  {
    name: 'mobile',
    minWidth: 0,
    maxWidth: 767,
    columns: 4,
    columnGap: 12,
    padding: 16
  },
  {
    name: 'tablet',
    minWidth: 768,
    maxWidth: 1023,
    columns: 8,
    columnGap: 16,
    padding: 24
  },
  {
    name: 'desktop',
    minWidth: 1024,
    columns: 12,
    columnGap: 24,
    padding: 32
  }
];

/**
 * Calculate column width based on grid configuration
 */
function calculateColumnWidth(config: GridConfig, containerWidth: number): number {
  const totalGapWidth = config.columnGap * (config.columns - 1);
  const availableWidth = containerWidth - config.padding * 2 - totalGapWidth;
  return availableWidth / config.columns;
}

/**
 * Validate grid item placement
 */
function validateGridItem(item: GridItem, columns: number): void {
  if (item.columnStart !== undefined && item.columnStart < 1) {
    throw new Error(`Grid item ${item.id}: columnStart must be at least 1`);
  }

  if (item.columnStart !== undefined && item.columnStart > columns) {
    throw new Error(
      `Grid item ${item.id}: columnStart (${item.columnStart}) exceeds grid columns (${columns})`
    );
  }

  if (item.columnSpan < 1) {
    throw new Error(`Grid item ${item.id}: columnSpan must be at least 1`);
  }

  if (item.columnStart !== undefined && item.columnStart + item.columnSpan - 1 > columns) {
    throw new Error(
      `Grid item ${item.id}: item spans beyond grid (start: ${item.columnStart}, span: ${item.columnSpan}, columns: ${columns})`
    );
  }

  if (item.rowStart !== undefined && item.rowStart < 1) {
    throw new Error(`Grid item ${item.id}: rowStart must be at least 1`);
  }

  if (item.rowSpan < 1) {
    throw new Error(`Grid item ${item.id}: rowSpan must be at least 1`);
  }
}

/**
 * Auto-placement algorithm for grid items without explicit positioning
 */
function autoPlaceItems(
  items: GridItem[],
  columns: number
): Map<string, { column: number; row: number }> {
  const placements = new Map<string, { column: number; row: number }>();
  const occupiedCells = new Set<string>();

  // Sort items by order (if specified) or keep original order
  const sortedItems = [...items].sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    if (a.order !== undefined) {return -1;}
    if (b.order !== undefined) {return 1;}
    return 0;
  });

  let currentRow = 1;
  let currentColumn = 1;

  for (const item of sortedItems) {
    // If item has explicit position, use it
    if (item.columnStart !== undefined && item.rowStart !== undefined) {
      placements.set(item.id, { column: item.columnStart, row: item.rowStart });

      // Mark cells as occupied
      for (let r = item.rowStart; r < item.rowStart + item.rowSpan; r++) {
        for (let c = item.columnStart; c < item.columnStart + item.columnSpan; c++) {
          occupiedCells.add(`${r},${c}`);
        }
      }
      continue;
    }

    // Find next available position
    let placed = false;
    while (!placed) {
      // Check if item fits at current position
      let canPlace = true;

      if (currentColumn + item.columnSpan - 1 > columns) {
        // Move to next row
        currentRow++;
        currentColumn = 1;
        continue;
      }

      // Check if all required cells are available
      for (let r = currentRow; r < currentRow + item.rowSpan; r++) {
        for (let c = currentColumn; c < currentColumn + item.columnSpan; c++) {
          if (occupiedCells.has(`${r},${c}`)) {
            canPlace = false;
            break;
          }
        }
        if (!canPlace) {break;}
      }

      if (canPlace) {
        // Place the item
        placements.set(item.id, { column: currentColumn, row: currentRow });

        // Mark cells as occupied
        for (let r = currentRow; r < currentRow + item.rowSpan; r++) {
          for (let c = currentColumn; c < currentColumn + item.columnSpan; c++) {
            occupiedCells.add(`${r},${c}`);
          }
        }

        placed = true;

        // Move to next column
        currentColumn += item.columnSpan;
        if (currentColumn > columns) {
          currentRow++;
          currentColumn = 1;
        }
      } else {
        // Try next column
        currentColumn++;
        if (currentColumn > columns) {
          currentRow++;
          currentColumn = 1;
        }
      }
    }
  }

  return placements;
}

/**
 * Calculate grid layout with automatic placement
 */
export function calculateGridLayout(
  items: GridItem[],
  config: GridConfig,
  containerWidth?: number
): GridLayoutResult {
  // Validate configuration
  const validatedConfig = gridConfigSchema.parse(config);

  // Validate all items
  items.forEach((item) => validateGridItem(item, validatedConfig.columns));

  // Determine container width
  const actualContainerWidth = containerWidth ?? validatedConfig.maxWidth ?? 1200;

  // Calculate column width
  const columnWidth = calculateColumnWidth(validatedConfig, actualContainerWidth);

  // Auto-place items without explicit positions
  const placements = autoPlaceItems(items, validatedConfig.columns);

  // Calculate positioned items
  const positionedItems: PositionedGridItem[] = items.map((item) => {
    const placement = placements.get(item.id);
    const columnStart = item.columnStart ?? placement?.column ?? 1;
    const rowStart = item.rowStart ?? placement?.row ?? 1;

    // Calculate x position
    const x =
      validatedConfig.padding + (columnStart - 1) * (columnWidth + validatedConfig.columnGap);

    // Calculate width
    const calculatedWidth =
      item.width ??
      columnWidth * item.columnSpan + validatedConfig.columnGap * (item.columnSpan - 1);

    // Calculate y position (will be updated after we know row heights)
    const y = validatedConfig.padding + (rowStart - 1) * validatedConfig.rowGap;

    // Use provided height or default
    const calculatedHeight = item.height ?? 100;

    return {
      ...item,
      columnStart,
      rowStart,
      x,
      y,
      calculatedWidth,
      calculatedHeight
    };
  });

  // Calculate row heights and adjust y positions
  const rowHeights = new Map<number, number>();

  // First pass: determine row heights
  for (const item of positionedItems) {
    for (let r = item.rowStart; r < item.rowStart + item.rowSpan; r++) {
      const currentHeight = rowHeights.get(r) ?? 0;
      const itemHeightPerRow = item.calculatedHeight / item.rowSpan;
      rowHeights.set(r, Math.max(currentHeight, itemHeightPerRow));
    }
  }

  // Second pass: adjust y positions based on actual row heights
  for (const item of positionedItems) {
    let y = validatedConfig.padding;
    for (let r = 1; r < item.rowStart; r++) {
      y += (rowHeights.get(r) ?? 0) + validatedConfig.rowGap;
    }
    item.y = y;
  }

  // Calculate total rows and container height
  const maxRow = Math.max(...positionedItems.map((item) => item.rowStart + item.rowSpan - 1));
  let containerHeight = validatedConfig.padding;

  for (let r = 1; r <= maxRow; r++) {
    containerHeight += rowHeights.get(r) ?? 0;
    if (r < maxRow) {
      containerHeight += validatedConfig.rowGap;
    }
  }
  containerHeight += validatedConfig.padding;

  return {
    items: positionedItems,
    containerWidth: actualContainerWidth,
    containerHeight,
    rows: maxRow,
    columns: validatedConfig.columns
  };
}

/**
 * Get grid configuration for a specific breakpoint
 */
export function getBreakpointConfig(
  viewportWidth: number,
  breakpoints: Breakpoint[] = DEFAULT_BREAKPOINTS,
  baseConfig: GridConfig = { columns: 12, columnGap: 16, rowGap: 16, padding: 24 }
): GridConfig {
  // Find matching breakpoint
  const breakpoint = breakpoints.find((bp) => {
    const meetsMin = viewportWidth >= bp.minWidth;
    const meetsMax = bp.maxWidth === undefined || viewportWidth <= bp.maxWidth;
    return meetsMin && meetsMax;
  });

  if (!breakpoint) {
    return baseConfig;
  }

  // Merge breakpoint config with base config
  return {
    columns: breakpoint.columns,
    columnGap: breakpoint.columnGap ?? baseConfig.columnGap,
    rowGap: breakpoint.rowGap ?? baseConfig.rowGap,
    padding: breakpoint.padding ?? baseConfig.padding,
    maxWidth: baseConfig.maxWidth
  };
}

/**
 * Convert grid layout to Figma frame structure
 */
export interface FigmaFrameNode {
  type: 'FRAME';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  layoutMode?: 'NONE';
  children?: FigmaFrameNode[];
}

export function convertGridToFigmaFrames(
  layout: GridLayoutResult,
  containerName: string = 'GridContainer'
): FigmaFrameNode {
  // Create container frame
  const container: FigmaFrameNode = {
    type: 'FRAME',
    name: containerName,
    x: 0,
    y: 0,
    width: layout.containerWidth,
    height: layout.containerHeight,
    layoutMode: 'NONE',
    children: layout.items.map((item) => ({
      type: 'FRAME',
      name: item.id,
      x: item.x,
      y: item.y,
      width: item.calculatedWidth,
      height: item.calculatedHeight
    }))
  };

  return container;
}

/**
 * Generate CSS Grid equivalent
 */
export function generateCssGrid(config: GridConfig): string {
  return `.grid-container {
  display: grid;
  grid-template-columns: repeat(${config.columns}, 1fr);
  gap: ${config.rowGap}px ${config.columnGap}px;
  padding: ${config.padding}px;${config.maxWidth ? `\n  max-width: ${config.maxWidth}px;` : ''}
}`;
}

/**
 * Generate CSS for grid item
 */
export function generateCssGridItem(item: GridItem): string {
  const rules: string[] = [];

  if (item.columnStart !== undefined) {
    rules.push(`grid-column-start: ${item.columnStart}`);
  }

  if (item.columnSpan > 1) {
    rules.push(`grid-column-end: span ${item.columnSpan}`);
  }

  if (item.rowStart !== undefined) {
    rules.push(`grid-row-start: ${item.rowStart}`);
  }

  if (item.rowSpan > 1) {
    rules.push(`grid-row-end: span ${item.rowSpan}`);
  }

  if (item.order !== undefined) {
    rules.push(`order: ${item.order}`);
  }

  return `.grid-item-${item.id} {
  ${rules.map((rule) => `${rule};`).join('\n  ')}
}`;
}
