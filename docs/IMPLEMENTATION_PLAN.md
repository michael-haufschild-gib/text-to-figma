# Text-to-Figma Enhancement Implementation Plan

## Overview

This document contains detailed implementation plans for 15 enhancements across 3 categories:

- **User Convenience** (5 items) - Make the tool easier to use
- **Error Resilience** (5 items) - Make the tool more robust
- **Design Quality** (5 items) - Improve the quality of generated designs

---

## Priority Legend

| Priority | Meaning             | Timeline |
| -------- | ------------------- | -------- |
| **P0**   | Critical - Do First | Week 1   |
| **P1**   | High - Do Next      | Week 2   |
| **P2**   | Medium - Do After   | Week 3-4 |
| **P3**   | Low - Do Later      | Backlog  |

---

# SECTION 1: USER CONVENIENCE

---

## 1.1 Add `check_connection` Tool [P0]

**Goal**: Allow users to verify Figma plugin connection status before starting work.

### Files to Create

- `mcp-server/src/tools/check_connection.ts`

### Files to Modify

- `mcp-server/src/index.ts` (register tool)
- `mcp-server/src/figma-bridge.ts` (add status method)
- `figma-plugin/code.ts` (add handler)
- `websocket-server/server.js` (add status tracking)

### Implementation Tasks

#### Task 1.1.1: Add connection status tracking to WebSocket server

```
File: websocket-server/server.js

Add:
- Track connection timestamp for figmaPluginClient
- Track last message timestamp
- Add 'get_status' message type handler

Code changes:
1. Add `let figmaPluginConnectedAt = null;`
2. Add `let lastFigmaMessageAt = null;`
3. On figma_hello: set figmaPluginConnectedAt = Date.now()
4. On any message from figma: update lastFigmaMessageAt
5. Handle 'get_status' type: return { connected, connectedAt, lastMessageAt, clientCount }
```

#### Task 1.1.2: Add status method to FigmaBridge

```
File: mcp-server/src/figma-bridge.ts

Add method:
async getConnectionStatus(): Promise<ConnectionStatus> {
  return {
    connected: this.isConnected(),
    wsReadyState: this.ws?.readyState,
    pendingRequests: this.pendingRequests.size,
    circuitBreakerState: this.circuitBreaker.getState(),
    reconnectAttempts: this.reconnectAttempts
  };
}
```

#### Task 1.1.3: Create check_connection tool

```
File: mcp-server/src/tools/check_connection.ts

Schema:
- No input required (empty object)

Implementation:
1. Get bridge status via getFigmaBridge().getConnectionStatus()
2. Send 'ping' message to Figma plugin, measure round-trip time
3. Request Figma file info from plugin

Response:
{
  connected: boolean,
  latencyMs: number,
  figmaFile: string | null,
  pluginVersion: string,
  pendingRequests: number,
  circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
}
```

#### Task 1.1.4: Add ping handler to Figma plugin

```
File: figma-plugin/code.ts

Add case 'ping':
  result = {
    pong: true,
    timestamp: Date.now(),
    pluginVersion: '1.0.0',
    fileName: figma.root.name,
    currentPage: figma.currentPage.name
  };
  break;
```

#### Task 1.1.5: Register tool in index.ts

```
File: mcp-server/src/index.ts

1. Import checkConnection, checkConnectionToolDefinition
2. Add to TOOLS array
3. Add case handler in switch statement
```

### Estimated Effort: 2-3 hours

---

## 1.2 Add Component Template Library [P1]

**Goal**: Provide pre-built templates for common UI components.

### Files to Create

- `mcp-server/src/templates/index.ts`
- `mcp-server/src/templates/button-templates.ts`
- `mcp-server/src/templates/input-templates.ts`
- `mcp-server/src/templates/card-templates.ts`
- `mcp-server/src/templates/layout-templates.ts`
- `mcp-server/src/tools/create_from_template.ts`
- `mcp-server/src/tools/list_templates.ts`

### Files to Modify

- `mcp-server/src/index.ts`

### Implementation Tasks

#### Task 1.2.1: Define template interface

```
File: mcp-server/src/templates/index.ts

interface ComponentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'button' | 'input' | 'card' | 'layout' | 'navigation' | 'feedback';
  spec: NodeSpec;  // Same format as create_design
  overridableProps: string[];  // e.g., ['text', 'fillColor', 'width']
  variants?: Record<string, Partial<NodeSpec>>;
}

export function getTemplate(id: string): ComponentTemplate | null;
export function listTemplates(category?: string): ComponentTemplate[];
export function applyOverrides(template: ComponentTemplate, overrides: Record<string, any>): NodeSpec;
```

#### Task 1.2.2: Create button templates

```
File: mcp-server/src/templates/button-templates.ts

Templates:
- button-primary: Blue filled button with white text
- button-secondary: Outlined button with border
- button-ghost: Text-only button
- button-icon: Icon button (circular)
- button-with-icon: Button with leading icon

Each includes:
- Base spec with proper auto-layout, padding, cornerRadius
- Variants: small, medium, large
- Overridable: text, fillColor, width, iconName
```

#### Task 1.2.3: Create input templates

```
File: mcp-server/src/templates/input-templates.ts

Templates:
- input-text: Basic text input with label
- input-password: Password input with visibility toggle icon
- input-search: Search input with magnifying glass icon
- input-textarea: Multi-line text area
- input-select: Dropdown select with chevron

Each includes:
- Label + input field structure
- Focus state styling
- Error state variant
```

#### Task 1.2.4: Create card templates

