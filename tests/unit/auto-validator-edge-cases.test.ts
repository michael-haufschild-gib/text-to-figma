/**
 * Auto-Validator Edge Case Tests
 *
 * Keeps recursive correction, clone safety, and validation edge cases separate
 * from the core auto-validator behavior tests.
 */

import { describe, expect, it } from 'vitest';
import {
  autoCorrectSpec,
  validateSpec,
  formatCorrections,
  type Correction
} from '../../mcp-server/src/utils/auto-validator.js';

describe('Auto-Validator — Edge Cases', () => {
  describe('edge cases', () => {
    it('autoCorrectSpec handles deeply nested children (3 levels)', () => {
      const result = autoCorrectSpec({
        type: 'frame',
        name: 'root',
        props: { padding: 16 },
        children: [
          {
            type: 'frame',
            name: 'level1',
            props: { padding: 10 },
            children: [
              {
                type: 'frame',
                name: 'level2',
                props: { itemSpacing: 15 },
                children: [{ type: 'text', name: 'deep-text', props: { fontSize: 14 } }]
              }
            ]
          }
        ]
      });

      // Should correct each invalid descendant value and preserve precise paths.
      expect(result.wasModified).toBe(true);
      expect(result.corrections).toEqual([
        expect.objectContaining({
          path: 'root.children[0]',
          field: 'padding',
          originalValue: 10,
          correctedValue: 8
        }),
        expect.objectContaining({
          path: 'root.children[0].children[0]',
          field: 'itemSpacing',
          originalValue: 15,
          correctedValue: 16
        }),
        expect.objectContaining({
          path: 'root.children[0].children[0].children[0]',
          field: 'fontSize',
          originalValue: 14,
          correctedValue: 16
        })
      ]);
    });

    it('autoCorrectSpec does not modify dimensions that are multiples of 1', () => {
      const result = autoCorrectSpec({
        type: 'frame',
        name: 'test',
        props: { width: 375, height: 812 }
      });

      const dimCorrections = result.corrections.filter(
        (c) => c.field === 'width' || c.field === 'height'
      );
      expect(dimCorrections).toHaveLength(0);
    });

    it('autoCorrectSpec handles spec with zero padding', () => {
      const result = autoCorrectSpec({
        type: 'frame',
        name: 'test',
        props: { padding: 0, itemSpacing: 0 }
      });

      expect(result.wasModified).toBe(false);
    });

    it('autoCorrectSpec handles large spacing values', () => {
      const result = autoCorrectSpec({
        type: 'frame',
        name: 'test',
        props: { padding: 200 }
      });

      expect(result.wasModified).toBe(true);
      expect(result.corrected.props?.padding).toBe(128);
    });

    it('validateSpec counts nodes correctly in complex hierarchy', () => {
      const result = validateSpec({
        type: 'frame',
        name: 'root',
        children: [
          { type: 'text', name: 'a', props: { content: 'A' } },
          { type: 'text', name: 'b', props: { content: 'B' } },
          {
            type: 'frame',
            name: 'inner',
            children: [{ type: 'text', name: 'c', props: { content: 'C' } }]
          }
        ]
      });

      expect(result.stats.totalNodes).toBe(5);
      expect(result.stats.nodesByType.frame).toBe(2);
      expect(result.stats.nodesByType.text).toBe(3);
    });

    it('validateSpec handles spec with empty name without crash', () => {
      const result = validateSpec({
        type: 'frame',
        name: '',
        props: { padding: 16 }
      });
      expect(result.stats.totalNodes).toBe(1);
    });

    it('autoCorrectSpec with negative spacing clamps to 0', () => {
      const result = autoCorrectSpec({
        type: 'frame',
        name: 'test',
        props: { padding: -5 }
      });
      expect(result.corrected.props?.padding).toBe(0);
    });

    it('autoCorrectSpec with empty children array makes no corrections', () => {
      const result = autoCorrectSpec({
        type: 'frame',
        name: 'test',
        props: { padding: 16 },
        children: []
      });
      expect(result.wasModified).toBe(false);
      expect(result.corrected.children).toEqual([]);
    });

    it('autoCorrectSpec preserves non-spacing/non-font props', () => {
      const result = autoCorrectSpec({
        type: 'text',
        name: 'label',
        props: { content: 'Hello World', fontSize: 16, color: '#FF0000' }
      });
      expect(result.corrected.props?.content).toBe('Hello World');
      expect(result.corrected.props?.color).toBe('#FF0000');
    });

    it('validateSpec warns when text has no props or content', () => {
      const result = validateSpec({
        type: 'text',
        name: 'empty-text'
      });
      const contentWarning = result.issues.find((i) => i.field === 'content');
      expect(result.stats.totalNodes).toBe(1);
      expect(result.valid).toBe(true);
      expect(contentWarning?.severity).toBe('warning');
    });

    it('validateSpec counts maxDepth=0 for single node', () => {
      const result = validateSpec({
        type: 'frame',
        name: 'flat',
        props: { padding: 16 }
      });
      expect(result.stats.maxDepth).toBe(0);
    });

    it('corrections include the path to the corrected field', () => {
      const result = autoCorrectSpec({
        type: 'frame',
        name: 'root',
        props: { padding: 15 }
      });
      expect(result.corrections[0].path).toBe('root');
      expect(result.corrections[0].field).toBe('padding');
    });

    it('corrections for nested children include path with children prefix', () => {
      const result = autoCorrectSpec({
        type: 'frame',
        name: 'root',
        props: { padding: 16 },
        children: [{ type: 'frame', name: 'child', props: { itemSpacing: 10 } }]
      });
      const childCorrections = result.corrections.filter((c) => c.path.includes('children'));
      expect(childCorrections).toEqual([
        expect.objectContaining({
          path: 'root.children[0]',
          field: 'itemSpacing',
          originalValue: 10,
          correctedValue: 8
        })
      ]);
    });

    it('autoCorrectSpec corrects individual padding fields (paddingLeft/Right/Top/Bottom)', () => {
      const result = autoCorrectSpec({
        type: 'frame',
        name: 'test',
        props: { paddingLeft: 10, paddingRight: 15, paddingTop: 7, paddingBottom: 33 }
      });

      expect(result.wasModified).toBe(true);
      expect(result.corrected.props?.paddingLeft).toBe(8);
      expect(result.corrected.props?.paddingRight).toBe(16);
      expect(result.corrected.props?.paddingTop).toBe(8);
      expect(result.corrected.props?.paddingBottom).toBe(32);
    });

    it('autoCorrectSpec correction paths include correct child indices', () => {
      const result = autoCorrectSpec({
        type: 'frame',
        name: 'root',
        props: { padding: 16 },
        children: [
          { type: 'text', name: 'first', props: { fontSize: 16 } },
          { type: 'frame', name: 'second', props: { itemSpacing: 10 } }
        ]
      });

      const childCorrections = result.corrections.filter((c) => c.path.includes('children'));
      expect(childCorrections).toEqual([
        expect.objectContaining({
          path: 'root.children[1]',
          field: 'itemSpacing',
          originalValue: 10,
          correctedValue: 8
        })
      ]);
    });

    it('autoCorrectSpec deep clone does not share references with original', () => {
      const original = {
        type: 'frame' as const,
        name: 'test',
        props: { padding: 15, nested: { deep: true } }
      };

      const result = autoCorrectSpec(original);

      result.corrected.props!.padding = 999;
      expect(original.props.padding).toBe(15);
    });

    it('validateSpec warns on off-grid fontSize', () => {
      const result = validateSpec({
        type: 'text',
        name: 'label',
        props: { content: 'Hello', fontSize: 14 }
      });

      const fontWarning = result.issues.find((i) => i.field === 'fontSize');
      expect(fontWarning?.severity).toBe('warning');
      expect(fontWarning?.message).toContain('14');
    });

    it('validateSpec reports error for invalid node type', () => {
      const result = validateSpec({
        type: 'image' as 'frame',
        name: 'bad-type'
      });

      const typeError = result.issues.find((i) => i.field === 'type');
      expect(typeError?.severity).toBe('error');
      expect(result.valid).toBe(false);
    });

    it('autoCorrectSpec handles 0.5 boundary for rounding dimensions', () => {
      const result = autoCorrectSpec({
        type: 'frame',
        name: 'test',
        props: { width: 100.5, height: 99.4, x: 50.5, y: 25.49 }
      });

      expect(result.corrected.props?.width).toBe(101);
      expect(result.corrected.props?.height).toBe(99);
      expect(result.corrected.props?.x).toBe(51);
      expect(result.corrected.props?.y).toBe(25);
    });

    it('autoCorrectSpec handles spec with no name', () => {
      const result = autoCorrectSpec({
        type: 'frame',
        props: { padding: 15 }
      });
      expect(result.wasModified).toBe(true);
      expect(result.corrected.props?.padding).toBe(16);
    });

    it('validateSpec warns on text node with whitespace-only content', () => {
      const result = validateSpec({
        type: 'text',
        name: 'spaces',
        props: { content: '   ' }
      });

      const contentWarning = result.issues.find((i) => i.field === 'content');
      expect(contentWarning?.severity).toBe('warning');
    });

    it('validateSpec accepts text node with "text" prop as alternative to "content"', () => {
      const result = validateSpec({
        type: 'text',
        name: 'alt',
        props: { text: 'Hello' }
      });

      const contentWarning = result.issues.find((i) => i.field === 'content');
      expect(contentWarning).toBeUndefined();
    });

    it('formatCorrections handles corrections with different reasons', () => {
      const corrections: Correction[] = [
        {
          path: 'root',
          field: 'padding',
          originalValue: 15,
          correctedValue: 16,
          reason: 'Snapped to 8pt grid'
        },
        {
          path: 'root',
          field: 'fontSize',
          originalValue: 14,
          correctedValue: 16,
          reason: 'Snapped to type scale'
        },
        {
          path: 'root',
          field: 'width',
          originalValue: 100.5,
          correctedValue: 101,
          reason: 'Rounded to integer'
        }
      ];
      const formatted = formatCorrections(corrections);
      expect(formatted).toContain('3 auto-correction');
      expect(formatted).toContain('8pt grid');
      expect(formatted).toContain('type scale');
    });
  });
});
