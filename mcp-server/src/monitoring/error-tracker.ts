/**
 * Error Tracker
 *
 * Aggregates and reports errors for monitoring and debugging.
 */

import { randomUUID } from 'node:crypto';
import { clearInterval, setInterval } from 'node:timers';
import { z } from 'zod';

/**
 * Error severity levels
 */
export const errorSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type ErrorSeverity = z.infer<typeof errorSeveritySchema>;

/**
 * Error category
 */
export const errorCategorySchema = z.enum([
  'validation',
  'network',
  'figma_api',
  'internal',
  'user_input',
  'configuration',
  'unknown'
]);

export type ErrorCategory = z.infer<typeof errorCategorySchema>;

/**
 * Tracked error entry
 */
export interface TrackedError {
  id: string;
  timestamp: number;
  error: Error;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context?: Record<string, unknown>;
  fingerprint: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
}

/**
 * Error statistics
 */
export interface ErrorStatistics {
  total: number;
  byCategory: Record<ErrorCategory, number>;
  bySeverity: Record<ErrorSeverity, number>;
  uniqueErrors: number;
  mostCommon: Array<{ fingerprint: string; count: number; message: string }>;
}

/**
 * Error tracker configuration
 */
export const errorTrackerConfigSchema = z.object({
  maxErrors: z
    .number()
    .int()
    .positive()
    .default(1000)
    .describe('Maximum number of errors to track'),
  aggregationWindow: z
    .number()
    .int()
    .positive()
    .default(3600000)
    .describe('Time window for error aggregation in ms (default: 1 hour)'),
  pruneInterval: z
    .number()
    .int()
    .positive()
    .default(300000)
    .describe('Interval for automatic pruning in ms (default: 5 minutes)')
});

export type ErrorTrackerConfig = z.infer<typeof errorTrackerConfigSchema>;

/**
 * Generate error fingerprint for deduplication
 * @param error
 * @param context
 */
function generateFingerprint(error: Error, context?: Record<string, unknown>): string {
  const parts: string[] = [error.name, error.message];

  if (context?.operation !== undefined) {
    parts.push(String(context.operation));
  }

  return parts.join('|');
}

/**
 * Categorize error
 * @param error
 */
const CATEGORY_RULES: Array<{
  keywords: string[];
  nameKeywords?: string[];
  category: ErrorCategory;
}> = [
  {
    nameKeywords: ['validation'],
    keywords: ['invalid', 'required', 'schema', 'parse'],
    category: 'validation'
  },
  {
    nameKeywords: ['network', 'econnrefused'],
    keywords: ['econnrefused', 'socket hang up', 'websocket'],
    category: 'network'
  },
  { keywords: ['connection timeout', 'request timeout', 'timed out'], category: 'network' },
  { keywords: ['figma', 'node', 'frame', 'component'], category: 'figma_api' },
  { nameKeywords: ['typeerror', 'referenceerror'], keywords: [], category: 'internal' },
  { keywords: ['user', 'input'], category: 'user_input' },
  { keywords: ['config', 'configuration'], category: 'configuration' }
];

function categorizeError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    const nameMatch = rule.nameKeywords?.some((kw) => name.includes(kw)) === true;
    const msgMatch = rule.keywords.some((kw) => message.includes(kw));
    if (nameMatch || msgMatch) {
      return rule.category;
    }
  }

  return 'unknown';
}

/**
 * Determine error severity
 * @param error
 * @param category
 */
function determineSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
  // Critical errors
  if (error.name === 'FatalError' || error.message.includes('fatal')) {
    return 'critical';
  }

  // High severity
  if (category === 'internal' || category === 'figma_api') {
    return 'high';
  }

  // Medium severity
  if (category === 'network' || category === 'configuration') {
    return 'medium';
  }

  // Low severity
  return 'low';
}

/**
 * Error tracker implementation
 */
