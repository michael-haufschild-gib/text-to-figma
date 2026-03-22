#!/usr/bin/env node

/**
 * Text-to-Figma MCP Server
 *
 * Provides Figma design automation through the Model Context Protocol.
 * Tools are registered via the routing system — see routing/register-tools.ts.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest
} from '@modelcontextprotocol/sdk/types.js';

import { getConfig, loadConfig } from './config.js';
import {
  isToolExecutionError,
  isFigmaBridgeError,
  formatStructuredError,
  createError
} from './errors/index.js';
import { getFigmaBridge } from './figma-bridge.js';
import { startHealthCheck, stopHealthCheck } from './health.js';
import { getLogger } from './monitoring/logger.js';
import { getFewShotPrompt } from './prompts/few-shot.js';
import { getZeroShotPrompt } from './prompts/zero-shot.js';
import { registerAllTools } from './routing/register-tools.js';
import { routeToolCall } from './routing/tool-router.js';
import { getToolRegistry } from './routing/tool-registry.js';
import { VERSION } from './version.js';
import { ensureWebSocketServer, stopWebSocketServer } from './websocket-spawner.js';

/**
 * Initialize MCP Server
 */
const server = new Server(
  { name: 'text-to-figma', version: VERSION },
  { capabilities: { tools: {}, prompts: {} } }
);

/**
 * Handler: list available tools
 */
server.setRequestHandler(ListToolsRequestSchema, () => {
  const registry = getToolRegistry();
  return { tools: registry.listDefinitions() };
});

/**
 * Handler: list available prompts
 */
server.setRequestHandler(ListPromptsRequestSchema, () => {
  return {
    prompts: [
      {
        name: 'text-to-figma-system',
        description:
          'Zero-shot system prompt: HTML/CSS to Figma mental model, primitive composition patterns, and design constraints',
        arguments: []
      },
      {
        name: 'text-to-figma-examples',
        description:
          'Few-shot examples: Complete workflows for building UI components (button, card, form, navbar) from primitives',
        arguments: []
      }
    ]
  };
});

/**
 * Handler: get prompt content
 */
server.setRequestHandler(GetPromptRequestSchema, (request) => {
  const { name } = request.params;

  switch (name) {
    case 'text-to-figma-system': {
      const systemPrompt = getZeroShotPrompt();
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'Please review the Text-to-Figma system prompt to understand how to think about Figma design in HTML/CSS terms and compose UI components from primitives.'
            }
          },
          {
            role: 'assistant',
            content: { type: 'text', text: systemPrompt }
          }
        ]
      };
    }

    case 'text-to-figma-examples': {
      const fewShotPrompt = getFewShotPrompt();
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'Please show me complete examples of building UI components in Figma from primitives.'
            }
          },
          {
            role: 'assistant',
            content: { type: 'text', text: fewShotPrompt }
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

/**
 * Handler: call a tool
 *
 * Delegates to the routing system which validates input, executes the
 * tool, and formats the response.
 */
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;

  try {
    const content = await routeToolCall(name, args);
    return { content };
  } catch (error) {
    // Format error with structured code when available
    let errorText: string;

    if (isFigmaBridgeError(error)) {
      errorText = formatStructuredError(error.structuredError);
    } else if (isToolExecutionError(error)) {
      const structured = createError(error.errorCode, error.message);
      errorText = formatStructuredError(structured);
    } else {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errorText = `Error: ${errorMessage}`;
    }

    return {
      content: [{ type: 'text', text: errorText }],
      isError: true
    };
  }
});

/**
 * Main server startup
 */
async function main(): Promise<void> {
  console.error('[MCP Server] Starting Text-to-Figma MCP Server...');

  // Load configuration
  loadConfig();
  const configValues = getConfig();
  console.error('[MCP Server] Configuration loaded');

  // Sync logger with configured LOG_LEVEL.
  // Module-level loggers are created before loadConfig() runs (ESM import order).
  // Because child loggers share the root config by reference, updating the root
  // propagates to all existing loggers.
  getLogger().setConfig({ level: configValues.LOG_LEVEL });

  // Register all tools
  registerAllTools();

  // Start health check server if enabled
  try {
    await startHealthCheck();
    const config = getConfig();
    if (config.HEALTH_CHECK_ENABLED) {
      console.error(`[MCP Server] Health check server started on port ${config.HEALTH_CHECK_PORT}`);
    }
  } catch (error) {
    console.error('[MCP Server] Warning: Could not start health check server:', error);
  }

  // Auto-spawn WebSocket server if not already running
  console.error('[MCP Server] Ensuring WebSocket server is running...');
  const spawnResult = await ensureWebSocketServer();

  if (!spawnResult.success) {
    console.error('[MCP Server] Warning: WebSocket server is not available.');
    console.error(
      '[MCP Server] Figma integration will not work until the WebSocket server is running.'
    );
    console.error('[MCP Server] Constraint validation tools will still work.');
  } else if (spawnResult.alreadyRunning) {
    console.error('[MCP Server] Using existing WebSocket server.');
  } else if (spawnResult.spawned) {
    console.error('[MCP Server] WebSocket server auto-started successfully.');
  }

  // Connect to Figma bridge with retry
  const bridge = getFigmaBridge();
  try {
    await bridge.connect();
    console.error('[MCP Server] Connected to Figma WebSocket bridge');
  } catch (_connectErr) {
    console.error(
      '[MCP Server] Warning: Could not connect to Figma bridge initially. Will retry automatically.'
    );
    console.error(
      '[MCP Server] Figma integration will become available once WebSocket server is running.'
    );
    console.error('[MCP Server] Constraint validation tools will work immediately.');
  }

  // Create transport and connect
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[MCP Server] Server running and ready for requests');

  // Handle cleanup on exit
  const shutdown = async (signal: string): Promise<void> => {
    console.error(`[MCP Server] Received ${signal}, shutting down gracefully...`);

    const config = getConfig();
    const shutdownTimeout = config.GRACEFUL_SHUTDOWN_TIMEOUT;

    const forceShutdownTimer = setTimeout(() => {
      console.error('[MCP Server] Graceful shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, shutdownTimeout);

    try {
      console.error('[MCP Server] Stopping health check server...');
      await stopHealthCheck();

      console.error('[MCP Server] Disconnecting from Figma bridge...');
      bridge.disconnect();

      console.error('[MCP Server] Stopping WebSocket server if spawned...');
      stopWebSocketServer();

      console.error('[MCP Server] Closing MCP server transport...');
      await server.close();

      clearTimeout(forceShutdownTimer);
      console.error('[MCP Server] Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('[MCP Server] Error during shutdown:', error);
      clearTimeout(forceShutdownTimer);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => {
    shutdown('SIGINT').catch((err: unknown) => {
      console.error('[MCP Server] Shutdown error:', err);
      process.exit(1);
    });
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch((err: unknown) => {
      console.error('[MCP Server] Shutdown error:', err);
      process.exit(1);
    });
  });
}

// Start the server
main().catch((error) => {
  console.error('[MCP Server] Fatal error:', error);
  process.exit(1);
});
