/**
 * Design Token Validation Test Suite
 *
 * Comprehensive tests for validating design tokens against design system constraints:
 * - Spacing values against 8pt grid
 * - Typography sizes against type scale
 * - Color pairs for WCAG compliance
 * - Token export formats (CSS, Tailwind, JSON)
 * - Edge cases and boundary values
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import assert from 'assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const MCP_SERVER_DIR = join(__dirname, '../../mcp-server');
const WEBSOCKET_SERVER_DIR = join(__dirname, '../../websocket-server');
const SERVER_PORT = 8080;

/**
 * Sends a command to the MCP server via WebSocket bridge
 */
async function sendMcpCommand(toolName, args) {
  return new Promise((resolve, reject) => {
    const mcpClient = spawn('node', [join(MCP_SERVER_DIR, 'dist/index.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        WEBSOCKET_URL: `ws://localhost:${SERVER_PORT}`
      }
    });

    let output = '';
    let errorOutput = '';

    mcpClient.stdout.on('data', (data) => {
      output += data.toString();
    });

    mcpClient.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    mcpClient.on('exit', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          resolve({ output, errorOutput });
        }
      } else {
        reject(new Error(`MCP command failed: ${errorOutput}`));
      }
    });

    // Send the tool invocation command
    const command = JSON.stringify({
      type: 'tool_call',
      tool: toolName,
      arguments: args
    });

    mcpClient.stdin.write(command + '\n');
    mcpClient.stdin.end();

    // Timeout after 10 seconds
    setTimeout(() => {
      mcpClient.kill();
      reject(new Error('Command timeout'));
    }, 10000);
  });
}

/**
 * Test Suite: Spacing Validation (8pt Grid)
 */
async function testSpacingValidation() {
  console.log('\n=== Test Suite: Spacing Validation (8pt Grid) ===\n');

  const tests = [
    {
      name: 'Valid spacing values should pass',
      spacing: [0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128],
      expectedValid: 13,
      expectedInvalid: 0
    },
    {
      name: 'Invalid spacing values should fail with suggestions',
      spacing: [5, 10, 15, 20, 25],
      expectedValid: 0,
      expectedInvalid: 5
    },
    {
      name: 'Mixed valid and invalid spacing',
      spacing: [8, 10, 16, 20, 24],
      expectedValid: 3,
      expectedInvalid: 2
    },
    {
      name: 'Edge case: zero spacing',
      spacing: [0],
      expectedValid: 1,
      expectedInvalid: 0
    },
    {
      name: 'Edge case: maximum spacing',
      spacing: [128],
      expectedValid: 1,
      expectedInvalid: 0
    },
    {
      name: 'Boundary values near valid spacing',
      spacing: [7, 8, 9, 15, 16, 17],
      expectedValid: 2, // Only 8 and 16
      expectedInvalid: 4
    }
  ];

  let passedTests = 0;
  let failedTests = 0;

  for (const test of tests) {
    try {
      console.log(`Test: ${test.name}`);
      console.log(`  Input: [${test.spacing.join(', ')}]`);

      const result = await sendMcpCommand('validate_design_tokens', {
        spacing: test.spacing
      });

      // Parse result
      assert.ok(result.spacing, 'Should have spacing validation results');
      assert.strictEqual(result.spacing.valid, test.expectedValid,
        `Expected ${test.expectedValid} valid, got ${result.spacing.valid}`);
      assert.strictEqual(result.spacing.invalid, test.expectedInvalid,
        `Expected ${test.expectedInvalid} invalid, got ${result.spacing.invalid}`);

      // Verify suggestions for invalid values
      if (test.expectedInvalid > 0) {
        const invalidResults = result.spacing.results.filter(r => !r.isValid);
        for (const invalid of invalidResults) {
          assert.ok(invalid.suggestedValue !== undefined,
            `Invalid value ${invalid.value} should have suggested value`);
          assert.ok([0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128].includes(invalid.suggestedValue),
            `Suggested value ${invalid.suggestedValue} should be valid`);
        }
      }

      console.log(`  ✓ PASS\n`);
      passedTests++;
    } catch (error) {
      console.error(`  ✗ FAIL: ${error.message}\n`);
      failedTests++;
    }
  }

  return { passed: passedTests, failed: failedTests };
}