```
File: mcp-server/src/templates/card-templates.ts

Templates:
- card-simple: Basic card with padding
- card-with-header: Card with header/body sections
- card-with-image: Card with image, title, description
- card-horizontal: Horizontal layout card
- card-interactive: Card with hover state styling
```

#### Task 1.2.5: Create layout templates

```
File: mcp-server/src/templates/layout-templates.ts

Templates:
- navbar: Top navigation bar with logo, links, actions
- sidebar: Side navigation with menu items
- modal-dialog: Modal with header, content, actions
- page-header: Page header with title, breadcrumbs, actions
- footer: Footer with columns and links
```

#### Task 1.2.6: Create list_templates tool

```
File: mcp-server/src/tools/list_templates.ts

Input: { category?: string }
Output: { templates: Array<{ id, name, description, category }> }
```

#### Task 1.2.7: Create create_from_template tool

```
File: mcp-server/src/tools/create_from_template.ts

Input: {
  templateId: string,
  overrides?: Record<string, any>,
  variant?: string,
  parentId?: string
}

Implementation:
1. Get template by ID
2. Apply variant if specified
3. Apply overrides using applyOverrides()
4. Call create_design with resulting spec
```

### Estimated Effort: 8-10 hours

---

## 1.3 Add Undo/Delete Tools [P3]

**Goal**: Allow users to undo recent operations or delete created nodes.

### Files to Create

- `mcp-server/src/tools/delete_nodes.ts`
- `mcp-server/src/tools/undo_last_operation.ts`
- `mcp-server/src/session/operation-history.ts`

### Files to Modify

- `mcp-server/src/index.ts`
- `mcp-server/src/tools/create_design.ts` (record operations)
- `figma-plugin/code.ts` (add delete handler)

### Implementation Tasks

#### Task 1.3.1: Create operation history tracker

```
File: mcp-server/src/session/operation-history.ts

interface Operation {
  id: string;
  type: 'create_design' | 'create_frame' | 'set_fills' | ...;
  timestamp: number;
  createdNodeIds: string[];
  canUndo: boolean;
}

class OperationHistory {
  private operations: Operation[] = [];
  private maxHistory = 50;

  record(op: Operation): void;
  getLastOperation(): Operation | null;
  getLastN(n: number): Operation[];
  clear(): void;
}

export const operationHistory = new OperationHistory();
```

#### Task 1.3.2: Record operations in create_design

```
File: mcp-server/src/tools/create_design.ts

After successful creation:
operationHistory.record({
  id: generateId(),
  type: 'create_design',
  timestamp: Date.now(),
  createdNodeIds: Object.values(response.nodeIds),
  canUndo: true
});
```

#### Task 1.3.3: Create delete_nodes tool

```
File: mcp-server/src/tools/delete_nodes.ts

Input: { nodeIds: string[] }

Implementation:
1. Send 'delete_nodes' message to Figma plugin
2. Remove nodes from node registry

Response: { deleted: string[], notFound: string[] }
```

#### Task 1.3.4: Add delete handler to Figma plugin

```
File: figma-plugin/code.ts

case 'delete_nodes': {
  const deleted: string[] = [];
  const notFound: string[] = [];

  for (const nodeId of payload.nodeIds) {
    const node = getNode(nodeId);
    if (node) {
      node.remove();
      nodeCache.delete(nodeId);
      deleted.push(nodeId);
    } else {
      notFound.push(nodeId);
    }
  }

  result = { deleted, notFound };
  break;
}
```

#### Task 1.3.5: Create undo_last_operation tool

```
File: mcp-server/src/tools/undo_last_operation.ts

Input: { count?: number }  // default 1

Implementation:
1. Get last N operations from history
2. For each, if canUndo, call delete_nodes with createdNodeIds
3. Remove from history

Response: { undone: number, operations: Operation[] }
```

### Estimated Effort: 4-5 hours

---

## 1.4 Add Preview/Dry-Run Mode [P2]

**Goal**: Validate specs before creating nodes.

### Files to Create

- `mcp-server/src/tools/preview_spec.ts`
- `mcp-server/src/utils/spec-validator.ts`

### Files to Modify

- `mcp-server/src/index.ts`

### Implementation Tasks

#### Task 1.4.1: Create spec validator

```
File: mcp-server/src/utils/spec-validator.ts

interface ValidationResult {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
  warnings: Array<{ path: string; message: string; suggestion?: any }>;
  stats: {
    totalNodes: number;
    nodesByType: Record<string, number>;
    maxDepth: number;
  };
}

function validateSpec(spec: NodeSpec): ValidationResult {
  // Recursively validate:
  // 1. Required fields (type)
  // 2. Valid type values
  // 3. Spacing values on 8pt grid
  // 4. Font sizes in type scale
  // 5. Color formats valid hex
  // 6. No orphan text nodes (must have parent)
  // 7. Children only on frames
}

function countNodes(spec: NodeSpec): { total: number; byType: Record<string, number> };
function calculateDepth(spec: NodeSpec): number;
```

#### Task 1.4.2: Create preview_spec tool

```
File: mcp-server/src/tools/preview_spec.ts

Input: {
  spec: NodeSpec,
  autoCorrect?: boolean  // Apply suggestions automatically
}

Implementation:
1. Run validateSpec(spec)
2. If autoCorrect, apply spacing/typography corrections
3. Return validation result + corrected spec if applicable

Response: {
  valid: boolean,
  errors: [...],
  warnings: [...],
  stats: { totalNodes, nodesByType, maxDepth },
  correctedSpec?: NodeSpec  // If autoCorrect was true
}
```

