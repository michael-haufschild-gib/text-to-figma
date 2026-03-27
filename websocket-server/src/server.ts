import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import { IncomingMessage } from 'http';

// ── Structured Logger (zero-dep, matches MCP server's pretty-print format) ──

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m'
};

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const color = LOG_COLORS[level];
  const tag = level.toUpperCase().padEnd(5);
  let line = `[${timestamp}] ${color}${tag}\x1b[0m [WS Bridge] ${message}`;
  if (context !== undefined && Object.keys(context).length > 0) {
    line += ` ${JSON.stringify(context)}`;
  }
  // All output to stderr to match MCP server convention
  console.error(line);
}

// ── Constants ────────────────────────────────────────────────────────────────

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

/**
 * Push notification from the Figma plugin to all MCP clients.
 * Used for document change events that the MCP server should react to.
 */
export interface NotificationMessage {
  type: 'figma_notification';
  kind: string;
  data?: unknown;
}

export type BridgeMessage =
  | FigmaHelloMessage
  | RequestMessage
  | ResponseMessage
  | NotificationMessage;

/**
 * Mutable server state — isolated per createServer() call for testability.
 */
/** Maximum age (ms) for a pending request origin before it is swept as stale. */
export const PENDING_REQUEST_TTL = 120_000; // 2 minutes

export interface PendingRequestEntry {
  clientId: string;
  createdAt: number;
}

export interface ServerState {
  clients: Map<string, ClientRecord>;
  figmaPluginClient: string | null;
  pendingRequestOrigins: Map<string, PendingRequestEntry>;
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

