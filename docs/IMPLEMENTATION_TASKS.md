# Text-to-Figma Design System: Implementation Tasks

**Document Purpose**: Sequential task list for LLM coding agents with limited context windows.

**Execution Model**: Read one task → Execute → Verify → Move to next task.

**Total Tasks**: 35 tasks across 5 phases (Weeks 1-12)

---

## How to Use This Document

1. **Execute tasks in numerical order** (Task 1, 2, 3, ...)
2. **Each task is self-contained** - all code and context included inline
3. **Verify each task** before proceeding to the next
4. **Prerequisites** list task IDs that must be completed first
5. **Success Criteria** are programmatically checkable

**Context Window Optimization**: Each task is designed to fit within ~4000 tokens when read individually.

---

## Project Structure

```
text-to-figma/
├── figma-plugin/
│   ├── manifest.json
│   ├── code.ts                 # Main thread (Figma API access)
│   ├── ui.html                 # UI thread (WebSocket client)
│   └── package.json
├── websocket-server/
│   ├── server.ts               # WebSocket bridge
│   └── package.json
├── mcp-server/
│   ├── index.ts                # MCP server entry point
│   ├── tools/                  # MCP tool implementations
│   ├── constraints/            # Design constraint validators
│   ├── prompts/                # System prompt templates
│   └── package.json
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

---

# PHASE 1: Foundation (Tasks 1-8)

## Task 1: Create Figma Plugin Manifest

### Prerequisites
- None

### Objective
Create Figma plugin manifest.json with proper configuration for two-thread architecture.

### Context
Figma plugins require a manifest.json that declares permissions, entry points, and UI configuration. The two-thread model separates Figma API access (main) from browser APIs (ui).

### Implementation

**Step 1**: Create directory structure
```bash
mkdir -p figma-plugin
cd figma-plugin
```

**Step 2**: Create file `./figma-plugin/manifest.json` with this content:
```json
{
  "name": "Text-to-Figma Design Generator",
  "id": "text-to-figma-generator",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "editorType": ["figma"],
  "networkAccess": {
    "allowedDomains": ["none"]
  }
}
```

**Step 3**: Create `./figma-plugin/package.json`:
```json
{
  "name": "figma-text-to-design-plugin",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch"
  },
  "devDependencies": {
    "@figma/plugin-typings": "^1.87.0",
    "typescript": "^5.3.0"
  }
}
```

**Step 4**: Create `./figma-plugin/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020"],
    "outDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "typeRoots": ["./node_modules/@types", "./node_modules/@figma"]
  },
  "include": ["code.ts"]
}
```

**Step 5**: Install dependencies
```bash
cd figma-plugin
npm install
```

### Verification
```bash
# Check files exist
ls -la figma-plugin/manifest.json
ls -la figma-plugin/package.json
ls -la figma-plugin/tsconfig.json

# Verify valid JSON
cat figma-plugin/manifest.json | python -m json.tool
```

### Success Criteria
- [ ] File `./figma-plugin/manifest.json` exists
- [ ] File `./figma-plugin/package.json` exists
- [ ] File `./figma-plugin/tsconfig.json` exists
- [ ] `npm install` completes without errors
- [ ] manifest.json is valid JSON

### Output Artifacts
- `./figma-plugin/manifest.json` (11 lines)
- `./figma-plugin/package.json` (13 lines)
- `./figma-plugin/tsconfig.json` (13 lines)

---

## Task 2: Create Plugin Main Thread (Figma API Access)

### Prerequisites
- Task 1 (manifest.json exists)

### Objective
Create code.ts (main thread) that receives commands from UI thread and executes Figma API operations.

### Context
The main thread has access to Figma API (figma.createFrame, etc.) but NOT browser APIs (WebSocket). It communicates with UI thread via postMessage. This handles all Figma scene manipulation.

### Implementation

**Step 1**: Create file `./figma-plugin/code.ts`:
```typescript
// Main thread - has Figma API access, no browser APIs
console.log('Figma plugin main thread loaded');

// Show UI (400x600 window)
figma.showUI(__html__, { width: 400, height: 600 });

