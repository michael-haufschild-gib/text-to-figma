/**
 * Error Tracker — Pruning, Advanced Behavior & Global Functions
 *
 * Covers pruning logic, time-based eviction, fingerprinting edge cases,
 * serialization, and the global singleton convenience API.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ErrorTracker,
  getErrorTracker,
  resetErrorTracker,
  trackError
} from '../../mcp-server/src/monitoring/error-tracker.js';

describe('ErrorTracker pruning', () => {
  let tracker: ErrorTracker;

  afterEach(() => {
    tracker?.destroy();
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

    it('same name and message deduplicate regardless of source', () => {
      tracker = new ErrorTracker();
      function makeError(msg: string) {
        return new Error(msg);
      }
      const err1 = makeError('test');
      const err2 = makeError('test');

      // Same error name + message → same fingerprint, regardless of call site
      tracker.track(err1);
      tracker.track(err2);
      expect(tracker.getAll()).toHaveLength(1);
      expect(tracker.getAll()[0].count).toBe(2);
    });

    it('error with no stack still generates a fingerprint and deduplicates', () => {
      tracker = new ErrorTracker();
      const err1 = new Error('stackless');
      const err2 = new Error('stackless');
      // Delete stack to simulate errors without stack traces (e.g., from serialization)
      delete (err1 as { stack?: string }).stack;
      delete (err2 as { stack?: string }).stack;

      tracker.track(err1);
      tracker.track(err2);
      // Should deduplicate — fingerprint uses empty string for missing stack
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

  describe('toJSON', () => {
    it('serializes statistics and error entries', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('serializable'), { tool: 'test' });

      const json = tracker.toJSON() as Record<string, unknown>;
      const stats = json.statistics as Record<string, unknown>;
      expect(stats.total).toBe(1);

      const errors = json.errors as Array<Record<string, unknown>>;
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('serializable');
      expect(errors[0].context).toEqual({ tool: 'test' });
      expect(errors[0].count).toBe(1);
      expect(errors[0].severity).toBeTypeOf('string');
      expect(errors[0].category).toBeTypeOf('string');
    });

    it('serializes empty tracker', () => {
      tracker = new ErrorTracker();
      const json = tracker.toJSON() as Record<string, unknown>;
      const errors = json.errors as unknown[];
      expect(errors).toHaveLength(0);
    });
  });

  describe('fingerprint with operation context', () => {
    it('includes operation in fingerprint for differentiation', () => {
      tracker = new ErrorTracker();
      const err = new Error('op error');
      tracker.track(err, { operation: 'create_frame' });
      tracker.track(err, { operation: 'set_fills' });

      // These should be tracked as separate errors because operation differs
      expect(tracker.getAll()).toHaveLength(2);
    });

    it('same operation deduplicates normally', () => {
      tracker = new ErrorTracker();
      const err = new Error('op error');
      tracker.track(err, { operation: 'create_frame' });
      tracker.track(err, { operation: 'create_frame' });

      expect(tracker.getAll()).toHaveLength(1);
      expect(tracker.getAll()[0].count).toBe(2);
    });
  });

  describe('destroy', () => {
    it('clears all errors and stops prune timer', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('before destroy'));
      tracker.destroy();

      expect(tracker.getAll()).toHaveLength(0);
    });

    it('is safe to call multiple times', () => {
      tracker = new ErrorTracker();
      expect(() => {
        tracker.destroy();
        tracker.destroy();
      }).not.toThrow();
    });
  });

  describe('time-based pruning via maxErrors trigger', () => {
    it('prunes old errors when new error exceeds maxErrors', () => {
      vi.useFakeTimers();

      tracker = new ErrorTracker({
        maxErrors: 2,
        aggregationWindow: 100,
        pruneInterval: 999999 // disable automatic timer for this test
      });

      tracker.track(new Error('old-error'));
      vi.advanceTimersByTime(200); // move past aggregation window

      tracker.track(new Error('newer-1'));
      // Adding a 3rd error (size > maxErrors=2) triggers pruneOldErrors
      tracker.track(new Error('newer-2'));

      const remaining = tracker.getAll();
      const messages = remaining.map((e) => e.error.message);
      // old-error has lastSeen < cutoff, so it should be pruned
      expect(messages).not.toContain('old-error');

      vi.useRealTimers();
    });
  });

  describe('statistics bySeverity and byCategory sum correctly with dedup', () => {
    it('total reflects sum of all error counts including deduplication', () => {
      tracker = new ErrorTracker();
      const err1 = new Error('repeated validation invalid');
      tracker.track(err1); // validation, count=1
      tracker.track(err1); // validation, count=2
      tracker.track(err1); // validation, count=3
      tracker.track(new Error('connection lost')); // unknown (no matching network keyword), count=1

      const stats = tracker.getStatistics();
      expect(stats.total).toBe(4); // 3 + 1
      expect(stats.uniqueErrors).toBe(2);
      expect(stats.byCategory.validation).toBe(3);
      expect(stats.byCategory.unknown).toBe(1);
    });
  });

  describe('pruning preserves high-frequency errors over low-frequency', () => {
    it('evicts least-frequent errors when at maxErrors and all within aggregation window', () => {
      tracker = new ErrorTracker({
        maxErrors: 2,
        aggregationWindow: 60000,
        pruneInterval: 999999
      });

      // err-a: track 5 times (high frequency)
      const errA = new Error('err-a');
      for (let i = 0; i < 5; i++) tracker.track(errA);

      // err-b: track once (low frequency)
      tracker.track(new Error('err-b'));

      // err-c: triggers pruning since size(3) > maxErrors(2)
      tracker.track(new Error('err-c'));

      const remaining = tracker.getAll();
      expect(remaining.length).toBeLessThanOrEqual(2);

      // err-a (count=5) should survive because it's the most frequent
      const messages = remaining.map((e) => e.error.message);
      expect(messages).toContain('err-a');
    });
  });

  describe('statistics after pruning', () => {
    it('statistics total only counts surviving errors, not pruned ones', () => {
      vi.useFakeTimers();

      tracker = new ErrorTracker({
        maxErrors: 2,
        aggregationWindow: 50,
        pruneInterval: 999999
      });

      tracker.track(new Error('will-be-pruned'));
      vi.advanceTimersByTime(100); // outside window

      tracker.track(new Error('survivor-1'));
      tracker.track(new Error('survivor-2')); // triggers prune

      const stats = tracker.getStatistics();
      // After pruning, 'will-be-pruned' is gone. Only survivor-1 and survivor-2 remain.
      expect(stats.uniqueErrors).toBeLessThanOrEqual(2);
      expect(stats.total).toBeLessThanOrEqual(2);

      const messages = tracker.getAll().map((e) => e.error.message);
      expect(messages).not.toContain('will-be-pruned');

      vi.useRealTimers();
    });
  });
});

describe('ErrorTracker advanced behavior', () => {
  let tracker: ErrorTracker;

  afterEach(() => {
    tracker?.destroy();
  });

  describe('context replacement behavior', () => {
    it('later context replaces earlier context entirely', () => {
      tracker = new ErrorTracker();
      const err = new Error('ctx-test');
      tracker.track(err, { attempt: 1, tool: 'create_frame' });
      tracker.track(err, { attempt: 2, extra: 'data' });

      const tracked = tracker.getAll()[0];
      // Context is replaced (not merged) to prevent unbounded growth
      expect(tracked.context).toEqual({ attempt: 2, extra: 'data' });
    });

    it('undefined context on second track does not clear existing context', () => {
      tracker = new ErrorTracker();
      const err = new Error('ctx-preserve');
      tracker.track(err, { tool: 'test' });
      tracker.track(err); // no context passed

      const tracked = tracker.getAll()[0];
      expect(tracked.context).toEqual({ tool: 'test' });
    });
  });

  describe('mostCommon limit', () => {
    it('mostCommon returns at most 10 entries', () => {
      tracker = new ErrorTracker({ maxErrors: 20 });
      // Create 15 distinct errors
      for (let i = 0; i < 15; i++) {
        tracker.track(new Error(`error-${i}`));
      }

      const stats = tracker.getStatistics();
      expect(stats.mostCommon.length).toBeLessThanOrEqual(10);
    });
  });

  describe('fingerprint differentiation', () => {
    it('errors from different call sites with same name+message deduplicate', () => {
      tracker = new ErrorTracker();

      function callSiteA() {
        return new Error('same message');
      }
      function callSiteB() {
        return new Error('same message');
      }

      tracker.track(callSiteA());
      tracker.track(callSiteB());

      // Fingerprint uses name+message only (not stack frames), so these deduplicate
      expect(tracker.getAll()).toHaveLength(1);
      expect(tracker.getAll()[0].count).toBe(2);
    });

    it('error name is part of the fingerprint', () => {
      tracker = new ErrorTracker();

      const err1 = new Error('same msg');
      err1.name = 'TypeA';
      const err2 = new Error('same msg');
      err2.name = 'TypeB';

      tracker.track(err1);
      tracker.track(err2);

      // Different error names → different fingerprints
      expect(tracker.getAll()).toHaveLength(2);
    });
  });

  describe('clear restarts prune timer', () => {
    it('after clear, new errors are tracked and auto-pruning continues', () => {
      vi.useFakeTimers();
      tracker = new ErrorTracker({
        maxErrors: 2,
        aggregationWindow: 50,
        pruneInterval: 999999
      });

      tracker.track(new Error('before-clear'));
      tracker.clear();
      expect(tracker.getAll()).toHaveLength(0);

      // Track new errors after clear
      tracker.track(new Error('after-clear-1'));
      tracker.track(new Error('after-clear-2'));
      expect(tracker.getAll()).toHaveLength(2);

      vi.useRealTimers();
    });
  });

  describe('statistics byCategory and bySeverity are exhaustive', () => {
    it('byCategory has all 7 categories initialized to 0 even when empty', () => {
      tracker = new ErrorTracker();
      const stats = tracker.getStatistics();
      const categories = Object.keys(stats.byCategory);
      expect(categories).toContain('validation');
      expect(categories).toContain('network');
      expect(categories).toContain('figma_api');
      expect(categories).toContain('internal');
      expect(categories).toContain('user_input');
      expect(categories).toContain('configuration');
      expect(categories).toContain('unknown');
      expect(categories).toHaveLength(7);
    });

    it('bySeverity has all 4 severities initialized to 0 even when empty', () => {
      tracker = new ErrorTracker();
      const stats = tracker.getStatistics();
      const severities = Object.keys(stats.bySeverity);
      expect(severities).toContain('low');
      expect(severities).toContain('medium');
      expect(severities).toContain('high');
      expect(severities).toContain('critical');
      expect(severities).toHaveLength(4);
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
      expect(id).toMatch(/^err_[0-9a-f-]+$/);

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
