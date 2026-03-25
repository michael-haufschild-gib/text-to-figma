/**
 * MCP Tool: create_page
 *
 * Creates a new page in the Figma document.
 *
 * PRIMITIVE: Raw Figma page primitive.
 * In Figma: figma.createPage()
 * Use for: organizing designs, separating flows, multi-page documents
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { defineHandler, textResponse } from '../routing/handler-utils.js';

/**
 * Input schema
 */
export const CreatePageInputSchema = z.object({
  name: z.string().min(1).describe('Name for the new page')
});

export type CreatePageInput = z.infer<typeof CreatePageInputSchema>;

/**
 * Tool definition
 */
export const createPageToolDefinition = {
  name: 'create_page',
  description: `Creates a new page in the Figma document.

PRIMITIVE: Raw Figma page primitive - not a pre-made component.
Use for: organizing designs, separating user flows, multi-page documents.

Example - Create Flow Page:
create_page({
  name: "User Onboarding Flow"
})

Example - Create Component Library Page:
create_page({
  name: "Design System - Components"
})

Example - Create Mockup Page:
create_page({
  name: "Mobile Mockups"
})

Use Cases:
- Separate user flows (onboarding, checkout, etc.)
- Organize component libraries
- Create design iterations
- Structure complex projects
- Separate pages for different screen sizes

Note: The new page becomes the current page after creation.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string' as const,
        description: 'Name for the new page'
      }
    },
    required: ['name']
  }
};

/**
 * Response schema for Figma bridge create_page response
 */
const CreatePageResponseSchema = z
  .object({
    pageId: z.string(),
    name: z.string().optional(),
    message: z.string().optional()
  })
  .passthrough();

/**
 * Result type
 */
export interface CreatePageResult {
  success: true;
  pageId: string;
  name: string;
  message: string;
  timestamp: string;
}

/**
 * Implementation
 * @param input
 */
export async function createPage(input: CreatePageInput): Promise<CreatePageResult> {
  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  const response = await bridge.sendToFigmaValidated(
    'create_page',
    { name: input.name },
    CreatePageResponseSchema
  );

  return {
    success: true as const,
    pageId: response.pageId,
    name: input.name,
    message: `Page "${input.name}" created successfully`,
    timestamp: new Date().toISOString()
  };
}

export const handler = defineHandler<CreatePageInput, CreatePageResult>({
  name: 'create_page',
  schema: CreatePageInputSchema,
  execute: createPage,
  formatResponse: (r) => textResponse(`${r.message}\nPage ID: ${r.pageId}\nName: ${r.name}\n`),
  definition: createPageToolDefinition
});
