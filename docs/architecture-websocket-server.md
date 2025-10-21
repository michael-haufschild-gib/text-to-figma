# WebSocket Server Architecture

**Component**: WebSocket Bridge Server
**Language**: JavaScript (ES Modules)
**Runtime**: Node.js
**Purpose**: Bidirectional bridge between MCP Server and Figma Plugin

---

## Overview

The WebSocket server acts as a **lightweight bridge** between the MCP server and the Figma plugin. It handles bidirectional communication, request/response tracking, and connection management.

### Key Characteristics

- **Stateless bridge** - no business logic, pure message forwarding
- **Request tracking** - matches responses to requests via unique IDs
- **Timeout management** - prevents hanging requests
- **Multi-client support** - handles multiple Figma plugin connections
- **Promise-based API** - `sendToFigma()` returns Promise for async/await

---

## File Structure

```
websocket-server/
├── server.js              # Main WebSocket server
├── package.json           # Dependencies (ws)
└── node_modules/
    └── ws/                # WebSocket library
```

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    WebSocket Bridge Server                    │
│                     (ws://localhost:8080)                     │
│                                                               │
│  ┌──────────────────────┐        ┌──────────────────────┐   │
│  │   Client Map         │        │  Pending Requests     │   │
│  │                      │        │                       │   │
│  │  clientId → ws       │        │  requestId → Promise  │   │
│  │  "client-123" → ws1  │        │  "req-456" → {...}    │   │
│  │  "client-789" → ws2  │        │                       │   │
│  └──────────────────────┘        └──────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Message Flow Handler                     │   │
│  │                                                        │   │
│  │  1. Receive from Figma → Check requestId             │   │
│  │  2. Find pending request → Clear timeout             │   │
│  │  3. Resolve promise → Return to caller               │   │
│  │  4. Cleanup → Remove from pending                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└───────────────┬──────────────────────────┬───────────────────┘
                │                          │
                │ WebSocket                │ WebSocket
                │                          │
                ▼                          ▼
    ┌─────────────────────┐    ┌─────────────────────┐
    │   Figma Plugin      │    │    MCP Server       │
    │   (WebSocket        │    │  (WebSocket Client) │
    │    Client)          │    │                     │
    └─────────────────────┘    └─────────────────────┘
```

---

## Core Components

### 1. WebSocket Server Instance

```javascript
import { WebSocketServer } from 'ws';

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });
```

**Configuration**:
- **Port**: 8080 (conventional WebSocket development port)
- **Protocol**: `ws://` (not WSS for local development)
- **Host**: All interfaces (allows local connections)

**Lifecycle**:
```javascript
// Start server
wss.on('connection', (ws, req) => {
  // Handle new connection
});

// Shutdown
process.on('SIGINT', () => {
  wss.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
});
```

---

### 2. Client Connection Management

**Client Storage**:
```javascript
const clients = new Map();
// Key: clientId (string)
// Value: WebSocket connection object
```

**Client ID Generation**:
```javascript
const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
// Example: "client-1698765432123-k3j4h5g6"
```

**Purpose**: Unique identifier for each connected Figma plugin instance

**Connection Handler**:
```javascript
wss.on('connection', (ws, req) => {
  const clientId = generateClientId();

  // Store client
  clients.set(clientId, ws);
  console.log(`Client connected: ${clientId}`);

  // Setup handlers
  ws.on('message', (data) => handleMessage(clientId, data));
  ws.on('close', () => handleClose(clientId));
  ws.on('error', (error) => handleError(clientId, error));

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to WebSocket bridge server',
    clientId
  }));
});
```

**Cleanup on Disconnect**:
```javascript
ws.on('close', () => {
  console.log(`Client disconnected: ${clientId}`);
  clients.delete(clientId);
});
```

---

### 3. Request/Response Tracking

**Pending Requests Storage**:
```javascript
const pendingRequests = new Map();
// Key: requestId (string)
// Value: { resolve, reject, timeoutId }
```

**Request Lifecycle**:

**1. Send Request**:
```javascript
export async function sendToFigma(message) {
  return new Promise((resolve, reject) => {
    const requestId = generateRequestId();

    // Set timeout
    const timeoutId = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`Request timeout after ${REQUEST_TIMEOUT}ms`));
    }, REQUEST_TIMEOUT);

    // Store pending request
    pendingRequests.set(requestId, { resolve, reject, timeoutId });

    // Send message with requestId
    const messageWithId = { ...message, requestId };
    sendToAllClients(messageWithId);
  });
}
```