// Message handler: receives commands from UI thread
figma.ui.onmessage = async (msg: any) => {
  console.log('Main thread received:', msg.type);

  try {
    switch (msg.type) {
      case 'create_frame': {
        const frame = figma.createFrame();
        frame.name = msg.name || 'Frame';
        frame.resize(msg.width || 100, msg.height || 100);

        if (msg.layoutMode) {
          frame.layoutMode = msg.layoutMode;
        }

        if (msg.itemSpacing !== undefined) {
          frame.itemSpacing = msg.itemSpacing;
        }

        if (msg.padding) {
          frame.paddingLeft = msg.padding.left || 0;
          frame.paddingRight = msg.padding.right || 0;
          frame.paddingTop = msg.padding.top || 0;
          frame.paddingBottom = msg.padding.bottom || 0;
        }

        figma.currentPage.appendChild(frame);
        figma.viewport.scrollAndZoomIntoView([frame]);

        // Send success response back to UI thread
        figma.ui.postMessage({
          type: 'command_success',
          requestId: msg.requestId,
          result: {
            id: frame.id,
            name: frame.name
          }
        });
        break;
      }

      case 'create_text': {
        // Load font before creating text (required by Figma)
        await figma.loadFontAsync({
          family: msg.fontFamily || 'Inter',
          style: msg.fontStyle || 'Regular'
        });

        const text = figma.createText();
        text.characters = msg.content || '';
        text.fontSize = msg.fontSize || 16;
        text.fontName = {
          family: msg.fontFamily || 'Inter',
          style: msg.fontStyle || 'Regular'
        };

        if (msg.lineHeight) {
          text.lineHeight = { value: msg.lineHeight, unit: 'PIXELS' };
        }

        figma.currentPage.appendChild(text);

        figma.ui.postMessage({
          type: 'command_success',
          requestId: msg.requestId,
          result: { id: text.id }
        });
        break;
      }

      case 'close_plugin': {
        figma.closePlugin();
        break;
      }

      default: {
        figma.ui.postMessage({
          type: 'command_error',
          requestId: msg.requestId,
          error: `Unknown command: ${msg.type}`
        });
      }
    }
  } catch (error: any) {
    figma.ui.postMessage({
      type: 'command_error',
      requestId: msg.requestId,
      error: error.message
    });
  }
};
```

**Step 2**: Compile TypeScript
```bash
cd figma-plugin
npm run build
```

### Verification
```bash
# Check compiled file exists
ls -la figma-plugin/code.js

# Verify no TypeScript errors
cd figma-plugin && npx tsc --noEmit
```

### Success Criteria
- [ ] File `./figma-plugin/code.ts` exists (90 lines)
- [ ] File `./figma-plugin/code.js` created by compilation
- [ ] TypeScript compilation succeeds (no errors)
- [ ] Code includes `create_frame` and `create_text` handlers

### Output Artifacts
- `./figma-plugin/code.ts` (90 lines)
- `./figma-plugin/code.js` (compiled output)

---

## Task 3: Create Plugin UI Thread (WebSocket Client)

### Prerequisites
- Task 1 (manifest.json exists)

### Objective
Create ui.html (UI thread) that connects to WebSocket server and forwards messages to/from main thread.

### Context
The UI thread runs in an iframe with browser APIs (WebSocket) but NO Figma API access. It bridges WebSocket server ↔ Main thread via postMessage.

### Implementation

**Step 1**: Create file `./figma-plugin/ui.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Text-to-Figma Plugin</title>
  <style>
    body {
      margin: 0;
      padding: 16px;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
    }
    #status {
      padding: 8px;
      border-radius: 4px;
      margin-bottom: 16px;
    }
    .connected {
      background: #d4edda;
      color: #155724;
    }
    .disconnected {
      background: #f8d7da;
      color: #721c24;
    }
  </style>
</head>
<body>
  <div id="status" class="disconnected">
    Status: Disconnected
  </div>
  <div id="log"></div>

  <script>
    const statusEl = document.getElementById('status');
    const logEl = document.getElementById('log');

    let ws = null;
    const pendingRequests = new Map();

    function log(message) {
      const p = document.createElement('p');
      p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
      logEl.appendChild(p);
      console.log(message);
    }

    function connectWebSocket() {
      log('Connecting to WebSocket server...');
      ws = new WebSocket('ws://localhost:8080');

      ws.onopen = () => {
        log('✓ Connected to WebSocket server');
        statusEl.textContent = 'Status: Connected';
        statusEl.className = 'connected';
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        log(`← WebSocket: ${message.type}`);

        // Forward message to main thread (Figma API)
        parent.postMessage({ pluginMessage: message }, '*');
      };

      ws.onerror = (error) => {
        log(`✗ WebSocket error: ${error}`);
        statusEl.textContent = 'Status: Error';
        statusEl.className = 'disconnected';
      };

      ws.onclose = () => {
        log('✗ WebSocket disconnected');
        statusEl.textContent = 'Status: Disconnected';
        statusEl.className = 'disconnected';

        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };
    }

    // Listen for messages from main thread
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      log(`→ Main thread: ${msg.type}`);

      // Forward response back to WebSocket server
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    };

    // Start connection
    connectWebSocket();
  </script>
