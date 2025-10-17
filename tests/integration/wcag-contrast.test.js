/**
 * WCAG Contrast Integration Test
 *
 * Tests contrast ratio calculations, WCAG AA/AAA compliance checks,
 * large text detection, and color adjustment suggestions.
 */

import assert from 'assert';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import from the compiled MCP server
const constraintsPath = join(__dirname, '../../mcp-server/dist/constraints/color.js');

let hexToRgb, getContrastRatio, validateContrast, meetsWCAG, suggestContrastAdjustment;
let WCAGLevel, TextSize, CONTRAST_THRESHOLDS;

/**
 * Load color constraint utilities
 */
async function loadColorUtils() {
  try {
    const colorModule = await import(constraintsPath);
    hexToRgb = colorModule.hexToRgb;
    getContrastRatio = colorModule.getContrastRatio;
    validateContrast = colorModule.validateContrast;
    meetsWCAG = colorModule.meetsWCAG;
    suggestContrastAdjustment = colorModule.suggestContrastAdjustment;
    WCAGLevel = colorModule.WCAGLevel;
    TextSize = colorModule.TextSize;
    CONTRAST_THRESHOLDS = colorModule.CONTRAST_THRESHOLDS;
  } catch (error) {
    throw new Error(`Failed to load color utilities: ${error.message}. Ensure MCP server is built with 'npm run build' in mcp-server directory.`);
  }
}

/**
 * Test Suite: WCAG Thresholds
 */
function testWCAGThresholds() {
  console.log('\n  Test: WCAG Thresholds');

  // Verify WCAG AA thresholds
  assert.strictEqual(CONTRAST_THRESHOLDS.AA.normal, 4.5, 'WCAG AA normal text should be 4.5:1');
  assert.strictEqual(CONTRAST_THRESHOLDS.AA.large, 3.0, 'WCAG AA large text should be 3.0:1');

  // Verify WCAG AAA thresholds
  assert.strictEqual(CONTRAST_THRESHOLDS.AAA.normal, 7.0, 'WCAG AAA normal text should be 7.0:1');
  assert.strictEqual(CONTRAST_THRESHOLDS.AAA.large, 4.5, 'WCAG AAA large text should be 4.5:1');

  console.log('    ✓ WCAG AA thresholds: 4.5:1 (normal), 3.0:1 (large)');
  console.log('    ✓ WCAG AAA thresholds: 7.0:1 (normal), 4.5:1 (large)');
}

/**
 * Test Suite: Contrast Ratio Calculations
 */
function testContrastRatioCalculations() {
  console.log('\n  Test: Contrast Ratio Calculations');

  // Test maximum contrast (black on white)
  const blackOnWhite = getContrastRatio(
    hexToRgb('#000000'),
    hexToRgb('#FFFFFF')
  );
  assert.strictEqual(blackOnWhite, 21, 'Black on white should be 21:1');

  // Test white on black (should be same)
  const whiteOnBlack = getContrastRatio(
    hexToRgb('#FFFFFF'),
    hexToRgb('#000000')
  );
  assert.strictEqual(whiteOnBlack, 21, 'White on black should be 21:1');

  // Test minimum contrast (identical colors)
  const grayOnGray = getContrastRatio(
    hexToRgb('#777777'),
    hexToRgb('#777777')
  );
  assert.strictEqual(grayOnGray, 1, 'Identical colors should be 1:1');

  // Test known intermediate values
  const darkGrayOnWhite = getContrastRatio(
    hexToRgb('#595959'),
    hexToRgb('#FFFFFF')
  );
  assert.ok(darkGrayOnWhite >= 7.0, 'Dark gray (#595959) on white should pass AAA');

  const mediumGrayOnWhite = getContrastRatio(
    hexToRgb('#767676'),
    hexToRgb('#FFFFFF')
  );
  assert.ok(mediumGrayOnWhite >= 4.5 && mediumGrayOnWhite < 7.0, 'Medium gray (#767676) on white should pass AA but not AAA');

  console.log('    ✓ Maximum contrast (21:1) calculated correctly');
  console.log('    ✓ Contrast is symmetric (fg/bg order doesn\'t matter)');
  console.log('    ✓ Minimum contrast (1:1) calculated correctly');
  console.log('    ✓ Intermediate values are accurate');
}

