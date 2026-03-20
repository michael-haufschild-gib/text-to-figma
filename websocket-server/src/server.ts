import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import { IncomingMessage } from 'http';

const PORT = parseInt(process.env.PORT ?? '8080', 10);
const MAX_MESSAGE_SIZE = 10 * 1024 * 1024; // 10MB - prevent DoS via large payloads
const HEARTBEAT_INTERVAL = 30000; // 30 seconds - ping interval
const HEARTBEAT_TIMEOUT = 60000; // 60 seconds - connection timeout

interface ClientRecord {
  ws: WebSocket;
  isAlive: boolean;
  lastPong: number;
  isFigma?: boolean;
  isMCP?: boolean;
}

interface FigmaHelloMessage {
  type: 'figma_hello';
  source: 'figma-plugin';
}

interface RequestMessage {
  type: string;
  payload: unknown;
  id?: string;
}

interface ResponseMessage {
  id: string;
  success: boolean;
  [key: string]: unknown;
}

type BridgeMessage = FigmaHelloMessage | RequestMessage | ResponseMessage;

/**
 * Validate and classify a parsed JSON object as a BridgeMessage.
 * Returns null if the object does not match any known message shape.
 */
function validateMessage(obj: unknown): BridgeMessage | null {
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

// Store connected clients with heartbeat info
const clients = new Map<string, ClientRecord>();

// Track Figma plugin instance separately (only one allowed)
let figmaPluginClient: string | null = null;

// Track which MCP client sent each request (request ID → client ID)
const pendingRequestOrigins = new Map<string, string>();

/**
 * Handle Figma plugin registration (figma_hello message).
 * Returns true if the message was handled as a registration, false otherwise.
 */
function handleFigmaRegistration(message: BridgeMessage, clientId: string, ws: WebSocket): boolean {
  if (
    message.type !== 'figma_hello' ||
    !('source' in message) ||
    message.source !== 'figma-plugin'
  ) {
    return false;
  }

  console.log(`[REGISTRATION] Figma plugin registering: ${clientId}`);
  const client = clients.get(clientId);
  if (client) {
    client.isFigma = true;
    if (!figmaPluginClient) {
      figmaPluginClient = clientId;
      console.log(`  Registered as primary Figma plugin: ${clientId}`);
    } else if (figmaPluginClient !== clientId) {
      console.warn(
        `  Multiple Figma instances detected! Primary: ${figmaPluginClient}, Duplicate: ${clientId}`
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
 * Route a parsed message to the appropriate destination.
 */
function routeRequest(message: BridgeMessage, clientId: string): void {
  console.log(`[REQUEST] MCP -> Figma (${clientId}):`, message);
  const client = clients.get(clientId);
  if (client) {
    client.isMCP = true;
  }
  // Track which MCP client originated this request for response routing
  const requestMsg = message as RequestMessage;
  if (typeof requestMsg.id === 'string') {
    pendingRequestOrigins.set(requestMsg.id, clientId);
  }
  if (figmaPluginClient && clients.has(figmaPluginClient)) {
    const figmaClient = clients.get(figmaPluginClient);
    if (figmaClient?.ws.readyState === WebSocket.OPEN) {
      figmaClient.ws.send(JSON.stringify(message));
      console.log(`  Routed to Figma plugin: ${figmaPluginClient}`);
    }
  } else {
    console.error('  No Figma plugin connected!');
  }
}

function routeResponse(message: ResponseMessage, clientId: string): void {
  console.log(`[RESPONSE] Figma -> MCP (${clientId}):`, message);
  if (figmaPluginClient && clientId !== figmaPluginClient) {
    console.warn(`  Ignoring response from unregistered client ${clientId}`);
    return;
  }
  const originClientId = pendingRequestOrigins.get(message.id);
  pendingRequestOrigins.delete(message.id);

  if (originClientId) {
    const originClient = clients.get(originClientId);
    if (originClient?.ws.readyState === WebSocket.OPEN) {
      originClient.ws.send(JSON.stringify(message));
      console.log(`  Routed to originating MCP client: ${originClientId}`);
    }
  } else {
    // Fallback: broadcast to all MCP clients (for requests without tracked IDs)
    for (const [, mcpClient] of clients.entries()) {
      if (mcpClient.isMCP && mcpClient.ws.readyState === WebSocket.OPEN) {
        mcpClient.ws.send(JSON.stringify(message));
      }
    }
  }
}

function routeMessage(message: BridgeMessage, clientId: string): void {
  const isRequest = 'type' in message && 'payload' in message;
  const isResponse = 'id' in message && 'success' in message;

  if (isRequest) {
    routeRequest(message, clientId);
  } else if (isResponse) {
    routeResponse(message, clientId);
  } else {
    console.log(`[UNKNOWN] Message from ${clientId}:`, message);
  }
}

// Create WebSocket server
const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket bridge server started on port ${PORT}`);

wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
  const clientId = `client-${randomUUID()}`;

  console.log(`Client connected: ${clientId}`);

  // Store client connection with heartbeat info
  clients.set(clientId, {
    ws,
    isAlive: true,
    lastPong: Date.now()
  });

  // Set up ping/pong for connection health
  ws.on('pong', () => {
    const client = clients.get(clientId);
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

      if (!handleFigmaRegistration(message, clientId, ws)) {
        routeMessage(message, clientId);
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
    if (clientId === figmaPluginClient) {
      console.log(`  Primary Figma plugin disconnected, clearing assignment`);
      figmaPluginClient = null;
    }
    clients.delete(clientId);
    // Clean up any pending request origins for this client
    for (const [reqId, originId] of pendingRequestOrigins.entries()) {
      if (originId === clientId) {
        pendingRequestOrigins.delete(reqId);
      }
    }
  });

  ws.on('error', (error: Error) => {
    console.error(`WebSocket error for ${clientId}:`, error);
    // Clean up errored connection immediately (don't wait for heartbeat)
    if (clientId === figmaPluginClient) {
      console.log(`  Primary Figma plugin errored, clearing assignment`);
      figmaPluginClient = null;
    }
    clients.delete(clientId);
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
});

wss.on('error', (error: Error) => {
  console.error('WebSocket server error:', error);
});

/**
 * Heartbeat interval to detect dead connections
 */
const heartbeatInterval = setInterval(() => {
  const now = Date.now();

  for (const [clientId, client] of clients.entries()) {
    // Check if client hasn't responded to ping
    if (!client.isAlive || now - client.lastPong > HEARTBEAT_TIMEOUT) {
      console.log(`Client ${clientId} appears dead, terminating connection`);
      client.ws.terminate();
      clients.delete(clientId);
      continue;
    }

    // Mark as pending pong and send ping
    client.isAlive = false;
    try {
      client.ws.ping();
    } catch (error) {
      console.error(`Failed to ping ${clientId}:`, error);
      client.ws.terminate();
      clients.delete(clientId);
    }
  }
}, HEARTBEAT_INTERVAL);

// Graceful shutdown handler
function shutdown(signal: string): void {
  console.log(`\n${signal} received, shutting down WebSocket server...`);

  // Clear heartbeat interval
  clearInterval(heartbeatInterval);

  // Close all client connections
  for (const [_clientId, client] of clients.entries()) {
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

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
