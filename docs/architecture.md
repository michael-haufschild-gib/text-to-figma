# Architecture Guide for LLM Coding Agents

**Purpose**: Instructions for where to put code and what patterns to follow in this three-tier Figma design system.

**Tech Stack**: TypeScript 5.x | @modelcontextprotocol/sdk | WebSocket (ws) | Zod validation | Figma Plugin API

---

## System Overview

```
┌─────────────────┐     WebSocket      ┌─────────────────┐     Plugin UI     ┌─────────────────┐
│   MCP Server    │◄──────────────────►│ WebSocket Server │◄────────────────►│  Figma Plugin   │
│  (TypeScript)   │    Port 8080       │   (TypeScript)   │                  │  (TypeScript)   │
└─────────────────┘                    └─────────────────┘                  └─────────────────┘
      ▲                                                                            │
      │ MCP Protocol (stdio)                                                       │
      │                                                                            ▼
┌─────────────────┐                                                       ┌─────────────────┐
│   Claude/LLM    │                                                       │  Figma Canvas   │
└─────────────────┘                                                       └─────────────────┘
```

**Data flow**: Claude → MCP Server → WebSocket Server → Figma Plugin → Figma API

---

## Where to Put New Code

```
text-to-figma/
├── mcp-server/src/
│   ├── tools/              # PUT new MCP tools HERE (one file per tool)
│   ├── constraints/        # PUT design system constraints HERE
│   ├── errors/             # PUT custom error classes HERE
│   ├── monitoring/         # PUT logging/metrics/health checks HERE
│   ├── prompts/            # PUT LLM prompts HERE
│   ├── utils/              # PUT shared utilities HERE
│   ├── index.ts            # MODIFY to register new tools
│   ├── figma-bridge.ts     # WebSocket client (rarely modify)
│   └── node-registry.ts    # Hierarchy tracking (rarely modify)
│
├── websocket-server/
│   └── src/server.ts       # WebSocket bridge (rarely modify)
│
├── figma-plugin/
│   ├── code.ts             # Plugin logic - ADD message handlers HERE
│   ├── ui.html             # Plugin UI (rarely modify)
│   └── manifest.json       # Plugin config (rarely modify)
│
└── tests/
    ├── unit/               # PUT unit tests HERE
    ├── integration/        # PUT integration tests HERE
    ├── e2e/                # PUT end-to-end tests HERE
    └── validation/         # PUT design token validation tests HERE
```

---

## Decision Tree: Where Does My Code Go?

- **Creating a new MCP tool?** → `mcp-server/src/tools/{tool_name}.ts`
- **Adding Figma operation?** → Add handler in `figma-plugin/code.ts`
- **Adding design constraint?** → `mcp-server/src/constraints/{constraint}.ts`
- **Adding shared utility?** → `mcp-server/src/utils/{utility}.ts`
- **Adding custom error type?** → `mcp-server/src/errors/index.ts`
- **Adding metrics/logging?** → `mcp-server/src/monitoring/`
- **Writing unit test?** → `tests/unit/{module}.test.js`
- **Writing integration test?** → `tests/integration/{feature}.test.js`

---

## How to Create a New MCP Tool

### Step 1: Create the tool file

Create `mcp-server/src/tools/{tool_name}.ts`:

