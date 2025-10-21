#!/usr/bin/env node

/**
 * Text-to-Figma MCP Server
 *
 * Provides design constraint validation and Figma integration
 * through the Model Context Protocol.
 *
 * @remarks
 * This server uses a modular routing system with tool registry.
 * See routing/ directory for implementation details.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest
} from '@modelcontextprotocol/sdk/types.js';

import { getConfig, loadConfig } from './config.js';
import { getFigmaBridge } from './figma-bridge.js';
import { startHealthCheck, stopHealthCheck } from './health.js';
import { getLogger } from './monitoring/logger.js';
import { registerAllTools } from './routing/register-tools.js';
import { getToolRegistry } from './routing/tool-registry.js';
import { routeToolCall } from './routing/tool-router.js';

// Import constraint utilities for legacy tools
import {
  hexToRgb,
  validateContrast,
  validateSpacing,
  validateTypography,
  type ContrastValidationResult,
  type RGB,
  type SpacingConstraintResult,
  type TypographyConstraintResult
} from './constraints/index.js';
import { getFewShotExamples, getFewShotPrompt } from './prompts/few-shot.js';
import { getZeroShotPrompt } from './prompts/zero-shot.js';

const logger = getLogger().child({ component: 'mcp-server' });

/**
 * Initialize MCP Server
 */
