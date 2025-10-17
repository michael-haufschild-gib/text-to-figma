/**
 * MCP Tool: set_current_page
 *
 * Sets the current active page in Figma.
 *
 * PRIMITIVE: Raw Figma page navigation primitive.
 * In Figma: figma.currentPage = page
 * Use for: navigating between pages, focusing on specific flows
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const SetCurrentPageInputSchema = z.object({
  pageId: z.string().min(1).describe('ID of the page to switch to')
});

export type SetCurrentPageInput = z.infer<typeof SetCurrentPageInputSchema>;

/**
 * Tool definition
 */
export const setCurrentPageToolDefinition = {
  name: 'set_current_page',
  description: `Sets the current active page in Figma.

PRIMITIVE: Raw Figma page navigation primitive - not a pre-made component.
Use for: switching between pages, focusing on specific flows, page navigation.

Example - Switch to Page:
set_current_page({
  pageId: "page-123"
})

Use Cases:
- Navigate to specific user flow
- Switch between component libraries
- Focus on mockup page
- Programmatic page navigation
- Multi-page workflows

Note: All subsequent create operations will use the current page.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      pageId: {
        type: 'string' as const,
        description: 'ID of the page to switch to'
      }
    },
    required: ['pageId']
  }
};

/**
 * Result type
 */
export interface SetCurrentPageResult {
  pageId: string;
  pageName?: string;
  message: string;
}

/**
 * Implementation
 */
export async function setCurrentPage(
  input: SetCurrentPageInput
): Promise<SetCurrentPageResult> {
  // Validate input
  const validated = SetCurrentPageInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  if (!bridge.isConnected()) {
    throw new Error('Not connected to Figma. Ensure the plugin is running.');
  }

  // Send command to Figma
  const response = await bridge.sendToFigma<{
    success: boolean;
    pageName?: string;
    error?: string;
  }>('set_current_page', {
    pageId: validated.pageId
  });

  if (!response.success) {
    throw new Error(response.error || 'Failed to set current page');
  }

  return {
    pageId: validated.pageId,
    pageName: response.pageName,
    message: response.pageName
      ? `Switched to page "${response.pageName}"`
      : 'Page switched successfully'
  };
}
