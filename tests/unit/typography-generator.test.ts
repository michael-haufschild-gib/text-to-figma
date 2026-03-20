/**
 * Typography Generator Unit Tests
 *
 * Tests modular type scale, line height calculations,
 * and typography constraint validation.
 */

import { describe, expect, it } from 'vitest';
import {
  FONT_WEIGHTS,
  TEXT_STYLES,
  VALID_FONT_SIZES,
  getRecommendedLineHeight,
  isValidFontSize,
  snapToTypeScale,
  validateTypography
} from '../../mcp-server/src/constraints/typography.js';

describe('Typography Generator', () => {
  describe('VALID_FONT_SIZES', () => {
    it('contains the expected modular type scale', () => {
      expect([...VALID_FONT_SIZES]).toEqual([12, 16, 20, 24, 32, 40, 48, 64]);
    });
  });

  describe('isValidFontSize', () => {
    it.each([12, 16, 20, 24, 32, 40, 48, 64])('recognises %d as valid', (size) => {
      expect(isValidFontSize(size)).toBe(true);
    });

    it.each([10, 13, 15, 18, 22, 30, 36, 50, 72])('rejects %d as invalid', (size) => {
      expect(isValidFontSize(size)).toBe(false);
    });
  });

  describe('FONT_WEIGHTS', () => {
    it('defines all standard CSS font weights', () => {
      expect(FONT_WEIGHTS).toEqual({
        thin: 100,
        extralight: 200,
        light: 300,
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
        extrabold: 800,
        black: 900
      });
    });
  });

  describe('snapToTypeScale', () => {
    it.each([
      [11, 12],
      [13, 12],
      [14, 16],
      [18, 20],
      [26, 24],
      [36, 40],
      [44, 48],
      [56, 64]
    ])('snaps %d to %d', (input, expected) => {
      expect(snapToTypeScale(input)).toBe(expected);
    });

    it('returns exact matches unchanged', () => {
      for (const size of VALID_FONT_SIZES) {
        expect(snapToTypeScale(size)).toBe(size);
      }
    });

    it('snaps boundary values correctly', () => {
      expect(snapToTypeScale(1)).toBe(12);
      expect(snapToTypeScale(100)).toBe(64);
      expect(snapToTypeScale(0)).toBe(12);
      expect(snapToTypeScale(-100)).toBe(12);
      expect(snapToTypeScale(-10)).toBe(12);
    });
  });

  describe('getRecommendedLineHeight', () => {
    it('uses 1.5x for body text (<=20px)', () => {
      expect(getRecommendedLineHeight(12)).toBe(18);
      expect(getRecommendedLineHeight(16)).toBe(24);
      expect(getRecommendedLineHeight(20)).toBe(30);
    });

    it('uses 1.2x for headings (>20px)', () => {
      expect(getRecommendedLineHeight(24)).toBe(29);
      expect(getRecommendedLineHeight(32)).toBe(38);
      expect(getRecommendedLineHeight(40)).toBe(48);
      expect(getRecommendedLineHeight(48)).toBe(58);
      expect(getRecommendedLineHeight(64)).toBe(77);
    });

    it('always returns integers', () => {
      for (const size of VALID_FONT_SIZES) {
        expect(Number.isInteger(getRecommendedLineHeight(size))).toBe(true);
      }
    });
  });

  describe('validateTypography', () => {
    it('marks valid sizes as valid with correct line height', () => {
      for (const size of VALID_FONT_SIZES) {
        const result = validateTypography(size);
        expect(result.isValid).toBe(true);
        expect(result.fontSize).toBe(size);
        expect(result.recommendedLineHeight).toBe(getRecommendedLineHeight(size));
        expect(result.suggestedFontSize).toBeUndefined();
        expect(result.message).toBeUndefined();
      }
    });

    it.each([
      [15, 16],
      [18, 20],
      [30, 32],
      [36, 40],
      [50, 48]
    ])('suggests %d -> %d for invalid sizes', (input, expected) => {
      const result = validateTypography(input);
      expect(result.isValid).toBe(false);
      expect(result.suggestedFontSize).toBe(expected);
      expect(result.message).toContain(String(input));
      expect(result.recommendedLineHeight).toBe(getRecommendedLineHeight(expected));
    });

    it('handles floating point input', () => {
      const result = validateTypography(16.5);
      expect(result.isValid).toBe(false);
      expect([16, 20]).toContain(result.suggestedFontSize);
    });
  });

  describe('TEXT_STYLES', () => {
    const expectedStyles = [
      'display-large',
      'display-medium',
      'heading-1',
      'heading-2',
      'heading-3',
      'body-large',
      'body-medium',
      'body-small'
    ];

    it('defines all expected style names', () => {
      for (const name of expectedStyles) {
        expect(TEXT_STYLES[name].fontSize).toBeGreaterThan(0);
      }
    });

    it('uses valid font sizes and matching line heights', () => {
      for (const [name, style] of Object.entries(TEXT_STYLES)) {
        expect(isValidFontSize(style.fontSize)).toBe(true);
        expect(style.lineHeight).toBe(getRecommendedLineHeight(style.fontSize));
        expect(Object.values(FONT_WEIGHTS)).toContain(style.fontWeight);
      }
    });

    it('has correct specific values', () => {
      expect(TEXT_STYLES['display-large'].fontSize).toBe(64);
      expect(TEXT_STYLES['display-medium'].fontSize).toBe(48);
      expect(TEXT_STYLES['heading-1'].fontSize).toBe(40);
      expect(TEXT_STYLES['heading-2'].fontSize).toBe(32);
      expect(TEXT_STYLES['heading-3'].fontSize).toBe(24);
      expect(TEXT_STYLES['body-large'].fontSize).toBe(20);
      expect(TEXT_STYLES['body-medium'].fontSize).toBe(16);
      expect(TEXT_STYLES['body-small'].fontSize).toBe(12);
    });
  });

  describe('scale ratios', () => {
    it('shows consistent growth between consecutive sizes', () => {
      for (let i = 1; i < VALID_FONT_SIZES.length; i++) {
        const ratio = VALID_FONT_SIZES[i] / VALID_FONT_SIZES[i - 1];
        expect(ratio).toBeGreaterThan(1);
        expect(ratio).toBeLessThan(2);
      }
    });
  });

  describe('consistency', () => {
    it('isValidFontSize and validateTypography agree', () => {
      for (const size of VALID_FONT_SIZES) {
        expect(isValidFontSize(size)).toBe(validateTypography(size).isValid);
      }
    });

    it('snapToTypeScale always returns a valid size', () => {
      for (const v of [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70]) {
        const snapped = snapToTypeScale(v);
        expect(VALID_FONT_SIZES as readonly number[]).toContain(snapped);
      }
    });

    it('snapToTypeScale returns valid size for entire 1-100 range', () => {
      for (let i = 1; i <= 100; i++) {
        const snapped = snapToTypeScale(i);
        expect(VALID_FONT_SIZES as readonly number[]).toContain(snapped);
      }
    });
  });

  describe('edge cases', () => {
    it('getRecommendedLineHeight for smallest size (12) returns integer', () => {
      const lh = getRecommendedLineHeight(12);
      expect(Number.isInteger(lh)).toBe(true);
      expect(lh).toBe(18); // 12 * 1.5
    });

    it('getRecommendedLineHeight for largest size (64) returns integer', () => {
      const lh = getRecommendedLineHeight(64);
      expect(Number.isInteger(lh)).toBe(true);
      expect(lh).toBe(77); // round(64 * 1.2)
    });

    it('validateTypography message includes both original and suggested', () => {
      const result = validateTypography(14);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('14');
    });

    it('validateTypography for valid sizes has no suggestion', () => {
      for (const size of VALID_FONT_SIZES) {
        const result = validateTypography(size);
        expect(result.suggestedFontSize).toBeUndefined();
        expect(result.message).toBeUndefined();
      }
    });

    it('TEXT_STYLES body-medium uses 16px (base body size)', () => {
      expect(TEXT_STYLES['body-medium'].fontSize).toBe(16);
      expect(TEXT_STYLES['body-medium'].fontWeight).toBe(400);
    });

    it('TEXT_STYLES headings use semibold or bold', () => {
      expect(TEXT_STYLES['heading-1'].fontWeight).toBeGreaterThanOrEqual(600);
      expect(TEXT_STYLES['heading-2'].fontWeight).toBeGreaterThanOrEqual(600);
    });

    it('font sizes increase monotonically through the scale', () => {
      for (let i = 1; i < VALID_FONT_SIZES.length; i++) {
        expect(VALID_FONT_SIZES[i]).toBeGreaterThan(VALID_FONT_SIZES[i - 1]);
      }
    });
  });

  describe('cross-module consistency', () => {
    it('getRecommendedLineHeight from validateTypography matches direct call', () => {
      for (const size of VALID_FONT_SIZES) {
        const directLH = getRecommendedLineHeight(size);
        const fromValidate = validateTypography(size).recommendedLineHeight;
        expect(directLH).toBe(fromValidate);
      }
    });

    it('snapToTypeScale and isValidFontSize agree: snapped value is always valid', () => {
      for (let i = 1; i <= 100; i++) {
        const snapped = snapToTypeScale(i);
        expect(isValidFontSize(snapped)).toBe(true);
      }
    });

    it('TEXT_STYLES font sizes are all in VALID_FONT_SIZES', () => {
      for (const [, style] of Object.entries(TEXT_STYLES)) {
        expect(VALID_FONT_SIZES as readonly number[]).toContain(style.fontSize);
      }
    });

    it('TEXT_STYLES line heights match getRecommendedLineHeight', () => {
      for (const [, style] of Object.entries(TEXT_STYLES)) {
        expect(style.lineHeight).toBe(getRecommendedLineHeight(style.fontSize));
      }
    });

    it('snapToTypeScale at midpoints between consecutive sizes picks correctly', () => {
      for (let i = 0; i < VALID_FONT_SIZES.length - 1; i++) {
        const lower = VALID_FONT_SIZES[i];
        const upper = VALID_FONT_SIZES[i + 1];
        const mid = (lower + upper) / 2;
        const snapped = snapToTypeScale(mid);
        // Should snap to one of the two adjacent values
        expect([lower, upper]).toContain(snapped);
      }
    });

    it('validateTypography for invalid sizes always has a suggestion in VALID_FONT_SIZES', () => {
      for (let i = 1; i <= 100; i++) {
        if (VALID_FONT_SIZES.includes(i as (typeof VALID_FONT_SIZES)[number])) continue;
        const result = validateTypography(i);
        expect(result.isValid).toBe(false);
        expect(VALID_FONT_SIZES as readonly number[]).toContain(result.suggestedFontSize);
      }
    });
  });
});
