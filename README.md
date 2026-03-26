# Text-to-Figma MCP Server

[![CI](https://github.com/michael-haufschild-gib/text-to-figma/actions/workflows/ci.yml/badge.svg)](https://github.com/michael-haufschild-gib/text-to-figma/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)

A reference implementation for giving AI agents direct access to the Figma Plugin API. Three-tier architecture: **Figma plugin** → **WebSocket bridge** → **MCP server** exposing 65 tools via [Model Context Protocol](https://modelcontextprotocol.io/).

Vibecoded with [Claude Code](https://claude.ai/code).

## Architecture

```
Claude / AI Agent
   ↓ stdio (JSON-RPC)
MCP Server (TypeScript)
   ↓ WebSocket
WebSocket Bridge (port 8080)
   ↓ WebSocket
Figma Plugin
   ↓ Figma Plugin API
Figma Document
```

| Layer | Directory | Role |
|-|-|-|
| MCP Server | `mcp-server/` | Exposes tools via MCP, validates input with Zod, enforces design constraints |
| WebSocket Bridge | `websocket-server/` | Routes messages between MCP server and Figma plugin, manages connections |
| Figma Plugin | `figma-plugin/` | Executes Figma API calls inside Figma Desktop |

## Quick Start

### 1. Install and Build

```bash
npm install
npm run build
```

### 2. Start WebSocket Server

```bash
cd websocket-server && npm start
```

### 3. Load Figma Plugin

1. Open Figma Desktop
2. Menu > Plugins > Development > Import plugin from manifest
3. Select `figma-plugin/manifest.json`
4. Run the plugin — it should connect to the WebSocket server

### 4. Configure Your MCP Client

Add to your MCP client config (e.g. Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "text-to-figma": {
      "command": "node",
      "args": ["/FULL/PATH/TO/text-to-figma/mcp-server/dist/index.js"],
      "env": {
        "FIGMA_WS_URL": "ws://localhost:8080",
        "NODE_ENV": "development",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

Replace `/FULL/PATH/TO/` with the absolute path to this repo. A local-dev config with relative paths is available in `mcp-config.json`.

### 5. Test It

Ask your AI agent:

> Create a blue frame at 100,100 with size 400x300, then add white text "Hello World" centered inside it.

Check Figma — the frame and text should appear.

## Available Tools (65)

### Creation
`create_frame` `create_text` `create_ellipse` `create_line` `create_polygon` `create_star` `create_path` `create_rectangle_with_image_fill` `create_boolean_operation` `create_page` `create_design`

### Components
`create_component` `create_component_set` `create_instance` `detach_component` `add_variant_property` `set_component_properties` `set_instance_swap`

### Styling
`set_fills` `set_stroke` `set_appearance` `set_corner_radius` `set_image_fill` `add_gradient_fill` `apply_effects`

### Layout
`set_layout_properties` `set_layout_sizing` `set_layout_align` `set_constraints` `align_nodes` `distribute_nodes` `set_layer_order`

### Text
`set_text_properties` `create_text_style` `apply_text_style`

### Styles
`create_color_style` `create_effect_style` `apply_fill_style` `apply_effect_style`

### Transform & Spatial
`set_transform` `connect_shapes` `reparent_node`

### Query
`get_node_info` `get_node_by_id` `get_node_by_name` `get_children` `get_parent` `get_selection` `get_absolute_bounds` `get_relative_bounds` `get_page_hierarchy` `list_pages`

### Utility
`check_connection` `set_visible` `set_locked` `rename_node` `remove_node` `export_node` `set_current_page` `set_export_settings` `get_plugin_data` `set_plugin_data`

### Design System
`check_wcag_contrast` `validate_design_tokens`

## Configuration

All environment variables with defaults are documented in [`.env.example`](.env.example).

Key settings:

| Variable | Default | Description |
|-|-|-|
| `FIGMA_WS_URL` | `ws://localhost:8080` | WebSocket bridge URL |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |
| `HEALTH_CHECK_PORT` | `8081` | HTTP health check port |
| `CIRCUIT_BREAKER_THRESHOLD` | `5` | Failures before circuit opens |

## Development

```bash
npm install          # Install all workspaces
npm run build        # Build all (mcp-server + figma-plugin)
npm test             # Run all tests (vitest, 2100+ tests)
npm run lint         # ESLint (strict TypeScript rules)
npm run format       # Prettier check
npm run type-check   # TypeScript strict mode
npm run test:coverage  # Coverage report (90%+ thresholds)
npm run test:mutation  # Mutation testing (Stryker)
```

See [`docs/`](docs/) for detailed architecture and development documentation.

## Troubleshooting

### Plugin won't load in Figma
- Ensure `figma-plugin/code.js` exists (`npm run build` in figma-plugin/)
- Try removing and re-importing the plugin

### WebSocket won't connect
- Check the server is running: `lsof -i :8080`
- Check the Figma plugin console for errors

### MCP client can't see tools
- Ensure `claude_desktop_config.json` uses an absolute path
- Restart the MCP client after config changes
- Test manually: `node mcp-server/dist/index.js`

## License

[MIT](LICENSE)
