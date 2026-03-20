/**
 * Error handling module
 *
 * Re-exports all error-related types and utilities.
 */

// New structured error codes
export {
  ErrorCode,
  createError,
  createErrorWithSuggestion,
  formatStructuredError,
  isStructuredError,
  type StructuredError
} from './error-codes.js';

// ═══════════════════════════════════════════════════════════════════════════
// Legacy Error Classes (for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Base error class for all tool execution errors
 */
export class ToolExecutionError extends Error {
  constructor(
    message: string,
    public readonly tool: string,
    public readonly input?: unknown,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ToolExecutionError';
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      tool: this.tool,
      input: this.input,
      cause: this.cause ? { name: this.cause.name, message: this.cause.message } : undefined,
      stack: this.stack
    };
  }
}

/**
 * Validation error - thrown when input validation fails
 */
export class ValidationError extends ToolExecutionError {
  constructor(
    message: string,
    tool: string,
    input?: unknown,
    public readonly validationErrors?: unknown
  ) {
    super(message, tool, input);
    this.name = 'ValidationError';
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      validationErrors: this.validationErrors
    };
  }
}

/**
 * Figma API error - thrown when Figma operations fail
 */
export class FigmaAPIError extends ToolExecutionError {
  constructor(
    message: string,
    tool: string,
    public readonly operation: string,
    input?: unknown,
    cause?: Error
  ) {
    super(message, tool, input, cause);
    this.name = 'FigmaAPIError';
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      operation: this.operation
    };
  }
}

/**
 * Network error - thrown when communication with Figma bridge fails
 */
export class NetworkError extends ToolExecutionError {
  constructor(
    message: string,
    tool: string,
    public readonly endpoint?: string,
    input?: unknown,
    cause?: Error
  ) {
    super(message, tool, input, cause);
    this.name = 'NetworkError';
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      endpoint: this.endpoint
    };
  }
}

/**
 * Configuration error - thrown when configuration is invalid
 */
export class ConfigurationError extends Error {
  constructor(
    message: string,
    public readonly key: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = 'ConfigurationError';
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      key: this.key,
      value: this.value,
      stack: this.stack
    };
  }
}

// Type guards
/**
 *
 * @param error
 */
export function isToolExecutionError(error: unknown): error is ToolExecutionError {
  return error instanceof ToolExecutionError;
}

/**
 *
 * @param error
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 *
 * @param error
 */
export function isFigmaAPIError(error: unknown): error is FigmaAPIError {
  return error instanceof FigmaAPIError;
}

/**
 *
 * @param error
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 *
 * @param error
 */
export function isConfigurationError(error: unknown): error is ConfigurationError {
  return error instanceof ConfigurationError;
}

/**
 * Wrap a generic error in a ToolExecutionError if needed
 * @param error
 * @param tool
 * @param input
 */
export function wrapError(error: unknown, tool: string, input?: unknown): ToolExecutionError {
  if (isToolExecutionError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new ToolExecutionError(error.message, tool, input, error);
  }

  return new ToolExecutionError(String(error), tool, input);
}
