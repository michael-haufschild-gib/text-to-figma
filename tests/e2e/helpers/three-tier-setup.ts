/**
 * Three-Tier Test Setup
 *
 * Shared setup/teardown for e2e tests that need the full three-tier chain:
 *   MCP Server (in-process) → WebSocket Bridge → Simulated Figma Plugin
 *
 * Eliminates duplicated beforeAll/afterAll/beforeEach blocks across test files.
 */

import { vi } from 'vitest';
import { FigmaBridge, resetFigmaBridge } from '../../../mcp-server/src/figma-bridge.js';
import { registerAllTools } from '../../../mcp-server/src/routing/register-tools.js';
import { resetToolRegistry } from '../../../mcp-server/src/routing/tool-registry.js';
import { routeToolCall } from '../../../mcp-server/src/routing/tool-router.js';
import { resetNodeRegistry } from '../../../mcp-server/src/node-registry.js';
import { configureE2EEnv, restoreEnv } from './e2e-env.js';
import { startTestBridge, type TestBridgeHandle } from './test-bridge.js';
import { SimulatedFigmaPlugin } from './simulated-figma-plugin.js';

export interface ThreeTierContext {
  bridge: TestBridgeHandle;
  plugin: SimulatedFigmaPlugin;
  figmaBridge: FigmaBridge;
}

/**
 * Initialize the full three-tier chain for testing.
 * Call in beforeAll.
 */
export async function setupThreeTier(): Promise<ThreeTierContext> {
  vi.spyOn(console, 'error').mockImplementation(() => {});

  const bridge = startTestBridge();
  const plugin = new SimulatedFigmaPlugin();
  await plugin.connect(bridge.wsUrl);
  await plugin.waitForRegistration(bridge.server.state);

  configureE2EEnv(bridge.wsUrl);
  resetToolRegistry();
  registerAllTools();

  resetFigmaBridge();
  const figmaBridge = new FigmaBridge();
  await figmaBridge.connect();

  return { bridge, plugin, figmaBridge };
}

/**
 * Tear down the full three-tier chain.
 * Call in afterAll.
 */
export async function teardownThreeTier(ctx: ThreeTierContext): Promise<void> {
  ctx.figmaBridge?.disconnect();
  ctx.plugin?.disconnect();
  await ctx.bridge?.close();
  resetFigmaBridge();
  resetToolRegistry();
  restoreEnv();
  vi.restoreAllMocks();
}

/**
 * Reset per-test state (commands, node registry).
 * Call in beforeEach.
 */
export function resetPerTest(ctx: ThreeTierContext): void {
  ctx.plugin.clearCommands();
  ctx.plugin.resetCommandHandler();
  resetNodeRegistry();
}

/**
 * Helper: Create a parent frame and return its ID.
 * Many tools require a parentId that points to an existing frame.
 */
export async function createParentFrame(name = 'Container'): Promise<string> {
  const result = await routeToolCall('create_frame', {
    name,
    layoutMode: 'VERTICAL',
    padding: 16,
    itemSpacing: 8
  });
  const match = result[0].text!.match(/Frame ID:\s*(\S+)/);
  if (!match) {
    throw new Error(`Failed to extract frame ID from: ${result[0].text}`);
  }
  return match[1];
}

/**
 * Helper: Extract a node ID from a tool result text using a regex pattern.
 */
export function extractId(resultText: string, pattern: RegExp): string {
  const match = resultText.match(pattern);
  if (!match) {
    throw new Error(`Failed to extract ID with pattern ${pattern} from: ${resultText}`);
  }
  return match[1];
}
