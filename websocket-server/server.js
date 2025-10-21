import { WebSocketServer } from 'ws';

const PORT = 8080;
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_MESSAGE_SIZE = 10 * 1024 * 1024; // 10MB - prevent DoS via large payloads
const HEARTBEAT_INTERVAL = 30000; // 30 seconds - ping interval
const HEARTBEAT_TIMEOUT = 60000; // 60 seconds - connection timeout

// Store connected clients with heartbeat info
const clients = new Map();

// Store pending requests with their resolve/reject functions
const pendingRequests = new Map();

// Create WebSocket server
const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket bridge server started on port ${PORT}`);

/**
 * Broadcast message to all clients except the sender
 */
function broadcastToOthers(senderClientId, message) {
  let sentCount = 0;
  for (const [clientId, client] of clients.entries()) {
    if (clientId !== senderClientId && client.ws.readyState === client.ws.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
        sentCount++;
      } catch (error) {
        console.error(`Error sending to ${clientId}:`, error);
      }
    }
  }
  console.log(`  Broadcasted to ${sentCount} other client(s)`);
}

wss.on('connection', (ws, _req) => {
  const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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

  // Handle incoming messages from Figma plugin
  ws.on('message', (data) => {
    try {
      // Validate message size to prevent DoS attacks
      const messageSize = Buffer.byteLength(data);
      if (messageSize > MAX_MESSAGE_SIZE) {
        console.error(
          `Message too large from ${clientId}: ${messageSize} bytes (max: ${MAX_MESSAGE_SIZE})`
        );
        ws.send(
          JSON.stringify({
            type: 'error',
            error: 'Message size exceeds maximum allowed size'
          })
        );
        return;
      }

      const message = JSON.parse(data.toString());

      // Basic message structure validation
      if (!message || typeof message !== 'object') {
        console.error(`Invalid message structure from ${clientId}`);
        return;
      }

      // Determine message type and route accordingly
      const isRequest = message.type && message.payload !== undefined;
      const isResponse = message.id && message.success !== undefined;

      if (isRequest) {
        console.log(`[REQUEST] MCP → Figma (${clientId}):`, message);
        // Forward request to all OTHER clients (Figma plugins)
        broadcastToOthers(clientId, message);
      } else if (isResponse) {
        console.log(`[RESPONSE] Figma → MCP (${clientId}):`, message);
        // Forward response to all OTHER clients (MCP servers)
        broadcastToOthers(clientId, message);
      } else {
        console.log(`[UNKNOWN] Message from ${clientId}:`, message);
      }
    } catch (error) {
      console.error(`Error parsing message from ${clientId}:`, error);
      // Don't crash the connection, just log the error
      try {
        ws.send(
          JSON.stringify({
            type: 'error',
            error: 'Failed to parse message'
          })
        );
      } catch (sendError) {
        // If we can't send the error, just log it
        console.error(`Failed to send error response to ${clientId}:`, sendError);
      }
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${clientId}`);
    clients.delete(clientId);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for ${clientId}:`, error);
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

wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

/**
 * Heartbeat interval to detect dead connections
 */
const heartbeatInterval = setInterval(() => {
  const now = Date.now();

  for (const [clientId, client] of clients.entries()) {
    // Check if client hasn't responded to ping
    if (!client.isAlive || (now - client.lastPong) > HEARTBEAT_TIMEOUT) {
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

/**
 * Send a message to Figma and wait for response
 * @param {Object} message - Message to send to Figma
 * @param {string} message.type - Message type
 * @param {Object} message.data - Message data
 * @returns {Promise<Object>} Response from Figma
 */
export async function sendToFigma(message) {
  return new Promise((resolve, reject) => {
    // Check if there are any connected clients
    if (clients.size === 0) {
      reject(new Error('No Figma clients connected'));
      return;
    }

    // Generate unique request ID with timestamp and random suffix to prevent collisions
    // Use crypto.randomUUID() would be better in Node 16+, but this works for Node 14+
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substr(2, 9);
    const requestId = `req-${timestamp}-${randomPart}-${process.hrtime.bigint()}`;

    // Add requestId to message
    const messageWithId = {
      ...message,
      requestId
    };

    // Set up timeout
    const timeoutId = setTimeout(() => {
      const pending = pendingRequests.get(requestId);
      if (pending) {
        pendingRequests.delete(requestId);
        reject(new Error(`Request timeout after ${REQUEST_TIMEOUT}ms`));
      }
    }, REQUEST_TIMEOUT);

    // Store pending request - the unique ID prevents race conditions
    pendingRequests.set(requestId, { resolve, reject, timeoutId });

    // Send to all connected clients (in practice, should be just one Figma plugin)
    let sent = false;
    for (const [clientId, client] of clients.entries()) {
      if (client.ws.readyState === client.ws.OPEN) {
        try {
          client.ws.send(JSON.stringify(messageWithId));
          console.log(`Sent to Figma (${clientId}):`, messageWithId);
          sent = true;
        } catch (error) {
          console.error(`Error sending to ${clientId}:`, error);
        }
      }
    }

    if (!sent) {
      clearTimeout(timeoutId);
      pendingRequests.delete(requestId);
      reject(new Error('Failed to send message to any connected client'));
    }
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down WebSocket server...');

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
});
