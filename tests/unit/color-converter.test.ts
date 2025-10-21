/**
 * Color Converter Unit Tests
 *
 * Tests RGB ↔ Hex conversions, luminance calculations, and color utilities
 * from the color constraints module.
 */

import assert from 'assert';
import {
    getContrastRatio,
    getRelativeLuminance,
    hexToRgb,
    rgbToHex,
    validateContrast,
    type ContrastValidationResult
} from '../../mcp-server/src/constraints/color.js';

/**
 * Test Suite: Hex to RGB Conversion
 */
function testHexToRgb(): void {
  console.log('\n  Test: Hex to RGB Conversion');

  // Test basic colors
  const black = hexToRgb('#000000');
  assert.deepStrictEqual(black, { r: 0, g: 0, b: 0 }, 'Black should be (0, 0, 0)');

  const white = hexToRgb('#FFFFFF');
  assert.deepStrictEqual(white, { r: 255, g: 255, b: 255 }, 'White should be (255, 255, 255)');

  const red = hexToRgb('#FF0000');
  assert.deepStrictEqual(red, { r: 255, g: 0, b: 0 }, 'Red should be (255, 0, 0)');

  const green = hexToRgb('#00FF00');
  assert.deepStrictEqual(green, { r: 0, g: 255, b: 0 }, 'Green should be (0, 255, 0)');

  const blue = hexToRgb('#0000FF');
  assert.deepStrictEqual(blue, { r: 0, g: 0, b: 255 }, 'Blue should be (0, 0, 255)');

  // Test with lowercase
  const gray = hexToRgb('#808080');
  assert.deepStrictEqual(gray, { r: 128, g: 128, b: 128 }, 'Gray should be (128, 128, 128)');

  // Test without # prefix
  const purple = hexToRgb('800080');
  assert.deepStrictEqual(purple, { r: 128, g: 0, b: 128 }, 'Purple should work without # prefix');

  // Test case insensitivity
  const teal = hexToRgb('#00fFfF');
  assert.deepStrictEqual(teal, { r: 0, g: 255, b: 255 }, 'Should handle mixed case');

  console.log('    ✓ Basic color conversions work');
  console.log('    ✓ Lowercase hex values work');
  console.log('    ✓ Hex without # prefix works');
  console.log('    ✓ Case insensitive parsing works');
}

/**
 * Test Suite: RGB to Hex Conversion
 */
function testRgbToHex(): void {
  console.log('\n  Test: RGB to Hex Conversion');

  // Test basic colors
  assert.strictEqual(rgbToHex({ r: 0, g: 0, b: 0 }), '#000000', 'Black should be #000000');
  assert.strictEqual(rgbToHex({ r: 255, g: 255, b: 255 }), '#ffffff', 'White should be #ffffff');
  assert.strictEqual(rgbToHex({ r: 255, g: 0, b: 0 }), '#ff0000', 'Red should be #ff0000');
  assert.strictEqual(rgbToHex({ r: 0, g: 255, b: 0 }), '#00ff00', 'Green should be #00ff00');
  assert.strictEqual(rgbToHex({ r: 0, g: 0, b: 255 }), '#0000ff', 'Blue should be #0000ff');

  // Test intermediate values
  assert.strictEqual(rgbToHex({ r: 128, g: 128, b: 128 }), '#808080', 'Gray should be #808080');
  assert.strictEqual(rgbToHex({ r: 128, g: 0, b: 128 }), '#800080', 'Purple should be #800080');

  // Test rounding behavior
  assert.strictEqual(rgbToHex({ r: 127.4, g: 127.4, b: 127.4 }), '#7f7f7f', 'Should round down');
  assert.strictEqual(rgbToHex({ r: 127.6, g: 127.6, b: 127.6 }), '#808080', 'Should round up');

  console.log('    ✓ Basic color conversions work');
  console.log('    ✓ Intermediate values work');
  console.log('    ✓ Rounding behavior is correct');
}

/**
 * Test Suite: Round-trip Conversion
 */
function testRoundTripConversion(): void {
  console.log('\n  Test: Round-trip Conversion (Hex → RGB → Hex)');

  const testColors: string[] = [
    '#000000',
    '#FFFFFF',
    '#FF0000',
    '#00FF00',
    '#0000FF',
    '#808080',
    '#ABCDEF',
    '#123456',
    '#FEDCBA'
  ];

  testColors.forEach(originalHex => {
    const rgb = hexToRgb(originalHex);
    if (!rgb) {
      assert.fail(`Failed to convert ${originalHex} to RGB`);
    }
    const convertedHex = rgbToHex(rgb);
    assert.strictEqual(
      convertedHex.toLowerCase(),
      originalHex.toLowerCase(),
      `Round-trip conversion should preserve ${originalHex}`
    );
  });

  console.log('    ✓ Round-trip conversions preserve color values');
}