### Estimated Effort: 3-4 hours

---

## 1.5 Add Smart Defaults [P3]

**Goal**: Infer sensible defaults based on context.

### Files to Create

- `mcp-server/src/utils/smart-defaults.ts`

### Files to Modify

- `mcp-server/src/tools/create_design.ts`
- `mcp-server/src/tools/create_text.ts`
- `mcp-server/src/tools/create_frame.ts`

### Implementation Tasks

#### Task 1.5.1: Create smart defaults engine

```
File: mcp-server/src/utils/smart-defaults.ts

interface Context {
  parentFillColor?: string;
  parentLayoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  siblingCount?: number;
  nodeName?: string;
}

function inferTextColor(context: Context): string {
  // If parent is dark (luminance < 0.5), return white
  // If parent is light, return black
}

function inferLayoutSizing(context: Context): { horizontal: string; vertical: string } {
  // If parent is HORIZONTAL, child defaults to HUG horizontal, FILL vertical
  // If parent is VERTICAL, child defaults to FILL horizontal, HUG vertical
}

function inferFrameDefaults(nodeName: string): Partial<FrameProps> {
  // 'Button' → cornerRadius: 8, padding: 16, layoutMode: 'HORIZONTAL'
  // 'Card' → cornerRadius: 12, padding: 24, layoutMode: 'VERTICAL'
  // 'Input' → height: 48, cornerRadius: 4, padding: 16
}

export function applySmartDefaults(spec: NodeSpec, context: Context): NodeSpec;
```

#### Task 1.5.2: Integrate into create_design

```
File: mcp-server/src/tools/create_design.ts

Before sending to Figma:
1. Walk spec tree
2. For each node, build context from parent
3. Apply smart defaults where props are undefined
```

### Estimated Effort: 4-5 hours

---

# SECTION 2: ERROR RESILIENCE

---

## 2.1 Add Request Queue for Disconnection Recovery [P2]

**Goal**: Queue requests when disconnected, replay when reconnected.

### Files to Modify

- `mcp-server/src/figma-bridge.ts`

### Implementation Tasks

#### Task 2.1.1: Add request queue to FigmaBridge

```
File: mcp-server/src/figma-bridge.ts

Add properties:
private requestQueue: Array<{
  type: string;
  payload: unknown;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timestamp: number;
}> = [];
private readonly maxQueueSize = 100;
private readonly queueTimeout = 30000;  // 30 seconds

Add method:
private enqueue(type: string, payload: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    if (this.requestQueue.length >= this.maxQueueSize) {
      reject(new Error('Request queue full'));
      return;
    }
    this.requestQueue.push({ type, payload, resolve, reject, timestamp: Date.now() });
  });
}
```

#### Task 2.1.2: Modify sendToFigma to use queue

```
File: mcp-server/src/figma-bridge.ts

async sendToFigma<T>(type: string, payload: unknown): Promise<T> {
  if (!this.isConnected()) {
    console.error('[FigmaBridge] Not connected, queuing request...');
    return this.enqueue(type, payload);
  }
  // ... existing implementation
}
```

#### Task 2.1.3: Replay queue on reconnection

```
File: mcp-server/src/figma-bridge.ts

In connect() on 'open' event, after setting connected = true:

private async replayQueue(): Promise<void> {
  const now = Date.now();
  const validRequests = this.requestQueue.filter(
    req => now - req.timestamp < this.queueTimeout
  );

  // Reject expired requests
  this.requestQueue
    .filter(req => now - req.timestamp >= this.queueTimeout)
    .forEach(req => req.reject(new Error('Request expired in queue')));

  // Clear queue
  this.requestQueue = [];

  // Replay valid requests
  for (const req of validRequests) {
    try {
      const result = await this.sendToFigma(req.type, req.payload);
      req.resolve(result);
    } catch (error) {
      req.reject(error as Error);
    }
  }
}
```

### Estimated Effort: 3-4 hours

---

## 2.2 Add Transaction Rollback for create_design [P1]

**Goal**: Delete partially created nodes if create_design fails mid-operation.

### Files to Modify

- `figma-plugin/code.ts`

### Implementation Tasks

#### Task 2.2.1: Add rollback tracking to create_design handler

```
File: figma-plugin/code.ts

In case 'create_design':

// Add at start of handler
const createdNodes: SceneNode[] = [];
const rollback = () => {
  console.log(`[create_design] Rolling back ${createdNodes.length} nodes`);
  for (const node of createdNodes.reverse()) {
    try {
      node.remove();
    } catch (e) {
      console.warn(`[create_design] Failed to remove node during rollback:`, e);
    }
  }
  nodeMap.clear();
};

// Modify createNode function to track created nodes
const createNode = async (nodeSpec, parent): Promise<SceneNode> => {
  // ... existing code to create node ...
  createdNodes.push(node);  // Add this line after node creation
  // ... rest of function
};

// Wrap main logic in try-catch
try {
  const rootNode = await createNode(spec, rootParent);
  // ... rest of success handling
} catch (error) {
  rollback();
  throw error;  // Re-throw to be caught by outer handler
}
```

#### Task 2.2.2: Add partial success response option

```
File: figma-plugin/code.ts

// For recoverable errors, optionally return partial results
result = {
  success: false,
  partial: true,
  createdNodeIds: createdNodes.map(n => n.id),
  error: error.message,
  rolledBack: true  // or false if user wants to keep partial
};
```

### Estimated Effort: 2-3 hours

