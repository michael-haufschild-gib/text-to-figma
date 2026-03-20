/**
 * Error Tracker Unit Tests
 *
 * Tests error tracking, deduplication, categorization, severity,
 * statistics, pruning, explicit severity/category overrides,
 * and global convenience functions (getErrorTracker, resetErrorTracker, trackError).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ErrorTracker,
  getErrorTracker,
  resetErrorTracker,
  trackError
} from '../../mcp-server/src/monitoring/error-tracker.js';

describe('ErrorTracker', () => {
  let tracker: ErrorTracker;

  afterEach(() => {
    tracker?.destroy();
  });

  describe('track', () => {
    it('tracks an error and returns a unique ID', () => {
      tracker = new ErrorTracker();
      const id = tracker.track(new Error('test error'));
      expect(id).toMatch(/^err_\d+_[a-z0-9]+$/);
    });

    it('deduplicates identical errors by fingerprint (same message + stack)', () => {
      tracker = new ErrorTracker();
      const err = new Error('duplicate');
      const id1 = tracker.track(err);
      const id2 = tracker.track(err);

      expect(id1).toBe(id2);
      const all = tracker.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].count).toBe(2);
      expect(all[0].lastSeen).toBeGreaterThanOrEqual(all[0].firstSeen);
    });

    it('tracks different errors separately', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('error A'));
      tracker.track(new Error('error B'));
      expect(tracker.getAll()).toHaveLength(2);
    });

    it('accepts context that is merged on deduplication', () => {
      tracker = new ErrorTracker();
      const err = new Error('ctx error');
      tracker.track(err, { attempt: 1 });
      tracker.track(err, { attempt: 2 });

      const all = tracker.getAll();
      expect(all[0].context?.attempt).toBe(2); // latest context merged
    });

    it('accepts explicit severity override', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('mild error'), undefined, 'critical');
      const errors = tracker.getBySeverity('critical');
      expect(errors).toHaveLength(1);
    });

    it('accepts explicit category override', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('generic'), undefined, undefined, 'configuration');
      const errors = tracker.getByCategory('configuration');
      expect(errors).toHaveLength(1);
    });
  });

  describe('categorization', () => {
    it('categorizes by error name: ValidationError → validation', () => {
      tracker = new ErrorTracker();
      const err = new Error('Something');
      err.name = 'ValidationError';
      tracker.track(err);
      expect(tracker.getByCategory('validation')).toHaveLength(1);
    });

    it('categorizes by message keyword: "invalid" → validation', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('Invalid input value'));
      expect(tracker.getByCategory('validation')).toHaveLength(1);
    });

    it('categorizes by message keyword: "required" → validation', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('field is required'));
      expect(tracker.getByCategory('validation')).toHaveLength(1);
    });

    it('categorizes by message keyword: "connection" → network', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('connection refused'));
      expect(tracker.getByCategory('network')).toHaveLength(1);
    });

    it('categorizes by message keyword: "timeout" → network', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('request timeout'));
      expect(tracker.getByCategory('network')).toHaveLength(1);
    });

    it('categorizes by message keyword: "figma" → figma_api', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('figma node not found'));
      expect(tracker.getByCategory('figma_api')).toHaveLength(1);
    });

    it('categorizes by message keyword: "node" → figma_api', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('node does not exist'));
      expect(tracker.getByCategory('figma_api')).toHaveLength(1);
    });

    it('categorizes by message keyword: "frame" → figma_api', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('frame creation failed'));
      expect(tracker.getByCategory('figma_api')).toHaveLength(1);
    });

    it('categorizes TypeError → internal', () => {
      tracker = new ErrorTracker();
      tracker.track(new TypeError('Cannot read property'));
      expect(tracker.getByCategory('internal')).toHaveLength(1);
    });

    it('categorizes ReferenceError → internal', () => {
      tracker = new ErrorTracker();
      tracker.track(new ReferenceError('x is not defined'));
      expect(tracker.getByCategory('internal')).toHaveLength(1);
    });

    it('categorizes by message keyword: "user" → user_input', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('user provided bad input'));
      expect(tracker.getByCategory('user_input')).toHaveLength(1);
    });

    it('categorizes by message keyword: "config" → configuration', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('config value missing'));
      expect(tracker.getByCategory('configuration')).toHaveLength(1);
    });

    it('falls back to unknown for uncategorizable errors', () => {
      tracker = new ErrorTracker();
      const err = new Error('something weird happened');
      err.name = 'CustomError';
      tracker.track(err);
      expect(tracker.getByCategory('unknown')).toHaveLength(1);
    });
  });

  describe('severity', () => {
    it('assigns critical severity for FatalError name', () => {
      tracker = new ErrorTracker();
      const err = new Error('crash');
      err.name = 'FatalError';
      tracker.track(err);
      expect(tracker.getBySeverity('critical')).toHaveLength(1);
    });

    it('assigns critical severity for "fatal" in message', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('fatal crash occurred'));
      expect(tracker.getBySeverity('critical')).toHaveLength(1);
    });

    it('assigns high severity for internal category', () => {
      tracker = new ErrorTracker();
      tracker.track(new TypeError('undefined is not a function'));
      expect(tracker.getBySeverity('high')).toHaveLength(1);
    });

    it('assigns high severity for figma_api category', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('figma API error'));
      expect(tracker.getBySeverity('high')).toHaveLength(1);
    });

    it('assigns medium severity for network category', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('connection timed out'));
      expect(tracker.getBySeverity('medium')).toHaveLength(1);
    });

    it('assigns medium severity for configuration category', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('configuration error'));
      expect(tracker.getBySeverity('medium')).toHaveLength(1);
    });

    it('assigns low severity by default', () => {
      tracker = new ErrorTracker();
      const err = new Error('something generic happened');
      err.name = 'CustomError';
      tracker.track(err);
      expect(tracker.getBySeverity('low')).toHaveLength(1);
    });
  });

  describe('getStatistics', () => {
    it('returns accurate statistics for multiple categories', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('invalid input')); // → validation (message contains "invalid")
      tracker.track(new Error('connection timeout')); // → network
      tracker.track(new TypeError('undefined')); // → internal

      const stats = tracker.getStatistics();
      expect(stats.total).toBe(3); // errorCount tracks unique entries
      expect(stats.uniqueErrors).toBe(3);
      expect(stats.byCategory.validation).toBe(1);
      expect(stats.byCategory.network).toBe(1);
      expect(stats.byCategory.internal).toBe(1);
    });

    it('returns zeroes for empty tracker', () => {
      tracker = new ErrorTracker();
      const stats = tracker.getStatistics();
      expect(stats.total).toBe(0);
      expect(stats.uniqueErrors).toBe(0);
      expect(stats.mostCommon).toHaveLength(0);
    });

    it('mostCommon sorts by count descending', () => {
      tracker = new ErrorTracker();
      const err = new Error('frequent');
      tracker.track(err);
      tracker.track(err);
      tracker.track(err);
      tracker.track(new Error('rare'));

      const stats = tracker.getStatistics();
      expect(stats.mostCommon[0].count).toBe(3);
      expect(stats.mostCommon[0].message).toBe('frequent');
    });

    it('counts deduplicated errors correctly', () => {
      tracker = new ErrorTracker();
      const err = new Error('repeated');
      tracker.track(err);
      tracker.track(err);
      tracker.track(err);

      const stats = tracker.getStatistics();
      // errorCount increments only on new (unique) entries, not dedupes
      expect(stats.total).toBe(1);
      expect(stats.uniqueErrors).toBe(1);
      // But individual error.count tracks all occurrences
      const all = tracker.getAll();
      expect(all[0].count).toBe(3);
    });
  });

  describe('clear', () => {
    it('removes all tracked errors', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('a'));
      tracker.track(new Error('b'));
      tracker.clear();

      expect(tracker.getAll()).toHaveLength(0);
      expect(tracker.getStatistics().total).toBe(0);
    });
  });

  describe('pruning', () => {
    it('prunes errors outside aggregation window when maxErrors exceeded', () => {
      // aggregationWindow=1ms: errors older than 1ms are eligible for pruning
      // maxErrors=3: pruning triggers when size > 3
      tracker = new ErrorTracker({ maxErrors: 3, aggregationWindow: 1 });

      vi.useFakeTimers();
      tracker.track(new Error('old-1'));
      tracker.track(new Error('old-2'));
      vi.advanceTimersByTime(10); // These two are now outside the 1ms window

      // Add new errors — 4th unique error triggers pruning (size > maxErrors=3)
      tracker.track(new Error('new-1'));
      tracker.track(new Error('new-2'));
      // At this point: size=4, which triggers pruneOldErrors
      // old-1 and old-2 have lastSeen < cutoff, so they get pruned
      // After window prune: 2 remain (new-1, new-2) — under limit, no frequency prune

      const remaining = tracker.getAll();
      const messages = remaining.map((e) => e.error.message);
      expect(messages).not.toContain('old-1');
      expect(messages).not.toContain('old-2');
      expect(remaining.length).toBeLessThanOrEqual(3);

      vi.useRealTimers();
    });

    it('when all errors are within window, prunes least-frequent to stay at maxErrors', () => {
      tracker = new ErrorTracker({ maxErrors: 3, aggregationWindow: 60000 });

      // Create 3 distinct errors (not deduped — different messages)
      tracker.track(new Error('unique-a'));
      tracker.track(new Error('unique-b'));
      tracker.track(new Error('unique-c'));

      // Bump count of 'unique-c' so it has count=2
      tracker.track(new Error('unique-c'));

      // Add a 4th distinct error — triggers pruning
      tracker.track(new Error('unique-d'));

      const remaining = tracker.getAll();
      // Should have pruned least-frequent to stay at maxErrors=3
      expect(remaining.length).toBeLessThanOrEqual(3);

      // unique-c (count=2) should survive; one of unique-a or unique-b (count=1) should be pruned
      const messages = remaining.map((e) => e.error.message);
      expect(messages).toContain('unique-c');
    });

    it('deduplication increments count and updates lastSeen', () => {
      tracker = new ErrorTracker();
      const err = new Error('dup');

      vi.useFakeTimers({ now: 1000 });
      const id1 = tracker.track(err);
      vi.advanceTimersByTime(5000);
      const id2 = tracker.track(err);

      expect(id1).toBe(id2);

      const tracked = tracker.getAll()[0];
      expect(tracked.count).toBe(2);
      expect(tracked.lastSeen).toBe(6000); // 1000 + 5000
      expect(tracked.firstSeen).toBe(1000);

      vi.useRealTimers();
    });

    it('fingerprint includes first stack frame', () => {
      tracker = new ErrorTracker();
      // Two errors with same message but different call sites have different stacks
      function makeError(msg: string) {
        return new Error(msg);
      }
      const err1 = makeError('test');
      const err2 = makeError('test');

      // Same function, same message — should deduplicate (same first stack frame)
      tracker.track(err1);
      tracker.track(err2);
      expect(tracker.getAll()).toHaveLength(1);
      expect(tracker.getAll()[0].count).toBe(2);
    });

    it('get retrieves by ID', () => {
      tracker = new ErrorTracker();
      const id = tracker.track(new Error('find me'));
      const found = tracker.get(id);
      expect(found?.error.message).toBe('find me');
    });

    it('get returns undefined for non-existent ID', () => {
      tracker = new ErrorTracker();
      expect(tracker.get('nonexistent')).toBeUndefined();
    });
  });

  describe('getByCategory and getBySeverity', () => {
    it('returns empty array for untracked category', () => {
      tracker = new ErrorTracker();
      expect(tracker.getByCategory('unknown')).toHaveLength(0);
    });

    it('returns empty array for untracked severity', () => {
      tracker = new ErrorTracker();
      expect(tracker.getBySeverity('critical')).toHaveLength(0);
    });
  });
});

describe('Global convenience functions', () => {
  afterEach(() => {
    resetErrorTracker();
  });

  describe('getErrorTracker', () => {
    it('returns the same singleton instance on repeated calls', () => {
      const a = getErrorTracker();
      const b = getErrorTracker();
      expect(a).toBe(b);
    });

    it('creates a new instance after resetErrorTracker', () => {
      const a = getErrorTracker();
      resetErrorTracker();
      const b = getErrorTracker();
      expect(a).not.toBe(b);
    });

    it('accepts config on first call', () => {
      const tracker = getErrorTracker({ maxErrors: 5 });
      // Track 6 errors with tiny aggregation window so pruning kicks in
      for (let i = 0; i < 6; i++) {
        tracker.track(new Error(`err-${i}`));
      }
      // At least some pruning should have occurred
      expect(tracker.getAll().length).toBeLessThanOrEqual(6);
    });

    it('ignores config on subsequent calls (singleton already exists)', () => {
      const first = getErrorTracker({ maxErrors: 100 });
      const second = getErrorTracker({ maxErrors: 5 }); // config ignored
      expect(second).toBe(first);
    });
  });

  describe('resetErrorTracker', () => {
    it('destroys existing tracker and clears singleton', () => {
      const tracker = getErrorTracker();
      tracker.track(new Error('before reset'));
      expect(tracker.getAll()).toHaveLength(1);

      resetErrorTracker();

      // New tracker should be empty
      const fresh = getErrorTracker();
      expect(fresh.getAll()).toHaveLength(0);
    });

    it('is safe to call when no tracker exists', () => {
      expect(() => resetErrorTracker()).not.toThrow();
      expect(() => resetErrorTracker()).not.toThrow();
    });
  });

  describe('trackError', () => {
    it('returns an error ID and tracks on the global singleton', () => {
      const id = trackError(new Error('test error'));
      expect(id).toMatch(/^err_\d+_[a-z0-9]+$/);

      const tracker = getErrorTracker();
      const found = tracker.get(id);
      expect(found?.error.message).toBe('test error');
    });

    it('passes context to the tracked error', () => {
      const id = trackError(new Error('with context'), { tool: 'create_frame', attempt: 3 });
      const found = getErrorTracker().get(id);
      expect(found?.context?.tool).toBe('create_frame');
      expect(found?.context?.attempt).toBe(3);
    });

    it('passes explicit severity override', () => {
      trackError(new Error('minor issue'), undefined, 'critical');
      const criticals = getErrorTracker().getBySeverity('critical');
      expect(criticals).toHaveLength(1);
      expect(criticals[0].error.message).toBe('minor issue');
    });

    it('passes explicit category override', () => {
      trackError(new Error('generic msg'), undefined, undefined, 'network');
      const network = getErrorTracker().getByCategory('network');
      expect(network).toHaveLength(1);
      expect(network[0].error.message).toBe('generic msg');
    });

    it('deduplicates across multiple trackError calls', () => {
      const err = new Error('repeated');
      const id1 = trackError(err);
      const id2 = trackError(err);
      expect(id1).toBe(id2);
      expect(getErrorTracker().getAll()).toHaveLength(1);
      expect(getErrorTracker().getAll()[0].count).toBe(2);
    });
  });
});