**2. Receive Response**:
```javascript
ws.on('message', (data) => {
  const message = JSON.parse(data.toString());

  // Check if response to pending request
  if (message.requestId && pendingRequests.has(message.requestId)) {
    const { resolve, timeoutId } = pendingRequests.get(message.requestId);

    // Clear timeout
    clearTimeout(timeoutId);

    // Resolve promise
    resolve(message);

    // Cleanup
    pendingRequests.delete(message.requestId);
  }
});
```

**Request ID Generation**:
```javascript
const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
// Example: "req-1698765432456-p9o8i7u6"
```

---

### 4. Message Forwarding

**Direction: MCP Server → Figma Plugin**:
```javascript
export async function sendToFigma(message) {
  // Check clients connected
  if (clients.size === 0) {
    throw new Error('No Figma clients connected');
  }

  // Add requestId
  const requestId = generateRequestId();
  const messageWithId = { ...message, requestId };

  // Send to all connected clients
  for (const [clientId, ws] of clients.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(messageWithId));
      console.log(`Sent to Figma (${clientId}):`, messageWithId);
    }
  }

  // Return promise for response
  return new Promise((resolve, reject) => {
    // ... (see Request/Response Tracking)
  });
}
```

**Direction: Figma Plugin → MCP Server**:
```javascript
ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log(`Received from Figma (${clientId}):`, message);

    // Match to pending request and resolve
    if (message.requestId && pendingRequests.has(message.requestId)) {
      const { resolve, timeoutId } = pendingRequests.get(message.requestId);
      clearTimeout(timeoutId);
      resolve(message);
      pendingRequests.delete(message.requestId);
    }
  } catch (error) {
    console.error(`Error parsing message from ${clientId}:`, error);
  }
});
```

---

## Message Flow Examples

### Example 1: Create Frame Command

```
1. MCP Server calls sendToFigma():
   {
     type: 'create_frame',
     data: {
       x: 0,
       y: 0,
       width: 200,
       height: 100
     }
   }

2. Server adds requestId:
   {
     type: 'create_frame',
     data: { ... },
     requestId: 'req-1698765432123-abc123'
   }

3. Server stores pending request:
   pendingRequests.set('req-1698765432123-abc123', {
     resolve: [Function],
     reject: [Function],
     timeoutId: Timeout {...}
   })

4. Server sends to all Figma clients via WebSocket

5. Figma plugin receives, processes, and responds:
   {
     requestId: 'req-1698765432123-abc123',
     status: 'success',
     message: 'Frame created',
     nodeId: '123:456'
   }

6. Server receives response:
   - Finds pending request by requestId
   - Clears timeout
   - Resolves promise with response
   - Deletes from pendingRequests

7. MCP Server receives resolved promise:
   Promise resolves with: {
     status: 'success',
     message: 'Frame created',
     nodeId: '123:456'
   }
```

---

### Example 2: Request Timeout

```
1. MCP Server calls sendToFigma()

2. Server creates pending request with 30s timeout

3. Figma plugin doesn't respond (crashed, disconnected, etc.)

4. After 30 seconds:
   - Timeout fires
   - Request deleted from pendingRequests
   - Promise rejected with error

5. MCP Server receives rejection:
   Error: "Request timeout after 30000ms"
```

---

### Example 3: No Clients Connected

```
1. MCP Server calls sendToFigma()

2. Server checks clients.size === 0

3. Promise immediately rejected:
   Error: "No Figma clients connected"

4. MCP Server receives rejection immediately
```

---

## Error Handling

### Connection Errors

**Client Connection Error**:
```javascript
ws.on('error', (error) => {
  console.error(`WebSocket error for ${clientId}:`, error);
  // Error logged, connection cleaned up automatically
});
```

**Server Error**:
```javascript
wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
  // Server continues running unless critical
});
```

### Message Parse Errors

```javascript
ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    // Process message
  } catch (error) {
    console.error(`Error parsing message from ${clientId}:`, error);
    // Log error, continue processing other messages
  }
});
```

### Send Errors

```javascript
try {
  ws.send(JSON.stringify(messageWithId));
  console.log(`Sent to Figma (${clientId}):`, messageWithId);
  sent = true;
} catch (error) {
  console.error(`Error sending to ${clientId}:`, error);
  // Try other clients, reject if none succeed
}
```

