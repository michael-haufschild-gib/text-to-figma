import { WebSocketServer } from 'ws';

const PORT = 8080;
const REQUEST_TIMEOUT = 30000; // 30 seconds

// Store connected clients
const clients = new Map();

// Store pending requests with their resolve/reject functions
const pendingRequests = new Map();

// Create WebSocket server
const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket bridge server started on port ${PORT}`);

wss.on('connection', (ws, req) => {
  const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.log(`Client connected: ${clientId}`);

  // Store client connection
  clients.set(clientId, ws);

  // Handle incoming messages from Figma plugin
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`Received from Figma (${clientId}):`, message);

      // Check if this is a response to a pending request
      if (message.requestId && pendingRequests.has(message.requestId)) {
        const { resolve, timeoutId } = pendingRequests.get(message.requestId);

        // Clear timeout
        clearTimeout(timeoutId);

        // Resolve the promise with the response
        resolve(message);

        // Clean up
        pendingRequests.delete(message.requestId);
      } else {
        console.log(`Received message without matching requestId: ${message.requestId}`);
      }
    } catch (error) {
      console.error(`Error parsing message from ${clientId}:`, error);
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
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to WebSocket bridge server',
    clientId
  }));
});

wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

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

    // Generate unique request ID
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Add requestId to message
    const messageWithId = {
      ...message,
      requestId
    };

    // Set up timeout
    const timeoutId = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`Request timeout after ${REQUEST_TIMEOUT}ms`));
    }, REQUEST_TIMEOUT);

    // Store pending request
    pendingRequests.set(requestId, { resolve, reject, timeoutId });

    // Send to all connected clients (in practice, should be just one Figma plugin)
    let sent = false;
    for (const [clientId, ws] of clients.entries()) {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(JSON.stringify(messageWithId));
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

  // Close all client connections
  for (const [clientId, ws] of clients.entries()) {
    ws.close();
  }

  // Close server
  wss.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
});
