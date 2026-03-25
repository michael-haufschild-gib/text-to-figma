/**
 * Get Selection Tool - Returns currently selected nodes in Figma
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { defineHandler, formatSelectionNode, textResponse } from '../routing/handler-utils.js';

/**
 * Input schema for get_selection tool
 */
export const GetSelectionInputSchema = z.object({
  maxDepth: z
    .number()
    .int()
    .min(0)
    .max(10)
    .optional()
    .default(2)
    .describe(
      'How many levels of children to include (0=selected nodes only, 1=direct children, 2=grandchildren). Default: 2'
    )
});

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
interface FigmaPerCornerRadius {
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
}

interface FigmaPerSideStrokeWeight {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface FigmaStyledTextSegment {
  characters: string;
  start: number;
  end: number;
  fontSize: number;
  fontName: { family: string; style: string };
  fontWeight: number;
  textDecoration: string;
  textCase: string;
  lineHeight: Record<string, unknown>;
  letterSpacing: Record<string, unknown>;
  fills: FigmaFill[];
}

interface FigmaNodeSnapshot {
  nodeId: string;
  type: string;
  name: string;
  bounds?: { x: number; y: number; width: number; height: number };
  fills?: FigmaFill[];
  strokes?: FigmaFill[];
  strokeWeight?: number | FigmaPerSideStrokeWeight;
  strokeAlign?: string;
  cornerRadius?: number | FigmaPerCornerRadius;
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
  textFills?: FigmaFill[];
  lineHeight?: Record<string, unknown>;
  letterSpacing?: Record<string, unknown>;
  styledSegments?: FigmaStyledTextSegment[];
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
const perCornerRadiusSchema = z.object({
  topLeft: z.number(),
  topRight: z.number(),
  bottomLeft: z.number(),
  bottomRight: z.number()
});

const perSideStrokeWeightSchema = z.object({
  top: z.number(),
  right: z.number(),
  bottom: z.number(),
  left: z.number()
});

const styledTextSegmentSchema = z
  .object({
    characters: z.string(),
    start: z.number(),
    end: z.number(),
    fontSize: z.number(),
    fontName: z.object({ family: z.string(), style: z.string() }).passthrough(),
    fontWeight: z.number(),
    textDecoration: z.string(),
    textCase: z.string(),
    lineHeight: z.record(z.unknown()),
    letterSpacing: z.record(z.unknown()),
    fills: z.array(z.object({ type: z.string() }).passthrough())
  })
  .passthrough();

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
        .passthrough()
        .optional(),
      fills: z.array(z.object({ type: z.string() }).passthrough()).optional(),
      strokes: z.array(z.object({ type: z.string() }).passthrough()).optional(),
      strokeWeight: z.union([z.number(), perSideStrokeWeightSchema]).optional(),
      strokeAlign: z.string().optional(),
      cornerRadius: z.union([z.number(), perCornerRadiusSchema]).optional(),
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
      textFills: z.array(z.object({ type: z.string() }).passthrough()).optional(),
      lineHeight: z.record(z.unknown()).optional(),
      letterSpacing: z.record(z.unknown()).optional(),
      styledSegments: z.array(styledTextSegmentSchema).optional(),
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
export async function getSelection(input: GetSelectionInput): Promise<GetSelectionResult> {
  const bridge = getFigmaBridge();
  const response = await bridge.sendToFigmaValidated(
    'get_selection',
    { maxDepth: input.maxDepth },
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

Returns information about selected layers: type, name, ID, dimensions,
fills (as hex colors), strokes, corner radius, opacity, auto-layout
properties, and text properties.

**maxDepth** controls child inclusion:
- 0 = selected nodes only (no children)
- 1 = direct children included (default)
- 2-5 = deeper nesting (use sparingly on complex designs)

For deeper inspection of specific children, use get_children or get_node_by_id.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      maxDepth: {
        type: 'number' as const,
        description: 'Child nesting depth (0=none, 1=direct children, 2=grandchildren). Default: 2',
        default: 2
      }
    }
  }
};

export const handler = defineHandler<GetSelectionInput, GetSelectionResult>({
  name: 'get_selection',
  schema: GetSelectionInputSchema,
  execute: getSelection,
  formatResponse: (result) => {
    if (result.count === 0) {
      return textResponse('No nodes selected. Please select a layer in Figma first.');
    }
    let text = `Selected: ${result.count} node(s)\n\n`;
    text += result.selection
      .map((node) => formatSelectionNode(node as Parameters<typeof formatSelectionNode>[0]))
      .join('\n\n');
    return textResponse(text);
  },
  definition: getSelectionToolDefinition
});