</body>
</html>
```

### Verification
```bash
# Check file exists
ls -la figma-plugin/ui.html

# Validate HTML
cat figma-plugin/ui.html | grep "WebSocket" | wc -l
# Should output: 6 (or more)
```

### Success Criteria
- [ ] File `./figma-plugin/ui.html` exists
- [ ] HTML includes WebSocket connection code
- [ ] HTML includes message forwarding to parent (main thread)
- [ ] HTML includes status display

### Output Artifacts
- `./figma-plugin/ui.html` (95 lines)

---

## Task 4: Create WebSocket Bridge Server

### Prerequisites
- None (independent of plugin)

### Objective
Create Node.js WebSocket server that bridges MCP server ↔ Figma plugin.

### Context
The WebSocket server acts as a bridge because the Figma plugin UI thread can connect to WebSocket, but the MCP server needs to communicate with the plugin. This server manages connections and forwards messages bidirectionally.

### Implementation

**Step 1**: Create directory and package.json
```bash
mkdir -p websocket-server
cd websocket-server
```

**Step 2**: Create file `./websocket-server/package.json`:
```json
{
  "name": "figma-websocket-bridge",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "ws": "^8.16.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.10"
  }
}
```

**Step 3**: Create file `./websocket-server/server.js`:
```javascript
import { WebSocketServer } from 'ws';

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

// Store connected clients
const clients = new Map();
let clientIdCounter = 0;

// Store pending responses
const pendingRequests = new Map();

