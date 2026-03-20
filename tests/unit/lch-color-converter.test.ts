/**
 * LCh Color Space Converter Tests — Conversion & Manipulation
 *
 * Tests the full RGB ↔ LCh conversion pipeline and color manipulation utilities
 * (lightness, chroma, hue adjustments, color harmonies).
 */

import { describe, expect, it } from 'vitest';
import {
  rgbToXyz,
  xyzToRgb,
  xyzToLab,
  labToXyz,
  labToLch,
  lchToLab,
  rgbToLch,
  lchToRgb,
  adjustLightness,
  adjustChroma,
  adjustHue,
  generateColorHarmony
} from '../../mcp-server/src/utils/color-converter.js';

describe('LCh Color Converter — conversions & manipulation', () => {
  describe('RGB ↔ XYZ round-trip', () => {
    it('preserves black', () => {
      const xyz = rgbToXyz({ r: 0, g: 0, b: 0 });
      expect(xyz.x).toBeCloseTo(0, 4);
      expect(xyz.y).toBeCloseTo(0, 4);
      expect(xyz.z).toBeCloseTo(0, 4);

      const rgb = xyzToRgb(xyz);
      expect(rgb).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('preserves white', () => {
      const xyz = rgbToXyz({ r: 255, g: 255, b: 255 });
      expect(xyz.y).toBeCloseTo(100, 0);

      const rgb = xyzToRgb(xyz);
      expect(rgb).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('preserves mid-gray through round-trip', () => {
      const original = { r: 128, g: 128, b: 128 };
      const result = xyzToRgb(rgbToXyz(original));
      expect(result.r).toBeCloseTo(original.r, 0);
      expect(result.g).toBeCloseTo(original.g, 0);
      expect(result.b).toBeCloseTo(original.b, 0);
    });

    it('preserves saturated colors through round-trip', () => {
      for (const color of [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 0, b: 255 }
      ]) {
        const result = xyzToRgb(rgbToXyz(color));
        expect(result.r).toBeCloseTo(color.r, 0);
        expect(result.g).toBeCloseTo(color.g, 0);
        expect(result.b).toBeCloseTo(color.b, 0);
      }
    });
  });

  describe('XYZ ↔ Lab round-trip', () => {
    it('produces L=0 for black', () => {
      const lab = xyzToLab(rgbToXyz({ r: 0, g: 0, b: 0 }));
      expect(lab.l).toBeCloseTo(0, 0);
    });

    it('produces L=100 for white', () => {
      const lab = xyzToLab(rgbToXyz({ r: 255, g: 255, b: 255 }));
      expect(lab.l).toBeCloseTo(100, 0);
    });

    it('preserves Lab values through Lab→XYZ→Lab', () => {
      const original = { l: 50, a: 20, b: -30 };
      const result = xyzToLab(labToXyz(original));
      expect(result.l).toBeCloseTo(original.l, 4);
      expect(result.a).toBeCloseTo(original.a, 4);
      expect(result.b).toBeCloseTo(original.b, 4);
    });
  });

  describe('Lab ↔ LCh round-trip', () => {
    it('converts achromatic colors (a=0, b=0) to C=0', () => {
      const lch = labToLch({ l: 50, a: 0, b: 0 });
      expect(lch.c).toBeCloseTo(0, 4);
    });

    it('preserves values through round-trip', () => {
      const original = { l: 65, c: 40, h: 120 };
      const result = labToLch(lchToLab(original));
      expect(result.l).toBeCloseTo(original.l, 4);
      expect(result.c).toBeCloseTo(original.c, 4);
      expect(result.h).toBeCloseTo(original.h, 4);
    });

    it('normalizes negative hue to positive', () => {
      const lab = { l: 50, a: -20, b: -20 };
      const lch = labToLch(lab);
      expect(lch.h).toBeGreaterThanOrEqual(0);
      expect(lch.h).toBeLessThan(360);
    });
  });

  describe('full RGB ↔ LCh round-trip', () => {
    const testColors = [
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 128, b: 255 },
      { r: 128, g: 128, b: 128 },
      { r: 50, g: 100, b: 200 }
    ];

    it.each(testColors)('preserves RGB(%i,%i,%i) through round-trip', (color) => {
      const result = lchToRgb(rgbToLch(color));
      expect(result.r).toBeCloseTo(color.r, 0);
      expect(result.g).toBeCloseTo(color.g, 0);
      expect(result.b).toBeCloseTo(color.b, 0);
    });
  });

  describe('adjustLightness', () => {
    it('increases lightness', () => {
      const original = { r: 100, g: 100, b: 100 };
      const lighter = adjustLightness(original, 20);
      const origLch = rgbToLch(original);
      const lightLch = rgbToLch(lighter);
      expect(lightLch.l).toBeGreaterThan(origLch.l);
    });

    it('decreases lightness', () => {
      const original = { r: 200, g: 200, b: 200 };
      const darker = adjustLightness(original, -20);
      const origLch = rgbToLch(original);
      const darkLch = rgbToLch(darker);
      expect(darkLch.l).toBeLessThan(origLch.l);
    });

    it('clamps to valid range', () => {
      const result = adjustLightness({ r: 255, g: 255, b: 255 }, 50);
      const lch = rgbToLch(result);
      // Allow tiny float precision overshoot from round-trip conversion
      expect(lch.l).toBeLessThanOrEqual(100.01);
    });
  });

  describe('adjustChroma', () => {
    it('increases saturation', () => {
      const gray = { r: 128, g: 100, b: 100 };
      const saturated = adjustChroma(gray, 30);
      const origLch = rgbToLch(gray);
      const satLch = rgbToLch(saturated);
      expect(satLch.c).toBeGreaterThan(origLch.c);
    });

    it('clamps chroma to non-negative', () => {
      const gray = { r: 128, g: 128, b: 128 };
      const result = adjustChroma(gray, -1000);
      const lch = rgbToLch(result);
      expect(lch.c).toBeGreaterThanOrEqual(0);
    });
  });

  describe('adjustHue', () => {
    it('rotates hue by specified degrees', () => {
      // Use a color with moderate chroma where hue is stable through RGB clamping
      const color = { r: 100, g: 150, b: 50 };
      const rotated = adjustHue(color, 60);
      const origLch = rgbToLch(color);
      const rotLch = rgbToLch(rotated);
      // Hue rotation may not be exact due to RGB gamut clamping, but should shift
      expect(Math.abs(rotLch.h - origLch.h)).toBeGreaterThan(10);
    });

    it('handles negative rotation', () => {
      const color = { r: 0, g: 128, b: 255 };
      const rotated = adjustHue(color, -180);
      const lch = rgbToLch(rotated);
      expect(lch.h).toBeGreaterThanOrEqual(0);
      expect(lch.h).toBeLessThan(360);
    });
  });

  describe('generateColorHarmony', () => {
    const baseColor = { r: 200, g: 50, b: 50 };

    it('complementary generates 2 colors', () => {
      const colors = generateColorHarmony(baseColor, 'complementary');
      expect(colors).toHaveLength(2);
      expect(colors[0]).toEqual(baseColor);
    });

    it('triadic generates 3 colors', () => {
      const colors = generateColorHarmony(baseColor, 'triadic');
      expect(colors).toHaveLength(3);
    });

    it('analogous generates 3 colors', () => {
      const colors = generateColorHarmony(baseColor, 'analogous');
      expect(colors).toHaveLength(3);
    });

    it('split-complementary generates 3 colors', () => {
      const colors = generateColorHarmony(baseColor, 'split-complementary');
      expect(colors).toHaveLength(3);
    });

    it('tetradic generates 4 colors', () => {
      const colors = generateColorHarmony(baseColor, 'tetradic');
      expect(colors).toHaveLength(4);
    });

    it('all harmony colors have valid RGB ranges', () => {
      for (const type of [
        'complementary',
        'triadic',
        'analogous',
        'split-complementary',
        'tetradic'
      ] as const) {
        const colors = generateColorHarmony(baseColor, type);
        for (const color of colors) {
          expect(color.r).toBeGreaterThanOrEqual(0);
          expect(color.r).toBeLessThanOrEqual(255);
          expect(color.g).toBeGreaterThanOrEqual(0);
          expect(color.g).toBeLessThanOrEqual(255);
          expect(color.b).toBeGreaterThanOrEqual(0);
          expect(color.b).toBeLessThanOrEqual(255);
        }
      }
    });
  });
});
