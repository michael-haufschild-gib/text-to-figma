/**
 * E2E Environment Configuration
 *
 * Configures process.env to point the MCP server's FigmaBridge at a test
 * WebSocket bridge, with fast timeouts for responsive tests.
 */

import { resetConfig, loadConfig } from '../../../mcp-server/src/config.js';

const originalEnv: Record<string, string | undefined> = {};

const ENV_KEYS = [
  'FIGMA_WS_URL',
  'FIGMA_REQUEST_TIMEOUT',
  'FIGMA_MAX_RECONNECT_ATTEMPTS',
  'CIRCUIT_BREAKER_THRESHOLD',
  'CIRCUIT_BREAKER_RESET_TIMEOUT',
  'CIRCUIT_BREAKER_ENABLED',
  'HEALTH_CHECK_ENABLED',
  'HEALTH_CHECK_PORT',
  'NODE_ENV',
  'LOG_LEVEL',
  'RETRY_MAX_ATTEMPTS',
  'RETRY_BASE_DELAY',
  'RETRY_MAX_DELAY'
] as const;

/**
 * Configure the MCP server config to connect to a test WebSocket bridge.
 *
 * Sets fast timeouts and disables health check to avoid port conflicts
 * between parallel test runs.
 */
export function configureE2EEnv(wsUrl: string): void {
  // Save originals
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
  }

  // Point bridge at the test WebSocket server
  process.env.FIGMA_WS_URL = wsUrl;
  process.env.FIGMA_REQUEST_TIMEOUT = '3000';
  process.env.FIGMA_MAX_RECONNECT_ATTEMPTS = '1';

  // Fast circuit breaker for tests
  process.env.CIRCUIT_BREAKER_THRESHOLD = '3';
  process.env.CIRCUIT_BREAKER_RESET_TIMEOUT = '500';
  process.env.CIRCUIT_BREAKER_ENABLED = 'true';

  // Disable health check (avoids port conflicts)
  process.env.HEALTH_CHECK_ENABLED = 'false';

  // Test environment
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // quiet during tests

  // Fast retries
  process.env.RETRY_MAX_ATTEMPTS = '2';
  process.env.RETRY_BASE_DELAY = '50';
  process.env.RETRY_MAX_DELAY = '200';

  // Reset and reload config
  resetConfig();
  loadConfig();
}

/**
 * Restore original environment and reset config.
 */
export function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
  resetConfig();
}
