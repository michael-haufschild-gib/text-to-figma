/**
 * Spacing Constraints - 8pt Grid System
 *
 * Validates spacing values against the 8pt grid system.
 * Valid values: 0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128
 */

import { z } from 'zod';

/**
 * Valid spacing values in the 8pt grid system
 */
export const VALID_SPACING_VALUES = [0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128] as const;

export type SpacingValue = (typeof VALID_SPACING_VALUES)[number];

/**
 * Zod schema for validating spacing values
 */
export const spacingSchema = z
  .number()
  .refine((value): value is SpacingValue => VALID_SPACING_VALUES.includes(value as SpacingValue), {
    message: `Spacing must be one of: ${VALID_SPACING_VALUES.join(', ')}`
  });

/**
 * Validates if a value conforms to the 8pt grid system
 */
export function isValidSpacing(value: number): value is SpacingValue {
  return VALID_SPACING_VALUES.includes(value as SpacingValue);
}

/**
 * Snaps a value to the nearest valid spacing value
 */
export function snapToGrid(value: number): SpacingValue {
  if (value <= 0) {return 0;}

  let closest: SpacingValue = VALID_SPACING_VALUES[0];
  let minDiff = Math.abs(value - closest);

  for (const validValue of VALID_SPACING_VALUES) {
    const diff = Math.abs(value - validValue);
    if (diff < minDiff) {
      minDiff = diff;
      closest = validValue;
    }
  }

  return closest;
}

/**
 * Spacing constraint result
 */
export interface SpacingConstraintResult {
  isValid: boolean;
  value: number;
  suggestedValue?: SpacingValue;
  message?: string;
}

/**
 * Validates spacing and returns detailed result
 */
export function validateSpacing(value: number): SpacingConstraintResult {
  if (isValidSpacing(value)) {
    return {
      isValid: true,
      value
    };
  }

  const suggestedValue = snapToGrid(value);
  return {
    isValid: false,
    value,
    suggestedValue,
    message: `Value ${value} is not on the 8pt grid. Suggested: ${suggestedValue}`
  };
}
