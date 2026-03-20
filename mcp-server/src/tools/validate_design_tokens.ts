/**
 * Validate Design Tokens Tool
 *
 * Validates spacing, typography, and color tokens against design system constraints.
 * Provides comprehensive validation report with suggestions.
 */

import { z } from 'zod';
import { hexToRgb, validateContrast } from '../constraints/color.js';
import {
  VALID_SPACING_VALUES,
  validateSpacing,
  type SpacingValue
} from '../constraints/spacing.js';
import { VALID_FONT_SIZES, validateTypography, type FontSize } from '../constraints/typography.js';

/**
 * Design tokens input schema
 */
export const DesignTokensInputSchema = z.object({
  spacing: z.array(z.number()).optional().describe('Array of spacing values to validate'),
  typography: z
    .array(
      z.object({
        fontSize: z.number(),
        name: z.string().optional()
      })
    )
    .optional()
    .describe('Array of typography tokens with fontSize'),
  colors: z
    .array(
      z.object({
        foreground: z.string(),
        background: z.string(),
        name: z.string().optional()
      })
    )
    .optional()
    .describe('Array of color pairs for contrast validation')
});

export type DesignTokensInput = z.infer<typeof DesignTokensInputSchema>;

/**
 * Spacing validation result
 */
interface SpacingValidation {
  value: number;
  isValid: boolean;
  suggestedValue?: SpacingValue;
  message?: string;
}

/**
 * Typography validation result
 */
interface TypographyValidation {
  fontSize: number;
  name?: string;
  isValid: boolean;
  suggestedFontSize?: FontSize;
  recommendedLineHeight?: number;
  message?: string;
}

/**
 * Color validation result
 */
interface ColorValidation {
  foreground: string;
  background: string;
  name?: string;
  ratio: number;
  passesAA: boolean;
  passesAAA: boolean;
  recommendation: string;
}

/**
 * Comprehensive validation report
 */
export interface ValidationReport {
  spacing: {
    total: number;
    valid: number;
    invalid: number;
    results: SpacingValidation[];
  };
  typography: {
    total: number;
    valid: number;
    invalid: number;
    results: TypographyValidation[];
  };
  colors: {
    total: number;
    passesAA: number;
    passesAAA: number;
    results: ColorValidation[];
  };
  summary: {
    allValid: boolean;
    issues: string[];
    recommendations: string[];
  };
}

/**
 * Validates design tokens
 * @param input
 */
function validateSpacingTokens(values: number[], report: ValidationReport): void {
  report.spacing.total = values.length;
  for (const value of values) {
    const result = validateSpacing(value);
    report.spacing.results.push({
      value: result.value,
      isValid: result.isValid,
      suggestedValue: result.suggestedValue,
      message: result.message
    });
    if (result.isValid) {
      report.spacing.valid++;
    } else {
      report.spacing.invalid++;
      report.summary.allValid = false;
      report.summary.issues.push(`Spacing ${String(value)}px is not on 8pt grid`);
      if (result.suggestedValue !== undefined) {
        report.summary.recommendations.push(
          `Change ${String(value)}px to ${String(result.suggestedValue)}px (8pt grid)`
        );
      }
    }
  }
}

function validateTypographyTokens(
  tokens: Array<{ fontSize: number; name?: string }>,
  report: ValidationReport
): void {
  report.typography.total = tokens.length;
  for (const token of tokens) {
    const result = validateTypography(token.fontSize);
    report.typography.results.push({
      fontSize: result.fontSize,
      name: token.name,
      isValid: result.isValid,
      suggestedFontSize: result.suggestedFontSize,
      recommendedLineHeight: result.recommendedLineHeight,
      message: result.message
    });
    if (result.isValid) {
      report.typography.valid++;
    } else {
      report.typography.invalid++;
      report.summary.allValid = false;
      const label =
        token.name !== undefined
          ? `${token.name} (${String(token.fontSize)}px)`
          : `${String(token.fontSize)}px`;
      report.summary.issues.push(`Font size ${label} is not in type scale`);
      if (result.suggestedFontSize !== undefined) {
        report.summary.recommendations.push(
          `Change ${label} to ${String(result.suggestedFontSize)}px (type scale)`
        );
      }
    }
  }
}

