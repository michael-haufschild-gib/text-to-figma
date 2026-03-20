# Text-to-Figma MCP Server

Design automation for Figma using Claude via Model Context Protocol.

## What Actually Works

- ✅ MCP Server with 60+ Figma tools
- ✅ WebSocket bridge server
- ✅ Figma plugin (basic - create frames, text)
- ✅ Type-safe tool definitions with Zod
- ✅ Health monitoring

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Build Everything

```bash
npm run build
```

### 3. Start WebSocket Server

```bash
cd websocket-server
npm start
```

Should see: `WebSocket bridge server started on port 8080`

### 4. Load Figma Plugin

1. Open Figma Desktop
2. Menu → Plugins → Development → Import plugin from manifest
3. Select `figma-plugin/manifest.json`
4. Run the plugin

You should see the plugin UI connect to WebSocket.

### 5. Configure Claude Desktop

Edit Claude config:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "text-to-figma": {
      "command": "node",
      "args": ["/FULL/PATH/TO/text-to-figma/mcp-server/dist/index.js"],
      "env": {
        "WEBSOCKET_URL": "ws://localhost:8080"
      }
    }
  }
}
```

**IMPORTANT**: Use full absolute path, not relative.

### 6. Restart Claude Desktop

Completely quit and restart Claude Desktop.

### 7. Test It

In Claude, type:

```
Use the text-to-figma server to create a red frame at position 100,100 with size 200x200
```

Check Figma - you should see the frame appear.

## Architecture

```
Claude Desktop
   ↓ (stdio)
MCP Server (port N/A - stdio only)
   ↓ (WebSocket)
WebSocket Bridge (port 8080)
   ↓ (WebSocket)
Figma Plugin
   ↓ (Figma API)
Figma Document
```

## Available Tools

The MCP server exposes 60+ tools. Key ones:

- `create_frame` - Create frames
- `create_text` - Create text nodes
- `set_fills` - Set node fills/colors
- `set_transform` - Move, resize, rotate, and scale nodes
- `set_appearance` - Set opacity, blend mode, visibility
- `apply_effects` - Add shadows, blurs
- `check_wcag_contrast` - Validate color contrast
- `validate_design_tokens` - Check design system compliance

See full list: `mcp-server/src/tools/`

## Configuration

### MCP Server

Environment variables:

- `WEBSOCKET_URL` - WebSocket server URL (default: `ws://localhost:8080`)
- `NODE_ENV` - Environment (`development`|`production`)
- `LOG_LEVEL` - Log level (`debug`|`info`|`warn`|`error`)

### WebSocket Server

- Port: `8080` (hardcoded in `websocket-server/server.js`)
- Max message size: `10MB`
- Request timeout: `30s`

## Development

### File Structure

```
text-to-figma/
├── mcp-server/          # MCP server (TypeScript)
│   ├── src/
│   │   ├── tools/       # 60+ tool implementations
│   │   ├── constraints/ # Design validation
│   │   ├── monitoring/  # Logging, metrics
│   │   └── index.ts     # Main entry
│   └── dist/            # Compiled JS
├── websocket-server/    # Bridge (JavaScript)
│   └── server.js
├── figma-plugin/        # Figma plugin (TypeScript)
│   ├── src/
│   │   ├── main.ts      # Entry point
│   │   └── handlers/    # Command handlers by domain
│   ├── ui.html          # Plugin UI
│   └── manifest.json
└── tests/               # Test suite
```

### Building

```bash
# Build all
npm run build

# Build specific component
cd mcp-server && npm run build
cd figma-plugin && npm run build
```

### Linting

```bash
npm run lint
```

### Testing

```bash
# Run all tests
./tests/run-all-tests.sh

# Integration tests only
./tests/run-integration-tests.sh
```

## Troubleshooting

### Plugin won't load in Figma

- Check `figma-plugin/code.js` exists after building
- Check `figma-plugin/manifest.json` paths are correct
- Try reloading: Plugins → Development → Remove plugin, then re-import

### WebSocket won't connect

- Check server is running: `lsof -i :8080`
- Check firewall isn't blocking port 8080
- Look at browser console in Figma plugin UI

### Claude can't see the server

- Check `claude_desktop_config.json` has absolute path
- Restart Claude Desktop completely
- Check MCP server builds: `ls mcp-server/dist/index.js`
- Run manually to test: `node mcp-server/dist/index.js`

### MCP server crashes

- Check WebSocket server is running first
- Check `WEBSOCKET_URL` environment variable
- Look at logs for errors

## Known Issues

- Plugin UI is minimal (just shows connection status)
- No authentication on WebSocket (localhost only)
- Circuit breaker may trigger under heavy load
- JSDoc warnings in MCP server (cosmetic only)

## License

MIT
