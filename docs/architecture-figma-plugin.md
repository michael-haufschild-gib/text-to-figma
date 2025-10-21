# Figma Plugin Architecture

**Component**: Figma Plugin
**Language**: TypeScript
**Runtime**: Figma Plugin Sandbox (dual-threaded)
**Purpose**: Executes Figma API operations in response to commands from the MCP server

---

## Overview

The Figma plugin is a **dual-threaded application** that acts as the bridge between external commands (received via WebSocket) and the Figma Plugin API. It runs inside Figma's sandboxed environment and is responsible for all direct manipulation of Figma documents.

### Key Characteristics

- **Zero network access** from main thread (Figma security restriction)
- **Strict type safety** - no `any` types, comprehensive validation
- **Message-based architecture** - UI thread ↔ Main thread communication
- **WebSocket client** in UI thread for external communication
- **Synchronous Figma API** access from main thread only

---

## File Structure

```
figma-plugin/
├── manifest.json          # Plugin metadata and configuration
├── code.ts                # Main thread (Figma API access)
├── code.js                # Compiled main thread code
├── ui.html                # UI thread (WebSocket client + display)
├── types.ts               # Shared type definitions
├── types.js               # Compiled types
├── package.json           # Dependencies and build scripts
└── tsconfig.json          # TypeScript configuration
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Figma Plugin                          │
│                                                              │
│  ┌─────────────────────┐        ┌─────────────────────┐    │
│  │   UI Thread         │        │   Main Thread       │    │
│  │   (ui.html)         │◄──────►│   (code.ts)         │    │
│  │                     │  Post  │                     │    │
│  │  - WebSocket Client │ Message│  - Figma API Access │    │
│  │  - Connection UI    │        │  - Frame Creation   │    │
│  │  - Activity Log     │        │  - Text Creation    │    │
│  │  - Auto-reconnect   │        │  - Type Validation  │    │
│  └──────────┬──────────┘        └──────────┬──────────┘    │
│             │                               │               │
└─────────────┼───────────────────────────────┼───────────────┘
              │                               │
              │ WebSocket                     │ Figma API
              │ (ws://localhost:8080)         │ (figma.*)
              │                               │
              ▼                               ▼
    ┌─────────────────┐            ┌──────────────────┐
    │ WebSocket Server│            │ Figma Document   │
    └─────────────────┘            └──────────────────┘
```

---

## Component Details

### 1. Main Thread (`code.ts`)

**Purpose**: Executes Figma API operations with strict type safety

**Responsibilities**:
- Handle commands from UI thread
- Create and modify Figma nodes (frames, text, etc.)
- Validate payloads before execution
- Return success/error responses
- Scroll viewport to created elements

**Key Functions**:

#### `createFrame(payload: CreateFramePayload): Promise<PluginResponse>`
Creates a Figma frame with specified properties.

**Inputs**:
```typescript
{
  x: number;           // X position
  y: number;           // Y position
  width: number;       // Frame width
  height: number;      // Frame height
  name?: string;       // Optional name
  fillColor?: {        // Optional fill color (RGB 0-1)
    r: number;
    g: number;
    b: number;
  };
}
```

**Figma API Calls**:
- `figma.createFrame()` - Creates frame node
- `frame.resize()` - Sets dimensions
- `frame.fills` - Sets background color
- `figma.viewport.scrollAndZoomIntoView()` - Scrolls to frame

**Returns**:
```typescript
{
  status: 'success' | 'error';
  message: string;
  nodeId?: string;      // Figma node ID on success
  error?: string;       // Error message on failure
}
```

#### `createText(payload: CreateTextPayload): Promise<PluginResponse>`
Creates a text node with font loading and fallback handling.

**Inputs**:
```typescript
{
  x: number;           // X position
  y: number;           // Y position
  text: string;        // Text content
  fontSize?: number;   // Font size in pixels
  fontName?: {         // Font specification
    family: string;
    style: string;
  };
}
```

