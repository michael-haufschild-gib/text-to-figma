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
  description: `Lists all pages in the Figma document.

PRIMITIVE: Raw Figma page listing primitive - not a pre-made component.
Use for: discovering pages, understanding document structure, page navigation.

Example - List All Pages:
list_pages({})

Returns:
- Page IDs
- Page names
- Current page indicator

Use Cases:
- Discover available pages
- Navigate multi-page documents
- Understand project structure
- Find specific pages by name
- Audit document organization`,
  inputSchema: {
    type: 'object' as const,
    properties: {}
  }
};

/**
 * Result type
 */
export interface ListPagesResult {
  pageCount: number;
  pages: PageInfo[];
  currentPageId?: string;
  message: string;
}

/**
 * Implementation
 */
export async function listPages(
  input: ListPagesInput
): Promise<ListPagesResult> {
  // Validate input
  ListPagesInputSchema.parse(input);

  // Get Figma bridge
  const bridge = getFigmaBridge();

  if (!bridge.isConnected()) {
    throw new Error('Not connected to Figma. Ensure the plugin is running.');
  }

  // Send command to Figma
  const response = await bridge.sendToFigma<{
    success: boolean;
    pages?: PageInfo[];
    currentPageId?: string;
    error?: string;
  }>('list_pages', {});

  if (!response.success || !response.pages) {
    throw new Error(response.error || 'Failed to list pages');
  }

  return {
    pageCount: response.pages.length,
    pages: response.pages,
    currentPageId: response.currentPageId,
    message: `Found ${response.pages.length} page(s)`
  };
}
