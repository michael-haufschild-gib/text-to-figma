/**
 * Figma Bridge - WebSocket Client
 *
 * Manages WebSocket connection to Figma plugin and provides
 * promise-based request/response communication with retry logic
 * and circuit breaker pattern.
 */

import WebSocket from 'ws';
import { z } from 'zod';
import { getConfig } from './config.js';

/**
 * Circuit breaker states
 */
enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject requests immediately
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

/**
 * Circuit breaker for preventing cascading failures
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(
    private readonly threshold: number,
    private readonly resetTimeout: number
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const config = getConfig();

    if (!config.CIRCUIT_BREAKER_ENABLED) {
      return fn();
    }

    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 2) {
        this.state = CircuitState.CLOSED;
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successCount = 0;
  }
}

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
  constructor(
    message: string,
    public code: string
  ) {
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
  timeout: ReturnType<typeof setTimeout>;
  aborted: boolean;
}

/**
 * Abort controller for cancelling requests
 */
export interface RequestAbortController {
  abort: () => void;
  aborted: boolean;
}

/**
 * Figma Bridge WebSocket Client
 */
export class FigmaBridge {
  private ws: WebSocket | null = null;
  private connected = false;
  private pendingRequests = new Map<string, PendingRequest>();
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly maxReconnectAttempts: number;
  private readonly wsUrl: string;
  private readonly requestTimeout: number;
  private readonly healthCheckIntervalMs = 10000; // 10 seconds

  constructor() {
    const config = getConfig();
    this.maxReconnectAttempts = config.FIGMA_MAX_RECONNECT_ATTEMPTS;
    this.wsUrl = config.FIGMA_WS_URL;
    this.requestTimeout = config.FIGMA_REQUEST_TIMEOUT;
    this.circuitBreaker = new CircuitBreaker(
      config.CIRCUIT_BREAKER_THRESHOLD,
      config.CIRCUIT_BREAKER_RESET_TIMEOUT
    );

    // Start periodic health check
    this.startHealthCheck();
  }

