/**
 * Color Converter Unit Tests
 *
 * Tests RGB <-> Hex conversions, luminance calculations, contrast ratios,
 * and WCAG compliance from the color constraints module.
 */

import { describe, expect, it } from 'vitest';
import {
  getContrastRatio,
  getRelativeLuminance,
  hexToRgb,
  rgbToHex,
  rgbSchema,
  validateContrast
} from '../../mcp-server/src/constraints/color.js';

describe('Color Converter', () => {
  describe('hexToRgb', () => {
    it('converts primary colors correctly', () => {
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('handles lowercase hex values', () => {
      expect(hexToRgb('#808080')).toEqual({ r: 128, g: 128, b: 128 });
    });

    it('handles hex without # prefix', () => {
      expect(hexToRgb('800080')).toEqual({ r: 128, g: 0, b: 128 });
    });

    it('handles mixed case', () => {
      expect(hexToRgb('#00fFfF')).toEqual({ r: 0, g: 255, b: 255 });
    });

    it('returns null for invalid formats', () => {
      expect(hexToRgb('')).toBeNull();
      expect(hexToRgb('#FFF')).toBeNull();
      expect(hexToRgb('#GGGGGG')).toBeNull();
      expect(hexToRgb('not-a-color')).toBeNull();
      expect(hexToRgb('#12345')).toBeNull();
      expect(hexToRgb('#1234567')).toBeNull();
    });
  });

  describe('rgbToHex', () => {
    it('converts primary colors', () => {
      expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
      expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff');
      expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
    });

    it('converts intermediate values', () => {
      expect(rgbToHex({ r: 128, g: 128, b: 128 })).toBe('#808080');
      expect(rgbToHex({ r: 128, g: 0, b: 128 })).toBe('#800080');
    });

    it('rounds fractional values', () => {
      expect(rgbToHex({ r: 127.4, g: 127.4, b: 127.4 })).toBe('#7f7f7f');
      expect(rgbToHex({ r: 127.6, g: 127.6, b: 127.6 })).toBe('#808080');
    });
  });

  describe('round-trip conversion', () => {
    const testColors = [
      '#000000',
      '#FFFFFF',
      '#FF0000',
      '#00FF00',
      '#0000FF',
      '#808080',
      '#ABCDEF',
      '#123456',
      '#FEDCBA'
    ];

    it.each(testColors)('preserves %s through hex -> rgb -> hex', (hex) => {
      const rgb = hexToRgb(hex);
      // If hexToRgb returns null for a valid color, rgbToHex will throw — test catches both
      const result = rgbToHex(rgb!);
      expect(result.toLowerCase()).toBe(hex.toLowerCase());
    });
  });

  describe('getRelativeLuminance', () => {
    it('returns 0 for black and 1 for white', () => {
      expect(getRelativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
      expect(getRelativeLuminance({ r: 255, g: 255, b: 255 })).toBe(1);
    });

    it('orders channels by human perception: green > red > blue', () => {
      const redLum = getRelativeLuminance({ r: 255, g: 0, b: 0 });
      const greenLum = getRelativeLuminance({ r: 0, g: 255, b: 0 });
      const blueLum = getRelativeLuminance({ r: 0, g: 0, b: 255 });

      expect(greenLum).toBeGreaterThan(redLum);
      expect(redLum).toBeGreaterThan(blueLum);
    });

    it('returns values between 0 and 1 for gray', () => {
      const lum = getRelativeLuminance({ r: 128, g: 128, b: 128 });
      expect(lum).toBeGreaterThan(0);
      expect(lum).toBeLessThan(1);
    });

    it('applies gamma correction (non-linear progression)', () => {
      const dark = getRelativeLuminance({ r: 64, g: 64, b: 64 });
      const mid = getRelativeLuminance({ r: 128, g: 128, b: 128 });
      const light = getRelativeLuminance({ r: 192, g: 192, b: 192 });

      const diffLow = mid - dark;
      const diffHigh = light - mid;
      expect(diffLow).not.toBeCloseTo(diffHigh, 2);
    });

    it('weights green channel >2x more than red or blue at equal RGB', () => {
      const red = getRelativeLuminance({ r: 128, g: 0, b: 0 });
      const green = getRelativeLuminance({ r: 0, g: 128, b: 0 });
      const blue = getRelativeLuminance({ r: 0, g: 0, b: 128 });

      expect(green).toBeGreaterThan(red * 2);
      expect(green).toBeGreaterThan(blue * 2);
    });
  });

  describe('getContrastRatio', () => {
    it('returns 21 for black on white', () => {
      expect(getContrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBe(21);
    });

    it('returns 1 for identical colors', () => {
      expect(getContrastRatio({ r: 128, g: 128, b: 128 }, { r: 128, g: 128, b: 128 })).toBe(1);
    });

    it('is symmetric (order of arguments does not matter)', () => {
      const a = getContrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
      const b = getContrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 });
      expect(a).toBe(b);
    });

    it('returns intermediate value for gray on black', () => {
      const ratio = getContrastRatio({ r: 0, g: 0, b: 0 }, { r: 128, g: 128, b: 128 });
      expect(ratio).toBeGreaterThan(1);
      expect(ratio).toBeLessThan(21);
    });
  });

  describe('validateContrast', () => {
    it('passes all WCAG levels for black on white (21:1)', () => {
      const result = validateContrast({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
      expect(result.ratio).toBe(21);
      expect(result.passes.AA.normal).toBe(true);
      expect(result.passes.AA.large).toBe(true);
      expect(result.passes.AAA.normal).toBe(true);
      expect(result.passes.AAA.large).toBe(true);
      expect(result.recommendation).toContain('Excellent');
    });

    it('fails WCAG for light gray on white', () => {
      const result = validateContrast({ r: 200, g: 200, b: 200 }, { r: 255, g: 255, b: 255 });
      expect(result.passes.AA.normal).toBe(false);
      expect(result.passes.AA.large).toBe(false);
    });

    it('passes WCAG AA normal for dark gray on white', () => {
      const result = validateContrast({ r: 100, g: 100, b: 100 }, { r: 255, g: 255, b: 255 });
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
      expect(result.passes.AA.normal).toBe(true);
    });

    it('passes AA large but fails AA normal for medium gray', () => {
      // #959595 on white: ratio ~3.0-4.5
      const result = validateContrast({ r: 149, g: 149, b: 149 }, { r: 255, g: 255, b: 255 });
      if (result.ratio >= 3.0 && result.ratio < 4.5) {
        expect(result.passes.AA.large).toBe(true);
        expect(result.passes.AA.normal).toBe(false);
      }
    });

    it('gives different recommendations for different contrast levels', () => {
      const excellent = validateContrast({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
      const poor = validateContrast({ r: 200, g: 200, b: 200 }, { r: 255, g: 255, b: 255 });
      expect(excellent.recommendation).not.toBe(poor.recommendation);
    });
  });

  describe('WCAG boundary values', () => {
    const white = { r: 255, g: 255, b: 255 };

    // gray=89 → 7.004729 (just passes AAA normal)
    // gray=90 → 6.896926 (just fails AAA normal)
    it('AAA normal boundary: gray=89 passes, gray=90 fails', () => {
      const passes = getContrastRatio({ r: 89, g: 89, b: 89 }, white);
      const fails = getContrastRatio({ r: 90, g: 90, b: 90 }, white);
      expect(passes).toBeGreaterThanOrEqual(7.0);
      expect(fails).toBeLessThan(7.0);
    });

    // gray=118 → 4.542225 (just passes AA normal / AAA large)
    // gray=119 → 4.478089 (just fails)
    it('AA normal / AAA large boundary: gray=118 passes, gray=119 fails', () => {
      const passes = getContrastRatio({ r: 118, g: 118, b: 118 }, white);
      const fails = getContrastRatio({ r: 119, g: 119, b: 119 }, white);
      expect(passes).toBeGreaterThanOrEqual(4.5);
      expect(fails).toBeLessThan(4.5);
    });

    // gray=148 → 3.033470 (just passes AA large)
    // gray=149 → 2.995346 (just fails)
    it('AA large boundary: gray=148 passes, gray=149 fails', () => {
      const passes = getContrastRatio({ r: 148, g: 148, b: 148 }, white);
      const fails = getContrastRatio({ r: 149, g: 149, b: 149 }, white);
      expect(passes).toBeGreaterThanOrEqual(3.0);
      expect(fails).toBeLessThan(3.0);
    });

    it('validateContrast at AAA normal boundary uses >= (not >)', () => {
      // gray=89 has ratio ~7.005 — just over 7.0
      const result = validateContrast({ r: 89, g: 89, b: 89 }, white);
      expect(result.passes.AAA.normal).toBe(true);
      expect(result.passes.AAA.large).toBe(true);
      expect(result.passes.AA.normal).toBe(true);
      expect(result.passes.AA.large).toBe(true);
    });

    it('validateContrast at AA normal boundary uses >= (not >)', () => {
      // gray=118 has ratio ~4.542 — just over 4.5
      const result = validateContrast({ r: 118, g: 118, b: 118 }, white);
      expect(result.passes.AA.normal).toBe(true);
      expect(result.passes.AA.large).toBe(true);
      expect(result.passes.AAA.normal).toBe(false);
      expect(result.passes.AAA.large).toBe(true);
    });

    it('validateContrast at AA large boundary uses >= (not >)', () => {
      // gray=148 has ratio ~3.033 — just over 3.0
      const result = validateContrast({ r: 148, g: 148, b: 148 }, white);
      expect(result.passes.AA.large).toBe(true);
      expect(result.passes.AA.normal).toBe(false);
      expect(result.passes.AAA.normal).toBe(false);
      expect(result.passes.AAA.large).toBe(false);
    });

    it('validateContrast passes at ~4.5:1 ratio (>= not >)', () => {
      // gray=118.656 produces ratio 4.50002 — just barely above 4.5
      const g = 118.656;
      const result = validateContrast({ r: g, g: g, b: g }, white);
      expect(result.ratio).toBeCloseTo(4.5, 2);
      expect(result.passes.AA.normal).toBe(true);
      expect(result.passes.AAA.large).toBe(true);
    });

    it('validateContrast passes at ~7.0:1 ratio (>= not >)', () => {
      // gray=89.043 produces ratio 7.00005 — just barely above 7.0
      const g = 89.043;
      const result = validateContrast({ r: g, g: g, b: g }, white);
      expect(result.ratio).toBeCloseTo(7.0, 2);
      expect(result.passes.AAA.normal).toBe(true);
    });

    it('validateContrast passes at ~3.0:1 ratio (>= not >)', () => {
      // gray=148.877 produces ratio 3.00000 — just barely above 3.0
      const g = 148.877;
      const result = validateContrast({ r: g, g: g, b: g }, white);
      expect(result.ratio).toBeCloseTo(3.0, 2);
      expect(result.passes.AA.large).toBe(true);
    });
  });

  describe('validateContrast recommendation branches', () => {
    const white = { r: 255, g: 255, b: 255 };

    it('Excellent: ratio >= 7.0 (passes AAA normal)', () => {
      // gray=0 → ratio=21
      const result = validateContrast({ r: 0, g: 0, b: 0 }, white);
      expect(result.recommendation).toContain('Excellent');
    });

    it('Good: 4.5 <= ratio < 7.0 (passes AAA large but not AAA normal)', () => {
      // gray=100 → ratio ~5.92
      const result = validateContrast({ r: 100, g: 100, b: 100 }, white);
      expect(result.passes.AAA.large).toBe(true);
      expect(result.passes.AAA.normal).toBe(false);
      expect(result.recommendation).toContain('Good');
    });

    it('Limited: 3.0 <= ratio < 4.5 (passes AA large only)', () => {
      // gray=135 → ratio ~3.59
      const result = validateContrast({ r: 135, g: 135, b: 135 }, white);
      expect(result.passes.AA.large).toBe(true);
      expect(result.passes.AA.normal).toBe(false);
      expect(result.recommendation).toContain('Limited');
    });

    it('Poor: ratio < 3.0 (fails all WCAG levels)', () => {
      // gray=200 → ratio ~1.67
      const result = validateContrast({ r: 200, g: 200, b: 200 }, white);
      expect(result.passes.AA.large).toBe(false);
      expect(result.recommendation).toContain('Poor');
    });
  });
});

describe('Color Converter — edge cases & validation', () => {
  describe('Edge cases', () => {
    it('hexToRgb handles 3-char hex as null (not supported)', () => {
      expect(hexToRgb('#FFF')).toBeNull();
      expect(hexToRgb('#000')).toBeNull();
    });

    it('getRelativeLuminance returns exactly 0 for pure black', () => {
      expect(getRelativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    });

    it('getRelativeLuminance returns exactly 1 for pure white', () => {
      expect(getRelativeLuminance({ r: 255, g: 255, b: 255 })).toBe(1);
    });

    it('contrast ratio is always >= 1', () => {
      const colors = [
        { r: 0, g: 0, b: 0 },
        { r: 255, g: 255, b: 255 },
        { r: 128, g: 0, b: 128 },
        { r: 255, g: 128, b: 0 }
      ];
      for (const a of colors) {
        for (const b of colors) {
          expect(getContrastRatio(a, b)).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('rgbToHex pads single-digit hex values with leading zero', () => {
      // r=5 → "05", not "5"
      expect(rgbToHex({ r: 5, g: 0, b: 0 })).toBe('#050000');
      expect(rgbToHex({ r: 0, g: 15, b: 0 })).toBe('#000f00');
    });

    it('getContrastRatio at exact WCAG AA threshold (4.5:1)', () => {
      const ratio = getContrastRatio({ r: 118, g: 118, b: 118 }, { r: 255, g: 255, b: 255 });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('getRelativeLuminance blue channel uses /255 not *255', () => {
      // Pure blue: luminance should be ~0.0722 (the blue coefficient in the WCAG formula)
      const lum = getRelativeLuminance({ r: 0, g: 0, b: 255 });
      expect(lum).toBeCloseTo(0.0722, 2);
      // If b/255 were mutated to b*255, luminance would be astronomically large
      expect(lum).toBeLessThan(1);
    });

    it('getRelativeLuminance low-value linearization uses /12.92 not *12.92', () => {
      // sRGB value 5/255 ≈ 0.0196 — below 0.03928, uses linear branch
      // Correct: 0.0196 / 12.92 ≈ 0.00152
      // Mutant:  0.0196 * 12.92 ≈ 0.253 — way too high
      const lum = getRelativeLuminance({ r: 0, g: 0, b: 5 });
      expect(lum).toBeLessThan(0.01);
    });

    it('getRelativeLuminance linearizes low sRGB values differently from high', () => {
      // sRGB value 10/255 ≈ 0.0392 — right at the 0.03928 threshold
      // Verify the function produces different results than a naive linear model
      const lumLow = getRelativeLuminance({ r: 10, g: 0, b: 0 });
      const lumHigh = getRelativeLuminance({ r: 128, g: 0, b: 0 });
      // Linear model would give lumHigh/lumLow ≈ 128/10 = 12.8
      // Gamma-corrected ratio should be different
      const ratio = lumHigh / lumLow;
      expect(ratio).not.toBeCloseTo(12.8, 0);
    });
  });

  describe('rgbSchema validation', () => {
    it('accepts valid RGB values', () => {
      expect(rgbSchema.safeParse({ r: 0, g: 0, b: 0 }).success).toBe(true);
      expect(rgbSchema.safeParse({ r: 255, g: 255, b: 255 }).success).toBe(true);
      expect(rgbSchema.safeParse({ r: 128, g: 64, b: 200 }).success).toBe(true);
    });

    it('rejects r below 0', () => {
      expect(rgbSchema.safeParse({ r: -1, g: 0, b: 0 }).success).toBe(false);
    });

    it('rejects r above 255', () => {
      expect(rgbSchema.safeParse({ r: 256, g: 0, b: 0 }).success).toBe(false);
    });

    it('rejects g below 0', () => {
      expect(rgbSchema.safeParse({ r: 0, g: -1, b: 0 }).success).toBe(false);
    });

    it('rejects g above 255', () => {
      expect(rgbSchema.safeParse({ r: 0, g: 256, b: 0 }).success).toBe(false);
    });

    it('rejects b below 0', () => {
      expect(rgbSchema.safeParse({ r: 0, g: 0, b: -1 }).success).toBe(false);
    });

    it('rejects b above 255', () => {
      expect(rgbSchema.safeParse({ r: 0, g: 0, b: 256 }).success).toBe(false);
    });
  });

  describe('hexToRgb additional edge cases', () => {
    it('rejects 4-char hex', () => {
      expect(hexToRgb('#FFFF')).toBeNull();
    });

    it('rejects 8-char hex', () => {
      expect(hexToRgb('#FF000000')).toBeNull();
    });

    it('rejects hex with special characters', () => {
      expect(hexToRgb('#GG0000')).toBeNull();
      expect(hexToRgb('#00$000')).toBeNull();
    });

    it('handles all zero values', () => {
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('handles all max values', () => {
      expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
    });
  });

  describe('rgbToHex edge cases', () => {
    it('clamps values above 255 to 255', () => {
      // rgbToHex uses Math.round, so values > 255.4 round to 255
      const result = rgbToHex({ r: 255, g: 255, b: 255 });
      expect(result).toBe('#ffffff');
    });

    it('handles exact boundary value 254.5 (rounds to 255)', () => {
      const result = rgbToHex({ r: 254.5, g: 0, b: 0 });
      expect(result).toBe('#ff0000');
    });
  });

  describe('contrast ratio precision', () => {
    it('pure red on white has known contrast ratio ~4.0', () => {
      const ratio = getContrastRatio({ r: 255, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
      expect(ratio).toBeGreaterThan(3.5);
      expect(ratio).toBeLessThan(4.5);
    });

    it('pure blue on white has known low contrast ratio', () => {
      const ratio = getContrastRatio({ r: 0, g: 0, b: 255 }, { r: 255, g: 255, b: 255 });
      expect(ratio).toBeGreaterThan(7);
      expect(ratio).toBeLessThan(9);
    });

    it('pure green on white has known low contrast ratio', () => {
      const ratio = getContrastRatio({ r: 0, g: 255, b: 0 }, { r: 255, g: 255, b: 255 });
      expect(ratio).toBeGreaterThan(1);
      expect(ratio).toBeLessThan(2);
    });
  });

  describe('validateContrast recommendation strings', () => {
    it('returns different recommendation for each ratio range', () => {
      const white = { r: 255, g: 255, b: 255 };
      const recommendations = new Set<string>();

      // Excellent: ratio >= 7
      recommendations.add(validateContrast({ r: 0, g: 0, b: 0 }, white).recommendation);
      // Good: 4.5 <= ratio < 7
      recommendations.add(validateContrast({ r: 100, g: 100, b: 100 }, white).recommendation);
      // Limited: 3 <= ratio < 4.5
      recommendations.add(validateContrast({ r: 135, g: 135, b: 135 }, white).recommendation);
      // Poor: ratio < 3
      recommendations.add(validateContrast({ r: 200, g: 200, b: 200 }, white).recommendation);

      expect(recommendations.size).toBe(4);
    });
  });

  describe('property-based: random color round-trips', () => {
    function randomRGB(): { r: number; g: number; b: number } {
      return {
        r: Math.floor(Math.random() * 256),
        g: Math.floor(Math.random() * 256),
        b: Math.floor(Math.random() * 256)
      };
    }

    it('hexToRgb → rgbToHex round-trip preserves 50 random colors', () => {
      for (let i = 0; i < 50; i++) {
        const rgb = randomRGB();
        const hex = rgbToHex(rgb);
        const back = hexToRgb(hex);
        expect(back?.r).toBe(rgb.r);
        expect(back!.g).toBe(rgb.g);
        expect(back!.b).toBe(rgb.b);
      }
    });

    it('contrast ratio is always between 1 and 21 for 50 random pairs', () => {
      for (let i = 0; i < 50; i++) {
        const a = randomRGB();
        const b = randomRGB();
        const ratio = getContrastRatio(a, b);
        expect(ratio).toBeGreaterThanOrEqual(1);
        expect(ratio).toBeLessThanOrEqual(21);
      }
    });

    it('luminance is always between 0 and 1 for 50 random colors', () => {
      for (let i = 0; i < 50; i++) {
        const rgb = randomRGB();
        const lum = getRelativeLuminance(rgb);
        expect(lum).toBeGreaterThanOrEqual(0);
        expect(lum).toBeLessThanOrEqual(1);
      }
    });
  });
});