### Timeout Errors

```javascript
const timeoutId = setTimeout(() => {
  pendingRequests.delete(requestId);
  reject(new Error(`Request timeout after ${REQUEST_TIMEOUT}ms`));
}, REQUEST_TIMEOUT);
```

**Timeout Value**: 30 seconds (30000ms)

**Purpose**: Prevent indefinite waiting for responses

---

## API

### Exported Function: `sendToFigma(message)`

**Signature**:
```javascript
export async function sendToFigma(message: Object): Promise<Object>
```

**Parameters**:
- `message` (Object): Message to send to Figma
  - `type` (string): Message type (e.g., 'create_frame')
  - `data` (Object): Message payload

**Returns**:
- Promise that resolves with response from Figma
- Promise rejects on timeout, no clients, or send error

**Usage Example**:
```javascript
import { sendToFigma } from './websocket-server/server.js';

try {
  const response = await sendToFigma({
    type: 'create_frame',
    data: {
      x: 0,
      y: 0,
      width: 200,
      height: 100
    }
  });

  console.log('Frame created:', response.nodeId);
} catch (error) {
  console.error('Failed to create frame:', error.message);
}
```

**Error Cases**:
1. **No clients connected**: Rejects immediately
2. **Send failure**: Rejects if message can't be sent to any client
3. **Timeout**: Rejects after 30 seconds if no response
4. **Client disconnect**: Request remains pending until timeout

---

## Configuration

### Constants

```javascript
const PORT = 8080;                    // Server port
const REQUEST_TIMEOUT = 30000;        // 30 seconds
```

**Why 8080?**
- Conventional WebSocket development port
- Not used by system services
- Easy to remember
- Commonly allowed by firewalls

**Why 30 seconds timeout?**
- Figma operations usually complete in < 1 second
- Allows for complex operations (component creation, etc.)
- Prevents indefinite hanging
- Long enough for slow Figma instances

---

## Concurrency Model

### Multi-Client Support

The server supports **multiple simultaneous Figma plugin connections**:

```javascript
const clients = new Map();
// Can store multiple ws connections simultaneously

clients.set('client-1', ws1);
clients.set('client-2', ws2);
clients.set('client-3', ws3);
```

**Broadcast Behavior**:
When `sendToFigma()` is called, the message is sent to **all connected clients**:

```javascript
for (const [clientId, ws] of clients.entries()) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(messageWithId));
  }
}
```

**Response Handling**:
The **first response** with matching requestId resolves the promise. Other responses are ignored.

**Use Case**: Multiple designers working in different Figma files simultaneously.

### Request Ordering

**Requests are processed sequentially**:
- Each `sendToFigma()` call creates a unique request
- Responses matched by requestId, not order
- No guarantee of response order
- Concurrent requests possible (each has unique requestId)

**Example**:
```javascript
// These can be called concurrently
const promise1 = sendToFigma({ type: 'create_frame', ... });
const promise2 = sendToFigma({ type: 'create_text', ... });

// Responses can arrive in any order
// Each promise resolves independently when its response arrives
```

---

## Performance Characteristics

**Latency**:
- Message forwarding: < 1ms (in-memory operation)
- WebSocket send: ~1-5ms (local network)
- Total overhead: < 10ms

**Throughput**:
- Limited by WebSocket bandwidth (~1 Gbps on localhost)
- Typically 1000s of messages per second possible
- Practical limit: Figma API speed (~10-100 operations/second)

**Memory**:
- Base server: ~10MB
- Per connection: ~1-2MB
- Pending requests: Negligible (small objects)

**CPU**:
- Message forwarding: Minimal (no processing)
- JSON parsing: ~0.1ms per message
- Idle CPU: ~0%

---

## Monitoring and Logging

### Console Logging

**Server Startup**:
```javascript
console.log(`WebSocket bridge server started on port ${PORT}`);
```

**Client Events**:
```javascript
console.log(`Client connected: ${clientId}`);
console.log(`Client disconnected: ${clientId}`);
```

**Message Flow**:
```javascript
console.log(`Received from Figma (${clientId}):`, message);
console.log(`Sent to Figma (${clientId}):`, messageWithId);
```

**Errors**:
```javascript
console.error(`Error parsing message from ${clientId}:`, error);
console.error(`WebSocket error for ${clientId}:`, error);
console.error('WebSocket server error:', error);
```

### Production Monitoring

For production use, consider adding:

1. **Metrics Collection**:
   - Request count
   - Response time
   - Timeout rate
   - Client count
   - Error rate

2. **Structured Logging**:
   - JSON log format
   - Log levels (debug, info, warn, error)
   - Request ID tracking
   - Timestamps

3. **Health Checks**:
   - HTTP endpoint for health status
   - Client connection count
   - Memory usage
   - Uptime

4. **Alerting**:
   - High timeout rate
   - No clients connected for extended period
   - High error rate
   - Memory leaks

---

## Testing Strategy

### Unit Tests

**Test client management**:
```javascript
test('adds client on connection', () => {
  const clientId = connect();
  expect(clients.has(clientId)).toBe(true);
});

test('removes client on disconnect', () => {
  const clientId = connect();
  disconnect(clientId);
  expect(clients.has(clientId)).toBe(false);
});
```

**Test request tracking**:
```javascript
test('creates pending request', async () => {
  const promise = sendToFigma({ type: 'test' });
  expect(pendingRequests.size).toBe(1);
});

test('resolves on response', async () => {
  const promise = sendToFigma({ type: 'test' });
  receiveResponse({ requestId: 'req-123', data: 'result' });
  const result = await promise;
  expect(result.data).toBe('result');
});

test('rejects on timeout', async () => {
  const promise = sendToFigma({ type: 'test' });
  await expect(promise).rejects.toThrow('timeout');
});
```

### Integration Tests

**Test end-to-end flow**:
```javascript
test('forwards message and receives response', async () => {
  // Start server
  const server = startServer();

  // Connect mock Figma client
  const client = new WebSocket('ws://localhost:8080');

  // Send command
  const promise = sendToFigma({
    type: 'create_frame',
    data: { x: 0, y: 0, width: 100, height: 100 }
  });

  // Mock Figma response
  client.on('message', (msg) => {
    const command = JSON.parse(msg);
    client.send(JSON.stringify({
      requestId: command.requestId,
      status: 'success',
      nodeId: '123:456'
    }));
  });

  // Verify response
  const result = await promise;
  expect(result.status).toBe('success');
  expect(result.nodeId).toBe('123:456');
});
```

### Manual Testing

**1. Start server**:
```bash
cd websocket-server
npm start
```

Expected output:
```
WebSocket bridge server started on port 8080
```

**2. Connect test client**:
```javascript
// In browser console or Node.js
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => console.log('Connected');
ws.onmessage = (event) => console.log('Received:', event.data);
```

Expected output:
```
Connected
Received: {"type":"connection","message":"Connected to WebSocket bridge server","clientId":"client-..."}
```

**3. Send test message**:
```javascript
ws.send(JSON.stringify({
  requestId: 'test-123',
  status: 'success',
  message: 'Test response'
}));
```

**4. Verify server logs**:
```
Client connected: client-1698765432123-abc123
Received from Figma (client-1698765432123-abc123): { requestId: 'test-123', ... }
```

---

## Deployment

### Development

```bash
cd websocket-server
npm install
npm start
```

**Environment**: Local development machine

**Port**: 8080 (default)

### Production

**Considerations**:

1. **Process Management**:
   - Use PM2 or systemd for automatic restart
   - Monitor process health
   - Log rotation

2. **Security**:
   - Use WSS (WebSocket Secure) for remote access
   - Implement authentication
   - Rate limiting
   - IP allowlisting

3. **Scaling**:
   - Current implementation: Single process
   - For scale: Use Redis for shared state across instances
   - Load balancer for multiple instances

4. **Networking**:
   - Bind to specific interface (not 0.0.0.0)
   - Configure firewall rules
   - Use reverse proxy (nginx/traefik)

**Example PM2 config**:
```json
{
  "apps": [{
    "name": "websocket-bridge",
    "script": "server.js",
    "cwd": "/path/to/websocket-server",
    "instances": 1,
    "exec_mode": "fork",
    "watch": false,
    "env": {
      "NODE_ENV": "production",
      "PORT": 8080
    },
    "error_file": "/var/log/websocket-bridge/error.log",
    "out_file": "/var/log/websocket-bridge/output.log"
  }]
}
```

---

## Troubleshooting

### Server Won't Start

**Problem**: `Error: listen EADDRINUSE: address already in use :::8080`

**Solution**:
```bash
# Find process using port 8080
lsof -i :8080

# Kill the process
kill -9 <PID>

# Or use a different port
# Edit server.js: const PORT = 8081;
```