const server = new Server(
  {
    name: 'text-to-figma',
    version: '0.1.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

/**
 * Handler for listing available tools
 *
 * Uses tool registry to dynamically list all registered tools.
 * Replaces the manual TOOLS array from the original implementation.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const registry = getToolRegistry();
  const tools = registry.listDefinitions();

  // Add legacy tools that don't have separate tool files yet
  const legacyTools = [
    {
      name: 'validate_spacing',
      description: 'Validates spacing values against the 8pt grid system',
      inputSchema: {
        type: 'object' as const,
        properties: {
          value: {
            type: 'number' as const,
            description: 'Spacing value in pixels to validate'
          }
        },
        required: ['value']
      }
    },
    {
      name: 'validate_typography',
      description: 'Validates font sizes against the modular type scale',
      inputSchema: {
        type: 'object' as const,
        properties: {
          fontSize: {
            type: 'number' as const,
            description: 'Font size in pixels to validate'
          }
        },
        required: ['fontSize']
      }
    },
    {
      name: 'validate_contrast',
      description: 'Validates color contrast ratios for WCAG AA/AAA compliance',
      inputSchema: {
        type: 'object' as const,
        properties: {
          foreground: {
            type: 'string' as const,
            description: 'Foreground color in hex format (e.g., #000000)'
          },
          background: {
            type: 'string' as const,
            description: 'Background color in hex format (e.g., #FFFFFF)'
          }
        },
        required: ['foreground', 'background']
      }
    },
    {
      name: 'send_to_figma',
      description: 'Sends commands to Figma plugin for creating or modifying designs',
      inputSchema: {
        type: 'object' as const,
        properties: {
          command: {
            type: 'string' as const,
            description: 'Command type to send to Figma'
          },
          data: {
            type: 'object' as const,
            description: 'Command data payload'
          }
        },
        required: ['command', 'data']
      }
    },
    {
      name: 'get_constraints',
      description: 'Returns available design system constraints',
      inputSchema: {
        type: 'object' as const,
        properties: {}
      }
    },
    {
      name: 'get_system_prompt',
      description:
        'Returns the zero-shot system prompt for Text-to-Figma with HTML/CSS mappings and constraint guidelines',
      inputSchema: {
        type: 'object' as const,
        properties: {}
      }
    },
    {
      name: 'get_few_shot_prompt',
      description:
        'Returns the few-shot system prompt with complete workflow examples for creating UI components (button, card, form, navbar)',
      inputSchema: {
        type: 'object' as const,
        properties: {}
      }
    },
    {
      name: 'get_few_shot_examples',
      description: 'Returns just the few-shot examples as structured data for reference',
      inputSchema: {
        type: 'object' as const,
        properties: {}
      }
    }
  ];

  return {
    tools: [...tools, ...legacyTools]
  };
});

/**
 * Handler for calling tools
 *
 * Routes tool calls through the new routing system for registered tools,
 * falls back to legacy handling for non-registered tools.
 */
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;

  try {
    // Try routing through new system
    const registry = getToolRegistry();
    const handler = registry.get(name);

    if (handler) {
      // Use new routing system
      const content = await routeToolCall(name, args);
      return { content };
    }

    // Fall back to legacy handling for non-registered tools
    logger.warn('Using legacy handler', { tool: name });

    switch (name) {
      case 'validate_spacing': {
        const { value } = args as { value: number };
        const result: SpacingConstraintResult = validateSpacing(value);

        let text = `Spacing Validation Result:\n`;
        text += `Value: ${result.value}px\n`;
        text += `Valid: ${result.isValid ? 'Yes' : 'No'}\n`;

        if (!result.isValid && result.suggestedValue !== undefined) {
          text += `Suggested: ${result.suggestedValue}px\n`;
          text += `Message: ${result.message || ''}\n`;
        }

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'validate_typography': {
        const { fontSize } = args as { fontSize: number };
        const result: TypographyConstraintResult = validateTypography(fontSize);

        let text = `Typography Validation Result:\n`;
        text += `Font Size: ${result.fontSize}px\n`;
        text += `Valid: ${result.isValid ? 'Yes' : 'No'}\n`;

        if (result.recommendedLineHeight !== undefined) {
          text += `Recommended Line Height: ${result.recommendedLineHeight}px\n`;
        }

        if (!result.isValid && result.suggestedFontSize !== undefined) {
          text += `Suggested: ${result.suggestedFontSize}px\n`;
          text += `Message: ${result.message || ''}\n`;
        }

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'validate_contrast': {
        const { foreground, background } = args as { foreground: string; background: string };
        const fgRgb: RGB | null = hexToRgb(foreground);
        const bgRgb: RGB | null = hexToRgb(background);

        if (!fgRgb || !bgRgb) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Invalid hex color format. Use format like #000000'
              }
            ]
          };
        }

        const result: ContrastValidationResult = validateContrast(fgRgb, bgRgb);

        let text = `Contrast Validation Result:\n`;
        text += `Foreground: ${foreground}\n`;
        text += `Background: ${background}\n`;
        text += `Contrast Ratio: ${result.ratio.toFixed(2)}:1\n\n`;
        text += `WCAG AA:\n`;
        text += `  Normal Text: ${result.passes.AA.normal ? 'Pass' : 'Fail'}\n`;
        text += `  Large Text: ${result.passes.AA.large ? 'Pass' : 'Fail'}\n`;
        text += `WCAG AAA:\n`;
        text += `  Normal Text: ${result.passes.AAA.normal ? 'Pass' : 'Fail'}\n`;
        text += `  Large Text: ${result.passes.AAA.large ? 'Pass' : 'Fail'}\n\n`;
        text += `Recommendation: ${result.recommendation}\n`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'send_to_figma': {
        const { command, data } = args as { command: string; data: Record<string, unknown> };
        const bridge = getFigmaBridge();

        if (!bridge.isConnected()) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Not connected to Figma plugin. Ensure the plugin is running and WebSocket bridge is active.'
              }
            ]
          };
        }

        try {
          const response = await bridge.sendToFigma(command, data);
          return {
            content: [
              {
                type: 'text',
                text: `Success: Command sent to Figma\n${JSON.stringify(response, null, 2)}`
              }
            ]
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return {
            content: [
              {
                type: 'text',
                text: `Error: Failed to send command to Figma\n${errorMessage}`
              }
            ]
          };
        }
      }

      case 'get_constraints': {
        const text = `Text-to-Figma Primitive Design System

PHILOSOPHY: Expose ALL Figma primitives. NO pre-made components.
Just like Figma itself - there's no "draw button" functionality.
You must COMPOSE designs from raw primitives.

═══════════════════════════════════════

DESIGN SYSTEM CONSTRAINTS:

SPACING (8pt Grid):
Valid values: 0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128

TYPOGRAPHY (Modular Scale):
Valid font sizes: 12, 16, 20, 24, 32, 40, 48, 64

COLOR (WCAG Contrast):
- AA Normal Text: 4.5:1 minimum
- AA Large Text: 3.0:1 minimum
- AAA Normal Text: 7.0:1 minimum
- AAA Large Text: 4.5:1 minimum

═══════════════════════════════════════

For complete tool list and examples, use get_system_prompt or get_few_shot_prompt.
`;

        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'get_system_prompt': {
        const text = getZeroShotPrompt();
        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'get_few_shot_prompt': {
        const text = getFewShotPrompt();
        return {
          content: [{ type: 'text', text }]
        };
      }

      case 'get_few_shot_examples': {
        const examples = getFewShotExamples();
        const text = JSON.stringify(examples, null, 2);
        return {
          content: [{ type: 'text', text }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Tool execution failed', error instanceof Error ? error : undefined, {
      tool: name,
      args
    });
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`
        }
      ]
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
  console.error('[MCP Server] Configuration loaded');

  // Register all tools
  registerAllTools();
  console.error('[MCP Server] Tools registered');

  // Start health check server if enabled
  try {
    startHealthCheck();
    const config = getConfig();
    if (config.HEALTH_CHECK_ENABLED) {
      console.error(`[MCP Server] Health check server started on port ${config.HEALTH_CHECK_PORT}`);
    }
  } catch (error) {
    console.error('[MCP Server] Warning: Could not start health check server:', error);
  }

  // Connect to Figma bridge
  const bridge = getFigmaBridge();
  try {
    await bridge.connect();
    console.error('[MCP Server] Connected to Figma WebSocket bridge');
  } catch (error) {
    console.error(
      '[MCP Server] Warning: Could not connect to Figma bridge. Figma integration will be unavailable.'
    );
    console.error('[MCP Server] Constraint validation tools will still work.');
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

    // Set a timeout for forced shutdown
    const forceShutdownTimer = setTimeout(() => {
      console.error('[MCP Server] Graceful shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, shutdownTimeout);

    try {
      // Stop accepting new requests
      console.error('[MCP Server] Stopping health check server...');
      await stopHealthCheck();

      // Disconnect from Figma bridge
      console.error('[MCP Server] Disconnecting from Figma bridge...');
      bridge.disconnect();

      // Close MCP server transport
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
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

// Start the server
main().catch((error) => {
  console.error('[MCP Server] Fatal error:', error);
  process.exit(1);
});
