/**
 * Component Tools Integration Test
 *
 * Tests component creation, instance creation, property overrides,
 * and effect application through the MCP tool interface.
 *
 * Note: This test validates the tool logic and schema validation.
 * Full end-to-end testing with Figma requires the WebSocket bridge and plugin.
 */

import assert from 'assert';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import tool modules from compiled MCP server
const createComponentPath = join(__dirname, '../../mcp-server/dist/tools/create_component.js');
const createInstancePath = join(__dirname, '../../mcp-server/dist/tools/create_instance.js');
const applyEffectsPath = join(__dirname, '../../mcp-server/dist/tools/apply_effects.js');

let createComponentInputSchema, createInstanceInputSchema, applyEffectsInputSchema;

/**
 * Load tool schemas
 */
async function loadToolSchemas() {
  try {
    const createComponentModule = await import(createComponentPath);
    const createInstanceModule = await import(createInstancePath);
    const applyEffectsModule = await import(applyEffectsPath);

    createComponentInputSchema = createComponentModule.createComponentInputSchema;
    createInstanceInputSchema = createInstanceModule.createInstanceInputSchema;
    applyEffectsInputSchema = applyEffectsModule.applyEffectsInputSchema;
  } catch (error) {
    throw new Error(`Failed to load tool schemas: ${error.message}. Ensure MCP server is built with 'npm run build' in mcp-server directory.`);
  }
}

/**
 * Test Suite: Create Component Schema Validation
 */
function testCreateComponentSchema() {
  console.log('\n  Test: Create Component Schema Validation');

  // Test valid input
  const validInput = {
    frameId: 'frame-123',
    name: 'Button/Primary',
    description: 'Primary action button'
  };

  const validResult = createComponentInputSchema.safeParse(validInput);
  assert.strictEqual(validResult.success, true, 'Valid input should pass validation');
  assert.deepStrictEqual(validResult.data, validInput, 'Parsed data should match input');

  // Test minimal valid input (description is optional)
  const minimalInput = {
    frameId: 'frame-456',
    name: 'Card'
  };

  const minimalResult = createComponentInputSchema.safeParse(minimalInput);
  assert.strictEqual(minimalResult.success, true, 'Minimal input should pass validation');

  // Test invalid inputs
  const missingFrameId = { name: 'Button' };
  const missingFrameIdResult = createComponentInputSchema.safeParse(missingFrameId);
  assert.strictEqual(missingFrameIdResult.success, false, 'Should fail without frameId');

  const missingName = { frameId: 'frame-123' };
  const missingNameResult = createComponentInputSchema.safeParse(missingName);
  assert.strictEqual(missingNameResult.success, false, 'Should fail without name');

  const emptyFrameId = { frameId: '', name: 'Button' };
  const emptyFrameIdResult = createComponentInputSchema.safeParse(emptyFrameId);
  assert.strictEqual(emptyFrameIdResult.success, false, 'Should fail with empty frameId');

  const emptyName = { frameId: 'frame-123', name: '' };
  const emptyNameResult = createComponentInputSchema.safeParse(emptyName);
  assert.strictEqual(emptyNameResult.success, false, 'Should fail with empty name');

  console.log('    ✓ Valid inputs pass validation');
  console.log('    ✓ Optional description field works');
  console.log('    ✓ Missing required fields fail validation');
  console.log('    ✓ Empty strings fail validation');
}

/**
 * Test Suite: Create Instance Schema Validation
 */
function testCreateInstanceSchema() {
  console.log('\n  Test: Create Instance Schema Validation');

  // Test valid input with all fields
  const fullInput = {
    componentId: 'comp-123',
    name: 'Button Instance 1',
    x: 100,
    y: 200,
    parentId: 'parent-456',
    overrides: [
      { type: 'text', nodeId: 'text-1', value: 'Click me' },
      { type: 'fill', nodeId: 'bg-1', color: '#FF0000' }
    ]
  };

  const fullResult = createInstanceInputSchema.safeParse(fullInput);
  assert.strictEqual(fullResult.success, true, 'Full input should pass validation');

  // Test minimal valid input (only componentId required)
  const minimalInput = {
    componentId: 'comp-789'
  };

  const minimalResult = createInstanceInputSchema.safeParse(minimalInput);
  assert.strictEqual(minimalResult.success, true, 'Minimal input should pass validation');

  // Test invalid inputs
  const missingComponentId = { name: 'Instance' };
  const missingComponentIdResult = createInstanceInputSchema.safeParse(missingComponentId);
  assert.strictEqual(missingComponentIdResult.success, false, 'Should fail without componentId');

  const emptyComponentId = { componentId: '' };
  const emptyComponentIdResult = createInstanceInputSchema.safeParse(emptyComponentId);
  assert.strictEqual(emptyComponentIdResult.success, false, 'Should fail with empty componentId');

  console.log('    ✓ Valid inputs pass validation');
  console.log('    ✓ All optional fields work correctly');
  console.log('    ✓ Minimal input (componentId only) works');
  console.log('    ✓ Missing/empty componentId fails validation');
}

