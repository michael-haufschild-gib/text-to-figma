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
  description: `Switches to a different page in the Figma document.

WHEN TO USE:
- Before creating content on a different page
- Navigating between design flows (login, dashboard, settings)
- Switching to a component library page
- Focusing Figma viewport on a specific page

IMPORTANT:
All create_* operations work on the CURRENT page. You MUST switch pages
before creating content if you want it on a different page.

COMMON PATTERNS:

1. Navigate to a page by name (use with list_pages):
   pages = list_pages({})
   target = pages.pages.find(p => p.name === "Mobile Screens")
   set_current_page({ pageId: target.pageId })
   // Now create content on Mobile Screens page

2. Create content on multiple pages:
   // Page 1: Desktop
   set_current_page({ pageId: desktopPageId })
   create_design({ spec: desktopLayout })

   // Page 2: Mobile
   set_current_page({ pageId: mobilePageId })
   create_design({ spec: mobileLayout })

3. Return to original page after work:
   original = (await list_pages({})).pages.find(p => p.isCurrent)
   // ... do work on other pages ...
   set_current_page({ pageId: original.pageId })

NOTE: The Figma UI will visually switch to the target page,
which is helpful for the user to see your progress.

🔗 RELATED TOOLS:
- list_pages: Find page IDs to navigate to
- create_page: Create a new page first
- get_page_hierarchy: See what's on the current page`,
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
 * Response schema for Figma bridge set_current_page response
 */
const SetCurrentPageResponseSchema = z
  .object({
    pageName: z.string().optional()
  })
  .passthrough();

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
 * @param input
 */
export async function setCurrentPage(input: SetCurrentPageInput): Promise<SetCurrentPageResult> {
  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  const response = await bridge.sendToFigmaValidated(
    'set_current_page',
    { pageId: input.pageId },
    SetCurrentPageResponseSchema
  );

  return {
    pageId: input.pageId,
    pageName: response.pageName,
    message: response.pageName
      ? `Switched to page "${response.pageName}"`
      : 'Page switched successfully'
  };
}
