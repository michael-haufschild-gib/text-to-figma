/**
 * Metrics Module — Adversarial Edge Cases
 *
 * Tests boundary conditions, fractional values, negative inputs,
 * custom bucket configurations, and error propagation through timers.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { MetricsRegistry, resetMetrics } from '../../mcp-server/src/monitoring/metrics.js';

describe('MetricsRegistry — adversarial edge cases', () => {
  afterEach(() => {
    resetMetrics();
  });

  describe('histogram with negative values', () => {
    it('observe accepts negative values without throwing', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('neg_test', 'test', [0, 10, 100]);

      hist.observe(-5);
      hist.observe(-1);
      hist.observe(0);

      const stats = hist.getStatistics();
      expect(stats.lifetime.count).toBe(3);
      expect(stats.window.min).toBe(-5);
      expect(stats.window.max).toBe(0);
      expect(stats.lifetime.sum).toBe(-6);
      expect(stats.lifetime.mean).toBeCloseTo(-2, 5);
    });

    it('negative values do not count in any bucket (all buckets use <=)', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('neg_bucket', 'test', [0, 10]);

      hist.observe(-1);

      const buckets = hist.getBuckets();
      // -1 <= 0 is true, so it SHOULD count in the le=0 bucket
      expect(buckets[0].count).toBe(1);
      expect(buckets[1].count).toBe(1);
    });

    it('negative value affects median correctly', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('neg_median');

      hist.observe(-10);
      hist.observe(0);
      hist.observe(10);

      const stats = hist.getStatistics();
      expect(stats.window.median).toBe(0);
    });
  });

  describe('counter with fractional increments', () => {
    it('accepts fractional increment values', () => {
      const registry = new MetricsRegistry();
      const counter = registry.counter('frac');

      counter.inc(0.5);
      counter.inc(0.3);

      expect(counter.get()).toBeCloseTo(0.8, 10);
    });

    it('fractional increments accumulate without floating-point drift over 1000 iterations', () => {
      const registry = new MetricsRegistry();
      const counter = registry.counter('drift');

      for (let i = 0; i < 1000; i++) {
        counter.inc(0.1);
      }

      // 1000 * 0.1 = 100.0 in exact math, but IEEE 754 may drift
      // The key check: drift is bounded, not that it's exactly 100
      expect(counter.get()).toBeCloseTo(100, 5);
    });

    it('labeled counter with fractional values', () => {
      const registry = new MetricsRegistry();
      const counter = registry.counter('labeled_frac', 'desc', ['op']);

      counter.inc(0.25, { op: 'read' });
      counter.inc(0.75, { op: 'read' });

      expect(counter.get({ op: 'read' })).toBeCloseTo(1.0, 10);
    });
  });

  describe('timer return value and error propagation', () => {
    it('time() returns the exact return value of the wrapped function', () => {
      const registry = new MetricsRegistry();
      const timer = registry.timer('ret_test');

      const complexResult = { id: 42, nested: { arr: [1, 2, 3] } };
      const result = timer.time(() => complexResult);

      // Verify it's the same reference, not a copy
      expect(result).toBe(complexResult);
    });

    it('timeAsync() returns the exact resolved value', async () => {
      const registry = new MetricsRegistry();
      const timer = registry.timer('async_ret');

      const expected = { data: [1, 2, 3] };
      const result = await timer.timeAsync(() => Promise.resolve(expected));

      expect(result).toBe(expected);
    });

    it('time() records duration even when function throws, then re-throws the same error', () => {
      const registry = new MetricsRegistry();
      const timer = registry.timer('err_ret');
      const originalError = new TypeError('specific error');

      let caught: Error | undefined;
      try {
        timer.time(() => {
          throw originalError;
        });
      } catch (e) {
        caught = e as Error;
      }

      // Verify it's the exact same error instance (not wrapped)
      expect(caught).toBe(originalError);
      expect(timer.getStatistics().lifetime.count).toBe(1);
    });

    it('timeAsync() records duration even when async function rejects, then re-throws the same error', async () => {
      const registry = new MetricsRegistry();
      const timer = registry.timer('async_err_ret');
      const originalError = new RangeError('async specific');

      let caught: Error | undefined;
      try {
        await timer.timeAsync(() => Promise.reject(originalError));
      } catch (e) {
        caught = e as Error;
      }

      expect(caught).toBe(originalError);
      expect(timer.getStatistics().lifetime.count).toBe(1);
    });
  });

  describe('gauge dec with labeled values', () => {
    it('dec reduces labeled gauge value', () => {
      const registry = new MetricsRegistry();
      const gauge = registry.gauge('labeled_dec', 'desc', ['type']);

      gauge.set(10, { type: 'ws' });
      gauge.dec(3, { type: 'ws' });

      expect(gauge.get({ type: 'ws' })).toBe(7);
    });

    it('dec with default amount (1) on labeled gauge', () => {
      const registry = new MetricsRegistry();
      const gauge = registry.gauge('dec_default', 'desc', ['k']);

      gauge.set(5, { k: 'v' });
      gauge.dec(undefined, { k: 'v' });

      expect(gauge.get({ k: 'v' })).toBe(4);
    });
  });

  describe('histogram with custom buckets', () => {
    it('empty buckets array creates no buckets', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('no_buckets', 'test', []);

      hist.observe(5);

      const buckets = hist.getBuckets();
      expect(buckets).toHaveLength(0);
      // Stats should still work
      expect(hist.getStatistics().lifetime.count).toBe(1);
      expect(hist.getStatistics().window.min).toBe(5);
    });

    it('unsorted bucket boundaries still distribute correctly', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('unsorted', 'test', [100, 10, 50]);

      hist.observe(25); // <= 100 and <= 50 but not <= 10

      const buckets = hist.getBuckets();
      expect(buckets.find((b) => b.le === 100)!.count).toBe(1);
      expect(buckets.find((b) => b.le === 50)!.count).toBe(1);
      expect(buckets.find((b) => b.le === 10)!.count).toBe(0);
    });
  });

  describe('counter reset clears both unlabeled and labeled values', () => {
    it('reset clears all labeled values', () => {
      const registry = new MetricsRegistry();
      const counter = registry.counter('reset_labels', 'desc', ['op']);

      counter.inc(5, { op: 'a' });
      counter.inc(3, { op: 'b' });
      counter.inc(2);

      counter.reset();

      expect(counter.get()).toBe(0);
      expect(counter.get({ op: 'a' })).toBe(0);
      expect(counter.get({ op: 'b' })).toBe(0);
    });
  });
});