---

## 2.3 Add Structured Error Codes [P0]

**Goal**: Provide machine-readable error codes for programmatic handling.

### Files to Create

- `mcp-server/src/errors/error-codes.ts`

### Files to Modify

- `mcp-server/src/errors/index.ts`
- `mcp-server/src/figma-bridge.ts`
- `mcp-server/src/tools/*.ts` (all tool files)
- `figma-plugin/code.ts`

### Implementation Tasks

#### Task 2.3.1: Define error code enum

```
File: mcp-server/src/errors/error-codes.ts

export enum ErrorCode {
  // Connection errors
  FIGMA_NOT_CONNECTED = 'FIGMA_NOT_CONNECTED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  CONNECTION_LOST = 'CONNECTION_LOST',

  // Node errors
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  INVALID_NODE_TYPE = 'INVALID_NODE_TYPE',
  INVALID_PARENT = 'INVALID_PARENT',

  // Validation errors
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_COLOR = 'INVALID_COLOR',
  INVALID_SPACING = 'INVALID_SPACING',

  // Operation errors
  FONT_LOAD_FAILED = 'FONT_LOAD_FAILED',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  OPERATION_FAILED = 'OPERATION_FAILED',

  // System errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  QUEUE_FULL = 'QUEUE_FULL',
  CIRCUIT_OPEN = 'CIRCUIT_OPEN'
}

export interface StructuredError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  suggestion?: string;
}
```

#### Task 2.3.2: Create error factory functions

```
File: mcp-server/src/errors/index.ts

export function createError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): StructuredError {
  const suggestions: Record<ErrorCode, string> = {
    [ErrorCode.FIGMA_NOT_CONNECTED]: 'Ensure Figma is open and the plugin is running',
    [ErrorCode.NODE_NOT_FOUND]: 'Check if the node ID is correct and the node exists',
    [ErrorCode.FONT_LOAD_FAILED]: 'The font may not be installed. Try using Inter or Roboto',
    // ... more suggestions
  };

  return {
    code,
    message,
    details,
    suggestion: suggestions[code]
  };
}
```

#### Task 2.3.3: Update FigmaBridge to use structured errors

```
File: mcp-server/src/figma-bridge.ts

Replace:
throw new FigmaBridgeError('Not connected to Figma plugin', 'NOT_CONNECTED');

With:
throw new FigmaBridgeError(
  createError(ErrorCode.FIGMA_NOT_CONNECTED, 'Not connected to Figma plugin')
);
```

#### Task 2.3.4: Update tools to return structured errors

```
File: mcp-server/src/tools/*.ts

Update error responses:
return {
  success: false,
  error: createError(
    ErrorCode.NODE_NOT_FOUND,
    `Node not found: ${nodeId}`,
    { nodeId }
  )
};
```

#### Task 2.3.5: Update Figma plugin error responses

```
File: figma-plugin/code.ts

Update error handling to include error codes:
figma.ui.postMessage({
  id: requestId,
  success: false,
  error: {
    code: 'NODE_NOT_FOUND',
    message: `Node not found: ${payload.nodeId}`,
    details: { nodeId: payload.nodeId }
  }
});
```

### Estimated Effort: 4-5 hours

---

## 2.4 Add Automatic Font Fallback Chain [P2]

**Goal**: Gracefully handle missing fonts with fallback options.

### Files to Create

- `mcp-server/src/utils/font-manager.ts`

### Files to Modify

- `figma-plugin/code.ts`

### Implementation Tasks

#### Task 2.4.1: Create font fallback configuration

```
File: mcp-server/src/utils/font-manager.ts

export const FONT_FALLBACKS: Record<string, string[]> = {
  // Sans-serif fonts
  'Roboto': ['Inter', 'SF Pro', 'Helvetica Neue', 'Arial'],
  'Open Sans': ['Inter', 'Roboto', 'Helvetica Neue', 'Arial'],
  'Lato': ['Inter', 'Roboto', 'Helvetica Neue', 'Arial'],
  'Montserrat': ['Inter', 'Roboto', 'Helvetica Neue', 'Arial'],

  // Serif fonts
  'Playfair Display': ['Georgia', 'Times New Roman', 'Merriweather'],
  'Merriweather': ['Georgia', 'Times New Roman', 'Playfair Display'],

  // Monospace fonts
  'Fira Code': ['JetBrains Mono', 'Source Code Pro', 'Monaco', 'Courier New'],
  'JetBrains Mono': ['Fira Code', 'Source Code Pro', 'Monaco', 'Courier New'],

  // Default fallback for any font
  'default': ['Inter', 'Roboto', 'Arial']
};

export function getFallbackChain(fontFamily: string): string[] {
  return FONT_FALLBACKS[fontFamily] || FONT_FALLBACKS['default'];
}
```

#### Task 2.4.2: Update Figma plugin font loading

```
File: figma-plugin/code.ts

// Add helper function
async function loadFontWithFallback(
  family: string,
  style: string
): Promise<{ family: string; style: string; usedFallback: boolean }> {
  const fallbacks = [family, 'Inter', 'Roboto', 'Arial'];

  for (const fallbackFamily of fallbacks) {
    try {
      await figma.loadFontAsync({ family: fallbackFamily, style });
      return {
        family: fallbackFamily,
        style,
        usedFallback: fallbackFamily !== family
      };
    } catch (e) {
      // Try next fallback
    }

    // If style failed, try Regular
    if (style !== 'Regular') {
      try {
        await figma.loadFontAsync({ family: fallbackFamily, style: 'Regular' });
        return {
          family: fallbackFamily,
          style: 'Regular',
          usedFallback: true
        };
      } catch (e) {
        // Try next fallback
      }
    }
  }

  throw new Error(`Failed to load font ${family} ${style} and all fallbacks`);
}

// Update text creation to use this function and report fallback usage
```

