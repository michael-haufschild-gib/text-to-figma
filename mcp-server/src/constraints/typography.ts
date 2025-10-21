/**
 * Typography Constraints - Modular Type Scale
 *
 * Validates font sizes against a modular type scale.
 * Valid sizes: 12, 16, 20, 24, 32, 40, 48, 64
 */

import { z } from 'zod';

/**
 * Valid font sizes in the modular type scale
 */
export const VALID_FONT_SIZES = [12, 16, 20, 24, 32, 40, 48, 64] as const;

export type FontSize = (typeof VALID_FONT_SIZES)[number];

/**
 * Common font weight values
 */
export const FONT_WEIGHTS = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900
} as const;

export type FontWeight = (typeof FONT_WEIGHTS)[keyof typeof FONT_WEIGHTS];

/**
 * Line height recommendations based on font size
 * Generally 1.5x for body text, 1.2x for headings
 */
export function getRecommendedLineHeight(fontSize: FontSize): number {
  if (fontSize <= 20) {
    return Math.round(fontSize * 1.5);
  }
  return Math.round(fontSize * 1.2);
}

/**
 * Zod schema for validating font sizes
 */
export const fontSizeSchema = z
  .number()
  .refine((value): value is FontSize => VALID_FONT_SIZES.includes(value as FontSize), {
    message: `Font size must be one of: ${VALID_FONT_SIZES.join(', ')}`
  });

/**
 * Zod schema for validating font weights
 */
export const fontWeightSchema = z
  .number()
  .refine(
    (value): value is FontWeight => Object.values(FONT_WEIGHTS).includes(value as FontWeight),
    {
      message: 'Font weight must be a valid weight value (100-900 in steps of 100)'
    }
  );

/**
 * Validates if a value is a valid font size
 */
export function isValidFontSize(value: number): value is FontSize {
  return VALID_FONT_SIZES.includes(value as FontSize);
}

/**
 * Snaps a font size to the nearest valid value in the type scale
 * When distances are equal, rounds up to the larger size
 */
export function snapToTypeScale(value: number): FontSize {
  if (value <= VALID_FONT_SIZES[0]) {
    return VALID_FONT_SIZES[0];
  }
  if (value >= VALID_FONT_SIZES[VALID_FONT_SIZES.length - 1]) {
    return VALID_FONT_SIZES[VALID_FONT_SIZES.length - 1];
  }

  let closest: FontSize = VALID_FONT_SIZES[0];
  let minDiff = Math.abs(value - closest);

  for (const validSize of VALID_FONT_SIZES) {
    const diff = Math.abs(value - validSize);
    // Less than OR equal with higher value - rounds up when equidistant
    if (diff < minDiff || (diff === minDiff && validSize > closest)) {
      minDiff = diff;
      closest = validSize;
    }
  }

  return closest;
}

/**
 * Typography constraint result
 */
export interface TypographyConstraintResult {
  isValid: boolean;
  fontSize: number;
  suggestedFontSize?: FontSize;
  recommendedLineHeight?: number;
  message?: string;
}

/**
 * Validates typography and returns detailed result
 */
export function validateTypography(fontSize: number): TypographyConstraintResult {
  if (isValidFontSize(fontSize)) {
    return {
      isValid: true,
      fontSize,
      recommendedLineHeight: getRecommendedLineHeight(fontSize)
    };
  }

  const suggestedFontSize = snapToTypeScale(fontSize);
  return {
    isValid: false,
    fontSize,
    suggestedFontSize,
    recommendedLineHeight: getRecommendedLineHeight(suggestedFontSize),
    message: `Font size ${fontSize} is not in the modular type scale. Suggested: ${suggestedFontSize}`
  };
}

/**
 * Text style definition
 */
export interface TextStyle {
  fontSize: FontSize;
  fontWeight: FontWeight;
  lineHeight: number;
  letterSpacing?: number;
}

/**
 * Predefined text styles for common use cases
 */
export const TEXT_STYLES: Record<string, TextStyle> = {
  'display-large': {
    fontSize: 64,
    fontWeight: FONT_WEIGHTS.bold,
    lineHeight: getRecommendedLineHeight(64)
  },
  'display-medium': {
    fontSize: 48,
    fontWeight: FONT_WEIGHTS.bold,
    lineHeight: getRecommendedLineHeight(48)
  },
  'heading-1': {
    fontSize: 40,
    fontWeight: FONT_WEIGHTS.semibold,
    lineHeight: getRecommendedLineHeight(40)
  },
  'heading-2': {
    fontSize: 32,
    fontWeight: FONT_WEIGHTS.semibold,
    lineHeight: getRecommendedLineHeight(32)
  },
  'heading-3': {
    fontSize: 24,
    fontWeight: FONT_WEIGHTS.semibold,
    lineHeight: getRecommendedLineHeight(24)
  },
  'body-large': {
    fontSize: 20,
    fontWeight: FONT_WEIGHTS.normal,
    lineHeight: getRecommendedLineHeight(20)
  },
  'body-medium': {
    fontSize: 16,
    fontWeight: FONT_WEIGHTS.normal,
    lineHeight: getRecommendedLineHeight(16)
  },
  'body-small': {
    fontSize: 12,
    fontWeight: FONT_WEIGHTS.normal,
    lineHeight: getRecommendedLineHeight(12)
  }
};