/**
 * Test Suite: Typography Validation (Type Scale)
 */
async function testTypographyValidation() {
  console.log('\n=== Test Suite: Typography Validation (Type Scale) ===\n');

  const tests = [
    {
      name: 'Valid font sizes should pass',
      typography: [
        { fontSize: 12 },
        { fontSize: 16 },
        { fontSize: 20 },
        { fontSize: 24 },
        { fontSize: 32 },
        { fontSize: 40 },
        { fontSize: 48 },
        { fontSize: 64 }
      ],
      expectedValid: 8,
      expectedInvalid: 0
    },
    {
      name: 'Invalid font sizes should fail with suggestions',
      typography: [
        { fontSize: 14, name: 'small-text' },
        { fontSize: 18, name: 'medium-text' },
        { fontSize: 28, name: 'large-text' }
      ],
      expectedValid: 0,
      expectedInvalid: 3
    },
    {
      name: 'Mixed valid and invalid typography',
      typography: [
        { fontSize: 16, name: 'body' },
        { fontSize: 18, name: 'invalid' },
        { fontSize: 24, name: 'heading' }
      ],
      expectedValid: 2,
      expectedInvalid: 1
    },
    {
      name: 'Edge case: smallest font size',
      typography: [{ fontSize: 12, name: 'caption' }],
      expectedValid: 1,
      expectedInvalid: 0
    },
    {
      name: 'Edge case: largest font size',
      typography: [{ fontSize: 64, name: 'display' }],
      expectedValid: 1,
      expectedInvalid: 0
    },
    {
      name: 'Boundary values should snap to nearest',
      typography: [
        { fontSize: 15 }, // Should suggest 16
        { fontSize: 17 }, // Should suggest 16
        { fontSize: 22 }, // Should suggest 20 or 24
        { fontSize: 36 }  // Should suggest 32 or 40
      ],
      expectedValid: 0,
      expectedInvalid: 4
    }
  ];

  let passedTests = 0;
  let failedTests = 0;

  for (const test of tests) {
    try {
      console.log(`Test: ${test.name}`);
      console.log(`  Input: ${test.typography.length} font sizes`);

      const result = await sendMcpCommand('validate_design_tokens', {
        typography: test.typography
      });

      assert.ok(result.typography, 'Should have typography validation results');
      assert.strictEqual(result.typography.valid, test.expectedValid,
        `Expected ${test.expectedValid} valid, got ${result.typography.valid}`);
      assert.strictEqual(result.typography.invalid, test.expectedInvalid,
        `Expected ${test.expectedInvalid} invalid, got ${result.typography.invalid}`);

      // Verify suggestions and line heights
      for (const typoResult of result.typography.results) {
        if (!typoResult.isValid) {
          assert.ok(typoResult.suggestedFontSize !== undefined,
            `Invalid fontSize ${typoResult.fontSize} should have suggestion`);
        }
        assert.ok(typoResult.recommendedLineHeight !== undefined,
          'Should have recommended line height');
      }

      console.log(`  ✓ PASS\n`);
      passedTests++;
    } catch (error) {
      console.error(`  ✗ FAIL: ${error.message}\n`);
      failedTests++;
    }
  }

  return { passed: passedTests, failed: failedTests };
}

/**
 * Test Suite: Color Contrast Validation (WCAG)
 */