### Estimated Effort: 2-3 hours

---

## 2.5 Add Operation Idempotency Keys [P3]

**Goal**: Prevent duplicate operations from network retries.

### Files to Create

- `mcp-server/src/utils/idempotency.ts`

### Files to Modify

- `mcp-server/src/tools/create_design.ts`
- `figma-plugin/code.ts`

### Implementation Tasks

#### Task 2.5.1: Create idempotency store

```
File: mcp-server/src/utils/idempotency.ts

interface CachedResult {
  result: any;
  timestamp: number;
}

class IdempotencyStore {
  private cache = new Map<string, CachedResult>();
  private readonly ttlMs = 300000;  // 5 minutes

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return cached.result;
  }

  set(key: string, result: any): void {
    this.cache.set(key, { result, timestamp: Date.now() });
    this.prune();
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }
}

export const idempotencyStore = new IdempotencyStore();
```

#### Task 2.5.2: Add idempotency key support to create_design

```
File: mcp-server/src/tools/create_design.ts

Input schema addition:
idempotencyKey: z.string().optional()

Implementation:
if (params.idempotencyKey) {
  const cached = idempotencyStore.get(params.idempotencyKey);
  if (cached) {
    return { ...cached, fromCache: true };
  }
}

// ... perform operation ...

if (params.idempotencyKey) {
  idempotencyStore.set(params.idempotencyKey, result);
}
```

### Estimated Effort: 2 hours

---

# SECTION 3: DESIGN QUALITY

---

## 3.1 Add Auto-Validation Before Creation [P0]

**Goal**: Automatically validate and correct design specs before creation.

### Files to Create

- `mcp-server/src/utils/auto-validator.ts`

### Files to Modify

- `mcp-server/src/tools/create_design.ts`
- `mcp-server/src/constraints/spacing.ts`
- `mcp-server/src/constraints/typography.ts`

### Implementation Tasks

#### Task 3.1.1: Create auto-correction utilities

```
File: mcp-server/src/utils/auto-validator.ts

interface AutoCorrectionResult {
  original: any;
  corrected: any;
  corrections: Array<{
    path: string;
    field: string;
    originalValue: any;
    correctedValue: any;
    reason: string;
  }>;
}

function snapToGrid(value: number, gridValues: number[]): number {
  return gridValues.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}

function autoCorrectSpec(spec: NodeSpec): AutoCorrectionResult {
  const corrections: Correction[] = [];

  function walk(node: NodeSpec, path: string) {
    if (node.props) {
      // Snap spacing values
      for (const key of ['padding', 'itemSpacing', 'paddingLeft', ...]) {
        if (node.props[key] !== undefined) {
          const snapped = snapToGrid(node.props[key], VALID_SPACING_VALUES);
          if (snapped !== node.props[key]) {
            corrections.push({
              path,
              field: key,
              originalValue: node.props[key],
              correctedValue: snapped,
              reason: 'Snapped to 8pt grid'
            });
            node.props[key] = snapped;
          }
        }
      }

      // Snap font sizes
      if (node.props.fontSize) {
        const snapped = snapToGrid(node.props.fontSize, VALID_FONT_SIZES);
        if (snapped !== node.props.fontSize) {
          corrections.push({ ... });
          node.props.fontSize = snapped;
        }
      }
    }

    // Recurse to children
    node.children?.forEach((child, i) => walk(child, `${path}.children[${i}]`));
  }

  const corrected = JSON.parse(JSON.stringify(spec));
  walk(corrected, 'root');
  return { original: spec, corrected, corrections };
}
```

#### Task 3.1.2: Integrate into create_design

```
File: mcp-server/src/tools/create_design.ts

// Add to input schema
autoCorrect: z.boolean().default(true).optional()

// Before sending to Figma
const { corrected, corrections } = autoCorrectSpec(params.spec);
if (corrections.length > 0 && params.autoCorrect !== false) {
  console.log(`[create_design] Applied ${corrections.length} auto-corrections`);
}

// Use corrected spec
const response = await bridge.sendToFigma('create_design', {
  spec: params.autoCorrect === false ? params.spec : corrected,
  parentId: params.parentId
});

// Include corrections in response
return {
  ...result,
  autoCorrections: corrections.length > 0 ? corrections : undefined
};
```

### Estimated Effort: 4-5 hours

---

## 3.2 Add `analyze_design` Tool [P1]

**Goal**: Audit existing designs for quality issues.

### Files to Create

- `mcp-server/src/tools/analyze_design.ts`

### Files to Modify

- `mcp-server/src/index.ts`
- `figma-plugin/code.ts`

### Implementation Tasks

#### Task 3.2.1: Create analysis handler in Figma plugin

