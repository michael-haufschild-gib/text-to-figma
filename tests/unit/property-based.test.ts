/**
 * Property-Based Tests using @fast-check/vitest
 *
 * Tests mathematical invariants and round-trip properties of pure functions
 * across the color, spacing, typography, and path-repair modules.
 */

import { test, fc } from '@fast-check/vitest';
import { describe, expect } from 'vitest';
import {
  getContrastRatio,
  getRelativeLuminance,
  hexToRgb,
  rgbToHex,
  validateContrast
} from '../../mcp-server/src/constraints/color.js';
import {
  isValidSpacing,
  snapToGrid,
  validateSpacing,
  VALID_SPACING_VALUES
} from '../../mcp-server/src/constraints/spacing.js';
import {
  isValidFontSize,
  snapToTypeScale,
  validateTypography,
  getRecommendedLineHeight,
  VALID_FONT_SIZES
} from '../../mcp-server/src/constraints/typography.js';
import {
  rgbToXyz,
  xyzToRgb,
  rgbToLch,
  lchToRgb,
  labToLch,
  lchToLab,
  xyzToLab,
  labToXyz
} from '../../mcp-server/src/utils/color-converter.js';
import { repairPathCommands } from '../../mcp-server/src/tools/utils/path-command-repair.js';

// -- Arbitraries --

const rgbArb = fc.record({
  r: fc.integer({ min: 0, max: 255 }),
  g: fc.integer({ min: 0, max: 255 }),
  b: fc.integer({ min: 0, max: 255 })
});

const hex6Arb = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map(
    ([r, g, b]) =>
      '#' +
      r.toString(16).padStart(2, '0') +
      g.toString(16).padStart(2, '0') +
      b.toString(16).padStart(2, '0')
  );

const positiveNumber = fc.double({ min: 0, max: 10000, noNaN: true });

const pathCommandType = fc.constantFrom('M', 'L');

const validPathArb = fc
  .tuple(
    fc.record({
      x: fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true }),
      y: fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true })
    }),
    fc.array(
      fc.record({
        x: fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true }),
        y: fc.double({ min: -10000, max: 10000, noNaN: true, noDefaultInfinity: true })
      }),
      { minLength: 1, maxLength: 20 }
    )
  )
  .map(([start, rest]) => [
    { type: 'M' as const, ...start },
    ...rest.map((p) => ({ type: 'L' as const, ...p }))
  ]);

// -- Color: hex/RGB round-trips --

describe('Property: Color hex/RGB', () => {
  test.prop({ rgb: rgbArb })('rgb → hex → rgb is identity', ({ rgb }) => {
    const hex = rgbToHex(rgb);
    const back = hexToRgb(hex)!;
    expect(back.r).toBe(rgb.r);
    expect(back.g).toBe(rgb.g);
    expect(back.b).toBe(rgb.b);
  });

  test.prop({ hex: hex6Arb })('hex → rgb → hex is identity', ({ hex }) => {
    const rgb = hexToRgb(hex)!;
    const back = rgbToHex(rgb);
    expect(back.toLowerCase()).toBe(hex.toLowerCase());
  });

  test.prop({ hex: hex6Arb })('hexToRgb output channels are 0..255', ({ hex }) => {
    const rgb = hexToRgb(hex)!;
    expect(rgb.r).toBeGreaterThanOrEqual(0);
    expect(rgb.r).toBeLessThanOrEqual(255);
    expect(rgb.g).toBeGreaterThanOrEqual(0);
    expect(rgb.g).toBeLessThanOrEqual(255);
    expect(rgb.b).toBeGreaterThanOrEqual(0);
    expect(rgb.b).toBeLessThanOrEqual(255);
  });
});

// -- Color: luminance invariants --

describe('Property: Luminance', () => {
  test.prop({ rgb: rgbArb })('luminance is in [0, 1]', ({ rgb }) => {
    const lum = getRelativeLuminance(rgb);
    expect(lum).toBeGreaterThanOrEqual(0);
    expect(lum).toBeLessThanOrEqual(1);
  });

  test.prop({ rgb: rgbArb })(
    'luminance is monotonic when all channels increase equally',
    ({ rgb }) => {
      const lum = getRelativeLuminance(rgb);
      const brighter = {
        r: Math.min(255, rgb.r + 1),
        g: Math.min(255, rgb.g + 1),
        b: Math.min(255, rgb.b + 1)
      };
      const lumBrighter = getRelativeLuminance(brighter);
      expect(lumBrighter).toBeGreaterThanOrEqual(lum);
    }
  );
});

