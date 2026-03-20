/**
 * check_connection - Connection status verification tool
 *
 * Allows users to verify Figma plugin connection status before starting work.
 * Returns detailed connection information including latency, file info, and circuit breaker state.
 */

import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Connection status response from Figma plugin ping
 */
interface FigmaPingResponse {
  pong: boolean;
  timestamp: number;
  pluginVersion: string;
  fileName: string;
  currentPage: string;
}

/**
 * Result of connection check
 */
export interface CheckConnectionResult {
  connected: boolean;
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
      pendingRequests: status.pendingRequests,
      circuitBreakerState: status.circuitBreakerState,
      wsReadyState: status.wsReadyState,
      wsReadyStateText:
        status.wsReadyState !== undefined
          ? WS_READY_STATE_TEXT[status.wsReadyState] || 'UNKNOWN'
          : undefined,
      message:
        'Not connected to Figma plugin. Ensure Figma is open and the Text-to-Figma plugin is running.'
    };
  }

  // Try to ping Figma plugin and measure latency
  const startTime = Date.now();

  try {
    const pingResponse = await bridge.sendToFigma<FigmaPingResponse>('ping', {});
    const latencyMs = Date.now() - startTime;

    return {
      connected: true,
      latencyMs,
      figmaFile: pingResponse.fileName,
      currentPage: pingResponse.currentPage,
      pluginVersion: pingResponse.pluginVersion,
      pendingRequests: status.pendingRequests,
      circuitBreakerState: status.circuitBreakerState,
      wsReadyState: status.wsReadyState,
      wsReadyStateText:
        status.wsReadyState !== undefined
          ? WS_READY_STATE_TEXT[status.wsReadyState] || 'UNKNOWN'
          : undefined,
      message: `Connected to Figma. File: "${pingResponse.fileName}", Page: "${pingResponse.currentPage}"`
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    return {
      connected: true, // WebSocket is connected, but ping failed
      latencyMs,
      pendingRequests: status.pendingRequests,
      circuitBreakerState: status.circuitBreakerState,
      wsReadyState: status.wsReadyState,
      wsReadyStateText:
        status.wsReadyState !== undefined
          ? WS_READY_STATE_TEXT[status.wsReadyState] || 'UNKNOWN'
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
