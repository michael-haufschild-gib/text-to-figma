/**
 * MCP Tool: export_node
 *
 * Exports a node to specified format (returns base64 data or saves file).
 *
 * PRIMITIVE: Raw Figma export primitive.
 * In Figma: await node.exportAsync({ format: 'PNG' })
 * Use for: generating assets, thumbnails, image data
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const ExportNodeInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node to export'),
  format: z.enum(['PNG', 'JPG', 'SVG', 'PDF']).describe('Export format'),
  scale: z
    .number()
    .positive()
    .optional()
    .default(1)
    .describe('Export scale (1 = 1x, 2 = 2x, etc.)'),
  returnBase64: z
    .boolean()
    .optional()
    .default(true)
    .describe('Return base64 data (true) or save to file (false)')
});

export type ExportNodeInput = z.infer<typeof ExportNodeInputSchema>;

/**
 * Tool definition
 */
export const exportNodeToolDefinition = {
  name: 'export_node',
  description: `Exports a node to specified format.

PRIMITIVE: Raw Figma export primitive - not a pre-made component.
Use for: generating assets, creating thumbnails, visual feedback.

Export Formats:
- PNG: Raster with transparency
- JPG: Raster without transparency
- SVG: Vector format
- PDF: Print format

Return Options:
- returnBase64: true (default) - Returns base64 data string
- returnBase64: false - Saves to file (requires file path)

Example - Export Icon as PNG:
export_node({
  nodeId: "icon-123",
  format: "PNG",
  scale: 2,
  returnBase64: true
})

Example - Export Logo as SVG:
export_node({
  nodeId: "logo-456",
  format: "SVG",
  scale: 1,
  returnBase64: true
})

Example - Export at 3x:
export_node({
  nodeId: "button-789",
  format: "PNG",
  scale: 3,
  returnBase64: true
})

Use Cases:
- Visual feedback for Claude (render to see design)
- Asset generation for handoff
- Thumbnail creation
- Image preview`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node to export'
      },
      format: {
        type: 'string' as const,
        enum: ['PNG', 'JPG', 'SVG', 'PDF'],
        description: 'Export format'
      },
      scale: {
        type: 'number' as const,
        description: 'Export scale',
        default: 1
      },
      returnBase64: {
        type: 'boolean' as const,
        description: 'Return base64 data',
        default: true
      }
    },
    required: ['nodeId', 'format']
  }
};

/**
 * Result type
 */
export interface ExportNodeResult {
  nodeId: string;
  format: string;
  scale: number;
  base64Data?: string;
  filePath?: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function exportNode(input: ExportNodeInput): Promise<ExportNodeResult> {
  // Validate input
  const validated = input;

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  const response = await bridge.sendToFigmaWithRetry<{
    success: boolean;
    base64Data?: string;
    filePath?: string;
    error?: string;
  }>('export_node', {
    nodeId: validated.nodeId,
    format: validated.format,
    scale: validated.scale,
    returnBase64: validated.returnBase64
  });
  // Note: Response validated by bridge at protocol level

  const scaleLabel = validated.scale === 1 ? '1x' : `${validated.scale}x`;

  return {
    nodeId: validated.nodeId,
    format: validated.format,
    scale: validated.scale,
    base64Data: response.base64Data,
    filePath: response.filePath,
    message: `Exported node as ${validated.format} at ${scaleLabel}`
  };
}