// -- Color: contrast ratio invariants --

describe('Property: Contrast ratio', () => {
  test.prop({ a: rgbArb, b: rgbArb })('contrast ratio is in [1, 21]', ({ a, b }) => {
    const ratio = getContrastRatio(a, b);
    expect(ratio).toBeGreaterThanOrEqual(1);
    expect(ratio).toBeLessThanOrEqual(21);
  });

  test.prop({ a: rgbArb, b: rgbArb })('contrast ratio is symmetric', ({ a, b }) => {
    const ab = getContrastRatio(a, b);
    const ba = getContrastRatio(b, a);
    expect(ab).toBeCloseTo(ba, 10);
  });

  test.prop({ rgb: rgbArb })('contrast of a color with itself is 1', ({ rgb }) => {
    expect(getContrastRatio(rgb, rgb)).toBeCloseTo(1, 10);
  });

  test.prop({ a: rgbArb, b: rgbArb })(
    'validateContrast AA.large threshold <= AA.normal threshold',
    ({ a, b }) => {
      const result = validateContrast(a, b);
      if (result.passes.AA.normal) {
        expect(result.passes.AA.large).toBe(true);
      }
      if (result.passes.AAA.normal) {
        expect(result.passes.AAA.large).toBe(true);
      }
    }
  );
});

// -- LCh color space round-trips --

describe('Property: LCh color space', () => {
  test.prop({ rgb: rgbArb })('rgb → xyz → rgb round-trip within ±1', ({ rgb }) => {
    const xyz = rgbToXyz(rgb);
    const back = xyzToRgb(xyz);
    expect(back.r).toBeGreaterThanOrEqual(0);
    expect(back.r).toBeLessThanOrEqual(255);
    expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(1);
  });

  test.prop({ rgb: rgbArb })('rgb → lch → rgb round-trip within ±2', ({ rgb }) => {
    const lch = rgbToLch(rgb);
    const back = lchToRgb(lch);
    expect(back.r).toBeGreaterThanOrEqual(0);
    expect(back.r).toBeLessThanOrEqual(255);
    // LCh round-trips can accumulate small floating-point drift
    expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(2);
  });

  test.prop({ rgb: rgbArb })('lch lightness is in [0, 100] for valid RGB', ({ rgb }) => {
    const lch = rgbToLch(rgb);
    expect(lch.l).toBeGreaterThanOrEqual(-0.001);
    expect(lch.l).toBeLessThanOrEqual(100.001);
  });

  test.prop({ rgb: rgbArb })('lch hue is in [0, 360)', ({ rgb }) => {
    const lch = rgbToLch(rgb);
    expect(lch.h).toBeGreaterThanOrEqual(0);
    expect(lch.h).toBeLessThan(360.001);
  });

  test.prop({ rgb: rgbArb })('lch chroma is non-negative', ({ rgb }) => {
    const lch = rgbToLch(rgb);
    expect(lch.c).toBeGreaterThanOrEqual(-0.001);
  });

  test.prop({ rgb: rgbArb })('lab → lch → lab round-trip preserves values', ({ rgb }) => {
    const xyz = rgbToXyz(rgb);
    const lab = xyzToLab(xyz);
    const lch = labToLch(lab);
    const backLab = lchToLab(lch);
    expect(backLab.l).toBeCloseTo(lab.l, 8);
    expect(backLab.a).toBeCloseTo(lab.a, 8);
    expect(backLab.b).toBeCloseTo(lab.b, 8);
  });

  test.prop({ rgb: rgbArb })('xyz → lab → xyz round-trip preserves values', ({ rgb }) => {
    const xyz = rgbToXyz(rgb);
    const lab = xyzToLab(xyz);
    const backXyz = labToXyz(lab);
    expect(backXyz.x).toBeCloseTo(xyz.x, 8);
    expect(backXyz.y).toBeCloseTo(xyz.y, 8);
    expect(backXyz.z).toBeCloseTo(xyz.z, 8);
  });
});

// -- Spacing: snap invariants --

