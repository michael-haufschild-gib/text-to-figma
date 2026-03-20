/**
 * MCP Tool: add_layout_grid
 *
 * Adds a layout grid to a frame for alignment and spacing.
 *
 * PRIMITIVE: Raw Figma layout grid primitive.
 * In Figma: frame.layoutGrids = [...]
 * Use for: column grids, row grids, baseline grids
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const AddLayoutGridInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the frame to add grid to'),
  pattern: z.enum(['COLUMNS', 'ROWS', 'GRID']).describe('Grid pattern type'),
  count: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Number of columns/rows (for COLUMNS/ROWS)'),
  gutter: z.number().min(0).optional().default(20).describe('Space between columns/rows'),
  margin: z.number().min(0).optional().default(0).describe('Margin from edges'),
  offset: z.number().optional().default(0).describe('Offset from start'),
  color: z.string().optional().default('#FF0000').describe('Grid color in hex'),
  opacity: z.number().min(0).max(1).optional().default(0.1).describe('Grid visibility opacity')
});

export type AddLayoutGridInput = z.infer<typeof AddLayoutGridInputSchema>;

/**
 * Tool definition
 */
export const addLayoutGridToolDefinition = {
  name: 'add_layout_grid',
  description: `Adds a layout grid to a frame for alignment and spacing.

PRIMITIVE: Raw Figma layout grid primitive - not a pre-made component.
Use for: column grids (12-column layouts), row grids, baseline grids.

Grid Types:
- **COLUMNS**: Vertical columns (most common)
  * 12 columns = Standard web grid
  * 8 columns = Mobile layouts
  * 16 columns = Dense layouts
- **ROWS**: Horizontal rows
  * Use for vertical rhythm
  * Baseline grids
- **GRID**: Square grid (both columns and rows)
  * Use for pixel-perfect alignment
  * Icon grids

Common Configurations:
- Web (12-column): count=12, gutter=20, margin=64
- Mobile (4-column): count=4, gutter=16, margin=16
- Tablet (8-column): count=8, gutter=20, margin=32

Example - 12-Column Web Grid:
add_layout_grid({
  nodeId: "page-frame-123",
  pattern: "COLUMNS",
  count: 12,
  gutter: 20,
  margin: 64,
  color: "#FF0000",
  opacity: 0.1
})

Example - 8px Baseline Grid:
add_layout_grid({
  nodeId: "content-frame-456",
  pattern: "ROWS",
  count: 0,
  gutter: 8,
  color: "#0000FF",
  opacity: 0.05
})

CSS Equivalent:
/* Column grid helper */
.container {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 20px;
  padding: 0 64px;
}`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the frame'
      },
      pattern: {
        type: 'string' as const,
        enum: ['COLUMNS', 'ROWS', 'GRID'],
        description: 'Grid pattern type'
      },
      count: {
        type: 'number' as const,
        description: 'Number of columns/rows'
      },
      gutter: {
        type: 'number' as const,
        description: 'Space between columns/rows',
        default: 20
      },
      margin: {
        type: 'number' as const,
        description: 'Margin from edges',
        default: 0
      },
      offset: {
        type: 'number' as const,
        description: 'Offset from start',
        default: 0
      },
      color: {
        type: 'string' as const,
        description: 'Grid color in hex',
        default: '#FF0000'
      },
      opacity: {
        type: 'number' as const,
        description: 'Grid visibility opacity',
        default: 0.1
      }
    },
    required: ['nodeId', 'pattern']
  }
};

/**
 * Result type
 */
export interface AddLayoutGridResult {
  nodeId: string;
  pattern: string;
  count?: number;
  gutter: number;
  margin: number;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function addLayoutGrid(input: AddLayoutGridInput): Promise<AddLayoutGridResult> {
  // Validate input
  const validated = input;

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  // Note: bridge.sendToFigma validates success at protocol level
  // It only resolves if Figma returns success=true, otherwise rejects
  await bridge.sendToFigmaWithRetry('add_layout_grid', {
    nodeId: validated.nodeId,
    pattern: validated.pattern,
    count: validated.count,
    gutter: validated.gutter,
    margin: validated.margin,
    offset: validated.offset,
    color: validated.color,
    opacity: validated.opacity
  });

  // Build CSS equivalent
  let cssEquivalent = '';
  if (validated.pattern === 'COLUMNS' && validated.count !== undefined) {
    cssEquivalent = `.container {\n  display: grid;\n  grid-template-columns: repeat(${String(validated.count)}, 1fr);\n  gap: ${String(validated.gutter)}px;\n  padding: 0 ${String(validated.margin)}px;\n}`;
  } else if (validated.pattern === 'ROWS' && validated.count !== undefined) {
    cssEquivalent = `.container {\n  display: grid;\n  grid-template-rows: repeat(${String(validated.count)}, 1fr);\n  gap: ${String(validated.gutter)}px;\n  padding: ${String(validated.margin)}px 0;\n}`;
  } else {
    cssEquivalent = `/* Grid layout for alignment reference */\n.container {\n  background-image: linear-gradient(...);\n  background-size: ${validated.gutter}px ${validated.gutter}px;\n}`;
  }

  const gridLabel =
    validated.count !== undefined
      ? `${String(validated.count)}-${validated.pattern.toLowerCase().slice(0, -1)}`
      : validated.pattern.toLowerCase();

  return {
    nodeId: validated.nodeId,
    pattern: validated.pattern,
    count: validated.count,
    gutter: validated.gutter,
    margin: validated.margin,
    cssEquivalent,
    message: `Added ${gridLabel} layout grid (gutter: ${validated.gutter}px, margin: ${validated.margin}px)`
  };
}
