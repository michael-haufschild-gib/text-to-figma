/**
 * MCP Tool: align_nodes
 *
 * Aligns multiple nodes along a common edge or center.
 * Essential for creating organized layouts and connecting shapes seamlessly.
 *
 * HELPER TOOL: Builds on absolute positioning primitives.
 * Use for: aligning shapes, creating layouts, connecting elements
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { getLogger } from '../monitoring/logger.js';
import { createToolResult, type ToolResult } from '../utils/tool-result.js';

const log = getLogger().child({ tool: 'align_nodes' });

/**
 * Alignment options
 */
export const AlignmentType = z.enum([
  'LEFT', // Align left edges
  'CENTER_H', // Align horizontal centers
  'RIGHT', // Align right edges
  'TOP', // Align top edges
  'CENTER_V', // Align vertical centers
  'BOTTOM' // Align bottom edges
]);

export type AlignmentTypeValue = z.infer<typeof AlignmentType>;

/**
 * Input schema
 */
export const AlignNodesInputSchema = z.object({
  nodeIds: z.array(z.string()).min(2).describe('Array of node IDs to align (minimum 2)'),
  alignment: AlignmentType.describe('Alignment type'),
  alignTo: z
    .enum(['FIRST', 'LAST', 'SELECTION_BOUNDS'])
    .optional()
    .describe(
      'What to align to: first node, last node, or bounds of all nodes (default: SELECTION_BOUNDS)'
    )
});

export type AlignNodesInput = z.infer<typeof AlignNodesInputSchema>;

/**
 * Tool definition
 */
export const alignNodesToolDefinition = {
  name: 'align_nodes',
  description: `Aligns multiple nodes along a common edge or center.

HELPER TOOL: Spatial alignment helper for organizing layouts.
Use for: aligning shapes, creating organized layouts, connecting elements seamlessly.

Alignment Options:
- LEFT: Align all nodes' left edges
- CENTER_H: Align all nodes' horizontal centers
- RIGHT: Align all nodes' right edges
- TOP: Align all nodes' top edges
- CENTER_V: Align all nodes' vertical centers
- BOTTOM: Align all nodes' bottom edges

Align To Options:
- FIRST: Align all nodes to the first node's position (default for manual control)
- LAST: Align all nodes to the last node's position
- SELECTION_BOUNDS: Align to the center/edge of all selected nodes (default, most intuitive)

Example - Align legs horizontally:
align_nodes({
  nodeIds: ["leg1", "leg2", "leg3", "leg4"],
  alignment: "TOP",
  alignTo: "FIRST"
})
// All legs align to the top edge of leg1

Example - Center nodes vertically:
align_nodes({
  nodeIds: ["head", "body", "tail"],
  alignment: "CENTER_V",
  alignTo: "SELECTION_BOUNDS"
})
// All elements align to the vertical center of the group

Example - Align to create seamless connection:
align_nodes({
  nodeIds: ["neck", "body"],
  alignment: "CENTER_V"
})
// Aligns vertical centers for smooth connection

Use Cases:
- Align legs/arms of characters
- Create horizontal/vertical layouts
- Center elements relative to each other
- Connect shapes smoothly
- Organize UI elements
- Create symmetrical designs`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeIds: {
        type: 'array' as const,
        items: { type: 'string' as const },
        description: 'Array of node IDs to align (minimum 2)'
      },
      alignment: {
        type: 'string' as const,
        enum: ['LEFT', 'CENTER_H', 'RIGHT', 'TOP', 'CENTER_V', 'BOTTOM'],
        description: 'Alignment type'
      },
      alignTo: {
        type: 'string' as const,
        enum: ['FIRST', 'LAST', 'SELECTION_BOUNDS'],
        description: 'What to align to (default: SELECTION_BOUNDS)'
      }
    },
    required: ['nodeIds', 'alignment']
  }
};

/**
 * Response schema for Figma bridge align_nodes response
 */
const AlignNodesResponseSchema = z.object({}).passthrough();

/**
 * Result type
 */
export interface AlignNodesData {
  nodeIds: string[];
  alignment: AlignmentTypeValue;
  alignedTo: 'FIRST' | 'LAST' | 'SELECTION_BOUNDS';
}

export type AlignNodesResult = ToolResult<AlignNodesData>;

/**
 * Implementation
 * @param input
 */
export async function alignNodes(input: AlignNodesInput): Promise<AlignNodesResult> {
  const startTime = Date.now();

  // Validate input
  const validated = input;

  if (validated.nodeIds.length < 2) {
    const error = new Error('Must provide at least 2 nodes to align');
    log.error('Validation failed', error, { nodeCount: validated.nodeIds.length });
    throw error;
  }

  log.debug('Aligning nodes', {
    nodeCount: validated.nodeIds.length,
    alignment: validated.alignment
  });

  try {
    // Get Figma bridge
    const bridge = getFigmaBridge();

    // Send command to Figma
    await bridge.sendToFigmaValidated(
      'align_nodes',
      {
        nodeIds: validated.nodeIds,
        alignment: validated.alignment,
        alignTo: validated.alignTo ?? 'SELECTION_BOUNDS'
      },
      AlignNodesResponseSchema
    );

    const duration = Date.now() - startTime;
    const alignTo = validated.alignTo ?? 'SELECTION_BOUNDS';
    const message = `Aligned ${validated.nodeIds.length} nodes to ${validated.alignment} (relative to ${alignTo})`;

    log.info('Nodes aligned successfully', {
      nodeCount: validated.nodeIds.length,
      alignment: validated.alignment,
      alignTo,
      duration
    });

    return createToolResult<AlignNodesData>(
      {
        nodeIds: validated.nodeIds,
        alignment: validated.alignment,
        alignedTo: alignTo
      },
      message
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    log.error('Failed to align nodes', error instanceof Error ? error : undefined, {
      nodeIds: validated.nodeIds,
      alignment: validated.alignment,
      duration
    });

    throw new Error(`Failed to align nodes: ${errorMessage}`);
  }
}
