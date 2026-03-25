/**
 * Set Component Properties Tool
 *
 * Modifies properties of Figma components including variants and descriptions.
 * This affects the component definition, not individual instances.
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Component variant property schema
 */
const variantPropertySchema = z.object({
  name: z.string().min(1).describe('Property name (e.g., "Size", "State", "Type")'),
  value: z.string().min(1).describe('Property value (e.g., "Small", "Large", "Active")')
});

export type VariantProperty = z.infer<typeof variantPropertySchema>;

/**
 * Input schema for set_component_properties tool
 */
export const SetComponentPropertiesInputSchema = z.object({
  componentId: z.string().min(1).describe('ID of the component to modify'),
  name: z.string().optional().describe('New name for the component'),
  description: z.string().optional().describe('New description for the component'),
  variantProperties: z.array(variantPropertySchema).optional().describe('Variant properties to set')
});

export type SetComponentPropertiesInput = z.infer<typeof SetComponentPropertiesInputSchema>;

/**
 * Result of setting component properties
 */
export interface SetComponentPropertiesResult {
  componentId: string;
  updated: string[];
  message: string;
}

/**
 * Sets properties on a component in Figma
 * @param input
 */
export async function setComponentProperties(
  input: SetComponentPropertiesInput
): Promise<SetComponentPropertiesResult> {
  // Track what was updated
  const updated: string[] = [];

  if (input.name !== undefined) {
    updated.push('name');
  }
  if (input.description !== undefined) {
    updated.push('description');
  }
  if (input.variantProperties !== undefined && input.variantProperties.length > 0) {
    updated.push(`${input.variantProperties.length} variant properties`);
  }

  // Send to Figma
  const bridge = getFigmaBridge();
  await bridge.sendToFigmaWithRetry('set_component_properties', {
    componentId: input.componentId,
    name: input.name,
    description: input.description,
    variantProperties: input.variantProperties
  });

  return {
    componentId: input.componentId,
    updated,
    message: `Component properties updated: ${updated.join(', ')}`
  };
}

/**
 * Tool definition for MCP
 */
export const setComponentPropertiesToolDefinition = {
  name: 'set_component_properties',
  description: `Modifies properties of a Figma component.

Updates affect the component definition itself, not individual instances.
Changes to component properties will propagate to all instances (except overridden properties).

Properties you can modify:

1. Name:
   - Changes the component name
   - Affects organization and search
   - Use "/" for hierarchy (e.g., "Button/Primary", "Button/Secondary")

2. Description:
   - Documentation for the component
   - Explains usage, purpose, and guidelines
   - Visible in Figma's component panel

3. Variant Properties:
   - Define component variants (like props in React)
   - Each property has a name and value
   - Common examples:
     * Size: Small, Medium, Large
     * State: Default, Hover, Active, Disabled
     * Type: Primary, Secondary, Tertiary
     * Theme: Light, Dark

Variant Properties enable design systems with variations:
- Instead of separate components for each button size
- Create one button component with a "Size" variant property
- Values: Small, Medium, Large

Example workflow:
1. Create a frame for a button
2. Convert to component: "Button"
3. Set variant properties: { name: "Size", value: "Medium" }, { name: "State", value: "Default" }
4. Create additional variants by duplicating and changing property values

This creates a component set where instances can switch between variants.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      componentId: {
        type: 'string' as const,
        description: 'ID of the component to modify'
      },
      name: {
        type: 'string' as const,
        description: 'New name for the component (use "/" for hierarchy, e.g., "Button/Primary")'
      },
      description: {
        type: 'string' as const,
        description: "New description explaining the component's purpose and usage guidelines"
      },
      variantProperties: {
        type: 'array' as const,
        description: 'Array of variant properties to define component variations',
        items: {
          type: 'object' as const,
          properties: {
            name: {
              type: 'string' as const,
              description: 'Property name (e.g., "Size", "State", "Type")'
            },
            value: {
              type: 'string' as const,
              description: 'Property value (e.g., "Small", "Large", "Active")'
            }
          },
          required: ['name', 'value']
        }
      }
    },
    required: ['componentId']
  }
};
