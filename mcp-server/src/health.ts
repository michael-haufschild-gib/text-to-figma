/**
 * Health Check Server
 *
 * HTTP endpoint for health checks and readiness probes.
 * Delegates to HealthCheckRegistry for component health status,
 * ensuring a single source of truth for health computations.
 */

import http from 'node:http';
import { getConfig } from './config.js';
import { getFigmaBridge } from './figma-bridge.js';
import {
  createFigmaConnectionHealthChecker,
  getHealthCheck,
  type HealthStatus
} from './monitoring/health-check.js';

/**
 * Localhost origin pattern for CORS validation.
 * Matches http://localhost, http://127.0.0.1, http://[::1] with optional port.
 */
const LOCALHOST_ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/**
 * Check whether an HTTP Origin header value is from localhost.
 * Returns true only for http:// origins on localhost, 127.0.0.1, or [::1].
 */
export function isLocalhostOrigin(origin: string | undefined): origin is string {
  if (origin === undefined) {
    return false;
  }
  return LOCALHOST_ORIGIN_RE.test(origin);
}

/**
 * Health status exposed over HTTP.
 *
 * Derived from HealthCheckRegistry results.
 */
export interface HttpHealthStatus {
  status: HealthStatus;
  timestamp: number;
  uptime: number;
  checks: Record<string, { status: string; [key: string]: unknown }>;
}

/**
 * Health check server
 */
export class HealthCheckServer {
  private server: http.Server | null = null;
  private readonly port: number;
  private readonly startTime: number;
  private registryInitialized = false;

  constructor(port?: number) {
    const config = getConfig();
    this.port = port ?? config.HEALTH_CHECK_PORT;
    this.startTime = Date.now();
  }

  /**
   * Ensure the Figma connection checker is registered in the health registry.
   * Called once on first health status request to avoid startup-order issues.
   */
  private ensureRegistryInitialized(): void {
    if (this.registryInitialized) {
      return;
    }
    this.registryInitialized = true;

    const registry = getHealthCheck();
    const bridge = getFigmaBridge();
    registry.register(
      'figma_connection',
      createFigmaConnectionHealthChecker(() => bridge.isConnected())
    );
  }

  /**
   * Get current health status by delegating to HealthCheckRegistry.
   *
   * Transforms the registry's component array into a keyed object
   * for the HTTP response format.
   */
  async getHttpHealthStatus(): Promise<HttpHealthStatus> {
    this.ensureRegistryInitialized();

    const result = await getHealthCheck().check();

    // Transform components array into keyed object for HTTP response
    const checks: Record<string, { status: string; [key: string]: unknown }> = {};
    for (const component of result.components) {
      const { name, ...rest } = component;
      checks[name] = { ...rest, status: rest.status };
      // Flatten metrics into the check object for backward compatibility
      if (rest.metrics) {
        Object.assign(checks[name], rest.metrics);
      }
    }

    return {
      status: result.status,
      timestamp: result.timestamp,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks
    };
  }

  /**
   * Start the health check server
   */
  start(): Promise<void> {
    if (this.server) {
      return Promise.resolve();
    }

    this.server = http.createServer((req, res) => {
      // CORS headers only for localhost origins — prevents arbitrary web pages from probing
      if (isLocalhostOrigin(req.headers.origin)) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      }
      res.setHeader('Vary', 'Origin');

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

      // All health endpoints are async — delegate to handler
      this.handleHealthRequest(req, res).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Internal server error';
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
      });
    });

    return new Promise<void>((resolve, reject) => {
      const server = this.server;
      if (!server) {
        resolve();
        return;
      }

      server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          console.error(
            `[HealthCheck] Port ${this.port} already in use — health check server not started (another instance may be running)`
          );
          this.server = null;
          resolve(); // Non-fatal: server just won't start
          return;
        }
        console.error('[HealthCheck] Server error:', error);
        reject(error);
      });

      server.listen(this.port, () => {
        console.error(`[HealthCheck] Health check server started on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Handle health check HTTP requests (async to support registry checks).
   */
  private async handleHealthRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    // Health check endpoint
    if (req.url === '/health' || req.url === '/healthz') {
      const health = await this.getHttpHealthStatus();
      const statusCode = health.status === 'healthy' ? 200 : 503;

      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health, null, 2));
      return;
    }

    // Readiness probe - checks if service is ready to accept traffic
    if (req.url === '/ready' || req.url === '/readiness') {
      const health = await this.getHttpHealthStatus();
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
      const health = await this.getHttpHealthStatus();
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
  healthCheckInstance ??= new HealthCheckServer();
  return healthCheckInstance;
}

/**
 * Start the health check server
 */
export async function startHealthCheck(): Promise<void> {
  const config = getConfig();
  if (!config.HEALTH_CHECK_ENABLED) {
    return;
  }

  await getHealthCheckServer().start();
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