function validateColorTokens(
  colors: Array<{ foreground: string; background: string; name?: string }>,
  report: ValidationReport
): void {
  report.colors.total = colors.length;
  for (const colorPair of colors) {
    const fgRgb = hexToRgb(colorPair.foreground);
    const bgRgb = hexToRgb(colorPair.background);
    if (fgRgb === null || bgRgb === null) {
      report.summary.issues.push(
        `Invalid color format: ${colorPair.name ?? `${colorPair.foreground} / ${colorPair.background}`}`
      );
      continue;
    }
    const result = validateContrast(fgRgb, bgRgb);
    const passesAA = result.passes.AA.normal;
    const passesAAA = result.passes.AAA.normal;
    report.colors.results.push({
      foreground: colorPair.foreground,
      background: colorPair.background,
      name: colorPair.name,
      ratio: result.ratio,
      passesAA,
      passesAAA,
      recommendation: result.recommendation
    });
    if (passesAA) report.colors.passesAA++;
    if (passesAAA) report.colors.passesAAA++;
    if (!passesAA) {
      report.summary.allValid = false;
      const label = colorPair.name ?? `${colorPair.foreground} / ${colorPair.background}`;
      report.summary.issues.push(
        `Color pair ${label} fails WCAG AA (${result.ratio.toFixed(2)}:1)`
      );
      report.summary.recommendations.push(result.recommendation);
    }
  }
}

export function validateDesignTokens(input: DesignTokensInput): ValidationReport {
  const report: ValidationReport = {
    spacing: { total: 0, valid: 0, invalid: 0, results: [] },
    typography: { total: 0, valid: 0, invalid: 0, results: [] },
    colors: { total: 0, passesAA: 0, passesAAA: 0, results: [] },
    summary: { allValid: true, issues: [], recommendations: [] }
  };

  if (input.spacing !== undefined) validateSpacingTokens(input.spacing, report);
  if (input.typography !== undefined) validateTypographyTokens(input.typography, report);
  if (input.colors !== undefined) validateColorTokens(input.colors, report);

  return report;
}

/**
 * Formats validation report as readable text
 * @param report
 */
function formatSpacingSection(report: ValidationReport): string {
  if (report.spacing.total === 0) return '';
  let out = `SPACING (8pt Grid)\n`;
  out += `Total: ${String(report.spacing.total)} | Valid: ${String(report.spacing.valid)} | Invalid: ${String(report.spacing.invalid)}\n`;
  out += `Valid values: ${VALID_SPACING_VALUES.join(', ')}\n\n`;
  for (const result of report.spacing.results) {
    const status = result.isValid ? '✓' : '✗';
    out += `  ${status} ${String(result.value)}px`;
    if (!result.isValid && result.suggestedValue !== undefined) {
      out += ` → Suggested: ${String(result.suggestedValue)}px`;
    }
    out += '\n';
  }
  return out + '\n';
}

function formatTypographySection(report: ValidationReport): string {
  if (report.typography.total === 0) return '';
  let out = `TYPOGRAPHY (Type Scale)\n`;
  out += `Total: ${String(report.typography.total)} | Valid: ${String(report.typography.valid)} | Invalid: ${String(report.typography.invalid)}\n`;
  out += `Valid sizes: ${VALID_FONT_SIZES.join(', ')}\n\n`;
  for (const result of report.typography.results) {
    const status = result.isValid ? '✓' : '✗';
    const label =
      result.name !== undefined
        ? `${result.name} (${String(result.fontSize)}px)`
        : `${String(result.fontSize)}px`;
    out += `  ${status} ${label}`;
    if (!result.isValid && result.suggestedFontSize !== undefined) {
      out += ` → Suggested: ${String(result.suggestedFontSize)}px`;
    }
    if (result.recommendedLineHeight !== undefined) {
      out += ` (line-height: ${String(result.recommendedLineHeight)}px)`;
    }
    out += '\n';
  }
  return out + '\n';
}

