# Text-to-Figma User Guide

**Welcome!** This guide will help you get the Text-to-Figma system up and running, even if you're not a developer.

## What is Text-to-Figma?

Text-to-Figma lets you use Claude AI to generate professional Figma designs automatically. Just describe what you want, and Claude will create it for you!

**Example**: Tell Claude "Create a login form with email, password, and a blue submit button" and it will generate a complete, professional design in Figma.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Building the Project](#building-the-project)
4. [Running the System](#running-the-system)
5. [Using with Claude](#using-with-claude)
6. [Troubleshooting](#troubleshooting)
7. [FAQ](#faq)

---

## Prerequisites

### What You Need

Before starting, you need these programs installed on your computer:

#### 1. **Node.js** (Required)
   - **What it is**: A program that runs JavaScript code on your computer
   - **How to get it**: Download from [nodejs.org](https://nodejs.org/)
   - **Which version**: Download the "LTS" version (recommended for most users)
   - **How to check if installed**: Open a terminal and type:
     ```bash
     node --version
     ```
     You should see something like `v20.11.0`

#### 2. **Figma Desktop App** (Required)
   - **What it is**: The design tool where your designs will appear
   - **How to get it**: Download from [figma.com/downloads](https://www.figma.com/downloads/)
   - **Note**: You need a free Figma account

#### 3. **Claude Code CLI** (Required for AI features)
   - **What it is**: The AI assistant that generates designs
   - **How to get it**: Follow instructions at [Anthropic's documentation](https://docs.anthropic.com/)

---

## Installation

### Step 1: Download the Project

If you haven't already, get the project files:

```bash
# Option A: Clone from Git (if you have Git installed)
git clone https://github.com/michael-h-patrianna/text-to-figma.git
cd text-to-figma

# Option B: Download ZIP from GitHub and extract it
# Then navigate to the folder in your terminal
```

### Step 2: Open a Terminal

- **Mac**: Press `Cmd + Space`, type "Terminal", press Enter
- **Windows**: Press `Win + R`, type "cmd", press Enter
- **Linux**: Press `Ctrl + Alt + T`

### Step 3: Navigate to the Project

```bash
# Replace with your actual path
cd /path/to/text-to-figma
```

**Tip**: You can drag the folder into the terminal window to auto-fill the path!

---

## Building the Project

Building the project converts the source code into a format that can run on your computer.

### Automated Build (Recommended)

We've created a script that does everything for you!

#### On Mac/Linux:

```bash
# Make the script executable (only needed once)
chmod +x build-all.sh

# Run the build script
./build-all.sh
```

#### On Windows:

```cmd
# Run the Windows batch script
build-all.bat
```

**Alternative (if batch file doesn't work):**
```bash
# Use Git Bash or WSL, or run these commands manually:
npm install
cd mcp-server && npm install && npm run build && cd ..
cd figma-plugin && npm install && npm run build && cd ..
cd websocket-server && npm install && cd ..
cd tests && npm install && cd ..
```

### What the Build Does

The script will:
1. ✅ Install all required dependencies (libraries)
2. ✅ Compile TypeScript code to JavaScript
3. ✅ Verify everything built correctly
4. ✅ Run type checks to catch errors

**Time**: This takes 2-5 minutes depending on your internet speed.

### Success!

If you see:

```
═══════════════════════════════════════════════════════════
  Build Complete! 🎉
═══════════════════════════════════════════════════════════
```

You're ready to move to the next step!

---

## Running the System

The Text-to-Figma system has **three components** that work together. You need to start them in order:

```
┌─────────────────┐
│  Claude AI      │  "Create a blue button"
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MCP Server     │  Translates to Figma commands
│  (Terminal 2)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  WebSocket      │  Bridge between systems
│  Server         │
│  (Terminal 1)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Figma Plugin   │  Creates the design
│  (Figma Desktop)│
└─────────────────┘
```

### Component 1: WebSocket Server 🌐

**What it does**: Acts as a bridge between the AI and Figma

**How to start**:

```bash
# Open a terminal window
cd websocket-server
npm start
```

**What you'll see**:
```
WebSocket server running on ws://localhost:8765
```

**Keep this terminal window open!** The server needs to keep running.

---

### Component 2: MCP Server 📦

**What it does**: Translates Claude's requests into Figma commands

**How to start**:

```bash
# Open a NEW terminal window (keep the first one running!)
cd mcp-server
npm start
```

**What you'll see**:
```
MCP Server started
Listening on stdio...
```

**Keep this terminal window open too!**

---

### Component 3: Figma Plugin 🔌

**What it does**: Executes the design changes in Figma

**How to install**:

1. Open **Figma Desktop App**
2. Click **Plugins** in the menu bar
3. Select **Development** → **Import plugin from manifest**
4. Navigate to: `text-to-figma/figma-plugin/manifest.json`
5. Click **Open**

**How to run**:

1. Create a new file in Figma (or open an existing one)
2. Right-click on the canvas
3. Go to **Plugins** → **Development**
4. Click **Text-to-Figma Bridge**

**What you'll see**: A small plugin window saying "Connected to WebSocket server"

---

## Using with Claude

Now that everything is running, you can use Claude to generate designs!

### Example Conversation

**You**: "Create a blue button that says 'Sign Up' with white text"

**Claude will**:
1. Create a frame (container) for the button
2. Set the background to blue
3. Add white text that says "Sign Up"
4. Check that the contrast is accessible (WCAG compliant)
5. Add a subtle shadow effect

**Result**: A professional button appears in your Figma file!

### More Examples

Try asking Claude to create:

- "A login form with email and password fields"
- "A card with an image, title, and description"
- "A navigation bar with Home, About, and Contact links"
- "A mobile app screen with a header and list of items"

### Tips for Best Results

1. **Be specific**: "Create a BLUE button" is better than "Create a button"
2. **Mention sizes**: "Make it 200px wide" gives exact dimensions
3. **Use web terms**: Claude understands HTML/CSS concepts like "padding", "margin", "flex"
4. **Check accessibility**: Ask "Is this contrast WCAG compliant?"

---

## Troubleshooting

### Problem: "Command not found: npm"

**Solution**: Node.js is not installed or not in your PATH
- Install Node.js from [nodejs.org](https://nodejs.org/)
- Restart your terminal after installing

---

### Problem: Build script fails with "Permission denied"

**Solution**: Make the script executable
```bash
chmod +x build-all.sh
```

---

### Problem: "Port 8765 already in use"

**Solution**: Another program is using that port
```bash
# Find what's using the port (Mac/Linux)
lsof -i :8765

# Kill the process
kill -9 <PID>

# Or change the port in websocket-server/server.js
```

---

### Problem: Figma plugin won't load

**Solution**: Check these:
1. Did you run the build script? (`./build-all.sh`)
2. Is `figma-plugin/code.js` present?
3. Are you using Figma Desktop (not browser)?
4. Try: Plugins → Development → Import plugin from manifest again

---

### Problem: Claude can't connect to MCP server

**Solution**:
1. Make sure MCP server is running (`cd mcp-server && npm start`)
2. Check Claude Code CLI configuration
3. Verify MCP server is listening on stdio

---

### Problem: "Cannot find module" errors

**Solution**: Dependencies not installed
```bash
# Re-run the build script
./build-all.sh

# Or manually install in each folder
cd mcp-server && npm install
cd ../websocket-server && npm install
cd ../figma-plugin && npm install
```

---

## FAQ

### Q: Do I need to rebuild every time I start?

**A**: No! Only build once (or when you update the code). After that, just run the three components.

### Q: Can I close the terminal windows?

**A**: No, the WebSocket and MCP servers need to stay running. Closing the terminal will stop them.

### Q: How do I stop everything?

**A**: Press `Ctrl + C` in each terminal window to stop the servers. Close the Figma plugin window.

### Q: Does this work with Figma in the browser?

**A**: No, you must use the Figma Desktop App. Plugins can only run in the desktop version.

### Q: Is this free to use?

**A**: Yes! The Text-to-Figma system is open source. You only need:
- A free Figma account
- Access to Claude Code CLI (may require subscription)

### Q: Can I use this without Claude?

**A**: The system is designed for Claude, but you could theoretically send commands directly to the MCP server using the JSON-RPC protocol. See technical documentation for details.

### Q: Where are the designs saved?

**A**: Designs are created in your Figma file. Save the file normally in Figma (File → Save).

### Q: Can multiple people use this at once?

**A**: Each person needs their own instance running. The system connects to one Figma file at a time.

### Q: How do I update to the latest version?

**A**:
```bash
# Pull latest changes (if using Git)
git pull

# Rebuild everything
./build-all.sh
```

---

## Quick Reference Card

### Start Everything (After First Build)

```bash
# Terminal 1: WebSocket Server
cd websocket-server && npm start

# Terminal 2: MCP Server
cd mcp-server && npm start

# Figma: Run plugin
Plugins → Development → Text-to-Figma Bridge
```

### Stop Everything

```bash
# In each terminal window
Ctrl + C

# Close Figma plugin window
```

### Rebuild After Code Changes

```bash
./build-all.sh
```

---

## Getting Help

### Resources

- **Technical Documentation**: See `docs/` folder for detailed architecture
- **Architecture Guide**: `docs/architecture.md`
- **Developer Setup**: `docs/DEVELOPER_HANDOFF_SUMMARY.md`

### Support

- Check that all three components are running
- Look at terminal output for error messages
- Verify Figma plugin says "Connected to WebSocket server"
- Make sure you're using Figma Desktop (not browser)

---

## Summary

**You're all set!** Here's what you learned:

1. ✅ Installed Node.js and dependencies
2. ✅ Built the project using `./build-all.sh`
3. ✅ Started the WebSocket server
4. ✅ Started the MCP server
5. ✅ Loaded the Figma plugin
6. ✅ Ready to use with Claude!

**Happy designing!** 🎨✨

---

*Last updated: October 18, 2025*