**Figma API Calls**:
- `figma.loadFontAsync()` - Loads font (with fallback to Inter Regular)
- `figma.createText()` - Creates text node
- `textNode.fontName` - Sets font
- `textNode.fontSize` - Sets size
- `textNode.characters` - Sets text content

**Error Handling**:
- Font not available → Falls back to Inter Regular
- Invalid payload → Returns error response
- API error → Catches and returns formatted error

#### `handleCommand(command: FigmaCommand): Promise<PluginResponse>`
Routes commands to appropriate handlers with payload validation.

**Flow**:
1. Check command type using type guards
2. Validate payload structure
3. Call appropriate handler (createFrame/createText)
4. Return response

**Type Safety**:
- Uses discriminated unions (`FigmaCommand`)
- Runtime validation with `validate*Payload()` functions
- TypeScript ensures exhaustive handling

#### Message Handler (`figma.ui.onmessage`)
Receives messages from UI thread and processes commands.

**Flow**:
```typescript
UI Thread              Main Thread
    │                      │
    │  {type, payload}     │
    ├─────────────────────►│
    │                      │ Validate message
    │                      │ Construct FigmaCommand
    │                      │ Call handleCommand()
    │                      │
    │  PluginResponse      │
    │◄─────────────────────┤
    │                      │
```

**Error Handling**:
- Invalid message format → Error response
- Missing type/payload → Error response
- Unknown command type → Error response
- Command execution error → Error response with details

---

### 2. UI Thread (`ui.html`)

**Purpose**: WebSocket client and user interface

