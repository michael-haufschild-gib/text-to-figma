# Documentation Index

**Welcome to Text-to-Figma!** This index helps you find the right documentation for your needs.

---

## 🚀 Getting Started (New Users)

Start here if you're setting up for the first time:

1. **[QUICK_START.md](QUICK_START.md)** - Fastest way to get running (2 minutes)
2. **[USER_GUIDE.md](USER_GUIDE.md)** - Complete step-by-step guide for non-technical users (15 minutes)
3. **[SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)** - Verify your setup is complete (checklist)
4. **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Fix common issues

---

## 📦 Build & Installation

- **[build-all.sh](build-all.sh)** - Automated build script (run this first!)
- **[package.json](package.json)** - Root dependencies and workspace configuration
- **Installation commands** - See USER_GUIDE.md → Installation section

---

## 🏃 Running the System

Quick reference for daily use:

```bash
# Terminal 1: WebSocket Server
cd websocket-server && npm start

# Terminal 2: MCP Server
cd mcp-server && npm start

# Figma Desktop: Load Plugin
Plugins → Development → Text-to-Figma Bridge
```

See **[QUICK_START.md](QUICK_START.md)** for minimal instructions.
See **[USER_GUIDE.md](USER_GUIDE.md)** for detailed explanations.

---

## 🔧 Technical Documentation

For developers and advanced users:

### Architecture & Design

- **[docs/architecture.md](docs/architecture.md)** - Complete system architecture
- **[docs/architecture-mcp-server.md](docs/architecture-mcp-server.md)** - MCP server design
- **[docs/architecture-websocket-server.md](docs/architecture-websocket-server.md)** - WebSocket bridge design
- **[docs/architecture-figma-plugin.md](docs/architecture-figma-plugin.md)** - Figma plugin design
- **[docs/synthesis.md](docs/synthesis.md)** - Complete project specification

### Development

- **[docs/DEVELOPER_HANDOFF_SUMMARY.md](docs/DEVELOPER_HANDOFF_SUMMARY.md)** - Developer setup guide
- **[docs/meta/styleguide.md](docs/meta/styleguide.md)** - Code style requirements
- **[docs/REFACTOR_IMPLEMENTATION_SUMMARY.md](docs/REFACTOR_IMPLEMENTATION_SUMMARY.md)** - Recent routing refactor

### Operations

- **[docs/operations/deployment-runbook.md](docs/operations/deployment-runbook.md)** - Production deployment
- **[docs/operations/incident-response.md](docs/operations/incident-response.md)** - Handling incidents
- **[docs/operations/troubleshooting.md](docs/operations/troubleshooting.md)** - Advanced troubleshooting

---

## 🧪 Testing

- **[tests/README.md](tests/README.md)** - Testing guide
- **[tests/QUICK_START.md](tests/QUICK_START.md)** - Quick test guide
- **[tests/run-all-tests.sh](tests/run-all-tests.sh)** - Run all tests
- **[tests/TEST_SUMMARY.md](tests/TEST_SUMMARY.md)** - Test coverage summary

Running tests:
```bash
cd tests
./run-all-tests.sh
```

---

## 📚 Component Documentation

### MCP Server
- **[mcp-server/USER_GUIDE.md](mcp-server/USER_GUIDE.md)** - MCP server usage
- **[mcp-server/package.json](mcp-server/package.json)** - Scripts and dependencies
- **[mcp-server/tsconfig.json](mcp-server/tsconfig.json)** - TypeScript configuration

### WebSocket Server
- **[websocket-server/package.json](websocket-server/package.json)** - Scripts and dependencies
- **[websocket-server/server.js](websocket-server/server.js)** - Main server code

### Figma Plugin
- **[figma-plugin/package.json](figma-plugin/package.json)** - Scripts and dependencies
- **[figma-plugin/manifest.json](figma-plugin/manifest.json)** - Plugin metadata
- **[figma-plugin/code.ts](figma-plugin/code.ts)** - Plugin source code

---

## 🎨 Design & Specifications

- **[docs/HTML_FIGMA_MAPPINGS.md](docs/HTML_FIGMA_MAPPINGS.md)** - How HTML/CSS maps to Figma
- **[docs/meta/animation-guide.md](docs/meta/animation-guide.md)** - Animation patterns
- **[docs/meta/prompt-guide.md](docs/meta/prompt-guide.md)** - Prompting best practices

---

## 🐛 Troubleshooting by Symptom

### Build Issues
→ See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) → Build Checks

### Connection Issues
→ See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) → Runtime Checks

### Plugin Won't Load
→ See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) → Figma Plugin section

### "Tool not found" errors
→ See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) → Common Error Messages

---

## 📖 Reading Paths by Role

### 👤 End User (Just want to use it)
1. QUICK_START.md
2. USER_GUIDE.md
3. TROUBLESHOOTING.md (if issues)

### 👨‍💻 Developer (Contributing code)
1. USER_GUIDE.md (setup)
2. docs/DEVELOPER_HANDOFF_SUMMARY.md
3. docs/meta/styleguide.md
4. docs/architecture.md
5. tests/README.md

### 🏗️ System Administrator (Deploying)
1. build-all.sh
2. docs/operations/deployment-runbook.md
3. docs/operations/incident-response.md
4. docs/architecture.md

### 🔬 Researcher (Understanding the system)
1. README.md (overview)
2. docs/synthesis.md (complete spec)
3. docs/architecture.md (technical design)
4. docs/HTML_FIGMA_MAPPINGS.md (design decisions)

---

## 🆘 Quick Help

**Can't find what you need?**

1. **Search the docs:** Use your editor's search (Cmd/Ctrl + F) to search across files
2. **Check the README:** [README.md](README.md) has a high-level overview
3. **Look at examples:** See `tests/e2e/` for real-world usage examples
4. **Check Git history:** `git log docs/` shows documentation changes

---

## 📝 Document Maintenance

**Last updated:** October 18, 2025

**Recent additions:**
- ✨ build-all.sh - Automated build script
- ✨ USER_GUIDE.md - Non-technical user guide
- ✨ QUICK_START.md - Minimal getting started guide
- ✨ TROUBLESHOOTING.md - Common issues and solutions
- ✨ DOCS_INDEX.md - This file

**Contributing:**
If you add new documentation, please update this index!

---

## 🔗 External Resources

- **Model Context Protocol:** [modelcontextprotocol.io](https://modelcontextprotocol.io/)
- **Figma Plugin API:** [figma.com/plugin-docs](https://www.figma.com/plugin-docs/)
- **Claude Documentation:** [docs.anthropic.com](https://docs.anthropic.com/)
- **Node.js Documentation:** [nodejs.org/docs](https://nodejs.org/docs/)

---

**Happy building!** 🚀
