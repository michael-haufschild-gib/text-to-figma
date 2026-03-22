/**
 * HTTP Health Check Server Tests
 *
 * Tests the HealthCheckServer HTTP endpoints: /health, /ready, /live,
 * CORS handling, method rejection, and 404 responses.
 * Uses a real HTTP server on a random port.
 */

import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, resetConfig } from '../../mcp-server/src/config.js';
import { resetFigmaBridge } from '../../mcp-server/src/figma-bridge.js';
import { resetHealthCheck } from '../../mcp-server/src/monitoring/health-check.js';

// Mock the FigmaBridge to control connected state
vi.mock('../../mcp-server/src/figma-bridge.js', () => {
  const mockBridge = {
    isConnected: vi.fn(() => true),
    getConnectionStatus: vi.fn(() => ({
      connected: true,
      wsReadyState: 1,
      pendingRequests: 0,
      circuitBreakerState: 'CLOSED',
      reconnectAttempts: 0
    })),
    disconnect: vi.fn()
  };

  return {
    getFigmaBridge: () => mockBridge,
    resetFigmaBridge: vi.fn(),
    __mockBridge: mockBridge
  };
});

const { HealthCheckServer } = await import('../../mcp-server/src/health.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    isConnected: ReturnType<typeof vi.fn>;
  };
};