```typescript
/**
 * {Tool Name} Tool - {Brief description}
 *
 * {Longer description of what this tool does}
 */

import { z } from 'zod';
import { FigmaAPIError, NetworkError, ValidationError, wrapError } from '../errors/index.js';
import { getFigmaBridge } from '../figma-bridge.js';
import { trackError } from '../monitoring/error-tracker.js';
import { getLogger } from '../monitoring/logger.js';
import { getMetrics } from '../monitoring/metrics.js';

const logger = getLogger().child({ tool: '{tool_name}' });
const metrics = getMetrics();

// Register metrics for this tool
const invocationCounter = metrics.counter('tool_invocations_total', 'Total tool invocations', ['tool']);
const successCounter = metrics.counter('tool_success_total', 'Successful tool executions', ['tool']);
const errorCounter = metrics.counter('tool_errors_total', 'Tool execution errors', ['tool', 'error_type']);
const durationHistogram = metrics.histogram(
  'tool_duration_ms',
  'Tool execution duration in milliseconds',
  [10, 50, 100, 200, 500, 1000, 2000, 5000]
);

/**
 * Input schema for {tool_name} tool
 */
export const {toolName}InputSchema = z.object({
  // Define your input parameters with Zod
  nodeId: z.string().describe('ID of the target node'),
  // Add more parameters...
});

export type {ToolName}Input = z.infer<typeof {toolName}InputSchema>;

/**
 * Result interface
 */
export interface {ToolName}Result {
  success: boolean;
  // Add result fields...
}

/**
 * Tool definition for MCP registration
 */
export const {toolName}ToolDefinition = {
  name: '{tool_name}',
  description: '{Tool description for LLM}',
  inputSchema: {
    type: 'object' as const,
    properties: {
      nodeId: { type: 'string', description: 'ID of the target node' },
      // Mirror your Zod schema here for MCP...
    },
    required: ['nodeId'],
  },
};

/**
 * Execute the {tool_name} tool
 */
export async function {toolName}(input: {ToolName}Input): Promise<{ToolName}Result> {
  const startTime = Date.now();
  invocationCounter.inc({ tool: '{tool_name}' });

  try {
    // 1. Validate input
    const validated = {toolName}InputSchema.parse(input);
    logger.debug({ input: validated }, 'Executing {tool_name}');

    // 2. Get Figma bridge and send command
    const bridge = getFigmaBridge();
    const response = await bridge.sendCommand('{tool_name}', validated);

    // 3. Handle response
    if (!response.success) {
      throw new FigmaAPIError(response.error || 'Unknown Figma error', '{tool_name}', input);
    }

    // 4. Track success
    successCounter.inc({ tool: '{tool_name}' });
    durationHistogram.observe(Date.now() - startTime);

    return {
      success: true,
      // Return result data...
    };
  } catch (error) {
    // 5. Handle errors
    const wrappedError = wrapError(error, '{tool_name}', input);
    errorCounter.inc({ tool: '{tool_name}', error_type: wrappedError.name });
    trackError(wrappedError);
    throw wrappedError;
  }
}
```

### Step 2: Add handler to Figma plugin

Add case in `figma-plugin/code.ts` switch statement:

```typescript
case '{tool_name}': {
  // Implement Figma API operations
  const node = getNode(payload.nodeId);
  if (!node) {
    throw new Error(`Node not found: ${payload.nodeId}`);
  }

  // Perform operations on node...

  result = {
    success: true,
    // Return data...
  };
  break;
}
```

### Step 3: Register tool in index.ts

In `mcp-server/src/index.ts`:

1. Add import at top:

```typescript
import {
  {toolName},
  {toolName}ToolDefinition,
  type {ToolName}Input
} from './tools/{tool_name}.js';
```

2. Add to `ListToolsRequestSchema` handler array:

```typescript
{toolName}ToolDefinition,
```

3. Add to `CallToolRequestSchema` switch:

```typescript
case '{tool_name}': {
  const result = await {toolName}(request.params.arguments as {ToolName}Input);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
}
```

---

## How to Add a Design Constraint

Create `mcp-server/src/constraints/{constraint}.ts`:

```typescript
/**
 * {Constraint Name} Constraint
 *
 * {Description of what this constraint validates}
 */

import { z } from 'zod';

/**
 * Valid values for {constraint}
 */
export const VALID_{CONSTRAINT}_VALUES = [/* values */] as const;

/**
 * Zod schema for validation
 */
export const {constraint}Schema = z.enum(VALID_{CONSTRAINT}_VALUES);

export type {Constraint}Value = z.infer<typeof {constraint}Schema>;

/**
 * Validation result interface
 */
export interface {Constraint}ValidationResult {
  isValid: boolean;
  value: {Constraint}Value;
  snapped?: {Constraint}Value;
  message?: string;
}

/**
 * Validate {constraint} value
 */
export function validate{Constraint}(value: unknown): {Constraint}ValidationResult {
  // Validation logic...
}
```

Then export from `mcp-server/src/constraints/index.ts`:

```typescript
export {} from /* exports */ './{constraint}.js';
```

---

## How to Add a Custom Error Type

Add to `mcp-server/src/errors/index.ts`:

```typescript
/**
 * {ErrorName} - thrown when {condition}
 */
export class {ErrorName} extends ToolExecutionError {
  constructor(
    message: string,
    tool: string,
    input?: unknown,
    public readonly {additionalField}?: {Type}
  ) {
    super(message, tool, input);
    this.name = '{ErrorName}';
  }
}
```

---

## File Naming Conventions

| Type        | Pattern                 | Example                   |
| ----------- | ----------------------- | ------------------------- |
| MCP Tool    | `snake_case.ts`         | `create_frame.ts`         |
| Constraint  | `snake_case.ts`         | `spacing.ts`              |
| Utility     | `kebab-case.ts`         | `parent-validator.ts`     |
| Test        | `{module}.test.{js,ts}` | `color-converter.test.js` |
| Error class | `PascalCase`            | `ValidationError`         |
| Zod schema  | `camelCaseSchema`       | `createFrameInputSchema`  |

---

## Key Patterns to Follow

### 1. Zod Validation Pattern

Always validate inputs with Zod schemas:

```typescript
export const inputSchema = z.object({
  name: z.string().min(1).describe('Human-readable description'),
  size: z.number().positive().optional().describe('Size in pixels')
});
```

### 2. Error Handling Pattern

Always use custom error hierarchy:

```typescript
try {
  // operation
} catch (error) {
  const wrappedError = wrapError(error, 'tool_name', input);
  trackError(wrappedError);
  throw wrappedError;
}
```

### 3. Figma Bridge Pattern

Always use singleton bridge:

```typescript
const bridge = getFigmaBridge();
const response = await bridge.sendCommand('command_type', payload);
if (!response.success) {
  throw new FigmaAPIError(response.error, 'tool_name', input);
}
```

### 4. Metrics Pattern

Always track invocations, success, errors, duration:

```typescript
invocationCounter.inc({ tool: 'tool_name' });
successCounter.inc({ tool: 'tool_name' });
errorCounter.inc({ tool: 'tool_name', error_type: 'ValidationError' });
durationHistogram.observe(durationMs);
```

### 5. Parent Validation Pattern

For child nodes, always validate parent exists:

```typescript
import { validateParentRelationship, formatValidationError } from '../utils/parent-validator.js';

const validation = validateParentRelationship('text', input.parentId);
if (!validation.isValid) {
  throw new ValidationError(formatValidationError(validation), 'create_text', input);
}
```

---

## Design Constraints (8pt Grid System)

### Valid Spacing Values

```
0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128
```

### Valid Font Sizes (Modular Scale)

```
12, 16, 20, 24, 32, 40, 48, 64
```

### WCAG Contrast Thresholds

- AA Normal Text: 4.5:1 minimum
- AA Large Text: 3.0:1 minimum
- AAA Normal Text: 7.0:1 minimum

---

## Common Mistakes

❌ **Don't**: Create tools without Zod input validation
✅ **Do**: Always define `{tool}InputSchema` with Zod

❌ **Don't**: Throw raw Error objects
✅ **Do**: Use `ValidationError`, `FigmaAPIError`, or `wrapError()`

❌ **Don't**: Access Figma bridge directly with `new WebSocket()`
✅ **Do**: Use `getFigmaBridge()` singleton

❌ **Don't**: Skip metrics tracking
✅ **Do**: Always track invocations, success, errors, duration

❌ **Don't**: Create child nodes (text, ellipse) without parentId
✅ **Do**: Validate parent relationship for non-container nodes

❌ **Don't**: Put plugin message handlers outside the switch statement
✅ **Do**: Add cases to the main `figma.ui.onmessage` switch

❌ **Don't**: Forget to register tools in `index.ts`
✅ **Do**: Add import, tool definition, and call handler

❌ **Don't**: Use `.ts` extension in TypeScript imports
✅ **Do**: Use `.js` extension (ESM requires it for compiled output)

❌ **Don't**: Create utility files in tool directories
✅ **Do**: Put utilities in `mcp-server/src/utils/`

❌ **Don't**: Skip the `.describe()` on Zod schema fields
✅ **Do**: Always add descriptions for LLM tool documentation

❌ **Don't**: Create high-level component tools like `create_button()`
✅ **Do**: Compose from primitives: `create_frame()` + `set_fills()` + `create_text()`