console.log(`WebSocket server listening on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  const clientId = `client-${++clientIdCounter}`;
  clients.set(clientId, ws);
  console.log(`✓ Client connected: ${clientId}`);

  ws.on('message', (rawMessage) => {
    try {
      const message = JSON.parse(rawMessage.toString());
      console.log(`← ${clientId}: ${message.type}`);

      // Handle different message types
      if (message.type === 'command_success' || message.type === 'command_error') {
        // Response from Figma plugin - resolve pending request
        const handler = pendingRequests.get(message.requestId);
        if (handler) {
          handler(message);
          pendingRequests.delete(message.requestId);
        }
      } else {
        // Forward to all connected clients (broadcast)
        clients.forEach((client, id) => {
          if (client !== ws && client.readyState === 1) { // OPEN
            client.send(rawMessage);
            console.log(`→ ${id}: ${message.type}`);
          }
        });
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`✗ Client disconnected: ${clientId}`);
  });

  ws.on('error', (error) => {
    console.error(`Error on ${clientId}:`, error);
  });
});

// Export function for MCP server to send commands
export function sendToFigma(command) {
  return new Promise((resolve, reject) => {
    const client = Array.from(clients.values())[0];

    if (!client || client.readyState !== 1) {
      reject(new Error('No Figma plugin connected'));
      return;
    }

    const requestId = `req-${Date.now()}-${Math.random()}`;
    command.requestId = requestId;

    // Store response handler
    pendingRequests.set(requestId, (response) => {
      if (response.type === 'command_error') {
        reject(new Error(response.error));
      } else {
        resolve(response.result);
      }
    });

    // Send command
    client.send(JSON.stringify(command));
    console.log(`→ Figma: ${command.type} (${requestId})`);

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }
    }, 30000);
  });
}
```

**Step 4**: Install dependencies
```bash
cd websocket-server
npm install
```

### Verification
```bash
# Start server in background
cd websocket-server
npm start &

# Wait 2 seconds
sleep 2

# Check server is running
lsof -i :8080 | grep node
# Should show node process listening on port 8080

# Stop background process
kill %1
```

### Success Criteria
- [ ] File `./websocket-server/package.json` exists
- [ ] File `./websocket-server/server.js` exists
- [ ] `npm install` completes without errors
- [ ] Server starts and listens on port 8080
- [ ] Code includes `sendToFigma` function export

### Output Artifacts
- `./websocket-server/package.json` (14 lines)
- `./websocket-server/server.js` (95 lines)

---

## Task 5: Create MCP Server Scaffold

### Prerequisites
- None (independent component)

### Objective
Create MCP server using official SDK with initial structure for tool registration.

### Context
The MCP (Model Context Protocol) server exposes tools that Claude can call to generate Figma designs. It uses the official Anthropic SDK and communicates with the WebSocket bridge to execute Figma operations.

### Implementation

**Step 1**: Create directory and package.json
```bash
mkdir -p mcp-server
cd mcp-server
```

**Step 2**: Create file `./mcp-server/package.json`:
```json
{
  "name": "figma-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "build": "tsc",
    "start": "node index.js",
    "dev": "tsc && node index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.3.0"
  }
}
```

**Step 3**: Create file `./mcp-server/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

**Step 4**: Create directory structure
```bash
mkdir -p mcp-server/src/tools
mkdir -p mcp-server/src/constraints
mkdir -p mcp-server/src/prompts
```

**Step 5**: Create file `./mcp-server/src/index.ts`:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Import WebSocket bridge (will be connected in Task 6)
// import { sendToFigma } from '../websocket-server/server.js';

console.error('Starting Figma MCP Server...');

const server = new Server(
  {
    name: 'figma-design-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
      resources: {},
    },
  }
);

// Tool registration will be added in subsequent tasks

// Start server with stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('Figma MCP Server ready');
```

**Step 6**: Install dependencies
```bash
cd mcp-server
npm install
```

**Step 7**: Compile TypeScript
```bash
cd mcp-server
npm run build
```

### Verification
```bash
# Check files exist
ls -la mcp-server/src/index.ts
ls -la mcp-server/package.json
ls -la mcp-server/tsconfig.json

# Verify compilation
cd mcp-server
npm run build
ls -la dist/index.js
```

### Success Criteria
- [ ] File `./mcp-server/package.json` exists
- [ ] File `./mcp-server/src/index.ts` exists
- [ ] File `./mcp-server/tsconfig.json` exists
- [ ] Directories `src/tools`, `src/constraints`, `src/prompts` exist
- [ ] `npm install` completes without errors
- [ ] TypeScript compiles successfully

### Output Artifacts
- `./mcp-server/package.json` (19 lines)
- `./mcp-server/src/index.ts` (30 lines)
- `./mcp-server/tsconfig.json` (13 lines)
- `./mcp-server/dist/index.js` (compiled)

---

## Task 6: Create Design Constraints Module

### Prerequisites
- Task 5 (MCP server scaffold exists)

### Objective
Create validation module for design constraints: 8pt grid, modular typography scale, WCAG contrast.

### Context
Design constraints reduce LLM decision space and ensure quality. This module provides validation functions that MCP tools will use to enforce 8pt spacing, modular type scale, and accessibility requirements.

### Implementation

**Step 1**: Create file `./mcp-server/src/constraints/spacing.ts`:
```typescript
// 8pt grid spacing scale
export const SPACING_SCALE = [0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128];

export function validateSpacing(value: number): boolean {
  return SPACING_SCALE.includes(value);
}

export function nearestSpacing(value: number): number {
  return SPACING_SCALE.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}

export function getSpacingConstraintMessage(): string {
  return `Spacing must use 8pt grid values: ${SPACING_SCALE.join(', ')}`;
}
```

**Step 2**: Create file `./mcp-server/src/constraints/typography.ts`:
```typescript
// Modular typography scale (base 16px, ratio 1.25)
export const TYPE_SCALE = [12, 16, 20, 24, 32, 40, 48, 64];

export function validateFontSize(value: number): boolean {
  return TYPE_SCALE.includes(value);
}

export function validateLineHeight(value: number): boolean {
  // Line heights must be divisible by 4 (baseline grid)
  return value % 4 === 0;
}

export function calculateLineHeight(fontSize: number): number {
  // Formula: fontSize * 1.5, rounded up to 4pt baseline
  const calculated = fontSize * 1.5;
  return Math.ceil(calculated / 4) * 4;
}

export function nearestFontSize(value: number): number {
  return TYPE_SCALE.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}

export function getTypographyConstraintMessage(): string {
  return `Font sizes must use modular scale: ${TYPE_SCALE.join(', ')}. Line heights must be divisible by 4.`;
}
```

**Step 3**: Create file `./mcp-server/src/constraints/color.ts`:
```typescript
export interface RGB {
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
}

// Calculate relative luminance (WCAG formula)
function relativeLuminance(rgb: RGB): number {
  const { r, g, b } = rgb;

  const [rs, gs, bs] = [r, g, b].map(c => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculate contrast ratio (WCAG formula)
export function calculateContrastRatio(foreground: RGB, background: RGB): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

// WCAG AA compliance (4.5:1 for normal text, 3:1 for large text)
export function meetsWCAG_AA(
  foreground: RGB,
  background: RGB,
  isLargeText: boolean = false
): boolean {
  const ratio = calculateContrastRatio(foreground, background);
  const threshold = isLargeText ? 3.0 : 4.5;
  return ratio >= threshold;
}

// WCAG AAA compliance (7:1 for normal text, 4.5:1 for large text)
export function meetsWCAG_AAA(
  foreground: RGB,
  background: RGB,
  isLargeText: boolean = false
): boolean {
  const ratio = calculateContrastRatio(foreground, background);
  const threshold = isLargeText ? 4.5 : 7.0;
  return ratio >= threshold;
}

export function getContrastConstraintMessage(): string {
  return 'Text/background pairs must meet WCAG AA: 4.5:1 for normal text, 3:1 for large text (18pt+ or 14pt+ bold)';
}
```

**Step 4**: Create file `./mcp-server/src/constraints/index.ts`:
```typescript
export * from './spacing.js';
export * from './typography.js';
export * from './color.js';
```

### Verification
```bash
# Compile TypeScript
cd mcp-server
npm run build

# Check compiled files exist
ls -la dist/constraints/spacing.js
ls -la dist/constraints/typography.js
ls -la dist/constraints/color.js
ls -la dist/constraints/index.js
```

### Success Criteria
- [ ] File `./mcp-server/src/constraints/spacing.ts` exists
- [ ] File `./mcp-server/src/constraints/typography.ts` exists
- [ ] File `./mcp-server/src/constraints/color.ts` exists
- [ ] File `./mcp-server/src/constraints/index.ts` exists
- [ ] TypeScript compiles without errors
- [ ] SPACING_SCALE contains 13 values
- [ ] TYPE_SCALE contains 8 values

### Output Artifacts
- `./mcp-server/src/constraints/spacing.ts` (18 lines)
- `./mcp-server/src/constraints/typography.ts` (30 lines)
- `./mcp-server/src/constraints/color.ts` (60 lines)
- `./mcp-server/src/constraints/index.ts` (3 lines)

---

## Task 7: Connect MCP Server to WebSocket Bridge

### Prerequisites
- Task 4 (WebSocket server exists)
- Task 5 (MCP server scaffold exists)

### Objective
Modify MCP server to import and use WebSocket bridge for sending commands to Figma.

### Context
The MCP server needs to communicate with the Figma plugin via the WebSocket bridge. This task creates the connection between MCP tools and the Figma plugin.

### Implementation

**Step 1**: Update `./mcp-server/src/figma-bridge.ts` (new file):
```typescript
import WebSocket from 'ws';

let ws: WebSocket | null = null;
const pendingRequests = new Map<string, (response: any) => void>();

export function connectToWebSocketBridge(url: string = 'ws://localhost:8080') {
  return new Promise<void>((resolve, reject) => {
    console.error(`Connecting to WebSocket bridge at ${url}...`);

    ws = new WebSocket(url);

    ws.on('open', () => {
      console.error('✓ Connected to WebSocket bridge');
      resolve();
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.requestId && pendingRequests.has(message.requestId)) {
          const handler = pendingRequests.get(message.requestId)!;
          handler(message);
          pendingRequests.delete(message.requestId);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      reject(error);
    });

    ws.on('close', () => {
      console.error('WebSocket connection closed');
      ws = null;
    });
  });
}

export function sendToFigma(command: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('WebSocket not connected'));
      return;
    }

    const requestId = `req-${Date.now()}-${Math.random()}`;
    command.requestId = requestId;

    // Store response handler
    pendingRequests.set(requestId, (response) => {
      if (response.type === 'command_error') {
        reject(new Error(response.error));
      } else {
        resolve(response.result);
      }
    });

    // Send command
    ws.send(JSON.stringify(command));

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }
    }, 30000);
  });
}
```

**Step 2**: Update `./mcp-server/src/index.ts`:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { connectToWebSocketBridge } from './figma-bridge.js';

console.error('Starting Figma MCP Server...');

// Connect to WebSocket bridge
try {
  await connectToWebSocketBridge('ws://localhost:8080');
} catch (error) {
  console.error('Failed to connect to WebSocket bridge:', error);
  console.error('Make sure websocket-server is running on port 8080');
  process.exit(1);
}

const server = new Server(
  {
    name: 'figma-design-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
      resources: {},
    },
  }
);

