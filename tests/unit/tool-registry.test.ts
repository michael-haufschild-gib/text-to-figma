/**
 * Unit tests for Tool Registry
 */

import assert from 'assert';
import { z } from 'zod';
import type { ToolHandler } from '../../mcp-server/src/routing/tool-handler.js';
import { ToolRegistry, getToolRegistry, resetToolRegistry } from '../../mcp-server/src/routing/tool-registry.js';

// Type definitions for test handlers
type TestInput1 = { value: number };
type TestResult1 = { result: number };
type TestInput2 = { text: string };
type TestResult2 = { output: string };

// Mock tool handlers for testing
const mockToolHandler1: ToolHandler<TestInput1, TestResult1> = {
  name: 'test_tool_1',
  schema: z.object({ value: z.number() }),
  execute: async (input) => ({ result: input.value * 2 }),
  formatResponse: (result) => [
    { type: 'text', text: `Result: ${result.result}` }
  ],
  definition: {
    name: 'test_tool_1',
    description: 'Test tool 1',
    inputSchema: {
      type: 'object',
      properties: { value: { type: 'number' } },
      required: ['value']
    }
  }
};

const mockToolHandler2: ToolHandler<TestInput2, TestResult2> = {
  name: 'test_tool_2',
  schema: z.object({ text: z.string() }),
  execute: async (input) => ({ output: input.text.toUpperCase() }),
  formatResponse: (result) => [
    { type: 'text', text: result.output }
  ],
  definition: {
    name: 'test_tool_2',
    description: 'Test tool 2',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text']
    }
  }
};

/**
 * Test: ToolRegistry.register
 */
function testRegister(): void {
  console.log('\n  Test: ToolRegistry.register');

  const registry = new ToolRegistry();

  // Test registering a single tool
  registry.register(mockToolHandler1);
  const retrieved = registry.get('test_tool_1');
  assert.strictEqual(retrieved, mockToolHandler1, 'Should register and retrieve tool');

  // Test registering multiple tools
  const registry2 = new ToolRegistry();
  registry2.register(mockToolHandler1);
  registry2.register(mockToolHandler2);

  const tool1 = registry2.get('test_tool_1');
  const tool2 = registry2.get('test_tool_2');

  assert.strictEqual(tool1, mockToolHandler1, 'Should retrieve first tool');
  assert.strictEqual(tool2, mockToolHandler2, 'Should retrieve second tool');

  // Test duplicate registration throws error
  const registry3 = new ToolRegistry();
  registry3.register(mockToolHandler1);

  try {
    registry3.register(mockToolHandler1);
    assert.fail('Should throw error on duplicate registration');
  } catch (error) {
    assert.ok(error instanceof Error, 'Should throw Error');
    assert.ok(
      error.message.includes("Tool 'test_tool_1' is already registered"),
      'Error message should mention duplicate tool'
    );
  }

  console.log('    ✓ register works correctly');
}

/**
 * Test: ToolRegistry.get
 */
function testGet(): void {
  console.log('\n  Test: ToolRegistry.get');

  const registry = new ToolRegistry();

  // Test non-existent tool
  const result = registry.get('non_existent');
  assert.strictEqual(result, undefined, 'Should return undefined for non-existent tool');

  // Test retrieving registered tool
  registry.register(mockToolHandler1);
  const retrieved = registry.get('test_tool_1');
  assert.strictEqual(retrieved, mockToolHandler1, 'Should retrieve registered tool');

  console.log('    ✓ get works correctly');
}

/**
 * Test: ToolRegistry.getAll
 */
function testGetAll(): void {
  console.log('\n  Test: ToolRegistry.getAll');

  const registry = new ToolRegistry();

  // Test empty registry
  const empty = registry.getAll();
  assert.deepStrictEqual(empty, [], 'Should return empty array when no tools registered');

  // Test with registered tools
  registry.register(mockToolHandler1);
  registry.register(mockToolHandler2);

  const all = registry.getAll();
  assert.strictEqual(all.length, 2, 'Should return 2 tools');
  assert.ok(all.includes(mockToolHandler1), 'Should include first tool');
  assert.ok(all.includes(mockToolHandler2), 'Should include second tool');

  console.log('    ✓ getAll works correctly');
}

/**
 * Test: ToolRegistry.listDefinitions
 */
function testListDefinitions(): void {
  console.log('\n  Test: ToolRegistry.listDefinitions');

  const registry = new ToolRegistry();

  // Test empty registry
  const empty = registry.listDefinitions();
  assert.deepStrictEqual(empty, [], 'Should return empty array when no tools registered');

  // Test with registered tools
  registry.register(mockToolHandler1);
  registry.register(mockToolHandler2);

  const definitions = registry.listDefinitions();
  assert.strictEqual(definitions.length, 2, 'Should return 2 definitions');

  const def1 = definitions.find((d) => d.name === 'test_tool_1');
  const def2 = definitions.find((d) => d.name === 'test_tool_2');

  assert.ok(def1, 'Should find definition 1');
  assert.ok(def2, 'Should find definition 2');
  assert.strictEqual(def1!.description, 'Test tool 1', 'Description should match');
  assert.strictEqual(def2!.description, 'Test tool 2', 'Description should match');

  console.log('    ✓ listDefinitions works correctly');
}

/**
 * Test: ToolRegistry.clear
 */
function testClear(): void {
  console.log('\n  Test: ToolRegistry.clear');

  const registry = new ToolRegistry();
  registry.register(mockToolHandler1);
  registry.register(mockToolHandler2);

  registry.clear();

  const all = registry.getAll();
  assert.strictEqual(all.length, 0, 'Should remove all registered tools');

  console.log('    ✓ clear works correctly');
}

/**
 * Test: getToolRegistry singleton
 */
function testSingleton(): void {
  console.log('\n  Test: getToolRegistry (singleton)');

  resetToolRegistry();

  // Test same instance on multiple calls
  const registry1 = getToolRegistry();
  const registry2 = getToolRegistry();
  assert.strictEqual(registry1, registry2, 'Should return same instance');

  // Test shared state
  registry1.register(mockToolHandler1);
  const retrieved = registry2.get('test_tool_1');
  assert.strictEqual(retrieved, mockToolHandler1, 'Should share registered tools');

  // Test reset creates new instance
  resetToolRegistry();
  const registry3 = getToolRegistry();
  const afterReset = registry3.get('test_tool_1');
  assert.strictEqual(afterReset, undefined, 'Should create new instance after reset');

  console.log('    ✓ singleton pattern works correctly');
}

/**
 * Run all tests
 */
export function runToolRegistryTests(): void {
  console.log('\n=== Tool Registry Tests ===');

  testRegister();
  testGet();
  testGetAll();
  testListDefinitions();
  testClear();
  testSingleton();

  console.log('\n=== All Tool Registry Tests Passed ===\n');
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runToolRegistryTests();
}
