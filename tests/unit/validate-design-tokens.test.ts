/**
 * Validate Design Tokens Execute Function Tests
 *
 * Tests the validateDesignTokens function directly with various
 * token combinations, edge cases, and boundary values.
 */

import { describe, expect, it } from 'vitest';
import {
  validateDesignTokens,
  formatValidationReport
} from '../../mcp-server/src/tools/validate_design_tokens.js';

describe('validateDesignTokens', () => {
  describe('spacing validation', () => {
    it('reports all-valid spacing', () => {
      const report = validateDesignTokens({ spacing: [0, 8, 16, 24, 32, 48, 64, 96, 128] });
      expect(report.spacing.total).toBe(9);
      expect(report.spacing.valid).toBe(9);
      expect(report.spacing.invalid).toBe(0);
      expect(report.summary.allValid).toBe(true);
    });

    it('reports all-invalid spacing', () => {
      const report = validateDesignTokens({ spacing: [1, 3, 5, 10, 15, 20] });
      expect(report.spacing.valid).toBe(0);
      expect(report.spacing.invalid).toBe(6);
      expect(report.summary.allValid).toBe(false);
      expect(report.summary.issues.length).toBeGreaterThanOrEqual(6);
    });

    it('reports mixed valid/invalid spacing', () => {
      const report = validateDesignTokens({ spacing: [8, 10, 16, 15] });
      expect(report.spacing.valid).toBe(2);
      expect(report.spacing.invalid).toBe(2);
    });

    it('provides suggestions for invalid spacing', () => {
      const report = validateDesignTokens({ spacing: [10] });
      expect(report.spacing.results[0].suggestedValue).toBe(8);
      expect(report.summary.recommendations.length).toBeGreaterThan(0);
    });

    it('handles empty spacing array', () => {
      const report = validateDesignTokens({ spacing: [] });
      expect(report.spacing.total).toBe(0);
    });
  });

  describe('typography validation', () => {
    it('validates valid font sizes', () => {
      const report = validateDesignTokens({
        typography: [
          { fontSize: 12, name: 'small' },
          { fontSize: 16, name: 'body' },
          { fontSize: 24, name: 'heading' }
        ]
      });
      expect(report.typography.valid).toBe(3);
      expect(report.typography.invalid).toBe(0);
    });

    it('reports invalid font sizes with suggestions', () => {
      const report = validateDesignTokens({
        typography: [
          { fontSize: 14, name: 'custom' },
          { fontSize: 18, name: 'medium' }
        ]
      });
      expect(report.typography.invalid).toBe(2);
      for (const result of report.typography.results) {
        expect(result.suggestedFontSize).toBeTypeOf('number');
      }
    });

    it('includes recommended line heights', () => {
      const report = validateDesignTokens({
        typography: [{ fontSize: 16, name: 'body' }]
      });
      expect(report.typography.results[0].recommendedLineHeight).toBe(24); // 1.5x for body
    });
  });

  describe('color validation', () => {
    it('validates high contrast pairs', () => {
      const report = validateDesignTokens({
        colors: [{ foreground: '#000000', background: '#FFFFFF', name: 'primary text' }]
      });
      expect(report.colors.total).toBe(1);
      expect(report.colors.passesAA).toBe(1);
      expect(report.colors.passesAAA).toBe(1);
    });

    it('reports failing contrast pairs', () => {
      const report = validateDesignTokens({
        colors: [{ foreground: '#CCCCCC', background: '#FFFFFF', name: 'light text' }]
      });
      expect(report.colors.passesAA).toBe(0);
      expect(report.summary.allValid).toBe(false);
    });

    it('validates multiple color pairs', () => {
      const report = validateDesignTokens({
        colors: [
          { foreground: '#000000', background: '#FFFFFF', name: 'black/white' },
          { foreground: '#333333', background: '#FFFFFF', name: 'dark gray' },
          { foreground: '#CCCCCC', background: '#FFFFFF', name: 'light gray' }
        ]
      });
      expect(report.colors.total).toBe(3);
      expect(report.colors.passesAA).toBe(2); // black/white and dark gray pass
    });
  });

  describe('combined validation', () => {
    it('validates all sections together', () => {
      const report = validateDesignTokens({
        spacing: [8, 16],
        typography: [{ fontSize: 16 }],
        colors: [{ foreground: '#000000', background: '#FFFFFF' }]
      });
      expect(report.spacing.total).toBe(2);
      expect(report.typography.total).toBe(1);
      expect(report.colors.total).toBe(1);
      expect(report.summary.allValid).toBe(true);
    });

    it('handles completely empty input', () => {
      const report = validateDesignTokens({});
      expect(report.spacing.total).toBe(0);
      expect(report.typography.total).toBe(0);
      expect(report.colors.total).toBe(0);
      expect(report.summary.allValid).toBe(true);
    });
  });
});

