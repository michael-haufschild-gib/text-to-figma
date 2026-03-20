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
export function validateDesignTokens(input: DesignTokensInput): ValidationReport {
  const validated = input;

  const report: ValidationReport = {
    spacing: {
      total: 0,
      valid: 0,
      invalid: 0,
      results: []
    },
    typography: {
      total: 0,
      valid: 0,
      invalid: 0,
      results: []
    },
    colors: {
      total: 0,
      passesAA: 0,
      passesAAA: 0,
      results: []
    },
    summary: {
      allValid: true,
      issues: [],
      recommendations: []
    }
  };

  // Validate spacing
  if (validated.spacing) {
    report.spacing.total = validated.spacing.length;

    for (const value of validated.spacing) {
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
        report.summary.issues.push(`Spacing ${value}px is not on 8pt grid`);
        if (result.suggestedValue !== undefined) {
          report.summary.recommendations.push(
            `Change ${value}px to ${result.suggestedValue}px (8pt grid)`
          );
        }
      }
    }
  }

  // Validate typography
  if (validated.typography) {
    report.typography.total = validated.typography.length;

    for (const token of validated.typography) {
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
        const label = token.name ? `${token.name} (${token.fontSize}px)` : `${token.fontSize}px`;
        report.summary.issues.push(`Font size ${label} is not in type scale`);
        if (result.suggestedFontSize !== undefined) {
          report.summary.recommendations.push(
            `Change ${label} to ${result.suggestedFontSize}px (type scale)`
          );
        }
      }
    }
  }

  // Validate colors
  if (validated.colors) {
    report.colors.total = validated.colors.length;

    for (const colorPair of validated.colors) {
      const fgRgb = hexToRgb(colorPair.foreground);
      const bgRgb = hexToRgb(colorPair.background);

      if (!fgRgb || !bgRgb) {
        report.summary.issues.push(
          `Invalid color format: ${colorPair.name || `${colorPair.foreground} / ${colorPair.background}`}`
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

      if (passesAA) {
        report.colors.passesAA++;
      }
      if (passesAAA) {
        report.colors.passesAAA++;
      }

      if (!passesAA) {
        report.summary.allValid = false;
        const label = colorPair.name || `${colorPair.foreground} / ${colorPair.background}`;
        report.summary.issues.push(
          `Color pair ${label} fails WCAG AA (${result.ratio.toFixed(2)}:1)`
        );
        report.summary.recommendations.push(result.recommendation);
      }
    }
  }

  return report;
}

/**
 * Formats validation report as readable text
 * @param report
 */
export function formatValidationReport(report: ValidationReport): string {
  let output = 'Design Tokens Validation Report\n';
  output += '================================\n\n';

  // Spacing section
  if (report.spacing.total > 0) {
    output += `SPACING (8pt Grid)\n`;
    output += `Total: ${report.spacing.total} | Valid: ${report.spacing.valid} | Invalid: ${report.spacing.invalid}\n`;
    output += `Valid values: ${VALID_SPACING_VALUES.join(', ')}\n\n`;

    for (const result of report.spacing.results) {
      const status = result.isValid ? '✓' : '✗';
      output += `  ${status} ${result.value}px`;
      if (!result.isValid && result.suggestedValue !== undefined) {
        output += ` → Suggested: ${result.suggestedValue}px`;
      }
      output += '\n';
    }
    output += '\n';
  }

  // Typography section
  if (report.typography.total > 0) {
    output += `TYPOGRAPHY (Type Scale)\n`;
    output += `Total: ${report.typography.total} | Valid: ${report.typography.valid} | Invalid: ${report.typography.invalid}\n`;
    output += `Valid sizes: ${VALID_FONT_SIZES.join(', ')}\n\n`;

    for (const result of report.typography.results) {
      const status = result.isValid ? '✓' : '✗';
      const label = result.name ? `${result.name} (${result.fontSize}px)` : `${result.fontSize}px`;
      output += `  ${status} ${label}`;
      if (!result.isValid && result.suggestedFontSize !== undefined) {
        output += ` → Suggested: ${result.suggestedFontSize}px`;
      }
      if (result.recommendedLineHeight !== undefined) {
        output += ` (line-height: ${result.recommendedLineHeight}px)`;
      }
      output += '\n';
    }
    output += '\n';
  }

  // Colors section
  if (report.colors.total > 0) {
    output += `COLOR CONTRAST (WCAG)\n`;
    output += `Total: ${report.colors.total} | AA: ${report.colors.passesAA} | AAA: ${report.colors.passesAAA}\n\n`;

    for (const result of report.colors.results) {
      const aaStatus = result.passesAA ? '✓' : '✗';
      const aaaStatus = result.passesAAA ? '✓' : '✗';
      const label = result.name || `${result.foreground} / ${result.background}`;

      output += `  ${label}\n`;
      output += `    Ratio: ${result.ratio.toFixed(2)}:1\n`;
      output += `    AA: ${aaStatus} | AAA: ${aaaStatus}\n`;
      output += `    ${result.recommendation}\n\n`;
    }
  }

  // Summary
  output += `SUMMARY\n`;
  output += `Overall Status: ${report.summary.allValid ? '✓ All valid' : '✗ Issues found'}\n\n`;

  if (report.summary.issues.length > 0) {
    output += `Issues:\n`;
    for (const issue of report.summary.issues) {
      output += `  - ${issue}\n`;
    }
    output += '\n';
  }

  if (report.summary.recommendations.length > 0) {
    output += `Recommendations:\n`;
    const uniqueRecs = [...new Set(report.summary.recommendations)];
    for (const rec of uniqueRecs) {
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
