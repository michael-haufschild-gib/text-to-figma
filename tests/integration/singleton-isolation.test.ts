/**
 * Singleton Isolation Integration Tests
 *
 * Verifies that all singleton services (FigmaBridge, NodeRegistry, ToolRegistry,
 * Logger, MetricsRegistry, ErrorTracker) have proper reset/isolation behavior.
 *
 * These tests catch a class of bugs where:
 * - State leaks between test runs (missing reset)
 * - Reset creates a new instance but old references are still active
 * - Singleton lazy initialization race conditions
 * - Cross-module state coupling (e.g., metrics survive tool registry reset)
 */

import { describe, expect, it, afterEach } from 'vitest';
import { getNodeRegistry, resetNodeRegistry } from '../../mcp-server/src/node-registry.js';
import { getToolRegistry, resetToolRegistry } from '../../mcp-server/src/routing/tool-registry.js';
import { getMetrics, resetMetrics } from '../../mcp-server/src/monitoring/metrics.js';
import { getLogger, resetLogger } from '../../mcp-server/src/monitoring/logger.js';
import {
  getErrorTracker,
  resetErrorTracker,
  trackError
} from '../../mcp-server/src/monitoring/error-tracker.js';
import { loadConfig, resetConfig, getConfig } from '../../mcp-server/src/config.js';

