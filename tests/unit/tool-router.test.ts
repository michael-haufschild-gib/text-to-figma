/**
 * Unit tests for Tool Router
 */

import assert from 'assert';
import { z } from 'zod';
import type { ToolHandler } from '../../mcp-server/src/routing/tool-handler.js';
import { getToolRegistry, resetToolRegistry } from '../../mcp-server/src/routing/tool-registry.js';
import { routeToolCall } from '../../mcp-server/src/routing/tool-router.js';

// Type definitions for test
type TestInput = { value: number };
type TestResult = { result: number };

/**
 * Test: routeToolCall with valid tool
 */
async function testRouteValidTool(): Promise<void> {
  console.log('\n  Test: routeToolCall with valid tool');

  resetToolRegistry();
  const registry = getToolRegistry();

  // Register a test tool
  const testHandler: ToolHandler<TestInput, TestResult> = {
    name: 'test_tool',
    schema: z.object({ value: z.number() }),
    execute: async (input) => ({ result: input.value * 2 }),
    formatResponse: (result) => [
      { type: 'text', text: `Result: ${result.result}` }
    ],
    definition: {
      name: 'test_tool',
      description: 'Test tool',
      inputSchema: {
        type: 'object',
        properties: { value: { type: 'number' } },
        required: ['value']
      }
    }
  };

  registry.register(testHandler);

  // Call the tool
  const result = await routeToolCall('test_tool', { value: 5 });

  assert.strictEqual(result.length, 1, 'Should return 1 content item');
  assert.strictEqual(result[0].type, 'text', 'Content type should be text');
  assert.strictEqual(result[0].text, 'Result: 10', 'Should execute tool correctly');

  console.log('    ✓ routes valid tool correctly');
}

/**
 * Test: routeToolCall with unknown tool
 */
async function testRouteUnknownTool(): Promise<void> {
  console.log('\n  Test: routeToolCall with unknown tool');

  resetToolRegistry();

  try {
    await routeToolCall('unknown_tool', {});
    assert.fail('Should throw error for unknown tool');
  } catch (error) {
    assert.ok(error instanceof Error, 'Should throw Error');
    assert.ok(error.message.includes('Unknown tool'), 'Error should mention unknown tool');
  }

  console.log('    ✓ throws error for unknown tool');
}

/**
 * Test: routeToolCall with invalid input
 */
async function testRouteInvalidInput(): Promise<void> {
  console.log('\n  Test: routeToolCall with invalid input');

  resetToolRegistry();
  const registry = getToolRegistry();

  const testHandler: ToolHandler<TestInput, TestResult> = {
    name: 'test_tool',
    schema: z.object({ value: z.number() }),
    execute: async (input) => ({ result: input.value * 2 }),
    formatResponse: (result) => [
      { type: 'text', text: `Result: ${result.result}` }
    ],
    definition: {
      name: 'test_tool',
      description: 'Test tool',
      inputSchema: {
        type: 'object',
        properties: { value: { type: 'number' } },
        required: ['value']
      }
    }
  };

  registry.register(testHandler);

  try {
    await routeToolCall('test_tool', { value: 'not a number' });
    assert.fail('Should throw validation error');
  } catch (error) {
    assert.ok(error, 'Should throw error for invalid input');
  }

  console.log('    ✓ throws error for invalid input');
}

/**
 * Test: routeToolCall preserves error from tool execution
 */
async function testRouteToolExecutionError(): Promise<void> {
  console.log('\n  Test: routeToolCall with tool execution error');

  resetToolRegistry();
  const registry = getToolRegistry();

  const failingHandler: ToolHandler<TestInput, TestResult> = {
    name: 'failing_tool',
    schema: z.object({ value: z.number() }),
    execute: async () => {
      throw new Error('Tool execution failed');
    },
    formatResponse: (result) => [
      { type: 'text', text: `Result: ${result.result}` }
    ],
    definition: {
      name: 'failing_tool',
      description: 'Failing tool',
      inputSchema: {
        type: 'object',
        properties: { value: { type: 'number' } },
        required: ['value']
      }
    }
  };

  registry.register(failingHandler);

  try {
    await routeToolCall('failing_tool', { value: 5 });
    assert.fail('Should throw tool execution error');
  } catch (error) {
    assert.ok(error instanceof Error, 'Should throw Error');
    assert.strictEqual(error.message, 'Tool execution failed', 'Should preserve error message');
  }

  console.log('    ✓ preserves tool execution errors');
}

/**
 * Run all tests
 */
export async function runToolRouterTests(): Promise<void> {
  console.log('\n=== Tool Router Tests ===');

  await testRouteValidTool();
  await testRouteUnknownTool();
  await testRouteInvalidInput();
  await testRouteToolExecutionError();

  console.log('\n=== All Tool Router Tests Passed ===\n');
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runToolRouterTests().catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}
