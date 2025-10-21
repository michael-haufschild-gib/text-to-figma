/**
 * Tool Registry
 *
 * Central registry for all tool handlers. Provides singleton pattern
 * for global tool storage with duplicate detection.
 */

import type { ToolDefinition, ToolHandler } from './tool-handler.js';

/**
 * Tool Registry Class
 *
 * Manages registration and retrieval of tool handlers. Uses Map for
 * O(1) lookup performance. Enforces unique tool names.
 *
 * @example
 * ```typescript
 * const registry = new ToolRegistry();
 *
 * // Register tool
 * registry.register(createFrameHandler);
 *
 * // Retrieve tool
 * const handler = registry.get('create_frame');
 *
 * // List all tools
 * const definitions = registry.listDefinitions();
 * ```
 *
 * @remarks
 * - Singleton pattern via getToolRegistry()
 * - Duplicate registration throws error
 * - Thread-safe for synchronous registration
 */
export class ToolRegistry {
  /** Internal storage for tool handlers */
  private handlers = new Map<string, ToolHandler<any, any>>();

  /**
   * Register a tool handler
   *
   * @param handler - Tool handler to register
   * @throws {Error} If tool with same name already registered
   *
   * @example
   * ```typescript
   * registry.register(createFrameHandler);
   * registry.register(setFillsHandler);
   * ```
   */
  register<TInput, TResult>(handler: ToolHandler<TInput, TResult>): void {
    if (this.handlers.has(handler.name)) {
      throw new Error(`Tool '${handler.name}' is already registered`);
    }
    this.handlers.set(handler.name, handler);
  }

  /**
   * Get tool handler by name
   *
   * @param name - Tool name to retrieve
   * @returns Tool handler if found, undefined otherwise
   *
   * @example
   * ```typescript
   * const handler = registry.get('create_frame');
   * if (handler) {
   *   const result = await handler.execute(input);
   * }
   * ```
   */
  get(name: string): ToolHandler<any, any> | undefined {
    return this.handlers.get(name);
  }

  /**
   * Get all registered tool handlers
   *
   * @returns Array of all tool handlers
   *
   * @example
   * ```typescript
   * const all = registry.getAll();
   * console.log(`Registered ${all.length} tools`);
   * ```
   */
  getAll(): ToolHandler<any, any>[] {
    return Array.from(this.handlers.values());
  }

  /**
   * List all tool definitions for MCP ListTools response
   *
   * @returns Array of tool definitions
   *
   * @example
   * ```typescript
   * server.setRequestHandler(ListToolsRequestSchema, async () => {
   *   const registry = getToolRegistry();
   *   return { tools: registry.listDefinitions() };
   * });
   * ```
   */
  listDefinitions(): ToolDefinition[] {
    return Array.from(this.handlers.values()).map((h) => h.definition);
  }

  /**
   * Clear all registered tools (primarily for testing)
   *
   * @remarks
   * Use with caution - mainly for test isolation
   */
  clear(): void {
    this.handlers.clear();
  }
}

/** Global singleton instance */
let globalRegistry: ToolRegistry | null = null;

/**
 * Get the global tool registry (singleton)
 *
 * Creates registry on first call, returns existing instance on subsequent calls.
 *
 * @returns The global ToolRegistry instance
 *
 * @example
 * ```typescript
 * const registry = getToolRegistry();
 * registry.register(myToolHandler);
 * ```
 *
 * @remarks
 * Singleton pattern ensures all parts of application share same registry
 */
export function getToolRegistry(): ToolRegistry {
  if (!globalRegistry) {
    globalRegistry = new ToolRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global registry (for testing only)
 *
 * @remarks
 * Creates a fresh registry instance. Use only in test teardown.
 *
 * @example
 * ```typescript
 * afterEach(() => {
 *   resetToolRegistry();
 * });
 * ```
 */
export function resetToolRegistry(): void {
  globalRegistry = null;
}
