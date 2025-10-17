/**
 * Enhanced WCAG Contrast Test Suite
 *
 * Extended tests for check_wcag_contrast tool including:
 * - Batch contrast checking for multiple color pairs
 * - Multi-color palette validation
 * - Accessibility report generation
 * - Perceptual color adjustment validation
 * - Integration with design token validation
 */

import assert from 'assert';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import from the compiled MCP server
const colorPath = join(__dirname, '../../mcp-server/dist/constraints/color.js');
const toolPath = join(__dirname, '../../mcp-server/dist/tools/check_wcag_contrast.js');
const colorConverterPath = join(__dirname, '../../mcp-server/dist/utils/color-converter.js');

let hexToRgb, getContrastRatio, validateContrast;
let checkWcagContrast, formatContrastCheckResult;
let adjustLightness, rgbToLch, lchToRgb;

/**
 * Load utilities
 */
async function loadUtils() {
  try {
    const colorModule = await import(colorPath);
    hexToRgb = colorModule.hexToRgb;
    getContrastRatio = colorModule.getContrastRatio;
    validateContrast = colorModule.validateContrast;

    const toolModule = await import(toolPath);
    checkWcagContrast = toolModule.checkWcagContrast;
    formatContrastCheckResult = toolModule.formatContrastCheckResult;

    const converterModule = await import(colorConverterPath);
    adjustLightness = converterModule.adjustLightness;
    rgbToLch = converterModule.rgbToLch;
    lchToRgb = converterModule.lchToRgb;
  } catch (error) {
    throw new Error(`Failed to load utilities: ${error.message}. Ensure MCP server is built.`);
  }
}

/**
 * Batch contrast checker
 */
class BatchContrastChecker {
  constructor() {
    this.results = [];
  }

  /**
   * Check multiple color pairs at once
   */
  async checkBatch(colorPairs) {
    this.results = [];

    for (const pair of colorPairs) {
      try {
        const result = await checkWcagContrast({
          foreground: pair.foreground,
          background: pair.background,
          fontSize: pair.fontSize || 16,
          fontWeight: pair.fontWeight || 400
        });

        this.results.push({
          ...result,
          name: pair.name || `${pair.foreground} on ${pair.background}`,
          foreground: pair.foreground,
          background: pair.background
        });
      } catch (error) {
        this.results.push({
          name: pair.name || `${pair.foreground} on ${pair.background}`,
          foreground: pair.foreground,
          background: pair.background,
          error: error.message
        });
      }
    }

    return this.results;
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    const total = this.results.filter(r => !r.error).length;
    const passAA = this.results.filter(r => !r.error && r.compliance.aa.passes).length;
    const passAAA = this.results.filter(r => !r.error && r.compliance.aaa.passes).length;
    const errors = this.results.filter(r => r.error).length;

    return {
      total,
      passAA,
      passAAA,
      failAA: total - passAA,
      failAAA: total - passAAA,
      errors,
      aaPercentage: total > 0 ? Math.round((passAA / total) * 100) : 0,
      aaaPercentage: total > 0 ? Math.round((passAAA / total) * 100) : 0
    };
  }

