/**
 * MCP Tool: get_node_by_name
 *
 * Finds nodes by name (returns first match or all matches).
 *
 * PRIMITIVE: Raw Figma node search primitive.
 * In Figma: figma.currentPage.findOne() or findAll()
 * Use for: finding nodes by name, batch operations
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Input schema
 */
export const GetNodeByNameInputSchema = z.object({
  name: z.string().min(1).describe('Name or partial name to search for'),
  findAll: z
    .boolean()
    .optional()
    .default(false)
    .describe('Find all matches (default: first match only)'),
  exactMatch: z
    .boolean()
    .optional()
    .default(false)
    .describe('Require exact name match (default: partial match)')
});

export type GetNodeByNameInput = z.infer<typeof GetNodeByNameInputSchema>;

/**
 * Result type
 */
export interface NodeInfo {
  nodeId: string;
  name: string;
  type: string;
  parentId?: string;
}

/**
 * Tool definition
 */
export const getNodeByNameToolDefinition = {
  name: 'get_node_by_name',
  description: `Finds nodes by name (returns first match or all matches).

PRIMITIVE: Raw Figma node search primitive - not a pre-made component.
Use for: finding nodes by name, batch operations, node discovery.

Search Options:
- findAll: false (default) = first match only
- findAll: true = all matches
- exactMatch: false (default) = partial match
- exactMatch: true = exact name match

Example - Find First Button:
get_node_by_name({
  name: "Button",
  findAll: false,
  exactMatch: false
})

Example - Find All Cards:
get_node_by_name({
  name: "Card",
  findAll: true,
  exactMatch: false
})

Example - Exact Match:
get_node_by_name({
  name: "Primary Button",
  findAll: false,
  exactMatch: true
})

Use Cases:
- Find components by name
- Batch update similar nodes
- Verify naming conventions
- Navigate by semantic names`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string' as const,
        description: 'Name or partial name to search for'
      },
      findAll: {
        type: 'boolean' as const,
        description: 'Find all matches (default: false)',
        default: false
      },
      exactMatch: {
        type: 'boolean' as const,
        description: 'Require exact name match (default: false)',
        default: false
      }
    },
    required: ['name']
  }
};

/**
 * Response schema for Figma bridge get_node_by_name response
 */
const GetNodeByNameResponseSchema = z
  .object({
    nodes: z
      .array(
        z
          .object({
            nodeId: z.string(),
            name: z.string(),
            type: z.string(),
            parentId: z.string().optional()
          })
          .passthrough()
      )
      .optional()
  })
  .passthrough();

/**
 * Result type
 */
export interface GetNodeByNameResult {
  found: number;
  nodes: NodeInfo[];
  message: string;
}

/**
 * Implementation
 * @param input
 */
export async function getNodeByName(input: GetNodeByNameInput): Promise<GetNodeByNameResult> {
  // Validate input
  const validated = input;

  // Get Figma bridge
  const bridge = getFigmaBridge();

  // Send command to Figma
  const response = await bridge.sendToFigmaValidated(
    'get_node_by_name',
    {
      name: validated.name,
      findAll: validated.findAll,
      exactMatch: validated.exactMatch
    },
    GetNodeByNameResponseSchema
  );

  const nodes = response.nodes ?? [];
  const matchType = validated.exactMatch ? 'exact' : 'partial';
  const searchScope = validated.findAll ? 'all matches' : 'first match';

  return {
    found: nodes.length,
    nodes,
    message: `Found ${nodes.length} node(s) with ${matchType} match for "${validated.name}" (${searchScope})`
  };
}
