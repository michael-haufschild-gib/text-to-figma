/** Figma Bridge - WebSocket client with retry logic and circuit breaker. */

import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { z } from 'zod';
import { getConfig } from './config.js';
import { ErrorCode, FigmaBridgeError, createError } from './errors/index.js';
import {
  type FigmaContext,
  type FigmaNotification,
  type FigmaRequest,
  type FigmaResponse,
  notificationSchema,
  responseSchema
} from './figma-bridge-types.js';

// Re-export types so consumers can import from figma-bridge as before
export { FigmaBridgeError } from './errors/index.js';

/**
 * Minimal response schema for fire-and-forget tools that don't use the
 * plugin response data. Validates the response is a well-formed object
 * (catches null, undefined, and primitive responses from protocol failures)
 * while allowing any fields through.
 */
export const FigmaAckResponseSchema = z.object({}).passthrough();
export type {
  FigmaContext,
  FigmaNotification,
  FigmaRequest,
  FigmaResponse
} from './figma-bridge-types.js';

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
  /** Number of consecutive successes needed in HALF_OPEN state to close the circuit */
  private static readonly HALF_OPEN_SUCCESS_THRESHOLD = 2;

  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  private halfOpenProbeInFlight = false;

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
        // Transition to HALF_OPEN, but only allow one probe request through
        if (this.halfOpenProbeInFlight) {
          throw new FigmaBridgeError(
            createError(
              ErrorCode.SYS_CIRCUIT_OPEN,
              'Circuit breaker is HALF_OPEN - probe in progress'
            )
          );
        }
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        this.halfOpenProbeInFlight = true;
      } else {
        throw new FigmaBridgeError(
          createError(ErrorCode.SYS_CIRCUIT_OPEN, 'Circuit breaker is OPEN - service unavailable')
        );
      }
    } else if (this.state === CircuitState.HALF_OPEN && this.halfOpenProbeInFlight) {
      // Another request while HALF_OPEN probe is in flight — reject
      throw new FigmaBridgeError(
        createError(ErrorCode.SYS_CIRCUIT_OPEN, 'Circuit breaker is HALF_OPEN - probe in progress')
      );
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
    this.halfOpenProbeInFlight = false;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= CircuitBreaker.HALF_OPEN_SUCCESS_THRESHOLD) {
        this.state = CircuitState.CLOSED;
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.halfOpenProbeInFlight = false;

    if (this.state === CircuitState.HALF_OPEN || this.failures >= this.threshold) {
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
    this.halfOpenProbeInFlight = false;
  }
}

/** True when the failure happened before the request reached the plugin (safe to retry). */
function isPreSendFailure(error: Error): boolean {
  return (
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('not connected') ||
    error.message.includes('Circuit breaker is OPEN') ||
    (error instanceof FigmaBridgeError && error.code.startsWith('CONN_'))
  );
}

