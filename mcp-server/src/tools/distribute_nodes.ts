/**
 * MCP Tool: distribute_nodes
 *
 * Distributes multiple nodes evenly along an axis with equal spacing.
 * Essential for creating organized, evenly-spaced layouts.
 *
 * HELPER TOOL: Builds on absolute positioning primitives.
 * Use for: evenly spacing elements, creating grids, organizing layouts
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { getLogger } from '../monitoring/logger.js';
import { createToolResult, type ToolResult } from '../utils/tool-result.js';

const log = getLogger().child({ tool: 'distribute_nodes' });

/**
 * Distribution axis
 */
export const DistributionAxis = z.enum([
  'HORIZONTAL', // Distribute along X axis
  'VERTICAL' // Distribute along Y axis
]);

export type DistributionAxisValue = z.infer<typeof DistributionAxis>;

/**
 * Distribution method
 */
export const DistributionMethod = z.enum([
  'CENTERS', // Equal spacing between centers
  'SPACING' // Equal spacing between edges (gaps)
]);

export type DistributionMethodValue = z.infer<typeof DistributionMethod>;

/**
 * Input schema
 */
export const DistributeNodesInputSchema = z.object({
  nodeIds: z.array(z.string()).min(3).describe('Array of node IDs to distribute (minimum 3)'),
  axis: DistributionAxis.describe('Axis to distribute along'),
  method: DistributionMethod.optional().describe('Distribution method (default: SPACING)'),
  spacing: z.number().optional().describe('Optional custom spacing (only for SPACING method)')
});

export type DistributeNodesInput = z.infer<typeof DistributeNodesInputSchema>;

/**
 * Tool definition
 */
export const distributeNodesToolDefinition = {
  name: 'distribute_nodes',
  description: `Distributes multiple nodes evenly along an axis.

HELPER TOOL: Spatial distribution helper for organized layouts.
Use for: evenly spacing elements, creating grids, organizing layouts.

Distribution Axes:
- HORIZONTAL: Distribute along X axis (left to right)
- VERTICAL: Distribute along Y axis (top to bottom)

Distribution Methods:
- SPACING (default): Equal gaps between node edges
  * Keeps outer nodes in place, evenly spaces inner nodes
  * Best for: evenly spacing legs, buttons, grid items
- CENTERS: Equal spacing between node centers
  * Distributes based on center points
  * Best for: creating patterns, symmetrical layouts

Custom Spacing:
- If provided with SPACING method, uses exact spacing value
- If not provided, calculates even spacing based on outer nodes

Example - Evenly space 4 legs:
distribute_nodes({
  nodeIds: ["leg1", "leg2", "leg3", "leg4"],
  axis: "HORIZONTAL",
  method: "SPACING"
})
// Creates equal gaps between legs

Example - Distribute with custom spacing:
distribute_nodes({
  nodeIds: ["item1", "item2", "item3"],
  axis: "VERTICAL",
  method: "SPACING",
  spacing: 20
})
// 20px gap between each item

Example - Distribute centers:
distribute_nodes({
  nodeIds: ["star1", "star2", "star3", "star4", "star5"],
  axis: "HORIZONTAL",
  method: "CENTERS"
})
// Even spacing between star centers

Use Cases:
- Space legs/arms evenly on characters
- Create button groups with equal spacing
- Organize grid layouts
- Create patterns with even distribution
- Space UI elements consistently`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeIds: {
        type: 'array' as const,
        items: { type: 'string' as const },
        description: 'Array of node IDs to distribute (minimum 3)'
      },
      axis: {
        type: 'string' as const,
        enum: ['HORIZONTAL', 'VERTICAL'],
        description: 'Axis to distribute along'
      },
      method: {
        type: 'string' as const,
        enum: ['CENTERS', 'SPACING'],
        description: 'Distribution method (default: SPACING)'
      },
      spacing: {
        type: 'number' as const,
        description: 'Optional custom spacing (only for SPACING method)'
      }
    },
    required: ['nodeIds', 'axis']
  }
};

/**
 * Response schema for Figma bridge distribute_nodes response
 */
const DistributeNodesResponseSchema = z
  .object({
    spacing: z.number().optional()
  })
  .passthrough();

/**
 * Result type
 */
export interface DistributeNodesData {
  nodeIds: string[];
  axis: DistributionAxisValue;
  method: DistributionMethodValue;
  spacing?: number;
}

export type DistributeNodesResult = ToolResult<DistributeNodesData>;

/**
 * Implementation
 * @param input
 */
export async function distributeNodes(input: DistributeNodesInput): Promise<DistributeNodesResult> {
  const startTime = Date.now();

  if (input.nodeIds.length < 3) {
    const error = new Error('Must provide at least 3 nodes to distribute');
    log.error('Validation failed', error, { nodeCount: input.nodeIds.length });
    throw error;
  }

  log.debug('Distributing nodes', {
    nodeCount: input.nodeIds.length,
    axis: input.axis
  });

  try {
    // Get Figma bridge
    const bridge = getFigmaBridge();

    const method = input.method ?? 'SPACING';

    // Send command to Figma
    const response = await bridge.sendToFigmaValidated(
      'distribute_nodes',
      {
        nodeIds: input.nodeIds,
        axis: input.axis,
        method,
        spacing: input.spacing
      },
      DistributeNodesResponseSchema
    );

    const duration = Date.now() - startTime;
    const actualSpacing = input.spacing ?? response.spacing;
    const message = `Distributed ${input.nodeIds.length} nodes ${input.axis.toLowerCase()} using ${method}${actualSpacing !== undefined ? ` (spacing: ${String(actualSpacing)}px)` : ''}`;

    log.info('Nodes distributed successfully', {
      nodeCount: input.nodeIds.length,
      axis: input.axis,
      method,
      spacing: actualSpacing,
      duration
    });

    return createToolResult<DistributeNodesData>(
      {
        nodeIds: input.nodeIds,
        axis: input.axis,
        method,
        spacing: actualSpacing
      },
      message
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    log.error('Failed to distribute nodes', error instanceof Error ? error : undefined, {
      nodeIds: input.nodeIds,
      axis: input.axis,
      duration
    });

    throw new Error(`Failed to distribute nodes: ${errorMessage}`);
  }
}
