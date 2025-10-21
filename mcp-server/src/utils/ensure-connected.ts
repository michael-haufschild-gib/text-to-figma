/**
 * Utility to ensure Figma bridge is connected before tool execution
 *
 * This helper addresses the common issue where tools fail with "not connected"
 * errors even though the bridge can auto-reconnect. It attempts to establish
 * a connection if not already connected.
 */

import { getFigmaBridge } from '../figma-bridge.js';

/**
 * Ensures the Figma bridge is connected, attempting to connect if needed
 *
 * This function:
 * 1. Checks if already connected (fast path)
 * 2. Attempts to connect if not connected (with timeout)
 * 3. Returns immediately if connection successful
 * 4. Throws error only if connection genuinely fails
 *
 * Usage in tools:
 * ```typescript
 * await ensureConnected();
 * const response = await bridge.sendToFigma(...);
 * ```
 *
 * @param timeoutMs - Maximum time to wait for connection (default: 5000ms)
 * @throws Error if unable to connect within timeout
 */
export async function ensureConnected(timeoutMs = 5000): Promise<void> {
  const bridge = getFigmaBridge();

  // Fast path: already connected
  if (bridge.isConnected()) {
    return;
  }

  // Attempt to connect with timeout
  const connectPromise = bridge.connect();
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          'Failed to connect to Figma plugin. Please ensure:\n' +
            '1. Figma Desktop app is running\n' +
            '2. The text-to-figma plugin is open in a Figma file\n' +
            '3. The WebSocket server is running (check docker-compose)'
        )
      );
    }, timeoutMs);
  });

  try {
    await Promise.race([connectPromise, timeoutPromise]);
  } catch (error) {
    // Re-throw with helpful context
    throw error;
  }
}

/**
 * Better pattern: Use sendToFigmaWithRetry which handles reconnection automatically
 *
 * Instead of:
 * ```typescript
 * if (!bridge.isConnected()) {
 *   throw new Error('Not connected');
 * }
 * const response = await bridge.sendToFigma(...);
 * ```
 *
 * Use:
 * ```typescript
 * const response = await bridge.sendToFigmaWithRetry(...);
 * ```
 *
 * The sendToFigmaWithRetry method:
 * - Automatically attempts reconnection if disconnected
 * - Has exponential backoff retry logic
 * - Uses circuit breaker to prevent cascading failures
 * - More resilient to temporary connection issues
 */