```
File: figma-plugin/code.ts

case 'analyze_design': {
  const scope = payload.scope || 'selection';
  let nodes: SceneNode[];

  if (scope === 'selection') {
    nodes = [...figma.currentPage.selection];
  } else if (scope === 'page') {
    nodes = [...figma.currentPage.children];
  } else if (payload.nodeId) {
    const node = getNode(payload.nodeId);
    nodes = node ? [node] : [];
  }

  const issues: Issue[] = [];

  function analyzeNode(node: SceneNode, depth = 0) {
    // Check spacing
    if ('paddingLeft' in node) {
      for (const key of ['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', 'itemSpacing']) {
        const value = node[key];
        if (value && !VALID_SPACING.includes(value)) {
          issues.push({
            type: 'spacing',
            severity: 'warning',
            nodeId: node.id,
            nodeName: node.name,
            field: key,
            currentValue: value,
            suggestedValue: snapToGrid(value),
            message: `${key} (${value}px) not on 8pt grid`
          });
        }
      }
    }

    // Check typography
    if (node.type === 'TEXT') {
      const fontSize = node.fontSize as number;
      if (!VALID_FONT_SIZES.includes(fontSize)) {
        issues.push({ ... });
      }
    }

    // Check contrast
    if ('fills' in node && node.fills && Array.isArray(node.fills)) {
      // Analyze text on background contrast
      // ...
    }

    // Recurse
    if ('children' in node) {
      node.children.forEach(child => analyzeNode(child, depth + 1));
    }
  }

  nodes.forEach(node => analyzeNode(node));

  result = {
    nodeCount: countAllNodes(nodes),
    issues,
    score: calculateScore(issues),
    summary: generateSummary(issues)
  };
  break;
}
```

#### Task 3.2.2: Create MCP tool wrapper

```
File: mcp-server/src/tools/analyze_design.ts

Input: {
  scope: 'selection' | 'page' | 'node',
  nodeId?: string,
  checks?: ('spacing' | 'typography' | 'contrast' | 'naming')[]
}

Output: {
  nodeCount: number,
  issues: Issue[],
  issuesByType: Record<string, number>,
  score: number,  // 0-100
  passesWCAG: boolean,
  summary: string
}
```

### Estimated Effort: 6-8 hours

---

## 3.3 Add Design System Profiles [P2]

**Goal**: Support different design system constraints.

### Files to Create

- `mcp-server/src/design-systems/index.ts`
- `mcp-server/src/design-systems/material-design.ts`
- `mcp-server/src/design-systems/apple-hig.ts`
- `mcp-server/src/design-systems/tailwind.ts`
- `mcp-server/src/tools/set_design_system.ts`
- `mcp-server/src/tools/get_design_system.ts`

### Files to Modify

- `mcp-server/src/constraints/spacing.ts`
- `mcp-server/src/constraints/typography.ts`
- `mcp-server/src/constraints/color.ts`
- `mcp-server/src/index.ts`

### Implementation Tasks

#### Task 3.3.1: Define design system interface

```
File: mcp-server/src/design-systems/index.ts

export interface DesignSystemProfile {
  id: string;
  name: string;
  version: string;

  spacing: {
    baseUnit: number;
    scale: number[];
  };

  typography: {
    fontSizes: number[];
    lineHeights: Record<number, number>;
    fontFamilies: {
      primary: string;
      secondary?: string;
      monospace?: string;
    };
    fontWeights: number[];
  };

  colors: {
    primary: string;
    secondary: string;
    error: string;
    warning: string;
    success: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
  };

  cornerRadius: number[];

  shadows: Array<{
    name: string;
    blur: number;
    spread: number;
    offset: { x: number; y: number };
    color: string;
  }>;
}

let activeProfile: DesignSystemProfile = defaultProfile;

export function getActiveProfile(): DesignSystemProfile;
export function setActiveProfile(profile: DesignSystemProfile): void;
export function getProfile(id: string): DesignSystemProfile | null;
```

#### Task 3.3.2: Create Material Design 3 profile

```
File: mcp-server/src/design-systems/material-design.ts

export const materialDesign3: DesignSystemProfile = {
  id: 'material-design-3',
  name: 'Material Design 3',
  version: '3.0',

  spacing: {
    baseUnit: 4,
    scale: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64]
  },

  typography: {
    fontSizes: [11, 12, 14, 16, 22, 24, 28, 32, 36, 45, 57],
    lineHeights: { 11: 16, 12: 16, 14: 20, 16: 24, ... },
    fontFamilies: { primary: 'Roboto', monospace: 'Roboto Mono' },
    fontWeights: [400, 500, 700]
  },

  colors: {
    primary: '#6750A4',
    secondary: '#625B71',
    error: '#B3261E',
    // ...
  },

  cornerRadius: [0, 4, 8, 12, 16, 28],

  shadows: [
    { name: 'elevation-1', blur: 3, spread: 1, offset: { x: 0, y: 1 }, color: 'rgba(0,0,0,0.15)' },
    // ...
  ]
};
```

#### Task 3.3.3: Create set_design_system tool

```
File: mcp-server/src/tools/set_design_system.ts

Input: {
  profile: 'material-design-3' | 'apple-hig' | 'tailwind' | 'custom',
  overrides?: Partial<DesignSystemProfile>
}

Implementation:
1. Get base profile by id
2. Merge overrides if provided
3. Set as active profile
4. Update constraint validators to use active profile
```

#### Task 3.3.4: Update constraint validators

```
File: mcp-server/src/constraints/spacing.ts

// Replace hardcoded values with profile values
export function getValidSpacingValues(): number[] {
  return getActiveProfile().spacing.scale;
}

export function validateSpacing(value: number): ValidationResult {
  const validValues = getValidSpacingValues();
  // ...
}
```

### Estimated Effort: 8-10 hours

---

## 3.4 Add `suggest_improvements` Tool [P3]

**Goal**: AI-powered suggestions based on analysis.

### Files to Create

- `mcp-server/src/tools/suggest_improvements.ts`
- `mcp-server/src/utils/design-advisor.ts`