export class ErrorTracker {
  private errors: Map<string, TrackedError> = new Map();
  private readonly config: Required<ErrorTrackerConfig>;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<ErrorTrackerConfig>) {
    this.config = errorTrackerConfigSchema.parse(config ?? {});

    // Start automatic pruning timer to prevent memory leaks in long-running processes
    this.startPruneTimer();
  }

  /**
   * Start automatic pruning timer
   */
  private startPruneTimer(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
    }

    this.pruneTimer = setInterval(() => {
      this.pruneOldErrors();
    }, this.config.pruneInterval);

    // Don't keep the process alive just for pruning
    this.pruneTimer.unref();
  }

  /**
   * Stop automatic pruning timer (called during cleanup/destruction)
   */
  private stopPruneTimer(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
  }

  /**
   * Track an error
   * @param error
   * @param context
   * @param severity
   * @param category
   */
  track(
    error: Error,
    context?: Record<string, unknown>,
    severity?: ErrorSeverity,
    category?: ErrorCategory
  ): string {
    const now = Date.now();
    const fingerprint = generateFingerprint(error, context);
    const detectedCategory = category ?? categorizeError(error);
    const detectedSeverity = severity ?? determineSeverity(error, detectedCategory);

    // Check if we've seen this error before
    const existing = this.errors.get(fingerprint);

    if (existing) {
      // Update existing error
      existing.count++;
      existing.lastSeen = now;
      existing.context = { ...existing.context, ...context };

      return existing.id;
    }

    // Create new tracked error
    const id = `err_${randomUUID()}`;
    const tracked: TrackedError = {
      id,
      timestamp: now,
      error,
      severity: detectedSeverity,
      category: detectedCategory,
      context,
      fingerprint,
      count: 1,
      firstSeen: now,
      lastSeen: now
    };

    this.errors.set(fingerprint, tracked);

    // Prune old errors if needed
    if (this.errors.size > this.config.maxErrors) {
      this.pruneOldErrors();
    }

    return id;
  }

  /**
   * Get error by ID or fingerprint
   * @param idOrFingerprint
   */
  get(idOrFingerprint: string): TrackedError | undefined {
    // Try as fingerprint first
    const byFingerprint = this.errors.get(idOrFingerprint);
    if (byFingerprint) {
      return byFingerprint;
    }

    // Try as ID
    for (const error of this.errors.values()) {
      if (error.id === idOrFingerprint) {
        return error;
      }
    }

    return undefined;
  }

  /**
   * Get all tracked errors
   */
  getAll(): TrackedError[] {
    return Array.from(this.errors.values());
  }

  /**
   * Get errors by category
   * @param category
   */
  getByCategory(category: ErrorCategory): TrackedError[] {
    return Array.from(this.errors.values()).filter((e) => e.category === category);
  }

  /**
   * Get errors by severity
   * @param severity
   */
  getBySeverity(severity: ErrorSeverity): TrackedError[] {
    return Array.from(this.errors.values()).filter((e) => e.severity === severity);
  }

  /**
   * Get error statistics
   */
  getStatistics(): ErrorStatistics {
    const byCategory: Record<ErrorCategory, number> = {
      validation: 0,
      network: 0,
      figma_api: 0,
      internal: 0,
      user_input: 0,
      configuration: 0,
      unknown: 0
    };

    const bySeverity: Record<ErrorSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    for (const error of this.errors.values()) {
      byCategory[error.category] += error.count;
      bySeverity[error.severity] += error.count;
    }

    // Get most common errors
    const mostCommon = Array.from(this.errors.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((e) => ({
        fingerprint: e.fingerprint,
        count: e.count,
        message: e.error.message
      }));

    // Compute total from currently tracked errors (not the monotonic counter,
    // which drifts after pruning removes old entries)
    let total = 0;
    for (const error of this.errors.values()) {
      total += error.count;
    }

    return {
      total,
      byCategory,
      bySeverity,
      uniqueErrors: this.errors.size,
      mostCommon
    };
  }

  /**
   * Clear all tracked errors
   */
  clear(): void {
    this.errors.clear();
    this.stopPruneTimer();
    this.startPruneTimer(); // Restart timer for future errors
  }

  /**
   * Destroy the error tracker and clean up resources
   */
  destroy(): void {
    this.stopPruneTimer();
    this.errors.clear();
  }

  /**
   * Prune errors older than aggregation window
   */
  private pruneOldErrors(): void {
    const now = Date.now();
    const cutoff = now - this.config.aggregationWindow;

    for (const [fingerprint, error] of this.errors.entries()) {
      if (error.lastSeen < cutoff) {
        this.errors.delete(fingerprint);
      }
    }

    // If still over limit, remove least frequent errors
    if (this.errors.size > this.config.maxErrors) {
      const sorted = Array.from(this.errors.entries()).sort(([, a], [, b]) => a.count - b.count);

      const toRemove = sorted.slice(0, sorted.length - this.config.maxErrors);
      for (const [fingerprint] of toRemove) {
        this.errors.delete(fingerprint);
      }
    }
  }

  /**
   * Export errors as JSON
   */
  toJSON(): unknown {
    return {
      statistics: this.getStatistics(),
      errors: Array.from(this.errors.values()).map((e) => ({
        id: e.id,
        timestamp: e.timestamp,
        message: e.error.message,
        name: e.error.name,
        severity: e.severity,
        category: e.category,
        count: e.count,
        firstSeen: e.firstSeen,
        lastSeen: e.lastSeen,
        context: e.context
      }))
    };
  }
}

/**
 * Global error tracker
 */
let globalTracker: ErrorTracker | null = null;

/**
 * Get global error tracker
 * @param config
 */
export function getErrorTracker(config?: ErrorTrackerConfig): ErrorTracker {
  globalTracker ??= new ErrorTracker(config);
  return globalTracker;
}

/**
 * Reset global error tracker
 */
export function resetErrorTracker(): void {
  if (globalTracker) {
    globalTracker.destroy();
  }
  globalTracker = null;
}

/**
 * Convenience function to track error
 * @param error
 * @param context
 * @param severity
 * @param category
 */
export function trackError(
  error: Error,
  context?: Record<string, unknown>,
  severity?: ErrorSeverity,
  category?: ErrorCategory
): string {
  return getErrorTracker().track(error, context, severity, category);
}
