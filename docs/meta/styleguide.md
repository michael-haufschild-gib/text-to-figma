# Backend Engineering Style Guide

## Text-to-Figma MCP Server

**Last Updated:** October 18, 2025  
**Technology Stack:** Node.js, TypeScript, MCP Protocol, WebSocket, Zod

---

## Overview

This style guide governs the Text-to-Figma MCP Server codebase—a Node.js/TypeScript backend that provides 68 Figma design tools through the Model Context Protocol. This is **NOT** a frontend/React project. For Figma Plugin (frontend) guidelines, see `docs/architecture-figma-plugin.md`.

---

## Core Engineering Principles

### P1: Intentional Architecture

- **Single Responsibility**: Each module has one clear purpose expressed through exports
- **Domain Logic**: Business rules live in pure functions (services, constraints)
- **Tool Modules**: Each tool is self-contained with schema, execute function, and definition
- **Example**: `tools/create_frame.ts` owns frame creation logic, validation, and Figma API calls

### P2: Deterministic Operations

- **Input Validation**: Use Zod schemas for all tool inputs with explicit error messages
- **Pure Functions**: Constraint validators (spacing, typography, contrast) are pure and testable
- **Predictable Errors**: Custom error hierarchy (ValidationError, FigmaAPIError, NetworkError)
- **Example**: `validateSpacing(16)` always returns same result for same input

### P3: Performance Awareness

- **Async Patterns**: All I/O operations use async/await with proper error handling
- **Circuit Breaker**: Prevent cascading failures with configurable circuit breaker
- **Connection Pooling**: WebSocket connection reused across requests
- **Retry Logic**: Exponential backoff for transient failures

### P4: Resilience & Recovery

- **Error Boundaries**: Errors wrapped in typed error classes with context
- **Graceful Degradation**: Circuit breaker opens on repeated failures
- **Auto-reconnect**: WebSocket bridge reconnects with exponential backoff
- **Cleanup**: Proper resource cleanup on shutdown (close connections, clear timers)

### P5: Observability & Telemetry

- **Structured Logging**: Winston/Pino-style logger with severity levels
- **Metrics**: Counters, histograms for tool invocations, errors, duration
- **Error Tracking**: Aggregated error fingerprints with deduplication
- **Health Checks**: HTTP endpoint for readiness/liveness probes

---

## Architectural Conventions

### A1: Folder Structure

```
mcp-server/src/
├── index.ts              # MCP server entry point
├── config.ts             # Environment configuration with Zod validation
├── figma-bridge.ts       # WebSocket client to Figma plugin
├── health.ts             # Health check HTTP server
│
├── tools/                # 58+ MCP tool modules
│   ├── create_frame.ts
│   ├── set_fills.ts
│   └── ...               # Each tool: schema + execute + definition
│
├── constraints/          # Design system validation
│   ├── color.ts          # Hex/RGB conversion, WCAG contrast
│   ├── spacing.ts        # 8pt grid validation
│   └── typography.ts     # Modular scale validation
│
├── errors/               # Custom error hierarchy
│   └── index.ts          # ValidationError, FigmaAPIError, NetworkError
│
├── monitoring/           # Observability infrastructure
│   ├── logger.ts         # Structured logging
│   ├── metrics.ts        # Prometheus-style metrics
│   └── error-tracker.ts  # Error aggregation and deduplication
│
└── prompts/              # LLM system prompts
    ├── zero-shot.ts      # Primitive-first workflow
    └── few-shot.ts       # Example-driven workflows
```

**Key Principles:**

- **Colocated Concerns**: Related files grouped by domain (tools/, constraints/, monitoring/)
- **Flat Structure**: Avoid deep nesting (max 2 levels in src/)
- **Explicit Exports**: Each module exports specific interfaces/types
- **No Circular Dependencies**: Use dependency injection to break cycles

### A2: Module Patterns

#### Tool Module Template

Every tool in `tools/` follows this structure:

