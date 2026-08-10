/**
 * Auto-Validator Tests
 *
 * Tests design spec auto-correction and validation.
 */

import { describe, expect, it } from 'vitest';
import {
  autoCorrectSpec,
  validateSpec,
  formatCorrections,
  type Correction
} from '../../mcp-server/src/utils/auto-validator.js';

describe('Auto-Validator', () => {
  describe('autoCorrectSpec', () => {
    it('snaps non-grid spacing to nearest 8pt value', () => {
      const result = autoCorrectSpec({
        type: 'frame',
        name: 'test',
        props: { itemSpacing: 10, padding: 15 }
      });

      expect(result.wasModified).toBe(true);
      expect(result.corrected.props?.itemSpacing).toBe(8);
      expect(result.corrected.props?.padding).toBe(16);
      expect(result.corrections).toHaveLength(2);
    });

    it('does not modify already-valid spacing', () => {
      const result = autoCorrectSpec({
        type: 'frame',
        name: 'test',
        props: { itemSpacing: 16, padding: 24 }
      });

      expect(result.wasModified).toBe(false);
      expect(result.corrections).toHaveLength(0);
    });

    it('snaps font sizes to type scale', () => {
      const result = autoCorrectSpec({
        type: 'text',
        name: 'label',
        props: { fontSize: 14 }
      });

      expect(result.wasModified).toBe(true);
      const fontCorrection = result.corrections.find((c) => c.field === 'fontSize');
      expect(fontCorrection).toEqual(
        expect.objectContaining({
          path: 'root',
          field: 'fontSize',
          originalValue: 14,
          correctedValue: 16
        })
      );
    });

    it('rounds fractional dimensions to whole pixels', () => {
      const result = autoCorrectSpec({
        type: 'frame',
        name: 'test',
        props: { width: 100.5, height: 200.3 }
      });

      expect(result.wasModified).toBe(true);
      expect(result.corrected.props?.width).toBe(101);
      expect(result.corrected.props?.height).toBe(200);
    });

    it('does not round integer dimensions', () => {
      const result = autoCorrectSpec({
        type: 'frame',
        name: 'test',
        props: { width: 100, height: 200 }
      });

      const dimCorrections = result.corrections.filter(
        (c) => c.field === 'width' || c.field === 'height'
      );
      expect(dimCorrections).toHaveLength(0);
    });

    it('snaps cornerRadius to 8pt grid', () => {
      const result = autoCorrectSpec({
        type: 'frame',
        name: 'card',
        props: { cornerRadius: 6 }
      });

      expect(result.wasModified).toBe(true);
      const correction = result.corrections.find((c) => c.field === 'cornerRadius');
      expect(result.corrected.props?.cornerRadius).toBe(4);
      expect(correction).toEqual(
        expect.objectContaining({
          path: 'root',
          field: 'cornerRadius',
          originalValue: 6,
          correctedValue: 4
        })
      );
    });

    it('recursively corrects children', () => {
      const result = autoCorrectSpec({
        type: 'frame',
        name: 'parent',
        props: { padding: 16 },
        children: [
          {
            type: 'frame',
            name: 'child',
            props: { itemSpacing: 10, padding: 15 }
          }
        ]
      });

      const childCorrections = result.corrections.filter((c) => c.path.includes('children'));
      expect(childCorrections).toEqual([
        expect.objectContaining({
          path: 'root.children[0]',
          field: 'padding',
          originalValue: 15,
          correctedValue: 16
        }),
        expect.objectContaining({
          path: 'root.children[0]',
          field: 'itemSpacing',
          originalValue: 10,
          correctedValue: 8
        })
      ]);
    });

    it('does not modify the original spec (immutability)', () => {
      const original = {
        type: 'frame' as const,
        name: 'test',
        props: { padding: 15 }
      };
      const originalPadding = original.props.padding;

      autoCorrectSpec(original);

      expect(original.props.padding).toBe(originalPadding);
    });

    it('handles nodes without props', () => {
      const result = autoCorrectSpec({ type: 'frame', name: 'empty' });
      expect(result.wasModified).toBe(false);
    });

    it('still walks children of nodes without props', () => {
      const result = autoCorrectSpec({
        type: 'frame',
        name: 'root',
        children: [{ type: 'text', name: 'label', props: { fontSize: 14 } }]
      });

      expect(result.wasModified).toBe(true);
      expect(result.corrected.children?.[0]?.props?.fontSize).toBe(16);
      expect(result.corrections[0]?.path).toBe('root.children[0]');
    });
  });
});