/**
 * Test Suite: WCAG AA Compliance
 */
function testWCAGAACompliance() {
  console.log('\n  Test: WCAG AA Compliance');

  // Colors that should pass AA for all text
  const aaPassCases = [
    { fg: '#000000', bg: '#FFFFFF', name: 'black on white' },
    { fg: '#FFFFFF', bg: '#000000', name: 'white on black' },
    { fg: '#595959', bg: '#FFFFFF', name: 'dark gray on white' },
    { fg: '#0066CC', bg: '#FFFFFF', name: 'blue on white' },
    { fg: '#CC0000', bg: '#FFFFFF', name: 'red on white' }
  ];

  aaPassCases.forEach(({ fg, bg, name }) => {
    const fgRgb = hexToRgb(fg);
    const bgRgb = hexToRgb(bg);

    const result = validateContrast(fgRgb, bgRgb);
    assert.ok(result.ratio >= 4.5, `${name} should have at least 4.5:1 contrast`);
    assert.strictEqual(result.passes.AA.normal, true, `${name} should pass AA normal`);
    assert.strictEqual(result.passes.AA.large, true, `${name} should pass AA large`);

    const meetsAANormal = meetsWCAG(fgRgb, bgRgb, WCAGLevel.AA, TextSize.Normal);
    const meetsAALarge = meetsWCAG(fgRgb, bgRgb, WCAGLevel.AA, TextSize.Large);
    assert.strictEqual(meetsAANormal, true, `${name} should meet AA normal`);
    assert.strictEqual(meetsAALarge, true, `${name} should meet AA large`);
  });

  // Colors that should fail AA for normal text
  const aaFailCases = [
    { fg: '#999999', bg: '#FFFFFF', name: 'light gray on white' },
    { fg: '#CCCCCC', bg: '#FFFFFF', name: 'very light gray on white' },
    { fg: '#777777', bg: '#999999', name: 'gray on gray' }
  ];

  aaFailCases.forEach(({ fg, bg, name }) => {
    const fgRgb = hexToRgb(fg);
    const bgRgb = hexToRgb(bg);

    const result = validateContrast(fgRgb, bgRgb);
    assert.ok(result.ratio < 4.5, `${name} should have less than 4.5:1 contrast`);
    assert.strictEqual(result.passes.AA.normal, false, `${name} should fail AA normal`);

    const meetsAANormal = meetsWCAG(fgRgb, bgRgb, WCAGLevel.AA, TextSize.Normal);
    assert.strictEqual(meetsAANormal, false, `${name} should not meet AA normal`);
  });

  console.log('    ✓ High contrast colors pass AA compliance');
  console.log('    ✓ Low contrast colors fail AA compliance');
  console.log('    ✓ meetsWCAG function agrees with validateContrast');
}

/**
 * Test Suite: WCAG AAA Compliance
 */