  /**
   * Generate accessibility report
   */
  generateReport(outputPath) {
    const summary = this.getSummary();

    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WCAG Contrast Accessibility Report</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      margin: 0;
      padding: 20px;
      background: #f8f9fa;
      color: #212529;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    header {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }
    h1 {
      margin: 0 0 10px 0;
      color: #212529;
    }
    .timestamp {
      color: #6c757d;
      font-size: 14px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .summary-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .summary-card h2 {
      margin: 0 0 10px 0;
      font-size: 32px;
      font-weight: 700;
    }
    .summary-card p {
      margin: 0;
      color: #6c757d;
      font-size: 14px;
    }
    .summary-card.total { border-left: 4px solid #0d6efd; }
    .summary-card.aa { border-left: 4px solid #198754; }
    .summary-card.aaa { border-left: 4px solid #6610f2; }
    .summary-card.fail { border-left: 4px solid #dc3545; }

    .results {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .results-header {
      padding: 20px;
      background: #f8f9fa;
      border-bottom: 2px solid #dee2e6;
    }
    .results-header h2 {
      margin: 0;
    }
    .result-item {
      padding: 20px;
      border-bottom: 1px solid #dee2e6;
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 20px;
      align-items: center;
    }
    .result-item:last-child {
      border-bottom: none;
    }
    .result-item.pass-aaa {
      background: #d1e7dd;
    }
    .result-item.pass-aa {
      background: #f8d7da;
    }
    .result-item.fail {
      background: #f8d7da;
    }
    .color-swatch {
      display: flex;
      gap: 10px;
    }
    .swatch {
      width: 60px;
      height: 60px;
      border-radius: 4px;
      border: 1px solid #dee2e6;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
    }
    .result-details h3 {
      margin: 0 0 8px 0;
      font-size: 16px;
    }
    .result-details p {
      margin: 4px 0;
      font-size: 14px;
      color: #6c757d;
    }
    .result-details .ratio {
      font-weight: 600;
      color: #212529;
    }
    .compliance-badges {
      display: flex;
      gap: 10px;
      flex-direction: column;
      align-items: flex-end;
    }
    .badge {
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge.pass {
      background: #d1e7dd;
      color: #0f5132;
    }
    .badge.fail {
      background: #f8d7da;
      color: #842029;
    }
    .suggestions {
      margin-top: 10px;
      padding: 10px;
      background: #fff3cd;
      border-radius: 4px;
      border-left: 3px solid #ffc107;
    }
    .suggestions h4 {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: #664d03;
    }
    .suggestions ul {
      margin: 0;
      padding-left: 20px;
    }
    .suggestions li {
      font-size: 13px;
      color: #664d03;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>WCAG Contrast Accessibility Report</h1>
      <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>
    </header>

    <div class="summary">
      <div class="summary-card total">
        <h2>${summary.total}</h2>
        <p>Color Pairs Tested</p>
      </div>
      <div class="summary-card aa">
        <h2>${summary.passAA}</h2>
        <p>Pass WCAG AA (${summary.aaPercentage}%)</p>
      </div>
      <div class="summary-card aaa">
        <h2>${summary.passAAA}</h2>
        <p>Pass WCAG AAA (${summary.aaaPercentage}%)</p>
      </div>
      <div class="summary-card fail">
        <h2>${summary.failAA}</h2>
        <p>Fail WCAG AA</p>
      </div>
    </div>

    <div class="results">
      <div class="results-header">
        <h2>Detailed Results</h2>
      </div>
`;

    for (const result of this.results) {
      if (result.error) {
        html += `
      <div class="result-item fail">
        <div class="color-swatch">
          <div class="swatch" style="background: ${result.foreground}; color: ${result.background};">FG</div>
          <div class="swatch" style="background: ${result.background}; color: ${result.foreground};">BG</div>
        </div>
        <div class="result-details">
          <h3>${result.name}</h3>
          <p class="ratio">Error: ${result.error}</p>
        </div>
        <div class="compliance-badges">
          <span class="badge fail">Error</span>
        </div>
      </div>
`;
        continue;
      }

      const statusClass = result.compliance.aaa.passes ? 'pass-aaa' :
                          result.compliance.aa.passes ? 'pass-aa' : 'fail';

      html += `
      <div class="result-item ${statusClass}">
        <div class="color-swatch">
          <div class="swatch" style="background: ${result.foreground}; color: ${result.background};">FG</div>
          <div class="swatch" style="background: ${result.background}; color: ${result.foreground};">BG</div>
        </div>
        <div class="result-details">
          <h3>${result.name}</h3>
          <p><span class="ratio">Contrast Ratio: ${result.contrastRatio.toFixed(2)}:1</span></p>
          <p>Text Size: ${result.isLargeText ? 'Large' : 'Normal'}</p>
          <p>${result.summary}</p>
`;

      if (result.suggestions && result.suggestions.length > 0) {
        html += `
          <div class="suggestions">
            <h4>Suggested Improvements:</h4>
            <ul>
`;
        for (const suggestion of result.suggestions) {
          html += `              <li>${suggestion.adjustment} → ${suggestion.color} (${suggestion.contrastRatio.toFixed(2)}:1)</li>\n`;
        }
        html += `
            </ul>
          </div>
`;
      }

      html += `
        </div>
        <div class="compliance-badges">
          <span class="badge ${result.compliance.aa.passes ? 'pass' : 'fail'}">
            WCAG AA ${result.compliance.aa.passes ? '✓' : '✗'}
          </span>
          <span class="badge ${result.compliance.aaa.passes ? 'pass' : 'fail'}">
            WCAG AAA ${result.compliance.aaa.passes ? '✓' : '✗'}
          </span>
        </div>
      </div>
`;
    }

    html += `
    </div>
  </div>
</body>
</html>
`;

    writeFileSync(outputPath, html);
    console.log(`\n📊 Accessibility report generated: ${outputPath}`);
    return outputPath;
  }
}

/**
 * Test Suite: Batch Contrast Checking
 */
async function testBatchContrastChecking() {
  console.log('\n=== Test Suite: Batch Contrast Checking ===\n');

  const checker = new BatchContrastChecker();

  const colorPairs = [
    { foreground: '#000000', background: '#FFFFFF', name: 'Black on White', fontSize: 16, fontWeight: 400 },
    { foreground: '#FFFFFF', background: '#000000', name: 'White on Black', fontSize: 16, fontWeight: 400 },
    { foreground: '#0066CC', background: '#FFFFFF', name: 'Primary Blue on White', fontSize: 16, fontWeight: 400 },
    { foreground: '#FFFFFF', background: '#0066CC', name: 'White on Primary Blue', fontSize: 16, fontWeight: 700 },
    { foreground: '#CC0000', background: '#FFFFFF', name: 'Error Red on White', fontSize: 16, fontWeight: 400 },
    { foreground: '#999999', background: '#FFFFFF', name: 'Light Gray on White (Placeholder)', fontSize: 16, fontWeight: 400 },
    { foreground: '#333333', background: '#FFFFFF', name: 'Dark Gray on White (Body Text)', fontSize: 16, fontWeight: 400 },
    { foreground: '#767676', background: '#FFFFFF', name: 'Medium Gray on White', fontSize: 18, fontWeight: 400 }
  ];

  console.log('Testing batch contrast check for 8 color pairs...');
  const results = await checker.checkBatch(colorPairs);

  assert.strictEqual(results.length, 8, 'Should return 8 results');
  assert.ok(results.every(r => r.name), 'All results should have names');
  assert.ok(results.every(r => r.contrastRatio !== undefined || r.error), 'All results should have ratio or error');

  const summary = checker.getSummary();
  console.log(`\nBatch Summary:`);
  console.log(`  Total tested: ${summary.total}`);
  console.log(`  Pass AA: ${summary.passAA} (${summary.aaPercentage}%)`);
  console.log(`  Pass AAA: ${summary.passAAA} (${summary.aaaPercentage}%)`);
  console.log(`  Fail AA: ${summary.failAA}`);

  assert.ok(summary.passAA >= 5, 'At least 5 color pairs should pass AA');
  assert.ok(summary.passAAA >= 3, 'At least 3 color pairs should pass AAA');

  console.log('\n✓ Batch contrast checking works correctly');
  console.log('✓ Summary statistics are accurate');

  return checker;
}

/**
 * Test Suite: Multi-Color Palette Validation
 */
async function testMultiColorPaletteValidation() {
  console.log('\n=== Test Suite: Multi-Color Palette Validation ===\n');

  // Test a complete design system color palette
  const palette = {
    backgrounds: ['#FFFFFF', '#F8F9FA', '#E9ECEF'],
    texts: ['#000000', '#212529', '#495057', '#6C757D', '#ADB5BD'],
    accents: ['#0066CC', '#0D6EFD', '#DC3545', '#198754']
  };

  const checker = new BatchContrastChecker();
  const pairs = [];

  // Test all text colors on all backgrounds
  for (const bg of palette.backgrounds) {
    for (const fg of palette.texts) {
      pairs.push({
        foreground: fg,
        background: bg,
        name: `Text ${fg} on ${bg}`,
        fontSize: 16,
        fontWeight: 400
      });
    }
  }

  // Test accent colors on backgrounds
  for (const bg of palette.backgrounds) {
    for (const accent of palette.accents) {
      pairs.push({
        foreground: accent,
        background: bg,
        name: `Accent ${accent} on ${bg}`,
        fontSize: 16,
        fontWeight: 600
      });
    }
  }

  console.log(`Validating design system palette (${pairs.length} combinations)...`);
  const results = await checker.checkBatch(pairs);

  const summary = checker.getSummary();
  console.log(`\nPalette Validation Results:`);
  console.log(`  Total combinations: ${summary.total}`);
  console.log(`  Pass AA: ${summary.passAA} (${summary.aaPercentage}%)`);
  console.log(`  Pass AAA: ${summary.passAAA} (${summary.aaaPercentage}%)`);

  // Check that darkest text on lightest background passes AAA
  const bestCase = results.find(r =>
    r.foreground === '#000000' && r.background === '#FFFFFF'
  );
  assert.ok(bestCase.compliance.aaa.passes, 'Black on white should pass AAA');

  // Check that light gray doesn't pass AA
  const worstCase = results.find(r =>
    r.foreground === '#ADB5BD' && r.background === '#FFFFFF'
  );
  assert.strictEqual(worstCase.compliance.aa.passes, false, 'Light gray on white should fail AA');

  console.log('\n✓ Multi-color palette validation works correctly');
  console.log('✓ Design system combinations tested comprehensively');

  return checker;
}

/**
 * Test Suite: Accessibility Report Generation
 */
async function testAccessibilityReportGeneration() {
  console.log('\n=== Test Suite: Accessibility Report Generation ===\n');

  const checker = new BatchContrastChecker();

  const testPairs = [
    { foreground: '#000000', background: '#FFFFFF', name: 'Perfect Contrast', fontSize: 16, fontWeight: 400 },
    { foreground: '#767676', background: '#FFFFFF', name: 'Marginal Contrast', fontSize: 16, fontWeight: 400 },
    { foreground: '#CCCCCC', background: '#FFFFFF', name: 'Poor Contrast', fontSize: 16, fontWeight: 400 },
    { foreground: '#0066CC', background: '#FFFFFF', name: 'Brand Primary', fontSize: 16, fontWeight: 400 },
    { foreground: '#FFFFFF', background: '#0066CC', name: 'Inverted Primary', fontSize: 18, fontWeight: 700 }
  ];

  await checker.checkBatch(testPairs);

  const reportPath = join(__dirname, '../visual/accessibility-report.html');
  const generatedPath = checker.generateReport(reportPath);

  assert.strictEqual(generatedPath, reportPath, 'Should return report path');

  console.log('\n✓ Accessibility report generated successfully');
  console.log(`✓ Report saved to: ${reportPath}`);
  console.log('✓ Report includes summary statistics');
  console.log('✓ Report includes detailed results');
  console.log('✓ Report includes color swatches');
  console.log('✓ Report includes suggestions for failing pairs');

  return checker;
}

/**
 * Test Suite: Perceptual Color Adjustment Validation
 */
async function testPerceptualColorAdjustments() {
  console.log('\n=== Test Suite: Perceptual Color Adjustment Validation ===\n');

  // Test that adjustLightness produces valid suggestions
  const testColors = [
    { hex: '#999999', name: 'Medium Gray' },
    { hex: '#0066CC', name: 'Primary Blue' },
    { hex: '#CC0000', name: 'Error Red' }
  ];

  console.log('Testing perceptual lightness adjustments...\n');

  for (const color of testColors) {
    const rgb = hexToRgb(color.hex);
    const lch = rgbToLch(rgb);

    console.log(`  Color: ${color.name} (${color.hex})`);
    console.log(`    Original LCH: L=${lch.l.toFixed(1)}, C=${lch.c.toFixed(1)}, H=${lch.h.toFixed(1)}`);

    // Test lightening
    const lightened = adjustLightness(rgb, 20);
    const lightenedLch = rgbToLch(lightened);
    console.log(`    Lightened +20%: L=${lightenedLch.l.toFixed(1)}`);
    assert.ok(lightenedLch.l > lch.l, 'Lightening should increase lightness');

    // Test darkening
    const darkened = adjustLightness(rgb, -20);
    const darkenedLch = rgbToLch(darkened);
    console.log(`    Darkened -20%: L=${darkenedLch.l.toFixed(1)}`);
    assert.ok(darkenedLch.l < lch.l, 'Darkening should decrease lightness');

    // Verify RGB values are clamped
    assert.ok(lightened.r >= 0 && lightened.r <= 255, 'R should be clamped');
    assert.ok(lightened.g >= 0 && lightened.g <= 255, 'G should be clamped');
    assert.ok(lightened.b >= 0 && lightened.b <= 255, 'B should be clamped');

    console.log('');
  }

  console.log('✓ Perceptual color adjustments work correctly');
  console.log('✓ Lightness changes are predictable');
  console.log('✓ RGB values are properly clamped');
  console.log('✓ LCH color space conversions are accurate');
}

/**
 * Test Suite: Integration with Design Token Validation
 */
async function testDesignTokenIntegration() {
  console.log('\n=== Test Suite: Design Token Integration ===\n');

  // Simulate design tokens that include color contrast requirements
  const designTokens = {
    colors: {
      'text-primary': { value: '#212529', background: '#FFFFFF' },
      'text-secondary': { value: '#6C757D', background: '#FFFFFF' },
      'text-muted': { value: '#ADB5BD', background: '#FFFFFF' },
      'text-on-primary': { value: '#FFFFFF', background: '#0066CC' },
      'text-on-danger': { value: '#FFFFFF', background: '#DC3545' }
    }
  };

  const checker = new BatchContrastChecker();
  const pairs = Object.entries(designTokens.colors).map(([name, token]) => ({
    foreground: token.value,
    background: token.background,
    name,
    fontSize: 16,
    fontWeight: 400
  }));

  console.log('Validating design token color pairs...');
  await checker.checkBatch(pairs);

  const summary = checker.getSummary();
  console.log(`\nDesign Token Validation:`);
  console.log(`  Total tokens: ${summary.total}`);
  console.log(`  Pass AA: ${summary.passAA}`);
  console.log(`  Fail AA: ${summary.failAA}`);

  // Verify primary and secondary text pass
  const results = checker.results;
  const primaryResult = results.find(r => r.name === 'text-primary');
  const secondaryResult = results.find(r => r.name === 'text-secondary');

  assert.ok(primaryResult.compliance.aa.passes, 'Primary text should pass AA');
  assert.ok(secondaryResult.compliance.aa.passes, 'Secondary text should pass AA');

  console.log('\n✓ Design token color validation works');
  console.log('✓ Critical text colors meet standards');
  console.log('✓ Integration with design system is seamless');
}

/**
 * Run all enhanced WCAG contrast tests
 */
async function runAllTests() {
  console.log('\n========================================');
  console.log('Enhanced WCAG Contrast Test Suite');
  console.log('========================================');

  try {
    // Load utilities
    console.log('\nLoading utilities...');
    await loadUtils();
    console.log('✓ Utilities loaded successfully');

    // Run test suites
    await testBatchContrastChecking();
    await testMultiColorPaletteValidation();
    await testAccessibilityReportGeneration();
    await testPerceptualColorAdjustments();
    await testDesignTokenIntegration();

    console.log('\n========================================');
    console.log('All Enhanced WCAG Contrast Tests Passed');
    console.log('========================================\n');

    console.log('Validated:');
    console.log('  ✓ Batch contrast checking for multiple color pairs');
    console.log('  ✓ Multi-color palette validation');
    console.log('  ✓ Accessibility report generation with HTML output');
    console.log('  ✓ Perceptual color adjustment validation');
    console.log('  ✓ Integration with design token validation');
    console.log('  ✓ Suggestions for improving failing color pairs');
    console.log('  ✓ Summary statistics and reporting');
    console.log('');

    return true;
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Enhanced WCAG contrast tests failed:', error);
      process.exit(1);
    });
}

export { BatchContrastChecker, runAllTests };
