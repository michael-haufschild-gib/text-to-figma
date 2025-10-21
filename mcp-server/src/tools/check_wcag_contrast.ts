/**
 * Check WCAG Contrast Tool
 *
 * Validates color contrast ratios according to WCAG 2.1 guidelines.
 * Determines compliance for different text sizes and provides suggestions
 * for achieving compliance when needed.
 */

import { z } from 'zod';
import {
  CONTRAST_THRESHOLDS,
  getContrastRatio,
  hexToRgb,
  type RGB,
  rgbToHex,
  TextSize,
  WCAGLevel
} from '../constraints/color.js';
import { monitoredToolExecutionSync } from '../monitoring/tool-wrapper.js';
import { adjustLightness, rgbToLch } from '../utils/color-converter.js';

/**
 * Input schema for check_wcag_contrast tool
 */
export const checkWcagContrastInputSchema = z.object({
  foreground: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .describe('Foreground color in hex format (e.g., #000000)'),
  background: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .describe('Background color in hex format (e.g., #FFFFFF)'),
  fontSize: z.number().positive().describe('Font size in points (pt)'),
  fontWeight: z
    .number()
    .min(100)
    .max(900)
    .default(400)
    .describe('Font weight (100-900, default: 400)')
});

export type CheckWcagContrastInput = z.infer<typeof checkWcagContrastInputSchema>;

/**
 * Compliance status for a specific WCAG level
 */
export interface ComplianceStatus {
  level: WCAGLevel;
  passes: boolean;
  threshold: number;
}

/**
 * Suggested color adjustment
 */
export interface ColorSuggestion {
  color: string;
  contrastRatio: number;
  adjustment: string;
}

/**
 * Result of WCAG contrast check
 */
export interface CheckWcagContrastResult {
  contrastRatio: number;
  isLargeText: boolean;
  compliance: {
    aa: ComplianceStatus;
    aaa: ComplianceStatus;
  };
  suggestions: ColorSuggestion[];
  summary: string;
}

/**
 * Determines if text is considered "large" according to WCAG
 * Large text: 18pt+ regular or 14pt+ bold
 */
function isLargeText(fontSize: number, fontWeight: number): boolean {
  if (fontSize >= 18) {
    return true;
  }
  if (fontSize >= 14 && fontWeight >= 700) {
    return true;
  }
  return false;
}

/**
 * Generates color suggestions to achieve target contrast ratio
 */
function generateColorSuggestions(
  foreground: RGB,
  background: RGB,
  targetRatio: number
): ColorSuggestion[] {
  const suggestions: ColorSuggestion[] = [];

  // Determine if foreground should be lightened or darkened
  const fgLch = rgbToLch(foreground);
  const bgLch = rgbToLch(background);

  // Try adjusting foreground lightness
  if (fgLch.l > bgLch.l) {
    // Foreground is lighter, try making it even lighter
    for (let adjustment = 5; adjustment <= 50; adjustment += 5) {
      const adjusted = adjustLightness(foreground, adjustment);
      const ratio = getContrastRatio(adjusted, background);

      if (ratio >= targetRatio) {
        suggestions.push({
          color: rgbToHex(adjusted),
          contrastRatio: ratio,
          adjustment: `Lighten foreground by ${adjustment}%`
        });
        break;
      }
    }
  } else {
    // Foreground is darker, try making it even darker
    for (let adjustment = -5; adjustment >= -50; adjustment -= 5) {
      const adjusted = adjustLightness(foreground, adjustment);
      const ratio = getContrastRatio(adjusted, background);

      if (ratio >= targetRatio) {
        suggestions.push({
          color: rgbToHex(adjusted),
          contrastRatio: ratio,
          adjustment: `Darken foreground by ${Math.abs(adjustment)}%`
        });
        break;
      }
    }
  }

  // Try adjusting background lightness (opposite direction)
  if (bgLch.l > fgLch.l) {
    // Background is lighter, try making it even lighter
    for (let adjustment = 5; adjustment <= 50; adjustment += 5) {
      const adjusted = adjustLightness(background, adjustment);
      const ratio = getContrastRatio(foreground, adjusted);

      if (ratio >= targetRatio) {
        suggestions.push({
          color: rgbToHex(adjusted),
          contrastRatio: ratio,
          adjustment: `Lighten background by ${adjustment}%`
        });
        break;
      }
    }
  } else {
    // Background is darker, try making it even darker
    for (let adjustment = -5; adjustment >= -50; adjustment -= 5) {
      const adjusted = adjustLightness(background, adjustment);
      const ratio = getContrastRatio(foreground, adjusted);

      if (ratio >= targetRatio) {
        suggestions.push({
          color: rgbToHex(adjusted),
          contrastRatio: ratio,
          adjustment: `Darken background by ${Math.abs(adjustment)}%`
        });
        break;
      }
    }
  }

  // If still below target, suggest pure black/white
  if (suggestions.length === 0) {
    const white: RGB = { r: 255, g: 255, b: 255 };
    const black: RGB = { r: 0, g: 0, b: 0 };

    const whiteOnBg = getContrastRatio(white, background);
    const blackOnBg = getContrastRatio(black, background);

    if (whiteOnBg >= targetRatio) {
      suggestions.push({
        color: '#FFFFFF',
        contrastRatio: whiteOnBg,
        adjustment: 'Use pure white for foreground'
      });
    }

    if (blackOnBg >= targetRatio) {
      suggestions.push({
        color: '#000000',
        contrastRatio: blackOnBg,
        adjustment: 'Use pure black for foreground'
      });
    }
  }

  return suggestions;
}

/**
 * Checks WCAG contrast compliance
 */
