/**
 * Design Constraints Module
 *
 * Centralized exports for all design system constraints
 */

// Spacing exports
export {
  VALID_SPACING_VALUES,
  spacingSchema,
  isValidSpacing,
  snapToGrid,
  validateSpacing,
  type SpacingValue,
  type SpacingConstraintResult
} from './spacing.js';

// Typography exports
export {
  VALID_FONT_SIZES,
  FONT_WEIGHTS,
  TEXT_STYLES,
  fontSizeSchema,
  fontWeightSchema,
  isValidFontSize,
  snapToTypeScale,
  getRecommendedLineHeight,
  validateTypography,
  type FontSize,
  type FontWeight,
  type TextStyle,
  type TypographyConstraintResult
} from './typography.js';

// Color exports
export {
  WCAGLevel,
  TextSize,
  CONTRAST_THRESHOLDS,
  rgbSchema,
  hexToRgb,
  rgbToHex,
  getRelativeLuminance,
  getContrastRatio,
  validateContrast,
  type RGB,
  type ContrastValidationResult
} from './color.js';
