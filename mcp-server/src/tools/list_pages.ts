/**
 * MCP Tool: list_pages
 *
 * Lists all pages in the Figma document.
 *
 * PRIMITIVE: Raw Figma page listing primitive.
 * In Figma: figma.root.children (pages)
 * Use for: navigating multi-page documents, understanding document structure
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema (no parameters needed)
 */
export const ListPagesInputSchema = z.object({});

export type ListPagesInput = z.infer<typeof ListPagesInputSchema>;

/**
 * Page info
 */
export interface PageInfo {
  pageId: string;
  name: string;
  isCurrent: boolean;
}

/**
 * Tool definition
 */
export const listPagesToolDefinition = {
  name: 'list_pages',
  description: `Lists all pages in the current Figma document.

WHEN TO USE:
- Starting work on a multi-page document (discover what exists)
- Finding a specific page to switch to
- Understanding document organization before creating content
- Verifying page creation succeeded

RETURNS (for each page):
- pageId: Use with set_current_page to navigate
- name: Page name as shown in Figma's page tabs
- isCurrent: true if this is the active page

COMMON PATTERNS:

1. Find and switch to a page:
   pages = list_pages({})
   designPage = pages.pages.find(p => p.name === "Design System")
   set_current_page({ pageId: designPage.pageId })

2. Check which page you're on:
   pages = list_pages({})
   current = pages.pages.find(p => p.isCurrent)
   console.log(\`Working on: \${current.name}\`)

3. Verify page exists before navigation:
   pages = list_pages({})
   if (pages.pages.some(p => p.name === "Mobile Screens")) {
     // Page exists, safe to navigate
   }

NOTE: Most operations work on the CURRENT page. Use set_current_page
to switch pages before creating content on a different page.

🔗 RELATED TOOLS:
- set_current_page: Navigate to a different page
- create_page: Add a new page to the document
- get_page_hierarchy: See node tree on current page`,
  inputSchema: {
    type: 'object' as const,
    properties: {}
  }
};

/**
 * Response schema for Figma bridge list_pages response
 */
const ListPagesResponseSchema = z.object({
  pages: z.array(
    z.object({
      pageId: z.string(),
      name: z.string(),
      isCurrent: z.boolean()
    })
  )
});

/**
 * Result type
 */
export interface ListPagesResult {
  success: true;
  pageCount: number;
  pages: PageInfo[];
  currentPageId?: string;
  message: string;
  timestamp: string;
}

/**
 * Implementation
 * @param input
 */
export async function listPages(_input: ListPagesInput): Promise<ListPagesResult> {
  const bridge = getFigmaBridge();

  // Send command to Figma
  const response = await bridge.sendToFigmaValidated('list_pages', {}, ListPagesResponseSchema);

  return {
    success: true as const,
    pageCount: response.pages.length,
    pages: response.pages,
    message: `Found ${response.pages.length} page(s)`,
    timestamp: new Date().toISOString()
  };
}
