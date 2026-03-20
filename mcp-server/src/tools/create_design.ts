/**
 * create_design - Batch hierarchy creation tool
 *
 * Creates an entire design hierarchy in a single atomic operation.
 * This eliminates coordination issues between separate commands.
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { getLogger } from '../monitoring/logger.js';
import { getNodeRegistry } from '../node-registry.js';
import { autoCorrectSpec, type Correction } from '../utils/auto-validator.js';

const logger = getLogger().child({ component: 'create-design' });

/**
 * Zod schema for recursive NodeSpec tree validation.
 * Uses z.lazy() to support the recursive children field.
 */
const nodeSpecSchema: z.ZodType<NodeSpec> = z.lazy(() =>
  z.object({
    type: z.enum(['frame', 'text', 'ellipse', 'rectangle', 'line']),
    name: z.string().optional(),
    props: z.record(z.unknown()).optional(),
    children: z.array(nodeSpecSchema).optional()
  })
);

export const CreateDesignInputSchema = z.object({
  spec: nodeSpecSchema,
  parentId: z.string().optional(),
  autoCorrect: z.boolean().optional()
});

interface NodeSpec {
  type: 'frame' | 'text' | 'ellipse' | 'rectangle' | 'line';
  name?: string;
  props?: {
    // Dimensions
    width?: number;
    height?: number;
    x?: number;
    y?: number;

    // Layout (frame only)
    layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
    itemSpacing?: number;
    padding?: number;
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
    horizontalSizing?: 'FILL' | 'HUG' | 'FIXED';
    verticalSizing?: 'FILL' | 'HUG' | 'FIXED';
    primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
    counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX';

    // Fills
    fillColor?: string;
    fillOpacity?: number;
    fills?: Array<{
      type: string;
      color?: { r: number; g: number; b: number };
      opacity?: number;
    }>;

    // Stroke
    strokeColor?: string;
    strokeWeight?: number;
    strokeAlign?: 'INSIDE' | 'OUTSIDE' | 'CENTER';

    // Effects
    effects?: Array<{
      type: string;
      color?: { r: number; g: number; b: number; a: number };
      offset?: { x: number; y: number };
      radius?: number;
      spread?: number;
      visible?: boolean;
    }>;
    cornerRadius?: number;

    // Text properties
    content?: string;
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: number;
    color?: string;
    textAlign?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
    lineHeight?: number;
    letterSpacing?: number;
  };
  children?: NodeSpec[];
}

export interface CreateDesignParams {
  spec: NodeSpec;
  parentId?: string; // Optional parent container to nest the design inside
  autoCorrect?: boolean; // Auto-correct spacing/typography to design grid (default: true)
}

export interface CreateDesignResult {
  success: boolean;
  rootNodeId?: string;
  nodeIds?: Record<string, string>;
  totalNodes?: number;
  message?: string;
  error?: string;
  /** Auto-corrections that were applied (if autoCorrect was enabled) */
  autoCorrections?: Correction[];
}

/**
 * Response from Figma plugin for create_design
 */
interface FigmaCreateDesignResponse {
  rootNodeId: string;
  nodeIds: Record<string, string>;
  totalNodes: number;
  message: string;
  nodes?: Array<{
    nodeId: string;
    type: string;
    name: string;
    parentId: string | null;
    bounds: { x: number; y: number; width: number; height: number };
  }>;
}

/**
 * Type guard to validate Figma response structure
 * @param response
 */
function isValidCreateDesignResponse(response: unknown): response is FigmaCreateDesignResponse {
  if (response === null || response === undefined || typeof response !== 'object') {
    return false;
  }
  const r = response as Record<string, unknown>;
  return (
    typeof r.rootNodeId === 'string' &&
    typeof r.nodeIds === 'object' &&
    r.nodeIds !== null &&
    typeof r.totalNodes === 'number'
  );
}

/**
 *
 * @param params
 */
