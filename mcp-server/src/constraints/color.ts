/**
 * Color Constraints - WCAG Contrast Ratio Calculations
 *
 * Provides utilities for calculating and validating color contrast ratios
 * according to WCAG 2.1 accessibility guidelines.
 *
 * WCAG AA: 4.5:1 for normal text, 3:1 for large text
 * WCAG AAA: 7:1 for normal text, 4.5:1 for large text
 */

import { z } from 'zod';

/**
 * RGB color representation
 */
export interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

/**
 * WCAG compliance levels
 */
export enum WCAGLevel {
  AA = 'AA',
  AAA = 'AAA'
}

/**
 * Text size categories for WCAG
 */
export enum TextSize {
  Normal = 'normal', // < 18pt regular or < 14pt bold
  Large = 'large' // >= 18pt regular or >= 14pt bold
}

/**
 * Contrast ratio thresholds
 */
export const CONTRAST_THRESHOLDS = {
  [WCAGLevel.AA]: {
    [TextSize.Normal]: 4.5,
    [TextSize.Large]: 3.0
  },
  [WCAGLevel.AAA]: {
    [TextSize.Normal]: 7.0,
    [TextSize.Large]: 4.5
  }
} as const;

/**
 * Zod schema for RGB color validation
 */
export const rgbSchema = z.object({
  r: z.number().min(0).max(255),
  g: z.number().min(0).max(255),
  b: z.number().min(0).max(255)
});

/**
 * Converts hex color to RGB
 */
export function hexToRgb(hex: string): RGB | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null;
}

/**
 * Converts RGB to hex color
 */
export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number): string => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Calculates relative luminance of a color
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function getRelativeLuminance(rgb: RGB): number {
  const rsRGB = rgb.r / 255;
  const gsRGB = rgb.g / 255;
  const bsRGB = rgb.b / 255;

  const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculates contrast ratio between two colors
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
export function getContrastRatio(color1: RGB, color2: RGB): number {
  const lum1 = getRelativeLuminance(color1);
  const lum2 = getRelativeLuminance(color2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Result of contrast validation
 */
export interface ContrastValidationResult {
  ratio: number;
  passes: {
    AA: {
      normal: boolean;
      large: boolean;
    };
    AAA: {
      normal: boolean;
      large: boolean;
    };
  };
  recommendation: string;
}

/**
 * Validates contrast ratio against WCAG standards
 */
export function validateContrast(foreground: RGB, background: RGB): ContrastValidationResult {
  const ratio = getContrastRatio(foreground, background);

  const passes = {
    AA: {
      normal: ratio >= CONTRAST_THRESHOLDS.AA.normal,
      large: ratio >= CONTRAST_THRESHOLDS.AA.large
    },
    AAA: {
      normal: ratio >= CONTRAST_THRESHOLDS.AAA.normal,
      large: ratio >= CONTRAST_THRESHOLDS.AAA.large
    }
  };

  let recommendation: string;
  if (passes.AAA.normal) {
    recommendation = 'Excellent contrast - passes WCAG AAA for all text sizes';
  } else if (passes.AAA.large) {
    recommendation = 'Good contrast - passes WCAG AAA for large text, AA for normal text';
  } else if (passes.AA.normal) {
    recommendation = 'Acceptable contrast - passes WCAG AA for all text sizes';
  } else if (passes.AA.large) {
    recommendation = 'Limited contrast - only passes WCAG AA for large text';
  } else {
    recommendation = 'Poor contrast - fails WCAG standards. Consider adjusting colors';
  }

  return {
    ratio,
    passes,
    recommendation
  };
}

/**
 * Checks if contrast meets a specific WCAG level
 */
export function meetsWCAG(
  foreground: RGB,
  background: RGB,
  level: WCAGLevel,
  textSize: TextSize
): boolean {
  const ratio = getContrastRatio(foreground, background);
  const threshold = CONTRAST_THRESHOLDS[level][textSize];
  return ratio >= threshold;
}

/**
 * Suggests adjustments to improve contrast
 */
export function suggestContrastAdjustment(
  foreground: RGB,
  background: RGB,
  targetLevel: WCAGLevel = WCAGLevel.AA,
  textSize: TextSize = TextSize.Normal
): string {
  const currentRatio = getContrastRatio(foreground, background);
  const targetRatio = CONTRAST_THRESHOLDS[targetLevel][textSize];

  if (currentRatio >= targetRatio) {
    return 'Contrast already meets target level';
  }

  const foregroundLum = getRelativeLuminance(foreground);
  const backgroundLum = getRelativeLuminance(background);

  if (foregroundLum > backgroundLum) {
    return `Increase foreground lightness or decrease background lightness. Target ratio: ${targetRatio}:1, current: ${currentRatio.toFixed(2)}:1`;
  } else {
    return `Decrease foreground lightness or increase background lightness. Target ratio: ${targetRatio}:1, current: ${currentRatio.toFixed(2)}:1`;
  }
}
