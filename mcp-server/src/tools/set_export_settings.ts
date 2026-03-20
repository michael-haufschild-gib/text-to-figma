/**
 * MCP Tool: set_export_settings
 *
 * Configures export settings for a node (format, scale, suffix).
 *
 * PRIMITIVE: Raw Figma export settings primitive.
 * In Figma: node.exportSettings = [...]
 * Use for: asset generation, image exports, developer handoff
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Export setting schema
 */
const ExportSettingSchema = z.object({
  format: z.enum(['PNG', 'JPG', 'SVG', 'PDF']).describe('Export format'),
  suffix: z.string().optional().describe('Filename suffix (e.g., "@2x", "-icon")'),
  scale: z.number().positive().optional().default(1).describe('Export scale (1 = 1x, 2 = 2x, etc.)')
});

/**
 * Input schema
 */
export const SetExportSettingsInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node'),
  settings: z.array(ExportSettingSchema).min(1).describe('Array of export settings')
});

export type SetExportSettingsInput = z.infer<typeof SetExportSettingsInputSchema>;

/**
 * Tool definition
 */
export const setExportSettingsToolDefinition = {
  name: 'set_export_settings',
  description: `Configures export settings for a node.

PRIMITIVE: Raw Figma export settings primitive - not a pre-made component.
Use for: asset generation, multi-resolution exports, developer handoff.

Export Formats:
- PNG: Raster with transparency (most common)
- JPG: Raster without transparency (photos)
- SVG: Vector format (icons, logos)
- PDF: Print-ready format

Common Export Configurations:
- Web assets: PNG @1x, @2x, @3x
- Mobile icons: PNG @1x, @2x, @3x
- Print: PDF @1x
- Icons: SVG @1x

Example - Multi-Resolution PNG:
set_export_settings({
  nodeId: "icon-123",
  settings: [
    { format: "PNG", suffix: "", scale: 1 },
    { format: "PNG", suffix: "@2x", scale: 2 },
    { format: "PNG", suffix: "@3x", scale: 3 }
  ]
})

Example - Icon Export:
set_export_settings({
  nodeId: "logo-456",
  settings: [
    { format: "SVG", suffix: "", scale: 1 },
    { format: "PNG", suffix: "@2x", scale: 2 }
  ]
})

Example - Print Export:
set_export_settings({
  nodeId: "poster-789",
  settings: [
    { format: "PDF", suffix: "-print", scale: 1 }
  ]
})

After setting, use export_node to generate files.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node'
      },
      settings: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            format: {
              type: 'string' as const,
              enum: ['PNG', 'JPG', 'SVG', 'PDF']
            },
            suffix: {
              type: 'string' as const
            },
            scale: {
              type: 'number' as const
            }
          },
          required: ['format']
        }
      }
    },
    required: ['nodeId', 'settings']
  }
};

/**
 * Result type
 */
export interface SetExportSettingsResult {
  nodeId: string;
  settingsCount: number;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function setExportSettings(
  input: SetExportSettingsInput
): Promise<SetExportSettingsResult> {
  // Validate input
  const validated = input;

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  // Note: bridge.sendToFigma validates success at protocol level
  // It only resolves if Figma returns success=true, otherwise rejects
  await bridge.sendToFigmaWithRetry('set_export_settings', {
    nodeId: validated.nodeId,
    settings: validated.settings
  });

  return {
    nodeId: validated.nodeId,
    settingsCount: validated.settings.length,
    message: `Configured ${validated.settings.length} export setting(s) for node`
  };
}