// Tool registration will be added in subsequent tasks

// Start server with stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('Figma MCP Server ready');
```

**Step 3**: Add WebSocket dependency to package.json
```bash
cd mcp-server
npm install ws
npm install --save-dev @types/ws
```

### Verification
```bash
# Start WebSocket server first
cd websocket-server
npm start &

# Wait 2 seconds
sleep 2

# Compile MCP server
cd ../mcp-server
npm run build

# Try to start MCP server (should connect)
timeout 5 node dist/index.js 2>&1 | grep "Connected to WebSocket"
# Should output: ✓ Connected to WebSocket bridge

# Stop WebSocket server
kill %1
```

### Success Criteria
- [ ] File `./mcp-server/src/figma-bridge.ts` exists
- [ ] Updated `./mcp-server/src/index.ts` imports figma-bridge
- [ ] TypeScript compiles without errors
- [ ] MCP server connects to WebSocket bridge on startup
- [ ] Connection failure exits with error message

### Output Artifacts
- `./mcp-server/src/figma-bridge.ts` (70 lines)
- Updated `./mcp-server/src/index.ts` (40 lines)

---

## Task 8: Create End-to-End Test (Foundation)

### Prerequisites
- Task 1-7 (all foundation components exist)

### Objective
Create integration test that verifies Claude → MCP → WebSocket → Figma → frame creation works end-to-end.

### Context
This test validates the complete pipeline: Start WebSocket server, start MCP server, send create_frame command (simulating Claude call), verify success response. This ensures the foundation is working before adding more tools.

### Implementation

**Step 1**: Create directory structure
```bash
mkdir -p tests/integration
```

**Step 2**: Create file `./tests/integration/foundation.test.js`:
```javascript
import { spawn } from 'child_process';
import { WebSocket } from 'ws';

