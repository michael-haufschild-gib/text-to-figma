/**
 * Structured Logger
 *
 * Provides structured logging with levels and context.
 */

import { z } from 'zod';

/**
 * Log levels
 */
export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error', 'fatal']);
export type LogLevel = z.infer<typeof logLevelSchema>;

/**
 * Numeric log level values
 */
const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4
};

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger configuration
 */
export const loggerConfigSchema = z.object({
  level: logLevelSchema.default('info').describe('Minimum log level to output'),
  pretty: z.boolean().default(false).describe('Enable pretty printing for development'),
  includeTimestamp: z.boolean().default(true).describe('Include timestamp in logs'),
  includeContext: z.boolean().default(true).describe('Include context in logs')
});

export type LoggerConfig = z.infer<typeof loggerConfigSchema>;

/**
 * Structured logger implementation
 */
export class Logger {
  private readonly config: Required<LoggerConfig>;
  private readonly context: Record<string, unknown>;

  constructor(config?: Partial<LoggerConfig>, context: Record<string, unknown> = {}) {
    this.config = loggerConfigSchema.parse(config ?? {});
    this.context = context;
  }

  /**
   * Create child logger with additional context
   */
  child(context: Record<string, unknown>): Logger {
    return new Logger(this.config, { ...this.context, ...context });
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level: 'error',
      message,
      context: { ...this.context, ...context }
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    this.write(entry);
  }

  /**
   * Log fatal message
   */
  fatal(message: string, error?: Error, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level: 'fatal',
      message,
      context: { ...this.context, ...context }
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    this.write(entry);
  }

  /**
   * Core log method
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    // Check if log level is enabled
    if (LOG_LEVEL_VALUES[level] < LOG_LEVEL_VALUES[this.config.level]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message
    };

    if (this.config.includeContext && (this.context || context)) {
      entry.context = { ...this.context, ...context };
    }

    this.write(entry);
  }

  /**
   * Write log entry to output
   */
  private write(entry: LogEntry): void {
    if (this.config.pretty) {
      this.writePretty(entry);
    } else {
      this.writeJson(entry);
    }
  }

  /**
   * Write pretty-formatted log
   */
  private writePretty(entry: LogEntry): void {
    const timestamp = this.config.includeTimestamp
      ? `[${new Date(entry.timestamp).toISOString()}]`
      : '';

    const level = entry.level.toUpperCase().padEnd(5);
    const levelColor = this.getLevelColor(entry.level);

    let output = `${timestamp} ${levelColor}${level}\x1b[0m ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      output += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`;
    }

    if (entry.error) {
      output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        output += `\n${entry.error.stack}`;
      }
    }

    // Use stderr for errors and warnings, stdout for others
    if (entry.level === 'error' || entry.level === 'fatal' || entry.level === 'warn') {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  /**
   * Write JSON-formatted log
   */
  private writeJson(entry: LogEntry): void {
    const json = JSON.stringify(entry);

    // Use stderr for errors and warnings, stdout for others
    if (entry.level === 'error' || entry.level === 'fatal' || entry.level === 'warn') {
      console.error(json);
    } else {
      console.log(json);
    }
  }

  /**
   * Get ANSI color code for log level
   */
  private getLevelColor(level: LogLevel): string {
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
      fatal: '\x1b[35m'  // Magenta
    };
    return colors[level];
  }

  /**
   * Update logger configuration
   */
  setConfig(config: Partial<LoggerConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}

/**
 * Global logger instance
 */
let globalLogger: Logger | null = null;

/**
 * Get global logger
 */
export function getLogger(config?: LoggerConfig): Logger {
  if (!globalLogger) {
    globalLogger = new Logger(config);
  }
  return globalLogger;
}

/**
 * Reset global logger
 */
export function resetLogger(): void {
  globalLogger = null;
}

/**
 * Create scoped logger
 */
export function createLogger(name: string, config?: LoggerConfig): Logger {
  return new Logger(config, { scope: name });
}