### Clients Won't Connect

**Problem**: Figma plugin shows "Disconnected"

**Checklist**:
1. Server running? Check `lsof -i :8080`
2. Correct URL? Should be `ws://localhost:8080`
3. Firewall blocking? Check firewall settings
4. Browser console errors? Check Figma plugin console

### Messages Not Forwarding

**Problem**: `sendToFigma()` times out

**Checklist**:
1. Figma plugin connected? Check server logs for "Client connected"
2. Plugin receiving messages? Check plugin activity log
3. Response format correct? Must include `requestId`
4. Timeout too short? Increase `REQUEST_TIMEOUT`

### Memory Leaks

**Problem**: Server memory increases over time

**Causes**:
1. Pending requests not cleaned up (timeout not firing)
2. Disconnected clients not removed from map
3. Large message objects not garbage collected

**Solution**:
```javascript
// Ensure timeouts always fire
const timeoutId = setTimeout(() => {
  pendingRequests.delete(requestId);  // Always delete
  reject(new Error('timeout'));
}, REQUEST_TIMEOUT);

// Ensure clients are deleted on disconnect
ws.on('close', () => {
  clients.delete(clientId);  // Always delete
});
```

---

## Extension Points

### Adding Authentication

```javascript
wss.on('connection', (ws, req) => {
  // Extract auth token from headers
  const token = req.headers['authorization'];

  // Validate token
  if (!isValidToken(token)) {
    ws.close(1008, 'Authentication failed');
    return;
  }

  // Continue with connection setup
  const clientId = generateClientId();
  clients.set(clientId, ws);
});
```

### Adding Message Validation

```javascript
ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());

    // Validate message schema
    if (!isValidMessage(message)) {
      console.error('Invalid message format');
      return;
    }

    // Process message
    handleMessage(clientId, message);
  } catch (error) {
    console.error('Error:', error);
  }
});
```

### Adding Rate Limiting

```javascript
const rateLimits = new Map();
// Key: clientId
// Value: { count, resetTime }

function checkRateLimit(clientId) {
  const limit = rateLimits.get(clientId) || { count: 0, resetTime: Date.now() + 60000 };

  if (Date.now() > limit.resetTime) {
    limit.count = 0;
    limit.resetTime = Date.now() + 60000;
  }

  limit.count++;
  rateLimits.set(clientId, limit);

  if (limit.count > 100) {  // Max 100 messages per minute
    throw new Error('Rate limit exceeded');
  }
}
```

### Adding Metrics

```javascript
const metrics = {
  messagesReceived: 0,
  messagesSent: 0,
  timeouts: 0,
  errors: 0,
  connections: 0,
  disconnections: 0
};

// Increment on events
ws.on('message', () => {
  metrics.messagesReceived++;
});

ws.on('close', () => {
  metrics.disconnections++;
});

// Expose metrics endpoint
import http from 'http';

const metricsServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(metrics));
});

metricsServer.listen(9090);  // Metrics on port 9090
```

---

## Dependencies

**package.json**:
```json
{
  "name": "text-to-figma-websocket-server",
  "version": "1.0.0",
  "description": "WebSocket bridge server for Text-to-Figma MCP integration",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "ws": "^8.16.0"
  }
}
```

**Single Dependency**: `ws` (WebSocket library)

**Why `ws`?**
- Battle-tested WebSocket implementation
- High performance
- Minimal dependencies
- Well-maintained
- Production-ready

---

## Summary

The WebSocket server is a **minimal, focused bridge** with clear responsibilities:

**What It Does**:
- ✅ Accept WebSocket connections from Figma plugins
- ✅ Forward messages bidirectionally
- ✅ Track request/response correlation
- ✅ Timeout long-running requests
- ✅ Manage multiple client connections

**What It Doesn't Do**:
- ❌ No business logic
- ❌ No message transformation
- ❌ No state persistence
- ❌ No authentication (in basic version)
- ❌ No message queuing

**Design Principles**:
- **Simplicity** - <200 lines of code
- **Reliability** - Comprehensive error handling
- **Performance** - Minimal overhead (<10ms)
- **Observability** - Console logging for all events
- **Extensibility** - Easy to add auth, metrics, etc.

The server's architecture is intentionally **simple and stateless** to maximize reliability and minimize failure modes. It serves as a pure transport layer between the MCP server and Figma plugin.
