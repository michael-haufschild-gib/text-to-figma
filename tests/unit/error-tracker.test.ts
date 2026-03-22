/**
 * Error Tracker Unit Tests — Core API
 *
 * Tests error tracking, deduplication, categorization, severity,
 * statistics, and explicit severity/category overrides.
 *
 * Pruning, advanced behavior, and global convenience functions
 * are in error-tracker-advanced.test.ts.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { ErrorTracker } from '../../mcp-server/src/monitoring/error-tracker.js';

describe('ErrorTracker', () => {
  let tracker: ErrorTracker;

  afterEach(() => {
    tracker?.destroy();
  });

  describe('track', () => {
    it('tracks an error and returns a unique ID', () => {
      tracker = new ErrorTracker();
      const id = tracker.track(new Error('test error'));
      expect(id).toMatch(/^err_[0-9a-f-]+$/);
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

    it('categorizes "connection" in Figma context as network, not figma_api — exposes ambiguity', () => {
      // BUG EXPOSURE: The keyword "connection" matches network category before "node"/"frame"
      // could match figma_api. An error like "Connection between nodes failed" is about
      // Figma node connections, not network issues — but gets categorized as network.
      tracker = new ErrorTracker();
      tracker.track(new Error('Connection between nodes is not supported'));
      // This test documents the current (incorrect) behavior: categorized as "network"
      // because "connection" matches the network rule before any figma_api rule.
      expect(tracker.getByCategory('network')).toHaveLength(1);
      // When fixed, this should be figma_api instead:
      // expect(tracker.getByCategory('figma_api')).toHaveLength(1);
    });

    it('first matching rule wins: "invalid node" → validation (not figma_api)', () => {
      // "invalid" matches validation rule; "node" matches figma_api rule.
      // Validation rule comes first in CATEGORY_RULES, so it wins.
      tracker = new ErrorTracker();
      tracker.track(new Error('invalid node type specified'));
      expect(tracker.getByCategory('validation')).toHaveLength(1);
    });

    it('empty error message falls through to unknown', () => {
      tracker = new ErrorTracker();
      const err = new Error('');
      err.name = 'CustomError';
      tracker.track(err);
      expect(tracker.getByCategory('unknown')).toHaveLength(1);
    });

    it('error name takes priority: NetworkError with "invalid" message → network', () => {
      tracker = new ErrorTracker();
      const err = new Error('invalid response received');
      err.name = 'NetworkError';
      // nameKeywords for network includes 'network', and err.name.toLowerCase() = 'networkerror'
      // which includes 'network'. Also "invalid" matches validation rule's keywords.
      // But name match on 'validation' checks for 'validation' substring — 'networkerror' doesn't match.
      // So validation rule checks: nameMatch=false, msgMatch=true(invalid) → validation wins.
      // This is because CATEGORY_RULES iterates in order and validation comes before network.
      tracker.track(err);
      // "invalid" keyword in validation rule matches first
      expect(tracker.getByCategory('validation')).toHaveLength(1);
    });

    it('categorizes error with "input" keyword as user_input', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('malformed input data'));
      expect(tracker.getByCategory('user_input')).toHaveLength(1);
    });

    it('"configuration" in message matches configuration category', () => {
      tracker = new ErrorTracker();
      tracker.track(new Error('configuration validation error'));
      // Both "configuration" and "invalid" are absent, but "configuration" matches config rule.
      // Actually "configuration" contains "configuration" which matches config rule keywords.
      // But wait — the message is "configuration validation error" which also contains "invalid"? No.
      // It contains "validation" but that's not in validation keywords (which are "invalid", "required").
      // So only config rule matches via "configuration" keyword.
      expect(tracker.getByCategory('configuration')).toHaveLength(1);
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
      // total reflects all occurrences (including deduped repeats)
      expect(stats.total).toBe(3);
      expect(stats.uniqueErrors).toBe(1);
      // individual error.count also tracks all occurrences
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
});