```typescript
/**
 * Tool: set_fills
 * Sets fill colors on Figma nodes (frames or text).
 */

import { z } from 'zod';
import { getFigmaBridge } from '../figma-bridge.js';

// 1. Input Schema (Zod)
export const setFillsInputSchema = z.object({
  nodeId: z.string().min(1).describe('ID of the node'),
  color: z
    .string()
    .regex(/^#?[0-9A-Fa-f]{6}$/)
    .describe('Hex color'),
  opacity: z.number().min(0).max(1).default(1).describe('Opacity 0-1')
});

export type SetFillsInput = z.infer<typeof setFillsInputSchema>;

// 2. Result Interface
export interface SetFillsResult {
  nodeId: string;
  appliedColor: string;
  cssEquivalent: string;
}

// 3. Execute Function
export async function setFills(input: SetFillsInput): Promise<SetFillsResult> {
  const validated = setFillsInputSchema.parse(input);
  const bridge = getFigmaBridge();

  await bridge.sendToFigma('set_fills', {
    nodeId: validated.nodeId,
    fills: [{ type: 'SOLID', color: hexToRgb(validated.color), opacity: validated.opacity }]
  });

  return {
    nodeId: validated.nodeId,
    appliedColor: validated.color,
    cssEquivalent: `background-color: ${validated.color}; opacity: ${validated.opacity};`
  };
}

// 4. MCP Tool Definition
export const setFillsToolDefinition = {
  name: 'set_fills',
  description: 'Sets fill colors on frames or text nodes...',
  inputSchema: {
    type: 'object' as const,
    properties: {
      /* JSON Schema */
    },
    required: ['nodeId', 'color']
  }
};
```

**Benefits:**

- Schema-driven validation catches errors early
- Execute function is unit-testable
- MCP definition separate from implementation logic

#### Service Module Template

Pure business logic with no I/O dependencies:

```typescript
/**
 * Spacing Constraint Validator
 * Validates values against 8pt grid system.
 */

export const VALID_SPACING_VALUES = [0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128];

export interface SpacingConstraintResult {
  value: number;
  isValid: boolean;
  suggestedValue?: number;
  message?: string;
}

export function validateSpacing(value: number): SpacingConstraintResult {
  if (VALID_SPACING_VALUES.includes(value)) {
    return { value, isValid: true };
  }

  const closest = findClosestValue(value, VALID_SPACING_VALUES);
  return {
    value,
    isValid: false,
    suggestedValue: closest,
    message: `${value}px not on 8pt grid. Use ${closest}px instead.`
  };
}
```

**Benefits:**

- Pure functions are deterministic and easily tested
- No external dependencies (database, network, filesystem)
- Can be imported and reused across tools

### A3: Configuration Management

Centralized configuration with environment variable validation:

```typescript
// config.ts
import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  FIGMA_WS_URL: z.string().url().default('ws://localhost:8080'),
  FIGMA_REQUEST_TIMEOUT: z.coerce.number().int().positive().default(30000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().int().positive().default(5)
});

export type Config = z.infer<typeof configSchema>;

let loadedConfig: Config | null = null;

export function loadConfig(): Config {
  if (loadedConfig) return loadedConfig;
  loadedConfig = configSchema.parse(process.env);
  return loadedConfig;
}

export function getConfig(): Config {
  if (!loadedConfig) throw new Error('Config not loaded');
  return loadedConfig;
}
```

**Benefits:**

- Fail fast on missing/invalid environment variables
- Type-safe access to configuration
- Testable with `resetConfig()` helper

---

## Async Patterns & Error Handling

### Async/Await Best Practices

```typescript
// ✅ GOOD: Explicit error handling with typed errors
export async function createFrame(input: CreateFrameInput): Promise<CreateFrameResult> {
  try {
    const validated = createFrameInputSchema.parse(input);
    const bridge = getFigmaBridge();

    const response = await bridge.sendToFigma('create_frame', validated);

    return {
      frameId: response.nodeId,
      htmlAnalogy: '...',
      cssEquivalent: '...'
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Input validation failed', 'create_frame', input, error.errors);
    }
    if (error instanceof Error && error.message.includes('Connection')) {
      throw new NetworkError('Figma bridge unavailable', 'create_frame', 'figma-bridge', input);
    }
    throw new ToolExecutionError(error.message, 'create_frame', input, error);
  }
}

// ❌ BAD: Silent failures, generic errors
export async function createFrame(input: any): Promise<any> {
  try {
    const response = await bridge.sendToFigma('create_frame', input);
    return response;
  } catch (error) {
    console.error('Error:', error);
    return null; // Silent failure!
  }
}
```