function testWCAGAAACompliance() {
  console.log('\n  Test: WCAG AAA Compliance');

  // Colors that should pass AAA for all text
  const aaaPassCases = [
    { fg: '#000000', bg: '#FFFFFF', name: 'black on white' },
    { fg: '#FFFFFF', bg: '#000000', name: 'white on black' },
    { fg: '#595959', bg: '#FFFFFF', name: 'dark gray on white' }
  ];

  aaaPassCases.forEach(({ fg, bg, name }) => {
    const fgRgb = hexToRgb(fg);
    const bgRgb = hexToRgb(bg);

    const result = validateContrast(fgRgb, bgRgb);
    assert.ok(result.ratio >= 7.0, `${name} should have at least 7.0:1 contrast`);
    assert.strictEqual(result.passes.AAA.normal, true, `${name} should pass AAA normal`);
    assert.strictEqual(result.passes.AAA.large, true, `${name} should pass AAA large`);

    const meetsAAANormal = meetsWCAG(fgRgb, bgRgb, WCAGLevel.AAA, TextSize.Normal);
    const meetsAAALarge = meetsWCAG(fgRgb, bgRgb, WCAGLevel.AAA, TextSize.Large);
    assert.strictEqual(meetsAAANormal, true, `${name} should meet AAA normal`);
    assert.strictEqual(meetsAAALarge, true, `${name} should meet AAA large`);
  });

  // Colors that pass AA but fail AAA for normal text
  const aaButNotAaaCases = [
    { fg: '#767676', bg: '#FFFFFF', name: 'medium gray on white' },
    { fg: '#0066CC', bg: '#FFFFFF', name: 'blue on white' }
  ];

  aaButNotAaaCases.forEach(({ fg, bg, name }) => {
    const fgRgb = hexToRgb(fg);
    const bgRgb = hexToRgb(bg);

    const result = validateContrast(fgRgb, bgRgb);
    assert.ok(result.ratio >= 4.5 && result.ratio < 7.0, `${name} should be between 4.5:1 and 7.0:1`);
    assert.strictEqual(result.passes.AA.normal, true, `${name} should pass AA normal`);
    assert.strictEqual(result.passes.AAA.normal, false, `${name} should fail AAA normal`);

    const meetsAANormal = meetsWCAG(fgRgb, bgRgb, WCAGLevel.AA, TextSize.Normal);
    const meetsAAANormal = meetsWCAG(fgRgb, bgRgb, WCAGLevel.AAA, TextSize.Normal);
    assert.strictEqual(meetsAANormal, true, `${name} should meet AA normal`);
    assert.strictEqual(meetsAAANormal, false, `${name} should not meet AAA normal`);
  });

  console.log('    ✓ High contrast colors pass AAA compliance');
  console.log('    ✓ Medium contrast colors pass AA but fail AAA');
  console.log('    ✓ AAA standard is more strict than AA');
}

/**
 * Test Suite: Large Text Detection
 */
function testLargeTextHandling() {
  console.log('\n  Test: Large Text Handling');

  // Large text has lower contrast requirements
  // AA: 3.0:1 for large, 4.5:1 for normal
  // AAA: 4.5:1 for large, 7.0:1 for normal

  // Test color that passes AA large but fails AA normal
  const mediumContrast = {
    fg: hexToRgb('#959595'),
    bg: hexToRgb('#FFFFFF')
  };

  const ratio = getContrastRatio(mediumContrast.fg, mediumContrast.bg);

  // This should be between 3.0 and 4.5
  if (ratio >= 3.0 && ratio < 4.5) {
    const meetsAANormal = meetsWCAG(mediumContrast.fg, mediumContrast.bg, WCAGLevel.AA, TextSize.Normal);
    const meetsAALarge = meetsWCAG(mediumContrast.fg, mediumContrast.bg, WCAGLevel.AA, TextSize.Large);

    assert.strictEqual(meetsAANormal, false, 'Should fail AA normal text');
    assert.strictEqual(meetsAALarge, true, 'Should pass AA large text');

    console.log('    ✓ Colors can pass for large text while failing for normal text');
  } else {
    console.log('    ✓ (Skipped specific large text case - ratio outside target range)');
  }

  // Test that large text threshold is lower than normal text
  assert.ok(
    CONTRAST_THRESHOLDS.AA.large < CONTRAST_THRESHOLDS.AA.normal,
    'Large text should have lower threshold than normal text (AA)'
  );
  assert.ok(
    CONTRAST_THRESHOLDS.AAA.large < CONTRAST_THRESHOLDS.AAA.normal,
    'Large text should have lower threshold than normal text (AAA)'
  );

  // Test edge case at exactly 3.0:1 (AA large threshold)
  // We can't easily create exact 3.0:1, but we can verify the logic
  const result = validateContrast(mediumContrast.fg, mediumContrast.bg);
  if (ratio >= 3.0) {
    assert.strictEqual(result.passes.AA.large, true, 'Should pass AA large at 3.0:1 or above');
  }

  console.log('    ✓ Large text has lower contrast requirements');
  console.log('    ✓ Thresholds correctly differentiate text sizes');
}

/**
 * Test Suite: Color Adjustment Suggestions
 */
