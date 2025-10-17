/**
 * Typography Generator Unit Tests
 *
 * Tests modular type scale generation, line height calculations,
 * and typography constraint validation.
 */

import assert from 'assert';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import from the compiled MCP server
const constraintsPath = join(__dirname, '../../mcp-server/dist/constraints/typography.js');

let VALID_FONT_SIZES, FONT_WEIGHTS, TEXT_STYLES;
let isValidFontSize, snapToTypeScale, getRecommendedLineHeight, validateTypography;

/**
 * Load typography constraint utilities
 */
async function loadTypographyUtils() {
  try {
    const typographyModule = await import(constraintsPath);
    VALID_FONT_SIZES = typographyModule.VALID_FONT_SIZES;
    FONT_WEIGHTS = typographyModule.FONT_WEIGHTS;
    TEXT_STYLES = typographyModule.TEXT_STYLES;
    isValidFontSize = typographyModule.isValidFontSize;
    snapToTypeScale = typographyModule.snapToTypeScale;
    getRecommendedLineHeight = typographyModule.getRecommendedLineHeight;
    validateTypography = typographyModule.validateTypography;
  } catch (error) {
    throw new Error(`Failed to load typography utilities: ${error.message}. Ensure MCP server is built with 'npm run build' in mcp-server directory.`);
  }
}

/**
 * Test Suite: Valid Font Sizes
 */
function testValidFontSizes() {
  console.log('\n  Test: Valid Font Sizes');

  // Test that all expected sizes are in the scale
  const expectedSizes = [12, 16, 20, 24, 32, 40, 48, 64];
  assert.deepStrictEqual(
    [...VALID_FONT_SIZES],
    expectedSizes,
    'Font sizes should match modular type scale'
  );

  // Test that each size is recognized as valid
  expectedSizes.forEach(size => {
    assert.strictEqual(
      isValidFontSize(size),
      true,
      `${size}px should be a valid font size`
    );
  });

  // Test that invalid sizes are rejected
  const invalidSizes = [10, 13, 15, 18, 22, 30, 36, 50, 72];
  invalidSizes.forEach(size => {
    assert.strictEqual(
      isValidFontSize(size),
      false,
      `${size}px should not be a valid font size`
    );
  });

  console.log('    ✓ Type scale contains expected sizes: 12, 16, 20, 24, 32, 40, 48, 64');
  console.log('    ✓ Valid sizes are recognized correctly');
  console.log('    ✓ Invalid sizes are rejected');
}

/**
 * Test Suite: Font Weight Values
 */
function testFontWeights() {
  console.log('\n  Test: Font Weight Values');

  // Test that all standard font weights are available
  const expectedWeights = {
    thin: 100,
    extralight: 200,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900
  };

  Object.entries(expectedWeights).forEach(([name, value]) => {
    assert.strictEqual(
      FONT_WEIGHTS[name],
      value,
      `${name} should be ${value}`
    );
  });

  console.log('    ✓ All standard font weights are defined');
  console.log('    ✓ Font weight values are correct (100-900)');
}

/**
 * Test Suite: Snap to Type Scale
 */
function testSnapToTypeScale() {
  console.log('\n  Test: Snap to Type Scale');

  // Test snapping to nearest valid size
  assert.strictEqual(snapToTypeScale(11), 12, '11 should snap to 12');
  assert.strictEqual(snapToTypeScale(13), 12, '13 should snap to 12');
  assert.strictEqual(snapToTypeScale(14), 16, '14 should snap to 16');
  assert.strictEqual(snapToTypeScale(18), 20, '18 should snap to 20');
  // Note: 22 is equidistant from 20 and 24
  const snap22 = snapToTypeScale(22);
  assert.ok([20, 24].includes(snap22), `22 should snap to either 20 or 24, got ${snap22}`);
  assert.strictEqual(snapToTypeScale(26), 24, '26 should snap to 24');
  // Note: 28 is equidistant from 24 and 32
  const snap28 = snapToTypeScale(28);
  assert.ok([24, 32].includes(snap28), `28 should snap to either 24 or 32, got ${snap28}`);
  assert.strictEqual(snapToTypeScale(36), 40, '36 should snap to 40');
  assert.strictEqual(snapToTypeScale(44), 48, '44 should snap to 48');
  assert.strictEqual(snapToTypeScale(56), 64, '56 should snap to 64');

  // Test exact matches
  VALID_FONT_SIZES.forEach(size => {
    assert.strictEqual(
      snapToTypeScale(size),
      size,
      `${size} should snap to itself`
    );
  });

  // Test boundary cases
  assert.strictEqual(snapToTypeScale(1), 12, 'Very small value should snap to minimum (12)');
  assert.strictEqual(snapToTypeScale(100), 64, 'Very large value should snap to maximum (64)');
  assert.strictEqual(snapToTypeScale(0), 12, 'Zero should snap to minimum (12)');

  console.log('    ✓ Values snap to nearest valid size');
  console.log('    ✓ Exact matches remain unchanged');
  console.log('    ✓ Boundary cases handled correctly');
}