  // NotificationMessage: { type: 'figma_notification', kind: string }
  // Must be checked before RequestMessage since both have 'type'
  if (msg.type === 'figma_notification' && typeof msg.kind === 'string') {
    return obj as NotificationMessage;
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

  log('info', 'Figma plugin registering', { clientId });
  const client = state.clients.get(clientId);
  if (client) {
    client.isFigma = true;
    if (!state.figmaPluginClient) {
      state.figmaPluginClient = clientId;
      log('info', 'Registered as primary Figma plugin', { clientId });
    } else if (state.figmaPluginClient !== clientId) {
      log('warn', 'Multiple Figma instances detected', {
        primary: state.figmaPluginClient,
        duplicate: clientId
      });
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
  log('info', 'MCP -> Figma request', { clientId, type: message.type, id: message.id ?? 'none' });
  const client = state.clients.get(clientId);
  if (client) {
    client.isMCP = true;
  }
  // Track which MCP client originated this request for response routing
  if (typeof message.id === 'string') {
    state.pendingRequestOrigins.set(message.id, { clientId, createdAt: Date.now() });
  }
  if (state.figmaPluginClient && state.clients.has(state.figmaPluginClient)) {
    const figmaClient = state.clients.get(state.figmaPluginClient);
    if (figmaClient?.ws.readyState === WebSocket.OPEN) {
      figmaClient.ws.send(JSON.stringify(message));
      log('debug', 'Routed to Figma plugin', { figmaClient: state.figmaPluginClient });
    }
  } else {
    log('error', 'No Figma plugin connected');
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
 * On successful responses, also broadcasts a `peer_operation` notification to all
 * other MCP clients so they can mark their local caches as stale.
 */
export function routeResponse(
  state: ServerState,
  message: ResponseMessage,
  clientId: string
): void {
  log('info', 'Figma -> MCP response', { clientId, id: message.id, success: message.success });
  if (state.figmaPluginClient && clientId !== state.figmaPluginClient) {
    log('warn', 'Ignoring response from unregistered client', { clientId });
    return;
  }
  const entry = state.pendingRequestOrigins.get(message.id);
  state.pendingRequestOrigins.delete(message.id);

  if (entry) {
    const originClient = state.clients.get(entry.clientId);
    if (originClient?.ws.readyState === WebSocket.OPEN) {
      originClient.ws.send(JSON.stringify(message));
      log('debug', 'Routed to originating MCP client', { originClientId: entry.clientId });
    }

    // Notify other MCP clients that a peer performed an operation.
    // This lets each agent mark its NodeRegistry as stale without relying
    // on the plugin's document_changed notification (which is suppressed
    // during MCP command execution).
    if (message.success) {
      const notification = JSON.stringify({
        type: 'figma_notification',
        kind: 'peer_operation',
        data: { requestId: message.id }
      });

      for (const [mcpClientId, client] of state.clients.entries()) {
        if (mcpClientId === entry.clientId) continue;
        if (mcpClientId === state.figmaPluginClient) continue;
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(notification);
        }
      }
    }
  } else {
    log('warn', 'Orphan response — no tracked origin, dropping', { id: message.id });
  }
}

/** Type guard: message is a ResponseMessage (has id + success) */
function isResponseMessage(msg: BridgeMessage): msg is ResponseMessage {
  return 'id' in msg && 'success' in msg;
}

/** Type guard: message is a NotificationMessage (type === 'figma_notification') */
function isNotificationMessage(msg: BridgeMessage): msg is NotificationMessage {
  return 'type' in msg && (msg as unknown as { type: string }).type === 'figma_notification';
}

/** Type guard: message is a RequestMessage (has type + payload) */
function isRequestMessage(msg: BridgeMessage): msg is RequestMessage {
  return 'type' in msg && 'payload' in msg;
}

/**
 * Broadcast a notification from the Figma plugin to all connected MCP clients.
 */
export function routeNotification(
  state: ServerState,
  message: NotificationMessage,
  clientId: string
): void {
  // Only accept notifications from the registered Figma plugin
  if (state.figmaPluginClient && clientId !== state.figmaPluginClient) {
    log('warn', 'Ignoring notification from non-plugin client', { clientId });
    return;
  }

  log('info', 'Figma -> MCP clients notification', { kind: message.kind });

  for (const [mcpClientId, client] of state.clients.entries()) {
    // Send to MCP clients only (not back to Figma plugin)
    if (mcpClientId === state.figmaPluginClient) continue;
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }
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
  } else if (isNotificationMessage(message)) {
    routeNotification(state, message, clientId);
  } else if (isRequestMessage(message)) {
    routeRequest(state, message, clientId);
  } else {
    log('warn', 'Unknown message type', { clientId });
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
      log('error', 'Message too large', { clientId, messageSize, max: MAX_MESSAGE_SIZE });
      ws.send(
        JSON.stringify({ type: 'error', error: 'Message size exceeds maximum allowed size' })
      );
      return;
    }

    const parsed: unknown = JSON.parse(buffer.toString());
    const message = validateMessage(parsed);

    // Rate limiting — exempt response/notification messages from the Figma plugin
    // since they are replies to work already requested, not new inbound load.
    const isReply =
      message !== null && (isResponseMessage(message) || isNotificationMessage(message));
    const client = state.clients.get(clientId);
    if (!isReply && client && !client.rateLimiter.consume()) {
      log('warn', 'Rate limit exceeded', { clientId });
      ws.send(JSON.stringify({ type: 'error', error: 'Rate limit exceeded. Slow down requests.' }));
      return;
    }
    if (!message) {
      log('error', 'Invalid message structure', { clientId });
      ws.send(JSON.stringify({ type: 'error', error: 'Unrecognized message format' }));
      return;
    }

    if (!handleFigmaRegistration(state, message, clientId, ws)) {
      routeMessage(state, message, clientId);
    }
  } catch (error) {
    log('error', 'Error parsing message', {
      clientId,
      error: error instanceof Error ? error.message : String(error)
    });
    try {
      ws.send(JSON.stringify({ type: 'error', error: 'Failed to parse message' }));
    } catch (_sendError) {
      log('error', 'Failed to send error response', { clientId });
    }
  }
}

/**
 * Clean up a disconnected or errored client. Idempotent — safe to call
 * from both 'close' and 'error' handlers for the same client.
 */
function cleanupClient(state: ServerState, clientId: string, errorMessage: string): void {
  // If this was the Figma plugin, clear assignment and fail pending requests
  if (clientId === state.figmaPluginClient) {
    log('warn', 'Primary Figma plugin lost, clearing assignment', { clientId });
    state.figmaPluginClient = null;

    for (const [reqId, entry] of state.pendingRequestOrigins.entries()) {
      const originClient = state.clients.get(entry.clientId);
      if (originClient?.ws.readyState === WebSocket.OPEN) {
        originClient.ws.send(JSON.stringify({ id: reqId, success: false, error: errorMessage }));
      }
      state.pendingRequestOrigins.delete(reqId);
    }
  }

  state.clients.delete(clientId);

  // Clean up any pending request origins where this client was the requester
  for (const [reqId, entry] of state.pendingRequestOrigins.entries()) {
    if (entry.clientId === clientId) {
      state.pendingRequestOrigins.delete(reqId);
    }
  }
}

/**
 * Wire up event handlers for a newly connected WebSocket client.
 */
function setupConnection(state: ServerState, ws: WebSocket): void {
  const clientId = `client-${randomUUID()}`;

  log('info', 'Client connected', { clientId });

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
    log('info', 'Client disconnected', { clientId });
    cleanupClient(state, clientId, 'Figma plugin disconnected during operation');
  });