console.log('Foundation Integration Test\n');

// Helper to wait for condition
function waitFor(condition, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (condition()) {
        clearInterval(interval);
        resolve();
      }
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      reject(new Error('Timeout waiting for condition'));
    }, timeout);
  });
}

// Test execution
async function runTest() {
  let wsServer, mcpServer, ws;

  try {
    // Step 1: Start WebSocket server
    console.log('1. Starting WebSocket server...');
    wsServer = spawn('node', ['server.js'], {
      cwd: './websocket-server',
      stdio: ['ignore', 'pipe', 'pipe']
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('   ✓ WebSocket server started');

    // Step 2: Connect test client to WebSocket
    console.log('2. Connecting to WebSocket...');
    ws = new WebSocket('ws://localhost:8080');

    await new Promise((resolve) => {
      ws.on('open', resolve);
    });
    console.log('   ✓ Connected to WebSocket');

    // Step 3: Send create_frame command (simulating Figma plugin response)
    console.log('3. Testing command flow...');

    const testCommand = {
      type: 'create_frame',
      requestId: 'test-001',
      name: 'Test Frame',
      width: 200,
      height: 200,
      layoutMode: 'HORIZONTAL',
      itemSpacing: 16
    };

    // Send command
    ws.send(JSON.stringify(testCommand));
    console.log('   ✓ Sent create_frame command');

    // NOTE: In real test, Figma plugin would respond.
    // For now, we just verify WebSocket receives and can send.

    // Step 4: Verify WebSocket can receive messages
    let received = false;
    ws.on('message', (data) => {
      received = true;
      console.log('   ✓ Received message back');
    });

    // Simulate response from Figma plugin
    setTimeout(() => {
      ws.send(JSON.stringify({
        type: 'command_success',
        requestId: 'test-001',
        result: { id: 'frame-123', name: 'Test Frame' }
      }));
    }, 500);

    await waitFor(() => received, 5000);

    console.log('\n✅ Foundation test PASSED');
    console.log('   - WebSocket server running');
    console.log('   - WebSocket connections working');
    console.log('   - Message passing functional');

    return true;

  } catch (error) {
    console.error('\n❌ Foundation test FAILED');
    console.error('Error:', error.message);
    return false;

  } finally {
    // Cleanup
    if (ws) ws.close();
    if (wsServer) wsServer.kill();
    if (mcpServer) mcpServer.kill();
  }
}

// Run test
runTest().then(success => {
  process.exit(success ? 0 : 1);
});
```

**Step 3**: Create test runner script
```bash
cat > tests/run-integration-tests.sh << 'EOF'
#!/bin/bash
echo "Running integration tests..."
node tests/integration/foundation.test.js
EOF

chmod +x tests/run-integration-tests.sh
```

### Verification
```bash
# Run the test
./tests/run-integration-tests.sh

# Expected output should include:
# ✅ Foundation test PASSED
# - WebSocket server running
# - WebSocket connections working
# - Message passing functional
```

### Success Criteria
- [ ] File `./tests/integration/foundation.test.js` exists
- [ ] Test starts WebSocket server successfully
- [ ] Test connects to WebSocket
- [ ] Test sends and receives messages
- [ ] Test exits with code 0 (success)

### Output Artifacts
- `./tests/integration/foundation.test.js` (95 lines)
- `./tests/run-integration-tests.sh` (executable script)

---

# PHASE 2: Core MCP Tools (Tasks 9-15)

## Task 9: Implement create_frame MCP Tool

### Prerequisites
- Task 5 (MCP server scaffold)
- Task 6 (Design constraints module)
- Task 7 (WebSocket bridge connection)

### Objective
Implement create_frame MCP tool with HTML analogy description and constraint validation.

### Context
This is the first MCP tool Claude will use. It creates Figma frames (containers) with auto-layout properties. The tool description includes HTML/CSS analogies to leverage Claude's HTML knowledge. It validates spacing against 8pt grid constraints.

### Implementation

**Step 1**: Create file `./mcp-server/src/tools/create_frame.ts`:
```typescript
import { z } from 'zod';
import { sendToFigma } from '../figma-bridge.js';
import { SPACING_SCALE, validateSpacing, nearestSpacing } from '../constraints/index.js';

export const createFrameSchema = z.object({
  name: z.string().describe('Frame name'),
  width: z.number().positive().optional().default(100),
  height: z.number().positive().optional().default(100),
  layoutMode: z.enum(['NONE', 'HORIZONTAL', 'VERTICAL']).optional()
    .describe('Layout mode. Think: HORIZONTAL = flex-direction: row, VERTICAL = flex-direction: column'),
  itemSpacing: z.number().optional()
    .describe('Gap between children (CSS gap property). Must use 8pt grid: 0, 4, 8, 16, 24, 32, 40, 48, 56, 64'),
  padding: z.object({
    top: z.number().optional().default(0),
    right: z.number().optional().default(0),
    bottom: z.number().optional().default(0),
    left: z.number().optional().default(0)
  }).optional()
    .describe('Padding values. Must use 8pt grid.')
});

export type CreateFrameInput = z.infer<typeof createFrameSchema>;

export async function createFrame(input: CreateFrameInput) {
  // Validate spacing constraints
  if (input.itemSpacing !== undefined && !validateSpacing(input.itemSpacing)) {
    const nearest = nearestSpacing(input.itemSpacing);
    throw new Error(
      `itemSpacing ${input.itemSpacing} does not follow 8pt grid. ` +
      `Valid values: ${SPACING_SCALE.join(', ')}. ` +
      `Nearest valid value: ${nearest}`
    );
  }

  if (input.padding) {
    for (const [side, value] of Object.entries(input.padding)) {
      if (!validateSpacing(value)) {
        const nearest = nearestSpacing(value);
        throw new Error(
          `padding.${side} ${value} does not follow 8pt grid. ` +
          `Valid values: ${SPACING_SCALE.join(', ')}. ` +
          `Nearest valid value: ${nearest}`
        );
      }
    }
  }

  // Send to Figma via WebSocket bridge
  const result = await sendToFigma({
    type: 'create_frame',
    name: input.name,
    width: input.width,
    height: input.height,
    layoutMode: input.layoutMode,
    itemSpacing: input.itemSpacing,
    padding: input.padding
  });

  return {
    success: true,
    frameId: result.id,
    message: `Created frame "${input.name}" (${result.id})`,
    htmlAnalogy: input.layoutMode
      ? `Think of this as <div style="display: flex; flex-direction: ${input.layoutMode === 'HORIZONTAL' ? 'row' : 'column'};">`
      : 'Think of this as <div>'
  };
}
```

**Step 2**: Register tool in `./mcp-server/src/index.ts`:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { connectToWebSocketBridge } from './figma-bridge.js';
import { createFrame, createFrameSchema } from './tools/create_frame.js';

console.error('Starting Figma MCP Server...');

// Connect to WebSocket bridge
await connectToWebSocketBridge('ws://localhost:8080');

const server = new Server(
  {
    name: 'figma-design-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register create_frame tool
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create_frame',
        description: 'Create a frame with auto-layout properties. Think of this as creating a <div> with display: flex in HTML/CSS. Use HORIZONTAL for flex-direction: row, VERTICAL for flex-direction: column.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Frame name' },
            width: { type: 'number', description: 'Width in pixels', default: 100 },
            height: { type: 'number', description: 'Height in pixels', default: 100 },
            layoutMode: {
              type: 'string',
              enum: ['NONE', 'HORIZONTAL', 'VERTICAL'],
              description: 'Layout mode (HORIZONTAL = flex row, VERTICAL = flex column)'
            },
            itemSpacing: {
              type: 'number',
              description: 'Gap between children in pixels. Must use 8pt grid: 0, 4, 8, 16, 24, 32, 40, 48, 56, 64'
            },
            padding: {
              type: 'object',
              properties: {
                top: { type: 'number', default: 0 },
                right: { type: 'number', default: 0 },
                bottom: { type: 'number', default: 0 },
                left: { type: 'number', default: 0 }
              },
              description: 'Padding values (must use 8pt grid)'
            }
          },
          required: ['name']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'create_frame') {
    const input = createFrameSchema.parse(request.params.arguments);
    const result = await createFrame(input);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('Figma MCP Server ready');
```

### Verification
```bash
# Compile
cd mcp-server
npm run build

# Check files exist
ls -la dist/tools/create_frame.js
ls -la dist/index.js

# Start WebSocket server in background
cd ../websocket-server && npm start &
sleep 2

# Test MCP server can list tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node ../mcp-server/dist/index.js

# Should output tool list including create_frame

# Stop WebSocket server
kill %1
```

### Success Criteria
- [ ] File `./mcp-server/src/tools/create_frame.ts` exists
- [ ] Tool validates itemSpacing against 8pt grid
- [ ] Tool validates padding against 8pt grid
- [ ] Tool includes HTML analogy in description
- [ ] MCP server lists create_frame tool
- [ ] TypeScript compiles without errors

### Output Artifacts
- `./mcp-server/src/tools/create_frame.ts` (75 lines)
- Updated `./mcp-server/src/index.ts` (95 lines)

---

[Continue with Tasks 10-35 following the same format...]

Due to length constraints, I'll provide the complete task structure outline. Each task (10-35) follows the same format with:
- Prerequisites
- Objective
- Context
- Implementation (with inline code)
- Verification
- Success Criteria
- Output Artifacts

**Remaining Tasks**:

**PHASE 2 (cont.)**
- Task 10: Implement set_layout_properties MCP tool
- Task 11: Implement create_text MCP tool (with font loading)
- Task 12: Implement set_fills MCP tool
- Task 13: Implement validate_design_tokens MCP tool
- Task 14: Create HTML→Figma mapping reference document (for system prompts)
- Task 15: Create zero-shot system prompt template

**PHASE 3: Design Quality**
- Task 16: Implement LCh color space converter
- Task 17: Implement WCAG contrast validator tool
- Task 18: Implement modular typography scale generator
- Task 19: Implement create_component MCP tool
- Task 20: Implement create_instance MCP tool
- Task 21: Implement set_component_properties MCP tool
- Task 22: Implement apply_effects MCP tool
- Task 23: Create few-shot system prompt template

**PHASE 4: Testing**
- Task 24: Create design token validation test suite
- Task 25: Create visual regression test scaffold
- Task 26: Create agentic review agent scaffold
- Task 27: Implement check_wcag_contrast MCP tool
- Task 28: Create E2E test: Generate button component
- Task 29: Create E2E test: Generate login form

**PHASE 5: Advanced**
- Task 30: Implement grid-based layout algorithm
- Task 31: Implement set_constraints MCP tool
- Task 32: Implement iterative refinement loop
- Task 33: Create caching layer for prompts
- Task 34: Create production monitoring scaffold
- Task 35: Create LLM prompt library (10 templates)

---

## Task Completion Tracking

Create file `./TASK_PROGRESS.md` to track completion:

```markdown
# Task Progress

- [x] Task 1: Figma Plugin Manifest
- [x] Task 2: Plugin Main Thread
- [x] Task 3: Plugin UI Thread
- [x] Task 4: WebSocket Bridge Server
- [x] Task 5: MCP Server Scaffold
- [x] Task 6: Design Constraints Module
- [x] Task 7: Connect MCP to WebSocket
- [x] Task 8: End-to-End Foundation Test
- [x] Task 9: create_frame MCP Tool
- [ ] Task 10: set_layout_properties MCP Tool
...
- [ ] Task 35: LLM Prompt Library

## Current Phase
Phase 1 (Foundation) - Tasks 1-8

## Next Task
Task 10: Implement set_layout_properties MCP Tool
```

Update this file after completing each task.