describe('Property: Spacing grid', () => {
  test.prop({ n: positiveNumber })('snapToGrid always returns a valid spacing value', ({ n }) => {
    const snapped = snapToGrid(n);
    expect(VALID_SPACING_VALUES).toContain(snapped);
  });

  test.prop({ n: positiveNumber })('snapToGrid is idempotent', ({ n }) => {
    const once = snapToGrid(n);
    const twice = snapToGrid(once);
    expect(twice).toBe(once);
  });

  test.prop({ n: positiveNumber })(
    'isValidSpacing agrees with VALID_SPACING_VALUES membership',
    ({ n }) => {
      const rounded = Math.round(n);
      const expected = (VALID_SPACING_VALUES as readonly number[]).includes(rounded);
      expect(isValidSpacing(rounded)).toBe(expected);
    }
  );

  test.prop({ n: positiveNumber })(
    'validateSpacing.isValid is true iff value is in VALID_SPACING_VALUES',
    ({ n }) => {
      const rounded = Math.round(n);
      const result = validateSpacing(rounded);
      const expected = (VALID_SPACING_VALUES as readonly number[]).includes(rounded);
      expect(result.isValid).toBe(expected);
    }
  );

  test.prop({ n: fc.double({ min: -1000, max: 1000, noNaN: true }) })(
    'snapToGrid result is the closest valid value',
    ({ n }) => {
      const snapped = snapToGrid(n);
      const snappedDist = Math.abs(n - snapped);
      for (const v of VALID_SPACING_VALUES) {
        // No valid value should be strictly closer
        expect(Math.abs(n - v)).toBeGreaterThanOrEqual(snappedDist - 0.0001);
      }
    }
  );
});

// -- Typography: snap invariants --

describe('Property: Typography scale', () => {
  test.prop({ n: positiveNumber })('snapToTypeScale always returns a valid font size', ({ n }) => {
    const snapped = snapToTypeScale(n);
    expect(VALID_FONT_SIZES).toContain(snapped);
  });

  test.prop({ n: positiveNumber })('snapToTypeScale is idempotent', ({ n }) => {
    const once = snapToTypeScale(n);
    const twice = snapToTypeScale(once);
    expect(twice).toBe(once);
  });

  test.prop({ n: positiveNumber })(
    'isValidFontSize agrees with VALID_FONT_SIZES membership',
    ({ n }) => {
      const rounded = Math.round(n);
      const expected = (VALID_FONT_SIZES as readonly number[]).includes(rounded);
      expect(isValidFontSize(rounded)).toBe(expected);
    }
  );

  test.prop({ n: positiveNumber })(
    'validateTypography.isValid iff value is in VALID_FONT_SIZES',
    ({ n }) => {
      const rounded = Math.round(n);
      const result = validateTypography(rounded);
      const expected = (VALID_FONT_SIZES as readonly number[]).includes(rounded);
      expect(result.isValid).toBe(expected);
    }
  );

  test.prop({
    fontSize: fc.constantFrom(...VALID_FONT_SIZES)
  })('recommendedLineHeight is always > fontSize', ({ fontSize }) => {
    const lh = getRecommendedLineHeight(fontSize);
    expect(lh).toBeGreaterThan(fontSize);
  });

  test.prop({
    fontSize: fc.constantFrom(...VALID_FONT_SIZES)
  })('recommendedLineHeight is an integer', ({ fontSize }) => {
    const lh = getRecommendedLineHeight(fontSize);
    expect(Number.isInteger(lh)).toBe(true);
  });
});

// -- Path command repair --

describe('Property: Path command repair', () => {
  test.prop({ path: validPathArb })(
    'valid path commands pass through without fixes',
    ({ path }) => {
      const result = repairPathCommands(path);
      expect(result.totalFixed).toBe(0);
      expect(result.commands).toHaveLength(path.length);
    }
  );

  test.prop({ path: validPathArb })('repaired commands preserve coordinate values', ({ path }) => {
    const result = repairPathCommands(path);
    for (let i = 0; i < path.length; i++) {
      expect(result.commands[i].type).toBe(path[i].type);
      if (path[i].type !== 'Z') {
        expect(result.commands[i].x).toBeCloseTo(path[i].x as number, 10);
        expect(result.commands[i].y).toBeCloseTo(path[i].y as number, 10);
      }
    }
  });

  test.prop({ path: validPathArb })(
    'string-coerced coordinates are repaired to original values',
    ({ path }) => {
      const stringified = path.map((cmd) => {
        if (cmd.type === 'Z') return cmd;
        return { ...cmd, x: String(cmd.x), y: String(cmd.y) };
      });
      const result = repairPathCommands(stringified);
      for (let i = 0; i < path.length; i++) {
        if (path[i].type !== 'Z') {
          expect(result.commands[i].x).toBeCloseTo(path[i].x as number, 10);
          expect(result.commands[i].y).toBeCloseTo(path[i].y as number, 10);
        }
      }
    }
  );
});
