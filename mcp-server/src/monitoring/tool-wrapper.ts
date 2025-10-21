/**
 * Tool Monitoring Wrapper
 *
 * Provides standardized monitoring and error handling for all tools.
 * Wraps tool execution with logging, metrics, and error tracking.
 */

import { FigmaAPIError, NetworkError, ValidationError, wrapError } from '../errors/index.js';
import type { ErrorCategory, ErrorSeverity } from './error-tracker.js';
import { trackError } from './error-tracker.js';
import { getLogger } from './logger.js';
import { getMetrics } from './metrics.js';

/**
 * Get logger, metrics, and register tool counters
 */
function setupToolMonitoring(toolName: string) {
  const logger = getLogger().child({ tool: toolName });
  const metrics = getMetrics();

  // Register metrics
  const invocationCounter = metrics.counter('tool_invocations_total', 'Total tool invocations', [
    'tool'
  ]);
  const successCounter = metrics.counter('tool_success_total', 'Successful tool executions', [
    'tool'
  ]);
  const errorCounter = metrics.counter('tool_errors_total', 'Tool execution errors', [
    'tool',
    'error_type'
  ]);
  const durationHistogram = metrics.histogram(
    'tool_duration_ms',
    'Tool execution duration in milliseconds',
    [10, 50, 100, 200, 500, 1000, 2000, 5000]
  );

  return {
    logger,
    metrics: {
      invocationCounter,
      successCounter,
      errorCounter,
      durationHistogram
    }
  };
}

/**
 * Wraps tool execution with comprehensive monitoring
 */
export async function monitoredToolExecution<TInput, TResult>(
  toolName: string,
  input: TInput,
  executor: (validatedInput: TInput) => Promise<TResult>
): Promise<TResult> {
  const { logger, metrics } = setupToolMonitoring(toolName);
  const startTime = Date.now();

  // Increment invocation counter
  metrics.invocationCounter.inc(1, { tool: toolName });

  logger.info('Tool execution started', { input });

  try {
    // Execute the tool
    const result = await executor(input);
    const duration = Date.now() - startTime;

    // Record success metrics
    metrics.successCounter.inc(1, { tool: toolName });
    metrics.durationHistogram.observe(duration);

    logger.info('Tool execution succeeded', {
      duration,
      resultSize: JSON.stringify(result).length
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    metrics.durationHistogram.observe(duration);

    // Determine error type and severity
    let errorType: string = 'unknown';
    let severity: ErrorSeverity = 'medium';
    let category: ErrorCategory = 'internal';

    if (error instanceof ValidationError) {
      errorType = 'validation';
      severity = 'low';
      category = 'validation';
    } else if (error instanceof FigmaAPIError) {
      errorType = 'figma_api';
      severity = 'high';
      category = 'figma_api';
    } else if (error instanceof NetworkError) {
      errorType = 'network';
      severity = 'medium';
      category = 'network';
    } else if (error instanceof Error) {
      errorType = error.name;
    }

    // Record error metrics
    metrics.errorCounter.inc(1, { tool: toolName, error_type: errorType });

    // Log error
    logger.error('Tool execution failed', error as Error, { input, duration });

    // Track error
    trackError(error as Error, { tool: toolName, input }, severity, category);

    // Re-throw wrapped error if needed
    if (
      !(error instanceof ValidationError) &&
      !(error instanceof FigmaAPIError) &&
      !(error instanceof NetworkError)
    ) {
      throw wrapError(error, toolName, input);
    }

    throw error;
  }
}

/**
 * Simple wrapper for tools that don't need async execution
 */
export function monitoredToolExecutionSync<TInput, TResult>(
  toolName: string,
  input: TInput,
  executor: (validatedInput: TInput) => TResult
): TResult {
  const { logger, metrics } = setupToolMonitoring(toolName);
  const startTime = Date.now();

  // Increment invocation counter
  metrics.invocationCounter.inc(1, { tool: toolName });

  logger.info('Tool execution started', { input });

  try {
    // Execute the tool
    const result = executor(input);
    const duration = Date.now() - startTime;

    // Record success metrics
    metrics.successCounter.inc(1, { tool: toolName });
    metrics.durationHistogram.observe(duration);

    logger.info('Tool execution succeeded', {
      duration,
      resultSize: JSON.stringify(result).length
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    metrics.durationHistogram.observe(duration);

    // Determine error type
    let errorType: string = 'unknown';
    let severity: ErrorSeverity = 'medium';
    let category: ErrorCategory = 'internal';

    if (error instanceof ValidationError) {
      errorType = 'validation';
      severity = 'low';
      category = 'validation';
    } else if (error instanceof Error) {
      errorType = error.name;
    }

    // Record error metrics
    metrics.errorCounter.inc(1, { tool: toolName, error_type: errorType });

    // Log error
    logger.error('Tool execution failed', error as Error, { input, duration });

    // Track error
    trackError(error as Error, { tool: toolName, input }, severity, category);

    // Re-throw wrapped error
    if (!(error instanceof ValidationError)) {
      throw wrapError(error, toolName, input);
    }

    throw error;
  }
}
