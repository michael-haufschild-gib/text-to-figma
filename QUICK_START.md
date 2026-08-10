# Quick Start Guide

**For users who just want to get running fast!**

## First Time Setup

```bash
# 1. Install dependencies
npm install

# 2. Build everything
npm run build
```

---

## Every Time You Use It

### Start the servers (in this order):

**Terminal 1 - WebSocket Server:**

```bash
cd websocket-server
npm start
```

If port `8080` is occupied, the MCP auto-spawner and plugin scan `8080-8099`.

**Terminal 2 - MCP Server:**

```bash
cd mcp-server
npm start
```

**Figma Desktop App:**

1. Open Figma Desktop
2. Plugins → Development → Text-to-Figma Bridge
3. See "Connected to WebSocket server"

The plugin picks the bridge port automatically. Server field is only an override.

---

## That's It!

Now Claude can generate designs in Figma.

**Full guide**: See `USER_GUIDE.md` for detailed instructions and troubleshooting.

**Technical docs**: See `docs/` folder for architecture and development details.
