/**
 * Structured logging utility for production MCP server
 *
 * Provides consistent, structured logging across all tools
 * with proper log levels and context.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

/**
 * Logger configuration
 */
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[LOG_LEVEL as LogLevel];
}

/**
 * Format a log message with context
 */
function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

/**
 * Structured logger
 *
 * CRITICAL MCP REQUIREMENT: All logs MUST go to stderr to avoid contaminating
 * the JSON-RPC message stream on stdout. Using console.error for all levels.
 */
export const logger = {
  /**
   * Debug-level logging (detailed execution flow)
   */
  debug(message: string, context?: LogContext): void {
    if (shouldLog('debug')) {
      // MCP: Must use stderr (console.error) to avoid stdout contamination
      console.error(formatLog('debug', message, context));
    }
  },

  /**
   * Info-level logging (general operations)
   */
  info(message: string, context?: LogContext): void {
    if (shouldLog('info')) {
      // MCP: Must use stderr (console.error) to avoid stdout contamination
      console.error(formatLog('info', message, context));
    }
  },

  /**
   * Warning-level logging (recoverable issues)
   */
  warn(message: string, context?: LogContext): void {
    if (shouldLog('warn')) {
      // MCP: Must use stderr (console.error) to avoid stdout contamination
      console.error(formatLog('warn', message, context));
    }
  },

  /**
   * Error-level logging (failures and exceptions)
   */
  error(message: string, context?: LogContext): void {
    if (shouldLog('error')) {
      console.error(formatLog('error', message, context));
    }
  }
};

/**
 * Create a scoped logger for a specific component
 *
 * @example
 * ```typescript
 * const log = createScopedLogger('figma-bridge');
 * log.info('Connected to Figma'); // [timestamp] [INFO] [figma-bridge] Connected to Figma
 * ```
 */
export function createScopedLogger(scope: string) {
  return {
    debug: (message: string, context?: LogContext) =>
      logger.debug(`[${scope}] ${message}`, context),
    info: (message: string, context?: LogContext) => logger.info(`[${scope}] ${message}`, context),
    warn: (message: string, context?: LogContext) => logger.warn(`[${scope}] ${message}`, context),
    error: (message: string, context?: LogContext) => logger.error(`[${scope}] ${message}`, context)
  };
}