/**
 * Test Suite: Instance Property Overrides
 */
function testPropertyOverrides() {
  console.log('\n  Test: Instance Property Overrides');

  // Test text override
  const textOverride = {
    componentId: 'comp-123',
    overrides: [
      { type: 'text', nodeId: 'label', value: 'Submit' }
    ]
  };

  const textResult = createInstanceInputSchema.safeParse(textOverride);
  assert.strictEqual(textResult.success, true, 'Text override should be valid');

  // Test fill override
  const fillOverride = {
    componentId: 'comp-123',
    overrides: [
      { type: 'fill', nodeId: 'bg', color: '#00FF00' }
    ]
  };

  const fillResult = createInstanceInputSchema.safeParse(fillOverride);
  assert.strictEqual(fillResult.success, true, 'Fill override should be valid');

  // Test multiple overrides
  const multipleOverrides = {
    componentId: 'comp-123',
    overrides: [
      { type: 'text', nodeId: 'label', value: 'Submit' },
      { type: 'fill', nodeId: 'bg', color: '#0066CC' },
      { type: 'text', nodeId: 'subtitle', value: 'Click to continue' }
    ]
  };

  const multipleResult = createInstanceInputSchema.safeParse(multipleOverrides);
  assert.strictEqual(multipleResult.success, true, 'Multiple overrides should be valid');
  assert.strictEqual(multipleResult.data.overrides.length, 3, 'Should have 3 overrides');

  // Test invalid color format
  const invalidColor = {
    componentId: 'comp-123',
    overrides: [
      { type: 'fill', nodeId: 'bg', color: 'red' }
    ]
  };

  const invalidColorResult = createInstanceInputSchema.safeParse(invalidColor);
  assert.strictEqual(invalidColorResult.success, false, 'Invalid color format should fail');

  // Test invalid hex color (too short)
  const shortHex = {
    componentId: 'comp-123',
    overrides: [
      { type: 'fill', nodeId: 'bg', color: '#FFF' }
    ]
  };

  const shortHexResult = createInstanceInputSchema.safeParse(shortHex);
  assert.strictEqual(shortHexResult.success, false, 'Short hex color should fail');

  // Test missing required override fields
  const missingNodeId = {
    componentId: 'comp-123',
    overrides: [
      { type: 'text', value: 'Submit' }
    ]
  };

  const missingNodeIdResult = createInstanceInputSchema.safeParse(missingNodeId);
  assert.strictEqual(missingNodeIdResult.success, false, 'Missing nodeId should fail');

  console.log('    ✓ Text overrides validate correctly');
  console.log('    ✓ Fill overrides validate correctly');
  console.log('    ✓ Multiple overrides work together');
  console.log('    ✓ Invalid color formats are rejected');
  console.log('    ✓ Missing required fields fail validation');
}

/**
 * Test Suite: Apply Effects Schema Validation
 */