  ws.on('error', (error: Error) => {
    log('error', 'WebSocket error', { clientId, error: error.message });
    cleanupClient(state, clientId, 'Figma plugin connection error during operation');
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

  log('info', `WebSocket bridge server started on port ${port}`);

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    setupConnection(state, ws);
  });

  wss.on('error', (error: Error) => {
    log('error', 'WebSocket server error', { error: error.message });
  });

  /**
   * Heartbeat interval to detect dead connections and sweep stale request origins
   */
  const heartbeatInterval = setInterval(() => {
    const now = Date.now();

    for (const [clientId, client] of state.clients.entries()) {
      // Check if client hasn't responded to ping
      if (!client.isAlive || now - client.lastPong > HEARTBEAT_TIMEOUT) {
        log('info', 'Client appears dead, terminating', { clientId });
        client.ws.terminate();
        state.clients.delete(clientId);
        continue;
      }

      // Mark as pending pong and send ping
      client.isAlive = false;
      try {
        client.ws.ping();
      } catch (_error) {
        log('error', 'Failed to ping client', { clientId });
        client.ws.terminate();
        state.clients.delete(clientId);
      }
    }

    // Sweep stale pending request origins to prevent memory accumulation
    // from requests the Figma plugin never responded to
    let swept = 0;
    for (const [reqId, entry] of state.pendingRequestOrigins.entries()) {
      if (now - entry.createdAt > PENDING_REQUEST_TTL) {
        state.pendingRequestOrigins.delete(reqId);
        swept++;
      }
    }
    if (swept > 0) {
      log('warn', 'Swept stale pending request origins', { swept });
    }
  }, HEARTBEAT_INTERVAL);

  /**
   * Graceful shutdown — closes connections and server without calling process.exit().
   * The caller (CLI entrypoint) is responsible for exiting the process.
   */
  function shutdown(signal: string): Promise<void> {
    log('info', `${signal} received, shutting down WebSocket server`);

    clearInterval(heartbeatInterval);

    for (const [_clientId, client] of state.clients.entries()) {
      client.ws.close();
    }

    return new Promise<void>((resolve) => {
      wss.close(() => {
        log('info', 'WebSocket server closed');
        resolve();
      });
    });
  }

  return { wss, state, heartbeatInterval, shutdown };
}

// Auto-start when this file is the entry point (untestable in unit tests)
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
/* v8 ignore start -- CLI entry point guard, only runs when file is process.argv[1] */
if (isMainModule) {
  const port = parseInt(process.env.PORT ?? '8080', 10);
  const { shutdown } = createServer(port);

  const handleSignal = (signal: string): void => {
    const forceTimer = setTimeout(() => {
      log('error', 'Graceful shutdown timed out, forcing exit');
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
