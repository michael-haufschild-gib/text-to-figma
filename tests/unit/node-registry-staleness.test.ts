/**
 * Node Registry Staleness Tracking Tests
 *
 * Tests for setContext, markStale, markFresh, isStale, getContext,
 * and their interaction with clear() and getStats().
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { NodeRegistry } from '../../mcp-server/src/node-registry.js';

describe('NodeRegistry staleness tracking', () => {
  let registry: NodeRegistry;

  beforeEach(() => {
    registry = new NodeRegistry();
  });

  describe('initial state', () => {
    it('starts not stale', () => {
      expect(registry.isStale()).toBe(false);
    });

    it('starts with null context', () => {
      const ctx = registry.getContext();
      expect(ctx.pageId).toBeNull();
      expect(ctx.fileName).toBeNull();
      expect(ctx.lastRefreshed).toBe(0);
    });

    it('getStats reports isStale false initially', () => {
      expect(registry.getStats().isStale).toBe(false);
    });
  });

  describe('setContext', () => {
    it('stores page and file context', () => {
      registry.setContext('page-1', 'File A');
      const ctx = registry.getContext();
      expect(ctx.pageId).toBe('page-1');
      expect(ctx.fileName).toBe('File A');
    });

    it('does not mark stale on first call (null → value)', () => {
      registry.setContext('page-1', 'File A');
      expect(registry.isStale()).toBe(false);
    });

    it('does not mark stale when context is unchanged', () => {
      registry.setContext('page-1', 'File A');
      registry.setContext('page-1', 'File A');
      expect(registry.isStale()).toBe(false);
    });

    it('marks stale when pageId changes', () => {
      registry.setContext('page-1', 'File A');
      registry.setContext('page-2', 'File A');
      expect(registry.isStale()).toBe(true);
    });

    it('marks stale when fileName changes', () => {
      registry.setContext('page-1', 'File A');
      registry.setContext('page-1', 'File B');
      expect(registry.isStale()).toBe(true);
    });

    it('marks stale when both change', () => {
      registry.setContext('page-1', 'File A');
      registry.setContext('page-2', 'File B');
      expect(registry.isStale()).toBe(true);
    });
  });

  describe('markStale / markFresh', () => {
    it('markStale sets stale to true', () => {
      registry.markStale();
      expect(registry.isStale()).toBe(true);
    });

    it('markFresh clears stale flag', () => {
      registry.markStale();
      registry.markFresh();
      expect(registry.isStale()).toBe(false);
    });

    it('markFresh updates lastRefreshed timestamp', () => {
      const before = Date.now();
      registry.markFresh();
      const after = Date.now();
      const ctx = registry.getContext();
      expect(ctx.lastRefreshed).toBeGreaterThanOrEqual(before);
      expect(ctx.lastRefreshed).toBeLessThanOrEqual(after);
    });

    it('markFresh optionally updates context', () => {
      registry.markFresh('page-99', 'Fresh File');
      const ctx = registry.getContext();
      expect(ctx.pageId).toBe('page-99');
      expect(ctx.fileName).toBe('Fresh File');
    });

    it('markFresh without args preserves existing context', () => {
      registry.setContext('page-1', 'File A');
      registry.markFresh();
      const ctx = registry.getContext();
      expect(ctx.pageId).toBe('page-1');
      expect(ctx.fileName).toBe('File A');
    });
  });

  describe('interaction with clear()', () => {
    it('clear does not reset staleness flag', () => {
      registry.markStale();
      registry.clear();
      expect(registry.isStale()).toBe(true);
    });

    it('clear does not reset context identifiers', () => {
      registry.setContext('page-1', 'File A');
      registry.clear();
      const ctx = registry.getContext();
      expect(ctx.pageId).toBe('page-1');
      expect(ctx.fileName).toBe('File A');
    });
  });

  describe('getStats includes staleness', () => {
    it('reflects stale=true in stats', () => {
      registry.markStale();
      expect(registry.getStats().isStale).toBe(true);
    });

    it('reflects stale=false after markFresh', () => {
      registry.markStale();
      registry.markFresh();
      expect(registry.getStats().isStale).toBe(false);
    });
  });
});
