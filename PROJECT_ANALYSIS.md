# Text-to-Figma Project - Comprehensive Architecture Analysis

**Analysis Date**: October 19, 2025  
**Status**: Production-Ready (with noted issues)  
**Project Type**: Monorepo with 3 integrated services + test suite

---

## 1. PROJECT STRUCTURE OVERVIEW

### Workspace Layout
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
└── mcp-config.json          # MCP server configuration
```

### Package Structure
- **Type**: NPM workspaces monorepo
- **Node Version**: 20 (Alpine in Docker)
- **Module System**: ES2022 modules with ES2020 targets
- **Build**: TypeScript compilation to dist/
- **Total Files**: 88 TypeScript files in mcp-server alone (736KB)

---

## 2. COMPONENT BREAKDOWN

### 2.1 MCP SERVER (`mcp-server/`)
**Purpose**: Exposes Figma design tools via the Model Context Protocol  
**Language**: TypeScript (5.9.3)  
**Build**: `tsc` → `dist/`  

#### Architecture
- **Entry Point**: `src/index.ts` (1,832 lines)
- **Core Dependencies**:
  - `@modelcontextprotocol/sdk@0.5.0` - MCP protocol
  - `ws@8.18.0` - WebSocket client
  - `zod@3.25.76` - Runtime validation

#### Key Modules

1. **Tool System** (~60 tools in `src/tools/`)
   - Shape primitives: `create_frame`, `create_ellipse`, `create_line`, `create_polygon`, `create_star`
   - Text primitives: `create_text`, `set_text_case`, `set_letter_spacing`
   - Fill primitives: `set_fills`, `add_gradient_fill`, `set_image_fill`
   - Transform primitives: `set_rotation`, `set_absolute_position`, `set_size`, `set_scale`
   - Component system: `create_component`, `create_instance`, `set_component_properties`
   - Validation: `validate_design_tokens`, `check_wcag_contrast`, `validate_spacing`, `validate_typography`
   - Layout: `set_layout_properties`, `set_layout_sizing`, `add_layout_grid`

2. **Constraint System** (`src/constraints/`)
   - **color.ts**: RGB conversion, WCAG contrast validation
   - **spacing.ts**: 8pt grid validation
   - **typography.ts**: Modular type scale

3. **Figma Bridge** (`src/figma-bridge.ts`)
   - WebSocket client to `ws://localhost:8080`
   - Circuit breaker pattern, retry logic
   - Promise-based request/response model

4. **Configuration** (`src/config.ts`)
   - Environment-based using Zod
   - Key variables: NODE_ENV, FIGMA_WS_URL, LOG_LEVEL, ports

5. **Monitoring** (`src/monitoring/`)
   - Logging, metrics (Prometheus-style), error tracking, health checks

6. **Error Handling** (`src/errors/index.ts`)
   - Custom error hierarchy with context preservation

#### Build Status
✅ **Builds successfully**  
✅ **Type-checks pass**  
⚠️ **Linting warnings**: ~150+ JSDoc missing  
🔴 **Critical Error**: Line 225 in `figma-bridge.ts` - `@typescript-eslint/no-base-to-string`

---

### 2.2 WEBSOCKET SERVER (`websocket-server/`)
**Purpose**: Bridges MCP server and Figma plugin via WebSocket  
**Language**: JavaScript (ES2022 modules)  
**Port**: 8080 (default)  

#### Key Features
- Client management with timeout handling
- Message flow: request ID matching between MCP and Figma
- DoS protection: message size validation
- Graceful shutdown support

#### Issues
- ⚠️ No input validation on incoming messages
- ⚠️ No authentication/authorization
- ⚠️ Single-threaded event loop

---

### 2.3 FIGMA PLUGIN (`figma-plugin/`)
**Purpose**: Executes Figma API operations  
**Language**: TypeScript (5.3.0)  

#### Type System (Excellent Design)
```typescript
type FigmaCommand = CreateFrameCommand | CreateTextCommand

interface CreateFrameCommand {
  readonly type: 'create_frame'
  readonly payload: CreateFramePayload
}
```

Discriminated unions with type guards for type-safe command handling.

---

## 3. SYSTEM INTEGRATION & COMMUNICATION FLOW

### 3.1 Three-Tier Architecture
```
Claude Code CLI
       ↓ (MCP Protocol via stdio)
   MCP Server (Node.js)
       ↓ (WebSocket over TCP)
WebSocket Bridge (Node.js)
       ↓ (WebSocket over TCP)
   Figma Plugin
       ↓ (Figma Plugin API)
    Figma
```