/**
 * Test Suite: Line Height Calculation
 */
function testLineHeightCalculation() {
  console.log('\n  Test: Line Height Calculation');

  // Test body text line heights (1.5x for sizes <= 20)
  assert.strictEqual(getRecommendedLineHeight(12), 18, '12px should have 18px line height (1.5x)');
  assert.strictEqual(getRecommendedLineHeight(16), 24, '16px should have 24px line height (1.5x)');
  assert.strictEqual(getRecommendedLineHeight(20), 30, '20px should have 30px line height (1.5x)');

  // Test heading line heights (1.2x for sizes > 20)
  assert.strictEqual(getRecommendedLineHeight(24), 29, '24px should have ~29px line height (1.2x)');
  assert.strictEqual(getRecommendedLineHeight(32), 38, '32px should have ~38px line height (1.2x)');
  assert.strictEqual(getRecommendedLineHeight(40), 48, '40px should have ~48px line height (1.2x)');
  assert.strictEqual(getRecommendedLineHeight(48), 58, '48px should have ~58px line height (1.2x)');
  assert.strictEqual(getRecommendedLineHeight(64), 77, '64px should have ~77px line height (1.2x)');

  // Verify line heights are always rounded to integers
  VALID_FONT_SIZES.forEach(size => {
    const lineHeight = getRecommendedLineHeight(size);
    assert.strictEqual(
      Number.isInteger(lineHeight),
      true,
      `Line height for ${size}px should be an integer`
    );
  });

  console.log('    ✓ Body text (≤20px) uses 1.5x line height');
  console.log('    ✓ Headings (>20px) use 1.2x line height');
  console.log('    ✓ Line heights are rounded to integers');
}

/**
 * Test Suite: Typography Validation - Valid Sizes
 */
function testTypographyValidationValid() {
  console.log('\n  Test: Typography Validation (Valid Sizes)');

  VALID_FONT_SIZES.forEach(size => {
    const result = validateTypography(size);

    assert.strictEqual(result.isValid, true, `${size}px should be valid`);
    assert.strictEqual(result.fontSize, size, `fontSize should be ${size}`);
    assert.ok(result.recommendedLineHeight, 'Should have recommended line height');
    assert.strictEqual(result.suggestedFontSize, undefined, 'Should not suggest alternative');
    assert.strictEqual(result.message, undefined, 'Should not have error message');

    // Verify line height is appropriate
    const expectedLineHeight = getRecommendedLineHeight(size);
    assert.strictEqual(
      result.recommendedLineHeight,
      expectedLineHeight,
      `Line height for ${size}px should match calculated value`
    );
  });

  console.log('    ✓ All valid font sizes pass validation');
  console.log('    ✓ Recommended line heights are provided');
  console.log('    ✓ No suggestions for valid sizes');
}

/**
 * Test Suite: Typography Validation - Invalid Sizes
 */
function testTypographyValidationInvalid() {
  console.log('\n  Test: Typography Validation (Invalid Sizes)');

  const testCases = [
    { input: 15, expected: 16 },
    { input: 18, expected: 20 },
    // Note: 22 is equidistant from 20 and 24, could be either
    { input: 22, expectedOptions: [20, 24] },
    { input: 30, expected: 32 },
    { input: 36, expected: 40 },
    { input: 50, expected: 48 }
  ];

  testCases.forEach(({ input, expected, expectedOptions }) => {
    const result = validateTypography(input);

    assert.strictEqual(result.isValid, false, `${input}px should be invalid`);
    assert.strictEqual(result.fontSize, input, `fontSize should be ${input}`);

    if (expectedOptions) {
      assert.ok(
        expectedOptions.includes(result.suggestedFontSize),
        `Should suggest one of ${expectedOptions.join(' or ')}px, got ${result.suggestedFontSize}px`
      );
    } else {
      assert.strictEqual(result.suggestedFontSize, expected, `Should suggest ${expected}px`);
    }

    assert.ok(result.message, 'Should have error message');
    assert.ok(result.message.includes(input.toString()), 'Message should mention input size');
    if (expected) {
      assert.ok(result.message.includes(expected.toString()), 'Message should mention suggested size');
    }

    // Verify line height is for the suggested size
    if (expected) {
      const expectedLineHeight = getRecommendedLineHeight(expected);
      assert.strictEqual(
        result.recommendedLineHeight,
        expectedLineHeight,
        `Line height should be for suggested size ${expected}px`
      );
    } else {
      // For equidistant cases, just verify line height exists
      assert.ok(result.recommendedLineHeight, 'Should have a recommended line height');
    }
  });

  console.log('    ✓ Invalid font sizes fail validation');
  console.log('    ✓ Appropriate alternatives are suggested');
  console.log('    ✓ Error messages are descriptive');
  console.log('    ✓ Line heights calculated for suggested sizes');
}