### Files to Modify

- `mcp-server/src/index.ts`

### Implementation Tasks

#### Task 3.4.1: Create design advisor engine

```
File: mcp-server/src/utils/design-advisor.ts

interface Suggestion {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'accessibility' | 'consistency' | 'spacing' | 'typography' | 'color';
  nodeId: string;
  nodeName: string;
  currentState: string;
  recommendation: string;
  action?: {
    tool: string;
    params: Record<string, any>;
  };
}

function suggestAccessibilityImprovements(node: NodeInfo): Suggestion[] {
  // Contrast ratio improvements
  // Touch target size (minimum 44x44)
  // Focus indicators
}

function suggestConsistencyImprovements(nodes: NodeInfo[]): Suggestion[] {
  // Find similar elements with different styling
  // Suggest unifying colors, fonts, spacing
}

function suggestSpacingImprovements(node: NodeInfo): Suggestion[] {
  // Identify inconsistent padding
  // Suggest grid alignment
}

export function generateSuggestions(
  nodes: NodeInfo[],
  focus?: 'accessibility' | 'consistency' | 'spacing' | 'all'
): Suggestion[];
```

#### Task 3.4.2: Create suggest_improvements tool

```
File: mcp-server/src/tools/suggest_improvements.ts

Input: {
  nodeId?: string,
  scope?: 'selection' | 'page',
  focus?: 'accessibility' | 'consistency' | 'spacing' | 'all',
  limit?: number
}

Implementation:
1. Get nodes to analyze (via Figma plugin)
2. Run generateSuggestions()
3. Sort by priority
4. Return top N suggestions

Output: {
  suggestions: Suggestion[],
  summary: {
    critical: number,
    high: number,
    medium: number,
    low: number
  }
}
```

### Estimated Effort: 6-8 hours

---

## 3.5 Add Responsive Variant Generation [P3]

**Goal**: Auto-generate mobile/tablet/desktop variants.

### Files to Create

- `mcp-server/src/tools/generate_responsive_variants.ts`
- `mcp-server/src/utils/responsive-transformer.ts`

### Files to Modify

- `mcp-server/src/index.ts`
- `figma-plugin/code.ts`

### Implementation Tasks

#### Task 3.5.1: Create responsive transformer

```
File: mcp-server/src/utils/responsive-transformer.ts

interface Breakpoint {
  name: string;
  width: number;
  adjustments: {
    padding?: number | ((current: number) => number);
    fontSize?: number | ((current: number) => number);
    itemSpacing?: number | ((current: number) => number);
    layoutMode?: 'HORIZONTAL' | 'VERTICAL';
    hideElements?: string[];  // Node names to hide
  };
}

const DEFAULT_BREAKPOINTS: Breakpoint[] = [
  {
    name: 'Mobile',
    width: 375,
    adjustments: {
      padding: (p) => Math.min(p, 16),
      fontSize: (f) => Math.max(f * 0.875, 12),
      itemSpacing: (s) => Math.min(s, 16)
    }
  },
  {
    name: 'Tablet',
    width: 768,
    adjustments: {
      padding: (p) => Math.min(p, 24)
    }
  },
  {
    name: 'Desktop',
    width: 1440,
    adjustments: {}  // No changes
  }
];

function transformForBreakpoint(
  spec: NodeSpec,
  breakpoint: Breakpoint
): NodeSpec {
  // Deep clone spec
  // Apply adjustments recursively
  // Update width for root frame
}
```

#### Task 3.5.2: Create generate_responsive_variants tool

```
File: mcp-server/src/tools/generate_responsive_variants.ts

Input: {
  sourceNodeId: string,
  breakpoints?: Breakpoint[],
  layout?: 'horizontal' | 'vertical',  // How to arrange variants
  spacing?: number
}

Implementation:
1. Get source node info and extract its structure
2. For each breakpoint, transform the structure
3. Create variants using create_design
4. Optionally create containing frame with all variants

Output: {
  variants: Array<{
    name: string,
    width: number,
    nodeId: string
  }>,
  containerNodeId?: string
}
```

#### Task 3.5.3: Add node extraction to Figma plugin

```
File: figma-plugin/code.ts

case 'extract_node_spec': {
  const node = getNode(payload.nodeId);
  if (!node) throw new Error('Node not found');

  function nodeToSpec(n: SceneNode): NodeSpec {
    const spec: NodeSpec = {
      type: getNodeType(n),
      name: n.name,
      props: extractProps(n)
    };

    if ('children' in n && n.children) {
      spec.children = n.children.map(nodeToSpec);
    }

    return spec;
  }

  result = { spec: nodeToSpec(node) };
  break;
}
```

### Estimated Effort: 8-10 hours

---

# Implementation Schedule

## Week 1 (P0 - Critical)

| Task                       | Est. Hours | Dependencies |
| -------------------------- | ---------- | ------------ |
| 1.1 check_connection       | 3h         | None         |
| 2.3 Structured error codes | 5h         | None         |
| 3.1 Auto-validation        | 5h         | None         |
| **Total**                  | **13h**    |              |

## Week 2 (P1 - High)

| Task                     | Est. Hours | Dependencies |
| ------------------------ | ---------- | ------------ |
| 2.2 Transaction rollback | 3h         | None         |
| 1.2 Template library     | 10h        | None         |
| 3.2 analyze_design tool  | 8h         | 2.3          |
| **Total**                | **21h**    |              |

## Week 3-4 (P2 - Medium)