async function testColorContrastValidation() {
  console.log('\n=== Test Suite: Color Contrast Validation (WCAG) ===\n');

  const tests = [
    {
      name: 'High contrast should pass AAA',
      colors: [
        { foreground: '#000000', background: '#FFFFFF', name: 'black-on-white' },
        { foreground: '#FFFFFF', background: '#000000', name: 'white-on-black' }
      ],
      expectedPassAA: 2,
      expectedPassAAA: 2
    },
    {
      name: 'Medium contrast should pass AA but not AAA',
      colors: [
        { foreground: '#595959', background: '#FFFFFF', name: 'gray-on-white' },
        { foreground: '#767676', background: '#FFFFFF', name: 'light-gray-on-white' }
      ],
      expectedPassAA: 1, // Only #595959 passes AA (4.5:1)
      expectedPassAAA: 0
    },
    {
      name: 'Low contrast should fail both',
      colors: [
        { foreground: '#CCCCCC', background: '#FFFFFF', name: 'poor-contrast' },
        { foreground: '#E0E0E0', background: '#FFFFFF', name: 'very-poor-contrast' }
      ],
      expectedPassAA: 0,
      expectedPassAAA: 0
    },
    {
      name: 'Brand colors should be validated',
      colors: [
        { foreground: '#0066CC', background: '#FFFFFF', name: 'primary-blue' },
        { foreground: '#FFFFFF', background: '#0066CC', name: 'inverse-primary' },
        { foreground: '#FF5733', background: '#FFFFFF', name: 'accent-red' }
      ],
      expectedPassAA: 2, // Blue on white and white on blue should pass
      expectedPassAAA: 0
    },
    {
      name: 'Edge case: identical colors',
      colors: [
        { foreground: '#808080', background: '#808080', name: 'same-color' }
      ],
      expectedPassAA: 0,
      expectedPassAAA: 0
    }
  ];

  let passedTests = 0;
  let failedTests = 0;

  for (const test of tests) {
    try {
      console.log(`Test: ${test.name}`);
      console.log(`  Input: ${test.colors.length} color pairs`);

      const result = await sendMcpCommand('validate_design_tokens', {
        colors: test.colors
      });

      assert.ok(result.colors, 'Should have color validation results');
      assert.strictEqual(result.colors.passesAA, test.expectedPassAA,
        `Expected ${test.expectedPassAA} AA passes, got ${result.colors.passesAA}`);
      assert.strictEqual(result.colors.passesAAA, test.expectedPassAAA,
        `Expected ${test.expectedPassAAA} AAA passes, got ${result.colors.passesAAA}`);

      // Verify all results have ratios and recommendations
      for (const colorResult of result.colors.results) {
        assert.ok(colorResult.ratio > 0, 'Should have contrast ratio');
        assert.ok(colorResult.recommendation, 'Should have recommendation');
        assert.ok(typeof colorResult.passesAA === 'boolean', 'Should have AA pass status');
        assert.ok(typeof colorResult.passesAAA === 'boolean', 'Should have AAA pass status');
      }

      console.log(`  ✓ PASS\n`);
      passedTests++;
    } catch (error) {
      console.error(`  ✗ FAIL: ${error.message}\n`);
      failedTests++;
    }
  }

  return { passed: passedTests, failed: failedTests };
}

/**
 * Test Suite: Comprehensive Validation Report
 */
async function testComprehensiveValidation() {
  console.log('\n=== Test Suite: Comprehensive Validation Report ===\n');

  try {
    console.log('Test: Full design system validation');

    const result = await sendMcpCommand('validate_design_tokens', {
      spacing: [0, 8, 10, 16, 24, 32, 50, 64],
      typography: [
        { fontSize: 12, name: 'caption' },
        { fontSize: 14, name: 'small' },
        { fontSize: 16, name: 'body' },
        { fontSize: 24, name: 'heading' }
      ],
      colors: [
        { foreground: '#000000', background: '#FFFFFF', name: 'text-primary' },
        { foreground: '#CCCCCC', background: '#FFFFFF', name: 'text-disabled' },
        { foreground: '#FFFFFF', background: '#0066CC', name: 'button-primary' }
      ]
    });

    // Verify comprehensive report structure
    assert.ok(result.spacing, 'Should have spacing section');
    assert.ok(result.typography, 'Should have typography section');
    assert.ok(result.colors, 'Should have colors section');
    assert.ok(result.summary, 'Should have summary section');

    // Verify summary structure
    assert.ok(typeof result.summary.allValid === 'boolean', 'Summary should have allValid flag');
    assert.ok(Array.isArray(result.summary.issues), 'Summary should have issues array');
    assert.ok(Array.isArray(result.summary.recommendations), 'Summary should have recommendations array');

    // Verify that invalid items generate issues
    assert.ok(result.summary.issues.length > 0, 'Should have issues for invalid tokens');
    assert.ok(result.summary.recommendations.length > 0, 'Should have recommendations');

    console.log(`  ✓ PASS\n`);
    return { passed: 1, failed: 0 };
  } catch (error) {
    console.error(`  ✗ FAIL: ${error.message}\n`);
    return { passed: 0, failed: 1 };
  }
}