describe('formatValidationReport', () => {
  it('includes spacing section when spacing tested', () => {
    const report = validateDesignTokens({ spacing: [8, 10] });
    const text = formatValidationReport(report);
    expect(text).toContain('SPACING');
    expect(text).toContain('8pt Grid');
  });

  it('includes typography section when typography tested', () => {
    const report = validateDesignTokens({
      typography: [{ fontSize: 16, name: 'body' }]
    });
    const text = formatValidationReport(report);
    expect(text).toContain('TYPOGRAPHY');
    expect(text).toContain('Type Scale');
  });

  it('omits spacing section when total is 0', () => {
    const report = validateDesignTokens({ typography: [{ fontSize: 16 }] });
    const text = formatValidationReport(report);
    expect(text).not.toContain('SPACING');
  });

  it('shows suggestion arrows for invalid values', () => {
    const report = validateDesignTokens({ spacing: [10] });
    const text = formatValidationReport(report);
    expect(text).toContain('Suggested');
    expect(text).toContain('10px');
  });

  it('uses PASS for valid and FAIL for invalid', () => {
    const report = validateDesignTokens({ spacing: [8, 10] });
    const text = formatValidationReport(report);
    expect(text).toContain('PASS');
    expect(text).toContain('FAIL');
  });
});

describe('validateDesignTokens edge cases', () => {
  it('negative spacing values are invalid', () => {
    const report = validateDesignTokens({ spacing: [-5, -1] });
    expect(report.spacing.invalid).toBe(2);
    expect(report.spacing.valid).toBe(0);
  });

  it('very large spacing values snap to 128', () => {
    const report = validateDesignTokens({ spacing: [500, 1000] });
    expect(report.spacing.invalid).toBe(2);
    for (const result of report.spacing.results) {
      expect(result.suggestedValue).toBe(128);
    }
  });

  it('floating point spacing values are invalid', () => {
    const report = validateDesignTokens({ spacing: [8.5, 16.1] });
    expect(report.spacing.invalid).toBe(2);
  });

  it('typography entries without name are still validated', () => {
    const report = validateDesignTokens({
      typography: [{ fontSize: 16 }]
    });
    expect(report.typography.valid).toBe(1);
  });

  it('summary.issues count matches actual issues', () => {
    const report = validateDesignTokens({
      spacing: [10, 15],
      typography: [{ fontSize: 14 }],
      colors: [{ foreground: '#CCCCCC', background: '#FFFFFF', name: 'low-contrast' }]
    });
    // Every invalid item should generate an issue
    expect(report.summary.allValid).toBe(false);
    expect(report.summary.issues.length).toBeGreaterThanOrEqual(3);
  });

  it('all-valid report has empty issues and recommendations', () => {
    const report = validateDesignTokens({
      spacing: [8, 16],
      typography: [{ fontSize: 16 }],
      colors: [{ foreground: '#000000', background: '#FFFFFF' }]
    });
    expect(report.summary.allValid).toBe(true);
    expect(report.summary.issues).toHaveLength(0);
  });

  it('colors without name field still validate', () => {
    const report = validateDesignTokens({
      colors: [{ foreground: '#000000', background: '#FFFFFF' }]
    });
    expect(report.colors.total).toBe(1);
    expect(report.colors.passesAA).toBe(1);
  });

  it('mixed valid and invalid across all sections', () => {
    const report = validateDesignTokens({
      spacing: [8, 10],
      typography: [{ fontSize: 16 }, { fontSize: 14 }],
      colors: [
        { foreground: '#000000', background: '#FFFFFF' },
        { foreground: '#CCCCCC', background: '#FFFFFF' }
      ]
    });
    expect(report.spacing.valid).toBe(1);
    expect(report.spacing.invalid).toBe(1);
    expect(report.typography.valid).toBe(1);
    expect(report.typography.invalid).toBe(1);
    expect(report.colors.passesAA).toBe(1);
    expect(report.summary.allValid).toBe(false);
  });
});
