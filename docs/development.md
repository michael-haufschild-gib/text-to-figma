# Development Guide for LLM Coding Agents

**Purpose**: Instructions for setup, building, running, and debugging the Text-to-Figma system.

---

## Quick Start

```bash
# 1. Install all dependencies (from project root)
npm install
cd mcp-server && npm install
cd ../websocket-server && npm install
cd ../figma-plugin && npm install
cd ../tests && npm install
cd ..

# 2. Build all TypeScript
./build-all.sh

# 3. Start servers (2 terminals)
# Terminal 1: WebSocket bridge
cd websocket-server && npm start

# Terminal 2: MCP server
cd mcp-server && npm start

# 4. Load Figma plugin
# Figma → Plugins → Development → Import plugin from manifest
# Select: figma-plugin/manifest.json
```

---

## Key Commands

| Task                   | Command                           | Working Directory   |
| ---------------------- | --------------------------------- | ------------------- |
| **Install all deps**   | `npm install` then each workspace | project root        |
| **Build everything**   | `./build-all.sh`                  | project root        |
| **Build MCP server**   | `npm run build`                   | `mcp-server/`       |
| **Build Figma plugin** | `npm run build`                   | `figma-plugin/`     |
| **Start WebSocket**    | `npm start`                       | `websocket-server/` |
| **Start MCP server**   | `npm start`                       | `mcp-server/`       |
| **Run all tests**      | `npm test`                        | `tests/`            |
| **Run unit tests**     | `npm run test:unit`               | `tests/`            |
| **Type check MCP**     | `npm run type-check`              | `mcp-server/`       |
| **Lint MCP**           | `npm run lint`                    | `mcp-server/`       |
| **Fix lint errors**    | `npm run lint:fix`                | `mcp-server/`       |
| **Format code**        | `npm run format:fix`              | `mcp-server/`       |

---

## Development Workflow

### Making Changes to MCP Server

```bash
# 1. Edit files in mcp-server/src/
# 2. Rebuild
cd mcp-server && npm run build

# 3. Restart (kill existing and run)
npm start
```

### Making Changes to Figma Plugin

```bash
# 1. Edit files in figma-plugin/src/
# 2. Rebuild
cd figma-plugin && npm run build

# 3. In Figma: Plugins → Development → Reload plugin
```

### Making Changes to WebSocket Server

```bash
# 1. Edit websocket-server/src/server.ts
# 2. Rebuild and restart
cd websocket-server && npm run build && npm start
```

---

## Port Configuration

| Component        | Default Port    | Environment Variable |
| ---------------- | --------------- | -------------------- |
| WebSocket Server | 8080            | `PORT`               |
| MCP Server       | stdio (no port) | N/A                  |

---

## Checking What's Running

```bash
# Check if WebSocket server is running on port 8080
lsof -i :8080

# Kill process on port 8080 if stuck
kill $(lsof -t -i :8080)
```

---

## Build Outputs

| Source                      | Output                       | Built By  |
| --------------------------- | ---------------------------- | --------- |
| `mcp-server/src/*.ts`       | `mcp-server/dist/*.js`       | `tsc`     |
| `figma-plugin/src/main.ts`  | `figma-plugin/code.js`       | `esbuild` |
| `websocket-server/src/*.ts` | `websocket-server/dist/*.js` | `tsc`     |

---

## Environment Requirements

- **Node.js**: v20 or later (required by `engines` field)
- **npm**: v9+
- **Figma Desktop**: Required for plugin development

Check versions:

```bash
node --version  # Should be v20+
npm --version   # Should be v9+
```

---

## Debugging

### MCP Server Not Responding

```bash
# Test MCP server tool listing
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node mcp-server/dist/index.js

# Should output JSON with available tools
```

### WebSocket Connection Issues

```bash
# Check WebSocket server is running
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8080

# Should show "Upgrade Required" or connection attempt
```

### Figma Plugin Not Connecting

1. Open plugin in Figma
2. Check status indicator (should be green)
3. If red: Check WebSocket server is running on port 8080
4. Right-click plugin UI → Inspect → Console for errors

---

## Testing After Changes

```bash
# Always run after making changes
cd tests && npm test

# Quick validation during development
cd tests && npm run test:unit
```

---

## File Watching (Development Mode)

MCP Server does not have watch mode. Manual rebuild required:

```bash
# After each change to mcp-server/src/
cd mcp-server && npm run build && npm start
```

For rapid iteration, use two terminals:

1. Terminal 1: Edit code
2. Terminal 2: `cd mcp-server && npm run build && npm start`

---

## Troubleshooting

### Problem: "Cannot find module"

**Solution**: Rebuild the TypeScript

```bash
cd mcp-server && npm run build
```

### Problem: "Port 8080 already in use"

**Solution**: Kill existing process

```bash
kill $(lsof -t -i :8080)
```

### Problem: "No tools available" in Claude

**Solution**: Check MCP server is built and configured

```bash
cd mcp-server && npm run build
# Verify mcp-config.json points to correct path
```

### Problem: Figma plugin shows "Disconnected"

**Solution**: Start WebSocket server

```bash
cd websocket-server && npm start
# Then reload plugin in Figma
```

### Problem: Tests fail with "module not found"

**Solution**: Build MCP server before running tests

```bash
cd mcp-server && npm run build
cd ../tests && npm test
```

### Problem: TypeScript compilation errors

**Solution**: Check for type errors

```bash
cd mcp-server && npm run type-check
```

### Problem: Lint errors blocking commit

**Solution**: Auto-fix lint issues

```bash
cd mcp-server && npm run lint:fix
```

---

## Clean Build

When things get stuck, clean and rebuild:

```bash
# Remove all build artifacts
rm -rf mcp-server/dist
rm -f figma-plugin/code.js  # Built by esbuild from src/main.ts

# Reinstall dependencies
rm -rf node_modules
rm -rf mcp-server/node_modules
rm -rf websocket-server/node_modules
rm -rf figma-plugin/node_modules
rm -rf tests/node_modules

# Fresh install and build
npm install
./build-all.sh
```

---

## Common Mistakes

❌ **Don't**: Edit `mcp-server/dist/*.js` files directly
✅ **Do**: Edit `mcp-server/src/*.ts` and rebuild

❌ **Don't**: Forget to rebuild after changing TypeScript
✅ **Do**: Run `npm run build` after every TypeScript change

❌ **Don't**: Run MCP server from project root
✅ **Do**: Run from `mcp-server/` directory: `cd mcp-server && npm start`

❌ **Don't**: Start MCP server before WebSocket server
✅ **Do**: Start WebSocket server first, then MCP server

❌ **Don't**: Leave stale processes running
✅ **Do**: Kill old processes before starting new ones

❌ **Don't**: Skip tests after making changes
✅ **Do**: Run `npm test` in tests/ after every change
