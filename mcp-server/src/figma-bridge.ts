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
import { ErrorCode, createError, type StructuredError } from './errors/index.js';

/**
 * Figma Bridge Error with structured error support
 * (Defined early because CircuitBreaker uses it)
 */
export class FigmaBridgeError extends Error {
  public readonly structuredError: StructuredError;

  constructor(errorOrMessage: StructuredError | string, legacyCode?: string) {
    if (typeof errorOrMessage === 'string') {
      // Legacy constructor support: (message, code)
      const code = (legacyCode as ErrorCode) || ErrorCode.SYS_INTERNAL;
      const structured = createError(code, errorOrMessage);
      super(errorOrMessage);
      this.structuredError = structured;
    } else {
      // New constructor: (StructuredError)
      super(errorOrMessage.message);
      this.structuredError = errorOrMessage;
    }
    this.name = 'FigmaBridgeError';
  }

  /** Machine-readable error code */
  get code(): ErrorCode {
    return this.structuredError.code;
  }

  /** Suggested action to resolve */
  get suggestion(): string | undefined {
    return this.structuredError.suggestion;
  }

  /** Additional error details */
  get details(): Record<string, unknown> | undefined {
    return this.structuredError.details;
  }
}

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
        throw new FigmaBridgeError(
          createError(ErrorCode.SYS_CIRCUIT_OPEN, 'Circuit breaker is OPEN - service unavailable')
        );
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
 * Request message sent to Figma plugin
 */
export interface FigmaRequest {
  id: string;
  type: string;
  payload: unknown;
}

/**
 * Response message schema (used for runtime validation)
 */
const responseSchema = z.object({
  id: z.string(),
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional()
});

export type FigmaResponse = z.infer<typeof responseSchema>;

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
  private connectingPromise: Promise<void> | null = null;
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

    // Prevent concurrent connection attempts — return existing promise if one is in flight
    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.connectingPromise = new Promise<void>((resolve, reject) => {
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
            reject(
              new FigmaBridgeError(
                createError(ErrorCode.CONN_FAILED, 'Failed to connect to Figma plugin')
              )
            );
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
            reject(new FigmaBridgeError(createError(ErrorCode.CONN_TIMEOUT, 'Connection timeout')));
          }
        }, 5000);
      } catch (error) {
        reject(error);
      }
    }).finally(() => {
      this.connectingPromise = null;
    });

    return this.connectingPromise;
  }

  /**
   * Handles incoming WebSocket messages
   * @param data
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

      const message: Record<string, unknown> = JSON.parse(messageStr) as Record<string, unknown>;

      // Handle connection/info messages (not responses to requests)
      if (message.type === 'connection' || message.type === 'info') {
        console.error(`[FigmaBridge] ${message.type}: ${message.message || 'message received'}`);
        return;
      }

      // Parse as response message
      const response = responseSchema.parse(message);

      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.id);
        pending.resolve(response);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Schema validation failed — not a response message, safe to ignore
        console.error('[FigmaBridge] Received non-response message (ignoring)');
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[FigmaBridge] Failed to parse message:', errorMessage);
      }
    }
  }

  /**
   * Handles disconnection and attempts to reconnect
   */
  private handleDisconnect(): void {
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(
        new FigmaBridgeError(createError(ErrorCode.CONN_LOST, 'Connection lost', { requestId: id }))
      );
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
   * @param type
   * @param payload
   */
  async sendToFigma<T = unknown>(type: string, payload: unknown): Promise<T> {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new FigmaBridgeError(
        createError(ErrorCode.CONN_NOT_CONNECTED, 'Not connected to Figma plugin')
      );
    }

    const ws = this.ws;
    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const request: FigmaRequest = { id, type, payload };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const pending = this.pendingRequests.get(id);
        if (pending && !pending.aborted) {
          this.pendingRequests.delete(id);
          reject(
            new FigmaBridgeError(
              createError(ErrorCode.OP_TIMEOUT, 'Request timeout', { requestId: id })
            )
          );
        }
      }, this.requestTimeout);

      this.pendingRequests.set(id, {
        resolve: (response: FigmaResponse) => {
          if (response.success) {
            resolve(response.data as T);
          } else {
            reject(
              new FigmaBridgeError(
                createError(ErrorCode.OP_FAILED, response.error || 'Request failed')
              )
            );
          }
        },
        reject,
        timeout,
        aborted: false
      });

      try {
        ws.send(JSON.stringify(request));
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
   * @param type
   * @param payload
   */
  sendToFigmaWithAbort<T = unknown>(
    type: string,
    payload: unknown
  ): { promise: Promise<T>; abort: RequestAbortController } {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new FigmaBridgeError(
        createError(ErrorCode.CONN_NOT_CONNECTED, 'Not connected to Figma plugin')
      );
    }

    const ws = this.ws;
    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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
          reject(
            new FigmaBridgeError(
              createError(ErrorCode.OP_TIMEOUT, 'Request timeout', { requestId: id })
            )
          );
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
            reject(
              new FigmaBridgeError(
                createError(ErrorCode.OP_FAILED, response.error || 'Request failed')
              )
            );
          }
        },
        reject,
        timeout,
        aborted: false
      });

      try {
        ws.send(JSON.stringify(request));
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
   * @param type
   * @param payload
   * @param options
   * @param options.maxRetries
   * @param options.baseDelay
   * @param options.maxDelay
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
        const isValidationError =
          (lastError instanceof FigmaBridgeError && lastError.code.startsWith('VAL_')) ||
          lastError.name === 'ZodError' ||
          lastError.name === 'ValidationError';
        if (isValidationError || attempt === maxRetries - 1) {
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

    throw lastError ?? new Error('All retry attempts failed');
  }

  /**
   * Checks if connected to Figma
   */
  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Returns detailed connection status for diagnostics
   */
  getConnectionStatus(): {
    connected: boolean;
    wsReadyState: number | undefined;
    pendingRequests: number;
    circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected(),
      wsReadyState: this.ws?.readyState,
      pendingRequests: this.pendingRequests.size,
      circuitBreakerState: this.circuitBreaker.getState(),
      reconnectAttempts: this.reconnectAttempts
    };
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
      pending.reject(
        new FigmaBridgeError(
          createError(ErrorCode.CONN_LOST, 'Bridge disconnected', { requestId: id })
        )
      );
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
