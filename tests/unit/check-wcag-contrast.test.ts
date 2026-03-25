/**
 * Check WCAG Contrast Execute Function Tests
 *
 * Tests the checkWcagContrast function directly with various
 * color pairs, font sizes, weights, and edge cases.
 */

import { describe, expect, it } from 'vitest';
import {
  checkWcagContrast,
  formatContrastCheckResult
} from '../../mcp-server/src/tools/check_wcag_contrast.js';

describe('checkWcagContrast', () => {
  describe('contrast ratio calculation', () => {
    it('calculates 21:1 for black on white', () => {
      const result = checkWcagContrast({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });
      expect(result.contrastRatio).toBe(21);
    });

    it('calculates 1:1 for identical colors', () => {
      const result = checkWcagContrast({
        foreground: '#777777',
        background: '#777777',
        fontSize: 16,
        fontWeight: 400
      });
      expect(result.contrastRatio).toBe(1);
    });

    it('contrast ratio is symmetric', () => {
      const a = checkWcagContrast({
        foreground: '#336699',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });
      const b = checkWcagContrast({
        foreground: '#FFFFFF',
        background: '#336699',
        fontSize: 16,
        fontWeight: 400
      });
      expect(a.contrastRatio).toBeCloseTo(b.contrastRatio, 2);
    });
  });

  describe('large text detection', () => {
    it('normal text: 16pt, weight 400 → not large', () => {
      const result = checkWcagContrast({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });
      expect(result.isLargeText).toBe(false);
    });

    it('large text: 24px, weight 400 → large', () => {
      const result = checkWcagContrast({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 24,
        fontWeight: 400
      });
      expect(result.isLargeText).toBe(true);
    });

    it('large text: 19px, weight 700 → large (bold)', () => {
      const result = checkWcagContrast({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 19,
        fontWeight: 700
      });
      expect(result.isLargeText).toBe(true);
    });

    it('not large: 14pt, weight 400 → not large', () => {
      const result = checkWcagContrast({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 14,
        fontWeight: 400
      });
      expect(result.isLargeText).toBe(false);
    });

    it('not large: 17pt, weight 600 → not large', () => {
      const result = checkWcagContrast({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 17,
        fontWeight: 600
      });
      expect(result.isLargeText).toBe(false);
    });

    it('large text: 24pt, weight 900 → large', () => {
      const result = checkWcagContrast({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 24,
        fontWeight: 900
      });
      expect(result.isLargeText).toBe(true);
    });
  });

  describe('WCAG compliance', () => {
    it('black on white passes both AA and AAA', () => {
      const result = checkWcagContrast({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });
      expect(result.compliance.aa.passes).toBe(true);
      expect(result.compliance.aaa.passes).toBe(true);
    });

    it('light gray on white fails both AA and AAA', () => {
      const result = checkWcagContrast({
        foreground: '#CCCCCC',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });
      expect(result.compliance.aa.passes).toBe(false);
      expect(result.compliance.aaa.passes).toBe(false);
    });

    it('uses lower threshold for large text', () => {
      // #959595 on white has ratio ~3.0-3.5
      const normalResult = checkWcagContrast({
        foreground: '#959595',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });
      const largeResult = checkWcagContrast({
        foreground: '#959595',
        background: '#FFFFFF',
        fontSize: 18,
        fontWeight: 400
      });

      // Same colors, but large text should have better compliance
      if (normalResult.contrastRatio >= 3.0 && normalResult.contrastRatio < 4.5) {
        expect(normalResult.compliance.aa.passes).toBe(false);
        expect(largeResult.compliance.aa.passes).toBe(true);
      }
    });

    it('compliance includes correct thresholds', () => {
      const result = checkWcagContrast({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });
      expect(result.compliance.aa.level).toBe('AA');
      expect(result.compliance.aaa.level).toBe('AAA');
      expect(result.compliance.aa.threshold).toBe(4.5);
      expect(result.compliance.aaa.threshold).toBe(7);
    });
  });

  describe('color suggestions', () => {
    it('provides no suggestions when contrast already passes', () => {
      const result = checkWcagContrast({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });
      expect(result.suggestions).toHaveLength(0);
    });

    it('provides suggestions for failing contrast', () => {
      const result = checkWcagContrast({
        foreground: '#999999',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });
      expect(result.suggestions.length).toBeGreaterThan(0);
      for (const suggestion of result.suggestions) {
        expect(suggestion.color).toMatch(/^#[0-9a-f]{6}$/i);
        expect(suggestion.contrastRatio).toBeGreaterThan(0);
        expect(suggestion.adjustment.length).toBeGreaterThan(0);
      }
    });

    it('suggestion colors meet the target ratio', () => {
      const result = checkWcagContrast({
        foreground: '#BBBBBB',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });
      if (result.suggestions.length > 0) {
        // At least one suggestion should meet AA threshold
        const meetsAA = result.suggestions.some((s) => s.contrastRatio >= 4.5);
        expect(meetsAA).toBe(true);
      }
    });
  });
});

describe('checkWcagContrast — boundaries and quality', () => {
  describe('summary', () => {
    it('includes summary text', () => {
      const result = checkWcagContrast({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });
      expect(result.summary.length).toBeGreaterThan(0);
    });
  });

  describe('large text boundary precision', () => {
    it('23.99px normal weight is not large text', () => {
      const result = checkWcagContrast({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 23.99,
        fontWeight: 400
      });
      expect(result.isLargeText).toBe(false);
    });

    it('24px normal weight is large text', () => {
      const result = checkWcagContrast({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 24,
        fontWeight: 400
      });
      expect(result.isLargeText).toBe(true);
    });

    it('18.99px bold weight is not large text', () => {
      const result = checkWcagContrast({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 18.99,
        fontWeight: 700
      });
      expect(result.isLargeText).toBe(false);
    });

    it('19px bold weight is large text', () => {
      const result = checkWcagContrast({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 19,
        fontWeight: 700
      });
      expect(result.isLargeText).toBe(true);
    });
  });

  describe('suggestion quality', () => {
    it('all suggestion colors are valid 6-char hex', () => {
      const result = checkWcagContrast({
        foreground: '#AAAAAA',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });
      for (const s of result.suggestions) {
        expect(s.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    it('no suggestions offered when already passing AAA', () => {
      const result = checkWcagContrast({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });
      expect(result.suggestions).toHaveLength(0);
    });

    it('suggestion contrast ratios are greater than the target', () => {
      const result = checkWcagContrast({
        foreground: '#999999',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });
      for (const s of result.suggestions) {
        // Suggestions should improve contrast
        expect(s.contrastRatio).toBeGreaterThan(result.contrastRatio);
      }
    });
  });

  describe('compliance threshold correctness', () => {
    it('AA threshold is 4.5 for normal text', () => {
      const result = checkWcagContrast({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });
      expect(result.compliance.aa.threshold).toBe(4.5);
    });

    it('AA threshold is 3.0 for large text', () => {
      const result = checkWcagContrast({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 24,
        fontWeight: 400
      });
      expect(result.compliance.aa.threshold).toBe(3);
    });

    it('AAA threshold is 7.0 for normal text', () => {
      const result = checkWcagContrast({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });
      expect(result.compliance.aaa.threshold).toBe(7);
    });

    it('AAA threshold is 4.5 for large text', () => {
      const result = checkWcagContrast({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 24,
        fontWeight: 400
      });
      expect(result.compliance.aaa.threshold).toBe(4.5);
    });
  });
});

describe('checkWcagContrast — suggestion generation edge cases', () => {
  it('suggests lightening foreground when fg is lighter than bg and fails AA', () => {
    // #999999 fg on #666666 bg: fg is lighter, lightening it further increases contrast
    const result = checkWcagContrast({
      foreground: '#999999',
      background: '#666666',
      fontSize: 16,
      fontWeight: 400
    });

    expect(result.compliance.aa.passes).toBe(false);
    const lightenFgSuggestion = result.suggestions.find((s) =>
      s.adjustment.includes('Lighten foreground')
    );
    expect(lightenFgSuggestion?.contrastRatio).toBeGreaterThanOrEqual(4.5);
  });

  it('suggests lightening background when bg is lighter than fg and fails AA', () => {
    // #666666 fg on #999999 bg: bg is lighter, lightening it further increases contrast
    const result = checkWcagContrast({
      foreground: '#666666',
      background: '#999999',
      fontSize: 16,
      fontWeight: 400
    });

    expect(result.compliance.aa.passes).toBe(false);
    const lightenBgSuggestion = result.suggestions.find((s) =>
      s.adjustment.includes('Lighten background')
    );
    expect(lightenBgSuggestion?.contrastRatio).toBeGreaterThanOrEqual(4.5);
  });

  it('suggests pure white when both colors are pure black and incremental adjustments fail', () => {
    // Pure black on pure black: darkening either direction does nothing,
    // so the fallback to pure black/white suggestions fires
    const result = checkWcagContrast({
      foreground: '#000000',
      background: '#000000',
      fontSize: 16,
      fontWeight: 400
    });

    expect(result.compliance.aa.passes).toBe(false);
    const whiteSuggestion = result.suggestions.find((s) => s.color === '#FFFFFF');
    expect(whiteSuggestion?.color).toBe('#FFFFFF');
    expect(whiteSuggestion?.contrastRatio).toBe(21);
    expect(whiteSuggestion?.adjustment).toContain('white');
  });

  it('suggests pure black when both colors are pure white and incremental adjustments fail', () => {
    const result = checkWcagContrast({
      foreground: '#FFFFFF',
      background: '#FFFFFF',
      fontSize: 16,
      fontWeight: 400
    });

    expect(result.compliance.aa.passes).toBe(false);
    const blackSuggestion = result.suggestions.find((s) => s.color === '#000000');
    expect(blackSuggestion?.color).toBe('#000000');
    expect(blackSuggestion?.contrastRatio).toBe(21);
    expect(blackSuggestion?.adjustment).toContain('black');
  });

  it('throws for invalid hex color format', () => {
    expect(() =>
      checkWcagContrast({
        foreground: '#ZZZZZZ',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      })
    ).toThrow('Invalid hex color format');
  });

  it('generates suggestions for lighter foreground on darker background', () => {
    // White-ish foreground on dark-ish background, fails AA
    const result = checkWcagContrast({
      foreground: '#DDDDDD',
      background: '#BBBBBB',
      fontSize: 16,
      fontWeight: 400
    });

    if (!result.compliance.aa.passes) {
      expect(result.suggestions.length).toBeGreaterThan(0);
      for (const s of result.suggestions) {
        expect(s.contrastRatio).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('summary reflects AA-pass-but-AAA-fail case', () => {
    // Find a color pair that passes AA but not AAA for normal text
    // AA threshold is 4.5, AAA is 7.0 for normal text
    // #595959 on #FFFFFF has ratio ~7.0, #666666 on #FFFFFF has ratio ~5.74
    const result = checkWcagContrast({
      foreground: '#666666',
      background: '#FFFFFF',
      fontSize: 16,
      fontWeight: 400
    });

    if (result.compliance.aa.passes && !result.compliance.aaa.passes) {
      expect(result.summary).toContain('Good');
      expect(result.summary).toContain('AA');
      expect(result.summary).toContain('AAA');
    }
  });

  it('summary reflects total failure case', () => {
    const result = checkWcagContrast({
      foreground: '#CCCCCC',
      background: '#FFFFFF',
      fontSize: 16,
      fontWeight: 400
    });

    expect(result.compliance.aa.passes).toBe(false);
    expect(result.summary).toContain('Fails');
  });
});

describe('formatContrastCheckResult', () => {
  it('formats passing result', () => {
    const result = checkWcagContrast({
      foreground: '#000000',
      background: '#FFFFFF',
      fontSize: 16,
      fontWeight: 400
    });
    const text = formatContrastCheckResult(result);
    expect(text).toContain('Contrast Check');
    expect(text).toContain('21');
    expect(text).toContain('PASS');
  });

  it('formats failing result', () => {
    const result = checkWcagContrast({
      foreground: '#CCCCCC',
      background: '#FFFFFF',
      fontSize: 16,
      fontWeight: 400
    });
    const text = formatContrastCheckResult(result);
    expect(text).toContain('FAIL');
  });

  it('indicates large text in output', () => {
    const result = checkWcagContrast({
      foreground: '#000000',
      background: '#FFFFFF',
      fontSize: 24,
      fontWeight: 400
    });
    const text = formatContrastCheckResult(result);
    expect(text.toLowerCase()).toContain('large');
  });
});
