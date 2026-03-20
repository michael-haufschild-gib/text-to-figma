/**
 * Parent Validator Unit Tests
 *
 * Tests parent-child relationship validation, node type classification,
 * error message formatting, and hierarchy pattern examples.
 */

import { describe, expect, it } from 'vitest';
import {
  validateParentId,
  formatValidationError,
  getHierarchyPatternExamples,
  getHierarchyQuickReference,
  type ParentValidationResult
} from '../../mcp-server/src/utils/parent-validator.js';

describe('Parent Validator', () => {
  describe('validateParentId', () => {
    const childTypes = ['text', 'ellipse', 'rectangle', 'polygon', 'star', 'line', 'instance'];
    const containerTypes = ['frame', 'component', 'component_set', 'page'];

    describe('child node types without parentId', () => {
      it.each(childTypes)('warns for %s without parent (non-strict)', (nodeType) => {
        const result = validateParentId(nodeType, undefined, false);
        expect(result.isValid).toBe(true); // non-strict just warns
        expect(result.warning).toContain('HIERARCHY VIOLATION');
        expect(result.warning).toContain(nodeType);
        expect(result.suggestion).toContain('parent frame');
      });

      it.each(childTypes)('fails for %s without parent (strict)', (nodeType) => {
        const result = validateParentId(nodeType, undefined, true);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('HIERARCHY VIOLATION');
        expect(result.suggestion).toBeTypeOf('string');
      });
    });

    describe('child node types with parentId', () => {
      it.each(childTypes)('passes for %s with parent', (nodeType) => {
        const result = validateParentId(nodeType, 'parent-123');
        expect(result.isValid).toBe(true);
        expect(result.warning).toBeUndefined();
        expect(result.error).toBeUndefined();
      });
    });

    describe('container node types', () => {
      it.each(containerTypes)('passes for %s without parent', (nodeType) => {
        const result = validateParentId(nodeType, undefined);
        expect(result.isValid).toBe(true);
        expect(result.warning).toBeUndefined();
      });

      it.each(containerTypes)('passes for %s with parent', (nodeType) => {
        const result = validateParentId(nodeType, 'parent-123');
        expect(result.isValid).toBe(true);
      });
    });

    it('handles unknown node types as non-child (no validation needed)', () => {
      const result = validateParentId('unknown_type', undefined);
      expect(result.isValid).toBe(true);
    });

    it('handles empty string parentId same as undefined for child nodes', () => {
      const result = validateParentId('text', '', false);
      expect(result.warning).toContain('HIERARCHY VIOLATION');
    });

    it('strict mode default is false', () => {
      const result = validateParentId('text', undefined);
      expect(result.isValid).toBe(true); // non-strict default
      expect(result.warning).toContain('HIERARCHY VIOLATION');
    });
  });

  describe('formatValidationError', () => {
    it('formats error result', () => {
      const result: ParentValidationResult = {
        isValid: false,
        error: 'Node not found',
        suggestion: 'Create the frame first'
      };
      const formatted = formatValidationError(result);
      expect(formatted).toContain('ERROR: Node not found');
      expect(formatted).toContain('Suggestion: Create the frame first');
    });

    it('formats warning result', () => {
      const result: ParentValidationResult = {
        isValid: true,
        warning: 'No parent provided'
      };
      const formatted = formatValidationError(result);
      expect(formatted).toContain('WARNING: No parent provided');
    });

    it('formats result with all fields', () => {
      const result: ParentValidationResult = {
        isValid: false,
        error: 'Invalid parent',
        warning: 'Additional context',
        suggestion: 'Use a frame'
      };
      const formatted = formatValidationError(result);
      expect(formatted).toContain('ERROR:');
      expect(formatted).toContain('WARNING:');
      expect(formatted).toContain('Suggestion:');
    });

    it('returns empty string for valid result with no messages', () => {
      const result: ParentValidationResult = { isValid: true };
      const formatted = formatValidationError(result);
      expect(formatted).toBe('');
    });
  });

  describe('getHierarchyPatternExamples', () => {
    it('returns text patterns for "text" type', () => {
      const examples = getHierarchyPatternExamples('text');
      expect(examples).toContain('TEXT PATTERNS');
      expect(examples).toContain('Button with Text');
      expect(examples).toContain('create_design');
    });

    it('returns shape patterns for "ellipse" type', () => {
      const examples = getHierarchyPatternExamples('ellipse');
      expect(examples).toContain('SHAPE PATTERNS');
      expect(examples).toContain('Icon');
    });

    it('returns rectangle patterns for "rectangle" type', () => {
      const examples = getHierarchyPatternExamples('rectangle');
      expect(examples).toContain('RECTANGLE PATTERNS');
    });

    it('falls back to text patterns for unknown types', () => {
      const examples = getHierarchyPatternExamples('unknown');
      expect(examples).toContain('TEXT PATTERNS');
    });
  });

  describe('getHierarchyQuickReference', () => {
    it('includes tier 1 and tier 2 approaches', () => {
      const ref = getHierarchyQuickReference();
      expect(ref).toContain('TIER 1');
      expect(ref).toContain('TIER 2');
      expect(ref).toContain('create_design');
    });

    it('lists common mistakes', () => {
      const ref = getHierarchyQuickReference();
      expect(ref).toContain('COMMON MISTAKES');
      expect(ref).toContain('without parentId');
    });

    it('includes HTML analogy', () => {
      const ref = getHierarchyQuickReference();
      expect(ref).toContain('HTML ANALOGY');
      expect(ref).toContain('<div>');
    });
  });

  describe('additional node type validation', () => {
    it('instance type requires parent in strict mode', () => {
      const result = validateParentId('instance', undefined, true);
      expect(result.isValid).toBe(false);
    });

    it('case sensitivity: "TEXT" (uppercase) does not match child types', () => {
      // The validator uses lowercase comparison
      const result = validateParentId('TEXT', undefined, false);
      // 'TEXT' is not in CHILD_NODE_TYPES which uses lowercase
      expect(result.isValid).toBe(true);
      expect(result.warning).toBeUndefined(); // not treated as a child type
    });

    it('frame without parent is always valid (container type)', () => {
      const result = validateParentId('frame', undefined, true);
      expect(result.isValid).toBe(true);
    });

    it('component without parent is always valid', () => {
      const result = validateParentId('component', undefined, true);
      expect(result.isValid).toBe(true);
    });

    it('page type is a valid container', () => {
      const result = validateParentId('page', undefined, true);
      expect(result.isValid).toBe(true);
    });

    it('warning includes node type name for debugging', () => {
      const result = validateParentId('ellipse', undefined, false);
      expect(result.warning).toContain('ellipse');
    });

    it('suggestion includes actionable guidance', () => {
      const result = validateParentId('text', undefined, false);
      expect(result.suggestion!.length).toBeGreaterThan(10);
    });
  });

  describe('getHierarchyPatternExamples exhaustiveness', () => {
    const nodeTypes = ['text', 'ellipse', 'rectangle', 'polygon', 'star', 'line', 'instance'];

    it.each(nodeTypes)('returns non-empty examples for "%s" type', (nodeType) => {
      const examples = getHierarchyPatternExamples(nodeType);
      expect(examples.length).toBeGreaterThan(50);
      expect(examples).toContain('create_design');
    });
  });
});
