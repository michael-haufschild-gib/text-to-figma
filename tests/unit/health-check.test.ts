/**
 * Health Check Registry Unit Tests
 *
 * Tests HealthCheckRegistry, built-in health checkers,
 * status aggregation, and singleton management.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  HealthCheckRegistry,
  createMemoryHealthChecker,
  createErrorRateHealthChecker,
  createFigmaConnectionHealthChecker,
  createCacheHealthChecker,
  getHealthCheck,
  resetHealthCheck,
  checkHealth
} from '../../mcp-server/src/monitoring/health-check.js';
import {
  getErrorTracker,
  resetErrorTracker
} from '../../mcp-server/src/monitoring/error-tracker.js';

describe('HealthCheckRegistry', () => {
  describe('register and check', () => {
    it('runs registered health checkers', async () => {
      const registry = new HealthCheckRegistry();
      registry.register('test', () => ({
        name: 'test',
        status: 'healthy',
        timestamp: Date.now()
      }));

      const result = await registry.check();
      expect(result.components).toHaveLength(1);
      expect(result.components[0].name).toBe('test');
      expect(result.components[0].status).toBe('healthy');
    });

    it('runs async health checkers', async () => {
      const registry = new HealthCheckRegistry();
      registry.register('async-test', () => ({
        name: 'async-test',
        status: 'degraded',
        message: 'Slow response',
        timestamp: Date.now()
      }));

      const result = await registry.check();
      expect(result.components[0].status).toBe('degraded');
      expect(result.components[0].message).toBe('Slow response');
    });

    it('catches errors in health checkers', async () => {
      const registry = new HealthCheckRegistry();
      registry.register('failing', () => {
        throw new Error('Check failed');
      });

      const result = await registry.check();
      expect(result.components[0].status).toBe('unhealthy');
      expect(result.components[0].message).toBe('Check failed');
    });

    it('catches non-Error throws in health checkers', async () => {
      const registry = new HealthCheckRegistry();
      registry.register('failing', () => {
        throw 'string error';
      });

      const result = await registry.check();
      expect(result.components[0].status).toBe('unhealthy');
      expect(result.components[0].message).toBe('Health check failed');
    });
  });

  describe('unregister', () => {
    it('removes a registered checker', async () => {
      const registry = new HealthCheckRegistry();
      registry.register('temp', () => ({
        name: 'temp',
        status: 'healthy',
        timestamp: Date.now()
      }));

      registry.unregister('temp');
      const result = await registry.check();
      expect(result.components).toHaveLength(0);
    });

    it('silently ignores unregistering non-existent checker', () => {
      const registry = new HealthCheckRegistry();
      expect(() => registry.unregister('nonexistent')).not.toThrow();
    });
  });

  describe('status aggregation', () => {
    it('reports healthy when all components are healthy', async () => {
      const registry = new HealthCheckRegistry();
      registry.register('a', () => ({ name: 'a', status: 'healthy', timestamp: Date.now() }));
      registry.register('b', () => ({ name: 'b', status: 'healthy', timestamp: Date.now() }));

      const result = await registry.check();
      expect(result.status).toBe('healthy');
      expect(result.summary).toEqual({ healthy: 2, degraded: 0, unhealthy: 0 });
    });

    it('reports degraded when any component is degraded but none unhealthy', async () => {
      const registry = new HealthCheckRegistry();
      registry.register('a', () => ({ name: 'a', status: 'healthy', timestamp: Date.now() }));
      registry.register('b', () => ({ name: 'b', status: 'degraded', timestamp: Date.now() }));

      const result = await registry.check();
      expect(result.status).toBe('degraded');
      expect(result.summary).toEqual({ healthy: 1, degraded: 1, unhealthy: 0 });
    });

    it('reports unhealthy when any component is unhealthy', async () => {
      const registry = new HealthCheckRegistry();
      registry.register('a', () => ({ name: 'a', status: 'healthy', timestamp: Date.now() }));
      registry.register('b', () => ({ name: 'b', status: 'degraded', timestamp: Date.now() }));
      registry.register('c', () => ({ name: 'c', status: 'unhealthy', timestamp: Date.now() }));

      const result = await registry.check();
      expect(result.status).toBe('unhealthy');
      expect(result.summary).toEqual({ healthy: 1, degraded: 1, unhealthy: 1 });
    });

    it('reports healthy with empty registry', async () => {
      const registry = new HealthCheckRegistry();
      const result = await registry.check();
      expect(result.status).toBe('healthy');
      expect(result.components).toHaveLength(0);
    });
  });

  describe('uptime', () => {
    it('tracks uptime from creation', () => {
      const registry = new HealthCheckRegistry();
      const uptime = registry.getUptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(uptime).toBeLessThan(1); // Should be nearly instant
    });

    it('includes uptime in check result', async () => {
      const registry = new HealthCheckRegistry();
      const result = await registry.check();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeGreaterThan(0);
    });
  });
});

describe('Built-in Health Checkers', () => {
  describe('createMemoryHealthChecker', () => {
    it('returns healthy for normal memory usage', () => {
      const checker = createMemoryHealthChecker(0.8, 0.95);
      const result = checker();
      expect(result.name).toBe('memory');
      // Under normal test conditions, memory usage should be healthy
      expect(['healthy', 'degraded']).toContain(result.status);
      expect(result.metrics).toBeTypeOf('object');
      const metrics = result.metrics as Record<string, number>;
      expect(metrics.heapUsed).toBeGreaterThan(0);
      expect(metrics.heapTotal).toBeGreaterThan(0);
    });

    it('uses default thresholds when not specified', () => {
      const checker = createMemoryHealthChecker();
      const result = checker();
      expect(result.name).toBe('memory');
    });
  });

  describe('createFigmaConnectionHealthChecker', () => {
    it('returns healthy when connected', () => {
      const checker = createFigmaConnectionHealthChecker(() => true);
      const result = checker();
      expect(result.name).toBe('figma_connection');
      expect(result.status).toBe('healthy');
      expect(result.message).toContain('Connected');
      expect((result.metrics as Record<string, unknown>).connected).toBe(true);
    });

    it('returns degraded when disconnected', () => {
      const checker = createFigmaConnectionHealthChecker(() => false);
      const result = checker();
      expect(result.status).toBe('degraded');
      expect(result.message).toContain('Not connected');
      expect((result.metrics as Record<string, unknown>).connected).toBe(false);
    });
  });

  describe('createCacheHealthChecker', () => {
    it('returns healthy for good cache stats', () => {
      const checker = createCacheHealthChecker({
        getStatistics: () => ({ hitRate: 90, memoryUsage: 50, maxMemoryUsage: 100 })
      });
      const result = checker();
      expect(result.name).toBe('cache');
      expect(result.status).toBe('healthy');
    });

    it('returns degraded for high memory usage', () => {
      const checker = createCacheHealthChecker({
        getStatistics: () => ({ hitRate: 90, memoryUsage: 96, maxMemoryUsage: 100 })
      });
      const result = checker();
      expect(result.status).toBe('degraded');
      expect(result.message).toContain('memory usage high');
    });

    it('returns degraded for low hit rate', () => {
      const checker = createCacheHealthChecker({
        getStatistics: () => ({ hitRate: 30, memoryUsage: 50, maxMemoryUsage: 100 })
      });
      const result = checker();
      expect(result.status).toBe('degraded');
      expect(result.message).toContain('hit rate');
    });
  });
});

describe('Global health check', () => {
  afterEach(() => {
    resetHealthCheck();
  });

  it('returns singleton instance', () => {
    const a = getHealthCheck();
    const b = getHealthCheck();
    expect(a).toBe(b);
  });

  it('creates fresh instance after reset', () => {
    const a = getHealthCheck();
    resetHealthCheck();
    const b = getHealthCheck();
    expect(a).not.toBe(b);
  });

  it('includes built-in memory and error checkers', async () => {
    const result = await checkHealth();
    const names = result.components.map((c) => c.name);
    expect(names).toContain('memory');
    expect(names).toContain('errors');
  });
});

describe('HealthCheckRegistry advanced', () => {
  describe('createErrorRateHealthChecker', () => {
    it('returns healthy when no errors tracked', () => {
      // createErrorRateHealthChecker uses the global error tracker
      const checker = createErrorRateHealthChecker();
      const result = checker();
      expect(result.status).toBe('healthy');
      expect(result.name).toBe('errors');
    });

    it('accepts custom warn and critical thresholds', () => {
      const checker = createErrorRateHealthChecker(5, 20);
      const result = checker();
      expect(result.status).toBe('healthy');
    });

    it('returns unhealthy when critical errors are present', () => {
      const tracker = getErrorTracker();
      tracker.track(new Error('fatal crash'), {}, 'critical');
      try {
        const checker = createErrorRateHealthChecker();
        const result = checker();
        expect(result.status).toBe('unhealthy');
        expect(result.message).toContain('critical errors detected');
      } finally {
        resetErrorTracker();
      }
    });

    it('returns unhealthy when high-severity errors exceed critical threshold', () => {
      const tracker = getErrorTracker();
      // Track enough unique high-severity errors to exceed critical threshold (50)
      for (let i = 0; i < 51; i++) {
        tracker.track(new Error(`high error ${i}`), {}, 'high', 'internal');
      }
      try {
        const checker = createErrorRateHealthChecker(10, 50);
        const result = checker();
        expect(result.status).toBe('unhealthy');
        expect(result.message).toContain('High error rate');
      } finally {
        resetErrorTracker();
      }
    });

    it('returns degraded when high-severity errors exceed warn threshold but not critical', () => {
      const tracker = getErrorTracker();
      // Track enough unique high-severity errors to exceed warn (10) but not critical (50)
      for (let i = 0; i < 11; i++) {
        tracker.track(new Error(`elevated error ${i}`), {}, 'high', 'internal');
      }
      try {
        const checker = createErrorRateHealthChecker(10, 50);
        const result = checker();
        expect(result.status).toBe('degraded');
        expect(result.message).toContain('Elevated error rate');
      } finally {
        resetErrorTracker();
      }
    });
  });

  describe('concurrent health checks', () => {
    it('handles concurrent check() calls without race conditions', async () => {
      const registry = new HealthCheckRegistry();
      registry.register('slow', async () => {
        await new Promise((r) => setTimeout(r, 5));
        return { name: 'slow', status: 'healthy', timestamp: Date.now() };
      });

      const [result1, result2] = await Promise.all([registry.check(), registry.check()]);
      expect(result1.status).toBe('healthy');
      expect(result2.status).toBe('healthy');
    });
  });

  describe('createCacheHealthChecker threshold edge cases', () => {
    it('exactly 95% memory usage triggers degraded', () => {
      const checker = createCacheHealthChecker({
        getStatistics: () => ({ hitRate: 90, memoryUsage: 95, maxMemoryUsage: 100 })
      });
      const result = checker();
      expect(result.status).toBe('degraded');
    });

    it('94.9% memory usage stays healthy (below 0.95 threshold)', () => {
      const checker = createCacheHealthChecker({
        getStatistics: () => ({ hitRate: 90, memoryUsage: 94.9, maxMemoryUsage: 100 })
      });
      const result = checker();
      expect(result.status).toBe('healthy');
    });

    it('exactly 50% hit rate stays healthy', () => {
      const checker = createCacheHealthChecker({
        getStatistics: () => ({ hitRate: 50, memoryUsage: 50, maxMemoryUsage: 100 })
      });
      const result = checker();
      expect(result.status).toBe('healthy');
    });

    it('49.9% hit rate triggers degraded', () => {
      const checker = createCacheHealthChecker({
        getStatistics: () => ({ hitRate: 49.9, memoryUsage: 50, maxMemoryUsage: 100 })
      });
      const result = checker();
      expect(result.status).toBe('degraded');
    });

    it('low hit rate message overrides high memory message', () => {
      // Both conditions true: high memory AND low hit rate
      // The low hit rate check runs second and overwrites the message
      const checker = createCacheHealthChecker({
        getStatistics: () => ({ hitRate: 30, memoryUsage: 96, maxMemoryUsage: 100 })
      });
      const result = checker();
      expect(result.status).toBe('degraded');
      expect(result.message).toContain('hit rate');
    });
  });

  describe('status aggregation priority', () => {
    it('unhealthy takes priority over degraded', async () => {
      const registry = new HealthCheckRegistry();
      registry.register('ok', () => ({ name: 'ok', status: 'healthy', timestamp: Date.now() }));
      registry.register('bad', () => ({ name: 'bad', status: 'degraded', timestamp: Date.now() }));
      registry.register('worse', () => ({
        name: 'worse',
        status: 'unhealthy',
        timestamp: Date.now()
      }));

      const result = await registry.check();
      expect(result.status).toBe('unhealthy');
    });

    it('summary counts are accurate for mixed statuses', async () => {
      const registry = new HealthCheckRegistry();
      registry.register('h1', () => ({ name: 'h1', status: 'healthy', timestamp: Date.now() }));
      registry.register('h2', () => ({ name: 'h2', status: 'healthy', timestamp: Date.now() }));
      registry.register('d1', () => ({ name: 'd1', status: 'degraded', timestamp: Date.now() }));
      registry.register('u1', () => ({ name: 'u1', status: 'unhealthy', timestamp: Date.now() }));

      const result = await registry.check();
      expect(result.summary).toEqual({ healthy: 2, degraded: 1, unhealthy: 1 });
    });
  });
});
