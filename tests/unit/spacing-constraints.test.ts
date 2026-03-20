/**
 * Spacing Constraints Unit Tests
 */

import { describe, expect, it } from 'vitest';
import {
  VALID_SPACING_VALUES,
  isValidSpacing,
  snapToGrid,
  validateSpacing
} from '../../mcp-server/src/constraints/spacing.js';

describe('Spacing Constraints', () => {
  describe('VALID_SPACING_VALUES', () => {
    it('contains the expected 8pt grid values', () => {
      expect([...VALID_SPACING_VALUES]).toEqual([0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128]);
    });
  });

  describe('isValidSpacing', () => {
    it.each([0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128])('accepts %d', (v) => {
      expect(isValidSpacing(v)).toBe(true);
    });

    it.each([1, 3, 5, 10, 12, 15, 20, 100])('rejects %d', (v) => {
      expect(isValidSpacing(v)).toBe(false);
    });
  });

  describe('snapToGrid', () => {
    it.each([
      [0, 0],
      [1, 0],
      [3, 4],
      [5, 4],
      [6, 4],
      [10, 8],
      [12, 8],
      [20, 16],
      [100, 96],
      [200, 128]
    ])('snaps %d to %d', (input, expected) => {
      expect(snapToGrid(input)).toBe(expected);
    });

    it('returns exact match unchanged', () => {
      for (const v of VALID_SPACING_VALUES) {
        expect(snapToGrid(v)).toBe(v);
      }
    });

    it('snaps negative values to 0', () => {
      expect(snapToGrid(-10)).toBe(0);
    });
  });

  describe('validateSpacing', () => {
    it('marks valid values as valid', () => {
      for (const v of VALID_SPACING_VALUES) {
        const result = validateSpacing(v);
        expect(result.isValid).toBe(true);
        expect(result.value).toBe(v);
        expect(result.suggestedValue).toBeUndefined();
      }
    });

    it('marks invalid values as invalid with suggestion', () => {
      const result = validateSpacing(10);
      expect(result.isValid).toBe(false);
      expect(result.value).toBe(10);
      expect(result.suggestedValue).toBe(8);
      expect(result.message).toContain('10');
    });

    it('suggests nearest grid value', () => {
      const result = validateSpacing(20);
      expect(result.suggestedValue).toBe(16);
    });
  });

  describe('edge cases', () => {
    it('snapToGrid with very large values snaps to 128', () => {
      expect(snapToGrid(500)).toBe(128);
      expect(snapToGrid(1000)).toBe(128);
      expect(snapToGrid(10000)).toBe(128);
    });

    it('snapToGrid with 0.5 snaps to 0', () => {
      expect(snapToGrid(0.5)).toBe(0);
    });

    it('snapToGrid at midpoints between grid values', () => {
      // Between 4 and 8, midpoint is 6
      expect(snapToGrid(6)).toBe(4);
      // Between 8 and 16, midpoint is 12
      expect(snapToGrid(12)).toBe(8);
      // Between 16 and 24, midpoint is 20
      expect(snapToGrid(20)).toBe(16);
    });

    it('validateSpacing with floating point value', () => {
      const result = validateSpacing(16.5);
      expect(result.isValid).toBe(false);
      expect(result.suggestedValue).toBe(16);
    });

    it('validateSpacing with negative value', () => {
      const result = validateSpacing(-10);
      expect(result.isValid).toBe(false);
      expect(result.suggestedValue).toBe(0);
    });

    it('isValidSpacing returns false for non-grid integers', () => {
      for (let i = 1; i <= 130; i++) {
        if (VALID_SPACING_VALUES.includes(i)) continue;
        expect(isValidSpacing(i)).toBe(false);
      }
    });

    it('snapToGrid is monotonically non-decreasing for 0-200', () => {
      let prev = snapToGrid(0);
      for (let i = 1; i <= 200; i++) {
        const current = snapToGrid(i);
        expect(current).toBeGreaterThanOrEqual(prev);
        prev = current;
      }
    });

    it('snapToGrid always returns a valid spacing value', () => {
      for (let i = 0; i <= 200; i++) {
        const snapped = snapToGrid(i);
        expect(VALID_SPACING_VALUES).toContain(snapped);
      }
    });

    it('snapToGrid returns the closest value for every integer 0-200', () => {
      for (let i = 0; i <= 200; i++) {
        const snapped = snapToGrid(i);
        const snappedDist = Math.abs(i - snapped);

        // Verify no other valid value is strictly closer
        for (const v of VALID_SPACING_VALUES) {
          const vDist = Math.abs(i - v);
          expect(vDist).toBeGreaterThanOrEqual(snappedDist - 0.001);
        }
      }
    });

    it('snapToGrid at exact midpoint between consecutive grid values picks the lower', () => {
      // Midpoint between 4 and 8 is 6
      expect(snapToGrid(6)).toBe(4);
      // Midpoint between 8 and 16 is 12
      expect(snapToGrid(12)).toBe(8);
      // Midpoint between 64 and 80 is 72
      expect(snapToGrid(72)).toBe(64);
    });

    it('snapToGrid is idempotent for all valid values', () => {
      for (const v of VALID_SPACING_VALUES) {
        expect(snapToGrid(snapToGrid(v))).toBe(v);
      }
    });

    it('validateSpacing for every valid value returns isValid=true', () => {
      for (const v of VALID_SPACING_VALUES) {
        const result = validateSpacing(v);
        expect(result.isValid).toBe(true);
        expect(result.suggestedValue).toBeUndefined();
      }
    });

    it('validateSpacing for v+1 of each valid value returns isValid=false (except at boundaries)', () => {
      for (const v of VALID_SPACING_VALUES) {
        if (v === 128) continue; // 129 snaps to 128, which is the last valid value
        const result = validateSpacing(v + 1);
        if (!VALID_SPACING_VALUES.includes(v + 1)) {
          expect(result.isValid).toBe(false);
          expect(result.suggestedValue).toBeTypeOf('number');
        }
      }
    });
  });
});
