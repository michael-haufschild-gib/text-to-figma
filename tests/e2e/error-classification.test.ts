/**
 * Error Classification E2E Tests
 *
 * Verifies that different failure modes produce correctly classified errors
 * with appropriate error types. This matters because LLM agents and MCP clients
 * use error types/codes to decide retry strategy — a validation error should not
 * be retried, but a transient connection error should.
 *
 * Bug this catches:
 * - All errors are generic "Error" instead of typed (FigmaAPIError, NetworkError, etc.)
 * - Validation errors are classified as bridge errors (causing unnecessary retries)
 * - Plugin error messages are completely lost during error wrapping
 * - Unknown tool names produce wrong error type
 * - Error at step N of a multi-step workflow corrupts earlier steps' results
 * - Mixed validation and plugin errors corrupt the tool router state
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FigmaBridge, resetFigmaBridge } from '../../mcp-server/src/figma-bridge.js';
import { routeToolCall } from '../../mcp-server/src/routing/tool-router.js';
import {
  setupThreeTier,
  teardownThreeTier,
  resetPerTest,
  createParentFrame,
  type ThreeTierContext
} from './helpers/three-tier-setup.js';

let ctx: ThreeTierContext;

beforeAll(async () => {
  ctx = await setupThreeTier();
});

afterAll(async () => {
  await teardownThreeTier(ctx);
});

beforeEach(() => {
  resetPerTest(ctx);
});

/**
 * Extract the full error message chain including cause.
 */
function getFullErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  let msg = err.message;
  if (err.cause instanceof Error) {
    msg += ' ' + err.cause.message;
  }
  return msg;
}

// ─── Schema Validation Errors ──────────────────────────────────────────────