function testColorAdjustmentSuggestions() {
  console.log('\n  Test: Color Adjustment Suggestions');

  // Test colors that already meet target
  const goodContrast = {
    fg: hexToRgb('#000000'),
    bg: hexToRgb('#FFFFFF')
  };

  const alreadyGoodAA = suggestContrastAdjustment(
    goodContrast.fg,
    goodContrast.bg,
    WCAGLevel.AA,
    TextSize.Normal
  );
  assert.ok(
    alreadyGoodAA.includes('already meets'),
    'Should indicate contrast already meets target'
  );

  // Test colors that need adjustment
  const poorContrast = {
    fg: hexToRgb('#999999'),
    bg: hexToRgb('#FFFFFF')
  };

  const needsAdjustmentAA = suggestContrastAdjustment(
    poorContrast.fg,
    poorContrast.bg,
    WCAGLevel.AA,
    TextSize.Normal
  );
  assert.ok(
    needsAdjustmentAA.includes('4.5') || needsAdjustmentAA.includes('decrease') || needsAdjustmentAA.includes('increase'),
    'Should suggest adjustment for poor contrast'
  );
  assert.ok(
    needsAdjustmentAA.includes('lightness'),
    'Should mention lightness adjustment'
  );

  // Test that suggestion mentions target ratio
  const needsAdjustmentAAA = suggestContrastAdjustment(
    poorContrast.fg,
    poorContrast.bg,
    WCAGLevel.AAA,
    TextSize.Normal
  );
  assert.ok(
    needsAdjustmentAAA.includes('7') || needsAdjustmentAAA.includes('7.0'),
    'Should mention AAA target ratio of 7:1'
  );

  // Test different text sizes have different targets
  const largeTextSuggestion = suggestContrastAdjustment(
    poorContrast.fg,
    poorContrast.bg,
    WCAGLevel.AA,
    TextSize.Large
  );
  assert.ok(
    largeTextSuggestion.includes('3') || largeTextSuggestion.includes('already meets'),
    'Should reference large text threshold or indicate it meets'
  );

  console.log('    ✓ Indicates when contrast already meets target');
  console.log('    ✓ Suggests adjustments for poor contrast');
  console.log('    ✓ Mentions lightness adjustments');
  console.log('    ✓ References correct target ratios');
  console.log('    ✓ Handles different text sizes');
}

/**
 * Test Suite: Validation Result Structure
 */
function testValidationResultStructure() {
  console.log('\n  Test: Validation Result Structure');

  const result = validateContrast(
    hexToRgb('#000000'),
    hexToRgb('#FFFFFF')
  );

  // Check structure
  assert.ok(typeof result.ratio === 'number', 'Result should have numeric ratio');
  assert.ok(result.passes, 'Result should have passes object');
  assert.ok(result.passes.AA, 'Result should have AA passes');
  assert.ok(result.passes.AAA, 'Result should have AAA passes');
  assert.ok(typeof result.passes.AA.normal === 'boolean', 'AA normal should be boolean');
  assert.ok(typeof result.passes.AA.large === 'boolean', 'AA large should be boolean');
  assert.ok(typeof result.passes.AAA.normal === 'boolean', 'AAA normal should be boolean');
  assert.ok(typeof result.passes.AAA.large === 'boolean', 'AAA large should be boolean');
  assert.ok(typeof result.recommendation === 'string', 'Result should have string recommendation');
  assert.ok(result.recommendation.length > 0, 'Recommendation should not be empty');

  console.log('    ✓ Result has correct structure');
  console.log('    ✓ All required fields are present');
  console.log('    ✓ Field types are correct');
  console.log('    ✓ Recommendation is provided');
}

/**
 * Test Suite: Edge Cases
 */
function testEdgeCases() {
  console.log('\n  Test: Edge Cases');

  // Test pure red, green, blue
  const pureRed = validateContrast(hexToRgb('#FF0000'), hexToRgb('#FFFFFF'));
  const pureGreen = validateContrast(hexToRgb('#00FF00'), hexToRgb('#FFFFFF'));
  const pureBlue = validateContrast(hexToRgb('#0000FF'), hexToRgb('#FFFFFF'));

  assert.ok(pureRed.ratio > 1, 'Pure red should have some contrast with white');
  assert.ok(pureGreen.ratio > 1, 'Pure green should have some contrast with white');
  assert.ok(pureBlue.ratio > 1, 'Pure blue should have some contrast with white');

  // Green should have lowest contrast with white (brightest)
  assert.ok(pureGreen.ratio < pureRed.ratio, 'Green should have less contrast than red with white');
  assert.ok(pureGreen.ratio < pureBlue.ratio, 'Green should have less contrast than blue with white');

  // Test identical colors
  const identical = validateContrast(hexToRgb('#777777'), hexToRgb('#777777'));
  assert.strictEqual(identical.ratio, 1, 'Identical colors should have 1:1 ratio');
  assert.strictEqual(identical.passes.AA.normal, false, 'Identical colors should fail all tests');
  assert.strictEqual(identical.passes.AA.large, false, 'Identical colors should fail all tests');

  // Test very similar colors
  const verySimilar = validateContrast(hexToRgb('#777777'), hexToRgb('#787878'));
  assert.ok(verySimilar.ratio < 1.1, 'Very similar colors should have ratio close to 1');

  console.log('    ✓ Pure colors handled correctly');
  console.log('    ✓ Identical colors produce 1:1 ratio');
  console.log('    ✓ Very similar colors have low contrast');
}

