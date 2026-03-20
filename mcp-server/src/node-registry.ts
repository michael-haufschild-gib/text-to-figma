/**
 * Node Registry - Context-Persistent Hierarchy Tracking
 *
 * Maintains awareness of the Figma node tree structure across context windows.
 * Allows Claude to query and understand the complete hierarchy at any time.
 */

import { getLogger } from './monitoring/logger.js';

const logger = getLogger().child({ component: 'node-registry' });

/**
 * Information about a node in the Figma tree
 */
export interface NodeInfo {
  nodeId: string;
  type: string;
  name: string;
  parentId: string | null;
  children: string[];
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  createdAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * Hierarchical tree representation
 */
export interface HierarchyNode {
  nodeId: string;
  type: string;
  name: string;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  children: HierarchyNode[];
}

/**
 * Node Registry for tracking Figma hierarchy
 */
export class NodeRegistry {
  private nodes = new Map<string, NodeInfo>();
  private rootNodes: string[] = [];

  /**
   * Register a new node in the hierarchy
   * @param nodeId
   * @param info
   */
  register(nodeId: string, info: Omit<NodeInfo, 'nodeId' | 'createdAt'>): void {
    const nodeInfo: NodeInfo = {
      ...info,
      nodeId,
      createdAt: Date.now()
    };

    this.nodes.set(nodeId, nodeInfo);

    // Update parent's children list
    if (info.parentId) {
      const parent = this.nodes.get(info.parentId);
      if (parent && !parent.children.includes(nodeId)) {
        parent.children.push(nodeId);
      }
    } else {
      // Root node
      if (!this.rootNodes.includes(nodeId)) {
        this.rootNodes.push(nodeId);
      }
    }

    logger.debug(`Registered node: ${nodeId} (${info.type} "${info.name}")`);
  }

  /**
   * Update an existing node's information
   * @param nodeId
   * @param updates
   */
  update(nodeId: string, updates: Partial<Omit<NodeInfo, 'nodeId' | 'createdAt'>>): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      logger.warn(`Cannot update non-existent node: ${nodeId}`);
      return;
    }

    Object.assign(node, updates);
    logger.debug(`Updated node: ${nodeId}`);
  }

  /**
   * Get information about a specific node
   * @param nodeId
   */
  getNode(nodeId: string): NodeInfo | null {
    return this.nodes.get(nodeId) ?? null;
  }

  /**
   * Get all direct children of a node
   * @param nodeId
   */
  getChildren(nodeId: string): NodeInfo[] {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return [];
    }

    return node.children
      .map((childId) => this.nodes.get(childId))
      .filter((child): child is NodeInfo => child !== undefined);
  }

  /**
   * Get all descendants of a node (recursive)
   * @param nodeId
   */
  getDescendants(nodeId: string): NodeInfo[] {
    const descendants: NodeInfo[] = [];
    const children = this.getChildren(nodeId);

    for (const child of children) {
      descendants.push(child);
      descendants.push(...this.getDescendants(child.nodeId));
    }

    return descendants;
  }

  /**
   * Get all root nodes (nodes with no parent)
   */
  getRootNodes(): NodeInfo[] {
    return this.rootNodes
      .map((nodeId) => this.nodes.get(nodeId))
      .filter((node): node is NodeInfo => node !== undefined);
  }

  /**
   * Get the full hierarchy as a tree structure
   */
  getHierarchy(): HierarchyNode[] {
    const buildTree = (nodeId: string): HierarchyNode | null => {
      const node = this.nodes.get(nodeId);
      if (!node) {
        return null;
      }

      return {
        nodeId: node.nodeId,
        type: node.type,
        name: node.name,
        bounds: node.bounds,
        children: node.children.map(buildTree).filter((n): n is HierarchyNode => n !== null)
      };
    };

    return this.rootNodes.map(buildTree).filter((n): n is HierarchyNode => n !== null);
  }

  /**
   * Get a flat list of all nodes
   */
  getAllNodes(): NodeInfo[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Find nodes by type
   * @param type
   */
  findByType(type: string): NodeInfo[] {
    return Array.from(this.nodes.values()).filter((node) => node.type === type);
  }

  /**
   * Find nodes by name (exact match or partial)
   * @param name
   * @param exact
   */
  findByName(name: string, exact = false): NodeInfo[] {
    return Array.from(this.nodes.values()).filter((node) =>
      exact ? node.name === name : node.name.includes(name)
    );
  }

  /**
   * Check if a node exists
   * @param nodeId
   */
  has(nodeId: string): boolean {
    return this.nodes.has(nodeId);
  }

  /**
   * Remove a node from the registry
   * @param nodeId
   */
  remove(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return;
    }

    // Remove from parent's children
    if (node.parentId) {
      const parent = this.nodes.get(node.parentId);
      if (parent) {
        parent.children = parent.children.filter((id) => id !== nodeId);
      }
    } else {
      // Remove from root nodes
      this.rootNodes = this.rootNodes.filter((id) => id !== nodeId);
    }

    // Remove all descendants
    const descendants = this.getDescendants(nodeId);
    for (const descendant of descendants) {
      this.nodes.delete(descendant.nodeId);
    }

    // Remove the node itself
    this.nodes.delete(nodeId);

    logger.debug(`Removed node: ${nodeId} and ${descendants.length} descendants`);
  }

  /**
   * Clear the entire registry
   */
  clear(): void {
    this.nodes.clear();
    this.rootNodes = [];
    logger.debug('Registry cleared');
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalNodes: number;
    rootNodes: number;
    nodesByType: Record<string, number>;
  } {
    const nodesByType: Record<string, number> = {};

    for (const node of this.nodes.values()) {
      nodesByType[node.type] = (nodesByType[node.type] ?? 0) + 1;
    }

    return {
      totalNodes: this.nodes.size,
      rootNodes: this.rootNodes.length,
      nodesByType
    };
  }

  /**
   * Export registry as JSON (for debugging/persistence)
   */
  toJSON(): string {
    return JSON.stringify(
      {
        nodes: Array.from(this.nodes.entries()),
        rootNodes: this.rootNodes
      },
      null,
      2
    );
  }

  /**
   * Import registry from JSON
   * @param json
   */
  fromJSON(json: string): void {
    try {
      const data = JSON.parse(json) as {
        nodes: [string, NodeInfo][];
        rootNodes: string[];
      };

      this.nodes = new Map(data.nodes);
      this.rootNodes = data.rootNodes;

      logger.info(`Imported ${this.nodes.size} nodes`);
    } catch (error) {
      logger.error('Failed to import JSON', error instanceof Error ? error : undefined);
    }
  }
}

/**
 * Singleton instance
 */
let registryInstance: NodeRegistry | null = null;

/**
 * Get the global node registry instance
 */
export function getNodeRegistry(): NodeRegistry {
  registryInstance ??= new NodeRegistry();
  return registryInstance;
}

/**
 * Reset the global registry (useful for testing)
 */
export function resetNodeRegistry(): void {
  if (registryInstance) {
    registryInstance.clear();
  }
  registryInstance = new NodeRegistry();
}
