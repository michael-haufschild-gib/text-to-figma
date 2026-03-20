/**
 * Handler formatResponse Tests — Utility Tools
 *
 * Extracted from handler-formatters-layout.test.ts to stay under max-lines.
 * Tests formatting for visibility, lock, path, boolean, component set,
 * instance, alignment, distribution, constraints, and page tools.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { getToolRegistry, resetToolRegistry } from '../../mcp-server/src/routing/tool-registry.js';
import { registerAllTools } from '../../mcp-server/src/routing/register-tools.js';

describe('Handler formatResponse — utility tools', () => {
  beforeEach(() => {
    resetToolRegistry();
    registerAllTools();
  });

  function getHandler(name: string) {
    const handler = getToolRegistry().get(name);
    if (!handler) throw new Error(`Handler ${name} not registered`);
    return handler;
  }

  describe('set_visible', () => {
    it('formats visibility with state and CSS equivalent', () => {
      const handler = getHandler('set_visible');
      const result = handler.formatResponse({
        message: 'Visibility changed',
        nodeId: 'n1',
        visible: false,
        cssEquivalent: 'display: none;'
      });
      const text = result[0].text as string;
      expect(text).toContain('Visibility changed');
      expect(text).toContain('Node ID: n1');
      expect(text).toContain('Visible: false');
      expect(text).toContain('display: none;');
    });
  });

  describe('set_locked', () => {
    it('formats lock state with node ID and locked value', () => {
      const handler = getHandler('set_locked');
      const result = handler.formatResponse({
        message: 'Lock state changed',
        nodeId: 'n1',
        locked: true
      });
      const text = result[0].text as string;
      expect(text).toContain('Lock state changed');
      expect(text).toContain('Node ID: n1');
      expect(text).toContain('Locked: true');
    });
  });

  describe('create_path', () => {
    it('formats path creation using message field', () => {
      const handler = getHandler('create_path');
      const result = handler.formatResponse({
        message: 'Path created: path-1 with 5 commands'
      });
      const text = result[0].text as string;
      expect(text).toContain('Path created');
      expect(text).toContain('path-1');
    });
  });

  describe('create_boolean_operation', () => {
    it('formats boolean operation with all fields', () => {
      const handler = getHandler('create_boolean_operation');
      const result = handler.formatResponse({
        booleanNodeId: 'bool-1',
        message: 'Boolean created',
        operation: 'UNION',
        nodeCount: 3,
        cssEquivalent: 'clip-path: union;'
      });
      const text = result[0].text as string;
      expect(text).toContain('Boolean Node ID: bool-1');
      expect(text).toContain('Boolean created');
      expect(text).toContain('Operation: UNION');
      expect(text).toContain('Node Count: 3');
      expect(text).toContain('clip-path: union;');
    });
  });

  describe('create_component_set', () => {
    it('formats component set with name and variant count', () => {
      const handler = getHandler('create_component_set');
      const result = handler.formatResponse({
        componentSetId: 'cs-1',
        message: 'Component set created',
        name: 'Button',
        variantCount: 4
      });
      const text = result[0].text as string;
      expect(text).toContain('Component Set ID: cs-1');
      expect(text).toContain('Component set created');
      expect(text).toContain('Name: Button');
      expect(text).toContain('Variants: 4');
    });
  });

  describe('create_instance', () => {
    it('formats instance with component ID and overrides count', () => {
      const handler = getHandler('create_instance');
      const result = handler.formatResponse({
        instanceId: 'inst-1',
        message: 'Instance created',
        componentId: 'comp-1',
        overridesApplied: 2
      });
      const text = result[0].text as string;
      expect(text).toContain('Instance ID: inst-1');
      expect(text).toContain('Instance Created Successfully');
      expect(text).toContain('Component ID: comp-1');
      expect(text).toContain('Overrides Applied: 2');
    });
  });

  describe('align_nodes', () => {
    it('formats alignment message (message-only formatter)', () => {
      const handler = getHandler('align_nodes');
      const result = handler.formatResponse({
        message: 'Nodes aligned to CENTER_HORIZONTAL (3 nodes)',
        alignment: 'CENTER_HORIZONTAL',
        nodeCount: 3
      });
      const text = result[0].text as string;
      expect(text).toBe('Nodes aligned to CENTER_HORIZONTAL (3 nodes)');
    });
  });

  describe('distribute_nodes', () => {
    it('formats distribution message (message-only formatter)', () => {
      const handler = getHandler('distribute_nodes');
      const result = handler.formatResponse({
        message: 'Nodes distributed HORIZONTAL with 16px spacing (4 nodes)',
        direction: 'HORIZONTAL',
        nodeCount: 4,
        spacing: 16
      });
      const text = result[0].text as string;
      expect(text).toBe('Nodes distributed HORIZONTAL with 16px spacing (4 nodes)');
    });
  });

  describe('set_constraints', () => {
    it('formats constraints result with applied list', () => {
      const handler = getHandler('set_constraints');
      const result = handler.formatResponse({
        nodeId: 'n1',
        applied: ['horizontal: MIN', 'vertical: MIN'],
        description: 'Top-left constraints',
        cssEquivalent: 'position: absolute; top: 0; left: 0;'
      });
      const text = result[0].text as string;
      expect(text).toContain('Constraints Applied');
      expect(text).toContain('n1');
    });
  });

  describe('create_page', () => {
    it('formats page creation with ID and name', () => {
      const handler = getHandler('create_page');
      const result = handler.formatResponse({
        pageId: 'pg-1',
        message: 'Page created',
        name: 'New Page'
      });
      const text = result[0].text as string;
      expect(text).toContain('Page created');
      expect(text).toContain('Page ID: pg-1');
      expect(text).toContain('Name: New Page');
    });
  });

  describe('set_current_page', () => {
    it('formats page switch with ID and name', () => {
      const handler = getHandler('set_current_page');
      const result = handler.formatResponse({
        message: 'Switched to page',
        pageId: 'pg-1',
        pageName: 'Design Page'
      });
      const text = result[0].text as string;
      expect(text).toContain('Switched to page');
      expect(text).toContain('Page ID: pg-1');
      expect(text).toContain('Page Name: Design Page');
    });
  });
});
