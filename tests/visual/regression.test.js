/**
 * Visual Regression Test Scaffold
 *
 * Provides infrastructure for visual regression testing using Playwright:
 * - Screenshot comparisons for UI components
 * - Baseline image storage and management
 * - Pixel diff calculations with threshold-based pass/fail
 * - Visual regression report generation
 *
 * This scaffold can be extended with actual Playwright tests.
 */

import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const BASELINE_DIR = join(__dirname, 'baselines');
const DIFF_DIR = join(__dirname, 'diffs');
const DIFF_THRESHOLD = 0.1; // 0.1% pixel difference threshold

// Ensure directories exist
if (!existsSync(BASELINE_DIR)) {
  mkdirSync(BASELINE_DIR, { recursive: true });
}
if (!existsSync(DIFF_DIR)) {
  mkdirSync(DIFF_DIR, { recursive: true });
}

/**
 * Visual Regression Test Utilities
 */
class VisualRegressionTester {
  constructor(page, testName) {
    this.page = page;
    this.testName = testName;
    this.screenshots = [];
  }

  /**
   * Captures a screenshot and compares it with baseline
   */
  async captureAndCompare(componentName, options = {}) {
    const screenshotName = `${this.testName}__${componentName}.png`;
    const baselinePath = join(BASELINE_DIR, screenshotName);
    const currentPath = join(DIFF_DIR, `current__${screenshotName}`);
    const diffPath = join(DIFF_DIR, `diff__${screenshotName}`);

    // Capture current screenshot
    const screenshot = await this.page.screenshot({
      ...options,
      path: currentPath,
      fullPage: options.fullPage !== undefined ? options.fullPage : false
    });

    // Check if baseline exists
    if (!existsSync(baselinePath)) {
      // Create baseline for first run
      writeFileSync(baselinePath, screenshot);
      console.log(`  📸 Created baseline: ${screenshotName}`);
      return {
        isNewBaseline: true,
        passed: true,
        screenshotName,
        message: 'Baseline created'
      };
    }

    // Compare with baseline
    try {
      await expect(this.page).toHaveScreenshot(screenshotName, {
        maxDiffPixels: options.maxDiffPixels || 100,
        threshold: options.threshold || DIFF_THRESHOLD
      });

      console.log(`  ✓ Visual match: ${screenshotName}`);
      return {
        isNewBaseline: false,
        passed: true,
        screenshotName,
        message: 'Visual regression test passed'
      };
    } catch (error) {
      console.log(`  ✗ Visual diff detected: ${screenshotName}`);
      return {
        isNewBaseline: false,
        passed: false,
        screenshotName,
        message: error.message,
        diffPath
      };
    }
  }

  /**
   * Captures screenshot of a specific element
   */
  async captureElement(selector, componentName, options = {}) {
    const element = await this.page.locator(selector);
    await element.waitFor({ state: 'visible' });

    const screenshotName = `${this.testName}__${componentName}.png`;
    const screenshot = await element.screenshot(options);

    return this.compareScreenshot(screenshot, screenshotName, options);
  }

  /**
   * Compares screenshot buffer with baseline
   */
  async compareScreenshot(screenshotBuffer, screenshotName, options = {}) {
    const baselinePath = join(BASELINE_DIR, screenshotName);
    const currentPath = join(DIFF_DIR, `current__${screenshotName}`);

    // Save current screenshot
    writeFileSync(currentPath, screenshotBuffer);

    if (!existsSync(baselinePath)) {
      writeFileSync(baselinePath, screenshotBuffer);
      return {
        isNewBaseline: true,
        passed: true,
        screenshotName,
        message: 'Baseline created'
      };
    }

    // Simple pixel comparison (in a real implementation, use image diff library)
    const baseline = readFileSync(baselinePath);
    const current = screenshotBuffer;

    const pixelDiff = this.calculatePixelDiff(baseline, current);
    const threshold = options.threshold || DIFF_THRESHOLD;
    const passed = pixelDiff <= threshold;

    if (passed) {
      console.log(`  ✓ Visual match: ${screenshotName} (${pixelDiff.toFixed(4)}% diff)`);
    } else {
      console.log(`  ✗ Visual diff: ${screenshotName} (${pixelDiff.toFixed(4)}% diff > ${threshold}% threshold)`);
    }

    return {
      isNewBaseline: false,
      passed,
      screenshotName,
      pixelDiff,
      threshold,
      message: passed ? 'Visual regression test passed' : `Pixel diff ${pixelDiff.toFixed(4)}% exceeds threshold ${threshold}%`
    };
  }

