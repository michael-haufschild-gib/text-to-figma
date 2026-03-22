/**
 * Parent Validation Utility
 *
 * Prevents orphaned nodes by validating parent-child relationships
 * in auto-layout hierarchies.
 */

import { getFigmaBridge } from '../figma-bridge.js';
import { getLogger } from '../monitoring/logger.js';

const logger = getLogger().child({ module: 'parent-validator' });

/**
 * Node types that typically require parents for proper auto-layout
 */
const CHILD_NODE_TYPES = [
  'text',
  'ellipse',
  'rectangle',
  'polygon',
  'star',
  'line',
  'instance'
] as const;

/**
 * Node types that are typically containers
 */
export type ChildNodeType = (typeof CHILD_NODE_TYPES)[number];
export type ContainerNodeType = 'frame' | 'component' | 'component_set';

/**
 * Validation result with enhanced error messaging
 */
export interface ParentValidationResult {
  isValid: boolean;
  warning?: string;
  error?: string;
  suggestion?: string;
}

/**
 * Validates that a node has a parent when it should
 *
 * @param nodeType - Type of node being created (text, ellipse, etc.)
 * @param parentId - Parent ID provided (or undefined)
 * @param strict - If true, throws error; if false, returns warning
 * @returns Validation result
 */
export function validateParentId(
  nodeType: string,
  parentId: string | undefined,
  strict: boolean = false
): ParentValidationResult {
  const requiresParent = CHILD_NODE_TYPES.includes(nodeType as ChildNodeType);

  if (!requiresParent) {
    return { isValid: true };
  }

  if (!parentId) {
    const message = `HIERARCHY VIOLATION: ${nodeType} nodes must have a parent container.

WHY THIS MATTERS:
- Like HTML, design elements should be organized in containers
- Creating ${nodeType} at root level breaks the hierarchy
- This leads to disorganized designs and lost elements

HOW TO FIX:
1. First, create a parent frame: create_frame({ name: "Container", ... })
2. Then, use the frame ID as parentId: create_${nodeType}({ ..., parentId: "frame-id" })

BETTER APPROACH:
Use create_design tool for multi-element designs - it handles hierarchy automatically!

Example:
{
  spec: {
    type: 'frame',
    name: 'Container',
    children: [
      { type: '${nodeType}', name: 'My ${nodeType}', props: {...} }
    ]
  }
}`;

    const suggestion = `Create a parent frame first, then nest this ${nodeType} inside it using parentId.`;

    logger.warn('Node created without parent', {
      nodeType,
      hasParent: false,
      strict
    });

    if (strict) {
      return {
        isValid: false,
        error: message,
        suggestion
      };
    }

    return {
      isValid: true,
      warning: message,
      suggestion
    };
  }

  return { isValid: true };
}

/**
 * Validates that a parent node exists and is a valid container
 *
 * @param parentId - ID of the parent node
 * @returns Validation result with parent node info
 */
