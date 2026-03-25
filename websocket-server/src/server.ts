import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import { IncomingMessage } from 'http';

export const MAX_MESSAGE_SIZE = 10 * 1024 * 1024; // 10MB - prevent DoS via large payloads
export const HEARTBEAT_INTERVAL = 30000; // 30 seconds - ping interval
export const HEARTBEAT_TIMEOUT = 60000; // 60 seconds - connection timeout
export const RATE_LIMIT_BURST = 500; // Max tokens in bucket
export const RATE_LIMIT_REFILL_RATE = 200; // Tokens per second

/**
 * Token bucket rate limiter for per-client message throttling.
 * Prevents a single client from flooding the bridge with requests.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly burst: number = RATE_LIMIT_BURST,
    private readonly refillRate: number = RATE_LIMIT_REFILL_RATE
  ) {
    this.tokens = burst;
    this.lastRefill = Date.now();
  }

  /** Try to consume one token. Returns true if allowed, false if rate-limited. */
  consume(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens--;
      return true;
    }
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.burst, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

export interface ClientRecord {
  ws: WebSocket;
  isAlive: boolean;
  lastPong: number;
  isFigma?: boolean;
  isMCP?: boolean;
  rateLimiter: TokenBucket;
}

export interface FigmaHelloMessage {
  type: 'figma_hello';
  source: 'figma-plugin';
}

export interface RequestMessage {
  type: string;
  payload: unknown;
  id?: string;
}

export interface ResponseMessage {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export type BridgeMessage = FigmaHelloMessage | RequestMessage | ResponseMessage;

/**
 * Mutable server state — isolated per createServer() call for testability.
 */
export interface ServerState {
  clients: Map<string, ClientRecord>;
  figmaPluginClient: string | null;
  pendingRequestOrigins: Map<string, string>;
}

export function createServerState(): ServerState {
  return {
    clients: new Map(),
    figmaPluginClient: null,
    pendingRequestOrigins: new Map()
  };
}

/**
 * Normalize WebSocket RawData into a single Buffer.
 *
 * RawData from the `ws` library is `Buffer | ArrayBuffer | Buffer[]`.
 * Calling `.toString()` directly on ArrayBuffer yields "[object ArrayBuffer]"
 * and on Buffer[] yields comma-joined fragments — both corrupt JSON parsing.
 */
export function normalizeRawData(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data);
  }
  // ArrayBuffer
  return Buffer.from(data);
}

/**
 * Validate and classify a parsed JSON object as a BridgeMessage.
 * Returns null if the object does not match any known message shape.
 */
export function validateMessage(obj: unknown): BridgeMessage | null {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return null;
  }

  const msg = obj as Record<string, unknown>;

  // FigmaHelloMessage: { type: 'figma_hello', source: 'figma-plugin' }
  if (msg.type === 'figma_hello' && msg.source === 'figma-plugin') {
    return obj as FigmaHelloMessage;
  }

  // ResponseMessage: { id: string, success: boolean }
  if (typeof msg.id === 'string' && typeof msg.success === 'boolean') {
    return obj as ResponseMessage;
  }

  // RequestMessage: { type: string, payload: exists }
  if (typeof msg.type === 'string' && 'payload' in msg) {
    return obj as RequestMessage;
  }

  return null;
}

/**
 * Handle Figma plugin registration (figma_hello message).
 * Returns true if the message was handled as a registration, false otherwise.
 */
export function handleFigmaRegistration(
  state: ServerState,
  message: BridgeMessage,
  clientId: string,
  ws: WebSocket
): boolean {
  if (!('type' in message) || message.type !== 'figma_hello') {
    return false;
  }

  console.log(`[REGISTRATION] Figma plugin registering: ${clientId}`);
  const client = state.clients.get(clientId);
  if (client) {
    client.isFigma = true;
    if (!state.figmaPluginClient) {
      state.figmaPluginClient = clientId;
      console.log(`  Registered as primary Figma plugin: ${clientId}`);
    } else if (state.figmaPluginClient !== clientId) {
      console.warn(
        `  Multiple Figma instances detected! Primary: ${state.figmaPluginClient}, Duplicate: ${clientId}`
      );
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'Multiple Figma plugin instances detected. Only one instance is allowed.'
        })
      );
      ws.close();
    }
  }
  return true;
}

/**
 * Route a request message from an MCP client to the Figma plugin.
 */