### 3.2 Request/Response Flow
1. Claude sends MCP call via stdio
2. MCP server validates with Zod, calls getFigmaBridge()
3. WebSocket bridge forwards to Figma plugin with requestId
4. Figma plugin calls Figma API, returns response
5. WebSocket bridge matches requestId, resolves promise
6. MCP server formats response, sends to Claude

### 3.3 CRITICAL CONFIGURATION MISMATCH!

| Component | Config File | Default URL | Env Var |
|-----------|------------|-------------|---------|
| MCP Server | config.ts | `ws://localhost:8080` | `FIGMA_WS_URL` |
| **mcp-config.json** | **mcp-config.json** | **`ws://localhost:8765`** | `WEBSOCKET_URL` |
| WebSocket Server | server.js | `8080` | `PORT` |

**ISSUE**: `mcp-config.json` specifies port 8765 but server runs on 8080!
This causes connection failures if using mcp-config.json without env var override.

---

## 4. BUILD CONFIGURATION

### 4.1 TypeScript Configurations
- **MCP Server**: ES2022 target, Node16 modules, strict mode, source maps
- **Figma Plugin**: ES2020 target, ES2020 modules, strict mode
- **Tests**: Extends MCP config, adds Node types

### 4.2 Build Scripts
```json
{
  "workspaces": ["mcp-server", "websocket-server", "figma-plugin", "tests"],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "type-check": "npm run type-check --workspaces --if-present",
    "test": "cd tests && npm test"
  }
}
```

### 4.3 build-all.sh Script
Well-structured shell script with:
- Dependency installation across workspaces
- Build verification
- Type checking
- Clear success/failure messaging

---

## 5. DOCKER CONFIGURATION

### 5.1 MCP Server Dockerfile
- Based on `node:20-alpine`
- Builds TypeScript during image build
- Health check on port 8081
- Graceful shutdown support

### 5.2 WebSocket Server Dockerfile
- Based on `node:20-alpine`
- Production dependencies only
- Health check on port 8080

### 5.3 docker-compose.yml
- Service dependencies configured correctly
- Health checks for orchestration
- Environment variables mapped
- Bridge network for service communication

---

## 6. TESTING INFRASTRUCTURE

### 6.1 Test Suite Structure
```
tests/
├── unit/           # color-converter, tool-registry, tool-router
├── integration/    # routing-system, wcag-contrast, foundation
├── e2e/           # end-to-end tests
├── validation/    # design tokens
├── agents/        # agent tests
└── run-all-tests.sh
```

### 6.2 Test Configuration
- Node's built-in test runner (no Jest/Vitest dependency)
- Bash orchestration with exit codes
- TypeScript and JavaScript support

### 6.3 CRITICAL ISSUE
🔴 **Test script broken**: Line 66 attempts `cd mcp-server` from tests/ directory
- Should be: `cd ../mcp-server`
- Prevents ALL tests from running

---

## 7. IDENTIFIED ISSUES & FIXES NEEDED

### Critical Issues (Production Blocking)

1. **WebSocket URL Configuration Mismatch** 🔴 HIGH PRIORITY
   - **File**: `/Users/Spare/Documents/code/text-to-figma/mcp-config.json`
   - **Issue**: Specifies `ws://localhost:8765` but server runs on 8080
   - **Impact**: Connection failures if using mcp-config.json
   - **Fix**: Update port to 8080 or expose via env var

2. **TypeScript ESLint Error** 🔴 HIGH PRIORITY
   - **File**: `/Users/Spare/Documents/code/text-to-figma/mcp-server/src/figma-bridge.ts:225`
   - **Issue**: `@typescript-eslint/no-base-to-string` - `data.toString()` may stringify object
   - **Fix**: Add type guard before conversion

3. **Test Script Path Error** 🔴 HIGH PRIORITY
   - **File**: `/Users/Spare/Documents/code/text-to-figma/tests/run-all-tests.sh:66`
   - **Issue**: `cd mcp-server` executed from tests/ directory
   - **Fix**: Change to `cd ../mcp-server`

### Major Issues (Production Important)

4. **Incomplete JSDoc Documentation** ⚠️ MEDIUM PRIORITY
   - ~150+ @returns/@param warnings in linting
   - Affects code maintainability and IDE support

5. **No Input Validation in WebSocket Bridge** ⚠️ MEDIUM PRIORITY
   - Bridge accepts any JSON without schema validation
   - Could silently fail on malformed requests

6. **No Authentication on WebSocket Server** ⚠️ MEDIUM PRIORITY
   - Figma plugin can send arbitrary commands
   - Security risk if exposed to untrusted networks