/**
 * Test Suite: Token Export Formats
 */
async function testTokenExportFormats() {
  console.log('\n=== Test Suite: Token Export Formats ===\n');

  const tests = [
    {
      name: 'Validation report should be machine-readable JSON',
      test: async () => {
        const result = await sendMcpCommand('validate_design_tokens', {
          spacing: [8, 16, 24]
        });

        // Verify structure can be serialized/deserialized
        const serialized = JSON.stringify(result);
        const deserialized = JSON.parse(serialized);

        assert.deepStrictEqual(result, deserialized, 'Should serialize correctly');
      }
    },
    {
      name: 'Validation results should support CSS variable format',
      test: async () => {
        const result = await sendMcpCommand('validate_design_tokens', {
          spacing: [8, 16, 24, 32]
        });

        // Verify we can generate CSS variables from valid tokens
        const validSpacing = result.spacing.results.filter(r => r.isValid);
        const cssVars = validSpacing.map(r => `--spacing-${r.value}: ${r.value}px;`);

        assert.ok(cssVars.length === 4, 'Should generate CSS variables');
        assert.ok(cssVars[0].includes('--spacing-8'), 'Should have correct CSS variable name');
      }
    },
    {
      name: 'Validation results should support Tailwind config format',
      test: async () => {
        const result = await sendMcpCommand('validate_design_tokens', {
          spacing: [8, 16, 24]
        });

        // Verify we can generate Tailwind config from valid tokens
        const validSpacing = result.spacing.results.filter(r => r.isValid);
        const tailwindSpacing = Object.fromEntries(
          validSpacing.map(r => [r.value, `${r.value}px`])
        );

        assert.ok(tailwindSpacing[8] === '8px', 'Should have Tailwind format');
        assert.ok(Object.keys(tailwindSpacing).length === 3, 'Should have all values');
      }
    }
  ];

  let passedTests = 0;
  let failedTests = 0;

  for (const test of tests) {
    try {
      console.log(`Test: ${test.name}`);
      await test.test();
      console.log(`  ✓ PASS\n`);
      passedTests++;
    } catch (error) {
      console.error(`  ✗ FAIL: ${error.message}\n`);
      failedTests++;
    }
  }

  return { passed: passedTests, failed: failedTests };
}

/**
 * Run all design token validation tests
 */
async function runAllTests() {
  console.log('\n========================================');
  console.log('Design Token Validation Test Suite');
  console.log('========================================');

  const results = {
    totalPassed: 0,
    totalFailed: 0,
    suites: []
  };

  // Run all test suites
  const spacingResults = await testSpacingValidation();
  results.totalPassed += spacingResults.passed;
  results.totalFailed += spacingResults.failed;
  results.suites.push({ name: 'Spacing Validation', ...spacingResults });

  const typographyResults = await testTypographyValidation();
  results.totalPassed += typographyResults.passed;
  results.totalFailed += typographyResults.failed;
  results.suites.push({ name: 'Typography Validation', ...typographyResults });

  const colorResults = await testColorContrastValidation();
  results.totalPassed += colorResults.passed;
  results.totalFailed += colorResults.failed;
  results.suites.push({ name: 'Color Contrast Validation', ...colorResults });

  const comprehensiveResults = await testComprehensiveValidation();
  results.totalPassed += comprehensiveResults.passed;
  results.totalFailed += comprehensiveResults.failed;
  results.suites.push({ name: 'Comprehensive Validation', ...comprehensiveResults });

  const exportResults = await testTokenExportFormats();
  results.totalPassed += exportResults.passed;
  results.totalFailed += exportResults.failed;
  results.suites.push({ name: 'Token Export Formats', ...exportResults });

  // Print summary
  console.log('\n========================================');
  console.log('Test Summary');
  console.log('========================================\n');

  for (const suite of results.suites) {
    const status = suite.failed === 0 ? '✓' : '✗';
    console.log(`${status} ${suite.name}: ${suite.passed} passed, ${suite.failed} failed`);
  }

  console.log(`\nTotal: ${results.totalPassed} passed, ${results.totalFailed} failed`);
  console.log('========================================\n');

  return results.totalFailed === 0;
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { runAllTests };
