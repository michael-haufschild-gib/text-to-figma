/**
 * Get Selection Tool - Returns currently selected nodes in Figma
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema for get_selection tool
 */
export const GetSelectionInputSchema = z.object({});

export type GetSelectionInput = z.infer<typeof GetSelectionInputSchema>;

/**
 * RGB color from Figma
 */
interface FigmaRGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Fill from Figma selection
 */
interface FigmaFill {
  type: string;
  color?: FigmaRGB;
  opacity?: number;
}

/**
 * Snapshot of a selected Figma node with all relevant properties
 */
interface FigmaNodeSnapshot {
  nodeId: string;
  type: string;
  name: string;
  bounds: { x: number; y: number; width: number; height: number };
  fills?: FigmaFill[];
  strokes?: FigmaFill[];
  strokeWeight?: number;
  strokeAlign?: string;
  cornerRadius?: number;
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
  children?: FigmaNodeSnapshot[];
}

/**
 * Selection response from Figma
 */
export interface GetSelectionResult {
  selection: FigmaNodeSnapshot[];
  count: number;
}

/**
 * Response schema for Figma bridge get_selection response.
 * Uses z.lazy() for recursive children in FigmaNodeSnapshot.
 */
const figmaNodeSnapshotSchema: z.ZodType<FigmaNodeSnapshot> = z.lazy(() =>
  z
    .object({
      nodeId: z.string(),
      type: z.string(),
      name: z.string(),
      bounds: z
        .object({
          x: z.number(),
          y: z.number(),
          width: z.number(),
          height: z.number()
        })
        .passthrough(),
      fills: z.array(z.object({ type: z.string() }).passthrough()).optional(),
      strokes: z.array(z.object({ type: z.string() }).passthrough()).optional(),
      strokeWeight: z.number().optional(),
      strokeAlign: z.string().optional(),
      cornerRadius: z.number().optional(),
      opacity: z.number().optional(),
      layoutMode: z.string().optional(),
      itemSpacing: z.number().optional(),
      paddingTop: z.number().optional(),
      paddingRight: z.number().optional(),
      paddingBottom: z.number().optional(),
      paddingLeft: z.number().optional(),
      characters: z.string().optional(),
      fontName: z.object({ family: z.string(), style: z.string() }).passthrough().optional(),
      fontSize: z.number().optional(),
      fontWeight: z.number().optional(),
      textCase: z.string().optional(),
      textDecoration: z.string().optional(),
      children: z.array(figmaNodeSnapshotSchema).optional()
    })
    .passthrough()
);

const GetSelectionResponseSchema = z
  .object({
    selection: z.array(figmaNodeSnapshotSchema),
    count: z.number()
  })
  .passthrough();

/**
 * Gets currently selected nodes in Figma with detailed properties
 *
 * Returns comprehensive information about selected layers including fills,
 * strokes, layout properties, text properties, and complete child hierarchy.
 *
 * @param input
 * @returns Promise resolving to selection data
 * @throws Error if no nodes are selected
 *
 * @example
 * Get selected button component:
 * ```typescript
 * const result = await getSelection({});
 * console.log(`Selected ${result.count} nodes`);
 * const button = result.selection[0];
 * console.log(`Button fill: ${button.fills[0].color}`);
 * console.log(`Corner radius: ${button.cornerRadius}`);
 * ```
 */
export async function getSelection(_input: GetSelectionInput): Promise<GetSelectionResult> {
  // Input validated by routing layer

  const bridge = getFigmaBridge();
  const response = await bridge.sendToFigmaValidated(
    'get_selection',
    {},
    GetSelectionResponseSchema
  );

  return response;
}

/**
 * Tool definition for MCP
 */
export const getSelectionToolDefinition = {
  name: 'get_selection',
  description: `Gets currently selected nodes in Figma with detailed properties.

Returns comprehensive information about selected layers including:
- Node type, name, ID, and dimensions
- Fill colors, strokes, corner radius, opacity
- Auto-layout properties (layoutMode, padding, itemSpacing)
- Text properties (fontSize, fontName, characters, textCase, etc.)
- Complete child hierarchy with all nested elements

**Use this tool to:**
- Scan selected UI components from existing designs
- Extract exact design specifications for buttons, cards, forms
- Analyze component styles and recreate them via text-to-figma tools
- Get precise dimensions, colors, spacing for documentation

**Workflow:**
1. Select one or more layers in Figma
2. Call this tool to extract all properties
3. Use the returned data to recreate components with create_design or other tools

**Error Handling:**
- Throws error if no nodes are selected in Figma
- Prompts user to select layers before calling

**Example Usage:**
\`\`\`typescript
// User selects button component in Figma
const result = await getSelection({});

// result.selection[0] contains:
// {
//   nodeId: "123:456",
//   type: "FRAME",
//   name: "Primary Button",
//   bounds: { x: 0, y: 0, width: 120, height: 40 },
//   fills: [{ type: "SOLID", color: { r: 0.15, g: 0.93, b: 1 } }],
//   cornerRadius: 8,
//   layoutMode: "HORIZONTAL",
//   padding: 16,
//   itemSpacing: 8,
//   children: [{
//     type: "TEXT",
//     characters: "BUTTON",
//     fontSize: 14,
//     fontWeight: 500
//   }]
// }
\`\`\``,
  inputSchema: {
    type: 'object' as const,
    properties: {}
  }
};
