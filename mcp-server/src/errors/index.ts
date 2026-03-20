/**
 * Error handling module
 *
 * Re-exports all error-related types and utilities.
 */

// New structured error codes
import { ErrorCode, createError, type StructuredError } from './error-codes.js';

export {
  ErrorCode,
  createError,
  createErrorWithSuggestion,
  formatStructuredError,
  isStructuredError,
  type StructuredError
} from './error-codes.js';

// ═══════════════════════════════════════════════════════════════════════════
// Tool Error Classes — integrated with structured ErrorCode system
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Base error class for all tool execution errors.
 * Carries an optional ErrorCode for machine-readable classification.
 */
export class ToolExecutionError extends Error {
  public readonly errorCode: ErrorCode;

  constructor(
    message: string,
    public readonly tool: string,
    public readonly input?: unknown,
    public readonly cause?: Error,
    errorCode?: ErrorCode
  ) {
    super(message);
    this.name = 'ToolExecutionError';
    this.errorCode = errorCode ?? ErrorCode.OP_FAILED;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.errorCode,
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
    public readonly validationErrors?: unknown,
    errorCode?: ErrorCode
  ) {
    super(message, tool, input, undefined, errorCode ?? ErrorCode.VAL_FAILED);
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
    cause?: Error,
    errorCode?: ErrorCode
  ) {
    super(message, tool, input, cause, errorCode ?? ErrorCode.OP_FAILED);
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
    cause?: Error,
    errorCode?: ErrorCode
  ) {
    super(message, tool, input, cause, errorCode ?? ErrorCode.CONN_FAILED);
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
    Error.captureStackTrace(this, this.constructor);
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

/**
 * Figma Bridge error - thrown when Figma bridge operations fail
 * Wraps a StructuredError for machine-readable error codes
 */
export class FigmaBridgeError extends Error {
  public readonly structuredError: StructuredError;

  constructor(errorOrMessage: StructuredError | string, legacyCode?: string) {
    if (typeof errorOrMessage === 'string') {
      // Legacy constructor support: (message, code)
      const code = (legacyCode as ErrorCode | undefined) ?? ErrorCode.SYS_INTERNAL;
      const structured = createError(code, errorOrMessage);
      super(errorOrMessage);
      this.structuredError = structured;
    } else {
      // New constructor: (StructuredError)
      super(errorOrMessage.message);
      this.structuredError = errorOrMessage;
    }
    this.name = 'FigmaBridgeError';
  }

  /** Machine-readable error code */
  get code(): ErrorCode {
    return this.structuredError.code;
  }

  /** Suggested action to resolve */
  get suggestion(): string | undefined {
    return this.structuredError.suggestion;
  }

  /** Additional error details */
  get details(): Record<string, unknown> | undefined {
    return this.structuredError.details;
  }
}

/**
 * Type guard for FigmaBridgeError
 * @param error
 */
export function isFigmaBridgeError(error: unknown): error is FigmaBridgeError {
  return error instanceof FigmaBridgeError;
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
