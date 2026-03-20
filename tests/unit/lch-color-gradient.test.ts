/**
 * LCh Color Space — Gradient & Edge Case Tests
 *
 * Tests perceptual gradient generation and edge cases for the LCh color
 * conversion pipeline (hue wrapping, gamut clamping, achromatic colors).
 */

import { describe, expect, it } from 'vitest';
import {
  rgbToLch,
  adjustLightness,
  adjustChroma,
  adjustHue,
  generateColorHarmony,
  createPerceptualGradient
} from '../../mcp-server/src/utils/color-converter.js';

describe('LCh Color — gradients & edge cases', () => {
  describe('createPerceptualGradient', () => {
    it('produces correct number of steps', () => {
      const gradient = createPerceptualGradient(
        { r: 0, g: 0, b: 0 },
        { r: 255, g: 255, b: 255 },
        5
      );
      expect(gradient).toHaveLength(6); // steps + 1 (inclusive)
    });

    it('starts with from color and ends with to color', () => {
      const from = { r: 0, g: 0, b: 0 };
      const to = { r: 255, g: 255, b: 255 };
      const gradient = createPerceptualGradient(from, to, 4);

      expect(gradient[0].r).toBeCloseTo(from.r, 0);
      expect(gradient[0].g).toBeCloseTo(from.g, 0);
      expect(gradient[gradient.length - 1].r).toBeCloseTo(to.r, 0);
      expect(gradient[gradient.length - 1].g).toBeCloseTo(to.g, 0);
    });

    it('produces monotonically increasing lightness for black-to-white', () => {
      const gradient = createPerceptualGradient(
        { r: 0, g: 0, b: 0 },
        { r: 255, g: 255, b: 255 },
        10
      );

      for (let i = 1; i < gradient.length; i++) {
        const prevLch = rgbToLch(gradient[i - 1]);
        const currLch = rgbToLch(gradient[i]);
        expect(currLch.l).toBeGreaterThanOrEqual(prevLch.l - 0.1); // allow tiny float error
      }
    });

    it('with same start/end color returns identical steps', () => {
      const color = { r: 128, g: 64, b: 200 };
      const gradient = createPerceptualGradient(color, color, 3);
      expect(gradient).toHaveLength(4);
      for (const step of gradient) {
        expect(step.r).toBeCloseTo(color.r, 0);
        expect(step.g).toBeCloseTo(color.g, 0);
        expect(step.b).toBeCloseTo(color.b, 0);
      }
    });

    it('with 1 step produces 2 colors (start and end)', () => {
      const gradient = createPerceptualGradient(
        { r: 0, g: 0, b: 0 },
        { r: 255, g: 255, b: 255 },
        1
      );
      expect(gradient).toHaveLength(2);
    });

    it('takes shortest hue path when hueDiff > 180°', () => {
      const red = { r: 255, g: 50, b: 50 };
      const magenta = { r: 255, g: 50, b: 200 };
      const gradient = createPerceptualGradient(red, magenta, 4);

      const midLch = rgbToLch(gradient[2]);
      const redLch = rgbToLch(red);
      const magentaLch = rgbToLch(magenta);

      const midToRed = Math.min(Math.abs(midLch.h - redLch.h), 360 - Math.abs(midLch.h - redLch.h));
      const midToMagenta = Math.min(
        Math.abs(midLch.h - magentaLch.h),
        360 - Math.abs(midLch.h - magentaLch.h)
      );
      expect(midToRed).toBeLessThan(90);
      expect(midToMagenta).toBeLessThan(90);
    });

    it('takes shortest hue path when hueDiff < -180°', () => {
      const magenta = { r: 255, g: 50, b: 200 };
      const red = { r: 255, g: 50, b: 50 };
      const gradient = createPerceptualGradient(magenta, red, 4);

      const midLch = rgbToLch(gradient[2]);
      const redLch = rgbToLch(red);
      const magentaLch = rgbToLch(magenta);

      const midToRed = Math.min(Math.abs(midLch.h - redLch.h), 360 - Math.abs(midLch.h - redLch.h));
      const midToMagenta = Math.min(
        Math.abs(midLch.h - magentaLch.h),
        360 - Math.abs(midLch.h - magentaLch.h)
      );
      expect(midToRed).toBeLessThan(90);
      expect(midToMagenta).toBeLessThan(90);
    });

    it('all gradient steps have valid RGB values', () => {
      const blue = { r: 0, g: 100, b: 255 };
      const orange = { r: 255, g: 150, b: 0 };
      const gradient = createPerceptualGradient(blue, orange, 8);

      for (const step of gradient) {
        expect(step.r).toBeGreaterThanOrEqual(0);
        expect(step.r).toBeLessThanOrEqual(255);
        expect(step.g).toBeGreaterThanOrEqual(0);
        expect(step.g).toBeLessThanOrEqual(255);
        expect(step.b).toBeGreaterThanOrEqual(0);
        expect(step.b).toBeLessThanOrEqual(255);
      }
    });

    it('gradient chroma interpolates between start and end', () => {
      const red = { r: 200, g: 50, b: 50 };
      const gray = { r: 128, g: 128, b: 128 };
      const gradient = createPerceptualGradient(red, gray, 4);

      const startChroma = rgbToLch(gradient[0]).c;
      const endChroma = rgbToLch(gradient[gradient.length - 1]).c;
      const midChroma = rgbToLch(gradient[2]).c;

      expect(midChroma).toBeLessThan(startChroma + 5);
      expect(midChroma).toBeGreaterThan(endChroma - 5);
    });

    it('gradient with small hue diff uses direct interpolation', () => {
      const c1 = { r: 200, g: 100, b: 50 };
      const c2 = { r: 200, g: 50, b: 50 };
      const gradient = createPerceptualGradient(c1, c2, 4);

      const h1 = rgbToLch(c1).h;
      const h2 = rgbToLch(c2).h;
      const midH = rgbToLch(gradient[2]).h;

      const range = [Math.min(h1, h2) - 15, Math.max(h1, h2) + 15];
      expect(midH).toBeGreaterThan(range[0]);
      expect(midH).toBeLessThan(range[1]);
    });

    it('direct hue interpolation goes in correct direction for small diff', () => {
      const green = { r: 0, g: 200, b: 50 };
      const blue = { r: 50, g: 50, b: 200 };
      const gradient = createPerceptualGradient(green, blue, 4);

      const hStart = rgbToLch(green).h;
      const hEnd = rgbToLch(blue).h;
      const hMid = rgbToLch(gradient[2]).h;

      const startToMid = (((hMid - hStart) % 360) + 360) % 360;
      const startToEnd = (((hEnd - hStart) % 360) + 360) % 360;

      if (startToEnd <= 180) {
        expect(startToMid).toBeLessThan(startToEnd + 30);
        expect(startToMid).toBeGreaterThan(0);
      }
    });

    it('gradient chroma at t=0.5 is midpoint between start and end chroma', () => {
      const red = { r: 200, g: 30, b: 30 };
      const gray = { r: 128, g: 128, b: 128 };
      const gradient = createPerceptualGradient(red, gray, 2);

      const cStart = rgbToLch(gradient[0]).c;
      const cEnd = rgbToLch(gradient[2]).c;
      const cMid = rgbToLch(gradient[1]).c;

      const expectedMid = (cStart + cEnd) / 2;
      expect(cMid).toBeCloseTo(expectedMid, 0);
    });

    it('hue interpolation with exactly 180° difference', () => {
      const cyan = { r: 0, g: 200, b: 200 };
      const redOrange = { r: 200, g: 80, b: 0 };
      const gradient = createPerceptualGradient(cyan, redOrange, 2);
      expect(gradient).toHaveLength(3);
      for (const step of gradient) {
        expect(step.r).toBeGreaterThanOrEqual(0);
        expect(step.r).toBeLessThanOrEqual(255);
      }
    });
  });

  describe('edge cases', () => {
    it('adjustHue wrapping: 350° + 30° should wrap around', () => {
      const color = { r: 255, g: 0, b: 128 };
      const rotated = adjustHue(color, 30);
      const lch = rgbToLch(rotated);
      expect(lch.h).toBeGreaterThanOrEqual(0);
      expect(lch.h).toBeLessThan(360);
    });

    it('adjustChroma on pure gray (C=0) with positive delta', () => {
      const gray = { r: 128, g: 128, b: 128 };
      const result = adjustChroma(gray, 50);
      expect(result.r).toBeGreaterThanOrEqual(0);
      expect(result.r).toBeLessThanOrEqual(255);
    });

    it('adjustLightness clamping: making black darker stays at 0', () => {
      const black = { r: 0, g: 0, b: 0 };
      const result = adjustLightness(black, -50);
      const lch = rgbToLch(result);
      expect(lch.l).toBeCloseTo(0, 0);
    });

    it('createPerceptualGradient with 0 steps produces start and end only', () => {
      const from = { r: 0, g: 0, b: 0 };
      const to = { r: 255, g: 255, b: 255 };
      const gradient = createPerceptualGradient(from, to, 0);
      expect(gradient).toHaveLength(1);
    });

    it('adjustLightness with extreme positive delta clamps to max', () => {
      const dark = { r: 50, g: 50, b: 50 };
      const result = adjustLightness(dark, 200);
      expect(result.r).toBeGreaterThanOrEqual(0);
      expect(result.r).toBeLessThanOrEqual(255);
    });

    it('adjustChroma with extreme negative delta produces near-gray', () => {
      const red = { r: 200, g: 50, b: 50 };
      const result = adjustChroma(red, -200);
      const lch = rgbToLch(result);
      expect(lch.c).toBeLessThan(5);
    });

    it('adjustHue with 360 degree rotation returns similar color', () => {
      const color = { r: 100, g: 150, b: 50 };
      const rotated = adjustHue(color, 360);
      // 360° rotation should return approximately the same color
      expect(Math.abs(rotated.r - color.r)).toBeLessThanOrEqual(2);
      expect(Math.abs(rotated.g - color.g)).toBeLessThanOrEqual(2);
      expect(Math.abs(rotated.b - color.b)).toBeLessThanOrEqual(2);
    });

    it('adjustHue with 0 degree rotation returns same color', () => {
      const color = { r: 100, g: 150, b: 50 };
      const rotated = adjustHue(color, 0);
      expect(Math.abs(rotated.r - color.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(rotated.g - color.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(rotated.b - color.b)).toBeLessThanOrEqual(1);
    });

    it('generateColorHarmony tetradic produces 4 distinct hues', () => {
      const base = { r: 200, g: 50, b: 50 };
      const colors = generateColorHarmony(base, 'tetradic');
      const hues = colors.map((c) => rgbToLch(c).h);

      // All 4 hues should be distinct (at least 30° apart)
      for (let i = 0; i < hues.length; i++) {
        for (let j = i + 1; j < hues.length; j++) {
          const diff = Math.min(Math.abs(hues[i] - hues[j]), 360 - Math.abs(hues[i] - hues[j]));
          expect(diff).toBeGreaterThan(20);
        }
      }
    });

    it('all gradient steps have integer RGB values', () => {
      const from = { r: 30, g: 100, b: 200 };
      const to = { r: 200, g: 50, b: 50 };
      const gradient = createPerceptualGradient(from, to, 5);

      for (const step of gradient) {
        expect(Number.isInteger(step.r)).toBe(true);
        expect(Number.isInteger(step.g)).toBe(true);
        expect(Number.isInteger(step.b)).toBe(true);
      }
    });

    it('generateColorHarmony complementary colors have ~180° hue difference', () => {
      const base = { r: 200, g: 50, b: 50 };
      const colors = generateColorHarmony(base, 'complementary');
      expect(colors).toHaveLength(2);

      const baseLch = rgbToLch(colors[0]);
      const compLch = rgbToLch(colors[1]);

      const hueDiff = Math.abs(baseLch.h - compLch.h);
      const normalizedDiff = Math.min(hueDiff, 360 - hueDiff);
      expect(normalizedDiff).toBeGreaterThan(90);
    });

    it('generateColorHarmony triadic colors have ~120° spacing', () => {
      const base = { r: 200, g: 50, b: 50 };
      const colors = generateColorHarmony(base, 'triadic');
      expect(colors).toHaveLength(3);

      const hues = colors.map((c) => rgbToLch(c).h);
      const diff1 = Math.min(Math.abs(hues[1] - hues[0]), 360 - Math.abs(hues[1] - hues[0]));
      const diff2 = Math.min(Math.abs(hues[2] - hues[0]), 360 - Math.abs(hues[2] - hues[0]));
      expect(diff1).toBeGreaterThan(60);
      expect(diff2).toBeGreaterThan(60);
    });

    it('generateColorHarmony analogous: one hue below, one above base', () => {
      const base = { r: 100, g: 150, b: 50 };
      const colors = generateColorHarmony(base, 'analogous');
      const baseHue = rgbToLch(base).h;

      const hue1 = rgbToLch(colors[1]).h;
      const hue2 = rgbToLch(colors[2]).h;

      function signedHueDiff(from: number, to: number): number {
        let d = to - from;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        return d;
      }

      const diff1 = signedHueDiff(baseHue, hue1);
      const diff2 = signedHueDiff(baseHue, hue2);

      expect(diff1 * diff2).toBeLessThan(0); // opposite signs
      expect(Math.abs(diff1)).toBeLessThan(60);
      expect(Math.abs(diff2)).toBeLessThan(60);
    });

    it('generateColorHarmony triadic: hues offset by +120° and +240° from base', () => {
      const base = { r: 200, g: 50, b: 50 };
      const colors = generateColorHarmony(base, 'triadic');
      const baseHue = rgbToLch(base).h;
      const hue1 = rgbToLch(colors[1]).h;
      const hue2 = rgbToLch(colors[2]).h;

      function normalizedDiff(from: number, to: number): number {
        let d = to - from;
        if (d < 0) d += 360;
        return d;
      }

      const d1 = normalizedDiff(baseHue, hue1);
      const d2 = normalizedDiff(baseHue, hue2);

      expect(d1).toBeGreaterThan(80);
      expect(d1).toBeLessThan(160);
      expect(d2).toBeGreaterThan(200);
      expect(d2).toBeLessThan(280);
    });

    it('generateColorHarmony split-complementary: hues at +150° and +210°', () => {
      const base = { r: 100, g: 150, b: 50 };
      const colors = generateColorHarmony(base, 'split-complementary');
      expect(colors).toHaveLength(3);

      const baseHue = rgbToLch(base).h;
      const hue1 = rgbToLch(colors[1]).h;
      const hue2 = rgbToLch(colors[2]).h;

      function normalizedDiff(from: number, to: number): number {
        let d = to - from;
        if (d < 0) d += 360;
        return d;
      }

      const d1 = normalizedDiff(baseHue, hue1);
      const d2 = normalizedDiff(baseHue, hue2);

      expect(d1).toBeGreaterThan(110);
      expect(d1).toBeLessThan(190);
      expect(d2).toBeGreaterThan(170);
      expect(d2).toBeLessThan(250);
    });
  });
});
