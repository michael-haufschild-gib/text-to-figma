/**
 * LCh Color Space Converter
 *
 * Provides conversion between RGB and LCh (Lightness, Chroma, Hue) color spaces
 * for perceptually uniform color adjustments. LCh is the cylindrical representation
 * of the CIE Lab color space.
 *
 * Color space conversions:
 * RGB → XYZ → Lab → LCh (forward)
 * LCh → Lab → XYZ → RGB (reverse)
 */

import { type RGB } from '../constraints/color.js';

/**
 * LCh color representation
 * - L: Lightness (0-100)
 * - C: Chroma (0-150, typically)
 * - h: Hue angle (0-360 degrees)
 */
export interface LCh {
  l: number; // Lightness: 0 (black) to 100 (white)
  c: number; // Chroma: 0 (gray) to ~150 (vivid)
  h: number; // Hue: 0-360 degrees
}

/**
 * CIE Lab color representation
 */
export interface Lab {
  l: number; // Lightness: 0-100
  a: number; // Green-Red axis: -128 to +127
  b: number; // Blue-Yellow axis: -128 to +127
}

/**
 * CIE XYZ color representation
 */
export interface XYZ {
  x: number;
  y: number;
  z: number;
}

/**
 * D65 illuminant reference white point
 */
const D65_WHITE_POINT = {
  x: 95.047,
  y: 100.0,
  z: 108.883
} as const;

/**
 * Converts RGB to XYZ color space
 * @param rgb
 */
export function rgbToXyz(rgb: RGB): XYZ {
  // Convert RGB [0-255] to [0-1]
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  // Apply gamma correction
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Scale to [0-100]
  r *= 100;
  g *= 100;
  b *= 100;

  // Apply transformation matrix (sRGB to XYZ D65)
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;

  return { x, y, z };
}

/**
 * Converts XYZ to RGB color space
 * @param xyz
 */
export function xyzToRgb(xyz: XYZ): RGB {
  // Apply inverse transformation matrix (XYZ D65 to sRGB)
  let r = xyz.x * 3.2404542 + xyz.y * -1.5371385 + xyz.z * -0.4985314;
  let g = xyz.x * -0.969266 + xyz.y * 1.8760108 + xyz.z * 0.041556;
  let b = xyz.x * 0.0556434 + xyz.y * -0.2040259 + xyz.z * 1.0572252;

  // Scale from [0-100] to [0-1]
  r /= 100;
  g /= 100;
  b /= 100;

  // Apply inverse gamma correction
  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

  // Scale to [0-255] and clamp
  return {
    r: Math.max(0, Math.min(255, Math.round(r * 255))),
    g: Math.max(0, Math.min(255, Math.round(g * 255))),
    b: Math.max(0, Math.min(255, Math.round(b * 255)))
  };
}

/**
 * Converts XYZ to Lab color space
 * @param xyz
 */
export function xyzToLab(xyz: XYZ): Lab {
  // Normalize by reference white point
  let x = xyz.x / D65_WHITE_POINT.x;
  let y = xyz.y / D65_WHITE_POINT.y;
  let z = xyz.z / D65_WHITE_POINT.z;

  // Apply Lab transformation function
  const delta = 6 / 29;
  const deltaSquared = delta * delta;

  const f = (t: number): number => {
    const deltaCubed = delta * delta * delta;
    return t > deltaCubed ? Math.pow(t, 1 / 3) : t / (3 * deltaSquared) + 4 / 29;
  };

  x = f(x);
  y = f(y);
  z = f(z);

  const l = 116 * y - 16;
  const a = 500 * (x - y);
  const b = 200 * (y - z);

  return { l, a, b };
}

/**
 * Converts Lab to XYZ color space
 * @param lab
 */
export function labToXyz(lab: Lab): XYZ {
  const fy = (lab.l + 16) / 116;
  const fx = lab.a / 500 + fy;
  const fz = fy - lab.b / 200;

  // Apply inverse Lab transformation function
  const delta = 6 / 29;
  const deltaSquared = delta * delta;

  const f = (t: number): number => {
    return t > delta ? Math.pow(t, 3) : 3 * deltaSquared * (t - 4 / 29);
  };

  const x = D65_WHITE_POINT.x * f(fx);
  const y = D65_WHITE_POINT.y * f(fy);
  const z = D65_WHITE_POINT.z * f(fz);

  return { x, y, z };
}

/**
 * Converts Lab to LCh color space
 * @param lab
 */
export function labToLch(lab: Lab): LCh {
  const l = lab.l;
  const c = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let h = Math.atan2(lab.b, lab.a) * (180 / Math.PI);

  // Normalize hue to [0-360]
  if (h < 0) {
    h += 360;
  }

  return { l, c, h };
}

/**
 * Converts LCh to Lab color space
 * @param lch
 */
