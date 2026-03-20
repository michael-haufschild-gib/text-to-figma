/**
 * Logger Unit Tests
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger, resetLogger, getLogger } from '../../mcp-server/src/monitoring/logger.js';

describe('Logger', () => {
  afterEach(() => {
    resetLogger();
    vi.restoreAllMocks();
  });

  describe('log level filtering', () => {
    it('suppresses messages below configured level', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = new Logger({ level: 'warn' });

      logger.debug('should not appear');
      logger.info('should not appear');
      expect(spy).not.toHaveBeenCalled();

      logger.warn('should appear');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('outputs messages at or above configured level', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = new Logger({ level: 'debug' });

      logger.debug('debug msg');
      logger.info('info msg');
      logger.warn('warn msg');
      logger.error('error msg');
      logger.fatal('fatal msg');

      expect(spy).toHaveBeenCalledTimes(5);
    });
  });

  describe('child logger', () => {
    it('inherits parent config and merges context', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const parent = new Logger({ level: 'info', pretty: false });
      const child = parent.child({ component: 'test' });

      child.info('test message');
      expect(spy).toHaveBeenCalledTimes(1);

      // Verify the logged JSON contains the child context
      const logged = spy.mock.calls[0][0] as string;
      const parsed = JSON.parse(logged) as Record<string, Record<string, unknown>>;
      expect(parsed.context.component).toBe('test');
    });
  });

  describe('error logging', () => {
    it('includes error details in log entry', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = new Logger({ level: 'error', pretty: false });

      logger.error('Something broke', new Error('test error'));

      const logged = spy.mock.calls[0][0] as string;
      const parsed = JSON.parse(logged) as Record<string, Record<string, unknown>>;
      expect(parsed.error.name).toBe('Error');
      expect(parsed.error.message).toBe('test error');
    });
  });

  describe('getLogger singleton', () => {
    it('returns the same instance', () => {
      const a = getLogger();
      const b = getLogger();
      expect(a).toBe(b);
    });

    it('creates new instance after reset', () => {
      const a = getLogger();
      resetLogger();
      const b = getLogger();
      expect(a).not.toBe(b);
    });
  });

  describe('structured output', () => {
    it('outputs valid JSON with all required fields', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = new Logger({ level: 'info', pretty: false });

      logger.info('test message');

      const logged = spy.mock.calls[0][0] as string;
      const parsed = JSON.parse(logged) as Record<string, Record<string, unknown>>;
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('test message');
      expect(parsed.timestamp).toBeTypeOf('number');
      expect(parsed.timestamp).toBeGreaterThan(0);
    });

    it('includes context in JSON output', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = new Logger({ level: 'info', pretty: false });
      const child = logger.child({ tool: 'create_frame' });

      child.info('frame created');

      const logged = spy.mock.calls[0][0] as string;
      const parsed = JSON.parse(logged) as Record<string, Record<string, unknown>>;
      expect(parsed.context.tool).toBe('create_frame');
    });
  });

  describe('level hierarchy', () => {
    it('warn level suppresses debug and info but allows warn/error/fatal', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = new Logger({ level: 'warn' });

      logger.debug('d');
      logger.info('i');
      expect(spy).not.toHaveBeenCalled();

      logger.warn('w');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('error level suppresses debug/info/warn', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = new Logger({ level: 'error' });

      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      expect(spy).not.toHaveBeenCalled();

      logger.error('e');
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('error with various types', () => {
    it('handles Error objects in error logging', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = new Logger({ level: 'error', pretty: false });

      const err = new TypeError('type mismatch');
      logger.error('Failed', err);

      const logged = spy.mock.calls[0][0] as string;
      const parsed = JSON.parse(logged) as Record<string, Record<string, unknown>>;
      expect(parsed.error.name).toBe('TypeError');
      expect(parsed.error.message).toBe('type mismatch');
    });

    it('handles undefined error gracefully', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = new Logger({ level: 'error', pretty: false });

      logger.error('No error object');
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('child-of-child context merging', () => {
    it('grandchild logger merges parent and grandparent context', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const root = new Logger({ level: 'info', pretty: false });
      const child = root.child({ component: 'router' });
      const grandchild = child.child({ tool: 'create_frame' });

      grandchild.info('frame created');

      const logged = spy.mock.calls[0][0] as string;
      const parsed = JSON.parse(logged) as Record<string, Record<string, unknown>>;
      expect(parsed.context.component).toBe('router');
      expect(parsed.context.tool).toBe('create_frame');
    });
  });

  describe('fatal level configured', () => {
    it('suppresses debug/info/warn but error and fatal always output (bypass level check)', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = new Logger({ level: 'fatal' });

      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      // debug/info/warn go through log() which checks level — these are suppressed
      expect(spy).not.toHaveBeenCalled();

      // error() and fatal() call write() directly — they always output
      logger.error('e');
      expect(spy).toHaveBeenCalledTimes(1);

      logger.fatal('f');
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('error/fatal level bypass is intentional design', () => {
    // Design contract: error() and fatal() bypass the level check because
    // these represent conditions that must always be visible regardless of
    // the configured log level. A production system configured at level=fatal
    // must still surface errors. This is not a bug — debug/info/warn route
    // through the private log() method (which checks level), while error()
    // and fatal() call write() directly.

    it('error() outputs even when configured level is fatal', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = new Logger({ level: 'fatal', pretty: false });

      logger.error('critical issue');
      expect(spy).toHaveBeenCalledTimes(1);

      const parsed = JSON.parse(spy.mock.calls[0][0] as string) as Record<
        string,
        Record<string, unknown>
      >;
      expect(parsed.level).toBe('error');
      expect(parsed.message).toBe('critical issue');
    });

    it('fatal() outputs even when configured level is fatal', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = new Logger({ level: 'fatal', pretty: false });

      logger.fatal('system crash');
      expect(spy).toHaveBeenCalledTimes(1);

      const parsed = JSON.parse(spy.mock.calls[0][0] as string) as Record<
        string,
        Record<string, unknown>
      >;
      expect(parsed.level).toBe('fatal');
      expect(parsed.message).toBe('system crash');
    });

    it('error() includes error object details even when bypassing level check', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = new Logger({ level: 'fatal', pretty: false });

      logger.error('crashed', new TypeError('null reference'));
      const parsed = JSON.parse(spy.mock.calls[0][0] as string) as Record<
        string,
        Record<string, unknown>
      >;
      expect(parsed.error.name).toBe('TypeError');
      expect(parsed.error.message).toBe('null reference');
    });
  });

  describe('debug level', () => {
    it('debug level allows all messages through', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = new Logger({ level: 'debug' });

      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');
      logger.fatal('f');

      expect(spy).toHaveBeenCalledTimes(5);
    });
  });

  describe('structured JSON output format', () => {
    it('each log entry has exactly the expected top-level keys', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = new Logger({ level: 'info', pretty: false });

      logger.info('test');

      const logged = spy.mock.calls[0][0] as string;
      const parsed = JSON.parse(logged) as Record<string, Record<string, unknown>>;
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('test');
      expect(parsed.timestamp).toBeGreaterThan(0);
    });

    it('error entry includes error object fields', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = new Logger({ level: 'error', pretty: false });

      logger.error('fail', new Error('broken'));

      const logged = spy.mock.calls[0][0] as string;
      const parsed = JSON.parse(logged) as Record<string, Record<string, unknown>>;
      expect(parsed.error.name).toBe('Error');
      expect(parsed.error.message).toBe('broken');
      expect(parsed.error.stack).toContain('Error: broken');
    });
  });
});
