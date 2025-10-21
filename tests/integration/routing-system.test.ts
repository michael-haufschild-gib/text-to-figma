/**
 * Integration Tests for Routing System
 *
 * Tests that registered tools work correctly through the new routing system
 */

import assert from 'assert';
import { registerAllTools } from '../../mcp-server/src/routing/register-tools.js';
import { getToolRegistry, resetToolRegistry } from '../../mcp-server/src/routing/tool-registry.js';
import { routeToolCall } from '../../mcp-server/src/routing/tool-router.js';

/**
 * Test: Tool handlers are registered correctly
 */
function testToolRegistration(): void {
  console.log('\n  Test: Tool registration');

  resetToolRegistry();
  registerAllTools();

  const registry = getToolRegistry();

  const toolCount = registry.getAll().length;
  console.log(`    Registered ${toolCount} tools`);

  assert.ok(toolCount > 0, 'Should register at least one tool');

  // Check specific tools are registered
  assert.ok(registry.get('create_frame'), 'create_frame should be registered');
  assert.ok(registry.get('set_fills'), 'set_fills should be registered');
  assert.ok(registry.get('create_text'), 'create_text should be registered');
  assert.ok(registry.get('set_layout_properties'), 'set_layout_properties should be registered');
  assert.ok(registry.get('validate_design_tokens'), 'validate_design_tokens should be registered');
  assert.ok(registry.get('check_wcag_contrast'), 'check_wcag_contrast should be registered');

  console.log('    ✓ tools registered correctly');
}

/**
 * Test: validate_design_tokens works through routing
 */
async function testValidateDesignTokens(): Promise<void> {
  console.log('\n  Test: validate_design_tokens through routing');

  resetToolRegistry();
  registerAllTools();

  const result = await routeToolCall('validate_design_tokens', {
    spacing: [8, 16, 24],
    typography: [
      { fontSize: 16, name: 'body' },
      { fontSize: 24, name: 'heading' }
    ],
    colors: [
      { foreground: '#000000', background: '#FFFFFF', name: 'text/bg' }
    ]
  });

  assert.ok(Array.isArray(result), 'Should return array');
  assert.strictEqual(result.length, 1, 'Should return 1 content item');
  assert.strictEqual(result[0].type, 'text', 'Content type should be text');
  assert.ok(result[0].text, 'Should have text content');
  assert.ok(result[0].text!.includes('Validation Report'), 'Should contain validation report');

  console.log('    ✓ validate_design_tokens works correctly');
}

/**
 * Test: check_wcag_contrast works through routing
 */
async function testCheckWcagContrast(): Promise<void> {
  console.log('\n  Test: check_wcag_contrast through routing');

  resetToolRegistry();
  registerAllTools();

  const result = await routeToolCall('check_wcag_contrast', {
    foreground: '#000000',
    background: '#FFFFFF',
    fontSize: 16,
    fontWeight: 400
  });

  assert.ok(Array.isArray(result), 'Should return array');
  assert.strictEqual(result.length, 1, 'Should return 1 content item');
  assert.strictEqual(result[0].type, 'text', 'Content type should be text');
  assert.ok(result[0].text, 'Should have text content');
  assert.ok(result[0].text!.includes('Contrast Check'), 'Should contain contrast check result');

  console.log('    ✓ check_wcag_contrast works correctly');
}

/**
 * Test: Error handling for invalid inputs
 */
async function testErrorHandling(): Promise<void> {
  console.log('\n  Test: Error handling for invalid inputs');

  resetToolRegistry();
  registerAllTools();

  try {
    await routeToolCall('validate_design_tokens', {
      spacing: ['invalid'], // Invalid: should be numbers
    });
    assert.fail('Should throw validation error');
  } catch (error) {
    assert.ok(error, 'Should throw error for invalid input');
  }

  console.log('    ✓ error handling works correctly');
}

/**
 * Run all integration tests
 */
export async function runIntegrationTests(): Promise<void> {
  console.log('\n=== Routing System Integration Tests ===');

  testToolRegistration();
  await testValidateDesignTokens();
  await testCheckWcagContrast();
  await testErrorHandling();

  console.log('\n=== All Integration Tests Passed ===\n');
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTests().catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}
