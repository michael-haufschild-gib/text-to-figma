/**
 * Figma Bridge - WebSocket Client
 *
 * Manages WebSocket connection to Figma plugin and provides
 * promise-based request/response communication.
 */

import WebSocket from 'ws';
import { z } from 'zod';

/**
 * Request timeout in milliseconds
 */
const REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * WebSocket connection URL
 */
const FIGMA_WS_URL = 'ws://localhost:8080';

/**
 * Request message schema
 */
const requestSchema = z.object({
  id: z.string(),
  type: z.string(),
  payload: z.unknown()
});

/**
 * Response message schema
 */
const responseSchema = z.object({
  id: z.string(),
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional()
});

export type FigmaRequest = z.infer<typeof requestSchema>;
export type FigmaResponse = z.infer<typeof responseSchema>;

/**
 * Figma Bridge Error
 */
export class FigmaBridgeError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'FigmaBridgeError';
  }
}

/**
 * Pending request tracking
 */
interface PendingRequest {
  resolve: (value: FigmaResponse) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Figma Bridge WebSocket Client
 */
export class FigmaBridge {
  private ws: WebSocket | null = null;
  private connected = false;
  private pendingRequests = new Map<string, PendingRequest>();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  /**
   * Connects to the Figma WebSocket server
   */
  async connect(): Promise<void> {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(FIGMA_WS_URL);

        this.ws.on('open', () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          console.error('[FigmaBridge] Connected to Figma plugin');
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error: Error) => {
          console.error('[FigmaBridge] WebSocket error:', error.message);
          if (!this.connected) {
            reject(new FigmaBridgeError('Failed to connect to Figma plugin', 'CONNECTION_FAILED'));
          }
        });

        this.ws.on('close', () => {
          this.connected = false;
          console.error('[FigmaBridge] Disconnected from Figma plugin');
          this.handleDisconnect();
        });

        // Connection timeout
        setTimeout(() => {
          if (!this.connected) {
            this.ws?.close();
            reject(new FigmaBridgeError('Connection timeout', 'CONNECTION_TIMEOUT'));
          }
        }, 5000);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handles incoming WebSocket messages
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      const response = responseSchema.parse(message);

      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.id);
        pending.resolve(response);
      }
    } catch (error) {
      console.error('[FigmaBridge] Failed to parse message:', error);
    }
  }

  /**
   * Handles disconnection and attempts to reconnect
   */
  private handleDisconnect(): void {
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new FigmaBridgeError('Connection lost', 'CONNECTION_LOST'));
      this.pendingRequests.delete(id);
    }

    // Attempt to reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.error(`[FigmaBridge] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      this.reconnectTimeout = setTimeout(() => {
        this.connect().catch((error) => {
          console.error('[FigmaBridge] Reconnection failed:', error.message);
        });
      }, delay);
    }
  }

  /**
   * Sends a request to Figma and returns a promise for the response
   */
  async sendToFigma<T = unknown>(type: string, payload: unknown): Promise<T> {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new FigmaBridgeError('Not connected to Figma plugin', 'NOT_CONNECTED');
    }

    const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const request: FigmaRequest = { id, type, payload };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new FigmaBridgeError('Request timeout', 'REQUEST_TIMEOUT'));
      }, REQUEST_TIMEOUT);

      this.pendingRequests.set(id, {
        resolve: (response: FigmaResponse) => {
          if (response.success) {
            resolve(response.data as T);
          } else {
            reject(new FigmaBridgeError(
              response.error || 'Request failed',
              'REQUEST_FAILED'
            ));
          }
        },
        reject,
        timeout
      });

      try {
        this.ws!.send(JSON.stringify(request));
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  /**
   * Checks if connected to Figma
   */
  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Disconnects from Figma
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.reconnectAttempts = 0;

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new FigmaBridgeError('Bridge disconnected', 'DISCONNECTED'));
      this.pendingRequests.delete(id);
    }
  }
}

/**
 * Singleton instance
 */
let bridgeInstance: FigmaBridge | null = null;

/**
 * Gets the global Figma bridge instance
 */
export function getFigmaBridge(): FigmaBridge {
  if (!bridgeInstance) {
    bridgeInstance = new FigmaBridge();
  }
  return bridgeInstance;
}