function testApplyEffectsSchema() {
  console.log('\n  Test: Apply Effects Schema Validation');

  // Test drop shadow effect
  const dropShadow = {
    nodeId: 'node-123',
    effects: [
      {
        type: 'DROP_SHADOW',
        color: '#000000',
        opacity: 0.25,
        x: 0,
        y: 2,
        blur: 4,
        spread: 0
      }
    ]
  };

  const dropShadowResult = applyEffectsInputSchema.safeParse(dropShadow);
  assert.strictEqual(dropShadowResult.success, true, 'Drop shadow should be valid');

  // Test inner shadow effect
  const innerShadow = {
    nodeId: 'node-456',
    effects: [
      {
        type: 'INNER_SHADOW',
        color: '#FFFFFF',
        opacity: 0.5,
        x: 0,
        y: -1,
        blur: 2,
        spread: 0
      }
    ]
  };

  const innerShadowResult = applyEffectsInputSchema.safeParse(innerShadow);
  assert.strictEqual(innerShadowResult.success, true, 'Inner shadow should be valid');

  // Test layer blur effect
  const layerBlur = {
    nodeId: 'node-789',
    effects: [
      { type: 'LAYER_BLUR', radius: 4 }
    ]
  };

  const layerBlurResult = applyEffectsInputSchema.safeParse(layerBlur);
  assert.strictEqual(layerBlurResult.success, true, 'Layer blur should be valid');

  // Test background blur effect
  const backgroundBlur = {
    nodeId: 'node-abc',
    effects: [
      { type: 'BACKGROUND_BLUR', radius: 10 }
    ]
  };

  const backgroundBlurResult = applyEffectsInputSchema.safeParse(backgroundBlur);
  assert.strictEqual(backgroundBlurResult.success, true, 'Background blur should be valid');

  console.log('    ✓ Drop shadow effects validate correctly');
  console.log('    ✓ Inner shadow effects validate correctly');
  console.log('    ✓ Layer blur effects validate correctly');
  console.log('    ✓ Background blur effects validate correctly');
}

/**
 * Test Suite: Multiple Effects Validation
 */
function testMultipleEffects() {
  console.log('\n  Test: Multiple Effects Validation');

  // Test multiple shadows
  const multipleShadows = {
    nodeId: 'node-123',
    effects: [
      {
        type: 'DROP_SHADOW',
        color: '#000000',
        opacity: 0.1,
        x: 0,
        y: 1,
        blur: 2,
        spread: 0
      },
      {
        type: 'DROP_SHADOW',
        color: '#000000',
        opacity: 0.15,
        x: 0,
        y: 4,
        blur: 8,
        spread: 0
      }
    ]
  };

  const multipleShadowsResult = applyEffectsInputSchema.safeParse(multipleShadows);
  assert.strictEqual(multipleShadowsResult.success, true, 'Multiple shadows should be valid');
  assert.strictEqual(multipleShadowsResult.data.effects.length, 2, 'Should have 2 effects');

  // Test shadow + blur combination
  const shadowAndBlur = {
    nodeId: 'node-456',
    effects: [
      {
        type: 'DROP_SHADOW',
        color: '#000000',
        opacity: 0.25,
        x: 0,
        y: 2,
        blur: 4,
        spread: 0
      },
      {
        type: 'BACKGROUND_BLUR',
        radius: 8
      }
    ]
  };

  const shadowAndBlurResult = applyEffectsInputSchema.safeParse(shadowAndBlur);
  assert.strictEqual(shadowAndBlurResult.success, true, 'Shadow + blur should be valid');

  // Test empty effects array
  const emptyEffects = {
    nodeId: 'node-789',
    effects: []
  };

  const emptyEffectsResult = applyEffectsInputSchema.safeParse(emptyEffects);
  assert.strictEqual(emptyEffectsResult.success, false, 'Empty effects array should fail');

  console.log('    ✓ Multiple shadow effects work together');
  console.log('    ✓ Shadow + blur combinations work');
  console.log('    ✓ Empty effects array is rejected');
}

/**
 * Test Suite: Effect Parameter Validation
 */