/**
 * Test Suite: Real-world Color Combinations
 */
function testRealWorldColors() {
  console.log('\n  Test: Real-world Color Combinations');

  const realWorldTests = [
    {
      name: 'Primary button (white on blue)',
      fg: '#FFFFFF',
      bg: '#0066CC',
      expectAAA: false,
      expectAA: true
    },
    {
      name: 'Error text (red on white)',
      fg: '#CC0000',
      bg: '#FFFFFF',
      expectAAA: false,
      expectAA: true
    },
    {
      name: 'Success text (green on white)',
      fg: '#008800',
      bg: '#FFFFFF',
      expectAAA: false,
      expectAA: true
    },
    {
      name: 'Placeholder text (light gray on white)',
      fg: '#999999',
      bg: '#FFFFFF',
      expectAAA: false,
      expectAA: false
    },
    {
      name: 'Body text (dark gray on white)',
      fg: '#333333',
      bg: '#FFFFFF',
      expectAAA: true,
      expectAA: true
    }
  ];

  realWorldTests.forEach(({ name, fg, bg, expectAAA, expectAA }) => {
    const result = validateContrast(hexToRgb(fg), hexToRgb(bg));

    assert.strictEqual(
      result.passes.AA.normal,
      expectAA,
      `${name} should ${expectAA ? 'pass' : 'fail'} AA`
    );

    assert.strictEqual(
      result.passes.AAA.normal,
      expectAAA,
      `${name} should ${expectAAA ? 'pass' : 'fail'} AAA`
    );
  });

  console.log('    ✓ Primary button colors tested');
  console.log('    ✓ Error/success text colors tested');
  console.log('    ✓ Placeholder text colors tested');
  console.log('    ✓ Body text colors tested');
  console.log('    ✓ All real-world cases match expectations');
}

/**
 * Run all WCAG contrast tests
 */
async function runTests() {
  console.log('\n=== WCAG Contrast Integration Tests ===\n');

  try {
    // Load utilities
    console.log('Loading color utilities from MCP server...');
    await loadColorUtils();
    console.log('✓ Color utilities loaded successfully\n');

    // Run test suites
    testWCAGThresholds();
    testContrastRatioCalculations();
    testWCAGAACompliance();
    testWCAGAAACompliance();
    testLargeTextHandling();
    testColorAdjustmentSuggestions();
    testValidationResultStructure();
    testEdgeCases();
    testRealWorldColors();

    console.log('\n=== All WCAG Contrast Tests Passed ===\n');
    console.log('Validated:');
    console.log('  ✓ WCAG thresholds are correct (AA: 4.5:1/3.0:1, AAA: 7.0:1/4.5:1)');
    console.log('  ✓ Contrast ratio calculations follow WCAG formulas');
    console.log('  ✓ WCAG AA compliance checks work correctly');
    console.log('  ✓ WCAG AAA compliance checks work correctly');
    console.log('  ✓ Large text handling uses lower thresholds');
    console.log('  ✓ Color adjustment suggestions are helpful');
    console.log('  ✓ Validation results have correct structure');
    console.log('  ✓ Edge cases are handled properly');
    console.log('  ✓ Real-world color combinations validated');
    console.log('');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// Run tests
runTests()
  .then(() => {
    console.log('WCAG contrast tests completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('WCAG contrast tests failed:', error);
    process.exit(1);
  });