### Error Hierarchy

```typescript
// Custom error classes with structured context
export class ToolExecutionError extends Error {
  constructor(
    message: string,
    public readonly tool: string,
    public readonly input?: unknown,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}

export class ValidationError extends ToolExecutionError {
  constructor(
    message: string,
    tool: string,
    input?: unknown,
    public readonly validationErrors?: unknown
  ) {
    super(message, tool, input);
  }
}

export class FigmaAPIError extends ToolExecutionError {
  constructor(
    message: string,
    tool: string,
    public readonly operation: string,
    input?: unknown,
    cause?: Error
  ) {
    super(message, tool, input, cause);
  }
}

export class NetworkError extends ToolExecutionError {
  constructor(
    message: string,
    tool: string,
    public readonly endpoint?: string,
    input?: unknown,
    cause?: Error
  ) {
    super(message, tool, input, cause);
  }
}
```

**Usage Pattern:**

```typescript
try {
  await tool.execute(input);
} catch (error) {
  if (isValidationError(error)) {
    logger.warn('Invalid input', { tool: error.tool, errors: error.validationErrors });
    return { status: 'error', message: 'Invalid input parameters' };
  }
  if (isNetworkError(error)) {
    logger.error('Network failure', error);
    return { status: 'error', message: 'Figma connection lost' };
  }
  throw error; // Unknown error, propagate
}
```

---

## Testing Expectations

### T1: Unit Tests (Deterministic)

Test pure functions with explicit inputs:

```typescript
// typography.test.ts
import { validateTypography } from '../mcp-server/src/constraints/typography';

describe('Typography Validation', () => {
  test('accepts valid modular scale values', () => {
    expect(validateTypography(16)).toEqual({ fontSize: 16, isValid: true });
    expect(validateTypography(24)).toEqual({ fontSize: 24, isValid: true });
  });

  test('rejects off-scale values with suggestions', () => {
    const result = validateTypography(18);
    expect(result.isValid).toBe(false);
    expect(result.suggestedFontSize).toBe(20);
    expect(result.message).toContain('Use 16px or 20px');
  });

  test('calculates recommended line height', () => {
    const result = validateTypography(16);
    expect(result.recommendedLineHeight).toBe(24); // 1.5x ratio
  });
});
```

### T2: Integration Tests

Test tool modules end-to-end with mocked Figma bridge:

```typescript
// create-frame.integration.test.ts
import { createFrame } from '../mcp-server/src/tools/create_frame';
import { getFigmaBridge } from '../mcp-server/src/figma-bridge';

jest.mock('../mcp-server/src/figma-bridge');

describe('create_frame integration', () => {
  beforeEach(() => {
    const mockBridge = {
      sendToFigma: jest.fn().mockResolvedValue({ nodeId: 'frame-123' })
    };
    (getFigmaBridge as jest.Mock).mockReturnValue(mockBridge);
  });

  test('creates frame with valid input', async () => {
    const result = await createFrame({
      name: 'Button',
      layoutMode: 'HORIZONTAL',
      itemSpacing: 16,
      padding: 24
    });

    expect(result.frameId).toBe('frame-123');
    expect(result.cssEquivalent).toContain('flex-direction: row');
    expect(result.cssEquivalent).toContain('gap: 16px');
  });

  test('throws ValidationError for invalid spacing', async () => {
    await expect(
      createFrame({
        name: 'Button',
        itemSpacing: 13 // Not on 8pt grid
      })
    ).rejects.toThrow(ValidationError);
  });
});
```

### T3: Test Organization

```
tests/
├── unit/                 # Pure function tests
│   ├── color-converter.test.ts
│   └── typography-generator.test.ts
├── integration/          # Tool end-to-end tests
│   ├── component-tools.test.ts
│   └── foundation.test.ts
└── e2e/                  # Full workflow tests
    └── button-component.test.ts
```

### T4: Test Scripts

```json
{
  "scripts": {
    "test": "npm run test:all",
    "test:unit": "cd ../tests && node --test unit/**/*.test.ts",
    "test:integration": "cd ../tests && node --test integration/**/*.test.ts",
    "test:all": "npm run build && npm run test:unit && npm run test:integration",
    "test:coverage": "c8 npm run test:all",
    "test:watch": "node --test --watch unit/**/*.test.ts"
  }
}
```

