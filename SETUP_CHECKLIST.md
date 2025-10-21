# Setup Verification Checklist

Use this checklist to verify your Text-to-Figma setup is complete and working correctly.

---

## ✅ Pre-Installation Checks

- [ ] **Node.js installed**: Run `node --version` (should show v18.0.0 or higher)
- [ ] **npm installed**: Run `npm --version` (should show version number)
- [ ] **Figma Desktop installed**: Open Figma Desktop app successfully
- [ ] **Figma account**: You can log into Figma
- [ ] **Project downloaded**: You have the text-to-figma folder
- [ ] **Terminal access**: You can open a terminal/command prompt

---

## ✅ Build Completion Checks

After running `./build-all.sh` or `build-all.bat`:

### Dependencies Installed
- [ ] Root `node_modules/` folder exists
- [ ] `mcp-server/node_modules/` folder exists
- [ ] `websocket-server/node_modules/` folder exists
- [ ] `figma-plugin/node_modules/` folder exists
- [ ] `tests/node_modules/` folder exists

### TypeScript Compiled
- [ ] File exists: `mcp-server/dist/index.js`
- [ ] File exists: `mcp-server/dist/index.d.ts`
- [ ] File exists: `figma-plugin/code.js`
- [ ] File exists: `figma-plugin/types.js`

### Build Success Messages
- [ ] Saw: "MCP server built → dist/"
- [ ] Saw: "Figma plugin built → code.js"
- [ ] Saw: "Build Complete! 🎉"
- [ ] No error messages in red

---

## ✅ Runtime Checks

### Terminal 1: WebSocket Server

- [ ] Started: `cd websocket-server && npm start`
- [ ] Output shows: "WebSocket server running on ws://localhost:8765"
- [ ] No error messages
- [ ] Terminal window still open (don't close it)

**Command to verify:**
```bash
# Should show the node process running
ps aux | grep "websocket-server"
```

### Terminal 2: MCP Server

- [ ] Started: `cd mcp-server && npm start`
- [ ] Output shows: "MCP Server started" or listening message
- [ ] No error messages
- [ ] Terminal window still open (don't close it)

**Command to verify:**
```bash
# Should show the node process running
ps aux | grep "mcp-server"
```

### Figma Plugin

- [ ] Opened Figma Desktop (not browser)
- [ ] Created or opened a file
- [ ] Went to: Plugins → Development → Import plugin from manifest
- [ ] Selected: `figma-plugin/manifest.json`
- [ ] Plugin installed successfully
- [ ] Ran: Plugins → Development → Text-to-Figma Bridge
- [ ] Plugin window opened
- [ ] Plugin shows: "Connected to WebSocket server"

---

## ✅ Integration Checks

### Connection Verification

- [ ] WebSocket server terminal shows: "Client connected" (when plugin opens)
- [ ] Plugin status: "Connected to WebSocket server" (green or positive message)
- [ ] No disconnection messages in any terminal
- [ ] All three components running simultaneously

### Manual Test

Try this simple test:

1. **Open browser console in Figma plugin** (if available)
2. **Check for WebSocket connection**: Should show connection established
3. **Verify no errors**: No red error messages in any terminal

---

## ✅ Functionality Checks

### Basic Operation Test

With Claude Code CLI (if you have it):

- [ ] Claude can list available tools
- [ ] Claude can execute a simple tool (e.g., `create_frame`)
- [ ] Design appears in Figma after Claude runs command
- [ ] No errors in any terminal window

### Without Claude Test

You can test the MCP server directly:

```bash
# In a new terminal, test that MCP server responds
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node mcp-server/dist/index.js
```

- [ ] Output shows JSON response with list of tools
- [ ] No error messages

---

## ✅ Documentation Checks

Verify you have all documentation files:

- [ ] File exists: `USER_GUIDE.md`
- [ ] File exists: `QUICK_START.md`
- [ ] File exists: `TROUBLESHOOTING.md`
- [ ] File exists: `DOCS_INDEX.md`
- [ ] File exists: `build-all.sh` (Mac/Linux)
- [ ] File exists: `build-all.bat` (Windows)

---

## 🔍 Troubleshooting Failed Checks

### If Build Checks Failed

See: **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** → Build Checks section

**Quick fix:**
```bash
# Clean everything and rebuild
rm -rf node_modules mcp-server/node_modules websocket-server/node_modules figma-plugin/node_modules tests/node_modules
rm -rf mcp-server/dist figma-plugin/code.js
./build-all.sh
```

### If Runtime Checks Failed

See: **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** → Runtime Checks section

**Quick fixes:**
- WebSocket server: Check port 8765 isn't in use
- MCP server: Verify `dist/index.js` exists
- Figma plugin: Must use Desktop app, not browser

### If Integration Checks Failed

See: **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** → Integration Checks section

**Common issues:**
- Servers not running in separate terminals
- Figma plugin not connected to WebSocket
- Port mismatch (check both use 8765)

---

## ✅ All Checks Passed?

**Congratulations!** Your Text-to-Figma setup is complete and working. 🎉

### Next Steps

1. **Read examples**: See `tests/e2e/` for usage examples
2. **Try it out**: Ask Claude to create a simple design
3. **Explore tools**: See `docs/architecture.md` for available tools
4. **Bookmark docs**: Keep `DOCS_INDEX.md` handy for reference

---

## 📋 Quick Reference

### Daily Startup Commands

```bash
# Terminal 1
cd websocket-server && npm start

# Terminal 2
cd mcp-server && npm start

# Figma Desktop
Plugins → Development → Text-to-Figma Bridge
```

### Shutdown Commands

```bash
# In each terminal
Ctrl + C

# Close Figma plugin window
```

---

## 🆘 Still Having Issues?

1. Review **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** for detailed solutions
2. Check **[USER_GUIDE.md](USER_GUIDE.md)** for step-by-step setup
3. Verify all checkboxes above are checked
4. Look for error messages in terminal output

---

**Last updated:** October 18, 2025

**Print this checklist** and check off items as you complete them! ✓