function testEffectParameters() {
  console.log('\n  Test: Effect Parameter Validation');

  // Test opacity bounds (0-1)
  const validOpacity = {
    nodeId: 'node-123',
    effects: [
      {
        type: 'DROP_SHADOW',
        color: '#000000',
        opacity: 0.5,
        x: 0,
        y: 2,
        blur: 4,
        spread: 0
      }
    ]
  };

  const validOpacityResult = applyEffectsInputSchema.safeParse(validOpacity);
  assert.strictEqual(validOpacityResult.success, true, 'Valid opacity (0.5) should pass');

  const zeroOpacity = {
    nodeId: 'node-123',
    effects: [
      {
        type: 'DROP_SHADOW',
        color: '#000000',
        opacity: 0,
        x: 0,
        y: 2,
        blur: 4,
        spread: 0
      }
    ]
  };

  const zeroOpacityResult = applyEffectsInputSchema.safeParse(zeroOpacity);
  assert.strictEqual(zeroOpacityResult.success, true, 'Opacity 0 should be valid');

  const fullOpacity = {
    nodeId: 'node-123',
    effects: [
      {
        type: 'DROP_SHADOW',
        color: '#000000',
        opacity: 1,
        x: 0,
        y: 2,
        blur: 4,
        spread: 0
      }
    ]
  };

  const fullOpacityResult = applyEffectsInputSchema.safeParse(fullOpacity);
  assert.strictEqual(fullOpacityResult.success, true, 'Opacity 1 should be valid');

  const negativeOpacity = {
    nodeId: 'node-123',
    effects: [
      {
        type: 'DROP_SHADOW',
        color: '#000000',
        opacity: -0.1,
        x: 0,
        y: 2,
        blur: 4,
        spread: 0
      }
    ]
  };

  const negativeOpacityResult = applyEffectsInputSchema.safeParse(negativeOpacity);
  assert.strictEqual(negativeOpacityResult.success, false, 'Negative opacity should fail');

  const overOpacity = {
    nodeId: 'node-123',
    effects: [
      {
        type: 'DROP_SHADOW',
        color: '#000000',
        opacity: 1.5,
        x: 0,
        y: 2,
        blur: 4,
        spread: 0
      }
    ]
  };

  const overOpacityResult = applyEffectsInputSchema.safeParse(overOpacity);
  assert.strictEqual(overOpacityResult.success, false, 'Opacity > 1 should fail');

  // Test negative blur (should fail)
  const negativeBlur = {
    nodeId: 'node-123',
    effects: [
      {
        type: 'DROP_SHADOW',
        color: '#000000',
        opacity: 0.25,
        x: 0,
        y: 2,
        blur: -4,
        spread: 0
      }
    ]
  };

  const negativeBlurResult = applyEffectsInputSchema.safeParse(negativeBlur);
  assert.strictEqual(negativeBlurResult.success, false, 'Negative blur should fail');

  // Test zero blur (should pass)
  const zeroBlur = {
    nodeId: 'node-123',
    effects: [
      {
        type: 'DROP_SHADOW',
        color: '#000000',
        opacity: 0.25,
        x: 0,
        y: 2,
        blur: 0,
        spread: 0
      }
    ]
  };

  const zeroBlurResult = applyEffectsInputSchema.safeParse(zeroBlur);
  assert.strictEqual(zeroBlurResult.success, true, 'Zero blur should be valid (hard edge)');

  // Test negative offset values (should pass - negative means opposite direction)
  const negativeOffset = {
    nodeId: 'node-123',
    effects: [
      {
        type: 'DROP_SHADOW',
        color: '#000000',
        opacity: 0.25,
        x: -10,
        y: -5,
        blur: 4,
        spread: 0
      }
    ]
  };

  const negativeOffsetResult = applyEffectsInputSchema.safeParse(negativeOffset);
  assert.strictEqual(negativeOffsetResult.success, true, 'Negative offsets should be valid');

  console.log('    ✓ Opacity bounds (0-1) are enforced');
  console.log('    ✓ Negative opacity is rejected');
  console.log('    ✓ Opacity > 1 is rejected');
  console.log('    ✓ Negative blur is rejected');
  console.log('    ✓ Zero blur is accepted (hard edge)');
  console.log('    ✓ Negative offsets are accepted (opposite direction)');
}

/**
 * Test Suite: Invalid Effect Types
 */