  /**
   * Simple pixel difference calculation
   * In production, use a library like pixelmatch or resemblejs
   */
  calculatePixelDiff(buffer1, buffer2) {
    if (buffer1.length !== buffer2.length) {
      return 100; // Completely different
    }

    let differences = 0;
    for (let i = 0; i < buffer1.length; i++) {
      if (buffer1[i] !== buffer2[i]) {
        differences++;
      }
    }

    return (differences / buffer1.length) * 100;
  }

  /**
   * Generates HTML report for visual regression tests
   */
  generateReport(results) {
    const reportPath = join(DIFF_DIR, 'visual-regression-report.html');

    let html = `
<!DOCTYPE html>
<html>
<head>
  <title>Visual Regression Test Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      margin-bottom: 30px;
    }
    .summary {
      display: flex;
      gap: 20px;
      margin-bottom: 30px;
    }
    .summary-card {
      flex: 1;
      padding: 20px;
      border-radius: 4px;
      color: white;
    }
    .summary-card.passed {
      background: #28a745;
    }
    .summary-card.failed {
      background: #dc3545;
    }
    .summary-card.new {
      background: #17a2b8;
    }
    .summary-card h2 {
      margin: 0 0 10px 0;
      font-size: 36px;
    }
    .summary-card p {
      margin: 0;
      opacity: 0.9;
    }
    .test-result {
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .test-result.passed {
      border-left: 4px solid #28a745;
    }
    .test-result.failed {
      border-left: 4px solid #dc3545;
    }
    .test-result.new {
      border-left: 4px solid #17a2b8;
    }
    .test-result h3 {
      margin: 0 0 10px 0;
      color: #333;
    }
    .test-result .status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 10px;
    }
    .status.passed {
      background: #d4edda;
      color: #155724;
    }
    .status.failed {
      background: #f8d7da;
      color: #721c24;
    }
    .status.new {
      background: #d1ecf1;
      color: #0c5460;
    }
    .screenshots {
      display: flex;
      gap: 20px;
      margin-top: 15px;
    }
    .screenshot {
      flex: 1;
    }
    .screenshot img {
      max-width: 100%;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .screenshot p {
      margin: 5px 0 0 0;
      text-align: center;
      font-size: 14px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Visual Regression Test Report</h1>
    <div class="summary">
      <div class="summary-card passed">
        <h2>${results.passed}</h2>
        <p>Tests Passed</p>
      </div>
      <div class="summary-card failed">
        <h2>${results.failed}</h2>
        <p>Tests Failed</p>
      </div>
      <div class="summary-card new">
        <h2>${results.newBaselines}</h2>
        <p>New Baselines</p>
      </div>
    </div>
    <div class="test-results">
`;

    for (const result of results.tests) {
      const statusClass = result.isNewBaseline ? 'new' : (result.passed ? 'passed' : 'failed');
      const statusText = result.isNewBaseline ? 'NEW BASELINE' : (result.passed ? 'PASSED' : 'FAILED');

      html += `
      <div class="test-result ${statusClass}">
        <h3>
          ${result.screenshotName}
          <span class="status ${statusClass}">${statusText}</span>
        </h3>
        <p>${result.message}</p>
`;

      if (result.pixelDiff !== undefined) {
        html += `<p>Pixel difference: ${result.pixelDiff.toFixed(4)}% (threshold: ${result.threshold}%)</p>`;
      }

      html += `
      </div>
`;
    }

    html += `
    </div>
    <p style="margin-top: 30px; text-align: center; color: #666; font-size: 14px;">
      Generated: ${new Date().toLocaleString()}
    </p>
  </div>
</body>
</html>
`;

    writeFileSync(reportPath, html);
    console.log(`\n📊 Visual regression report generated: ${reportPath}`);
    return reportPath;
  }
}

/**
 * Example: Test Figma Component Visual Regression
 */
