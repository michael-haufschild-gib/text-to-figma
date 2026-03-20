## Project Purpose

Text-to-Figma is a **three-tier MCP server** that gives LLM agents 45+ tools to create and manipulate Figma designs.

## Architecture

```
┌──────────────┐     WebSocket     ┌─────────────────┐     stdio      ┌──────────────┐
│ Figma Plugin │ ◄──────────────── │ WebSocket Bridge │ ◄──────────── │  MCP Server  │
│ (TypeScript) │     port 8080     │   (JavaScript)   │    JSON-RPC   │ (TypeScript)  │
└──────────────┘                   └─────────────────┘               └──────────────┘
```

### 1. FIGMA PLUGIN (`figma-plugin/`)

- Executes Figma API operations inside the Figma desktop app
- Handlers organized by domain: `creation`, `styling`, `query`, `layout`, `text`, `transform`, `components`, `styles`, `utility`, `design`
- Built with esbuild, target ES2017

### 2. WEBSOCKET SERVER (`websocket-server/`)

- Routes messages between MCP server and Figma plugin
- Single-file JS server (`server.js`), port 8080
- Enforces single Figma plugin instance, heartbeat-based dead connection detection

### 3. MCP SERVER (`mcp-server/`)

- Exposes tools via Model Context Protocol (stdio transport)
- Routing: `routing/register-tools.ts` → `routing/tool-router.ts` → individual tool files
- Handler groups in `routing/handlers-*.ts` define which tools exist
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
- **Errors**: Structured codes in `errors/error-codes.ts`. Legacy classes in `errors/index.ts`.
- **MCP requirement**: All logs go to stderr (`console.error`). stdout is reserved for JSON-RPC.
- **Config**: Environment variables validated by Zod schema in `config.ts`. See `.env.example`.