/**
 * Test Suite: Invalid Hex Input
 */
function testInvalidHexInput(): void {
  console.log('\n  Test: Invalid Hex Input Handling');

  // Invalid formats should return null
  assert.strictEqual(hexToRgb(''), null, 'Empty string should return null');
  assert.strictEqual(hexToRgb('#FFF'), null, 'Short format should return null');
  assert.strictEqual(hexToRgb('#GGGGGG'), null, 'Invalid characters should return null');
  assert.strictEqual(hexToRgb('not-a-color'), null, 'Invalid format should return null');
  assert.strictEqual(hexToRgb('#12345'), null, 'Incomplete hex should return null');
  assert.strictEqual(hexToRgb('#1234567'), null, 'Too long hex should return null');

  console.log('    ✓ Invalid formats return null');
  console.log('    ✓ Edge cases handled gracefully');
}

/**
 * Test Suite: Relative Luminance Calculation
 */
function testRelativeLuminance(): void {
  console.log('\n  Test: Relative Luminance Calculation');

  // Test known luminance values
  const blackLum = getRelativeLuminance({ r: 0, g: 0, b: 0 });
  assert.strictEqual(blackLum, 0, 'Black luminance should be 0');

  const whiteLum = getRelativeLuminance({ r: 255, g: 255, b: 255 });
  assert.strictEqual(whiteLum, 1, 'White luminance should be 1');

  // Test that red, green, blue have different luminances (green is brightest to human eye)
  const redLum = getRelativeLuminance({ r: 255, g: 0, b: 0 });
  const greenLum = getRelativeLuminance({ r: 0, g: 255, b: 0 });
  const blueLum = getRelativeLuminance({ r: 0, g: 0, b: 255 });

  assert.ok(greenLum > redLum, 'Green should have higher luminance than red');
  assert.ok(redLum > blueLum, 'Red should have higher luminance than blue');
  assert.ok(greenLum > blueLum, 'Green should have higher luminance than blue');

  // Test that luminance is always between 0 and 1
  const grayLum = getRelativeLuminance({ r: 128, g: 128, b: 128 });
  assert.ok(grayLum > 0 && grayLum < 1, 'Gray luminance should be between 0 and 1');

  console.log('    ✓ Black and white luminance values are correct');
  console.log('    ✓ Luminance ordering matches human perception (green > red > blue)');
  console.log('    ✓ Luminance values are within valid range [0, 1]');
}

/**
 * Test Suite: Contrast Ratio Calculation
 */
function testContrastRatio(): void {
  console.log('\n  Test: Contrast Ratio Calculation');

  // Test maximum contrast (black on white)
  const maxContrast = getContrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
  assert.strictEqual(maxContrast, 21, 'Black on white should have 21:1 contrast');

  // Test minimum contrast (same color)
  const minContrast = getContrastRatio({ r: 128, g: 128, b: 128 }, { r: 128, g: 128, b: 128 });
  assert.strictEqual(minContrast, 1, 'Same colors should have 1:1 contrast');

  // Test that contrast is symmetric
  const contrast1 = getContrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
  const contrast2 = getContrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 });
  assert.strictEqual(contrast1, contrast2, 'Contrast should be symmetric');

  // Test intermediate values
  const grayContrast = getContrastRatio({ r: 0, g: 0, b: 0 }, { r: 128, g: 128, b: 128 });
  assert.ok(grayContrast > 1 && grayContrast < 21, 'Gray contrast should be between 1 and 21');

  console.log('    ✓ Maximum contrast (21:1) is correct');
  console.log('    ✓ Minimum contrast (1:1) is correct');
  console.log('    ✓ Contrast calculation is symmetric');
  console.log('    ✓ Intermediate contrasts are within valid range');
}

/**
 * Test Suite: Contrast Validation
 */