function formatColorsSection(report: ValidationReport): string {
  if (report.colors.total === 0) return '';
  let out = `COLOR CONTRAST (WCAG)\n`;
  out += `Total: ${String(report.colors.total)} | AA: ${String(report.colors.passesAA)} | AAA: ${String(report.colors.passesAAA)}\n\n`;
  for (const result of report.colors.results) {
    const aaStatus = result.passesAA ? '✓' : '✗';
    const aaaStatus = result.passesAAA ? '✓' : '✗';
    const label = result.name ?? `${result.foreground} / ${result.background}`;
    out += `  ${label}\n`;
    out += `    Ratio: ${result.ratio.toFixed(2)}:1\n`;
    out += `    AA: ${aaStatus} | AAA: ${aaaStatus}\n`;
    out += `    ${result.recommendation}\n\n`;
  }
  return out;
}

export function formatValidationReport(report: ValidationReport): string {
  let output = 'Design Tokens Validation Report\n================================\n\n';
  output += formatSpacingSection(report);
  output += formatTypographySection(report);
  output += formatColorsSection(report);

  output += `SUMMARY\nOverall Status: ${report.summary.allValid ? '✓ All valid' : '✗ Issues found'}\n\n`;

  if (report.summary.issues.length > 0) {
    output += `Issues:\n`;
    for (const issue of report.summary.issues) {
      output += `  - ${issue}\n`;
    }
    output += '\n';
  }
  if (report.summary.recommendations.length > 0) {
    output += `Recommendations:\n`;
    for (const rec of [...new Set(report.summary.recommendations)]) {
      output += `  - ${rec}\n`;
    }
  }
  return output;
}

/**
 * Tool definition for MCP
 */
export const validateDesignTokensToolDefinition = {
  name: 'validate_design_tokens',
  description: `Validates design tokens (spacing, typography, colors) against design system constraints.

Provides comprehensive validation report with:
- Spacing validation against 8pt grid
- Typography validation against modular type scale
- Color contrast validation for WCAG AA/AAA compliance

Use this tool to:
1. Audit existing design tokens
2. Validate new token proposals
3. Ensure consistency across design system
4. Check accessibility compliance

Input format:
{
  spacing: [8, 16, 20, 24],           // Array of spacing values
  typography: [                        // Array of font size tokens
    { fontSize: 16, name: "body" },
    { fontSize: 24, name: "heading" }
  ],
  colors: [                            // Array of color pairs
    {
      foreground: "#000000",
      background: "#FFFFFF",
      name: "primary-text"
    }
  ]
}

Returns detailed report with:
- Valid/invalid counts
- Suggested corrections
- WCAG compliance levels
- Actionable recommendations`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      spacing: {
        type: 'array' as const,
        items: {
          type: 'number' as const
        },
        description: 'Array of spacing values to validate against 8pt grid'
      },
      typography: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            fontSize: {
              type: 'number' as const,
              description: 'Font size in pixels'
            },
            name: {
              type: 'string' as const,
              description: 'Optional token name'
            }
          },
          required: ['fontSize']
        },
        description: 'Array of typography tokens to validate'
      },
      colors: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            foreground: {
              type: 'string' as const,
              description: 'Foreground color in hex format'
            },
            background: {
              type: 'string' as const,
              description: 'Background color in hex format'
            },
            name: {
              type: 'string' as const,
              description: 'Optional color pair name'
            }
          },
          required: ['foreground', 'background']
        },
        description: 'Array of color pairs to validate for contrast'
      }
    }
  }
};
