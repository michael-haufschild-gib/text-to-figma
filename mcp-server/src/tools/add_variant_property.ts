/**
 * MCP Tool: add_variant_property
 *
 * Adds a variant property to a component set.
 *
 * PRIMITIVE: Raw Figma variant property primitive.
 * In Figma: componentSet properties configuration
 * Use for: defining variant dimensions (State, Size, Theme, etc.)
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const AddVariantPropertyInputSchema = z.object({
  componentSetId: z.string().min(1).describe('ID of the component set'),
  propertyName: z
    .string()
    .min(1)
    .describe('Name of the variant property (e.g., "State", "Size", "Theme")'),
  values: z
    .array(z.string().min(1))
    .min(2)
    .describe('Array of possible values (e.g., ["Default", "Hover", "Pressed"])')
});

export type AddVariantPropertyInput = z.infer<typeof AddVariantPropertyInputSchema>;

/**
 * Tool definition
 */
export const addVariantPropertyToolDefinition = {
  name: 'add_variant_property',
  description: `Adds a variant property to a component set.

PRIMITIVE: Raw Figma variant property primitive - not a pre-made component.
Use for: defining variant dimensions that users can switch between.

Common Property Types:
- **State**: Default, Hover, Pressed, Disabled, Active, Focus
- **Size**: Small, Medium, Large, XL
- **Theme**: Light, Dark, High Contrast
- **Type**: Primary, Secondary, Tertiary, Ghost
- **Orientation**: Horizontal, Vertical
- **Variant**: A, B, C (for A/B testing)

Example - Button State Property:
add_variant_property({
  componentSetId: "button-set-123",
  propertyName: "State",
  values: ["Default", "Hover", "Pressed", "Disabled"]
})

Example - Size Property:
add_variant_property({
  componentSetId: "card-set-456",
  propertyName: "Size",
  values: ["Small", "Medium", "Large"]
})

Example - Theme Property:
add_variant_property({
  componentSetId: "navbar-set-789",
  propertyName: "Theme",
  values: ["Light", "Dark"]
})

After adding properties, instances can switch between variants.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      componentSetId: {
        type: 'string' as const,
        description: 'ID of the component set'
      },
      propertyName: {
        type: 'string' as const,
        description: 'Name of the variant property'
      },
      values: {
        type: 'array' as const,
        items: { type: 'string' as const },
        description: 'Array of possible values (minimum 2)'
      }
    },
    required: ['componentSetId', 'propertyName', 'values']
  }
};

/**
 * Result type
 */
export interface AddVariantPropertyResult {
  componentSetId: string;
  propertyName: string;
  valueCount: number;
  message: string;
}

/**
 * Implementation
 */
export async function addVariantProperty(
  input: AddVariantPropertyInput
): Promise<AddVariantPropertyResult> {
  // Validate input
  const validated = AddVariantPropertyInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  // Note: bridge.sendToFigma validates success at protocol level
  // It only resolves if Figma returns success=true, otherwise rejects
  await bridge.sendToFigma(
    'add_variant_property',
    {
      componentSetId: validated.componentSetId,
      propertyName: validated.propertyName,
      values: validated.values
    }
  )

  return {
    componentSetId: validated.componentSetId,
    propertyName: validated.propertyName,
    valueCount: validated.values.length,
    message: `Added variant property "${validated.propertyName}" with ${validated.values.length} values to component set`
  };
}
