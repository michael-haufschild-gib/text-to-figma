/**
 * Configuration Management
 *
 * Centralized configuration with environment variable validation.
 * Separates configuration from code for different environments.
 */

import { z } from 'zod';
import { ConfigurationError } from './errors/index.js';
import { logLevelSchema } from './monitoring/logger.js';

/**
 * Environment enum
 */
export const environmentSchema = z.enum(['development', 'staging', 'production', 'test']);
export type Environment = z.infer<typeof environmentSchema>;

/**
 * Configuration schema with defaults
 */
const configSchema = z.object({
  // Environment
  NODE_ENV: environmentSchema.default('development'),

  // Figma Bridge
  FIGMA_WS_URL: z.string().url().default('ws://localhost:8080'),
  FIGMA_REQUEST_TIMEOUT: z.coerce.number().int().positive().default(30000),
  FIGMA_MAX_RECONNECT_ATTEMPTS: z.coerce.number().int().positive().default(5),

  // Logging
  LOG_LEVEL: logLevelSchema.default('info'),
  LOG_JSON: z.coerce.boolean().default(false),

  // Monitoring
  ENABLE_METRICS: z.coerce.boolean().default(true),
  ENABLE_ERROR_TRACKING: z.coerce.boolean().default(true),
  ERROR_TRACKER_MAX_ERRORS: z.coerce.number().int().positive().default(1000),
  ERROR_TRACKER_AGGREGATION_WINDOW: z.coerce.number().int().positive().default(3600000), // 1 hour
  ERROR_TRACKER_PRUNE_INTERVAL: z.coerce.number().int().positive().default(300000), // 5 minutes

  // Health Check
  HEALTH_CHECK_PORT: z.coerce.number().int().positive().default(8081),
  HEALTH_CHECK_ENABLED: z.coerce.boolean().default(true),

  // Server
  MCP_SERVER_PORT: z.coerce.number().int().positive().optional(),
  GRACEFUL_SHUTDOWN_TIMEOUT: z.coerce.number().int().positive().default(30000),

  // Circuit Breaker
  CIRCUIT_BREAKER_ENABLED: z.coerce.boolean().default(true),
  CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().int().positive().default(5),
  CIRCUIT_BREAKER_TIMEOUT: z.coerce.number().int().positive().default(60000), // 1 minute
  CIRCUIT_BREAKER_RESET_TIMEOUT: z.coerce.number().int().positive().default(30000), // 30 seconds

  // Retry
  RETRY_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  RETRY_BASE_DELAY: z.coerce.number().int().positive().default(1000), // 1 second
  RETRY_MAX_DELAY: z.coerce.number().int().positive().default(30000) // 30 seconds
});

export type Config = z.infer<typeof configSchema>;

/**
 * Loaded configuration
 */
let loadedConfig: Config | null = null;

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): Config {
  if (loadedConfig) {
    return loadedConfig;
  }

  try {
    loadedConfig = configSchema.parse(process.env);
    return loadedConfig;
  } catch (error) {
    if (error instanceof z.ZodError && error.errors.length > 0) {
      const firstError = error.errors[0];
      throw new ConfigurationError(
        `Configuration validation failed: ${firstError?.message ?? 'unknown'}`,
        firstError?.path.join('.') ?? 'unknown',
        firstError?.path[0] !== undefined ? process.env[String(firstError.path[0])] : undefined
      );
    }
    throw error;
  }
}

/**
 * Get current configuration (throws if not loaded)
 */
export function getConfig(): Config {
  if (!loadedConfig) {
    throw new ConfigurationError('Configuration not loaded. Call loadConfig() first.', 'config');
  }
  return loadedConfig;
}

/**
 * Reset configuration (useful for testing)
 */
export function resetConfig(): void {
  loadedConfig = null;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getConfig().NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return getConfig().NODE_ENV === 'development';
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return getConfig().NODE_ENV === 'test';
}

/**
 * Get typed configuration value
 * @param key
 */
export function getConfigValue<K extends keyof Config>(key: K): Config[K] {
  return getConfig()[key];
}
