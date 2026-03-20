# Iteration Log: Button Components

**Started**: 2025-10-28T11:52:00Z
**Target Accuracy**: 95%
**Max Iterations**: 10
**Component Type**: Buttons (Primary, Secondary, Ghost)
**Total Variants**: 18 buttons (3 types × 6 sizes)

---

## Pre-Iteration Setup

### Initial State

- ✅ WebSocket server running on port 8080
- ✅ Figma plugin connected with button parent node selected
- ✅ buttons.json exists with comprehensive specifications (v2.0.0)
- ✅ Directory structure created: `docs/uikit/components/buttons/exports/`
- ✅ drawing_prompt.md created with detailed instructions

### Extraction Status

The buttons.json file was already extracted prior to this workflow iteration. It contains:

- 3 button types: Primary (pink/red gradient), Secondary (teal gradient), Ghost (transparent with stroke)
- 6 sizes per type: 2XL, XL, LG, MD, SM, XS
- Complete specifications: gradients, strokes, typography, dimensions, corner radius
- Disabled states documented but not being replicated in this iteration

---

## Iteration 1 - Node Routing Bug Discovery

### Date: 2025-10-28T11:58:00Z

#### Drawing Phase

Agent successfully created 18 button structures (frames + text) using `create_design()`. All buttons exist in Figma with proper:

- Dimensions and layout (HORIZONTAL, padding, itemSpacing)
- Text content and typography
- Corner radius (50px)

#### Styling Phase - BLOCKER IDENTIFIED

Styling tools (`add_gradient_fill`, `set_stroke`, `set_fills`) consistently returned "Node not found" errors.

#### Root Cause Analysis

**Multi-Instance WebSocket Broadcast Issue:**

The WebSocket server broadcasts all commands to ALL connected Figma plugin instances. When examining the server logs, I discovered:

1. **Multiple Figma instances are connected simultaneously**:
   - Client A (`...0jadv2dpf`): Working on "figma test" page, creates nodes like `992:8989`
   - Client B (`...wyimgmrma`): Working on "Buttons" page, creates nodes like `10124:46179`
   - Client C (`...rzngi3rtr`): Another instance

2. **The problem sequence**:
   - MCP sends `create_design` request
   - WebSocket broadcasts to ALL 3 instances
   - All 3 instances create the node independently with DIFFERENT IDs
   - MCP receives ONE response (e.g., from Client A: `992:8989`)
   - MCP stores this ID and returns it
   - Later, MCP sends `add_gradient_fill` with ID `992:8989`
   - WebSocket broadcasts to all instances
   - Client B tries to find `992:8989` but only has `10124:46179` → **"Node not found"**
   - Client A succeeds with `992:8989` → **Success!**
   - MCP receives the FIRST error response from Client B

3. **Evidence from logs**:

```
[RESPONSE] Figma → MCP (client-1761652353702-wyimgmrma): {
  success: false, error: 'Node not found: 992:8989'
}
[RESPONSE] Figma → MCP (client-1761652334223-0jadv2dpf): {
  success: true, data: { nodeId: '992:8989', ... }
}
```

Both responses are for the SAME request, but with different results!

#### Impact

- Node creation succeeds but appears to fail
- Styling operations randomly succeed/fail depending on which instance responds first
- Node registry is correctly populated, but IDs don't match across instances
- System is non-deterministic

#### Solutions

**Option 1: Session Affinity (Recommended)**

- Assign each MCP connection to a SPECIFIC Figma instance
- Route all commands from one MCP session to the same Figma instance
- Requires WebSocket server modification to track client-to-instance mapping

**Option 2: Single Instance Enforcement**

- Only allow ONE Figma plugin instance to connect
- Reject additional connection attempts
- Simpler but less flexible

**Option 3: Response Aggregation**

- Wait for ALL responses before returning
- Choose the successful response
- More complex, adds latency

#### Recommended Fix: Session Affinity

Modify `websocket-server/server.js` to:

1. Track which MCP client is paired with which Figma instance
2. On connection, assign MCP → Figma pairing
3. Route requests only to the paired Figma instance
4. Handle disconnections gracefully

---