---

## 8. PRODUCTION READINESS CHECKLIST

| Item | Status | Notes |
|------|--------|-------|
| Build system | ✅ Ready | Works via build-all.sh |
| Type checking | ✅ Ready | Passes across workspaces |
| TypeScript compilation | ⚠️ Warning | ESLint error needs fixing |
| Runtime error handling | ✅ Ready | Custom error hierarchy in place |
| Health checks | ✅ Ready | HTTP endpoints configured |
| Monitoring | ✅ Ready | Metrics, logging, error tracking |
| Configuration management | ✅ Ready | Environment-based with Zod |
| Docker images | ✅ Ready | Optimized, health checks included |
| Docker compose | ✅ Ready | Service dependencies working |
| Testing infrastructure | 🔴 Broken | Script path error prevents execution |
| Documentation | ✅ Adequate | BUILD_DOCUMENTATION.md, USER_GUIDE.md |
| Circuit breaker | ✅ Ready | Configured in Figma bridge |
| Retry logic | ✅ Ready | Exponential backoff implemented |
| Graceful shutdown | ✅ Ready | SIGINT/SIGTERM handlers in place |

---

## 9. ARCHITECTURE STRENGTHS

1. **Primitive-First Philosophy** - Exposes all Figma primitives vs. high-level abstractions
2. **Type Safety** - Discriminated unions, Zod validation, strict TypeScript
3. **Error Handling** - Custom error hierarchy with context preservation
4. **Monitoring** - Built-in metrics, logging, error tracking, health checks
5. **Modular Design** - 60+ independent tool files with consistent patterns
6. **Configuration** - Environment-based, strongly typed with Zod
7. **Fault Tolerance** - Circuit breaker, retry logic, timeout handling
8. **Documentation** - Extensive docs, few-shot examples, zero-shot prompts
9. **DevOps Ready** - Docker, docker-compose, health checks, graceful shutdown
10. **Test Infrastructure** - Comprehensive test suite organization

---

## 10. ARCHITECTURE WEAKNESSES

1. **WebSocket URL Configuration** - Inconsistency between code and config file
2. **No Message Validation** - Bridge accepts any JSON
3. **No Authentication** - Figma plugin can send any command
4. **Test Script Broken** - Path issues prevent execution
5. **Incomplete JSDoc** - Missing function documentation
6. **No Rate Limiting** - WebSocket server has no per-client limits
7. **Limited Error Recovery** - Some errors logged but not retried

---

## 11. RECOMMENDED NEXT STEPS

### Immediate (Before Production)
1. Fix WebSocket URL mismatch in mcp-config.json
2. Fix TypeScript error in figma-bridge.ts line 225
3. Fix test script path error in run-all-tests.sh line 66
4. Run full test suite to ensure nothing breaks

### Short Term (First Sprint)
1. Add input validation to WebSocket server
2. Implement token-based authentication
3. Complete JSDoc documentation
4. Add .dockerignore files

### Medium Term (Next Quarter)
1. Add per-client rate limiting
2. Implement request/response logging
3. Add Prometheus metrics endpoint
4. Create end-to-end integration test
5. Add performance benchmarking

---

## 12. KEY FILE LOCATIONS

**Core Services:**
- `/Users/Spare/Documents/code/text-to-figma/mcp-server/` - MCP Server
- `/Users/Spare/Documents/code/text-to-figma/websocket-server/` - WebSocket Bridge
- `/Users/Spare/Documents/code/text-to-figma/figma-plugin/` - Figma Plugin
- `/Users/Spare/Documents/code/text-to-figma/tests/` - Test Suite

**Build Artifacts:**
- `/Users/Spare/Documents/code/text-to-figma/mcp-server/dist/` - Compiled MCP server
- `/Users/Spare/Documents/code/text-to-figma/figma-plugin/code.js` - Compiled plugin

**Configuration:**
- `/Users/Spare/Documents/code/text-to-figma/mcp-config.json`
- `/Users/Spare/Documents/code/text-to-figma/docker-compose.yml`
- `/Users/Spare/Documents/code/text-to-figma/build-all.sh`

---

## Summary

**Text-to-Figma is a well-architected project** with excellent patterns for integrating Claude with Figma design tools. The monorepo structure, comprehensive tool system, strong type safety, and production-ready monitoring make it a solid foundation.

However, **3 critical issues must be fixed before production use**:
1. WebSocket URL configuration mismatch
2. TypeScript ESLint error in figma-bridge.ts
3. Test script path error

After these fixes, the project is ready for production deployment with Docker Compose.