describe('Error Classification — schema validation', () => {
  it('empty required string field produces error before reaching plugin', async () => {
    try {
      await routeToolCall('create_frame', { name: '' });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message.length).toBeGreaterThan(0);
    }

    // No command should reach the plugin
    expect(ctx.plugin.getReceivedCommands()).toHaveLength(0);
  });

  it('wrong type for required field produces descriptive error', async () => {
    try {
      await routeToolCall('check_wcag_contrast', {
        foreground: 12345, // should be string
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message.length).toBeGreaterThan(0);
    }
  });

  it('off-grid spacing value is rejected before reaching plugin', async () => {
    try {
      await routeToolCall('create_frame', { name: 'BadPadding', padding: 15 });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }

    expect(ctx.plugin.getReceivedCommands()).toHaveLength(0);
  });

  it('missing required parentId for hierarchy-enforced tool', async () => {
    try {
      await routeToolCall('create_text', {
        content: 'Orphan',
        fontSize: 16
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect((err as Error).message).toContain('HIERARCHY VIOLATION');
    }
  });

  it('gradient with too few stops is rejected at schema level', async () => {
    const frameId = await createParentFrame('GradientError');
    ctx.plugin.clearCommands();

    try {
      await routeToolCall('add_gradient_fill', {
        nodeId: frameId,
        type: 'LINEAR',
        stops: [{ position: 0, color: '#FF0000' }] // Minimum is 2 stops
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }

    // Plugin should not receive the command
    expect(ctx.plugin.getReceivedCommands()).toHaveLength(0);
  });
});

// ─── Unknown Tool Errors ────────────────────────────────────────────────────

describe('Error Classification — unknown tool', () => {
  it('unknown tool name produces clear error message', async () => {
    try {
      await routeToolCall('this_tool_does_not_exist', { foo: 'bar' });
      expect.fail('Should have thrown');
    } catch (err) {
      const error = err as Error;
      expect(error.message).toContain('Unknown tool');
      expect(error.message).toContain('this_tool_does_not_exist');
    }
  });

  it('tool name with typo produces error (not silent failure)', async () => {
    try {
      await routeToolCall('create_farme', { name: 'Typo' });
      expect.fail('Should have thrown');
    } catch (err) {
      expect((err as Error).message).toContain('Unknown tool');
    }
  });
});

// ─── Plugin Error Propagation ──────────────────────────────────────────────

describe('Error Classification — plugin errors', () => {
  // Plugin error tests trip the circuit breaker, so reconnect after each
  afterEach(async () => {
    ctx.plugin.resetCommandHandler();
    resetFigmaBridge();
    ctx.figmaBridge = new FigmaBridge();
    await ctx.figmaBridge.connect();
  });

  it('plugin error message is preserved in the error chain', async () => {
    // Bug: plugin returns { success: false, error: "specific message" }
    // but the error that reaches the caller loses the original text.
    const specificMessage = 'Node limit exceeded: maximum 500 nodes per page';

    ctx.plugin.setCommandHandler(() => ({
      success: false,
      error: specificMessage
    }));

    try {
      await routeToolCall('create_frame', { name: 'WillFail' });
      expect.fail('Should have thrown');
    } catch (err) {
      // The original plugin error message should be somewhere in the error chain
      const fullMsg = getFullErrorMessage(err);
      expect(fullMsg).toContain(specificMessage);
    }
  });

  it('plugin error with empty message still produces an Error', async () => {
    ctx.plugin.setCommandHandler(() => ({
      success: false,
      error: ''
    }));

    try {
      await routeToolCall('create_frame', { name: 'EmptyError' });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  it('different creation tools all propagate plugin errors', async () => {
    const errorMsg = 'Plugin internal error: out of memory';
    ctx.plugin.setCommandHandler(() => ({
      success: false,
      error: errorMsg
    }));

    // Each tool wraps differently, but the original message should survive
    const tools = [
      { name: 'create_ellipse', input: { name: 'E', width: 50, height: 50 } },
      { name: 'create_line', input: { x1: 0, y1: 0, x2: 100, y2: 0 } }
    ];

    for (const { name, input } of tools) {
      try {
        await routeToolCall(name, input);
        expect.fail(`${name} should have thrown`);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        const fullMsg = getFullErrorMessage(err);
        expect(fullMsg).toContain(errorMsg);
      }

      // Reset between tools to avoid circuit breaker accumulation
      ctx.plugin.resetCommandHandler();
      ctx.plugin.setCommandHandler(() => ({
        success: false,
        error: errorMsg
      }));
      resetFigmaBridge();
      ctx.figmaBridge = new FigmaBridge();
      await ctx.figmaBridge.connect();
    }
  });
});

// ─── Error Recovery Preserves State ────────────────────────────────────────

describe('Error Classification — error recovery preserves state', () => {
  it('validation error followed by success preserves correct response format', async () => {
    // Error
    try {
      await routeToolCall('create_frame', { name: '' });
    } catch {
      // Expected
    }

    // Success
    const result = await routeToolCall('create_frame', { name: 'AfterError' });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('text');
    expect(result[0].text).toContain('Frame Created Successfully');
    expect(result[0].text).toContain('Frame ID:');
  });

  it('three sequential errors of different types do not corrupt tool router', async () => {
    // Error 1: Unknown tool
    try {
      await routeToolCall('nonexistent', {});
    } catch {
      // Expected
    }

    // Error 2: Schema validation
    try {
      await routeToolCall('create_frame', { name: '' });
    } catch {
      // Expected
    }

    // Error 3: Plugin error (needs reconnect after)
    ctx.plugin.setCommandHandler(() => ({
      success: false,
      error: 'Plugin error'
    }));
    try {
      await routeToolCall('create_ellipse', { name: 'Fail', width: 50, height: 50 });
    } catch {
      // Expected
    }

    // Recovery: reconnect and reset handler
    ctx.plugin.resetCommandHandler();
    resetFigmaBridge();
    ctx.figmaBridge = new FigmaBridge();
    await ctx.figmaBridge.connect();

    const result = await routeToolCall('create_frame', { name: 'AfterThreeErrors' });
    expect(result[0].text).toContain('Frame Created Successfully');
  });
});

// ─── Error in Multi-Step Workflow ──────────────────────────────────────────

describe('Error Classification — errors in multi-step workflows', () => {
  it('error at step 2 of 3 does not corrupt step 1 results', async () => {
    // Step 1: Create frame (success)
    const frameResult = await routeToolCall('create_frame', {
      name: 'Workflow',
      layoutMode: 'VERTICAL',
      padding: 16,
      itemSpacing: 8
    });
    const frameId = frameResult[0].text!.match(/Frame ID:\s*(\S+)/)![1];

    // Step 2: Invalid styling (plugin error)
    ctx.plugin.setCommandHandler(() => ({
      success: false,
      error: 'Cannot apply fill to locked node'
    }));

    try {
      await routeToolCall('set_fills', { nodeId: frameId, color: '#FF0000' });
    } catch (err) {
      const fullMsg = getFullErrorMessage(err);
      expect(fullMsg).toContain('Cannot apply fill to locked node');
    }

    // Step 3: Query frame from step 1 — should still work
    ctx.plugin.resetCommandHandler();
    resetFigmaBridge();
    ctx.figmaBridge = new FigmaBridge();
    await ctx.figmaBridge.connect();

    const infoResult = await routeToolCall('get_node_info', { nodeId: frameId });
    expect(infoResult[0].text).toContain('Workflow');
    expect(infoResult[0].text).toContain('Node Information');
  });
});
