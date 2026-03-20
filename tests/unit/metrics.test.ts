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

  describe('edge cases', () => {
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
});