test.describe('Figma Component Visual Regression', () => {
  test('Button component should match baseline', async ({ page }) => {
    // Navigate to test page (this would be your actual Figma plugin UI or test page)
    await page.goto('http://localhost:3000/test-components');

    const tester = new VisualRegressionTester(page, 'button-component');

    // Test primary button
    const primaryResult = await tester.captureElement(
      '[data-testid="button-primary"]',
      'primary',
      { threshold: 0.05 }
    );
    expect(primaryResult.passed).toBe(true);

    // Test secondary button
    const secondaryResult = await tester.captureElement(
      '[data-testid="button-secondary"]',
      'secondary',
      { threshold: 0.05 }
    );
    expect(secondaryResult.passed).toBe(true);

    // Test danger button
    const dangerResult = await tester.captureElement(
      '[data-testid="button-danger"]',
      'danger',
      { threshold: 0.05 }
    );
    expect(dangerResult.passed).toBe(true);

    // Generate report
    const results = {
      passed: [primaryResult, secondaryResult, dangerResult].filter(r => r.passed).length,
      failed: [primaryResult, secondaryResult, dangerResult].filter(r => !r.passed && !r.isNewBaseline).length,
      newBaselines: [primaryResult, secondaryResult, dangerResult].filter(r => r.isNewBaseline).length,
      tests: [primaryResult, secondaryResult, dangerResult]
    };

    tester.generateReport(results);
  });

  test('Form component should match baseline', async ({ page }) => {
    await page.goto('http://localhost:3000/test-components');

    const tester = new VisualRegressionTester(page, 'form-component');

    // Test login form
    const formResult = await tester.captureElement(
      '[data-testid="login-form"]',
      'login-form',
      { threshold: 0.1 }
    );
    expect(formResult.passed).toBe(true);

    // Generate report
    const results = {
      passed: formResult.passed ? 1 : 0,
      failed: !formResult.passed && !formResult.isNewBaseline ? 1 : 0,
      newBaselines: formResult.isNewBaseline ? 1 : 0,
      tests: [formResult]
    };

    tester.generateReport(results);
  });

  test('Full page layout should match baseline', async ({ page }) => {
    await page.goto('http://localhost:3000');

    const tester = new VisualRegressionTester(page, 'full-page');

    // Test full page
    const pageResult = await tester.captureAndCompare('homepage', {
      fullPage: true,
      threshold: 0.2 // Allow more variance for full page
    });
    expect(pageResult.passed).toBe(true);
  });
});

/**
 * Example: Test Color Contrast Visual Validation
 */
test.describe('Color Contrast Visual Validation', () => {
  test('High contrast text should be readable', async ({ page }) => {
    await page.goto('http://localhost:3000/test-contrast');

    const tester = new VisualRegressionTester(page, 'contrast-test');

    // Test various contrast scenarios
    const scenarios = [
      { selector: '[data-testid="text-black-white"]', name: 'black-on-white' },
      { selector: '[data-testid="text-white-black"]', name: 'white-on-black' },
      { selector: '[data-testid="text-gray-white"]', name: 'gray-on-white' },
      { selector: '[data-testid="text-blue-white"]', name: 'blue-on-white' }
    ];

    const results = {
      passed: 0,
      failed: 0,
      newBaselines: 0,
      tests: []
    };

    for (const scenario of scenarios) {
      const result = await tester.captureElement(
        scenario.selector,
        scenario.name,
        { threshold: 0.05 }
      );

      if (result.passed) results.passed++;
      else if (result.isNewBaseline) results.newBaselines++;
      else results.failed++;

      results.tests.push(result);
    }

    tester.generateReport(results);
  });
});

/**
 * Utility: Update all baselines
 * Run this when you intentionally change the UI
 */
test.describe('Baseline Management', () => {
  test.skip('Update all baselines (run manually)', async ({ page }) => {
    // This test is skipped by default
    // Run with: npx playwright test --grep "Update all baselines"

    console.log('Updating all baselines...');

    // Navigate and capture all components
    await page.goto('http://localhost:3000/test-components');

    const tester = new VisualRegressionTester(page, 'baseline-update');

    // List all components to capture
    const components = [
      { selector: '[data-testid="button-primary"]', name: 'button-primary' },
      { selector: '[data-testid="button-secondary"]', name: 'button-secondary' },
      { selector: '[data-testid="button-danger"]', name: 'button-danger' },
      { selector: '[data-testid="login-form"]', name: 'login-form' }
    ];

    for (const component of components) {
      const screenshot = await page.locator(component.selector).screenshot();
      const baselinePath = join(BASELINE_DIR, `baseline-update__${component.name}.png`);
      writeFileSync(baselinePath, screenshot);
      console.log(`✓ Updated baseline: ${component.name}`);
    }

    console.log('All baselines updated successfully');
  });
});

export { VisualRegressionTester, BASELINE_DIR, DIFF_DIR, DIFF_THRESHOLD };