| Task                       | Est. Hours | Dependencies |
| -------------------------- | ---------- | ------------ |
| 2.1 Request queue          | 4h         | None         |
| 1.4 preview_spec           | 4h         | 3.1          |
| 3.3 Design system profiles | 10h        | None         |
| 2.4 Font fallback chain    | 3h         | None         |
| **Total**                  | **21h**    |              |

## Backlog (P3 - Low)

| Task                     | Est. Hours | Dependencies |
| ------------------------ | ---------- | ------------ |
| 1.3 Undo/delete tools    | 5h         | None         |
| 1.5 Smart defaults       | 5h         | 3.3          |
| 2.5 Idempotency keys     | 2h         | None         |
| 3.4 suggest_improvements | 8h         | 3.2          |
| 3.5 Responsive variants  | 10h        | 3.2          |
| **Total**                | **30h**    |              |

---

# Quick Reference: File Changes by Feature

```
1.1 check_connection
├── CREATE: mcp-server/src/tools/check_connection.ts
├── MODIFY: mcp-server/src/figma-bridge.ts
├── MODIFY: mcp-server/src/index.ts
├── MODIFY: figma-plugin/code.ts
└── MODIFY: websocket-server/server.js

1.2 Template library
├── CREATE: mcp-server/src/templates/index.ts
├── CREATE: mcp-server/src/templates/button-templates.ts
├── CREATE: mcp-server/src/templates/input-templates.ts
├── CREATE: mcp-server/src/templates/card-templates.ts
├── CREATE: mcp-server/src/templates/layout-templates.ts
├── CREATE: mcp-server/src/tools/create_from_template.ts
├── CREATE: mcp-server/src/tools/list_templates.ts
└── MODIFY: mcp-server/src/index.ts

1.3 Undo/delete
├── CREATE: mcp-server/src/tools/delete_nodes.ts
├── CREATE: mcp-server/src/tools/undo_last_operation.ts
├── CREATE: mcp-server/src/session/operation-history.ts
├── MODIFY: mcp-server/src/tools/create_design.ts
├── MODIFY: mcp-server/src/index.ts
└── MODIFY: figma-plugin/code.ts

1.4 Preview spec
├── CREATE: mcp-server/src/tools/preview_spec.ts
├── CREATE: mcp-server/src/utils/spec-validator.ts
└── MODIFY: mcp-server/src/index.ts

1.5 Smart defaults
├── CREATE: mcp-server/src/utils/smart-defaults.ts
├── MODIFY: mcp-server/src/tools/create_design.ts
├── MODIFY: mcp-server/src/tools/create_text.ts
└── MODIFY: mcp-server/src/tools/create_frame.ts

2.1 Request queue
└── MODIFY: mcp-server/src/figma-bridge.ts

2.2 Transaction rollback
└── MODIFY: figma-plugin/code.ts

2.3 Structured errors
├── CREATE: mcp-server/src/errors/error-codes.ts
├── MODIFY: mcp-server/src/errors/index.ts
├── MODIFY: mcp-server/src/figma-bridge.ts
├── MODIFY: mcp-server/src/tools/*.ts (all)
└── MODIFY: figma-plugin/code.ts

2.4 Font fallback
├── CREATE: mcp-server/src/utils/font-manager.ts
└── MODIFY: figma-plugin/code.ts

2.5 Idempotency
├── CREATE: mcp-server/src/utils/idempotency.ts
├── MODIFY: mcp-server/src/tools/create_design.ts
└── MODIFY: figma-plugin/code.ts

3.1 Auto-validation
├── CREATE: mcp-server/src/utils/auto-validator.ts
├── MODIFY: mcp-server/src/tools/create_design.ts
├── MODIFY: mcp-server/src/constraints/spacing.ts
└── MODIFY: mcp-server/src/constraints/typography.ts

3.2 Analyze design
├── CREATE: mcp-server/src/tools/analyze_design.ts
├── MODIFY: mcp-server/src/index.ts
└── MODIFY: figma-plugin/code.ts

3.3 Design system profiles
├── CREATE: mcp-server/src/design-systems/index.ts
├── CREATE: mcp-server/src/design-systems/material-design.ts
├── CREATE: mcp-server/src/design-systems/apple-hig.ts
├── CREATE: mcp-server/src/design-systems/tailwind.ts
├── CREATE: mcp-server/src/tools/set_design_system.ts
├── CREATE: mcp-server/src/tools/get_design_system.ts
├── MODIFY: mcp-server/src/constraints/spacing.ts
├── MODIFY: mcp-server/src/constraints/typography.ts
├── MODIFY: mcp-server/src/constraints/color.ts
└── MODIFY: mcp-server/src/index.ts

3.4 Suggest improvements
├── CREATE: mcp-server/src/tools/suggest_improvements.ts
├── CREATE: mcp-server/src/utils/design-advisor.ts
└── MODIFY: mcp-server/src/index.ts

3.5 Responsive variants
├── CREATE: mcp-server/src/tools/generate_responsive_variants.ts
├── CREATE: mcp-server/src/utils/responsive-transformer.ts
├── MODIFY: mcp-server/src/index.ts
└── MODIFY: figma-plugin/code.ts
```

---

# Total Effort Summary

| Priority  | Features | Hours   |
| --------- | -------- | ------- |
| P0        | 3        | 13h     |
| P1        | 3        | 21h     |
| P2        | 4        | 21h     |
| P3        | 5        | 30h     |
| **Total** | **15**   | **85h** |

---

_Generated: January 2025_
_Document Version: 1.0_