function testContrastValidation(): void {
  console.log('\n  Test: Contrast Validation');

  // Test black on white (should pass all WCAG levels)
  const excellent: ContrastValidationResult = validateContrast({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
  assert.strictEqual(excellent.ratio, 21, 'Black on white ratio should be 21:1');
  assert.strictEqual(excellent.passes.AA.normal, true, 'Should pass WCAG AA normal');
  assert.strictEqual(excellent.passes.AA.large, true, 'Should pass WCAG AA large');
  assert.strictEqual(excellent.passes.AAA.normal, true, 'Should pass WCAG AAA normal');
  assert.strictEqual(excellent.passes.AAA.large, true, 'Should pass WCAG AAA large');
  assert.ok(excellent.recommendation.includes('Excellent'), 'Should recommend as excellent');

  // Test poor contrast (light gray on white)
  const poor: ContrastValidationResult = validateContrast({ r: 200, g: 200, b: 200 }, { r: 255, g: 255, b: 255 });
  assert.strictEqual(poor.passes.AA.normal, false, 'Should fail WCAG AA normal');
  assert.strictEqual(poor.passes.AA.large, false, 'Should fail WCAG AA large');
  assert.ok(poor.recommendation.includes('Poor') || poor.recommendation.includes('fails'), 'Should indicate poor contrast');

  // Test medium contrast (dark gray on white)
  const medium: ContrastValidationResult = validateContrast({ r: 100, g: 100, b: 100 }, { r: 255, g: 255, b: 255 });
  assert.ok(medium.ratio >= 4.5, 'Dark gray on white should have at least 4.5:1 contrast');
  assert.strictEqual(medium.passes.AA.normal, true, 'Should pass WCAG AA normal');

  console.log('    ✓ Excellent contrast (21:1) passes all WCAG levels');
  console.log('    ✓ Poor contrast fails WCAG requirements');
  console.log('    ✓ Medium contrast passes WCAG AA');
  console.log('    ✓ Recommendations are appropriate');
}

/**
 * Test Suite: Edge Cases
 */
function testEdgeCases(): void {
  console.log('\n  Test: Edge Cases');

  // Test boundary RGB values
  const rgb1 = hexToRgb('#000000');
  assert.deepStrictEqual(rgb1, { r: 0, g: 0, b: 0 }, 'Minimum RGB values');

  const rgb2 = hexToRgb('#FFFFFF');
  assert.deepStrictEqual(rgb2, { r: 255, g: 255, b: 255 }, 'Maximum RGB values');

  // Test luminance with boundary values
  const lumMin = getRelativeLuminance({ r: 0, g: 0, b: 0 });
  const lumMax = getRelativeLuminance({ r: 255, g: 255, b: 255 });
  assert.ok(lumMin >= 0 && lumMax <= 1, 'Luminance should be within [0, 1]');

  // Test contrast with same colors
  const identicalContrast = getContrastRatio({ r: 50, g: 100, b: 150 }, { r: 50, g: 100, b: 150 });
  assert.strictEqual(identicalContrast, 1, 'Identical colors should have 1:1 contrast');

  console.log('    ✓ Boundary RGB values handled correctly');
  console.log('    ✓ Luminance bounds are respected');
  console.log('    ✓ Identical colors produce 1:1 contrast');
}

/**
 * Test Suite: Perceptual Uniformity
 */
function testPerceptualUniformity(): void {
  console.log('\n  Test: Perceptual Uniformity');

  // Test that the luminance formula accounts for human perception
  // Green should be much brighter than red or blue at same RGB value
  const red50 = getRelativeLuminance({ r: 128, g: 0, b: 0 });
  const green50 = getRelativeLuminance({ r: 0, g: 128, b: 0 });
  const blue50 = getRelativeLuminance({ r: 0, g: 0, b: 128 });

  // Green should be significantly brighter (>2x) than red and blue
  assert.ok(green50 > red50 * 2, 'Green should be much brighter than red');
  assert.ok(green50 > blue50 * 2, 'Green should be much brighter than blue');

  // Test gamma correction (non-linear response)
  const darkGray = getRelativeLuminance({ r: 64, g: 64, b: 64 });
  const lightGray = getRelativeLuminance({ r: 192, g: 192, b: 192 });
  const midGray = getRelativeLuminance({ r: 128, g: 128, b: 128 });

  // Due to gamma correction, the difference should not be linear
  const diffDark = midGray - darkGray;
  const diffLight = lightGray - midGray;
  assert.notStrictEqual(diffDark, diffLight, 'Luminance progression should be non-linear');

  console.log('    ✓ Green channel weighted correctly for human perception');
  console.log('    ✓ Gamma correction applied (non-linear luminance)');
}

/**
 * Run all color converter tests
 */
async function runTests(): Promise<void> {
  console.log('\n=== Color Converter Unit Tests ===\n');

  try {
    // Run test suites
    testHexToRgb();
    testRgbToHex();
    testRoundTripConversion();
    testInvalidHexInput();
    testRelativeLuminance();
    testContrastRatio();
    testContrastValidation();
    testEdgeCases();
    testPerceptualUniformity();

    console.log('\n=== All Color Converter Tests Passed ===\n');
    console.log('Validated:');
    console.log('  ✓ RGB ↔ Hex conversions work correctly');
    console.log('  ✓ Round-trip conversions preserve values');
    console.log('  ✓ Invalid input is handled gracefully');
    console.log('  ✓ Relative luminance calculations are accurate');
    console.log('  ✓ Contrast ratio calculations follow WCAG standards');
    console.log('  ✓ Contrast validation provides correct WCAG compliance');
    console.log('  ✓ Edge cases are handled properly');
    console.log('  ✓ Perceptual uniformity matches human vision');
    console.log('');

  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    throw error;
  }
}

// Run tests
runTests()
  .then(() => {
    console.log('Color converter tests completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Color converter tests failed:', error);
    process.exit(1);
  });
