/**
 * Standardized tool result utilities
 *
 * Provides consistent result structures for tools that need
 * a structured success envelope (e.g., set_layer_order, align_nodes).
 */

/**
 * Standard tool result structure
 *
 * All tools return this structure on success.
 * On failure, tools throw exceptions which are caught by the MCP transport layer.
 */
export interface ToolResult<T = unknown> {
  /** Always true for returned results (failures throw exceptions) */
  success: true;
  /** Tool-specific result data */
  data: T;
  /** Human-readable message describing the operation */
  message: string;
  /** ISO timestamp when operation completed */
  timestamp: string;
}

/**
 * Create a standardized success result
 *
 * @param data - Tool-specific result data
 * @param message - Human-readable success message
 * @returns Standardized tool result
 */
export function createToolResult<T>(data: T, message: string): ToolResult<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  };
}
