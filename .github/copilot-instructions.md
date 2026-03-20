=== CRITICAL INSTRUCTION BLOCK (CIB-001)===

## MANDATORY TOOLS

### For Complex Tasks (research, analysis, debugging)

```
USE: mcp__mcp_docker__sequentialthinking
WHEN: Multi-step problems, research, complex reasoning
WHY: Prevents cognitive overload, ensures systematic approach
```

### For Task Management

```
USE: TodoWrite
WHEN: Any task with 3+ steps
WHY: Tracks progress, maintains focus
```

=== END CRITICAL INSTRUCTION BLOCK (CIB-001)===

## Project Purpose

Text-to-Figma is a **three-tier architecture** that provides MCP tools to LLM agents to read from and write to Figma files.

It consists of 3 components:

### 1. FIGMA PLUGIN (`figma-plugin/`)

**Purpose**: Executes Figma API operations
**Language**: TypeScript (5.3.0)

### 2. WEBSOCKET SERVER (`websocket-server/`)

**Purpose**: Bridges MCP server and Figma plugin via WebSocket
**Language**: JavaScript (ES2022 modules)
**Port**: 8080 (default)

### 3. MCP SERVER (`mcp-server/`)

**Purpose**: Exposes Figma design tools via the Model Context Protocol
**Language**: TypeScript (5.9.3)

## Workspace Layout

```
text-to-figma/
├── mcp-server/              # Model Context Protocol server (TypeScript)
├── websocket-server/        # WebSocket bridge (JavaScript)
├── figma-plugin/            # Figma plugin code (TypeScript)
├── tests/                   # Comprehensive test suite
├── docs/                    # Architecture & implementation docs
├── package.json             # Monorepo root with workspaces
├── build-all.sh             # Automated build script
├── docker-compose.yml       # Container orchestration
└── mcp-config.json          # MCP s
```
