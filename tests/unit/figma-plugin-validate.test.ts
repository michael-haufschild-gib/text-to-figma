/**
 * Figma Plugin Validate — Unit Tests
 *
 * Tests the lightweight runtime validation used in Figma plugin handlers.
 * These functions cannot use Zod (Figma sandbox has no npm at runtime),
 * so they implement manual field/type/enum checks.
 */

import { describe, expect, it } from 'vitest';
import { validatePayload, checkEnum } from '../../figma-plugin/src/validate.js';
import type { ValidationRule } from '../../figma-plugin/src/validate.js';

describe('validatePayload', () => {
  it('returns null when all required fields are present and correct type', () => {
    const rules: ValidationRule[] = [
      { field: 'name', type: 'string', required: true },
      { field: 'count', type: 'number', required: true }
    ];
    const result = validatePayload({ name: 'test', count: 5 }, rules);
    expect(result).toBe(null);
  });

  it('returns error when a required field is missing', () => {
    const rules: ValidationRule[] = [{ field: 'name', type: 'string', required: true }];
    const result = validatePayload({}, rules);
    expect(result).toBe('Missing required field: name');
  });

  it('returns error when a required field is null', () => {
    const rules: ValidationRule[] = [{ field: 'name', type: 'string', required: true }];
    const result = validatePayload({ name: null }, rules);
    expect(result).toBe('Missing required field: name');
  });

  it('returns error when field has wrong type', () => {
    const rules: ValidationRule[] = [{ field: 'count', type: 'number', required: true }];
    const result = validatePayload({ count: 'five' }, rules);
    expect(result).toBe("Field 'count' must be a finite number, got string");
  });

  it('returns null when optional field is missing', () => {
    const rules: ValidationRule[] = [{ field: 'label', type: 'string' }];
    const result = validatePayload({}, rules);
    expect(result).toBe(null);
  });

  it('returns null when optional field is null', () => {
    const rules: ValidationRule[] = [{ field: 'label', type: 'string' }];
    const result = validatePayload({ label: null }, rules);
    expect(result).toBe(null);
  });

  it('returns null for valid enum value', () => {
    const rules: ValidationRule[] = [
      { field: 'direction', type: 'string', required: true, enum: ['LEFT', 'RIGHT', 'CENTER'] }
    ];
    const result = validatePayload({ direction: 'LEFT' }, rules);
    expect(result).toBe(null);
  });

  it('returns error for invalid enum value', () => {
    const rules: ValidationRule[] = [
      { field: 'direction', type: 'string', required: true, enum: ['LEFT', 'RIGHT', 'CENTER'] }
    ];
    const result = validatePayload({ direction: 'UP' }, rules);
    expect(result).toBe("Field 'direction' must be one of [LEFT, RIGHT, CENTER], got 'UP'");
  });

  it('returns null when array field has a valid array', () => {
    const rules: ValidationRule[] = [{ field: 'items', type: 'array', required: true }];
    const result = validatePayload({ items: [1, 2, 3] }, rules);
    expect(result).toBe(null);
  });

  it('returns null for an empty array (valid array)', () => {
    const rules: ValidationRule[] = [{ field: 'items', type: 'array', required: true }];
    const result = validatePayload({ items: [] }, rules);
    expect(result).toBe(null);
  });

  it('returns error when array field is not an array', () => {
    const rules: ValidationRule[] = [{ field: 'items', type: 'array', required: true }];
    const result = validatePayload({ items: 'not-array' }, rules);
    expect(result).toBe("Field 'items' must be an array, got string");
  });

  it('returns error when array field is an object (not array)', () => {
    const rules: ValidationRule[] = [{ field: 'items', type: 'array', required: true }];
    const result = validatePayload({ items: { length: 3 } }, rules);
    expect(result).toBe("Field 'items' must be an array, got object");
  });

  it('validates boolean type correctly', () => {
    const rules: ValidationRule[] = [{ field: 'visible', type: 'boolean', required: true }];
    expect(validatePayload({ visible: true }, rules)).toBe(null);
    expect(validatePayload({ visible: 'yes' }, rules)).toBe(
      "Field 'visible' must be boolean, got string"
    );
  });

  it('validates object type correctly', () => {
    const rules: ValidationRule[] = [{ field: 'config', type: 'object', required: true }];
    expect(validatePayload({ config: { key: 'val' } }, rules)).toBe(null);
    expect(validatePayload({ config: 42 }, rules)).toBe(
      "Field 'config' must be object, got number"
    );
  });

  it('stops at the first validation error', () => {
    const rules: ValidationRule[] = [
      { field: 'a', type: 'string', required: true },
      { field: 'b', type: 'string', required: true }
    ];
    const result = validatePayload({}, rules);
    // Should report the first missing field, not both
    expect(result).toBe('Missing required field: a');
  });

  it('skips enum check for non-string values', () => {
    // If a field has an enum constraint but the value is not a string,
    // the type check should catch it first.
    const rules: ValidationRule[] = [
      { field: 'mode', type: 'string', required: true, enum: ['A', 'B'] }
    ];
    const result = validatePayload({ mode: 123 }, rules);
    expect(result).toBe("Field 'mode' must be string, got number");
  });
});

describe('checkEnum', () => {
  const allowed = ['RED', 'GREEN', 'BLUE'] as const;

  it('returns the value when it is in the allowed set', () => {
    expect(checkEnum('RED', allowed)).toBe('RED');
    expect(checkEnum('BLUE', allowed)).toBe('BLUE');
  });

  it('returns undefined when the value is not in the allowed set', () => {
    expect(checkEnum('YELLOW', allowed)).toBe(undefined);
  });

  it('returns undefined when the value is not a string', () => {
    expect(checkEnum(42, allowed)).toBe(undefined);
    expect(checkEnum(null, allowed)).toBe(undefined);
    expect(checkEnum(undefined, allowed)).toBe(undefined);
  });

  it('returns undefined for an empty string not in the allowed set', () => {
    expect(checkEnum('', allowed)).toBe(undefined);
  });
});
