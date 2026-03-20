/**
 * Create Component Tool
 *
 * Creates Figma components from frames, enabling reusability and consistency.
 * Components in Figma are similar to reusable UI components in frameworks like React.
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema for create_component tool
 */
export const CreateComponentInputSchema = z.object({
  frameId: z.string().min(1).describe('ID of the frame to convert to a component'),
  name: z.string().min(1).describe('Name of the component'),
  description: z.string().optional().describe('Optional description for the component')
});

export type CreateComponentInput = z.infer<typeof CreateComponentInputSchema>;

/**
 * Result of creating a component
 */
export interface CreateComponentResult {
  componentId: string;
  name: string;
  description?: string;
  message: string;
}

/**
 * Creates a component from a frame in Figma
 * @param input
 */
export async function createComponent(input: CreateComponentInput): Promise<CreateComponentResult> {
  // Validate input
  const validated = input;

  // Send to Figma
  const bridge = getFigmaBridge();
  const response = await bridge.sendToFigmaWithRetry<{ componentId: string }>('create_component', {
    frameId: validated.frameId,
    name: validated.name,
    description: validated.description
  });

  return {
    componentId: response.componentId,
    name: validated.name,
    description: validated.description,
    message: `Component "${validated.name}" created successfully. Use this component ID to create instances.`
  };
}

/**
 * Tool definition for MCP
 */
export const createComponentToolDefinition = {
  name: 'create_component',
  description: `Creates a Figma component from an existing frame.

Components in Figma are reusable design elements, similar to:
- React components in web development
- Partials/includes in templating systems
- Master pages in design tools

Benefits of Components:
- Reusability: Create once, use many times
- Consistency: Changes to the component update all instances
- Auto-layout preservation: Layout properties are maintained
- Organization: Components can be organized in component libraries

After creating a component, you can:
1. Create instances using create_instance tool
2. Override instance properties (text, colors, etc.)
3. Update the component to affect all instances

Example workflow:
1. Create a frame with auto-layout (button design)
2. Convert frame to component (reusable button)
3. Create instances of the component (multiple buttons)
4. Override text/colors on each instance`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      frameId: {
        type: 'string' as const,
        description: 'ID of the frame to convert to a component'
      },
      name: {
        type: 'string' as const,
        description: 'Name of the component (e.g., "Button/Primary", "Card/Default")'
      },
      description: {
        type: 'string' as const,
        description: "Optional description explaining the component's purpose and usage"
      }
    },
    required: ['frameId', 'name']
  }
};
