/**
 * MCP Tool: set_transform
 *
 * Consolidated transform tool - sets position, size, rotation, scale, and flip.
 * Replaces: set_absolute_position, set_size, set_rotation, set_scale, flip_node
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema - all parameters optional, only update what's provided
 */
export const SetTransformInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node to transform'),
  position: z
    .object({
      x: z.number().describe('X coordinate in pixels'),
      y: z.number().describe('Y coordinate in pixels')
    })
    .optional()
    .describe('Absolute position'),
  size: z
    .object({
      width: z.number().positive().describe('Width in pixels'),
      height: z.number().positive().describe('Height in pixels')
    })
    .optional()
    .describe('Node dimensions'),
  rotation: z.number().optional().describe('Rotation angle in degrees (positive = clockwise)'),
  scale: z
    .object({
      x: z.number().describe('Horizontal scale factor (1.0 = 100%, 2.0 = 200%)'),
      y: z.number().describe('Vertical scale factor (1.0 = 100%, 2.0 = 200%)')
    })
    .optional()
    .describe('Scale transformation'),
  flip: z.enum(['HORIZONTAL', 'VERTICAL', 'BOTH']).optional().describe('Flip/mirror direction')
});

export type SetTransformInput = z.infer<typeof SetTransformInputSchema>;

/**
 * Tool definition
 */
export const setTransformToolDefinition = {
  name: 'set_transform',
  description: `Sets transform properties on a node (position, size, rotation, scale, flip).

🎯 WHEN TO USE THIS TOOL:
- Transforming an EXISTING node
- Positioning, resizing, rotating, or scaling elements
- Adjusting layout of already-created nodes

⚠️ DON'T use this for:
- New node creation (set properties in create_* tools)
- Multi-element designs (use create_design)

CONSOLIDATED TOOL: Replaces set_absolute_position, set_size, set_rotation, set_scale, flip_node

All parameters are optional - only specify what you want to change:

Position (absolute coordinates):
- x, y: Position in pixels (0,0 = top-left of canvas)
- CSS: position: absolute; left: Xpx; top: Ypx;

Size (dimensions):
- width, height: Dimensions in pixels
- CSS: width: Wpx; height: Hpx;

Rotation:
- degrees: Rotation angle (0° = no rotation, 90° = quarter turn clockwise, -45° = counter-clockwise)
- CSS: transform: rotate(45deg);

Scale:
- x, y: Scale factors (1.0 = 100%, 2.0 = 200%, 0.5 = 50%)
- CSS: transform: scale(2, 1.5);

Flip:
- HORIZONTAL: Mirror left-to-right
- VERTICAL: Mirror top-to-bottom
- BOTH: Mirror both axes (180° rotation equivalent)
- CSS: transform: scaleX(-1); or scaleY(-1);

Examples:

Reposition node:
{
  nodeId: "element-123",
  position: { x: 100, y: 200 }
}

Resize and rotate:
{
  nodeId: "icon-456",
  size: { width: 48, height: 48 },
  rotation: 45
}

Scale and flip:
{
  nodeId: "arrow-789",
  scale: { x: 2, y: 2 },
  flip: "HORIZONTAL"
}

Complete transformation:
{
  nodeId: "card-012",
  position: { x: 50, y: 100 },
  size: { width: 300, height: 400 },
  rotation: 15,
  scale: { x: 1.2, y: 1.2 }
}`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node to transform'
      },
      position: {
        type: 'object' as const,
        properties: {
          x: { type: 'number' as const, description: 'X coordinate in pixels' },
          y: { type: 'number' as const, description: 'Y coordinate in pixels' }
        },
        description: 'Absolute position (optional)'
      },
      size: {
        type: 'object' as const,
        properties: {
          width: { type: 'number' as const, description: 'Width in pixels' },
          height: { type: 'number' as const, description: 'Height in pixels' }
        },
        description: 'Node dimensions (optional)'
      },
      rotation: {
        type: 'number' as const,
        description: 'Rotation angle in degrees (optional)'
      },
      scale: {
        type: 'object' as const,
        properties: {
          x: { type: 'number' as const, description: 'Horizontal scale factor' },
          y: { type: 'number' as const, description: 'Vertical scale factor' }
        },
        description: 'Scale transformation (optional)'
      },
      flip: {
        type: 'string' as const,
        enum: ['HORIZONTAL', 'VERTICAL', 'BOTH'],
        description: 'Flip/mirror direction (optional)'
      }
    },
    required: ['nodeId']
  }
};

/**
 * Result type
 */
export interface SetTransformResult {
  nodeId: string;
  applied: string[];
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function setTransform(input: SetTransformInput): Promise<SetTransformResult> {
  // Validate input
  const validated = input;

  // Track what transformations were applied
  const applied: string[] = [];
  const cssLines: string[] = [];

  // Build command payload for Figma
  const payload: Record<string, unknown> = { nodeId: validated.nodeId };

  if (validated.position) {
    payload.position = validated.position;
    applied.push('position');
    cssLines.push(`position: absolute;`);
    cssLines.push(`left: ${validated.position.x}px;`);
    cssLines.push(`top: ${validated.position.y}px;`);
  }

  if (validated.size) {
    payload.size = validated.size;
    applied.push('size');
    cssLines.push(`width: ${validated.size.width}px;`);
    cssLines.push(`height: ${validated.size.height}px;`);
  }

  if (validated.rotation !== undefined) {
    payload.rotation = validated.rotation;
    applied.push('rotation');
    cssLines.push(`transform: rotate(${validated.rotation}deg);`);
  }

  if (validated.scale) {
    payload.scale = validated.scale;
    applied.push('scale');
    cssLines.push(`transform: scale(${validated.scale.x}, ${validated.scale.y});`);
  }

  if (validated.flip) {
    payload.flip = validated.flip;
    applied.push('flip');
    const flipTransform =
      validated.flip === 'HORIZONTAL'
        ? 'scaleX(-1)'
        : validated.flip === 'VERTICAL'
          ? 'scaleY(-1)'
          : 'scale(-1, -1)';
    cssLines.push(`transform: ${flipTransform};`);
  }

  if (applied.length === 0) {
    throw new Error(
      'No transformations specified. Provide at least one of: position, size, rotation, scale, flip'
    );
  }

  // Send to Figma
  const bridge = getFigmaBridge();
  await bridge.sendToFigmaWithRetry('set_transform', payload);

  return {
    nodeId: validated.nodeId,
    applied,
    cssEquivalent: cssLines.join('\n'),
    message: `Applied transformations: ${applied.join(', ')}`
  };
}