export function checkWcagContrast(input: CheckWcagContrastInput): CheckWcagContrastResult {
  return monitoredToolExecutionSync('check_wcag_contrast', input, (validated) => {
    // Convert colors to RGB
    const foreground = hexToRgb(validated.foreground);
    const background = hexToRgb(validated.background);

    if (!foreground || !background) {
      throw new Error('Invalid hex color format');
    }

    // Calculate contrast ratio
    const contrastRatio = getContrastRatio(foreground, background);

    // Determine text size category
    const largeText = isLargeText(validated.fontSize, validated.fontWeight);
    const textSize = largeText ? TextSize.Large : TextSize.Normal;

    // Check compliance
    const aaThreshold = CONTRAST_THRESHOLDS[WCAGLevel.AA][textSize];
    const aaaThreshold = CONTRAST_THRESHOLDS[WCAGLevel.AAA][textSize];

    const aaCompliance: ComplianceStatus = {
      level: WCAGLevel.AA,
      passes: contrastRatio >= aaThreshold,
      threshold: aaThreshold
    };

    const aaaCompliance: ComplianceStatus = {
      level: WCAGLevel.AAA,
      passes: contrastRatio >= aaaThreshold,
      threshold: aaaThreshold
    };

    // Generate suggestions if not compliant
    const suggestions: ColorSuggestion[] = [];
    if (!aaCompliance.passes) {
      suggestions.push(...generateColorSuggestions(foreground, background, aaThreshold));
    }

    // Generate summary
    let summary: string;
    if (aaaCompliance.passes) {
      summary = `Excellent! Passes WCAG AAA (${aaaThreshold}:1 required, ${contrastRatio.toFixed(2)}:1 achieved)`;
    } else if (aaCompliance.passes) {
      summary = `Good. Passes WCAG AA (${aaThreshold}:1 required, ${contrastRatio.toFixed(2)}:1 achieved). Does not meet AAA (${aaaThreshold}:1 required).`;
    } else {
      summary = `Fails WCAG AA. Minimum ${aaThreshold}:1 required, only ${contrastRatio.toFixed(2)}:1 achieved. See suggestions below.`;
    }

    return {
      contrastRatio,
      isLargeText: largeText,
      compliance: {
        aa: aaCompliance,
        aaa: aaaCompliance
      },
      suggestions,
      summary
    };
  });
}

/**
 * Formats the contrast check result as human-readable text
 */
export function formatContrastCheckResult(result: CheckWcagContrastResult): string {
  let text = 'WCAG Contrast Check Results\n';
  text += '============================\n\n';

  text += `Contrast Ratio: ${result.contrastRatio.toFixed(2)}:1\n`;
  text += `Text Size: ${result.isLargeText ? 'Large' : 'Normal'}\n\n`;

  text += `WCAG AA Compliance:\n`;
  text += `  Status: ${result.compliance.aa.passes ? '✓ PASS' : '✗ FAIL'}\n`;
  text += `  Required: ${result.compliance.aa.threshold}:1\n\n`;

  text += `WCAG AAA Compliance:\n`;
  text += `  Status: ${result.compliance.aaa.passes ? '✓ PASS' : '✗ FAIL'}\n`;
  text += `  Required: ${result.compliance.aaa.threshold}:1\n\n`;

  text += `Summary: ${result.summary}\n`;

  if (result.suggestions.length > 0) {
    text += `\nSuggested Adjustments:\n`;
    result.suggestions.forEach((suggestion, index) => {
      text += `\n${index + 1}. ${suggestion.adjustment}\n`;
      text += `   Color: ${suggestion.color}\n`;
      text += `   New Contrast: ${suggestion.contrastRatio.toFixed(2)}:1\n`;
    });
  }

  return text;
}

/**
 * Tool definition for MCP
 */
export const checkWcagContrastToolDefinition = {
  name: 'check_wcag_contrast',
  description: `Validates color contrast ratios for WCAG 2.1 compliance.

Determines if text meets accessibility standards based on:
- Contrast ratio between foreground and background colors
- Font size (in points)
- Font weight

WCAG defines "large text" as:
- 18pt or larger (regardless of weight)
- 14pt or larger with bold weight (700+)

WCAG Standards:
- AA Normal Text: 4.5:1 minimum
- AA Large Text: 3.0:1 minimum
- AAA Normal Text: 7.0:1 minimum
- AAA Large Text: 4.5:1 minimum

Returns:
- Exact contrast ratio
- AA/AAA compliance status
- Whether text qualifies as "large"
- Color adjustment suggestions if non-compliant
- Perceptually similar colors that pass standards`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      foreground: {
        type: 'string' as const,
        description: 'Foreground (text) color in hex format (e.g., #000000)'
      },
      background: {
        type: 'string' as const,
        description: 'Background color in hex format (e.g., #FFFFFF)'
      },
      fontSize: {
        type: 'number' as const,
        description: 'Font size in points (pt)'
      },
      fontWeight: {
        type: 'number' as const,
        description: 'Font weight from 100-900 (default: 400 for regular, 700 for bold)'
      }
    },
    required: ['foreground', 'background', 'fontSize']
  }
};

/**
 * Handler export for tool registration
 */
export const checkWcagContrastHandler: import('../routing/tool-handler.js').ToolHandler<
  CheckWcagContrastInput,
  CheckWcagContrastResult
> = {
  name: 'check_wcag_contrast',
  schema: checkWcagContrastInputSchema as any,
  execute: async (input) => checkWcagContrast(input),
  formatResponse: (result) => {
    const text = formatContrastCheckResult(result);
    return [{ type: 'text', text }];
  },
  definition: checkWcagContrastToolDefinition
};
