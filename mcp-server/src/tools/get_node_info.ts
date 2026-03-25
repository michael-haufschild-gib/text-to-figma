/**
 * Get Node Info Tool
 *
 * Returns detailed information about a specific node by ID.
 * Useful for querying node properties without fetching the entire hierarchy.
 */

import { z } from 'zod';
import { getNodeRegistry, type NodeInfo } from '../node-registry.js';

/**
 * Input schema for get_node_info tool
 */
export const GetNodeInfoInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node to query')
});

export type GetNodeInfoInput = z.infer<typeof GetNodeInfoInputSchema>;

/**
 * Result of getting node info
 */
export interface GetNodeInfoResult {
  node: NodeInfo | null;
  parent: NodeInfo | null;
  children: NodeInfo[];
  path: string[]; // Path from root to this node
}

/**
 * Gets detailed information about a specific node
 *
 * Returns comprehensive details about a node including its parent,
 * children, and path from root. Useful for understanding context
 * around a specific node without loading the entire hierarchy.
 *
 * @param input - Query parameters
 * @param input.nodeId - The ID of the node to query
 * @returns Promise resolving to node information with context
 * @throws {Error} If the node is not found in the registry
 *
 * @example
 * Get info about a specific node:
 * ```typescript
 * const result = await getNodeInfo({ nodeId: "123:456" });
 * console.log(`Node: ${result.node.name}`);
 * console.log(`Parent: ${result.parent?.name || 'None'}`);
 * console.log(`Children: ${result.children.length}`);
 * console.log(`Path: ${result.path.join(' > ')}`);
 * ```
 *
 * @remarks
 * - Uses cached registry data (fast)
 * - If node not found, use get_page_hierarchy with refresh=true first
 * - Path shows the node's position in the hierarchy tree
 * - Children are direct descendants only (not recursive)
 */
export function getNodeInfo(input: GetNodeInfoInput): GetNodeInfoResult {
  const registry = getNodeRegistry();

  const node = registry.getNode(input.nodeId);
  if (!node) {
    throw new Error(
      `Node not found: ${input.nodeId}. Try calling get_page_hierarchy with refresh=true first.`
    );
  }

  const parent = node.parentId ? registry.getNode(node.parentId) : null;
  const children = registry.getChildren(input.nodeId);
  const path = buildPath(input.nodeId);

  return {
    node,
    parent,
    children,
    path
  };
}

/**
 * Build path from root to node
 * @param nodeId
 */
function buildPath(nodeId: string): string[] {
  const registry = getNodeRegistry();
  const path: string[] = [];
  let currentId: string | null = nodeId;

  while (currentId) {
    const node = registry.getNode(currentId);
    if (!node) {
      break;
    }

    path.unshift(node.name);
    currentId = node.parentId;
  }

  return path;
}

/**
 * Tool definition for MCP
 */
export const getNodeInfoToolDefinition = {
  name: 'get_node_info',
  description: `Returns detailed information about a specific node by ID.

Provides comprehensive details about a node including its parent,
children, position, and hierarchical path. Faster than fetching
the entire hierarchy when you only need info about one node.

**When to Use:**
- To check if a node exists before using it as a parent
- To understand a node's position in the hierarchy
- To get node dimensions before positioning adjacent elements
- To verify node type before applying type-specific operations

**Returned Information:**
- node: Full node details (type, name, bounds, etc.)
- parent: The node's parent (or null if root)
- children: Array of direct child nodes
- path: Breadcrumb path from root (e.g., ["Page", "Container", "Card"])

**Error Handling:**
If the node is not found in the registry, an error is thrown with
instructions to refresh the hierarchy using get_page_hierarchy.

**Example Usage:**
\`\`\`typescript
// Check if a node exists and get its info
try {
  const info = await getNodeInfo({ nodeId: "123:456" });
  console.log(\`Found: \${info.node.name} (\${info.node.type})\`);
  console.log(\`Path: \${info.path.join(' > ')}\`);

  // Use as parent for new element
  if (info.node.type === 'FRAME') {
    await createText({
      content: "Hello",
      parentId: info.node.nodeId
    });
  }
} catch (error) {
  // Node not found, need to refresh
  await getPageHierarchy({ refresh: true });
}
\`\`\`

**Performance:**
Very fast - uses in-memory registry lookup.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the node to query'
      }
    },
    required: ['nodeId']
  }
};