---

## Documentation Standards

### JSDoc Requirements

All exported functions, classes, and types must have comprehensive JSDoc:

````typescript
/**
 * Validates WCAG contrast ratio between foreground and background colors.
 *
 * Calculates relative luminance using sRGB color space and applies
 * WCAG 2.1 contrast formula. Returns detailed pass/fail for AA/AAA levels.
 *
 * @param foreground - Foreground RGB color {r: 0-255, g: 0-255, b: 0-255}
 * @param background - Background RGB color {r: 0-255, g: 0-255, b: 0-255}
 * @returns Contrast validation result with ratio and WCAG compliance
 *
 * @example
 * ```typescript
 * const result = validateContrast(
 *   { r: 0, g: 0, b: 0 },    // Black text
 *   { r: 255, g: 255, b: 255 } // White background
 * );
 * console.log(result.ratio);          // 21
 * console.log(result.passes.AA.normal); // true
 * ```
 *
 * @remarks
 * - AA normal text requires 4.5:1 minimum
 * - AA large text requires 3.0:1 minimum
 * - AAA normal text requires 7.0:1 minimum
 * - Large text is 18pt+ or 14pt+ bold
 *
 * @see {@link https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html WCAG 2.1 SC 1.4.3}
 */
export function validateContrast(foreground: RGB, background: RGB): ContrastValidationResult {
  // Implementation...
}
````

**Required JSDoc Tags:**

- `@param` for every parameter with description
- `@returns` describing return value structure
- `@throws` listing error types that may be thrown
- `@example` with realistic code snippet
- `@remarks` for important notes, caveats, performance characteristics
- `@see` for related functions or external documentation

### ESLint JSDoc Enforcement

```json
// .eslintrc.json
{
  "plugins": ["jsdoc"],
  "rules": {
    "jsdoc/require-jsdoc": ["warn", { "publicOnly": true }],
    "jsdoc/require-param": "warn",
    "jsdoc/require-param-description": "warn",
    "jsdoc/require-returns": "warn",
    "jsdoc/require-returns-description": "warn",
    "jsdoc/check-param-names": "warn"
  }
}
```

---

## Observability & Monitoring

### Structured Logging

```typescript
import { getLogger } from './monitoring/logger';

const logger = getLogger().child({ tool: 'create_frame' });

// Log with structured context
logger.info('Frame created', {
  frameId: 'frame-123',
  layoutMode: 'HORIZONTAL',
  duration: 45
});

// Log errors with full context
logger.error('Validation failed', new ValidationError(...), {
  input: { name: 'Button', itemSpacing: 13 }
});
```

### Metrics Tracking

```typescript
import { getMetrics } from './monitoring/metrics';

const metrics = getMetrics();

// Counter: Track event occurrences
const toolCounter = metrics.counter('tool_invocations_total', 'Tool calls', ['tool']);
toolCounter.inc(1, { tool: 'create_frame' });

// Histogram: Track value distributions
const durationHist = metrics.histogram('tool_duration_ms', 'Duration', [10, 50, 100, 500, 1000]);
durationHist.observe(duration);
```

### Error Tracking

```typescript
import { trackError } from './monitoring/error-tracker';

try {
  await tool.execute(input);
} catch (error) {
  const errorId = trackError(
    error,
    { tool: 'create_frame', input },
    'high', // severity
    'figma_api' // category
  );
  logger.error('Tool execution failed', error, { errorId });
}
```

---

## Code Review Checklist

### Q1: Architecture & Domain Boundaries

- [ ] Tool module follows standard structure (schema → execute → definition)
- [ ] Business logic in pure functions, I/O in tool layer
- [ ] No circular dependencies between modules

### Q2: Type Safety & Validation

- [ ] Zod schema defined for all inputs
- [ ] TypeScript strict mode enabled, no `any` types
- [ ] Custom error classes used for domain errors

### Q3: Async Patterns & Error Handling

- [ ] Async/await used consistently
- [ ] Errors wrapped in typed error classes
- [ ] Circuit breaker applied for external calls

### Q4: Observability