describe('Auto-Validator — validateSpec and utilities', () => {
  describe('validateSpec', () => {
    it('validates a well-formed spec as valid', () => {
      const result = validateSpec({
        type: 'frame',
        name: 'container',
        props: { padding: 16, itemSpacing: 8 },
        children: [
          {
            type: 'text',
            name: 'label',
            props: { content: 'Hello', fontSize: 16 }
          }
        ]
      });

      expect(result.valid).toBe(true);
      expect(result.stats.totalNodes).toBe(2);
      expect(result.stats.nodesByType.frame).toBe(1);
      expect(result.stats.nodesByType.text).toBe(1);
      expect(result.stats.maxDepth).toBe(1);
    });

    it('reports error when non-frame has children', () => {
      const result = validateSpec({
        type: 'text',
        name: 'bad',
        children: [{ type: 'text', name: 'child', props: { content: 'x' } }]
      } as ReturnType<typeof validateSpec> extends { valid: boolean }
        ? Parameters<typeof validateSpec>[0]
        : never);

      expect(result.valid).toBe(false);
      const childError = result.issues.find(
        (i) => i.field === 'children' && i.severity === 'error'
      );
      expect(childError?.severity).toBe('error');
    });

    it('warns on off-grid spacing', () => {
      const result = validateSpec({
        type: 'frame',
        name: 'test',
        props: { padding: 15 }
      });

      const warning = result.issues.find((i) => i.field === 'padding' && i.severity === 'warning');
      expect(warning?.field).toBe('padding');
    });

    it('warns on empty text content', () => {
      const result = validateSpec({
        type: 'text',
        name: 'empty',
        props: { content: '' }
      });

      const warning = result.issues.find((i) => i.field === 'content');
      expect(warning?.field).toBe('content');
    });

    it('counts correct max depth', () => {
      const result = validateSpec({
        type: 'frame',
        name: 'root',
        children: [
          {
            type: 'frame',
            name: 'mid',
            children: [{ type: 'text', name: 'deep', props: { content: 'x' } }]
          }
        ]
      });

      expect(result.stats.maxDepth).toBe(2);
      expect(result.stats.totalNodes).toBe(3);
    });
  });

  describe('formatCorrections', () => {
    it('returns "No corrections needed" for empty array', () => {
      expect(formatCorrections([])).toBe('No corrections needed');
    });

    it('formats corrections with count and details', () => {
      const corrections: Correction[] = [
        {
          path: 'root',
          field: 'padding',
          originalValue: 15,
          correctedValue: 16,
          reason: 'Snapped to 8pt grid'
        }
      ];

      const formatted = formatCorrections(corrections);
      expect(formatted).toContain('1 auto-correction');
      expect(formatted).toContain('padding');
      expect(formatted).toContain('8pt grid');
    });

    it('formats multiple corrections', () => {
      const corrections: Correction[] = [
        { path: 'root', field: 'padding', originalValue: 15, correctedValue: 16, reason: 'grid' },
        { path: 'root', field: 'fontSize', originalValue: 14, correctedValue: 16, reason: 'scale' }
      ];
      const formatted = formatCorrections(corrections);
      expect(formatted).toContain('2 auto-correction');
    });
  });
});