function isNonRetryableValidationError(error: Error): boolean {
  return (
    (error instanceof FigmaBridgeError && error.code.startsWith('VAL_')) ||
    error.name === 'ZodError' ||
    error.name === 'ValidationError'
  );
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
  private connectingPromise: Promise<void> | null = null;
  private latestContext: FigmaContext | null = null;

  /**
   * Optional callback invoked when the Figma context (page/file) changes
   * between consecutive responses. Consumers (e.g. the tool router) use
   * this to mark the node registry as stale.
   */
  onContextChange: ((prev: FigmaContext | null, next: FigmaContext) => void) | null = null;

  /**
   * Optional callback invoked when the Figma plugin pushes a notification
   * (e.g. document_changed, page_changed). These arrive outside the
   * request/response cycle — the user made a change in Figma directly.
   */
  onNotification: ((notification: FigmaNotification) => void) | null = null;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly maxReconnectAttempts: number;
  private readonly wsUrl: string;
  private readonly requestTimeout: number;
  private readonly healthCheckIntervalMs = 10000; // 10 seconds
  private static readonly CONNECTION_TIMEOUT_MS = 5000;

  constructor() {
    const config = getConfig();
    this.maxReconnectAttempts = config.FIGMA_MAX_RECONNECT_ATTEMPTS;
    this.wsUrl = config.FIGMA_WS_URL;
    this.requestTimeout = config.FIGMA_REQUEST_TIMEOUT;
    this.circuitBreaker = new CircuitBreaker(
      config.CIRCUIT_BREAKER_THRESHOLD,
      config.CIRCUIT_BREAKER_RESET_TIMEOUT
    );
    // Health check starts on first successful connection (in 'open' handler),
    // not eagerly in the constructor, to avoid reconnection noise before connect().
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
        if (this.ws) {
          this.ws.removeAllListeners();
          if (this.ws.readyState <= WebSocket.OPEN) this.ws.close();
        }
        this.ws = new WebSocket(this.wsUrl);

        // Connection timeout — cleared on success or first error
        const connectionTimeout = setTimeout(() => {
          if (!this.connected) {
            this.ws?.close();
            reject(new FigmaBridgeError(createError(ErrorCode.CONN_TIMEOUT, 'Connection timeout')));
          }
        }, FigmaBridge.CONNECTION_TIMEOUT_MS);

        this.ws.on('open', () => {
          clearTimeout(connectionTimeout);
          this.connected = true;
          this.reconnectAttempts = 0;
          console.error('[FigmaBridge] Connected to Figma plugin');

          // Reset circuit breaker on successful connection
          this.circuitBreaker.reset();

          // Clear cached context — may be connecting to a different file/plugin instance
          this.latestContext = null;

          // Restart health check in case it was stopped during disconnect
          this.startHealthCheck();

          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error: Error) => {
          clearTimeout(connectionTimeout);
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
      } catch (error) {
        reject(error);
      }
    }).finally(() => {
      this.connectingPromise = null;
    });

    return this.connectingPromise;
  }

  /**
   * Checks whether the context (page/file) changed and invokes the callback.
   */
  private updateContext(ctx: FigmaContext): void {
    const prev = this.latestContext;
    const changed = prev?.pageId !== ctx.pageId || prev.fileName !== ctx.fileName;
    this.latestContext = ctx;
    if (changed && this.onContextChange) {
      this.onContextChange(prev, ctx);
    }
  }

  /**
   * Converts raw WebSocket data to a string, handling Buffer/ArrayBuffer/Buffer[].
   */
  private static rawToString(data: WebSocket.Data): string | null {
    if (typeof data === 'string') return data;
    if (Buffer.isBuffer(data)) return data.toString('utf-8');
    if (Array.isArray(data)) return Buffer.concat(data).toString('utf-8');
    return null;
  }

  /**
   * Handles incoming WebSocket messages
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const messageStr = FigmaBridge.rawToString(data);
      if (messageStr === null) {
        console.error('[FigmaBridge] Unsupported data type:', typeof data);
        return;
      }

      const message: Record<string, unknown> = JSON.parse(messageStr) as Record<string, unknown>;

      // Handle connection/info messages (not responses to requests)
      if (message.type === 'connection' || message.type === 'info') {
        console.error(
          `[FigmaBridge] ${String(message.type)}: ${String(message.message ?? 'message received')}`
        );
        return;
      }

      // Handle push notifications from the Figma plugin
      if (message.type === 'figma_notification') {
        const notification = notificationSchema.parse(message);
        if (notification.data?._ctx) {
          this.updateContext(notification.data._ctx);
        }
        this.onNotification?.(notification);
        return;
      }

      // Parse as response message
      const response = responseSchema.parse(message);
      if (response._ctx) {
        this.updateContext(response._ctx);
      }

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
   * Shared request lifecycle: creates a request, registers it as pending,
   * sends it over the WebSocket, and returns a promise for the response.
   * Both sendToFigma and sendToFigmaWithAbort delegate here.
   *
   * TRUST BOUNDARY: The response `data` field is cast to `T` without runtime validation.
   * The bridge is intentionally type-agnostic — it routes messages, not interprets them.
   * Callers (individual tool execute functions) are responsible for validating response shape.
   * This matches the architecture: bridge = transport, tools = business logic + validation.
   */
  private dispatchRequest<T>(type: string, payload: unknown): { id: string; promise: Promise<T> } {
    if (!this.connected || this.ws?.readyState !== WebSocket.OPEN) {
      throw new FigmaBridgeError(
        createError(ErrorCode.CONN_NOT_CONNECTED, 'Not connected to Figma plugin')
      );
    }

    const ws = this.ws;
    const id = `req_${randomUUID()}`;
    const request: FigmaRequest = { id, type, payload };

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
                createError(ErrorCode.OP_FAILED, response.error ?? 'Request failed')
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

    return { id, promise };
  }

  /**
   * Sends a request to Figma and returns a promise for the response
   * @param type
   * @param payload
   */
  async sendToFigma<T = unknown>(type: string, payload: unknown): Promise<T> {
    return this.dispatchRequest<T>(type, payload).promise;
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
    const { id, promise } = this.dispatchRequest<T>(type, payload);

    const abortController: RequestAbortController = {
      abort: () => {
        abortController.aborted = true;
        const pending = this.pendingRequests.get(id);
        if (pending && !pending.aborted) {
          pending.aborted = true;
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(id);
        }
      },
      aborted: false
    };

    // Sync aborted flag on promise rejection (e.g., timeout or disconnect)
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
      idempotent?: boolean;
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
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on validation errors or if it's the last attempt
        if (isNonRetryableValidationError(lastError) || attempt === maxRetries - 1) {
          throw lastError;
        }

        // Don't retry non-idempotent operations (creates, deletes, mutations)
        // unless explicitly marked safe. Pre-send failures (connection refused,
        // not connected, circuit breaker open) are always safe to retry because
        // the request never reached the plugin.
        if (options?.idempotent !== true && !isPreSendFailure(lastError)) {
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
   * Sends a request with retry and validates the response against a Zod schema.
   *
   * Combines sendToFigmaWithRetry (retry + circuit breaker) with runtime
   * validation of the response data. Use this when the response shape matters
   * for correctness and you want to catch Figma protocol mismatches early.
   *
   * @param type - Message type for Figma plugin
   * @param payload - Request payload
   * @param responseSchema - Zod schema to validate response data
   * @returns Validated response data
   * @throws {z.ZodError} When response data does not match the schema
   */
  async sendToFigmaValidated<T>(
    type: string,
    payload: unknown,
    responseSchema: z.ZodSchema<T>,
    options?: { idempotent?: boolean }
  ): Promise<T> {
    const raw = await this.sendToFigmaWithRetry<unknown>(type, payload, options);
    return responseSchema.parse(raw);
  }

  /**
   * Returns the latest Figma context (page/file) from the most recent response.
   * Returns null if no response has been received yet.
   */
  getContext(): FigmaContext | null {
    return this.latestContext;
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
  bridgeInstance ??= new FigmaBridge();
  return bridgeInstance;
}

/**
 * Reset the global Figma bridge (for testing only)
 *
 * Disconnects the existing bridge and creates a fresh instance
 * on the next getFigmaBridge() call.
 */
export function resetFigmaBridge(): void {
  if (bridgeInstance) {
    bridgeInstance.disconnect();
  }
  bridgeInstance = null;
}