  /**
   * Connects to the Figma WebSocket server
   */
  async connect(): Promise<void> {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.on('open', () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          console.error('[FigmaBridge] Connected to Figma plugin');

          // Reset circuit breaker on successful connection
          this.circuitBreaker.reset();

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
      // Type guard: ensure data is string or Buffer before converting
      let messageStr: string;
      if (typeof data === 'string') {
        messageStr = data;
      } else if (Buffer.isBuffer(data)) {
        messageStr = data.toString('utf-8');
      } else if (Array.isArray(data)) {
        messageStr = Buffer.concat(data).toString('utf-8');
      } else {
        console.error('[FigmaBridge] Unsupported data type:', typeof data);
        return;
      }

      const message: unknown = JSON.parse(messageStr);
      const response = responseSchema.parse(message);

      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.id);
        pending.resolve(response);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[FigmaBridge] Failed to parse message:', errorMessage);
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
      console.error(
        `[FigmaBridge] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );

      this.reconnectTimeout = setTimeout(() => {
        this.connect().catch((connectError: unknown) => {
          const errorMessage =
            connectError instanceof Error ? connectError.message : 'Unknown error';
          console.error('[FigmaBridge] Reconnection failed:', errorMessage);
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
        const pending = this.pendingRequests.get(id);
        if (pending && !pending.aborted) {
          this.pendingRequests.delete(id);
          reject(new FigmaBridgeError('Request timeout', 'REQUEST_TIMEOUT'));
        }
      }, this.requestTimeout);

      this.pendingRequests.set(id, {
        resolve: (response: FigmaResponse) => {
          if (response.success) {
            resolve(response.data as T);
          } else {
            reject(new FigmaBridgeError(response.error || 'Request failed', 'REQUEST_FAILED'));
          }
        },
        reject,
        timeout,
        aborted: false
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
   * Sends a cancellable request to Figma
   * Returns both the promise and an abort controller
   */
  sendToFigmaWithAbort<T = unknown>(
    type: string,
    payload: unknown
  ): { promise: Promise<T>; abort: RequestAbortController } {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new FigmaBridgeError('Not connected to Figma plugin', 'NOT_CONNECTED');
    }

    const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const request: FigmaRequest = { id, type, payload };

    const abortController: RequestAbortController = {
      abort: () => {
        const pending = this.pendingRequests.get(id);
        if (pending && !pending.aborted) {
          pending.aborted = true;
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(id);
        }
      },
      aborted: false
    };

    const promise = new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const pending = this.pendingRequests.get(id);
        if (pending && !pending.aborted) {
          this.pendingRequests.delete(id);
          reject(new FigmaBridgeError('Request timeout', 'REQUEST_TIMEOUT'));
        }
      }, this.requestTimeout);

      this.pendingRequests.set(id, {
        resolve: (response: FigmaResponse) => {
          const pending = this.pendingRequests.get(id);
          if (pending?.aborted) {
            return; // Request was aborted, don't resolve
          }
          if (response.success) {
            resolve(response.data as T);
          } else {
            reject(new FigmaBridgeError(response.error || 'Request failed', 'REQUEST_FAILED'));
          }
        },
        reject,
        timeout,
        aborted: false
      });

      try {
        this.ws!.send(JSON.stringify(request));
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });

    // Link abort controller aborted property
    promise.catch(() => {
      abortController.aborted = true;
    });

    return { promise, abort: abortController };
  }

  /**
   * Sends a request with automatic retry and exponential backoff
   * Uses circuit breaker to prevent cascading failures
   */
  async sendToFigmaWithRetry<T = unknown>(
    type: string,
    payload: unknown,
    options?: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
    }
  ): Promise<T> {
    const config = getConfig();
    const maxRetries = options?.maxRetries ?? config.RETRY_MAX_ATTEMPTS;
    const baseDelay = options?.baseDelay ?? config.RETRY_BASE_DELAY;
    const maxDelay = options?.maxDelay ?? config.RETRY_MAX_DELAY;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Use circuit breaker to wrap the request
        return await this.circuitBreaker.execute(async () => {
          return await this.sendToFigma<T>(type, payload);
        });
      } catch (error) {
        lastError = error as Error;

        // Don't retry on validation errors or if it's the last attempt
        if (
          lastError.message.includes('validation') ||
          lastError.message.includes('Invalid') ||
          attempt === maxRetries - 1
        ) {
          throw lastError;
        }

        // Calculate backoff delay with jitter
        const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 1000, maxDelay);

        console.error(
          `[FigmaBridge] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms...`
        );

        // If not connected, try to reconnect
        if (!this.connected) {
          try {
            await this.connect();
          } catch (connectError) {
            console.error('[FigmaBridge] Reconnection failed:', connectError);
          }
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error(lastError?.message ?? 'All retry attempts failed');
  }

  /**
   * Checks if connected to Figma
   */
  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Starts periodic health check to ensure connection stays alive
   * and attempts reconnection if disconnected
   */
  private startHealthCheck(): void {
    // Clear any existing interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      // If not connected, attempt to reconnect
      if (!this.isConnected()) {
        // Reset reconnect attempts if we've been disconnected for a while
        // This allows recovery after extended downtime without manual restart
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error(
            '[FigmaBridge] Max reconnect attempts reached, resetting counter for recovery...'
          );
          this.reconnectAttempts = 0;
        }

        console.error('[FigmaBridge] Health check: Not connected, attempting to reconnect...');
        this.connect().catch((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('[FigmaBridge] Health check reconnection failed:', errorMessage);
        });
      }
    }, this.healthCheckIntervalMs);
  }

  /**
   * Stops the health check interval
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Disconnects from Figma
   */
  disconnect(): void {
    // Stop health check
    this.stopHealthCheck();

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
