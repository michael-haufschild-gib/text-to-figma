/**
 * CircuitBreaker — Extracted Module Unit Tests
 *
 * Tests the CircuitBreaker class and retry classification helpers
 * (isPreSendFailure, isNonRetryableValidationError) after extraction
 * from figma-bridge.ts into circuit-breaker.ts.
 *
 * Bug this catches:
 * - Extraction broke import paths or lost class behavior
 * - State machine transitions (CLOSED -> OPEN -> HALF_OPEN -> CLOSED)
 * - Retry classification misses new error types
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CircuitBreaker,
  isPreSendFailure,
  isNonRetryableValidationError
} from '../../mcp-server/src/circuit-breaker.js';
import { FigmaBridgeError, createError, ErrorCode } from '../../mcp-server/src/errors/index.js';

// Mock config to control CIRCUIT_BREAKER_ENABLED
vi.mock('../../mcp-server/src/config.js', () => ({
  getConfig: () => ({
    CIRCUIT_BREAKER_ENABLED: true
  })
}));

const ok = (): Promise<string> => Promise.resolve('ok');
const fail = (): Promise<never> => Promise.reject(new Error('fail'));
const recovered = (): Promise<string> => Promise.resolve('recovered');

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker(3, 1000);
  });

  it('starts in CLOSED state', () => {
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('stays CLOSED on successful executions', async () => {
    await breaker.execute(ok);
    await breaker.execute(ok);
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('opens after threshold consecutive failures', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fail)).rejects.toThrow('fail');
    }

    expect(breaker.getState()).toBe('OPEN');
  });

  it('rejects immediately when OPEN', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fail)).rejects.toThrow();
    }

    await expect(breaker.execute(ok)).rejects.toThrow('Circuit breaker is OPEN');
  });

  it('transitions to HALF_OPEN after reset timeout', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fail)).rejects.toThrow();
    }

    vi.useFakeTimers();
    vi.advanceTimersByTime(1100);

    const result = await breaker.execute(recovered);
    expect(result).toBe('recovered');

    vi.useRealTimers();
  });

  it('reset() returns to CLOSED state', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fail)).rejects.toThrow();
    }
    expect(breaker.getState()).toBe('OPEN');

    breaker.reset();
    expect(breaker.getState()).toBe('CLOSED');
  });
});

describe('isPreSendFailure', () => {
  it('returns true for ECONNREFUSED', () => {
    expect(isPreSendFailure(new Error('connect ECONNREFUSED 127.0.0.1:8080'))).toBe(true);
  });

  it('returns true for "not connected"', () => {
    expect(isPreSendFailure(new Error('not connected to Figma plugin'))).toBe(true);
  });

  it('returns true for circuit breaker OPEN message', () => {
    expect(isPreSendFailure(new Error('Circuit breaker is OPEN - service unavailable'))).toBe(true);
  });

  it('returns true for FigmaBridgeError with CONN_ code', () => {
    const err = new FigmaBridgeError(createError(ErrorCode.CONN_FAILED, 'Connection failed'));
    expect(isPreSendFailure(err)).toBe(true);
  });

  it('returns false for generic errors', () => {
    expect(isPreSendFailure(new Error('Something else'))).toBe(false);
  });
});

describe('isNonRetryableValidationError', () => {
  it('returns true for FigmaBridgeError with VAL_ code', () => {
    const err = new FigmaBridgeError(createError(ErrorCode.VAL_FAILED, 'Invalid schema'));
    expect(isNonRetryableValidationError(err)).toBe(true);
  });

  it('returns true for ZodError', () => {
    const err = new Error('Invalid input');
    err.name = 'ZodError';
    expect(isNonRetryableValidationError(err)).toBe(true);
  });

  it('returns true for ValidationError', () => {
    const err = new Error('Validation failed');
    err.name = 'ValidationError';
    expect(isNonRetryableValidationError(err)).toBe(true);
  });

  it('returns false for generic errors', () => {
    expect(isNonRetryableValidationError(new Error('Network error'))).toBe(false);
  });
});
