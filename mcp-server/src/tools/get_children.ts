/**
 * MCP Tool: get_children
 *
 * Gets child nodes of a container (frame, group, etc.).
 *
 * PRIMITIVE: Raw Figma node tree primitive.
 * In Figma: node.children
 * Use for: navigating node tree, batch operations, hierarchy inspection
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const GetChildrenInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the parent node'),
  recursive: z
    .boolean()
    .optional()
    .default(false)
    .describe('Get all descendants (recursive) or just direct children')
});

export type GetChildrenInput = z.infer<typeof GetChildrenInputSchema>;

/**
 * Child node info
 */
export interface ChildNodeInfo {
  nodeId: string;
  name: string;
  type: string;
  visible: boolean;
  locked: boolean;
}

/**
 * Tool definition
 */
export const getChildrenToolDefinition = {
  name: 'get_children',
  description: `Lists all child nodes inside a container (frame, group, component).

🎯 WHEN TO USE:
- Exploring what's inside a frame before modifying it
- Finding all elements to batch-update (e.g., change all text colors)
- Understanding component structure before replicating
- Verifying node creation succeeded

📋 PARAMETERS:
- nodeId: The container to inspect
- recursive: false (default) = Direct children only
              true = All descendants (entire subtree flattened)

📋 RETURNS (for each child):
- nodeId: Use this to target the child in subsequent operations
- name: Layer name as shown in Figma
- type: FRAME, TEXT, ELLIPSE, RECTANGLE, GROUP, etc.
- visible: Whether layer is visible
- locked: Whether layer is locked

💡 COMMON PATTERNS:

1. List items in a container:
   children = get_children({ nodeId: "card-frame-123" })
   // Returns: [{ nodeId: "...", name: "Title", type: "TEXT" }, ...]

2. Find all text nodes in a design:
   all = get_children({ nodeId: "page-root", recursive: true })
   textNodes = all.children.filter(c => c.type === "TEXT")

3. Count elements:
   result = get_children({ nodeId: "list-container" })
   console.log(\`Found \${result.childCount} items\`)

⚠️ TIP: Use recursive=false first for performance. Only use recursive=true
when you need to search through nested hierarchies.

🔗 RELATED TOOLS:
- get_parent: Navigate UP the tree
- get_node_info: Get detailed properties of a specific child
- get_page_hierarchy: See entire page as a tree structure`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: {
        type: 'string' as const,
        description: 'ID of the parent node'
      },
      recursive: {
        type: 'boolean' as const,
        description: 'Get all descendants',
        default: false
      }
    },
    required: ['nodeId']
  }
};

/**
 * Response schema for Figma bridge get_children response
 */
const GetChildrenResponseSchema = z
  .object({
    children: z
      .array(
        z
          .object({
            nodeId: z.string(),
            name: z.string(),
            type: z.string(),
            visible: z.boolean(),
            locked: z.boolean()
          })
          .passthrough()
      )
      .optional()
  })
  .passthrough();

/**
 * Result type
 */
export interface GetChildrenResult {
  nodeId: string;
  childCount: number;
  children: ChildNodeInfo[];
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function getChildren(input: GetChildrenInput): Promise<GetChildrenResult> {
  // Validate input
  const validated = input;

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  const response = await bridge.sendToFigmaValidated(
    'get_children',
    {
      nodeId: validated.nodeId,
      recursive: validated.recursive
    },
    GetChildrenResponseSchema
  );

  const children = response.children ?? [];
  const scope = validated.recursive ? 'descendants' : 'direct children';

  return {
    nodeId: validated.nodeId,
    childCount: children.length,
    children,
    message: `Found ${children.length} ${scope}`
  };
}
