/**
 * Design Validation Pipeline Integration Tests
 *
 * Tests the full pipeline: design spec → auto-correction → validation → token checks.
 * Verifies that corrections produce specs that pass validation, and that the
 * validation tools produce consistent results across the constraint modules.
 */

import { describe, expect, it } from 'vitest';
import { autoCorrectSpec, validateSpec } from '../../mcp-server/src/utils/auto-validator.js';
import { validateDesignTokens } from '../../mcp-server/src/tools/validate_design_tokens.js';
import { checkWcagContrast } from '../../mcp-server/src/tools/check_wcag_contrast.js';
import { VALID_SPACING_VALUES, isValidSpacing } from '../../mcp-server/src/constraints/spacing.js';
import { VALID_FONT_SIZES, isValidFontSize } from '../../mcp-server/src/constraints/typography.js';

describe('Design Validation Pipeline', () => {
  describe('auto-correction → validation roundtrip', () => {
    it('corrected spacing values pass spacing validation', () => {
      const spec = {
        type: 'frame' as const,
        name: 'container',
        props: { padding: 15, itemSpacing: 10 }
      };

      const corrected = autoCorrectSpec(spec);
      expect(corrected.wasModified).toBe(true);

      // Verify corrected values are on the 8pt grid
      expect(isValidSpacing(corrected.corrected.props?.padding as number)).toBe(true);
      expect(isValidSpacing(corrected.corrected.props?.itemSpacing as number)).toBe(true);
    });

    it('corrected font sizes pass typography validation', () => {
      const spec = {
        type: 'text' as const,
        name: 'label',
        props: { fontSize: 14 }
      };

      const corrected = autoCorrectSpec(spec);
      expect(corrected.wasModified).toBe(true);

      const fontSize = corrected.corrected.props?.fontSize as number;
      expect(isValidFontSize(fontSize)).toBe(true);
    });

    it('corrected values from autoCorrectSpec pass validateDesignTokens', () => {
      const spec = {
        type: 'frame' as const,
        name: 'card',
        props: { padding: 15, itemSpacing: 10 },
        children: [
          {
            type: 'text' as const,
            name: 'title',
            props: { fontSize: 14, content: 'Hello' }
          }
        ]
      };

      const corrected = autoCorrectSpec(spec);
      const spacing = corrected.corrected.props?.padding as number;
      const itemSpacing = corrected.corrected.props?.itemSpacing as number;

      // Find the corrected font size from child
      const childSpec = corrected.corrected.children?.[0];
      const fontSize = childSpec?.props?.fontSize as number;

      // Now validate these as design tokens
      const report = validateDesignTokens({
        spacing: [spacing, itemSpacing],
        typography: [{ fontSize, name: 'title' }]
      });

      // All corrected values should pass
      expect(report.spacing.invalid).toBe(0);
      expect(report.typography.invalid).toBe(0);
    });
  });

  describe('validateSpec + validateDesignTokens consistency', () => {
    it('a spec with valid tokens has no validation issues', () => {
      const spec = {
        type: 'frame' as const,
        name: 'valid-design',
        props: {
          padding: 16,
          itemSpacing: 8,
          layoutMode: 'VERTICAL'
        },
        children: [
          {
            type: 'text' as const,
            name: 'heading',
            props: { content: 'Title', fontSize: 24 }
          },
          {
            type: 'text' as const,
            name: 'body',
            props: { content: 'Body text', fontSize: 16 }
          }
        ]
      };

      // Validate the spec structure
      const specResult = validateSpec(spec);
      expect(specResult.valid).toBe(true);

      // Validate the design tokens
      const tokenReport = validateDesignTokens({
        spacing: [16, 8],
        typography: [
          { fontSize: 24, name: 'heading' },
          { fontSize: 16, name: 'body' }
        ]
      });
      expect(tokenReport.summary.allValid).toBe(true);
    });

    it('a spec with invalid tokens shows issues in both validators', () => {
      const spec = {
        type: 'frame' as const,
        name: 'bad-design',
        props: { padding: 15 }
      };

      // validateSpec should warn about off-grid spacing
      const specResult = validateSpec(spec);
      const spacingWarning = specResult.issues.find(
        (i) => i.field === 'padding' && i.severity === 'warning'
      );
      expect(spacingWarning?.field).toBe('padding');

      // validateDesignTokens should also flag it
      const tokenReport = validateDesignTokens({ spacing: [15] });
      expect(tokenReport.spacing.invalid).toBe(1);
    });
  });

  describe('contrast check + design token color validation consistency', () => {
    it('both tools agree on passing contrast pairs', () => {
      const fg = '#000000';
      const bg = '#FFFFFF';

      const contrastResult = checkWcagContrast({
        foreground: fg,
        background: bg,
        fontSize: 16,
        fontWeight: 400
      });

      const tokenReport = validateDesignTokens({
        colors: [{ foreground: fg, background: bg, name: 'test' }]
      });

      // Both should agree this passes AA
      expect(contrastResult.compliance.aa.passes).toBe(true);
      expect(tokenReport.colors.passesAA).toBe(1);
    });

    it('both tools agree on failing contrast pairs', () => {
      const fg = '#CCCCCC';
      const bg = '#FFFFFF';

      const contrastResult = checkWcagContrast({
        foreground: fg,
        background: bg,
        fontSize: 16,
        fontWeight: 400
      });

      const tokenReport = validateDesignTokens({
        colors: [{ foreground: fg, background: bg, name: 'test' }]
      });

      // Both should agree this fails AA
      expect(contrastResult.compliance.aa.passes).toBe(false);
      expect(tokenReport.colors.passesAA).toBe(0);
    });
  });
});

