/**
 * Create Instance Tool
 *
 * Creates instances of Figma components with optional property overrides.
 * Instances maintain a connection to their main component while allowing
 * local customization.
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Property override schema for text content
 */
const textOverrideSchema = z.object({
  type: z.literal('text'),
  nodeId: z.string().describe('ID of the text node to override'),
  value: z.string().describe('New text content')
});

/**
 * Property override schema for fill color
 */
const fillOverrideSchema = z.object({
  type: z.literal('fill'),
  nodeId: z.string().describe('ID of the node to change fill'),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .describe('New color in hex format')
});

/**
 * Union type for all override types
 */
const propertyOverrideSchema = z.discriminatedUnion('type', [
  textOverrideSchema,
  fillOverrideSchema
]);

export type PropertyOverride = z.infer<typeof propertyOverrideSchema>;

/**
 * Input schema for create_instance tool
 */
export const CreateInstanceInputSchema = z.object({
  componentId: z.string().min(1).describe('ID of the component to instantiate'),
  name: z.string().optional().describe('Optional name for the instance'),
  x: z.number().optional().describe('X position in pixels (optional)'),
  y: z.number().optional().describe('Y position in pixels (optional)'),
  parentId: z.string().optional().describe('Optional parent frame ID to nest instance inside'),
  overrides: z.array(propertyOverrideSchema).optional().describe('Optional property overrides')
});

export type CreateInstanceInput = z.infer<typeof CreateInstanceInputSchema>;

/**
 * Result of creating an instance
 */
export interface CreateInstanceResult {
  instanceId: string;
  componentId: string;
  overridesApplied: number;
  message: string;
}

/**
 * Creates an instance of a component in Figma
 * @param input
 */
export async function createInstance(input: CreateInstanceInput): Promise<CreateInstanceResult> {
  // Send to Figma
  const bridge = getFigmaBridge();
  const response = await bridge.sendToFigmaValidated(
    'create_instance',
    {
      componentId: input.componentId,
      name: input.name,
      x: input.x,
      y: input.y,
      parentId: input.parentId,
      overrides: input.overrides
    },
    z.object({ instanceId: z.string() })
  );

  const overridesCount = input.overrides?.length ?? 0;

  return {
    instanceId: response.instanceId,
    componentId: input.componentId,
    overridesApplied: overridesCount,
    message: `Instance created successfully${overridesCount > 0 ? ` with ${overridesCount} override(s)` : ''}.`
  };
}

/**
 * Tool definition for MCP
 */
export const createInstanceToolDefinition = {
  name: 'create_instance',
  description: `Creates an instance of a Figma component with optional property overrides.

Instances are copies of components that:
- Maintain connection to the main component
- Inherit updates when the component changes
- Allow local property overrides (text, colors, visibility)
- Cannot change structure or layout (only properties)

This is similar to:
- Creating instances of React components with different props
- Using template instances with variable content
- Object-oriented instantiation with property overrides

Property Overrides:
You can override specific properties on the instance without affecting the component:

1. Text Overrides:
   { type: 'text', nodeId: 'text-node-id', value: 'New text' }
   - Changes text content on a specific text node

2. Fill Overrides:
   { type: 'fill', nodeId: 'node-id', color: '#FF0000' }
   - Changes fill color on a specific node

To find node IDs for overrides:
- Create the component first
- Inspect the component structure in Figma
- Use node IDs from child elements

Example: Creating button instances with different text
1. Create component: "Button/Primary"
2. Create instance with text override: { type: 'text', nodeId: 'label-id', value: 'Submit' }
3. Create another instance: { type: 'text', nodeId: 'label-id', value: 'Cancel' }`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      componentId: {
        type: 'string' as const,
        description: 'ID of the component to create an instance of'
      },
      name: {
        type: 'string' as const,
        description: 'Optional name for the instance (useful for organization)'
      },
      x: {
        type: 'number' as const,
        description: 'X position in pixels (default: 0)'
      },
      y: {
        type: 'number' as const,
        description: 'Y position in pixels (default: 0)'
      },
      parentId: {
        type: 'string' as const,
        description: 'Optional parent frame ID to nest the instance inside'
      },
      overrides: {
        type: 'array' as const,
        description: 'Array of property overrides to apply to the instance',
        items: {
          type: 'object' as const,
          properties: {
            type: {
              type: 'string' as const,
              enum: ['text', 'fill'],
              description: 'Type of override: "text" for text content, "fill" for colors'
            },
            nodeId: {
              type: 'string' as const,
              description: 'ID of the node within the instance to override'
            },
            value: {
              type: 'string' as const,
              description: 'New value (text content for type="text", not used for type="fill")'
            },
            color: {
              type: 'string' as const,
              description: 'New color in hex format (only for type="fill")'
            }
          }
        }
      }
    },
    required: ['componentId']
  }
};