describe('Singleton Isolation', () => {
  afterEach(() => {
    resetNodeRegistry();
    resetToolRegistry();
    resetMetrics();
    resetLogger();
    resetErrorTracker();
    resetConfig();
  });

  describe('NodeRegistry', () => {
    it('getNodeRegistry returns same instance on repeated calls', () => {
      const a = getNodeRegistry();
      const b = getNodeRegistry();
      expect(a).toBe(b);
    });

    it('resetNodeRegistry creates a fresh instance', () => {
      const a = getNodeRegistry();
      a.register('n1', { type: 'FRAME', name: 'F', parentId: null, children: [] });

      resetNodeRegistry();
      const b = getNodeRegistry();

      expect(b).not.toBe(a);
      expect(b.getAllNodes()).toHaveLength(0);
    });

    it('resetNodeRegistry clears old instance data before creating new one', () => {
      const old = getNodeRegistry();
      old.register('n1', { type: 'FRAME', name: 'F', parentId: null, children: [] });
      expect(old.getAllNodes()).toHaveLength(1);

      resetNodeRegistry();
      const fresh = getNodeRegistry();

      // Old reference was cleared by resetNodeRegistry (it calls .clear())
      expect(old.getAllNodes()).toHaveLength(0);
      expect(fresh.getAllNodes()).toHaveLength(0);

      // Fresh instance is a different object
      expect(fresh).not.toBe(old);

      // Mutations on old reference don't affect fresh instance
      old.register('n2', { type: 'TEXT', name: 'T', parentId: null, children: [] });
      expect(old.getAllNodes()).toHaveLength(1);
      expect(fresh.getAllNodes()).toHaveLength(0);
    });
  });

  describe('ToolRegistry', () => {
    it('getToolRegistry returns same instance on repeated calls', () => {
      const a = getToolRegistry();
      const b = getToolRegistry();
      expect(a).toBe(b);
    });

    it('resetToolRegistry nullifies the global (next call creates fresh)', () => {
      const a = getToolRegistry();
      resetToolRegistry();
      const b = getToolRegistry();

      expect(b).not.toBe(a);
      expect(b.getAll()).toHaveLength(0);
    });
  });

  describe('MetricsRegistry', () => {
    it('getMetrics returns same instance on repeated calls', () => {
      const a = getMetrics();
      const b = getMetrics();
      expect(a).toBe(b);
    });

    it('resetMetrics clears all metric values but preserves registrations', () => {
      const metrics = getMetrics();
      const counter = metrics.counter('test_counter');
      counter.inc(5);
      expect(counter.get()).toBe(5);

      resetMetrics();

      // After reset, the SAME instance is used but values are zeroed
      expect(counter.get()).toBe(0);
    });

    it('metric counters survive reset and can be re-incremented', () => {
      const metrics = getMetrics();
      const counter = metrics.counter('test_counter');
      counter.inc(10);

      resetMetrics();
      counter.inc(3);

      expect(counter.get()).toBe(3);
    });
  });

  describe('Logger', () => {
    it('getLogger returns same instance on repeated calls', () => {
      const a = getLogger();
      const b = getLogger();
      expect(a).toBe(b);
    });

    it('resetLogger creates a fresh instance', () => {
      const a = getLogger();
      resetLogger();
      const b = getLogger();

      expect(b).not.toBe(a);
    });

    it('child logger shares config with parent', () => {
      const parent = getLogger();
      const child = parent.child({ component: 'test' });

      // Both should have the same config
      const parentConfig = parent.getConfig();
      const childConfig = child.getConfig();
      expect(parentConfig.level).toBe(childConfig.level);
    });

    it('setConfig on parent propagates to children (shared reference)', () => {
      const parent = getLogger();
      const child = parent.child({ component: 'test' });

      parent.setConfig({ level: 'debug' });

      expect(parent.getConfig().level).toBe('debug');
      expect(child.getConfig().level).toBe('debug');
    });
  });

  describe('ErrorTracker', () => {
    it('getErrorTracker returns same instance on repeated calls', () => {
      const a = getErrorTracker();
      const b = getErrorTracker();
      expect(a).toBe(b);
    });

    it('resetErrorTracker destroys old instance and creates fresh on next call', () => {
      const a = getErrorTracker();
      a.track(new Error('before reset'));
      expect(a.getAll()).toHaveLength(1);

      resetErrorTracker();
      const b = getErrorTracker();

      expect(b).not.toBe(a);
      expect(b.getAll()).toHaveLength(0);
    });

    it('trackError convenience function uses the global singleton', () => {
      const id = trackError(new Error('via convenience'));
      const tracker = getErrorTracker();
      const found = tracker.get(id);
      expect(found?.error.message).toBe('via convenience');
    });

    it('trackError after reset works on the new instance', () => {
      trackError(new Error('before'));
      resetErrorTracker();
      trackError(new Error('after'));

      const tracker = getErrorTracker();
      expect(tracker.getAll()).toHaveLength(1);
      expect(tracker.getAll()[0].error.message).toBe('after');
    });
  });

  describe('Config', () => {
    it('loadConfig returns same instance on repeated calls', () => {
      const a = loadConfig();
      const b = loadConfig();
      expect(a).toBe(b);
    });

    it('resetConfig clears loaded config (getConfig throws)', () => {
      loadConfig();
      resetConfig();
      expect(() => getConfig()).toThrow('Configuration not loaded');
    });

    it('loadConfig after reset returns fresh config from current env', () => {
      loadConfig();
      resetConfig();

      const fresh = loadConfig();
      expect(fresh.NODE_ENV).toBe('test');
    });
  });

  describe('cross-module independence', () => {
    it('resetting NodeRegistry does not affect ToolRegistry', () => {
      const registry = getNodeRegistry();
      registry.register('n1', { type: 'FRAME', name: 'F', parentId: null, children: [] });

      const tools = getToolRegistry();
      // ToolRegistry should be independent of NodeRegistry
      resetNodeRegistry();

      // ToolRegistry should be unchanged
      expect(tools).toBe(getToolRegistry());
    });

    it('resetting ErrorTracker does not affect Metrics', () => {
      const metrics = getMetrics();
      const counter = metrics.counter('independent_counter');
      counter.inc(5);

      resetErrorTracker();

      // Metrics should be unchanged
      expect(counter.get()).toBe(5);
    });

    it('resetting Metrics does not affect ErrorTracker', () => {
      trackError(new Error('survives metric reset'));

      resetMetrics();

      const tracker = getErrorTracker();
      expect(tracker.getAll()).toHaveLength(1);
      expect(tracker.getAll()[0].error.message).toBe('survives metric reset');
    });
  });
});