describe('Design Validation Pipeline — Design System', () => {
  describe('end-to-end design system validation', () => {
    it('validates a complete Bootstrap-like design system', () => {
      const report = validateDesignTokens({
        spacing: [0, 4, 8, 16, 24, 32, 48, 64],
        typography: [
          { fontSize: 12, name: 'small' },
          { fontSize: 16, name: 'body' },
          { fontSize: 20, name: 'h3' },
          { fontSize: 24, name: 'h2' },
          { fontSize: 32, name: 'h1' },
          { fontSize: 48, name: 'display' }
        ],
        colors: [
          { foreground: '#212529', background: '#FFFFFF', name: 'body text' },
          { foreground: '#000000', background: '#FFFFFF', name: 'headings' },
          { foreground: '#FFFFFF', background: '#0D6EFD', name: 'primary button' }
        ]
      });

      // All spacing and typography should be valid (using grid/scale values)
      expect(report.spacing.invalid).toBe(0);
      expect(report.typography.invalid).toBe(0);

      // Body text and headings should pass AA
      expect(report.colors.passesAA).toBeGreaterThanOrEqual(2);
    });
  });

  describe('multi-step design creation pipeline', () => {
    it('corrects a bad spec, validates it, then verifies tokens match', () => {
      // Step 1: Start with an off-grid spec
      const badSpec = {
        type: 'frame' as const,
        name: 'Card',
        props: { padding: 15, itemSpacing: 10, cornerRadius: 6 },
        children: [
          { type: 'text' as const, name: 'Title', props: { fontSize: 14, content: 'Card Title' } },
          {
            type: 'text' as const,
            name: 'Body',
            props: { fontSize: 16, content: 'Card body text' }
          }
        ]
      };

      // Step 2: Auto-correct the spec
      const corrected = autoCorrectSpec(badSpec);
      expect(corrected.wasModified).toBe(true);

      // Step 3: Validate the corrected spec
      const specValidation = validateSpec(corrected.corrected);
      expect(specValidation.valid).toBe(true);

      // Step 4: Extract design tokens and validate them
      const spacing = corrected.corrected.props?.padding as number;
      const itemSpacing = corrected.corrected.props?.itemSpacing as number;
      const titleFontSize = corrected.corrected.children?.[0]?.props?.fontSize as number;

      expect(isValidSpacing(spacing)).toBe(true);
      expect(isValidSpacing(itemSpacing)).toBe(true);
      expect(isValidFontSize(titleFontSize)).toBe(true);

      // Step 5: Cross-validate with validateDesignTokens
      const tokenReport = validateDesignTokens({
        spacing: [spacing, itemSpacing],
        typography: [{ fontSize: titleFontSize, name: 'title' }]
      });
      expect(tokenReport.summary.allValid).toBe(true);
    });

    it('contrast check results agree between checkWcagContrast and validateDesignTokens for multiple pairs', () => {
      const colorPairs = [
        { fg: '#000000', bg: '#FFFFFF' },
        { fg: '#333333', bg: '#FFFFFF' },
        { fg: '#666666', bg: '#FFFFFF' },
        { fg: '#999999', bg: '#FFFFFF' },
        { fg: '#CCCCCC', bg: '#FFFFFF' }
      ];

      for (const { fg, bg } of colorPairs) {
        const direct = checkWcagContrast({
          foreground: fg,
          background: bg,
          fontSize: 16,
          fontWeight: 400
        });
        const tokenReport = validateDesignTokens({
          colors: [{ foreground: fg, background: bg }]
        });

        // Both methods should agree on AA pass/fail
        if (direct.compliance.aa.passes) {
          expect(tokenReport.colors.passesAA).toBe(1);
        } else {
          expect(tokenReport.colors.passesAA).toBe(0);
        }
      }
    });

    it('auto-correction chain: correct → validate → extract tokens → all consistent', () => {
      // Complex nested spec
      const spec = {
        type: 'frame' as const,
        name: 'Dashboard',
        props: { padding: 30, itemSpacing: 15 },
        children: [
          {
            type: 'frame' as const,
            name: 'Header',
            props: { padding: 10, itemSpacing: 6 },
            children: [
              { type: 'text' as const, name: 'Logo', props: { fontSize: 22, content: 'Logo' } }
            ]
          },
          {
            type: 'frame' as const,
            name: 'Content',
            props: { padding: 20, itemSpacing: 12 }
          }
        ]
      };

      const corrected = autoCorrectSpec(spec);
      expect(corrected.corrections.length).toBeGreaterThanOrEqual(4);

      // All corrected spacing values should be on the 8pt grid
      const allSpacingValues: number[] = [];

      function extractSpacing(node: typeof corrected.corrected): void {
        if (node.props?.padding) allSpacingValues.push(node.props.padding as number);
        if (node.props?.itemSpacing) allSpacingValues.push(node.props.itemSpacing as number);
        if (node.children) {
          for (const child of node.children) {
            extractSpacing(child);
          }
        }
      }

      extractSpacing(corrected.corrected);

      for (const val of allSpacingValues) {
        expect(isValidSpacing(val)).toBe(true);
      }
    });

    it('auto-correction is idempotent: correcting an already-corrected spec makes no changes', () => {
      const badSpec = {
        type: 'frame' as const,
        name: 'Card',
        props: { padding: 15, itemSpacing: 10, cornerRadius: 6 },
        children: [
          { type: 'text' as const, name: 'Title', props: { fontSize: 14, content: 'Hello' } }
        ]
      };

      const firstPass = autoCorrectSpec(badSpec);
      expect(firstPass.wasModified).toBe(true);

      // Second pass on already-corrected spec should make no changes
      const secondPass = autoCorrectSpec(firstPass.corrected);
      expect(secondPass.wasModified).toBe(false);
      expect(secondPass.corrections).toHaveLength(0);
    });

    it('validates that every VALID_SPACING_VALUE passes the spacing schema', () => {
      for (const value of VALID_SPACING_VALUES) {
        const spec = {
          type: 'frame' as const,
          name: 'test',
          props: { padding: value }
        };
        const result = validateSpec(spec);
        const spacingIssues = result.issues.filter(
          (i) => i.field === 'padding' && i.severity === 'warning'
        );
        expect(spacingIssues).toHaveLength(0);
      }
    });

    it('validates that every VALID_FONT_SIZE passes typography validation', () => {
      for (const size of VALID_FONT_SIZES) {
        const spec = {
          type: 'text' as const,
          name: 'test',
          props: { fontSize: size, content: 'Test' }
        };
        const result = validateSpec(spec);
        const fontIssues = result.issues.filter(
          (i) => i.field === 'fontSize' && i.severity === 'warning'
        );
        expect(fontIssues).toHaveLength(0);
      }
    });

    it('auto-correction + design token validation agree on every corrected value', () => {
      // Test with a wide range of off-grid values
      const offGridValues = [1, 3, 5, 7, 9, 10, 12, 13, 15, 17, 19, 20, 25, 30, 50, 100, 200];

      for (const val of offGridValues) {
        const corrected = autoCorrectSpec({
          type: 'frame' as const,
          name: 'test',
          props: { padding: val }
        });

        const correctedPadding = corrected.corrected.props?.padding as number;

        // The corrected value should pass design token validation
        const tokenReport = validateDesignTokens({ spacing: [correctedPadding] });
        expect(tokenReport.spacing.invalid).toBe(0);
      }
    });
  });
});