export async function createDesign(params: CreateDesignParams): Promise<CreateDesignResult> {
  try {
    const bridge = getFigmaBridge();

    // Apply auto-correction unless explicitly disabled
    const shouldAutoCorrect = params.autoCorrect !== false;
    let specToUse = params.spec;
    let corrections: Correction[] = [];

    if (shouldAutoCorrect) {
      const correctionResult = autoCorrectSpec(params.spec);
      specToUse = correctionResult.corrected;
      corrections = correctionResult.corrections;

      if (corrections.length > 0) {
        logger.info(`Applied ${corrections.length} auto-correction(s)`);
      }
    }

    const response = await bridge.sendToFigmaWithRetry('create_design', {
      spec: specToUse,
      parentId: params.parentId // Pass parentId to Figma plugin
    });

    // Validate response structure
    if (!isValidCreateDesignResponse(response)) {
      return {
        success: false,
        error: 'Invalid response from Figma plugin: missing required fields'
      };
    }

    // Register all created nodes in the node registry
    const registry = getNodeRegistry();
    if (Array.isArray(response.nodes)) {
      for (const nodeInfo of response.nodes) {
        if (typeof nodeInfo.nodeId === 'string') {
          registry.register(nodeInfo.nodeId, {
            type: typeof nodeInfo.type === 'string' ? nodeInfo.type : 'UNKNOWN',
            name: typeof nodeInfo.name === 'string' ? nodeInfo.name : 'Unnamed',
            parentId: nodeInfo.parentId,
            children: [], // Will be populated as we register children
            bounds: nodeInfo.bounds
          });
        }
      }
      logger.info(`Registered ${response.nodes.length} nodes in registry`);
    }

    return {
      success: true,
      rootNodeId: response.rootNodeId,
      nodeIds: response.nodeIds,
      totalNodes: response.totalNodes,
      message:
        typeof response.message === 'string' ? response.message : 'Design created successfully',
      autoCorrections: corrections.length > 0 ? corrections : undefined
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Tool definition for MCP server
 */
export const createDesignToolDefinition = {
  name: 'create_design',
  description: `[TIER 1 - PRIMARY] 🌟 Start here for 80% of design tasks!

Creates entire design hierarchies in a single atomic operation.

🎯 USE THIS TOOL FOR:
- ANY design with 2+ elements (buttons, cards, forms, navbars, modals, lists)
- Complex layouts with nested containers
- Multi-level hierarchies where elements need to be grouped

✅ BENEFITS:
- All nodes created together in one operation (no coordination issues)
- Proper parent-child relationships automatically guaranteed
- 17x faster than using individual create_* commands
- Single atomic operation (all succeed or all fail)
- No "parent node not found" errors
- No race conditions between commands
- Auto-corrects spacing to 8pt grid and font sizes to type scale (disable with autoCorrect: false)

⚠️ ONLY use individual create_* tools for single, isolated nodes.

� NESTING DESIGNS (parentId):
To create a design INSIDE an existing container, use the parentId parameter:
- Get the parent node ID from previous create_design response (nodeIds map)
- Pass it as parentId to nest the new design inside that container
- Example: Creating buttons inside a "Button Row" container

Example with parentId:
{
  spec: { type: 'frame', name: 'Button', props: { ... }, children: [...] },
  parentId: "10119:46087"  // ← ID of existing parent container
}

📋 SPECIFICATION FORMAT:
The spec is a tree structure where each node has:
- type: 'frame' | 'text' | 'ellipse' | 'rectangle' | 'line'
- name: optional node name
- props: properties like width, height, colors, layout settings
- children: array of child node specs (frames can have children)

FILLS FORMAT:
For simple solid colors, use fillColor:
  props: { fillColor: '#0066FF' }

For fills with opacity or gradients, use fills array:
  props: {
    fills: [{
      type: 'SOLID',
      color: { r: 1, g: 1, b: 1 },  // RGB values 0-1
      opacity: 0.5  // Optional, defaults to 1
    }]
  }

IMPORTANT: When extracting components, always preserve the fills array format to maintain opacity values!

SIZING MODES:
Control how frames size themselves in auto-layout:
- horizontalSizing: 'FIXED' (explicit width) | 'HUG' (fit content) | 'FILL' (expand to fill)
- verticalSizing: 'FIXED' (explicit height) | 'HUG' (fit content) | 'FILL' (expand to fill)

Examples:
  Fixed dimensions: { width: 180, horizontalSizing: 'FIXED', verticalSizing: 'HUG' }
  Content-fitted: { horizontalSizing: 'HUG', verticalSizing: 'HUG' }
  Full-width: { horizontalSizing: 'FILL', verticalSizing: 'HUG' }

IMPORTANT: When replicating components, preserve the exact sizing mode and dimensions from the original!

💡 EXAMPLES:

Simple Button with Icon:
{
  type: 'frame',
  name: 'Button',
  props: {
    layoutMode: 'HORIZONTAL',
    padding: 16,
    itemSpacing: 8,
    fillColor: '#0066FF',
    cornerRadius: 8
  },
  children: [
    { type: 'ellipse', name: 'Icon', props: { width: 20, height: 20, fillColor: '#FFFFFF' } },
    { type: 'text', name: 'Label', props: { content: 'Click Me', fontSize: 16, color: '#FFFFFF' } }
  ]
}

Frame with Transparent Fill and Fixed Width:
{
  type: 'frame',
  name: 'Container',
  props: {
    width: 180,
    horizontalSizing: 'FIXED',  // Maintain fixed width
    verticalSizing: 'HUG',  // Height fits content
    layoutMode: 'HORIZONTAL',
    padding: 16,
    itemSpacing: 8,
    fills: [{
      type: 'SOLID',
      color: { r: 1, g: 1, b: 1 },
      opacity: 0  // Transparent fill
    }],
    cornerRadius: 8
  },
  children: [
    { type: 'text', name: 'Label', props: { content: 'Text', fontSize: 16, color: '#000000' } }
  ]
}

Login Modal with Form:
{
  type: 'frame',
  name: 'Login Modal',
  props: {
    width: 400,
    height: 520,
    layoutMode: 'VERTICAL',
    itemSpacing: 24,
    padding: 32,
    fillColor: '#FFFFFF',
    cornerRadius: 16
  },
  children: [
    { type: 'text', name: 'Title', props: { content: 'Sign In', fontSize: 24, fontWeight: 700 } },
    { type: 'text', name: 'Subtitle', props: { content: 'Welcome back', fontSize: 14, color: '#666666' } },
    {
      type: 'frame',
      name: 'Email Input',
      props: { layoutMode: 'VERTICAL', itemSpacing: 8, horizontalSizing: 'FILL' },
      children: [
        { type: 'text', name: 'Email Label', props: { content: 'Email', fontSize: 12 } },
        { type: 'frame', name: 'Email Field', props: { height: 40, fillColor: '#F5F5F5' } }
      ]
    }
  ]
}`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      spec: {
        type: 'object',
        description: 'Hierarchical node specification',
        properties: {
          type: {
            type: 'string',
            enum: ['frame', 'text', 'ellipse', 'rectangle', 'line'],
            description: 'Node type to create'
          },
          name: {
            type: 'string',
            description: 'Optional node name'
          },
          props: {
            type: 'object',
            description: 'Node properties (dimensions, colors, layout, etc.)'
          },
          children: {
            type: 'array',
            description: 'Child node specifications (frames only)',
            items: {
              type: 'object'
            }
          }
        },
        required: ['type']
      },
      parentId: {
        type: 'string',
        description: 'Optional parent frame ID to nest the entire design inside'
      },
      autoCorrect: {
        type: 'boolean',
        description:
          'Auto-correct spacing/typography to design grid (default: true). Set to false to skip auto-correction.',
        default: true
      }
    },
    required: ['spec']
  },
  metadata: {
    tier: 1,
    category: 'creation',
    usageFrequency: 'very-high',
    complexity: 'moderate',
    tags: ['primary', 'atomic', 'hierarchy', 'batch']
  }
};
