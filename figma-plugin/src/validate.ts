/**
 * Lightweight runtime validation for Figma plugin handlers.
 * Cannot use Zod — Figma plugin sandbox has no npm access at runtime.
 */

export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
}

export function validatePayload(
  payload: Record<string, unknown>,
  rules: ValidationRule[]
): string | null {
  for (const rule of rules) {
    const value = payload[rule.field];

    if (value === undefined || value === null) {
      if (rule.required === true) {
        return `Missing required field: ${rule.field}`;
      }
      continue;
    }

    if (rule.type === 'array') {
      if (!Array.isArray(value)) {
        return `Field '${rule.field}' must be an array, got ${typeof value}`;
      }
    } else if (typeof value !== rule.type) {
      return `Field '${rule.field}' must be ${rule.type}, got ${typeof value}`;
    }
  }

  return null;
}
