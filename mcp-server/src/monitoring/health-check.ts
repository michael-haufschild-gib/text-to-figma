/**
 * Health Check
 *
 * System health monitoring and status reporting.
 */

import { z } from 'zod';
import { getErrorTracker } from './error-tracker.js';

/**
 * Health status
 */
export const healthStatusSchema = z.enum(['healthy', 'degraded', 'unhealthy']);
export type HealthStatus = z.infer<typeof healthStatusSchema>;

/**
 * Component health check
 */
export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  timestamp: number;
  metrics?: Record<string, unknown>;
}

/**
 * Overall health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: number;
  uptime: number;
  components: ComponentHealth[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

/**
 * Health checker function type
 */
export type HealthChecker = () => Promise<ComponentHealth> | ComponentHealth;

/**
 * Health check registry
 */
export class HealthCheckRegistry {
  private checkers: Map<string, HealthChecker> = new Map();
  private readonly startTime: number = Date.now();

  /**
   * Register a health checker
   * @param name
   * @param checker
   */
  register(name: string, checker: HealthChecker): void {
    this.checkers.set(name, checker);
  }

  /**
   * Unregister a health checker
   * @param name
   */
  unregister(name: string): void {
    this.checkers.delete(name);
  }

  /**
   * Run all health checks
   */
  async check(): Promise<HealthCheckResult> {
    const timestamp = Date.now();
    const components: ComponentHealth[] = [];

    // Run all registered checkers
    for (const [name, checker] of this.checkers.entries()) {
      try {
        const health = await checker();
        components.push(health);
      } catch (error) {
        components.push({
          name,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Health check failed',
          timestamp
        });
      }
    }

    // Calculate summary
    const summary = {
      healthy: components.filter((c) => c.status === 'healthy').length,
      degraded: components.filter((c) => c.status === 'degraded').length,
      unhealthy: components.filter((c) => c.status === 'unhealthy').length
    };

    // Determine overall status
    let status: HealthStatus = 'healthy';
    if (summary.unhealthy > 0) {
      status = 'unhealthy';
    } else if (summary.degraded > 0) {
      status = 'degraded';
    }

    return {
      status,
      timestamp,
      uptime: timestamp - this.startTime,
      components,
      summary
    };
  }

  /**
   * Get uptime in seconds
   */
  getUptime(): number {
    return (Date.now() - this.startTime) / 1000;
  }
}

/**
 * Built-in health checkers
 */

/**
 * Memory usage health checker
 * @param warnThreshold
 * @param criticalThreshold
 */
export function createMemoryHealthChecker(
  warnThreshold: number = 0.8,
  criticalThreshold: number = 0.95
): HealthChecker {
  return (): ComponentHealth => {
    const usage = process.memoryUsage();
    const heapUsed = usage.heapUsed;
    const heapTotal = usage.heapTotal;
    const heapUsedPercent = heapUsed / heapTotal;

    let status: HealthStatus = 'healthy';
    let message: string | undefined;

    if (heapUsedPercent >= criticalThreshold) {
      status = 'unhealthy';
      message = `Memory usage critical: ${(heapUsedPercent * 100).toFixed(1)}%`;
    } else if (heapUsedPercent >= warnThreshold) {
      status = 'degraded';
      message = `Memory usage high: ${(heapUsedPercent * 100).toFixed(1)}%`;
    }

    return {
      name: 'memory',
      status,
      message,
      timestamp: Date.now(),
      metrics: {
        heapUsed,
        heapTotal,
        heapUsedPercent: Math.round(heapUsedPercent * 10000) / 100,
        rss: usage.rss,
        external: usage.external
      }
    };
  };
}

/**
 * Error rate health checker
 * @param warnThreshold
 * @param criticalThreshold
 */
export function createErrorRateHealthChecker(
  warnThreshold: number = 10,
  criticalThreshold: number = 50
): HealthChecker {
  return (): ComponentHealth => {
    const errorTracker = getErrorTracker();
    const stats = errorTracker.getStatistics();

    let status: HealthStatus = 'healthy';
    let message: string | undefined;

    if (stats.bySeverity.critical > 0) {
      status = 'unhealthy';
      message = `${stats.bySeverity.critical} critical errors detected`;
    } else if (stats.bySeverity.high >= criticalThreshold) {
      status = 'unhealthy';
      message = `High error rate: ${stats.bySeverity.high} high-severity errors`;
    } else if (stats.bySeverity.high >= warnThreshold) {
      status = 'degraded';
      message = `Elevated error rate: ${stats.bySeverity.high} high-severity errors`;
    }

    return {
      name: 'errors',
      status,
      message,
      timestamp: Date.now(),
      metrics: {
        total: stats.total,
        unique: stats.uniqueErrors,
        bySeverity: stats.bySeverity,
        byCategory: stats.byCategory
      }
    };
  };
}

/**
 * Figma connection health checker
 * @param checkConnection
 */
export function createFigmaConnectionHealthChecker(checkConnection: () => boolean): HealthChecker {
  return (): ComponentHealth => {
    const isConnected = checkConnection();

    return {
      name: 'figma_connection',
      status: isConnected ? 'healthy' : 'degraded',
      message: isConnected ? 'Connected to Figma' : 'Not connected to Figma',
      timestamp: Date.now(),
      metrics: {
        connected: isConnected
      }
    };
  };
}

/**
 * Cache health checker
 * @param cache
 * @param cache.getStatistics
 */
export function createCacheHealthChecker(cache: {
  getStatistics: () => { hitRate: number; memoryUsage: number; maxMemoryUsage: number };
}): HealthChecker {
  return (): ComponentHealth => {
    const stats = cache.getStatistics();
    const memoryUsagePercent = stats.memoryUsage / stats.maxMemoryUsage;

    let status: HealthStatus = 'healthy';
    let message: string | undefined;

    if (memoryUsagePercent >= 0.95) {
      status = 'degraded';
      message = `Cache memory usage high: ${(memoryUsagePercent * 100).toFixed(1)}%`;
    }

    if (stats.hitRate < 50) {
      status = 'degraded';
      message = `Low cache hit rate: ${stats.hitRate.toFixed(1)}%`;
    }

    return {
      name: 'cache',
      status,
      message,
      timestamp: Date.now(),
      metrics: {
        hitRate: stats.hitRate,
        memoryUsage: stats.memoryUsage,
        memoryUsagePercent: Math.round(memoryUsagePercent * 10000) / 100
      }
    };
  };
}

/**
 * Global health check registry
 */
let globalRegistry: HealthCheckRegistry | null = null;

/**
 * Get global health check registry
 */
export function getHealthCheck(): HealthCheckRegistry {
  if (!globalRegistry) {
    globalRegistry = new HealthCheckRegistry();

    // Register built-in health checkers
    globalRegistry.register('memory', createMemoryHealthChecker());
    globalRegistry.register('errors', createErrorRateHealthChecker());
  }
  return globalRegistry;
}

/**
 * Reset global health check registry
 */
export function resetHealthCheck(): void {
  globalRegistry = null;
}

/**
 * Run health check and return result
 */
export async function checkHealth(): Promise<HealthCheckResult> {
  return getHealthCheck().check();
}