/**
 * Test Suite: Predefined Text Styles
 */
function testPredefinedTextStyles() {
  console.log('\n  Test: Predefined Text Styles');

  // Test that all expected text styles exist
  const expectedStyles = [
    'display-large',
    'display-medium',
    'heading-1',
    'heading-2',
    'heading-3',
    'body-large',
    'body-medium',
    'body-small'
  ];

  expectedStyles.forEach(styleName => {
    assert.ok(TEXT_STYLES[styleName], `${styleName} style should exist`);
    const style = TEXT_STYLES[styleName];

    // Validate structure
    assert.ok(style.fontSize, 'Style should have fontSize');
    assert.ok(style.fontWeight, 'Style should have fontWeight');
    assert.ok(style.lineHeight, 'Style should have lineHeight');

    // Validate fontSize is in the scale
    assert.ok(
      VALID_FONT_SIZES.includes(style.fontSize),
      `${styleName} fontSize should be in type scale`
    );

    // Validate fontWeight is valid
    const isValidWeight = Object.values(FONT_WEIGHTS).includes(style.fontWeight);
    assert.ok(isValidWeight, `${styleName} fontWeight should be valid`);

    // Validate lineHeight matches recommendation
    const expectedLineHeight = getRecommendedLineHeight(style.fontSize);
    assert.strictEqual(
      style.lineHeight,
      expectedLineHeight,
      `${styleName} lineHeight should match recommendation`
    );
  });

  // Test specific style values
  assert.strictEqual(TEXT_STYLES['display-large'].fontSize, 64, 'display-large should be 64px');
  assert.strictEqual(TEXT_STYLES['display-medium'].fontSize, 48, 'display-medium should be 48px');
  assert.strictEqual(TEXT_STYLES['heading-1'].fontSize, 40, 'heading-1 should be 40px');
  assert.strictEqual(TEXT_STYLES['heading-2'].fontSize, 32, 'heading-2 should be 32px');
  assert.strictEqual(TEXT_STYLES['heading-3'].fontSize, 24, 'heading-3 should be 24px');
  assert.strictEqual(TEXT_STYLES['body-large'].fontSize, 20, 'body-large should be 20px');
  assert.strictEqual(TEXT_STYLES['body-medium'].fontSize, 16, 'body-medium should be 16px');
  assert.strictEqual(TEXT_STYLES['body-small'].fontSize, 12, 'body-small should be 12px');

  console.log('    ✓ All expected text styles are defined');
  console.log('    ✓ Text styles use valid font sizes');
  console.log('    ✓ Text styles use valid font weights');
  console.log('    ✓ Line heights match recommendations');
}

/**
 * Test Suite: Scale Ratios
 */
function testScaleRatios() {
  console.log('\n  Test: Scale Ratios and Progression');

  // Calculate ratios between consecutive sizes
  const ratios = [];
  for (let i = 1; i < VALID_FONT_SIZES.length; i++) {
    const ratio = VALID_FONT_SIZES[i] / VALID_FONT_SIZES[i - 1];
    ratios.push(ratio);
  }

  // The scale should show consistent growth patterns
  // Smaller sizes: 12→16 (1.33x), 16→20 (1.25x)
  // Larger sizes: 24→32 (1.33x), 32→40 (1.25x), 40→48 (1.2x), 48→64 (1.33x)

  assert.ok(ratios[0] >= 1.2 && ratios[0] <= 1.4, 'First ratio should be reasonable');
  assert.ok(ratios[ratios.length - 1] >= 1.2 && ratios[ratios.length - 1] <= 1.4, 'Last ratio should be reasonable');

  // All ratios should be greater than 1 (increasing scale)
  ratios.forEach((ratio, index) => {
    assert.ok(ratio > 1, `Ratio ${index} should be greater than 1`);
    assert.ok(ratio < 2, `Ratio ${index} should be less than 2 (reasonable growth)`);
  });

  console.log('    ✓ Scale shows consistent growth pattern');
  console.log('    ✓ Ratios between sizes are reasonable (1.2x - 1.4x)');
  console.log('    ✓ Scale is monotonically increasing');
}

