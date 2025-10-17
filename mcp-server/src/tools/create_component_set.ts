/**
 * MCP Tool: create_component_set
 *
 * Creates a component set (variant group) from multiple components.
 *
 * PRIMITIVE: Raw Figma component set primitive.
 * In Figma: figma.combineAsVariants([component1, component2, ...])
 * Use for: button states, size variants, theme variants
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const CreateComponentSetInputSchema = z.object({
  componentIds: z.array(z.string().min(1)).min(2).describe('Array of component IDs to combine as variants (minimum 2)'),
  name: z.string().min(1).describe('Name for the component set'),
  description: z.string().optional().describe('Optional description')
});

export type CreateComponentSetInput = z.infer<typeof CreateComponentSetInputSchema>;

/**
 * Tool definition
 */
export const createComponentSetToolDefinition = {
  name: 'create_component_set',
  description: `Creates a component set (variant group) from multiple components.

PRIMITIVE: Raw Figma component set primitive - not a pre-made component.
Use for: organizing component variants (states, sizes, themes).

Component Sets Enable:
- Multiple variants of same component (e.g., Button: Default, Hover, Pressed)
- Property-based switching (e.g., Size: Small/Medium/Large, Theme: Light/Dark)
- Organized component libraries
- Instance swapping

Naming Convention:
After creating set, use add_variant_property to define properties like:
- State: Default, Hover, Pressed, Disabled
- Size: Small, Medium, Large
- Theme: Light, Dark
- Type: Primary, Secondary, Tertiary

Example - Button Variants:
// First create individual button components
// Then combine them:
create_component_set({
  componentIds: ["button-default-123", "button-hover-456", "button-pressed-789"],
  name: "Button",
  description: "Button component with multiple states"
})

Example - Card Variants:
create_component_set({
  componentIds: ["card-small-123", "card-medium-456", "card-large-789"],
  name: "Card",
  description: "Card component with size variants"
})

After creating, use add_variant_property to define variant properties.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      componentIds: {
        type: 'array' as const,
        items: { type: 'string' as const },
        description: 'Array of component IDs to combine (minimum 2)'
      },
      name: {
        type: 'string' as const,
        description: 'Name for the component set'
      },
      description: {
        type: 'string' as const,
        description: 'Optional description'
      }
    },
    required: ['componentIds', 'name']
  }
};

/**
 * Result type
 */
export interface CreateComponentSetResult {
  componentSetId: string;
  name: string;
  variantCount: number;
  message: string;
}

/**
 * Implementation
 */
export async function createComponentSet(
  input: CreateComponentSetInput
): Promise<CreateComponentSetResult> {
  // Validate input
  const validated = CreateComponentSetInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  if (!bridge.isConnected()) {
    throw new Error('Not connected to Figma. Ensure the plugin is running.');
  }

  // Send command to Figma
  const response = await bridge.sendToFigma<{ success: boolean; componentSetId?: string; error?: string }>('create_component_set', {
    componentIds: validated.componentIds,
    name: validated.name,
    description: validated.description
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to create component set');
  }

  return {
    componentSetId: response.componentSetId || '',
    name: validated.name,
    variantCount: validated.componentIds.length,
    message: `Created component set "${validated.name}" with ${validated.componentIds.length} variants`
  };
}
