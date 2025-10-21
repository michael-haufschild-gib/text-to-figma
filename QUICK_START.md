# Quick Start Guide

**For users who just want to get running fast!**

## First Time Setup

```bash
# 1. Build everything (one time only)
./build-all.sh
```

That's it! Wait 2-5 minutes for installation and compilation.

---

## Every Time You Use It

### Start the servers (in this order):

**Terminal 1 - WebSocket Server:**
```bash
cd websocket-server
npm start
```

**Terminal 2 - MCP Server:**
```bash
cd mcp-server
npm start
```

**Figma Desktop App:**
1. Open Figma Desktop
2. Plugins → Development → Text-to-Figma Bridge
3. See "Connected to WebSocket server"

---

## That's It!

Now Claude can generate designs in Figma.

**Full guide**: See `USER_GUIDE.md` for detailed instructions and troubleshooting.

**Technical docs**: See `docs/` folder for architecture and development details.
