/**
 * MCP Tool: add_gradient_fill
 *
 * Applies a gradient fill (linear or radial) to a node.
 *
 * PRIMITIVE: Raw Figma gradient fill primitive.
 * In Figma: node.fills = [{ type: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL', gradientStops }]
 * Use for: modern backgrounds, buttons, cards, hero sections
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Gradient stop schema
 */
const GradientStopSchema = z.object({
  position: z.number().min(0).max(1).describe('Position along gradient (0-1)'),
  color: z.string().describe('Color in hex format (e.g., #FF0000)'),
  opacity: z.number().min(0).max(1).optional().default(1).describe('Opacity at this stop (0-1)')
});

/**
 * Input schema
 */
export const AddGradientFillInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node to apply gradient to'),
  type: z.enum(['LINEAR', 'RADIAL']).describe('Gradient type: LINEAR or RADIAL'),
  stops: z.array(GradientStopSchema).min(2).describe('Gradient color stops (minimum 2)'),
  angle: z.number().optional().default(0).describe('Angle in degrees for LINEAR gradient (0 = left to right, 90 = bottom to top)'),
  opacity: z.number().min(0).max(1).optional().default(1).describe('Overall gradient opacity (0-1)')
});

export type AddGradientFillInput = z.infer<typeof AddGradientFillInputSchema>;

/**
 * Tool definition
 */
export const addGradientFillToolDefinition = {
  name: 'add_gradient_fill',
  description: `Applies a gradient fill (linear or radial) to a node.

PRIMITIVE: Raw Figma gradient primitive - not a pre-made component.
Use for: modern backgrounds, buttons, cards, overlays, hero sections.

Gradient Types:
- LINEAR: Straight line gradient (use angle to control direction)
- RADIAL: Circular gradient from center outward

Each gradient needs 2+ color stops with positions (0-1).

Example - Linear Gradient (Blue to Purple):
add_gradient_fill({
  nodeId: "frame-123",
  type: "LINEAR",
  angle: 45,  // Diagonal
  stops: [
    { position: 0, color: "#0066FF", opacity: 1 },
    { position: 1, color: "#9933FF", opacity: 1 }
  ]
})

Example - Radial Gradient (Center glow):
add_gradient_fill({
  nodeId: "frame-456",
  type: "RADIAL",
  stops: [
    { position: 0, color: "#FFFFFF", opacity: 1 },   // Center
    { position: 1, color: "#0066FF", opacity: 0.5 }  // Edge
  ]
})

CSS Equivalent (Linear):
background: linear-gradient(45deg, #0066FF 0%, #9933FF 100%);

CSS Equivalent (Radial):
background: radial-gradient(circle, #FFFFFF 0%, #0066FF 100%);`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node to apply gradient to'
      },
      type: {
        type: 'string' as const,
        enum: ['LINEAR', 'RADIAL'],
        description: 'Gradient type: LINEAR or RADIAL'
      },
      stops: {
        type: 'array' as const,
        description: 'Color stops (minimum 2)',
        items: {
          type: 'object' as const,
          properties: {
            position: {
              type: 'number' as const,
              description: 'Position 0-1',
              minimum: 0,
              maximum: 1
            },
            color: {
              type: 'string' as const,
              description: 'Color in hex (e.g., #FF0000)'
            },
            opacity: {
              type: 'number' as const,
              description: 'Opacity 0-1 (default: 1)',
              minimum: 0,
              maximum: 1,
              default: 1
            }
          },
          required: ['position', 'color']
        },
        minItems: 2
      },
      angle: {
        type: 'number' as const,
        description: 'Angle in degrees for LINEAR (0=→, 90=↑, 180=←, 270=↓)',
        default: 0
      },
      opacity: {
        type: 'number' as const,
        description: 'Overall opacity 0-1 (default: 1)',
        minimum: 0,
        maximum: 1,
        default: 1
      }
    },
    required: ['nodeId', 'type', 'stops']
  }
};

/**
 * Result type
 */
export interface AddGradientFillResult {
  nodeId: string;
  type: string;
  stopCount: number;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 */
export async function addGradientFill(
  input: AddGradientFillInput
): Promise<AddGradientFillResult> {
  // Validate input
  const validated = AddGradientFillInputSchema.parse(input);

  // Ensure at least 2 stops
  if (validated.stops.length < 2) {
    throw new Error('Gradient must have at least 2 color stops');
  }

  // Get Figma bridge
  const bridge = getFigmaBridge();

  if (!bridge.isConnected()) {
    throw new Error('Not connected to Figma. Ensure the plugin is running.');
  }

  // Send command to Figma
  const response = await bridge.sendToFigma<{ success: boolean; error?: string }>('add_gradient_fill', {
    nodeId: validated.nodeId,
    type: validated.type,
    stops: validated.stops,
    angle: validated.angle,
    opacity: validated.opacity
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to add gradient fill');
  }

  // Build CSS equivalent
  let cssEquivalent = '';

  if (validated.type === 'LINEAR') {
    const stopsCSS = validated.stops
      .map(stop => `${stop.color} ${Math.round(stop.position * 100)}%`)
      .join(', ');

    cssEquivalent = `background: linear-gradient(${validated.angle}deg, ${stopsCSS});`;
  } else {
    // RADIAL
    const stopsCSS = validated.stops
      .map(stop => `${stop.color} ${Math.round(stop.position * 100)}%`)
      .join(', ');

    cssEquivalent = `background: radial-gradient(circle, ${stopsCSS});`;
  }

  if (validated.opacity < 1) {
    cssEquivalent += `\nopacity: ${validated.opacity};`;
  }

  return {
    nodeId: validated.nodeId,
    type: validated.type,
    stopCount: validated.stops.length,
    cssEquivalent,
    message: `Applied ${validated.type.toLowerCase()} gradient with ${validated.stops.length} stops`
  };
}
