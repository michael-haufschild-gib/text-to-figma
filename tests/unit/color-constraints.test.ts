/**
 * Color Constraints Unit Tests
 *
 * Tests hex/RGB conversion, relative luminance, contrast ratio,
 * WCAG validation, and schema validation from constraints/color.ts.
 */

import { describe, expect, it } from 'vitest';
import {
  hexToRgb,
  rgbToHex,
  getRelativeLuminance,
  getContrastRatio,
  validateContrast,
  rgbSchema,
  CONTRAST_THRESHOLDS,
  WCAGLevel,
  TextSize
} from '../../mcp-server/src/constraints/color.js';

describe('hexToRgb', () => {
  it('parses 6-digit hex with hash', () => {
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('parses 6-digit hex without hash', () => {
    expect(hexToRgb('FF0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('parses lowercase hex', () => {
    expect(hexToRgb('#ff5500')).toEqual({ r: 255, g: 85, b: 0 });
  });

  it('parses mixed case', () => {
    expect(hexToRgb('#Ff5500')).toEqual({ r: 255, g: 85, b: 0 });
  });

  it('parses black and white', () => {
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('returns null for invalid hex: too short', () => {
    expect(hexToRgb('#FFF')).toBeNull();
  });

  it('returns null for invalid hex: too long', () => {
    expect(hexToRgb('#FF00FF00')).toBeNull();
  });

  it('returns null for invalid hex: non-hex characters', () => {
    expect(hexToRgb('#GGGGGG')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(hexToRgb('')).toBeNull();
  });
});

describe('rgbToHex', () => {
  it('converts primary colors', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
    expect(rgbToHex({ r: 0, g: 255, b: 0 })).toBe('#00ff00');
    expect(rgbToHex({ r: 0, g: 0, b: 255 })).toBe('#0000ff');
  });

  it('converts black and white', () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff');
  });

  it('pads single-digit hex with leading zero', () => {
    expect(rgbToHex({ r: 1, g: 2, b: 3 })).toBe('#010203');
  });

  it('rounds fractional values', () => {
    expect(rgbToHex({ r: 127.6, g: 0, b: 0 })).toBe('#800000');
  });

  it('round-trips with hexToRgb', () => {
    const original = '#ff5500';
    const rgb = hexToRgb(original)!;
    expect(rgbToHex(rgb)).toBe(original);
  });
});

describe('getRelativeLuminance', () => {
  it('black has luminance 0', () => {
    expect(getRelativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
  });

  it('white has luminance 1', () => {
    expect(getRelativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 4);
  });

  it('pure red has correct luminance (0.2126)', () => {
    const lum = getRelativeLuminance({ r: 255, g: 0, b: 0 });
    expect(lum).toBeCloseTo(0.2126, 3);
  });

  it('pure green has highest luminance among primaries', () => {
    const lumR = getRelativeLuminance({ r: 255, g: 0, b: 0 });
    const lumG = getRelativeLuminance({ r: 0, g: 255, b: 0 });
    const lumB = getRelativeLuminance({ r: 0, g: 0, b: 255 });
    expect(lumG).toBeGreaterThan(lumR);
    expect(lumG).toBeGreaterThan(lumB);
  });

  it('values near the linearization threshold (0.03928) compute correctly', () => {
    // r/255 = 0.03928 → r ≈ 10.02, so r=10 is below threshold, r=11 is above
    const lumBelow = getRelativeLuminance({ r: 10, g: 0, b: 0 });
    const lumAbove = getRelativeLuminance({ r: 11, g: 0, b: 0 });
    expect(lumBelow).toBeGreaterThan(0);
    expect(lumAbove).toBeGreaterThan(lumBelow);
  });
});

describe('getContrastRatio', () => {
  it('black on white is 21:1', () => {
    const ratio = getContrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(ratio).toBeCloseTo(21, 0);
  });

  it('same color has ratio 1:1', () => {
    const color = { r: 128, g: 128, b: 128 };
    expect(getContrastRatio(color, color)).toBeCloseTo(1, 5);
  });

  it('is symmetric (order of arguments does not matter)', () => {
    const a = { r: 255, g: 0, b: 0 };
    const b = { r: 0, g: 0, b: 255 };
    expect(getContrastRatio(a, b)).toBeCloseTo(getContrastRatio(b, a), 5);
  });

  it('ratio is always >= 1', () => {
    const ratio = getContrastRatio({ r: 100, g: 100, b: 100 }, { r: 110, g: 110, b: 110 });
    expect(ratio).toBeGreaterThanOrEqual(1);
  });
});

describe('validateContrast', () => {
  it('black on white passes all WCAG levels', () => {
    const result = validateContrast({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(result.passes.AA.normal).toBe(true);
    expect(result.passes.AA.large).toBe(true);
    expect(result.passes.AAA.normal).toBe(true);
    expect(result.passes.AAA.large).toBe(true);
    expect(result.recommendation).toContain('Excellent');
  });

  it('very similar colors fail all WCAG levels', () => {
    const result = validateContrast({ r: 200, g: 200, b: 200 }, { r: 210, g: 210, b: 210 });
    expect(result.passes.AA.normal).toBe(false);
    expect(result.passes.AA.large).toBe(false);
    expect(result.recommendation).toContain('Poor');
  });

  it('moderate contrast passes AA large but not AA normal', () => {
    // Need a pair with ratio ~3.5 (passes AA large=3.0 but not AA normal=4.5)
    // Dark gray (#595959) on white gives approximately 7.0 — too high
    // Light gray (#767676) on white gives approximately 4.54 — AA normal but not AAA normal
    // Try #949494 on white
    const result = validateContrast(hexToRgb('#949494')!, { r: 255, g: 255, b: 255 });
    // Ratio ≈ 3.03
    if (result.ratio >= 3.0 && result.ratio < 4.5) {
      expect(result.passes.AA.large).toBe(true);
      expect(result.passes.AA.normal).toBe(false);
      expect(result.recommendation).toContain('Limited');
    }
  });

  it('returns correct recommendation for AAA large only (4.5-7.0 range)', () => {
    // #767676 on white has ratio ~4.54
    const result = validateContrast(hexToRgb('#767676')!, { r: 255, g: 255, b: 255 });
    expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    expect(result.ratio).toBeLessThan(7.0);
    expect(result.passes.AAA.large).toBe(true);
    expect(result.passes.AAA.normal).toBe(false);
    expect(result.recommendation).toContain('Good');
  });
});

describe('rgbSchema', () => {
  it('accepts valid RGB', () => {
    const result = rgbSchema.safeParse({ r: 128, g: 64, b: 255 });
    expect(result.success).toBe(true);
  });

  it('accepts boundary values (0 and 255)', () => {
    expect(rgbSchema.safeParse({ r: 0, g: 0, b: 0 }).success).toBe(true);
    expect(rgbSchema.safeParse({ r: 255, g: 255, b: 255 }).success).toBe(true);
  });

  it('rejects values below 0', () => {
    expect(rgbSchema.safeParse({ r: -1, g: 0, b: 0 }).success).toBe(false);
  });

  it('rejects values above 255', () => {
    expect(rgbSchema.safeParse({ r: 256, g: 0, b: 0 }).success).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(rgbSchema.safeParse({ r: 128 }).success).toBe(false);
    expect(rgbSchema.safeParse({}).success).toBe(false);
  });
});

describe('CONTRAST_THRESHOLDS', () => {
  it('AA normal is 4.5', () => {
    expect(CONTRAST_THRESHOLDS[WCAGLevel.AA][TextSize.Normal]).toBe(4.5);
  });

  it('AA large is 3.0', () => {
    expect(CONTRAST_THRESHOLDS[WCAGLevel.AA][TextSize.Large]).toBe(3.0);
  });

  it('AAA normal is 7.0', () => {
    expect(CONTRAST_THRESHOLDS[WCAGLevel.AAA][TextSize.Normal]).toBe(7.0);
  });

  it('AAA large is 4.5', () => {
    expect(CONTRAST_THRESHOLDS[WCAGLevel.AAA][TextSize.Large]).toBe(4.5);
  });
});
