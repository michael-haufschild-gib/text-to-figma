/**
 * Structured Error Codes for Text-to-Figma
 *
 * Machine-readable error codes for programmatic error handling.
 * Each error code has a suggested user-facing message and recovery action.
 */

/**
 * Error code categories:
 * - CONN_* : Connection/network related
 * - NODE_* : Node operation errors
 * - VAL_*  : Validation errors
 * - OP_*   : Operation execution errors
 * - SYS_*  : System/internal errors
 */
export enum ErrorCode {
  // ═══════════════════════════════════════════════════════════════════════════
  // CONNECTION ERRORS (CONN_*)
  // ═══════════════════════════════════════════════════════════════════════════
  /** WebSocket not connected to Figma plugin */
  CONN_NOT_CONNECTED = 'CONN_NOT_CONNECTED',
  /** Connection attempt timed out */
  CONN_TIMEOUT = 'CONN_TIMEOUT',
  /** Connection was lost during operation */
  CONN_LOST = 'CONN_LOST',
  /** Failed to establish connection */
  CONN_FAILED = 'CONN_FAILED',

  // ═══════════════════════════════════════════════════════════════════════════
  // NODE ERRORS (NODE_*)
  // ═══════════════════════════════════════════════════════════════════════════
  /** Node with specified ID was not found */
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  /** Node type is invalid for the requested operation */
  NODE_INVALID_TYPE = 'NODE_INVALID_TYPE',
  /** Parent node is invalid or not a container */
  NODE_INVALID_PARENT = 'NODE_INVALID_PARENT',
  /** Node is locked and cannot be modified */
  NODE_LOCKED = 'NODE_LOCKED',

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION ERRORS (VAL_*)
  // ═══════════════════════════════════════════════════════════════════════════
  /** General validation failure */
  VAL_FAILED = 'VAL_FAILED',
  /** Invalid color format */
  VAL_INVALID_COLOR = 'VAL_INVALID_COLOR',
  /** Spacing value not on design grid */
  VAL_INVALID_SPACING = 'VAL_INVALID_SPACING',
  /** Font size not in type scale */
  VAL_INVALID_FONT_SIZE = 'VAL_INVALID_FONT_SIZE',
  /** Required parameter missing */
  VAL_MISSING_PARAM = 'VAL_MISSING_PARAM',
  /** Parameter value out of range */
  VAL_OUT_OF_RANGE = 'VAL_OUT_OF_RANGE',

  // ═══════════════════════════════════════════════════════════════════════════
  // OPERATION ERRORS (OP_*)
  // ═══════════════════════════════════════════════════════════════════════════
  /** Font failed to load */
  OP_FONT_LOAD_FAILED = 'OP_FONT_LOAD_FAILED',
  /** Operation timed out */
  OP_TIMEOUT = 'OP_TIMEOUT',
  /** Operation failed (generic) */
  OP_FAILED = 'OP_FAILED',
  /** Image load/processing failed */
  OP_IMAGE_FAILED = 'OP_IMAGE_FAILED',
  /** Export operation failed */
  OP_EXPORT_FAILED = 'OP_EXPORT_FAILED',

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM ERRORS (SYS_*)
  // ═══════════════════════════════════════════════════════════════════════════
  /** Internal error (unexpected) */
  SYS_INTERNAL = 'SYS_INTERNAL',
  /** Request queue is full */
  SYS_QUEUE_FULL = 'SYS_QUEUE_FULL',
  /** Circuit breaker is open */
  SYS_CIRCUIT_OPEN = 'SYS_CIRCUIT_OPEN',
  /** Unknown command type */
  SYS_UNKNOWN_COMMAND = 'SYS_UNKNOWN_COMMAND'
}

/**
 * Structured error with machine-readable code and helpful suggestions
 */
export interface StructuredError {
  /** Machine-readable error code */
  code: ErrorCode;
  /** Human-readable error message */
  message: string;
  /** Additional context about the error */
  details?: Record<string, unknown>;
  /** Suggested action to resolve the error */
  suggestion?: string;
}

/**
 * Map of error codes to default suggestions
 */