export async function validateParentExists(
  parentId: string
): Promise<ParentValidationResult & { parentNode?: Record<string, unknown> }> {
  try {
    const bridge = getFigmaBridge();

    if (!bridge.isConnected()) {
      return {
        isValid: false,
        error: 'Cannot validate parent: not connected to Figma',
        suggestion: 'Ensure the Figma plugin is running and connected'
      };
    }

    // Request parent node info from Figma
    const response = await bridge.sendToFigma<{
      exists: boolean;
      node?: Record<string, unknown>;
      error?: string;
    }>('get_node_by_id', {
      nodeId: parentId
    });

    if (!response.exists) {
      return {
        isValid: false,
        error: `PARENT NOT FOUND: Node with ID "${parentId}" does not exist.

COMMON CAUSES:
- Using an incorrect or outdated node ID
- Parent was deleted or never created
- Typo in the parentId value

HOW TO FIX:
1. Use get_page_hierarchy to see all existing nodes and their IDs
2. Create the parent frame first if it doesn't exist
3. Use the correct ID from the creation response

WORKFLOW EXAMPLE:
Step 1: const frame = await create_frame({ name: "Container" })
Step 2: await create_text({ content: "Hello", parentId: frame.frameId })

OR use create_design to avoid this error entirely!`,
        suggestion:
          'Check node IDs with get_page_hierarchy, or use create_design for multi-element designs'
      };
    }

    // Check if parent is a valid container type
    const nodeType = response.node?.type;
    const parentType = typeof nodeType === 'string' ? nodeType.toLowerCase() : undefined;
    const isValidContainer =
      parentType === 'frame' ||
      parentType === 'component' ||
      parentType === 'component_set' ||
      parentType === 'page';

    if (!isValidContainer) {
      return {
        isValid: false,
        error: `INVALID PARENT TYPE: Node "${parentId}" is type "${parentType}", which cannot contain children.

WHY THIS FAILS:
- Only container types (frames, components) can have children
- ${parentType} nodes are leaf nodes - they don't support nesting
- This is like trying to put HTML elements inside an <img> tag

VALID PARENT TYPES:
- frame: Most common container (like <div>)
- component: Reusable component container
- component_set: Variant container
- page: Top-level page container

INVALID PARENT TYPES:
- text: Cannot contain children
- ellipse, rectangle, polygon: Shape primitives only
- line: Single line element

HOW TO FIX:
1. Create a frame first: create_frame({ name: "Container" })
2. Use the frame ID as parent, not a ${parentType} ID
3. Or use create_design to handle hierarchy automatically`,
        suggestion: 'Create a frame container first, then nest elements inside it'
      };
    }

    logger.debug('Parent validation passed', {
      parentId,
      parentType
    });

    return {
      isValid: true,
      parentNode: response.node
    };
  } catch (error) {
    logger.error('Parent validation failed', error instanceof Error ? error : undefined, {
      parentId
    });

    return {
      isValid: false,
      error: `Failed to validate parent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      suggestion: 'Check that the parent ID is correct and the Figma plugin is running'
    };
  }
}

/**
 * Comprehensive parent validation with existence check
 *
 * @param nodeType - Type of node being created
 * @param parentId - Parent ID (if provided)
 * @param options - Validation options
 * @param options.strict
 * @param options.checkExists
 * @returns Validation result
 */
export async function validateParentRelationship(
  nodeType: string,
  parentId: string | undefined,
  options: {
    strict?: boolean;
    checkExists?: boolean;
  } = {}
): Promise<ParentValidationResult> {
  const { strict = false, checkExists = true } = options;

  // First check if parent is required
  const basicValidation = validateParentId(nodeType, parentId, strict);

  if (!basicValidation.isValid || !parentId) {
    return basicValidation;
  }

  // If parent exists and we should check it
  if (checkExists) {
    const existenceValidation = await validateParentExists(parentId);
    if (!existenceValidation.isValid) {
      return existenceValidation;
    }
  }

  return { isValid: true };
}

/**
 * Format validation result for user-friendly error messages
 * @param result
 */
export function formatValidationError(result: ParentValidationResult): string {
  let message = '';

  if (result.error) {
    message += `ERROR: ${result.error}\n`;
  }

  if (result.warning) {
    message += `WARNING: ${result.warning}\n`;
  }

  if (result.suggestion) {
    message += `\nSuggestion: ${result.suggestion}`;
  }

  return message;
}

/**
 * Get hierarchy pattern examples for common design scenarios
 * @param nodeType
 */
export function getHierarchyPatternExamples(nodeType: string): string {
  const patterns: Record<string, string> = {
    text: `COMMON TEXT PATTERNS:

1. Button with Text:
   create_design({
     spec: {
       type: 'frame',
       name: 'Button',
       props: { layoutMode: 'HORIZONTAL', padding: 16, fillColor: '#0066FF' },
       children: [
         { type: 'text', name: 'Label', props: { content: 'Click Me', color: '#FFFFFF' } }
       ]
     }
   })

2. Card with Heading and Body:
   create_design({
     spec: {
       type: 'frame',
       name: 'Card',
       props: { layoutMode: 'VERTICAL', padding: 24, itemSpacing: 12 },
       children: [
         { type: 'text', name: 'Heading', props: { content: 'Title', fontSize: 24, fontWeight: 700 } },
         { type: 'text', name: 'Body', props: { content: 'Description...', fontSize: 16 } }
       ]
     }
   })`,

    ellipse: `COMMON SHAPE PATTERNS:

1. Icon with Circle Background:
   create_design({
     spec: {
       type: 'frame',
       name: 'Icon Container',
       props: { width: 40, height: 40 },
       children: [
         { type: 'ellipse', name: 'Circle', props: { width: 40, height: 40, fillColor: '#E0E0E0' } }
       ]
     }
   })

2. Avatar with Image:
   create_design({
     spec: {
       type: 'frame',
       name: 'Avatar',
       props: { width: 48, height: 48, cornerRadius: 24 },
       children: [
         { type: 'ellipse', name: 'Mask', props: { width: 48, height: 48 } }
       ]
     }
   })`,

    rectangle: `COMMON RECTANGLE PATTERNS:

1. Card Background:
   create_design({
     spec: {
       type: 'frame',
       name: 'Card',
       props: { layoutMode: 'VERTICAL', cornerRadius: 8, fillColor: '#FFFFFF' },
       children: [
         { type: 'rectangle', name: 'Header BG', props: { width: 300, height: 100, fillColor: '#0066FF' } },
         { type: 'text', name: 'Content', props: { content: 'Body text' } }
       ]
     }
   })

2. Divider Line:
   create_design({
     spec: {
       type: 'frame',
       name: 'Section',
       props: { layoutMode: 'VERTICAL', itemSpacing: 16 },
       children: [
         { type: 'text', name: 'Header', props: { content: 'Section 1' } },
         { type: 'rectangle', name: 'Divider', props: { width: 100, height: 1, fillColor: '#E0E0E0' } }
       ]
     }
   })`
  };

  return patterns[nodeType] ?? patterns.text ?? '';
}