export function lchToLab(lch: LCh): Lab {
  const l = lch.l;
  const a = lch.c * Math.cos(lch.h * (Math.PI / 180));
  const b = lch.c * Math.sin(lch.h * (Math.PI / 180));

  return { l, a, b };
}

/**
 * Converts RGB to LCh color space
 * @param rgb
 */
export function rgbToLch(rgb: RGB): LCh {
  const xyz = rgbToXyz(rgb);
  const lab = xyzToLab(xyz);
  return labToLch(lab);
}

/**
 * Converts LCh to RGB color space
 * @param lch
 */
export function lchToRgb(lch: LCh): RGB {
  const lab = lchToLab(lch);
  const xyz = labToXyz(lab);
  return xyzToRgb(xyz);
}

/**
 * Adjusts lightness of a color by a given amount
 * @param rgb - Input RGB color
 * @param amount - Amount to adjust (-100 to +100)
 */
export function adjustLightness(rgb: RGB, amount: number): RGB {
  const lch = rgbToLch(rgb);
  lch.l = Math.max(0, Math.min(100, lch.l + amount));
  return lchToRgb(lch);
}

/**
 * Adjusts chroma (saturation) of a color by a given amount
 * @param rgb - Input RGB color
 * @param amount - Amount to adjust (can be negative)
 */
export function adjustChroma(rgb: RGB, amount: number): RGB {
  const lch = rgbToLch(rgb);
  lch.c = Math.max(0, lch.c + amount);
  return lchToRgb(lch);
}

/**
 * Adjusts hue of a color by rotating the hue angle
 * @param rgb - Input RGB color
 * @param degrees - Degrees to rotate (-360 to +360)
 */
export function adjustHue(rgb: RGB, degrees: number): RGB {
  const lch = rgbToLch(rgb);
  lch.h = (lch.h + degrees) % 360;
  if (lch.h < 0) {
    lch.h += 360;
  }
  return lchToRgb(lch);
}

/**
 * Color harmony type
 */
export type ColorHarmonyType =
  | 'complementary'
  | 'triadic'
  | 'analogous'
  | 'split-complementary'
  | 'tetradic';

/**
 * Generates color harmonies based on hue relationships
 * @param rgb
 * @param type
 */
export function generateColorHarmony(rgb: RGB, type: ColorHarmonyType): RGB[] {
  const lch = rgbToLch(rgb);
  const colors: RGB[] = [rgb]; // Include original color

  switch (type) {
    case 'complementary':
      // 180° opposite on color wheel
      colors.push(lchToRgb({ ...lch, h: (lch.h + 180) % 360 }));
      break;

    case 'triadic':
      // Three colors evenly spaced (120° apart)
      colors.push(lchToRgb({ ...lch, h: (lch.h + 120) % 360 }));
      colors.push(lchToRgb({ ...lch, h: (lch.h + 240) % 360 }));
      break;

    case 'analogous':
      // Adjacent colors (±30°)
      colors.push(lchToRgb({ ...lch, h: (lch.h - 30 + 360) % 360 }));
      colors.push(lchToRgb({ ...lch, h: (lch.h + 30) % 360 }));
      break;

    case 'split-complementary':
      // Complement's neighbors (180° ± 30°)
      colors.push(lchToRgb({ ...lch, h: (lch.h + 150) % 360 }));
      colors.push(lchToRgb({ ...lch, h: (lch.h + 210) % 360 }));
      break;

    case 'tetradic':
      // Four colors in rectangle (90° spacing from complement)
      colors.push(lchToRgb({ ...lch, h: (lch.h + 90) % 360 }));
      colors.push(lchToRgb({ ...lch, h: (lch.h + 180) % 360 }));
      colors.push(lchToRgb({ ...lch, h: (lch.h + 270) % 360 }));
      break;
  }

  return colors;
}

/**
 * Creates a perceptually uniform gradient between two colors
 * @param from - Starting RGB color
 * @param to - Ending RGB color
 * @param steps - Number of intermediate steps
 */
export function createPerceptualGradient(from: RGB, to: RGB, steps: number): RGB[] {
  const fromLch = rgbToLch(from);
  const toLch = rgbToLch(to);

  const gradient: RGB[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;

    // Interpolate in LCh space for perceptual uniformity
    const l = fromLch.l + (toLch.l - fromLch.l) * t;
    const c = fromLch.c + (toLch.c - fromLch.c) * t;

    // Handle hue interpolation (shortest path around color wheel)
    let h: number;
    const hueDiff = toLch.h - fromLch.h;
    if (Math.abs(hueDiff) <= 180) {
      h = fromLch.h + hueDiff * t;
    } else if (hueDiff > 180) {
      h = fromLch.h + (hueDiff - 360) * t;
    } else {
      h = fromLch.h + (hueDiff + 360) * t;
    }
    h = ((h % 360) + 360) % 360; // Normalize to [0-360]

    gradient.push(lchToRgb({ l, c, h }));
  }

  return gradient;
}
