/**
 * MCP Tool: create_boolean_operation
 *
 * Creates boolean operations (union, subtract, intersect, exclude) from multiple shapes.
 *
 * PRIMITIVE: Raw Figma boolean operation primitive.
 * In Figma: figma.union(), figma.subtract(), figma.intersect(), figma.exclude()
 * Use for: complex icons, custom shapes, logo design
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const CreateBooleanOperationInputSchema = z.object({
  nodeIds: z.array(z.string().min(1)).min(2).describe('Array of node IDs to combine (minimum 2)'),
  operation: z
    .enum(['UNION', 'SUBTRACT', 'INTERSECT', 'EXCLUDE'])
    .describe('Boolean operation type'),
  name: z
    .string()
    .optional()
    .default('Boolean Group')
    .describe('Name for the resulting boolean node')
});

export type CreateBooleanOperationInput = z.infer<typeof CreateBooleanOperationInputSchema>;

/**
 * Tool definition
 */
export const createBooleanOperationToolDefinition = {
  name: 'create_boolean_operation',
  description: `Creates boolean operations from multiple shapes to create complex forms.

PRIMITIVE: Raw Figma boolean operation primitive - not a pre-made component.
Use for: complex icons, custom shapes, logo design, icon composition.

Boolean Operations:
- UNION: Combine all shapes into one (A + B)
  * Use for: merging overlapping shapes, compound icons
- SUBTRACT: Cut out shapes from the first shape (A - B)
  * Use for: holes, cutouts, donut shapes, knockouts
- INTERSECT: Keep only overlapping areas (A ∩ B)
  * Use for: complex masks, shape intersections
- EXCLUDE: Remove overlapping areas, keep non-overlapping (A ⊕ B)
  * Use for: inverse intersections, complex cutouts

Example - Union (Merge Circles):
create_boolean_operation({
  nodeIds: ["circle-1", "circle-2"],
  operation: "UNION",
  name: "Merged Shape"
})

Example - Subtract (Create Donut):
create_boolean_operation({
  nodeIds: ["outer-circle", "inner-circle"],
  operation: "SUBTRACT",
  name: "Donut"
})

Example - Intersect (Lens Shape):
create_boolean_operation({
  nodeIds: ["circle-1", "circle-2"],
  operation: "INTERSECT",
  name: "Lens"
})

Example - Exclude (Compound Cutout):
create_boolean_operation({
  nodeIds: ["shape-1", "shape-2"],
  operation: "EXCLUDE",
  name: "Excluded Shape"
})

CSS Equivalent:
/* Requires SVG clip-path or mask */
clip-path: url(#boolean-shape);

Note: Order matters for SUBTRACT (first shape is the base)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeIds: {
        type: 'array' as const,
        items: { type: 'string' as const },
        description: 'Array of node IDs to combine (minimum 2)'
      },
      operation: {
        type: 'string' as const,
        enum: ['UNION', 'SUBTRACT', 'INTERSECT', 'EXCLUDE'],
        description: 'Boolean operation type'
      },
      name: {
        type: 'string' as const,
        description: 'Name for the resulting boolean node',
        default: 'Boolean Group'
      }
    },
    required: ['nodeIds', 'operation']
  }
};

/**
 * Response schema for Figma bridge create_boolean_operation response
 */
const CreateBooleanOperationResponseSchema = z
  .object({
    nodeId: z.string().optional()
  })
  .passthrough();

/**
 * Result type
 */
export interface CreateBooleanOperationResult {
  booleanNodeId: string;
  operation: 'UNION' | 'SUBTRACT' | 'INTERSECT' | 'EXCLUDE';
  nodeCount: number;
  cssEquivalent: string;
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function createBooleanOperation(
  input: CreateBooleanOperationInput
): Promise<CreateBooleanOperationResult> {
  // Validate input
  const validated = input;

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  const response = await bridge.sendToFigmaValidated(
    'create_boolean_operation',
    {
      nodeIds: validated.nodeIds,
      operation: validated.operation,
      name: validated.name
    },
    CreateBooleanOperationResponseSchema
  );

  // Build CSS equivalent and description
  const operationLabel = {
    UNION: 'Union (A + B)',
    SUBTRACT: 'Subtract (A - B)',
    INTERSECT: 'Intersect (A ∩ B)',
    EXCLUDE: 'Exclude (A ⊕ B)'
  };

  const operationDescription = {
    UNION: 'merged shapes',
    SUBTRACT: 'subtracted shapes',
    INTERSECT: 'intersected shapes',
    EXCLUDE: 'excluded overlaps'
  };

  const cssEquivalent = `/* ${operationLabel[validated.operation]} requires SVG */
.boolean-shape {
  clip-path: url(#${validated.name.toLowerCase().replace(/\s+/g, '-')});
}

<!-- SVG definition required -->
<svg>
  <clipPath id="${validated.name.toLowerCase().replace(/\s+/g, '-')}">
    <!-- Boolean operation path -->
  </clipPath>
</svg>`;

  return {
    booleanNodeId: response.nodeId ?? '',
    operation: validated.operation,
    nodeCount: validated.nodeIds.length,
    cssEquivalent,
    message: `Created ${operationDescription[validated.operation]} from ${validated.nodeIds.length} shapes using ${validated.operation}`
  };
}