/**
 * Test Suite: Edge Cases
 */
function testEdgeCases() {
  console.log('\n  Test: Edge Cases');

  // Test minimum value snapping
  const minSnap = snapToTypeScale(-100);
  assert.strictEqual(minSnap, 12, 'Negative values should snap to minimum');

  // Test maximum value snapping
  const maxSnap = snapToTypeScale(1000);
  assert.strictEqual(maxSnap, 64, 'Very large values should snap to maximum');

  // Test floating point inputs
  const floatResult = validateTypography(16.5);
  assert.strictEqual(floatResult.isValid, false, 'Floating point should be invalid');
  assert.ok([16, 20].includes(floatResult.suggestedFontSize), 'Should suggest nearby integer size');

  // Test zero and negative
  const zeroSnap = snapToTypeScale(0);
  assert.strictEqual(zeroSnap, 12, 'Zero should snap to minimum');

  const negativeSnap = snapToTypeScale(-10);
  assert.strictEqual(negativeSnap, 12, 'Negative should snap to minimum');

  console.log('    ✓ Negative values snap to minimum');
  console.log('    ✓ Very large values snap to maximum');
  console.log('    ✓ Floating point inputs are handled');
  console.log('    ✓ Zero and negative inputs are handled');
}

/**
 * Test Suite: Consistency Checks
 */
function testConsistency() {
  console.log('\n  Test: Consistency Checks');

  // Test that validation and isValid agree
  VALID_FONT_SIZES.forEach(size => {
    const isValid = isValidFontSize(size);
    const validation = validateTypography(size);
    assert.strictEqual(
      isValid,
      validation.isValid,
      `isValidFontSize and validateTypography should agree for ${size}px`
    );
  });

  // Test that snapToTypeScale always returns a valid size
  const testValues = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70];
  testValues.forEach(value => {
    const snapped = snapToTypeScale(value);
    assert.ok(
      VALID_FONT_SIZES.includes(snapped),
      `Snapped value ${snapped} should be in valid scale`
    );
  });

  // Test that all text styles use valid combinations
  Object.entries(TEXT_STYLES).forEach(([name, style]) => {
    const fontSizeValid = isValidFontSize(style.fontSize);
    assert.ok(fontSizeValid, `${name} should use valid font size`);

    const lineHeightMatches = style.lineHeight === getRecommendedLineHeight(style.fontSize);
    assert.ok(lineHeightMatches, `${name} lineHeight should match recommendation`);
  });

  console.log('    ✓ isValidFontSize and validateTypography are consistent');
  console.log('    ✓ snapToTypeScale always returns valid sizes');
  console.log('    ✓ Predefined text styles use valid combinations');
}

/**
 * Run all typography generator tests
 */
async function runTests() {
  console.log('\n=== Typography Generator Unit Tests ===\n');

  try {
    // Load utilities
    console.log('Loading typography utilities from MCP server...');
    await loadTypographyUtils();
    console.log('✓ Typography utilities loaded successfully\n');

    // Run test suites
    testValidFontSizes();
    testFontWeights();
    testSnapToTypeScale();
    testLineHeightCalculation();
    testTypographyValidationValid();
    testTypographyValidationInvalid();
    testPredefinedTextStyles();
    testScaleRatios();
    testEdgeCases();
    testConsistency();

    console.log('\n=== All Typography Generator Tests Passed ===\n');
    console.log('Validated:');
    console.log('  ✓ Modular type scale contains correct sizes');
    console.log('  ✓ Font weights are properly defined');
    console.log('  ✓ Snapping to type scale works correctly');
    console.log('  ✓ Line height calculations are accurate');
    console.log('  ✓ Validation correctly identifies valid/invalid sizes');
    console.log('  ✓ Predefined text styles are complete and correct');
    console.log('  ✓ Scale ratios show reasonable progression');
    console.log('  ✓ Edge cases are handled properly');
    console.log('  ✓ All functions are internally consistent');
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
    console.log('Typography generator tests completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Typography generator tests failed:', error);
    process.exit(1);
  });
