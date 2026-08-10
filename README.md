# Text-to-Figma MCP Server

[![CI](https://github.com/michael-haufschild-gib/text-to-figma/actions/workflows/ci.yml/badge.svg)](https://github.com/michael-haufschild-gib/text-to-figma/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)

A reference implementation for giving AI agents direct access to the Figma Plugin API. Three-tier architecture: **Figma plugin** → **WebSocket bridge** → **MCP server** exposing 69 tools via [Model Context Protocol](https://modelcontextprotocol.io/).

Vibecoded with [Claude Code](https://claude.ai/code).

## Architecture

```
Claude / AI Agent
   ↓ stdio (JSON-RPC)
MCP Server (TypeScript)
   ↓ WebSocket
WebSocket Bridge (default port 8080)
   ↓ WebSocket
Figma Plugin
   ↓ Figma Plugin API
Figma Document
```

| Layer            | Directory           | Role                                                                         |
| ---------------- | ------------------- | ---------------------------------------------------------------------------- |
| MCP Server       | `mcp-server/`       | Exposes tools via MCP, validates input with Zod, enforces design constraints |
| WebSocket Bridge | `websocket-server/` | Routes messages between MCP server and Figma plugin, manages connections     |
| Figma Plugin     | `figma-plugin/`     | Executes Figma API calls inside Figma Desktop                                |

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

If port `8080` is occupied, no manual port coordination is needed in the default local setup. The MCP auto-spawner and Figma plugin scan `8080-8099` and use the first available Text-to-Figma bridge.

### 3. Load Figma Plugin

1. Open Figma Desktop
2. Menu > Plugins > Development > Import plugin from manifest
3. Select `figma-plugin/manifest.json`
4. Run the plugin — it should connect to the WebSocket server

The plugin scans local bridge ports automatically. The Server field is only an override.

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

Replace `/FULL/PATH/TO/` with the absolute path to this repo. For default local use, leave `FIGMA_WS_URL` at `ws://localhost:8080`; MCP updates its effective URL when the auto-spawner selects another port. A local-dev config with relative paths is available in `mcp-config.json`.

### 5. Test It

Ask your AI agent:

> Create a blue frame at 100,100 with size 400x300, then add white text "Hello World" centered inside it.

Check Figma — the frame and text should appear.

## Available Tools (69)

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

`check_connection` `set_visible` `set_locked` `rename_node` `remove_node` `export_node` `export_nodes` `set_current_page` `set_export_settings` `get_plugin_data` `set_plugin_data`

### Exporting Assets

`export_node` writes a single node to a file (`outputPath`) or returns the data inline (base64, or SVG source text); `export_nodes` writes many nodes — typically a frame's children — into a directory, optionally at several scales:

```js
get_selection({ maxDepth: 1 }); // collect child node IDs
export_nodes({
  nodeIds: ['2486:4475', '2486:4484'],
  outputDir: 'public/assets/icons',
  format: 'PNG',
  scales: [1, 2] // writes icon.png and icon@2x.png
});
```

Relative paths resolve against `EXPORT_OUTPUT_DIR` (default: the server's working directory); absolute paths are used as given. Exports above 7MB cannot cross the plugin bridge — lower the scale or export a smaller node.

### Design System

`check_wcag_contrast` `validate_design_tokens`

## Configuration

All environment variables with defaults are documented in [`.env.example`](.env.example).

Key settings:

| Variable                           | Default               | Description                         |
| ---------------------------------- | --------------------- | ----------------------------------- |
| `FIGMA_WS_URL`                     | `ws://localhost:8080` | WebSocket bridge base URL           |
| `TEXT_TO_FIGMA_WS_PORT_SCAN_LIMIT` | `20`                  | Local auto-discovery port count     |
| `EXPORT_OUTPUT_DIR`                | server cwd            | Root for relative export paths      |
| `LOG_LEVEL`                        | `info`                | `debug` / `info` / `warn` / `error` |
| `HEALTH_CHECK_PORT`                | `8081`                | HTTP health check port              |
| `CIRCUIT_BREAKER_THRESHOLD`        | `5`                   | Failures before circuit opens       |

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

- Check MCP logs for the selected bridge URL
- Confirm the plugin UI shows the same URL after scan
- Check the Figma plugin console for errors

### MCP client can't see tools

- Ensure `claude_desktop_config.json` uses an absolute path
- Restart the MCP client after config changes
- Test manually: `node mcp-server/dist/index.js`

## License

[MIT](LICENSE)
