/**
 * Circuit Breaker — Prevents cascading failures when the Figma plugin
 * is unresponsive. Extracted from figma-bridge.ts for module size limits.
 */

import { getConfig } from './config.js';
import { ErrorCode, FigmaBridgeError, createError } from './errors/index.js';

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private static readonly HALF_OPEN_SUCCESS_THRESHOLD = 2;

  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  private halfOpenProbeInFlight = false;

  constructor(
    private readonly threshold: number,
    private readonly resetTimeout: number
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const config = getConfig();

    if (!config.CIRCUIT_BREAKER_ENABLED) {
      return fn();
    }

    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        if (this.halfOpenProbeInFlight) {
          throw new FigmaBridgeError(
            createError(
              ErrorCode.SYS_CIRCUIT_OPEN,
              'Circuit breaker is HALF_OPEN - probe in progress'
            )
          );
        }
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        this.halfOpenProbeInFlight = true;
      } else {
        throw new FigmaBridgeError(
          createError(ErrorCode.SYS_CIRCUIT_OPEN, 'Circuit breaker is OPEN - service unavailable')
        );
      }
    } else if (this.state === CircuitState.HALF_OPEN && this.halfOpenProbeInFlight) {
      throw new FigmaBridgeError(
        createError(ErrorCode.SYS_CIRCUIT_OPEN, 'Circuit breaker is HALF_OPEN - probe in progress')
      );
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.halfOpenProbeInFlight = false;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= CircuitBreaker.HALF_OPEN_SUCCESS_THRESHOLD) {
        this.state = CircuitState.CLOSED;
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.halfOpenProbeInFlight = false;

    if (this.state === CircuitState.HALF_OPEN || this.failures >= this.threshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successCount = 0;
    this.halfOpenProbeInFlight = false;
  }
}

/** True when the failure happened before the request reached the plugin (safe to retry). */
export function isPreSendFailure(error: Error): boolean {
  return (
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('not connected') ||
    error.message.includes('Circuit breaker is OPEN') ||
    (error instanceof FigmaBridgeError && error.code.startsWith('CONN_'))
  );
}

export function isNonRetryableValidationError(error: Error): boolean {
  return (
    (error instanceof FigmaBridgeError && error.code.startsWith('VAL_')) ||
    error.name === 'ZodError' ||
    error.name === 'ValidationError'
  );
}