function testInvalidEffectTypes() {
  console.log('\n  Test: Invalid Effect Types');

  // Test invalid effect type
  const invalidType = {
    nodeId: 'node-123',
    effects: [
      {
        type: 'INVALID_EFFECT',
        color: '#000000',
        opacity: 0.25,
        x: 0,
        y: 2,
        blur: 4,
        spread: 0
      }
    ]
  };

  const invalidTypeResult = applyEffectsInputSchema.safeParse(invalidType);
  assert.strictEqual(invalidTypeResult.success, false, 'Invalid effect type should fail');

  // Test missing nodeId
  const missingNodeId = {
    effects: [
      { type: 'LAYER_BLUR', radius: 4 }
    ]
  };

  const missingNodeIdResult = applyEffectsInputSchema.safeParse(missingNodeId);
  assert.strictEqual(missingNodeIdResult.success, false, 'Missing nodeId should fail');

  // Test empty nodeId
  const emptyNodeId = {
    nodeId: '',
    effects: [
      { type: 'LAYER_BLUR', radius: 4 }
    ]
  };

  const emptyNodeIdResult = applyEffectsInputSchema.safeParse(emptyNodeId);
  assert.strictEqual(emptyNodeIdResult.success, false, 'Empty nodeId should fail');

  console.log('    ✓ Invalid effect types are rejected');
  console.log('    ✓ Missing nodeId is rejected');
  console.log('    ✓ Empty nodeId is rejected');
}

/**
 * Test Suite: Edge Cases
 */
function testEdgeCases() {
  console.log('\n  Test: Edge Cases');

  // Test component with special characters in name
  const specialChars = {
    frameId: 'frame-123',
    name: 'Button/Primary - Large (Hover)',
    description: 'Special chars: / - ( )'
  };

  const specialCharsResult = createComponentInputSchema.safeParse(specialChars);
  assert.strictEqual(specialCharsResult.success, true, 'Special characters in name should be valid');

  // Test very long strings
  const longName = {
    frameId: 'frame-123',
    name: 'A'.repeat(100)
  };

  const longNameResult = createComponentInputSchema.safeParse(longName);
  assert.strictEqual(longNameResult.success, true, 'Long names should be valid');

  // Test exact hex color format
  const validHexColors = ['#000000', '#FFFFFF', '#abcdef', '#ABCDEF', '#123456'];
  validHexColors.forEach(color => {
    const input = {
      componentId: 'comp-123',
      overrides: [{ type: 'fill', nodeId: 'bg', color }]
    };
    const result = createInstanceInputSchema.safeParse(input);
    assert.strictEqual(result.success, true, `Hex color ${color} should be valid`);
  });

  // Test invalid hex formats
  const invalidHexColors = ['#FFF', '#GGGGGG', 'red', 'rgb(255,0,0)', '#12345', '#1234567'];
  invalidHexColors.forEach(color => {
    const input = {
      componentId: 'comp-123',
      overrides: [{ type: 'fill', nodeId: 'bg', color }]
    };
    const result = createInstanceInputSchema.safeParse(input);
    assert.strictEqual(result.success, false, `Invalid hex ${color} should fail`);
  });

  console.log('    ✓ Special characters in names are accepted');
  console.log('    ✓ Long strings are accepted');
  console.log('    ✓ Valid hex colors (6 digits) are accepted');
  console.log('    ✓ Invalid hex formats are rejected');
}

/**
 * Run all component tools tests
 */
async function runTests() {
  console.log('\n=== Component Tools Integration Tests ===\n');

  try {
    // Load schemas
    console.log('Loading tool schemas from MCP server...');
    await loadToolSchemas();
    console.log('✓ Tool schemas loaded successfully\n');

    // Run test suites
    testCreateComponentSchema();
    testCreateInstanceSchema();
    testPropertyOverrides();
    testApplyEffectsSchema();
    testMultipleEffects();
    testEffectParameters();
    testInvalidEffectTypes();
    testEdgeCases();

    console.log('\n=== All Component Tools Tests Passed ===\n');
    console.log('Validated:');
    console.log('  ✓ create_component schema validates correctly');
    console.log('  ✓ create_instance schema validates correctly');
    console.log('  ✓ Property overrides (text, fill) work correctly');
    console.log('  ✓ Effect schemas validate correctly (shadows, blur)');
    console.log('  ✓ Multiple effects can be combined');
    console.log('  ✓ Effect parameters have correct bounds');
    console.log('  ✓ Invalid inputs are rejected appropriately');
    console.log('  ✓ Edge cases are handled properly');
    console.log('');
    console.log('Note: Full end-to-end testing with Figma requires:');
    console.log('  - WebSocket bridge server running');
    console.log('  - Figma plugin connected');
    console.log('  - Use foundation.test.js for WebSocket validation');
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
    console.log('Component tools tests completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Component tools tests failed:', error);
    process.exit(1);
  });