export function routeRequest(state: ServerState, message: RequestMessage, clientId: string): void {
  console.log(
    `[REQUEST] MCP -> Figma (${clientId}): type=${message.type} id=${message.id ?? 'none'}`
  );
  const client = state.clients.get(clientId);
  if (client) {
    client.isMCP = true;
  }
  // Track which MCP client originated this request for response routing
  if (typeof message.id === 'string') {
    state.pendingRequestOrigins.set(message.id, clientId);
  }
  if (state.figmaPluginClient && state.clients.has(state.figmaPluginClient)) {
    const figmaClient = state.clients.get(state.figmaPluginClient);
    if (figmaClient?.ws.readyState === WebSocket.OPEN) {
      figmaClient.ws.send(JSON.stringify(message));
      console.log(`  Routed to Figma plugin: ${state.figmaPluginClient}`);
    }
  } else {
    console.error('  No Figma plugin connected!');
    // Send error response back to the requesting MCP client
    const originClient = state.clients.get(clientId);
    if (originClient?.ws.readyState === WebSocket.OPEN && typeof message.id === 'string') {
      originClient.ws.send(
        JSON.stringify({
          id: message.id,
          success: false,
          error: 'No Figma plugin connected. Open Figma and run the Text-to-Figma plugin.'
        })
      );
    }
    // Clean up the pending origin since we handled it
    if (typeof message.id === 'string') {
      state.pendingRequestOrigins.delete(message.id);
    }
  }
}

/**
 * Route a response message from the Figma plugin back to the originating MCP client.
 */
export function routeResponse(
  state: ServerState,
  message: ResponseMessage,
  clientId: string
): void {
  console.log(
    `[RESPONSE] Figma -> MCP (${clientId}): id=${message.id} success=${String(message.success)}`
  );
  if (state.figmaPluginClient && clientId !== state.figmaPluginClient) {
    console.warn(`  Ignoring response from unregistered client ${clientId}`);
    return;
  }
  const originClientId = state.pendingRequestOrigins.get(message.id);
  state.pendingRequestOrigins.delete(message.id);

  if (originClientId) {
    const originClient = state.clients.get(originClientId);
    if (originClient?.ws.readyState === WebSocket.OPEN) {
      originClient.ws.send(JSON.stringify(message));
      console.log(`  Routed to originating MCP client: ${originClientId}`);
    }
  } else {
    console.warn(`  Orphan response (no tracked origin for id=${message.id}), dropping`);
  }
}

/** Type guard: message is a ResponseMessage (has id + success) */
function isResponseMessage(msg: BridgeMessage): msg is ResponseMessage {
  return 'id' in msg && 'success' in msg;
}

/** Type guard: message is a RequestMessage (has type + payload) */
function isRequestMessage(msg: BridgeMessage): msg is RequestMessage {
  return 'type' in msg && 'payload' in msg;
}

/**
 * Classify a message and route it to the appropriate handler.
 */
export function routeMessage(state: ServerState, message: BridgeMessage, clientId: string): void {
  // Check response first — a response always has {id, success} and is more specific.
  // A message with {type, payload, id, success} must be treated as a response,
  // not a request, because the 'success' field is the Figma plugin's reply signal.
  if (isResponseMessage(message)) {
    routeResponse(state, message, clientId);
  } else if (isRequestMessage(message)) {
    routeRequest(state, message, clientId);
  } else {
    console.log(`[UNKNOWN] Message from ${clientId}:`, message);
  }
}

export interface ServerHandle {
  wss: WebSocketServer;
  state: ServerState;
  heartbeatInterval: ReturnType<typeof setInterval>;
  shutdown: (signal: string) => Promise<void>;
}

/**
 * Process an incoming WebSocket message: validate size, rate-limit, parse, route.
 */
function handleIncomingMessage(
  state: ServerState,
  ws: WebSocket,
  clientId: string,
  data: RawData
): void {
  try {
    const buffer = normalizeRawData(data);
    const messageSize = buffer.byteLength;
    if (messageSize > MAX_MESSAGE_SIZE) {
      console.error(
        `Message too large from ${clientId}: ${messageSize} bytes (max: ${MAX_MESSAGE_SIZE})`
      );
      ws.send(
        JSON.stringify({ type: 'error', error: 'Message size exceeds maximum allowed size' })
      );
      return;
    }

    // Rate limiting — prevent a single client from flooding the bridge
    const client = state.clients.get(clientId);
    if (client && !client.rateLimiter.consume()) {
      console.warn(`Rate limit exceeded for ${clientId}`);
      ws.send(JSON.stringify({ type: 'error', error: 'Rate limit exceeded. Slow down requests.' }));
      return;
    }

    const parsed: unknown = JSON.parse(buffer.toString());
    const message = validateMessage(parsed);
    if (!message) {
      console.error(`Invalid message structure from ${clientId}:`, parsed);
      ws.send(JSON.stringify({ type: 'error', error: 'Unrecognized message format' }));
      return;
    }

    if (!handleFigmaRegistration(state, message, clientId, ws)) {
      routeMessage(state, message, clientId);
    }
  } catch (error) {
    console.error(`Error parsing message from ${clientId}:`, error);
    try {
      ws.send(JSON.stringify({ type: 'error', error: 'Failed to parse message' }));
    } catch (sendError) {
      console.error(`Failed to send error response to ${clientId}:`, sendError);
    }
  }
}