/** Helper: make an HTTP request and return status, body, and headers */
function httpGet(
  port: number,
  path: string,
  method = 'GET',
  headers: Record<string, string> = {}
): Promise<{
  status: number;
  body: Record<string, unknown>;
  headers: http.IncomingHttpHeaders;
}> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode ?? 0,
            body: JSON.parse(data) as Record<string, unknown>,
            headers: res.headers
          });
        } catch {
          resolve({
            status: res.statusCode ?? 0,
            body: { raw: data },
            headers: res.headers
          });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('HealthCheckServer HTTP endpoints', () => {
  let server: InstanceType<typeof HealthCheckServer>;
  let port: number;

  beforeEach(async () => {
    loadConfig();
    // Reset the health check registry to avoid stale Figma connection registrations
    resetHealthCheck();
    // Use port 0 for random available port
    server = new HealthCheckServer(0);
    await server.start();

    // Extract the actual port from the server — safe after awaiting start()
    const addr = (server as unknown as { server: http.Server }).server?.address();
    if (typeof addr === 'object' && addr !== null) {
      port = addr.port;
    }
  });

  afterEach(async () => {
    await server.stop();
    resetConfig();
    resetHealthCheck();
    vi.restoreAllMocks();
  });

  describe('/health endpoint', () => {
    it('returns 200 with healthy status when bridge is connected', async () => {
      __mockBridge.isConnected.mockReturnValue(true);

      const { status, body } = await httpGet(port, '/health');
      expect(status).toBe(200);
      expect(body.status).toBe('healthy');
      expect(body.timestamp).toBeTypeOf('number');
      expect(body.uptime).toBeTypeOf('number');
      expect(body.checks).toBeTypeOf('object');
    });

    it('returns 503 with degraded status when bridge is disconnected', async () => {
      __mockBridge.isConnected.mockReturnValue(false);

      const { status, body } = await httpGet(port, '/health');
      expect(status).toBe(503);
      expect(body.status).toBe('degraded');
      const checks = body.checks as Record<string, Record<string, unknown>>;
      expect(checks.figma_connection.connected).toBe(false);
      expect(checks.figma_connection.status).toBe('degraded');
    });

    it('includes memory metrics in health response', async () => {
      const { body } = await httpGet(port, '/health');
      const checks = body.checks as Record<string, Record<string, unknown>>;
      expect(checks.memory.status).toBe('healthy');
      expect(checks.memory.heapUsed).toBeTypeOf('number');
      expect(checks.memory.heapTotal).toBeTypeOf('number');
      expect(checks.memory.heapUsedPercent).toBeTypeOf('number');
    });

    it('includes error rate checker in health response', async () => {
      const { body } = await httpGet(port, '/health');
      const checks = body.checks as Record<string, Record<string, unknown>>;
      expect(checks.errors.status).toBe('healthy');
    });

    it('/healthz is an alias for /health', async () => {
      __mockBridge.isConnected.mockReturnValue(true);
      const { status, body } = await httpGet(port, '/healthz');
      expect(status).toBe(200);
      expect(body.status).toBe('healthy');
    });
  });

  describe('/ready endpoint', () => {
    it('returns 200 when healthy', async () => {
      __mockBridge.isConnected.mockReturnValue(true);

      const { status, body } = await httpGet(port, '/ready');
      expect(status).toBe(200);
      expect(body.ready).toBe(true);
    });

    it('returns 503 when degraded', async () => {
      __mockBridge.isConnected.mockReturnValue(false);

      const { status, body } = await httpGet(port, '/ready');
      expect(status).toBe(503);
      expect(body.ready).toBe(false);
    });

    it('/readiness is an alias for /ready', async () => {
      __mockBridge.isConnected.mockReturnValue(true); // ensure healthy
      const { status } = await httpGet(port, '/readiness');
      expect(status).toBe(200);
    });
  });

  describe('/live endpoint', () => {
    it('returns 200 when not unhealthy (degraded is alive)', async () => {
      __mockBridge.isConnected.mockReturnValue(false); // degraded

      const { status, body } = await httpGet(port, '/live');
      expect(status).toBe(200);
      expect(body.alive).toBe(true);
    });

    it('/liveness is an alias for /live', async () => {
      __mockBridge.isConnected.mockReturnValue(true);
      const { status } = await httpGet(port, '/liveness');
      expect(status).toBe(200);
    });
  });

  describe('error handling', () => {
    it('returns 404 for unknown paths', async () => {
      const { status, body } = await httpGet(port, '/unknown');
      expect(status).toBe(404);
      expect(body.error).toBe('Not found');
      expect(body.available_endpoints).toEqual(['/health', '/ready', '/live']);
    });

    it('returns 405 for non-GET methods', async () => {
      const { status, body } = await httpGet(port, '/health', 'POST');
      expect(status).toBe(405);
      expect(body.error).toBe('Method not allowed');
    });

    it('returns 200 for OPTIONS without origin (no CORS headers)', async () => {
      const { status, headers } = await httpGet(port, '/health', 'OPTIONS');
      expect(status).toBe(200);
      expect(headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('CORS', () => {
    it('reflects localhost origin in CORS headers', async () => {
      const { status, headers } = await httpGet(port, '/health', 'GET', {
        Origin: 'http://localhost:3000'
      });
      expect(status).toBe(200);
      expect(headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(headers['access-control-allow-methods']).toBe('GET, OPTIONS');
      expect(headers['vary']).toBe('Origin');
    });

    it('reflects 127.0.0.1 origin in CORS headers', async () => {
      const { headers } = await httpGet(port, '/health', 'GET', {
        Origin: 'http://127.0.0.1:8080'
      });
      expect(headers['access-control-allow-origin']).toBe('http://127.0.0.1:8080');
    });

    it('reflects IPv6 localhost origin in CORS headers', async () => {
      const { headers } = await httpGet(port, '/health', 'GET', {
        Origin: 'http://[::1]:5173'
      });
      expect(headers['access-control-allow-origin']).toBe('http://[::1]:5173');
    });

    it('omits CORS headers for non-localhost origin', async () => {
      const { headers } = await httpGet(port, '/health', 'GET', {
        Origin: 'https://evil.example.com'
      });
      expect(headers['access-control-allow-origin']).toBeUndefined();
      expect(headers['vary']).toBe('Origin');
    });

    it('omits CORS headers when no Origin header is sent', async () => {
      const { headers } = await httpGet(port, '/health', 'GET');
      expect(headers['access-control-allow-origin']).toBeUndefined();
    });

    it('OPTIONS preflight with localhost origin returns CORS headers', async () => {
      const { status, headers } = await httpGet(port, '/health', 'OPTIONS', {
        Origin: 'http://localhost:3000'
      });
      expect(status).toBe(200);
      expect(headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(headers['access-control-allow-methods']).toBe('GET, OPTIONS');
      expect(headers['access-control-allow-headers']).toBe('Content-Type');
    });

    it('OPTIONS preflight with non-localhost origin omits CORS headers', async () => {
      const { status, headers } = await httpGet(port, '/health', 'OPTIONS', {
        Origin: 'https://attacker.com'
      });
      expect(status).toBe(200);
      expect(headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('server lifecycle', () => {
    it('start is idempotent — calling twice does not create two servers', () => {
      // server.start() was already called in beforeEach
      expect(() => server.start()).not.toThrow();
    });

    it('stop is safe to call when already stopped', async () => {
      await server.stop();
      await expect(server.stop()).resolves.toBeUndefined();
    });

    it('resolves without starting when port is already in use', async () => {
      // server is already listening from beforeEach on `port`
      // Start another server on the SAME port — should resolve (non-fatal)
      const duplicate = new HealthCheckServer(port);
      await expect(duplicate.start()).resolves.toBeUndefined();
      // The duplicate did not actually start — stop is safe
      await duplicate.stop();
    });
  });
});

const {
  startHealthCheck: _startHealthCheck,
  stopHealthCheck: _stopHealthCheck,
  getHealthCheckServer: _getHealthCheckServer
} = await import('../../mcp-server/src/health.js');

describe('Module-level health check functions', () => {
  afterEach(async () => {
    await _stopHealthCheck();
    resetConfig();
    resetHealthCheck();
  });

  it('startHealthCheck creates and starts server when enabled', async () => {
    loadConfig();
    await _startHealthCheck();
    const hcServer = _getHealthCheckServer();
    expect(hcServer).toBeInstanceOf(HealthCheckServer);
  });

  it('stopHealthCheck is safe when no server exists', async () => {
    loadConfig();
    await expect(_stopHealthCheck()).resolves.toBeUndefined();
  });
});
