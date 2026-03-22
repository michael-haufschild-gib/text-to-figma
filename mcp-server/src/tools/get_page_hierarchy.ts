/**
 * Get Page Hierarchy Tool
 *
 * Returns the complete Figma page node tree structure.
 * Allows Claude to understand the current hierarchy at any time,
 * even across context window resets.
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { getLogger } from '../monitoring/logger.js';
import { getNodeRegistry, type HierarchyNode } from '../node-registry.js';

const logger = getLogger().child({ component: 'get-page-hierarchy' });

/**
 * Input schema for get_page_hierarchy tool
 */
export const GetPageHierarchyInputSchema = z.object({
  refresh: z
    .boolean()
    .optional()
    .default(false)
    .describe('Force refresh from Figma instead of using cached registry')
});

export type GetPageHierarchyInput = z.infer<typeof GetPageHierarchyInputSchema>;

/**
 * Result of getting page hierarchy
 */
export interface GetPageHierarchyResult {
  hierarchy: HierarchyNode[];
  stats: {
    totalNodes: number;
    rootNodes: number;
    nodesByType: Record<string, number>;
  };
  source: 'cache' | 'figma';
}

/**
 * Response schema for Figma bridge get_page_hierarchy response.
 * Uses z.lazy() for recursive HierarchyNode children.
 */
const hierarchyNodeSchema: z.ZodType<HierarchyNode> = z.lazy(() =>
  z
    .object({
      nodeId: z.string(),
      type: z.string(),
      name: z.string(),
      bounds: z
        .object({
          x: z.number(),
          y: z.number(),
          width: z.number(),
          height: z.number()
        })
        .passthrough()
        .optional(),
      children: z.array(hierarchyNodeSchema)
    })
    .passthrough()
);

const GetPageHierarchyResponseSchema = z
  .object({
    hierarchy: z.array(hierarchyNodeSchema),
    pageId: z.string(),
    pageName: z.string()
  })
  .passthrough();

/**
 * Gets the complete Figma page hierarchy
 *
 * Returns a nested tree structure of all nodes on the current Figma page.
 * This allows Claude to maintain awareness of the node structure across
 * context windows and make informed decisions about where to place new nodes.
 *
 * @param input - Configuration options
 * @param input.refresh - If true, queries Figma directly and rebuilds cache. If false, uses cached registry (faster)
 * @returns Promise resolving to hierarchy tree with statistics
 *
 * @example
 * Get cached hierarchy (fast):
 * ```typescript
 * const result = await getPageHierarchy({ refresh: false });
 * console.log(`Page has ${result.stats.totalNodes} nodes`);
 * console.log('Root nodes:', result.hierarchy.map(n => n.name));
 * ```
 *
 * @example
 * Force refresh from Figma (slower but guaranteed up-to-date):
 * ```typescript
 * const result = await getPageHierarchy({ refresh: true });
 * // Registry is now synced with Figma
 * ```
 *
 * @remarks
 * - Use cached hierarchy (refresh=false) most of the time for speed
 * - Use refresh=true if you suspect the registry is out of sync
 * - Each node includes: nodeId, type, name, bounds, children
 * - Tree structure mirrors Figma's actual parent-child relationships
 */
export async function getPageHierarchy(
  input: GetPageHierarchyInput
): Promise<GetPageHierarchyResult> {
  const validated = input;
  const registry = getNodeRegistry();

  // If refresh requested, query Figma and rebuild registry
  if (validated.refresh === true) {
    logger.info('Refreshing hierarchy from Figma...');

    const bridge = getFigmaBridge();
    const response = await bridge.sendToFigmaValidated(
      'get_page_hierarchy',
      {},
      GetPageHierarchyResponseSchema
    );

    // Clear and rebuild registry
    registry.clear();
    registerHierarchy(response.hierarchy, null);

    return {
      hierarchy: response.hierarchy,
      stats: registry.getStats(),
      source: 'figma'
    };
  }

  // Use cached registry
  return {
    hierarchy: registry.getHierarchy(),
    stats: registry.getStats(),
    source: 'cache'
  };
}

/**
 * Recursively register hierarchy nodes
 * @param nodes
 * @param parentId
 */
function registerHierarchy(nodes: HierarchyNode[], parentId: string | null): void {
  const registry = getNodeRegistry();

  for (const node of nodes) {
    registry.register(node.nodeId, {
      type: node.type,
      name: node.name,
      parentId,
      children: node.children.map((c) => c.nodeId),
      bounds: node.bounds
    });

    // Recursively register children
    if (node.children.length > 0) {
      registerHierarchy(node.children, node.nodeId);
    }
  }
}

/**
 * Tool definition for MCP
 */
export const getPageHierarchyToolDefinition = {
  name: 'get_page_hierarchy',
  description: `Returns the complete Figma page node tree structure.

This tool provides context-persistent awareness of the node hierarchy,
allowing you to understand the current page structure at any time,
even across context window resets.

**When to Use:**
- Before creating new nodes to find appropriate parents
- After context window reset/compaction to rebuild understanding
- To verify the current structure before modifications
- To find specific nodes by traversing the tree

**Hierarchy Structure:**
Each node includes:
- nodeId: Unique identifier for the node
- type: Node type (FRAME, TEXT, ELLIPSE, etc.)
- name: Node name as shown in Figma
- bounds: Position and dimensions {x, y, width, height}
- children: Array of child nodes (nested tree)

**Performance:**
- refresh=false (default): Fast, uses cached registry
- refresh=true: Slower, queries Figma directly and rebuilds cache

**Best Practices:**
1. Use cached hierarchy most of the time for speed
2. Use refresh=true:
   - After context window reset
   - If you suspect cache is out of sync
   - At the start of a new design task
3. Always specify parentId when creating nodes (use hierarchy to find parent)

**Example Usage:**
\`\`\`typescript
// Get current hierarchy
const { hierarchy, stats } = await getPageHierarchy({ refresh: false });

// Find a frame to use as parent
const containerFrame = hierarchy.find(n => n.name === "Main Container");

// Create child element with proper parent
await createFrame({
  name: "Card",
  parentId: containerFrame.nodeId,
  width: 300,
  height: 200
});
\`\`\`

**Context Persistence:**
The registry maintains awareness across:
- Multiple tool calls
- Context window compaction
- Session interruptions (requires refresh=true to restore)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      refresh: {
        type: 'boolean' as const,
        description:
          'Force refresh from Figma (slower but guaranteed up-to-date). Default: false (use cache)',
        default: false
      }
    }
  }
};
