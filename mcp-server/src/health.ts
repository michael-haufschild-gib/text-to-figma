/**
 * Health Check Server
 *
 * HTTP endpoint for health checks and readiness probes.
 * Useful for Kubernetes, load balancers, and monitoring systems.
 */

import http from 'node:http';
import { getConfig } from './config.js';
import { getFigmaBridge } from './figma-bridge.js';

/**
 * Health status
 */
export interface HttpHealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: number;
  uptime: number;
  checks: {
    figma_bridge: {
      connected: boolean;
      status: 'pass' | 'fail';
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
      status: 'pass' | 'warn' | 'fail';
    };
  };
}

/**
 * Health check server
 */
export class HealthCheckServer {
  private server: http.Server | null = null;
  private readonly port: number;
  private readonly startTime: number;

  constructor(port?: number) {
    const config = getConfig();
    this.port = port ?? config.HEALTH_CHECK_PORT;
    this.startTime = Date.now();
  }

  /**
   * Get current health status
   */
  getHttpHealthStatus(): HttpHealthStatus {
    const bridge = getFigmaBridge();
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const memoryPercentage = Math.round((memoryUsedMB / memoryTotalMB) * 100);

    // Determine memory status
    let memoryStatus: 'pass' | 'warn' | 'fail' = 'pass';
    if (memoryPercentage > 90) {
      memoryStatus = 'fail';
    } else if (memoryPercentage > 75) {
      memoryStatus = 'warn';
    }

    // Determine overall status
    const figmaConnected = bridge.isConnected();
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

    if (!figmaConnected) {
      overallStatus = 'degraded';
    }

    if (memoryStatus === 'fail') {
      overallStatus = 'unhealthy';
    }

    return {
      status: overallStatus,
      timestamp: Date.now(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks: {
        figma_bridge: {
          connected: figmaConnected,
          status: figmaConnected ? 'pass' : 'fail'
        },
        memory: {
          used: memoryUsedMB,
          total: memoryTotalMB,
          percentage: memoryPercentage,
          status: memoryStatus
        }
      }
    };
  }

  /**
   * Start the health check server
   */
  start(): void {
    if (this.server) {
      return;
    }

    this.server = http.createServer((req, res) => {
      // CORS headers for browser access
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Handle preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Only handle GET requests
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      // Health check endpoint
      if (req.url === '/health' || req.url === '/healthz') {
        const health = this.getHttpHealthStatus();
        const statusCode = health.status === 'healthy' ? 200 : 503;

        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(health, null, 2));
        return;
      }

      // Readiness probe - checks if service is ready to accept traffic
      if (req.url === '/ready' || req.url === '/readiness') {
        const health = this.getHttpHealthStatus();
        const ready = health.status === 'healthy';
        const statusCode = ready ? 200 : 503;

        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify(
            {
              ready,
              timestamp: health.timestamp
            },
            null,
            2
          )
        );
        return;
      }

      // Liveness probe - checks if service is alive (less strict)
      if (req.url === '/live' || req.url === '/liveness') {
        const health = this.getHttpHealthStatus();
        // Service is alive if not completely unhealthy
        const alive = health.status !== 'unhealthy';
        const statusCode = alive ? 200 : 503;

        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify(
            {
              alive,
              timestamp: health.timestamp
            },
            null,
            2
          )
        );
        return;
      }

      // Default 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Not found',
          available_endpoints: ['/health', '/ready', '/live']
        })
      );
    });

    this.server.listen(this.port, () => {
      console.error(`[HealthCheck] Health check server started on port ${this.port}`);
    });

    this.server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        // Port already in use - silently skip (another instance is running)
        return;
      }
      console.error('[HealthCheck] Server error:', error);
    });
  }

  /**
   * Stop the health check server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    const server = this.server;
    return new Promise((resolve) => {
      server.close(() => {
        console.error('[HealthCheck] Health check server stopped');
        this.server = null;
        resolve();
      });
    });
  }
}

/**
 * Global health check server instance
 */
let healthCheckInstance: HealthCheckServer | null = null;

/**
 * Get or create the global health check server
 */
export function getHealthCheckServer(): HealthCheckServer {
  if (!healthCheckInstance) {
    healthCheckInstance = new HealthCheckServer();
  }
  return healthCheckInstance;
}

/**
 * Start the health check server
 */
export function startHealthCheck(): void {
  const config = getConfig();
  if (!config.HEALTH_CHECK_ENABLED) {
    return;
  }

  getHealthCheckServer().start();
}

/**
 * Stop the health check server
 */
export async function stopHealthCheck(): Promise<void> {
  if (healthCheckInstance) {
    await healthCheckInstance.stop();
    healthCheckInstance = null;
  }
}
