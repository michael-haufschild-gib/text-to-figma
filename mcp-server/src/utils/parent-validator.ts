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
const CONTAINER_NODE_TYPES = ['frame', 'component', 'component_set'] as const;

export type ChildNodeType = (typeof CHILD_NODE_TYPES)[number];
export type ContainerNodeType = (typeof CONTAINER_NODE_TYPES)[number];

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
    const message = `Creating ${nodeType} without parentId will place it at canvas root, outside any auto-layout container.`;
    const suggestion = `Specify parentId to place this ${nodeType} inside a frame. Example: { parentId: "frame-id" }`;

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
): Promise<ParentValidationResult & { parentNode?: any }> {
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
      node?: any;
      error?: string;
    }>('get_node_by_id', {
      nodeId: parentId
    });

    if (!response.exists) {
      return {
        isValid: false,
        error: `Parent node with ID "${parentId}" does not exist`,
        suggestion: 'Create the parent frame first, or use an existing frame ID'
      };
    }

    // Check if parent is a valid container type
    const parentType = response.node?.type?.toLowerCase();
    const isValidContainer =
      parentType === 'frame' ||
      parentType === 'component' ||
      parentType === 'component_set' ||
      parentType === 'page';

    if (!isValidContainer) {
      return {
        isValid: false,
        error: `Parent node "${parentId}" is type "${parentType}", which cannot contain children`,
        suggestion: 'Use a frame, component, or component set as the parent'
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
    logger.error('Parent validation failed', error as Error, { parentId });

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
  if (checkExists && parentId) {
    const existenceValidation = await validateParentExists(parentId);
    if (!existenceValidation.isValid) {
      return existenceValidation;
    }
  }

  return { isValid: true };
}

/**
 * Format validation result for user-friendly error messages
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
