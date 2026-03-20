import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import { IncomingMessage } from 'http';

export const MAX_MESSAGE_SIZE = 10 * 1024 * 1024; // 10MB - prevent DoS via large payloads
export const HEARTBEAT_INTERVAL = 30000; // 30 seconds - ping interval
export const HEARTBEAT_TIMEOUT = 60000; // 60 seconds - connection timeout

export interface ClientRecord {
  ws: WebSocket;
  isAlive: boolean;
  lastPong: number;
  isFigma?: boolean;
  isMCP?: boolean;
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
  [key: string]: unknown;
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
  if (
    message.type !== 'figma_hello' ||
    !('source' in message) ||
    message.source !== 'figma-plugin'
  ) {
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
export function routeRequest(state: ServerState, message: BridgeMessage, clientId: string): void {
  console.log(`[REQUEST] MCP -> Figma (${clientId}):`, message);
  const client = state.clients.get(clientId);
  if (client) {
    client.isMCP = true;
  }
  // Track which MCP client originated this request for response routing
  const requestMsg = message as RequestMessage;
  if (typeof requestMsg.id === 'string') {
    state.pendingRequestOrigins.set(requestMsg.id, clientId);
  }
  if (state.figmaPluginClient && state.clients.has(state.figmaPluginClient)) {
    const figmaClient = state.clients.get(state.figmaPluginClient);
    if (figmaClient?.ws.readyState === WebSocket.OPEN) {
      figmaClient.ws.send(JSON.stringify(message));
      console.log(`  Routed to Figma plugin: ${state.figmaPluginClient}`);
    }
  } else {
    console.error('  No Figma plugin connected!');
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
  console.log(`[RESPONSE] Figma -> MCP (${clientId}):`, message);
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
    // Fallback: broadcast to all MCP clients (for requests without tracked IDs)
    for (const [, mcpClient] of state.clients.entries()) {
      if (mcpClient.isMCP && mcpClient.ws.readyState === WebSocket.OPEN) {
        mcpClient.ws.send(JSON.stringify(message));
      }
    }
  }
}

/**
 * Classify a message and route it to the appropriate handler.
 */
export function routeMessage(state: ServerState, message: BridgeMessage, clientId: string): void {
  const isRequest = 'type' in message && 'payload' in message;
  const isResponse = 'id' in message && 'success' in message;

  if (isRequest) {
    routeRequest(state, message, clientId);
  } else if (isResponse) {
    routeResponse(state, message, clientId);
  } else {
    console.log(`[UNKNOWN] Message from ${clientId}:`, message);
  }
}

export interface ServerHandle {
  wss: WebSocketServer;
  state: ServerState;
  heartbeatInterval: ReturnType<typeof setInterval>;
  shutdown: (signal: string) => void;
}

/**
 * Wire up event handlers for a newly connected WebSocket client.
 */
function setupConnection(state: ServerState, ws: WebSocket): void {
  const clientId = `client-${randomUUID()}`;

  console.log(`Client connected: ${clientId}`);

  // Store client connection with heartbeat info
  state.clients.set(clientId, {
    ws,
    isAlive: true,
    lastPong: Date.now()
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
    try {
      const messageSize = Buffer.byteLength(data as Buffer);
      if (messageSize > MAX_MESSAGE_SIZE) {
        console.error(
          `Message too large from ${clientId}: ${messageSize} bytes (max: ${MAX_MESSAGE_SIZE})`
        );
        ws.send(
          JSON.stringify({ type: 'error', error: 'Message size exceeds maximum allowed size' })
        );
        return;
      }

      const parsed: unknown = JSON.parse(data.toString());
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
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${clientId}`);
    // If the primary Figma plugin disconnects, clear it
    if (clientId === state.figmaPluginClient) {
      console.log(`  Primary Figma plugin disconnected, clearing assignment`);
      state.figmaPluginClient = null;
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

  // Graceful shutdown handler
  function shutdown(signal: string): void {
    console.log(`\n${signal} received, shutting down WebSocket server...`);

    // Clear heartbeat interval
    clearInterval(heartbeatInterval);

    // Close all client connections
    for (const [_clientId, client] of state.clients.entries()) {
      client.ws.close();
    }

    // Close server
    wss.close(() => {
      console.log('WebSocket server closed');
      process.exit(0);
    });

    // Force exit after timeout if graceful shutdown stalls
    setTimeout(() => {
      console.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 5000);
  }

  return { wss, state, heartbeatInterval, shutdown };
}

// Auto-start when this file is the entry point
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  const port = parseInt(process.env.PORT ?? '8080', 10);
  const { shutdown } = createServer(port);
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
