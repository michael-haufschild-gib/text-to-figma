/**
 * check_connection - Connection status verification tool
 *
 * Allows users to verify Figma plugin connection status before starting work.
 * Returns detailed connection information including latency, file info, and circuit breaker state.
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';
import { defineHandler, textResponse } from '../routing/handler-utils.js';

/**
 * Zod schema for Figma plugin ping response validation
 */
const FigmaPingResponseSchema = z.object({
  pong: z.boolean(),
  timestamp: z.number(),
  pluginVersion: z.string(),
  fileName: z.string(),
  currentPage: z.string()
});

/**
 * Result of connection check
 */
export interface CheckConnectionResult {
  connected: boolean;
  pluginResponsive: boolean;
  latencyMs?: number;
  figmaFile?: string;
  currentPage?: string;
  pluginVersion?: string;
  pendingRequests: number;
  circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  wsReadyState?: number;
  wsReadyStateText?: string;
  message: string;
  error?: string;
}

/**
 * WebSocket ready state descriptions
 */
const WS_READY_STATE_TEXT: Record<number, string> = {
  0: 'CONNECTING',
  1: 'OPEN',
  2: 'CLOSING',
  3: 'CLOSED'
};

/**
 * Check the connection status to Figma
 */
export async function checkConnection(): Promise<CheckConnectionResult> {
  const bridge = getFigmaBridge();
  const status = bridge.getConnectionStatus();

  // If not connected, return early
  if (!status.connected) {
    return {
      connected: false,
      pluginResponsive: false,
      pendingRequests: status.pendingRequests,
      circuitBreakerState: status.circuitBreakerState,
      wsReadyState: status.wsReadyState,
      wsReadyStateText:
        status.wsReadyState !== undefined
          ? (WS_READY_STATE_TEXT[status.wsReadyState] ?? 'UNKNOWN')
          : undefined,
      message:
        'Not connected to Figma plugin. Ensure Figma is open and the Text-to-Figma plugin is running.'
    };
  }

  // Try to ping Figma plugin and measure latency
  const startTime = Date.now();

  try {
    const pingResponse = await bridge.sendToFigmaValidated('ping', {}, FigmaPingResponseSchema);
    const latencyMs = Date.now() - startTime;

    return {
      connected: true,
      pluginResponsive: true,
      latencyMs,
      figmaFile: pingResponse.fileName,
      currentPage: pingResponse.currentPage,
      pluginVersion: pingResponse.pluginVersion,
      pendingRequests: status.pendingRequests,
      circuitBreakerState: status.circuitBreakerState,
      wsReadyState: status.wsReadyState,
      wsReadyStateText:
        status.wsReadyState !== undefined
          ? (WS_READY_STATE_TEXT[status.wsReadyState] ?? 'UNKNOWN')
          : undefined,
      message: `Connected to Figma. File: "${pingResponse.fileName}", Page: "${pingResponse.currentPage}"`
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    return {
      connected: true,
      pluginResponsive: false,
      latencyMs,
      pendingRequests: status.pendingRequests,
      circuitBreakerState: status.circuitBreakerState,
      wsReadyState: status.wsReadyState,
      wsReadyStateText:
        status.wsReadyState !== undefined
          ? (WS_READY_STATE_TEXT[status.wsReadyState] ?? 'UNKNOWN')
          : undefined,
      message: 'WebSocket connected but Figma plugin did not respond to ping',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Tool definition for MCP server
 */
export const checkConnectionToolDefinition = {
  name: 'check_connection',
  description: `Verifies the connection status to Figma before starting work.

USE THIS TOOL:
- Before starting any design work to ensure Figma is ready
- When operations are failing to diagnose connection issues
- To verify which Figma file and page are currently active

RETURNS:
- Connection status (connected/disconnected)
- Round-trip latency in milliseconds
- Current Figma file name and page
- Plugin version
- Circuit breaker state (for advanced diagnostics)
- Pending request count

EXAMPLE OUTPUT:
{
  "connected": true,
  "latencyMs": 45,
  "figmaFile": "My Design",
  "currentPage": "Home",
  "pluginVersion": "1.0.0",
  "circuitBreakerState": "CLOSED"
}`,
  inputSchema: {
    type: 'object' as const,
    properties: {},
    required: [] as string[]
  },
  metadata: {
    tier: 1,
    category: 'diagnostic',
    usageFrequency: 'high',
    complexity: 'simple',
    tags: ['connection', 'status', 'diagnostic', 'health']
  }
};

export const handler = defineHandler<Record<string, never>, CheckConnectionResult>({
  name: 'check_connection',
  schema: z.object({}),
  execute: checkConnection,
  formatResponse: (result) => {
    let text: string;
    if (!result.connected) {
      text = `Connection Status: DISCONNECTED\n\n`;
    } else if (!result.pluginResponsive) {
      text = `Connection Status: DEGRADED (WebSocket connected, plugin not responding)\n\n`;
    } else {
      text = `Connection Status: CONNECTED\n\n`;
    }
    if (result.connected) {
      if (result.figmaFile) {
        text += `File: ${result.figmaFile}\n`;
      }
      if (result.currentPage) {
        text += `Page: ${result.currentPage}\n`;
      }
      if (result.latencyMs !== undefined) {
        text += `Latency: ${result.latencyMs}ms\n`;
      }
      if (result.pluginVersion) {
        text += `Plugin Version: ${result.pluginVersion}\n`;
      }
    }
    text += `\nDiagnostics:\n`;
    text += `  Circuit Breaker: ${result.circuitBreakerState}\n`;
    text += `  Pending Requests: ${result.pendingRequests}\n`;
    if (result.wsReadyStateText) {
      text += `  WebSocket State: ${result.wsReadyStateText}\n`;
    }
    if (result.error) {
      text += `\nWarning: ${result.error}\n`;
    }
    text += `\n${result.message}`;
    return textResponse(text);
  },
  definition: checkConnectionToolDefinition
});