/**
 * Wire up event handlers for a newly connected WebSocket client.
 */
function setupConnection(state: ServerState, ws: WebSocket): void {
  const clientId = `client-${randomUUID()}`;

  console.log(`Client connected: ${clientId}`);

  // Store client connection with heartbeat info and rate limiter
  state.clients.set(clientId, {
    ws,
    isAlive: true,
    lastPong: Date.now(),
    rateLimiter: new TokenBucket()
  });

  // Set up ping/pong for connection health
  ws.on('pong', () => {
    const client = state.clients.get(clientId);
    if (client) {
      client.isAlive = true;
      client.lastPong = Date.now();
    }
  });

  // Handle incoming messages
  ws.on('message', (data: RawData) => {
    handleIncomingMessage(state, ws, clientId, data);
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${clientId}`);
    // If the primary Figma plugin disconnects, clear it
    if (clientId === state.figmaPluginClient) {
      console.log(`  Primary Figma plugin disconnected, clearing assignment`);
      state.figmaPluginClient = null;
      // Fail all pending requests from MCP clients
      for (const [reqId, originId] of state.pendingRequestOrigins.entries()) {
        const originClient = state.clients.get(originId);
        if (originClient?.ws.readyState === WebSocket.OPEN) {
          originClient.ws.send(
            JSON.stringify({
              id: reqId,
              success: false,
              error: 'Figma plugin disconnected during operation'
            })
          );
        }
        state.pendingRequestOrigins.delete(reqId);
      }
    }
    state.clients.delete(clientId);
    // Clean up any pending request origins for this client
    for (const [reqId, originId] of state.pendingRequestOrigins.entries()) {
      if (originId === clientId) {
        state.pendingRequestOrigins.delete(reqId);
      }
    }
  });

  ws.on('error', (error: Error) => {
    console.error(`WebSocket error for ${clientId}:`, error);
    // Clean up errored connection immediately (don't wait for heartbeat)
    if (clientId === state.figmaPluginClient) {
      console.log(`  Primary Figma plugin errored, clearing assignment`);
      state.figmaPluginClient = null;
    }
    state.clients.delete(clientId);
    try {
      ws.terminate();
    } catch {
      // Ignore termination errors
    }
  });

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: 'connection',
      message: 'Connected to WebSocket bridge server',
      clientId
    })
  );
}

/**
 * Create and start a WebSocket bridge server on the given port.
 * Returns a handle for testing and graceful shutdown.
 */
export function createServer(port: number): ServerHandle {
  const state = createServerState();

  const wss = new WebSocketServer({ port });

  console.log(`WebSocket bridge server started on port ${port}`);

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    setupConnection(state, ws);
  });

  wss.on('error', (error: Error) => {
    console.error('WebSocket server error:', error);
  });

  /**
   * Heartbeat interval to detect dead connections
   */
  const heartbeatInterval = setInterval(() => {
    const now = Date.now();

    for (const [clientId, client] of state.clients.entries()) {
      // Check if client hasn't responded to ping
      if (!client.isAlive || now - client.lastPong > HEARTBEAT_TIMEOUT) {
        console.log(`Client ${clientId} appears dead, terminating connection`);
        client.ws.terminate();
        state.clients.delete(clientId);
        continue;
      }

      // Mark as pending pong and send ping
      client.isAlive = false;
      try {
        client.ws.ping();
      } catch (error) {
        console.error(`Failed to ping ${clientId}:`, error);
        client.ws.terminate();
        state.clients.delete(clientId);
      }
    }
  }, HEARTBEAT_INTERVAL);

  /**
   * Graceful shutdown — closes connections and server without calling process.exit().
   * The caller (CLI entrypoint) is responsible for exiting the process.
   */
  function shutdown(signal: string): Promise<void> {
    console.log(`\n${signal} received, shutting down WebSocket server...`);

    clearInterval(heartbeatInterval);

    for (const [_clientId, client] of state.clients.entries()) {
      client.ws.close();
    }

    return new Promise<void>((resolve) => {
      wss.close(() => {
        console.log('WebSocket server closed');
        resolve();
      });
    });
  }

  return { wss, state, heartbeatInterval, shutdown };
}

// Auto-start when this file is the entry point
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  const port = parseInt(process.env.PORT ?? '8080', 10);
  const { shutdown } = createServer(port);

  const handleSignal = (signal: string): void => {
    const forceTimer = setTimeout(() => {
      console.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 5000);
    forceTimer.unref();

    void shutdown(signal).then(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));
}
