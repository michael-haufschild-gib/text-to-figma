## Project Purpose

Text-to-Figma is a **three-tier MCP server** that gives LLM agents 68 tools to create and manipulate Figma designs.

## Architecture

```
┌──────────────┐     WebSocket     ┌─────────────────┐     stdio      ┌──────────────┐
│ Figma Plugin │ ◄──────────────── │ WebSocket Bridge │ ◄──────────── │  MCP Server  │
│ (TypeScript) │     port 8080     │   (TypeScript)   │    JSON-RPC   │ (TypeScript)  │
└──────────────┘                   └─────────────────┘               └──────────────┘
```

### 1. FIGMA PLUGIN (`figma-plugin/`)

- Executes Figma API operations inside the Figma desktop app
- Handlers organized by domain: `creation`, `styling`, `query`, `layout`, `spatial`, `text`, `transform`, `components`, `styles`, `utility`, `design`
- Built with esbuild, target ES2017

### 2. WEBSOCKET SERVER (`websocket-server/`)

- Routes messages between MCP server and Figma plugin
- Single-file TypeScript server (`src/server.ts` → `dist/server.js`), port 8080
- Enforces single Figma plugin instance, heartbeat-based dead connection detection

### 3. MCP SERVER (`mcp-server/`)

- Exposes tools via Model Context Protocol (stdio transport)
- Registration: `routing/register-tools.ts` → `routing/tool-registry.ts` (stores handlers)
- Execution: `routing/tool-router.ts` → `routing/tool-registry.ts` → `handler.execute()`
- Handler contract: `routing/tool-handler.ts` defines `ToolHandler<TInput, TResult>` interface
- Handler groups in `routing/handlers-*.ts` wire tools via `defineHandler()` from `handler-utils.ts`
- Each tool in `tools/*.ts` exports: schema, execute function, tool definition
- Design constraints: 8pt spacing grid, modular type scale, WCAG contrast
- Node registry tracks created hierarchy across tool calls

## Development

```sh
npm install          # Install all workspaces
npm run build        # Build mcp-server (tsc) + figma-plugin (esbuild)
npm test             # Run all tests (vitest)
npm run lint         # ESLint (flat config, v10)
npm run format       # Prettier check
npm run type-check   # TypeScript strict mode, both workspaces
```

## Key Conventions

- **Schema naming**: PascalCase — `CreateFrameInputSchema`, `SetFillsInputSchema`
- **Logger**: Single logger at `monitoring/logger.ts`. Use `getLogger().child({ tool: 'name' })`.
- **Metrics**: Centralized in `routing/tool-router.ts` — individual tools do not track metrics.
- **Errors**: Unified error system in `errors/index.ts`. All error classes carry an `ErrorCode` for machine-readable classification. `FigmaBridgeError` wraps `StructuredError` for bridge failures. Error codes defined in `errors/error-codes.ts`.
- **MCP requirement**: All logs go to stderr (`console.error`). stdout is reserved for JSON-RPC.
- **Config**: Environment variables validated by Zod schema in `config.ts`. See `.env.example`.
- **ESLint**: ESM config in `eslint.config.mjs`. Custom rules in `eslint-rules/` (CJS, loaded via `createRequire`).

## Architecture Decisions

**Singleton services** — FigmaBridge, NodeRegistry, ToolRegistry, Logger, MetricsRegistry use module-level singletons with get/reset functions. Chosen because the MCP server runs as a single stdio process — there is no multi-instance need. Reset functions exist for test isolation.

**Circuit breaker in FigmaBridge** — Prevents cascading failures when Figma plugin is unresponsive. HALF_OPEN state allows only one probe request to avoid thundering herd on recovery. Parameters: 5 failure threshold, 30s reset timeout.

**8pt spacing grid enforcement** — Design system constraint validated at the Zod schema level (`spacingSchema`). Values snapped to grid automatically by `auto-validator.ts` for `create_design` tool. This prevents LLM agents from generating non-standard spacing values.

**WebSocket bridge as separate process** — The bridge runs independently so the MCP server (stdio) doesn't need to host a WebSocket server. The `websocket-spawner.ts` auto-starts it if not running. Single Figma plugin instance enforced by the bridge.

**Request→client tracking** — The WebSocket bridge tracks which MCP client sent each request (by request ID) to route responses to the correct originator, preventing cross-talk between multiple MCP sessions.