- [ ] Structured logging at key transitions
- [ ] Metrics tracked for tool invocations and errors
- [ ] Error tracking for aggregation/alerting

### Q5: Testing

- [ ] Unit tests for pure functions
- [ ] Integration tests for tool end-to-end
- [ ] Test coverage >80% for new code

### Q6: Documentation

- [ ] JSDoc with @param, @returns, @example
- [ ] README updated if architecture changed
- [ ] ADR created for major decisions

---

## Common Anti-Patterns

### M1: Unvalidated Inputs

❌ **Bad**: Accepting `any` without validation

```typescript
export async function createFrame(input: any) {
  const bridge = getFigmaBridge();
  return await bridge.sendToFigma('create_frame', input);
}
```

✅ **Good**: Zod schema validation

```typescript
export async function createFrame(input: CreateFrameInput) {
  const validated = createFrameInputSchema.parse(input);
  const bridge = getFigmaBridge();
  return await bridge.sendToFigma('create_frame', validated);
}
```

### M2: Silent Failures

❌ **Bad**: Swallowing errors

```typescript
try {
  await riskyOperation();
} catch (error) {
  console.log('Oops');
  return null;
}
```

✅ **Good**: Explicit error handling

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', error, { context });
  throw new ToolExecutionError('Failed to complete operation', 'tool_name', input, error);
}
```

### M3: Mixing I/O and Logic

❌ **Bad**: Business logic coupled to I/O

```typescript
export async function validateAndCreate(input: any) {
  const isValid = input.spacing % 8 === 0; // Logic
  if (!isValid) return { error: 'Invalid spacing' };

  const bridge = getFigmaBridge(); // I/O
  return await bridge.sendToFigma('create_frame', input);
}
```

✅ **Good**: Separate concerns

```typescript
// Pure validation logic
export function validateSpacing(value: number): SpacingResult {
  return { isValid: value % 8 === 0, value };
}

// I/O in tool layer
export async function createFrame(input: CreateFrameInput) {
  const spacingCheck = validateSpacing(input.itemSpacing);
  if (!spacingCheck.isValid) {
    throw new ValidationError('Invalid spacing');
  }

  const bridge = getFigmaBridge();
  return await bridge.sendToFigma('create_frame', input);
}
```

### M4: Missing Context in Errors

❌ **Bad**: Generic error messages

```typescript
throw new Error('Failed');
```

✅ **Good**: Structured error context

```typescript
throw new FigmaAPIError(
  'Failed to create frame in Figma',
  'create_frame', // tool name
  'create_frame', // operation
  { name: 'Button', layoutMode: 'HORIZONTAL' }, // input
  originalError // cause
);
```

---

## Continuous Improvement

### I1: Remove Legacy Code

- Audit unused exports quarterly
- Remove deprecated function signatures after migration period
- Document breaking changes in CHANGELOG.md

### I2: Tooling Evaluation

- Review custom infrastructure vs off-the-shelf annually
- Benchmark circuit breaker, retry logic, error tracking
- Consider migration to established libraries if maintenance burden high

### I3: Developer Experience

- Add CLI tools for common operations (test data generation, tool scaffolding)
- Improve error messages with actionable suggestions
- Document troubleshooting steps in runbooks

---

## Migration from Previous Style Guide

**Previous Guide Context:**  
The original style guide was written for a React/frontend project and is not applicable to this Node.js backend codebase. It has been archived to `docs/meta/styleguide-react-archived.md`.

**What Changed:**

- Removed React-specific patterns (hooks, components, JSX, styling)
- Added backend patterns (async/await, error handling, WebSocket)
- Focused on MCP server architecture (tools, constraints, monitoring)
- Updated code examples to TypeScript backend patterns

**If You're New:**  
This codebase is a **backend MCP server**, not a frontend application. Read `docs/architecture.md` for system overview before diving into code.

---

## Additional Resources

- **Architecture Overview**: `docs/architecture.md`
- **MCP Protocol**: `docs/architecture-mcp-server.md`
- **WebSocket Bridge**: `docs/architecture-websocket-server.md`
- **Figma Plugin**: `docs/architecture-figma-plugin.md`
- **Testing Guide**: `tests/README.md`
- **Deployment**: `docs/operations/deployment-runbook.md`