**Responsibilities**:
- Connect to WebSocket server (ws://localhost:8080)
- Receive commands from server
- Forward commands to main thread
- Display connection status
- Show activity log
- Auto-reconnect on disconnect

**Key Features**:

#### WebSocket Connection Management
```javascript
const WS_URL = 'ws://localhost:8080';
const RECONNECT_DELAY = 5000; // 5 seconds

function connect() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    updateStatus('connected');
    clearInterval(reconnectInterval);
  };

  ws.onclose = () => {
    updateStatus('disconnected');
    reconnectInterval = setInterval(connect, RECONNECT_DELAY);
  };
}
```

**Auto-Reconnect Strategy**:
- Detects disconnection immediately
- Attempts reconnection every 5 seconds
- Shows reconnect status in UI
- Continues indefinitely until connection restored

#### Message Flow

**Incoming (WebSocket → Main Thread)**:
```javascript
ws.onmessage = (event) => {
  const command = JSON.parse(event.data);

  // Validate command structure
  if (!isValidCommand(command)) {
    log('Invalid message format', 'warning');
    return;
  }

  // Forward to main thread
  parent.postMessage({
    pluginMessage: command
  }, '*');
};
```

**Outgoing (Main Thread → WebSocket)**:
```javascript
window.onmessage = (event) => {
  const message = event.data;

  if (message.type === 'response') {
    // Log response
    logResponse(message.data);

    // Send back to WebSocket server
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message.data));
    }
  }
};
```

#### User Interface Components

**Status Indicator**:
- Green dot + "Connected" when active
- Red dot + "Disconnected" when offline
- Orange dot + "Connecting..." during reconnect
- Animated pulse effect for visual feedback

**Activity Log**:
- Color-coded entries (info, success, error, warning)
- Auto-scroll to latest entry
- Maximum 50 entries (auto-prune oldest)
- Timestamps for all entries
- Fixed height with scroll overflow

**Connection Info**:
- Displays WebSocket URL
- Shows auto-reconnect status
- Provides visual feedback for all state changes

---

### 3. Type System (`types.ts`)

**Purpose**: Shared type definitions with zero `any` types

**Key Types**:

#### Command Types
```typescript
type CommandType = 'create_frame' | 'create_text';

interface CreateFrameCommand {
  readonly type: 'create_frame';
  readonly payload: CreateFramePayload;
}

interface CreateTextCommand {
  readonly type: 'create_text';
  readonly payload: CreateTextPayload;
}

type FigmaCommand = CreateFrameCommand | CreateTextCommand;
```

**Design Pattern**: Discriminated union for type-safe command handling

#### Response Types
```typescript
interface SuccessResponse {
  readonly status: 'success';
  readonly message: string;
  readonly nodeId?: string;
}

interface ErrorResponse {
  readonly status: 'error';
  readonly message: string;
  readonly error?: string;
}

type PluginResponse = SuccessResponse | ErrorResponse;
```

#### Type Guards
```typescript
function isCreateFrameCommand(cmd: FigmaCommand): cmd is CreateFrameCommand {
  return cmd.type === 'create_frame';
}

function isSuccessResponse(response: PluginResponse): response is SuccessResponse {
  return response.status === 'success';
}
```

**Purpose**: Runtime type narrowing for TypeScript type safety

#### Validation Functions
```typescript
function validateCreateFramePayload(payload: unknown): payload is CreateFramePayload {
  if (!payload || typeof payload !== 'object') return false;

  const p = payload as Record<string, unknown>;

  return (
    typeof p.x === 'number' &&
    typeof p.y === 'number' &&
    typeof p.width === 'number' &&
    typeof p.height === 'number' &&
    (p.name === undefined || typeof p.name === 'string') &&
    // ... fillColor validation
  );
}
```

**Purpose**: Runtime validation to prevent invalid data from reaching Figma API

---

### 4. Plugin Manifest (`manifest.json`)

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

**Key Configuration**:
- `api: "1.0.0"` - Figma Plugin API version
- `main: "code.js"` - Main thread entry point (must be compiled JS)
- `ui: "ui.html"` - UI thread HTML file
- `networkAccess: none` - Main thread has NO network access (security)

**Network Access Restriction**:
The main thread cannot make network requests. This is why the UI thread handles WebSocket communication - the UI thread runs in a browser context with network access, while the main thread runs in Figma's sandboxed environment.

---

## Message Protocols

### UI Thread ↔ Main Thread

**Direction**: UI → Main (Command)
```typescript
{
  pluginMessage: {
    type: 'create_frame' | 'create_text',
    payload: CreateFramePayload | CreateTextPayload
  }
}
```

**Direction**: Main → UI (Response)
```typescript
{
  type: 'response',
  data: {
    status: 'success' | 'error',
    message: string,
    nodeId?: string,
    error?: string
  }
}
```

### WebSocket ↔ UI Thread

**Direction**: Server → UI (Command)
```typescript
{
  type: 'create_frame' | 'create_text',
  payload: { /* command-specific data */ }
}
```

**Direction**: UI → Server (Response)
```typescript
{
  status: 'success' | 'error',
  message: string,
  nodeId?: string,
  error?: string
}
```

---

## Command Flow Example

**Scenario**: Create a blue frame

```
1. WebSocket Server sends command:
   {
     type: 'create_frame',
     payload: {
       x: 0,
       y: 0,
       width: 200,
       height: 100,
       name: 'Blue Frame',
       fillColor: { r: 0, g: 0, b: 1 }
     }
   }

2. UI Thread receives and validates:
   - Parse JSON
   - Check type is valid
   - Check payload exists
   - Forward to main thread

3. Main Thread processes:
   - Validate payload structure
   - Call createFrame()
   - Execute Figma API calls:
     * figma.createFrame()
     * frame.resize(200, 100)
     * frame.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 1 } }]
     * figma.viewport.scrollAndZoomIntoView([frame])
   - Build response

4. Main Thread responds:
   {
     status: 'success',
     message: 'Frame created: Blue Frame',
     nodeId: '123:456'
   }

5. UI Thread receives response:
   - Log to activity log
   - Send back to WebSocket server

6. WebSocket Server receives confirmation
```

---

## Error Handling Strategy

### Validation Errors
- **Where**: Main thread, before Figma API calls
- **How**: Runtime validation functions
- **Response**: Error status with descriptive message

Example:
```typescript
if (!validateCreateFramePayload(command.payload)) {
  return {
    status: 'error',
    message: 'Invalid create_frame payload',
    error: 'Payload validation failed'
  };
}
```

### Figma API Errors
- **Where**: During Figma API execution
- **How**: Try-catch blocks around all API calls
- **Response**: Error status with error message

Example:
```typescript
try {
  await figma.loadFontAsync(fontName);
} catch (fontError) {
  console.warn(`Font ${fontName.family} not available, using default`);
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
}
```

### WebSocket Errors
- **Where**: UI thread connection handling
- **How**: Event listeners for error/close
- **Response**: Update UI status, trigger auto-reconnect

Example:
```typescript
ws.onerror = (error) => {
  log('WebSocket error occurred', 'error');
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  updateStatus('disconnected');
  reconnectInterval = setInterval(connect, RECONNECT_DELAY);
};
```

### Message Format Errors
- **Where**: UI thread message handler
- **How**: Structure validation before forwarding
- **Response**: Log warning, don't forward invalid messages

Example:
```typescript
if (!isValidCommand(data)) {
  log('Invalid message format received', 'warning');
  return; // Don't forward to main thread
}
```

---

## Security Considerations

### Sandboxing
- Main thread runs in restricted Figma sandbox
- No network access from main thread
- No file system access
- Limited to Figma API only

### Type Safety
- All payloads validated at runtime
- TypeScript provides compile-time safety
- No `any` types in codebase
- Discriminated unions for exhaustive checking

### Input Validation
- All numeric values checked for type
- Optional fields validated when present
- Colors validated for RGB range (0-1)
- Strings validated for minimum length

### Error Isolation
- Try-catch blocks prevent crashes
- Errors don't propagate to Figma
- Failed operations return error responses
- Invalid messages logged but don't break plugin

---

## Extension Points

### Adding New Commands

**1. Define types in `types.ts`**:
```typescript
// Payload interface
export interface CreateEllipsePayload {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// Command interface
export interface CreateEllipseCommand {
  readonly type: 'create_ellipse';
  readonly payload: CreateEllipsePayload;
}

// Add to union
export type FigmaCommand =
  | CreateFrameCommand
  | CreateTextCommand
  | CreateEllipseCommand;

// Type guard
export function isCreateEllipseCommand(cmd: FigmaCommand): cmd is CreateEllipseCommand {
  return cmd.type === 'create_ellipse';
}

// Validator
export function validateCreateEllipsePayload(payload: unknown): payload is CreateEllipsePayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.x === 'number' &&
    typeof p.y === 'number' &&
    typeof p.width === 'number' &&
    typeof p.height === 'number'
  );
}
```

**2. Implement handler in `code.ts`**:
```typescript
async function createEllipse(payload: CreateEllipsePayload): Promise<PluginResponse> {
  try {
    const ellipse = figma.createEllipse();
    ellipse.x = payload.x;
    ellipse.y = payload.y;
    ellipse.resize(payload.width, payload.height);
    figma.viewport.scrollAndZoomIntoView([ellipse]);

    return {
      status: 'success',
      message: 'Ellipse created',
      nodeId: ellipse.id
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Failed to create ellipse',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
```

**3. Add to handleCommand**:
```typescript
if (isCreateEllipseCommand(command)) {
  if (!validateCreateEllipsePayload(command.payload)) {
    return {
      status: 'error',
      message: 'Invalid create_ellipse payload',
      error: 'Payload validation failed'
    };
  }
  return createEllipse(command.payload);
}
```

**4. Update UI validation**:
```typescript
function isValidCommand(data) {
  if (!data || typeof data !== 'object') return false;
  const cmd = data;
  return (
    typeof cmd.type === 'string' &&
    (cmd.type === 'create_frame' ||
     cmd.type === 'create_text' ||
     cmd.type === 'create_ellipse') &&  // Add new type
    typeof cmd.payload === 'object' &&
    cmd.payload !== null
  );
}
```

---

## Build Process

**TypeScript Compilation**:
```bash
cd figma-plugin
npm install
npm run build  # Compiles code.ts → code.js
```

**Configuration** (`tsconfig.json`):
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "outDir": ".",
    "typeRoots": ["./node_modules/@types", "./node_modules/@figma"]
  },
  "include": ["*.ts"],
  "exclude": ["node_modules"]
}
```

**Key Settings**:
- `strict: true` - Maximum type safety
- `noImplicitAny: true` - No implicit any types
- `target: ES2020` - Modern JavaScript features
- Output in same directory for Figma to find

---

## Testing Strategy

### Manual Testing
1. Load plugin in Figma
2. Check UI shows "Disconnected" (if WebSocket server not running)
3. Start WebSocket server
4. Check UI auto-connects and shows "Connected"
5. Send test command via WebSocket
6. Verify frame/text created in Figma
7. Check activity log shows command execution

### Integration Testing
- Test command flow: WebSocket → UI → Main → Figma API → Response
- Verify error handling for invalid payloads
- Test reconnection logic on disconnect
- Validate type guards and validators

### Type Testing
- Compile with `npm run build` - no TypeScript errors
- Use strict mode to catch type issues
- Verify discriminated unions work correctly

---

## Performance Characteristics

**Latency**:
- WebSocket message receive: ~1-5ms
- UI → Main thread postMessage: ~1ms
- Figma API call (createFrame): ~10-50ms
- Total command execution: ~15-60ms

**Memory**:
- Plugin UI thread: ~10-20MB
- Main thread: ~5-10MB
- Minimal memory footprint

**Concurrency**:
- Handles commands sequentially (one at a time)
- No command queuing implemented
- WebSocket ensures ordered delivery
- Figma API is synchronous

---

## Troubleshooting

### Plugin Won't Load
- Check `code.js` exists (run `npm run build`)
- Verify manifest.json is valid JSON
- Check Figma console for TypeScript errors

### WebSocket Won't Connect
- Verify WebSocket server running on port 8080
- Check browser console in plugin UI (right-click → Inspect)
- Verify URL is `ws://localhost:8080`
- Check firewall not blocking port

