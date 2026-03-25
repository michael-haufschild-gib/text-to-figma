/**
 * Config Module Unit Tests
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadConfig,
  resetConfig,
  getConfig,
  isProduction,
  isDevelopment,
  isTest,
  getConfigValue
} from '../../mcp-server/src/config.js';

describe('Config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    resetConfig();
    // Restore env vars changed during tests
    process.env = { ...originalEnv };
  });

  describe('loadConfig', () => {
    it('returns config with defaults when no env vars set', () => {
      const config = loadConfig();
      expect(config.NODE_ENV).toBe('test');
      expect(config.FIGMA_WS_URL).toBe('ws://localhost:8080');
      expect(config.FIGMA_REQUEST_TIMEOUT).toBe(30000);
      expect(config.LOG_LEVEL).toBe('info');
      expect(config.HEALTH_CHECK_PORT).toBe(8081);
      expect(config.CIRCUIT_BREAKER_THRESHOLD).toBe(5);
      expect(config.RETRY_MAX_ATTEMPTS).toBe(3);
      expect(config.CIRCUIT_BREAKER_ENABLED).toBe(true);
      expect(config.HEALTH_CHECK_ENABLED).toBe(true);
      expect(config.GRACEFUL_SHUTDOWN_TIMEOUT).toBe(30000);
      expect(config.RETRY_BASE_DELAY).toBe(1000);
      expect(config.RETRY_MAX_DELAY).toBe(30000);
    });

    it('returns the same instance on subsequent calls', () => {
      const a = loadConfig();
      const b = loadConfig();
      expect(a).toBe(b);
    });

    it('reads overridden env vars', () => {
      process.env.FIGMA_REQUEST_TIMEOUT = '5000';
      process.env.LOG_LEVEL = 'debug';
      process.env.HEALTH_CHECK_PORT = '9090';
      process.env.RETRY_MAX_ATTEMPTS = '10';

      const config = loadConfig();
      expect(config.FIGMA_REQUEST_TIMEOUT).toBe(5000);
      expect(config.LOG_LEVEL).toBe('debug');
      expect(config.HEALTH_CHECK_PORT).toBe(9090);
      expect(config.RETRY_MAX_ATTEMPTS).toBe(10);
    });

    it('coerces string numbers to integers', () => {
      process.env.CIRCUIT_BREAKER_THRESHOLD = '15';
      const config = loadConfig();
      expect(config.CIRCUIT_BREAKER_THRESHOLD).toBe(15);
      expect(config.CIRCUIT_BREAKER_THRESHOLD).toBeTypeOf('number');
    });

    it('coerces boolean env vars — Zod coerce.boolean treats non-empty strings as true', () => {
      // z.coerce.boolean() uses Boolean() which treats any non-empty string as true
      // Only empty string, 0, null, undefined coerce to false
      process.env.CIRCUIT_BREAKER_ENABLED = '';
      const config = loadConfig();
      expect(config.CIRCUIT_BREAKER_ENABLED).toBe(false);
    });

    it('throws ConfigurationError for invalid FIGMA_WS_URL', () => {
      process.env.FIGMA_WS_URL = 'not-a-url';
      expect(() => loadConfig()).toThrow('Configuration validation failed');
    });

    it('throws ConfigurationError for invalid LOG_LEVEL', () => {
      process.env.LOG_LEVEL = 'verbose';
      expect(() => loadConfig()).toThrow('Configuration validation failed');
    });

    it('throws ConfigurationError for negative timeout', () => {
      process.env.FIGMA_REQUEST_TIMEOUT = '-1';
      expect(() => loadConfig()).toThrow('Configuration validation failed');
    });

    it('throws ConfigurationError for non-numeric port', () => {
      process.env.HEALTH_CHECK_PORT = 'abc';
      expect(() => loadConfig()).toThrow('Configuration validation failed');
    });
  });

  describe('getConfig', () => {
    it('throws ConfigurationError if called before loadConfig', () => {
      expect(() => getConfig()).toThrow('Configuration not loaded');
    });

    it('returns config after loadConfig', () => {
      loadConfig();
      const config = getConfig();
      expect(config.NODE_ENV).toBe('test');
    });

    it('throws error with specific name', () => {
      try {
        getConfig();
      } catch (e) {
        expect((e as Error).name).toBe('ConfigurationError');
      }
    });
  });

  describe('resetConfig', () => {
    it('clears loaded config so getConfig throws again', () => {
      loadConfig();
      resetConfig();
      expect(() => getConfig()).toThrow('Configuration not loaded');
    });

    it('allows reloading with different env vars', () => {
      loadConfig();
      resetConfig();
      process.env.RETRY_MAX_ATTEMPTS = '7';
      const config = loadConfig();
      expect(config.RETRY_MAX_ATTEMPTS).toBe(7);
    });
  });

  describe('environment helpers', () => {
    it('isTest returns true in test environment', () => {
      loadConfig();
      expect(isTest()).toBe(true);
      expect(isProduction()).toBe(false);
      expect(isDevelopment()).toBe(false);
    });
  });

  describe('getConfigValue', () => {
    it('returns individual config values by key', () => {
      loadConfig();
      expect(getConfigValue('NODE_ENV')).toBe('test');
      expect(getConfigValue('FIGMA_WS_URL')).toBe('ws://localhost:8080');
      expect(getConfigValue('RETRY_MAX_ATTEMPTS')).toBe(3);
    });
  });

  describe('URL validation', () => {
    it('accepts wss:// protocol', () => {
      process.env.FIGMA_WS_URL = 'wss://figma.example.com:8080';
      const config = loadConfig();
      expect(config.FIGMA_WS_URL).toBe('wss://figma.example.com:8080');
    });

    it('accepts ws:// with non-default port', () => {
      process.env.FIGMA_WS_URL = 'ws://localhost:9999';
      const config = loadConfig();
      expect(config.FIGMA_WS_URL).toBe('ws://localhost:9999');
    });

    it('rejects non-URL string', () => {
      process.env.FIGMA_WS_URL = 'just-a-hostname';
      expect(() => loadConfig()).toThrow('Configuration validation failed');
    });

    it('rejects empty string URL', () => {
      process.env.FIGMA_WS_URL = '';
      expect(() => loadConfig()).toThrow('Configuration validation failed');
    });
  });

  describe('numeric boundary validation', () => {
    it('rejects zero timeout (must be positive)', () => {
      process.env.FIGMA_REQUEST_TIMEOUT = '0';
      expect(() => loadConfig()).toThrow('Configuration validation failed');
    });

    it('accepts port 1', () => {
      process.env.HEALTH_CHECK_PORT = '1';
      const config = loadConfig();
      expect(config.HEALTH_CHECK_PORT).toBe(1);
    });

    it('rejects port 0 (must be positive)', () => {
      process.env.HEALTH_CHECK_PORT = '0';
      expect(() => loadConfig()).toThrow('Configuration validation failed');
    });

    it('rejects floating point port', () => {
      process.env.HEALTH_CHECK_PORT = '8081.5';
      expect(() => loadConfig()).toThrow('Configuration validation failed');
    });

    it('accepts large positive timeout', () => {
      process.env.FIGMA_REQUEST_TIMEOUT = '999999';
      const config = loadConfig();
      expect(config.FIGMA_REQUEST_TIMEOUT).toBe(999999);
    });

    it('rejects negative retry attempts', () => {
      process.env.RETRY_MAX_ATTEMPTS = '-1';
      expect(() => loadConfig()).toThrow('Configuration validation failed');
    });
  });

  describe('boolean coercion edge cases', () => {
    it('treats "false" string as true (Zod coerce.boolean uses Boolean())', () => {
      // This is actual Zod behavior: Boolean("false") === true
      process.env.CIRCUIT_BREAKER_ENABLED = 'false';
      const config = loadConfig();
      expect(config.CIRCUIT_BREAKER_ENABLED).toBe(true);
    });

    it('treats "0" string as true (Boolean("0") === true)', () => {
      process.env.HEALTH_CHECK_ENABLED = '0';
      const config = loadConfig();
      expect(config.HEALTH_CHECK_ENABLED).toBe(true);
    });
  });

  describe('environment helpers with different NODE_ENV', () => {
    it('isProduction returns true when NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production';
      loadConfig();
      expect(isProduction()).toBe(true);
      expect(isDevelopment()).toBe(false);
      expect(isTest()).toBe(false);
    });

    it('isDevelopment returns true when NODE_ENV=development', () => {
      process.env.NODE_ENV = 'development';
      loadConfig();
      expect(isDevelopment()).toBe(true);
      expect(isProduction()).toBe(false);
      expect(isTest()).toBe(false);
    });

    it('rejects invalid NODE_ENV', () => {
      process.env.NODE_ENV = 'qa';
      expect(() => loadConfig()).toThrow('Configuration validation failed');
    });
  });

  describe('ConfigurationError thrown by getConfig', () => {
    it('has correct name and key fields', () => {
      try {
        getConfig();
        expect.fail('Should have thrown');
      } catch (e) {
        expect((e as Error).name).toBe('ConfigurationError');
        expect((e as { key: string }).key).toBe('config');
      }
    });
  });
});