const ERROR_SUGGESTIONS: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.CONN_NOT_CONNECTED]:
    'Ensure Figma is open and the Text-to-Figma plugin is running. Check the plugin console for errors.',
  [ErrorCode.CONN_TIMEOUT]:
    'The connection attempt timed out. Try restarting the Figma plugin and WebSocket server.',
  [ErrorCode.CONN_LOST]:
    'Connection was lost. Ensure Figma is still open and try the operation again.',
  [ErrorCode.CONN_FAILED]:
    'Could not connect to Figma. Verify the WebSocket server is running on port 8080.',

  [ErrorCode.NODE_NOT_FOUND]:
    'The node ID may be stale. Use get_page_hierarchy to get current node IDs.',
  [ErrorCode.NODE_INVALID_TYPE]:
    'Check the node type - this operation may only work on specific node types (e.g., frames, text).',
  [ErrorCode.NODE_INVALID_PARENT]: 'The parent must be a frame or group that can contain children.',
  [ErrorCode.NODE_LOCKED]: 'Unlock the node in Figma before modifying it.',

  [ErrorCode.VAL_FAILED]: 'Check the input parameters match the expected format.',
  [ErrorCode.VAL_INVALID_COLOR]:
    'Use hex color format (e.g., #FF5500) or RGB object ({ r: 1, g: 0.5, b: 0 }).',
  [ErrorCode.VAL_INVALID_SPACING]:
    'Use 8pt grid values: 0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128.',
  [ErrorCode.VAL_INVALID_FONT_SIZE]: 'Use type scale values: 12, 16, 20, 24, 32, 40, 48, 64.',
  [ErrorCode.VAL_MISSING_PARAM]: 'Check that all required parameters are provided.',
  [ErrorCode.VAL_OUT_OF_RANGE]: 'Ensure the value is within the acceptable range.',

  [ErrorCode.OP_FONT_LOAD_FAILED]:
    'The font may not be installed. Try using Inter, Roboto, or Arial as fallbacks.',
  [ErrorCode.OP_TIMEOUT]:
    'The operation took too long. Try with a simpler operation or check Figma responsiveness.',
  [ErrorCode.OP_FAILED]:
    'The operation could not be completed. Check the error details for more information.',
  [ErrorCode.OP_IMAGE_FAILED]:
    'Failed to load or process the image. Verify the image URL is accessible.',
  [ErrorCode.OP_EXPORT_FAILED]:
    'Export failed. Ensure the node exists and has valid export settings.',

  [ErrorCode.SYS_INTERNAL]:
    'An unexpected error occurred. Please report this issue with the error details.',
  [ErrorCode.SYS_QUEUE_FULL]: 'Too many pending requests. Wait for current operations to complete.',
  [ErrorCode.SYS_CIRCUIT_OPEN]: 'Too many failures detected. Wait a moment before retrying.',
  [ErrorCode.SYS_UNKNOWN_COMMAND]:
    'The command is not recognized. Check available tools with list_tools.'
};

/**
 * Create a structured error with automatic suggestion lookup
 * @param code
 * @param message
 * @param details
 */
export function createError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): StructuredError {
  return {
    code,
    message,
    details,
    suggestion: ERROR_SUGGESTIONS[code]
  };
}

/**
 * Create a structured error with custom suggestion
 * @param code
 * @param message
 * @param suggestion
 * @param details
 */
export function createErrorWithSuggestion(
  code: ErrorCode,
  message: string,
  suggestion: string,
  details?: Record<string, unknown>
): StructuredError {
  return {
    code,
    message,
    details,
    suggestion
  };
}

/**
 * Check if an error is a StructuredError
 * @param error
 */
export function isStructuredError(error: unknown): error is StructuredError {
  if (error === null || error === undefined || typeof error !== 'object') {
    return false;
  }
  const e = error as Record<string, unknown>;
  return (
    typeof e.code === 'string' &&
    typeof e.message === 'string' &&
    Object.values(ErrorCode).includes(e.code as ErrorCode)
  );
}

/**
 * Format a structured error for display
 * @param error
 */
export function formatStructuredError(error: StructuredError): string {
  let text = `Error [${error.code}]: ${error.message}`;

  if (error.details && Object.keys(error.details).length > 0) {
    text += `\n\nDetails: ${JSON.stringify(error.details, null, 2)}`;
  }

  if (error.suggestion) {
    text += `\n\nSuggestion: ${error.suggestion}`;
  }

  return text;
}