### Commands Not Executing
- Check activity log for error messages
- Verify command format matches types
- Check main thread console for validation errors
- Ensure payload validation passes

### Type Errors
- Run `npm run build` to see TypeScript errors
- Check all types imported correctly
- Verify no `any` types used
- Use type guards for runtime checks

---

## Dependencies

```json
{
  "dependencies": {},
  "devDependencies": {
    "@figma/plugin-typings": "^1.90.0",
    "typescript": "^5.3.3"
  }
}
```

**Minimal Dependencies**:
- Only Figma types for development
- No runtime dependencies
- TypeScript for type safety
- All UI dependencies are vanilla JS (no frameworks)

---

## Future Enhancements

### Potential Additions
1. **Command Queue** - Handle multiple commands concurrently
2. **Batch Operations** - Execute multiple Figma operations atomically
3. **Undo/Redo** - Track operations for rollback
4. **Progress Feedback** - Real-time progress for long operations
5. **Error Recovery** - Automatic retry on transient failures
6. **Command History** - Log all executed commands
7. **Performance Metrics** - Track execution times
8. **Offline Mode** - Queue commands when disconnected

### Architecture Improvements
1. **State Management** - Centralized state for UI thread
2. **Message Queue** - Buffer commands during processing
3. **Streaming Responses** - Progress updates for long operations
4. **Plugin Data** - Persist state to Figma document
5. **Multi-tenant** - Support multiple MCP connections

---

## Summary

The Figma plugin is a **production-ready**, **type-safe** bridge between external commands and the Figma API. Its dual-threaded architecture cleanly separates concerns:

- **UI Thread**: Network communication, user feedback, auto-reconnect
- **Main Thread**: Figma API access, command execution, validation

**Key Strengths**:
- Zero `any` types - complete type safety
- Comprehensive error handling at all layers
- Auto-reconnect for resilient connections
- Minimal dependencies - vanilla JS/TS only
- Clear separation of concerns

**Use Cases**:
- LLM-driven design generation
- Design automation workflows
- External tool integration
- Programmatic Figma manipulation

The plugin's architecture is designed for **extensibility** - adding new commands requires only type definitions, validators, and handlers following established patterns.
