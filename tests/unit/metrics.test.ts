/**
 * Metrics Module Unit Tests
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  MetricsRegistry,
  getMetrics,
  resetMetrics
} from '../../mcp-server/src/monitoring/metrics.js';

describe('MetricsRegistry', () => {
  afterEach(() => {
    resetMetrics();
  });

  describe('counter', () => {
    it('increments and returns value', () => {
      const registry = new MetricsRegistry();
      const counter = registry.counter('requests');
      counter.inc();
      counter.inc(5);
      expect(counter.get()).toBe(6);
    });

    it('rejects negative increments', () => {
      const registry = new MetricsRegistry();
      const counter = registry.counter('test');
      expect(() => counter.inc(-1)).toThrow('Counter can only increase');
    });

    it('supports labeled counters', () => {
      const registry = new MetricsRegistry();
      const counter = registry.counter('http_requests', 'Request count', ['method']);
      counter.inc(1, { method: 'GET' });
      counter.inc(2, { method: 'POST' });
      expect(counter.get({ method: 'GET' })).toBe(1);
      expect(counter.get({ method: 'POST' })).toBe(2);
    });

    it('returns existing counter if same name registered twice', () => {
      const registry = new MetricsRegistry();
      const a = registry.counter('test');
      a.inc(5);
      const b = registry.counter('test');
      expect(b.get()).toBe(5);
    });
  });

  describe('gauge', () => {
    it('sets and retrieves value', () => {
      const registry = new MetricsRegistry();
      const gauge = registry.gauge('connections');
      gauge.set(42);
      expect(gauge.get()).toBe(42);
    });

    it('increments and decrements', () => {
      const registry = new MetricsRegistry();
      const gauge = registry.gauge('active');
      gauge.inc(3);
      gauge.dec(1);
      expect(gauge.get()).toBe(2);
    });
  });

  describe('histogram', () => {
    it('observes values and computes statistics', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('latency');

      hist.observe(0.1);
      hist.observe(0.2);
      hist.observe(0.3);
      hist.observe(0.4);
      hist.observe(0.5);

      const stats = hist.getStatistics();
      expect(stats.count).toBe(5);
      expect(stats.min).toBe(0.1);
      expect(stats.max).toBe(0.5);
      expect(stats.mean).toBeCloseTo(0.3, 5);
      expect(stats.median).toBeCloseTo(0.3, 5);
    });

    it('returns zeroes for empty histogram', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('empty');
      const stats = hist.getStatistics();
      expect(stats.count).toBe(0);
      expect(stats.sum).toBe(0);
    });
  });

  describe('timer', () => {
    it('measures synchronous function duration', () => {
      const registry = new MetricsRegistry();
      const timer = registry.timer('op_duration');

      const result = timer.time(() => 42);

      expect(result).toBe(42);
      const stats = timer.getStatistics();
      expect(stats.count).toBe(1);
      // Duration may be 0 for trivial work due to Date.now() granularity
      expect(stats.sum).toBeGreaterThanOrEqual(0);
    });

    it('measures async function duration', async () => {
      const registry = new MetricsRegistry();
      const timer = registry.timer('async_op');

      await timer.timeAsync(async () => {
        await new Promise((r) => setTimeout(r, 5));
        return 'done';
      });

      const stats = timer.getStatistics();
      expect(stats.count).toBe(1);
    });
  });

  describe('getMetrics singleton', () => {
    it('returns registered metrics', () => {
      const registry = getMetrics();
      registry.counter('test_counter', 'A test counter');
      const metrics = registry.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics.find((m) => m.name === 'test_counter')?.type).toBe('counter');
    });
  });

  describe('toJSON', () => {
    it('exports all metrics as JSON', () => {
      const registry = new MetricsRegistry();
      registry.counter('c1').inc(5);
      registry.gauge('g1').set(10);

      const json = registry.toJSON();
      expect((json.c1 as Record<string, unknown>).value).toBe(5);
      expect((json.g1 as Record<string, unknown>).value).toBe(10);
    });
  });
});

describe('MetricsRegistry edge cases', () => {
  afterEach(() => {
    resetMetrics();
  });

  describe('counter edge cases', () => {
    it('inc with zero does not change value', () => {
      const registry = new MetricsRegistry();
      const counter = registry.counter('test');
      counter.inc(0);
      expect(counter.get()).toBe(0);
    });

    it('inc defaults to 1', () => {
      const registry = new MetricsRegistry();
      const counter = registry.counter('test');
      counter.inc();
      expect(counter.get()).toBe(1);
    });

    it('labeled counter returns 0 for unknown label', () => {
      const registry = new MetricsRegistry();
      const counter = registry.counter('test', 'desc', ['method']);
      counter.inc(1, { method: 'GET' });
      expect(counter.get({ method: 'DELETE' })).toBe(0);
    });
  });

  describe('gauge edge cases', () => {
    it('can go negative', () => {
      const registry = new MetricsRegistry();
      const gauge = registry.gauge('test');
      gauge.dec(5);
      expect(gauge.get()).toBe(-5);
    });

    it('set overwrites previous value', () => {
      const registry = new MetricsRegistry();
      const gauge = registry.gauge('test');
      gauge.set(100);
      gauge.set(42);
      expect(gauge.get()).toBe(42);
    });
  });

  describe('histogram edge cases', () => {
    it('handles single observation', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('test');
      hist.observe(5);

      const stats = hist.getStatistics();
      expect(stats.count).toBe(1);
      expect(stats.min).toBe(5);
      expect(stats.max).toBe(5);
      expect(stats.mean).toBe(5);
      expect(stats.median).toBe(5);
    });

    it('handles large dataset', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('test');
      for (let i = 1; i <= 100; i++) {
        hist.observe(i);
      }

      const stats = hist.getStatistics();
      expect(stats.count).toBe(100);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(100);
      expect(stats.mean).toBeCloseTo(50.5, 1);
    });
  });

  describe('timer edge cases', () => {
    it('propagates errors from timed function', () => {
      const registry = new MetricsRegistry();
      const timer = registry.timer('test');

      expect(() =>
        timer.time(() => {
          throw new Error('boom');
        })
      ).toThrow('boom');
    });

    it('propagates async errors from timed function', async () => {
      const registry = new MetricsRegistry();
      const timer = registry.timer('test');

      await expect(
        timer.timeAsync(() => {
          throw new Error('async boom');
        })
      ).rejects.toThrow('async boom');
    });
  });

  describe('registry edge cases', () => {
    it('getMetrics includes type information', () => {
      const registry = new MetricsRegistry();
      registry.counter('c');
      registry.gauge('g');
      registry.histogram('h');

      const metrics = registry.getMetrics();
      expect(metrics.find((m) => m.name === 'c')?.type).toBe('counter');
      expect(metrics.find((m) => m.name === 'g')?.type).toBe('gauge');
      expect(metrics.find((m) => m.name === 'h')?.type).toBe('histogram');
    });
  });

  describe('histogram percentile calculation', () => {
    it('median of even count is average of middle two', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('even_test');
      hist.observe(1);
      hist.observe(2);
      hist.observe(3);
      hist.observe(4);

      const stats = hist.getStatistics();
      expect(stats.count).toBe(4);
      expect(stats.median).toBeCloseTo(2.5, 5);
    });

    it('median of odd count is the middle value', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('odd_test');
      hist.observe(10);
      hist.observe(20);
      hist.observe(30);

      const stats = hist.getStatistics();
      expect(stats.median).toBeCloseTo(20, 5);
    });

    it('histogram with identical values', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('same_test');
      for (let i = 0; i < 10; i++) {
        hist.observe(42);
      }

      const stats = hist.getStatistics();
      expect(stats.min).toBe(42);
      expect(stats.max).toBe(42);
      expect(stats.mean).toBe(42);
      expect(stats.median).toBe(42);
    });

    it('histogram mean is sum/count', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('mean_test');
      hist.observe(10);
      hist.observe(20);
      hist.observe(30);

      const stats = hist.getStatistics();
      expect(stats.sum).toBe(60);
      expect(stats.mean).toBeCloseTo(20, 5);
    });
  });

  describe('timer records duration even on error', () => {
    it('records observation even when function throws', () => {
      const registry = new MetricsRegistry();
      const timer = registry.timer('error_timer');

      expect(() =>
        timer.time(() => {
          throw new Error('boom');
        })
      ).toThrow('boom');

      const stats = timer.getStatistics();
      expect(stats.count).toBe(1);
    });

    it('records observation even when async function rejects', async () => {
      const registry = new MetricsRegistry();
      const timer = registry.timer('async_error_timer');

      await expect(
        timer.timeAsync(() => {
          throw new Error('async boom');
        })
      ).rejects.toThrow('async boom');

      const stats = timer.getStatistics();
      expect(stats.count).toBe(1);
    });
  });

  describe('counter with multiple label combinations', () => {
    it('tracks separate counts per label set', () => {
      const registry = new MetricsRegistry();
      const counter = registry.counter('http', 'desc', ['method', 'status']);

      counter.inc(1, { method: 'GET', status: '200' });
      counter.inc(2, { method: 'GET', status: '200' });
      counter.inc(1, { method: 'POST', status: '201' });

      expect(counter.get({ method: 'GET', status: '200' })).toBe(3);
      expect(counter.get({ method: 'POST', status: '201' })).toBe(1);
      expect(counter.get({ method: 'DELETE', status: '404' })).toBe(0);
    });
  });

  describe('gauge labeled', () => {
    it('supports labeled gauges', () => {
      const registry = new MetricsRegistry();
      const gauge = registry.gauge('connections', 'desc', ['type']);

      gauge.set(5, { type: 'ws' });
      gauge.set(10, { type: 'http' });

      expect(gauge.get({ type: 'ws' })).toBe(5);
      expect(gauge.get({ type: 'http' })).toBe(10);
    });
  });
});

describe('MetricsRegistry histogram advanced', () => {
  afterEach(() => {
    resetMetrics();
  });

  describe('histogram MAX_VALUES eviction', () => {
    it('evicts oldest values when exceeding 10000 observations', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('eviction_test', 'test', [100, 200, 500]);

      // Observe 10050 values: first 50 are 999, rest are 1
      for (let i = 0; i < 50; i++) {
        hist.observe(999);
      }
      for (let i = 0; i < 10001; i++) {
        hist.observe(1);
      }

      const stats = hist.getStatistics();
      // count tracks all observations monotonically
      expect(stats.count).toBe(10051);
      // But min/max/median are computed from the retained values window
      // The 999 values should have been evicted since only last 10000 are kept
      expect(stats.max).toBe(1);
      expect(stats.min).toBe(1);
    });
  });

  describe('histogram p95 and p99', () => {
    it('computes p95 and p99 correctly for 100 sequential values', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('percentile_test');
      for (let i = 1; i <= 100; i++) {
        hist.observe(i);
      }

      const stats = hist.getStatistics();
      // p95 of 1..100: index = 0.95 * 99 = 94.05 → interpolated between sorted[94]=95 and sorted[95]=96
      expect(stats.p95).toBeCloseTo(95.05, 1);
      // p99 of 1..100: index = 0.99 * 99 = 98.01 → interpolated between sorted[98]=99 and sorted[99]=100
      expect(stats.p99).toBeCloseTo(99.01, 1);
    });

    it('p95 and p99 equal the single value for 1 observation', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('single_p');
      hist.observe(42);

      const stats = hist.getStatistics();
      expect(stats.p95).toBe(42);
      expect(stats.p99).toBe(42);
    });

    it('p95 of two values interpolates correctly', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('two_p');
      hist.observe(10);
      hist.observe(20);

      const stats = hist.getStatistics();
      // sorted = [10, 20], index = 0.95 * 1 = 0.95
      // lower=0 (10), upper=1 (20), weight=0.95
      // result = 10 * 0.05 + 20 * 0.95 = 0.5 + 19 = 19.5
      expect(stats.p95).toBeCloseTo(19.5, 5);
    });
  });

  describe('histogram bucket distribution', () => {
    it('correctly distributes values into buckets', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('bucket_test', 'test', [10, 50, 100]);

      hist.observe(5); // ≤10, ≤50, ≤100
      hist.observe(30); // ≤50, ≤100
      hist.observe(75); // ≤100
      hist.observe(200); // none

      const buckets = hist.getBuckets();
      expect(buckets).toEqual([
        { le: 10, count: 1 },
        { le: 50, count: 2 },
        { le: 100, count: 3 }
      ]);
    });

    it('exact boundary values count in bucket', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('boundary', 'test', [10]);

      hist.observe(10); // exactly == le
      const buckets = hist.getBuckets();
      expect(buckets[0].count).toBe(1);
    });
  });

  describe('counter label key ordering is stable', () => {
    it('same labels in different order produce same key', () => {
      const registry = new MetricsRegistry();
      const counter = registry.counter('order_test', 'test', ['a', 'b']);

      counter.inc(1, { a: '1', b: '2' });
      counter.inc(1, { b: '2', a: '1' }); // same labels, different order

      expect(counter.get({ a: '1', b: '2' })).toBe(2);
      expect(counter.get({ b: '2', a: '1' })).toBe(2);
    });
  });

  describe('reset clears all metric values', () => {
    it('resets counters, gauges, histograms, and timers', () => {
      const registry = new MetricsRegistry();
      const counter = registry.counter('c');
      const gauge = registry.gauge('g');
      const hist = registry.histogram('h');
      const timer = registry.timer('t');

      counter.inc(10);
      gauge.set(42);
      hist.observe(5);
      timer.observe(1);

      registry.reset();

      expect(counter.get()).toBe(0);
      expect(gauge.get()).toBe(0);
      expect(hist.getStatistics().count).toBe(0);
      expect(timer.getStatistics().count).toBe(0);
    });
  });

  describe('toJSON includes all metric types', () => {
    it('exports histograms with statistics and buckets', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('h', 'test', [10, 100]);
      hist.observe(5);
      hist.observe(50);

      const json = registry.toJSON();
      const hJson = json.h as Record<string, unknown>;
      expect(hJson.type).toBe('histogram');
      expect((hJson.statistics as Record<string, unknown>).count).toBe(2);
      expect((hJson.buckets as unknown[]).length).toBe(2);
    });

    it('exports timers with statistics', () => {
      const registry = new MetricsRegistry();
      const timer = registry.timer('t');
      timer.observe(1.5);

      const json = registry.toJSON();
      const tJson = json.t as Record<string, unknown>;
      expect(tJson.type).toBe('timer');
      const stats = tJson.statistics as Record<string, unknown>;
      expect(stats.count).toBe(1);
    });
  });

  describe('histogram reset clears buckets', () => {
    it('bucket counts return to zero after reset', () => {
      const registry = new MetricsRegistry();
      const hist = registry.histogram('reset_buckets', 'test', [10, 100]);
      hist.observe(5);
      hist.observe(50);

      hist.reset();

      const buckets = hist.getBuckets();
      expect(buckets.every((b) => b.count === 0)).toBe(true);
      expect(hist.getStatistics().count).toBe(0);
      expect(hist.getStatistics().sum).toBe(0);
    });
  });

  describe('timer observe records duration directly', () => {
    it('observe adds to internal histogram without running code', () => {
      const registry = new MetricsRegistry();
      const timer = registry.timer('direct');
      timer.observe(0.5);
      timer.observe(1.5);

      const stats = timer.getStatistics();
      expect(stats.count).toBe(2);
      expect(stats.sum).toBeCloseTo(2.0, 5);
      expect(stats.min).toBeCloseTo(0.5, 5);
      expect(stats.max).toBeCloseTo(1.5, 5);
    });
  });
});
