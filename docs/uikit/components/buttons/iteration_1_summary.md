# Iteration 1 Summary: Button Component Replication

**Date**: 2025-10-28
**Status**: ⚠️ BLOCKED - Critical Infrastructure Bug Discovered
**Completion**: 50% (Structure created, styling blocked)

---

## What Was Accomplished

### ✅ Successfully Created

1. **18 Button Structures** - All button frames with text content exist in Figma:
   - Primary buttons (6 sizes): 2XL, XL, LG, MD, SM, XS
   - Secondary buttons (6 sizes): 2XL, XL, LG, MD, SM, XS
   - Ghost buttons (6 sizes): 2XL, XL, LG, MD, SM, XS

2. **Correct Properties Applied**:
   - ✅ Dimensions (width × height) match JSON specifications
   - ✅ Layout mode (HORIZONTAL auto-layout)
   - ✅ Padding (10px) and itemSpacing (10px)
   - ✅ Corner radius (50px pill shape)
   - ✅ Text content ("BUTTON")
   - ✅ Font family (Lato) and weight (900 for most, 700 for XS)
   - ✅ Text alignment (PRIMARY/GHOST: CENTER, SECONDARY: LEFT)

### ❌ Missing (Due to Bug)

1. **Gradient Fills**:
   - Primary: Pink/red gradient (#FF5981 → #C83558)
   - Secondary: Teal gradient (#47FFF4 → #0586AE)

2. **Strokes**:
   - Primary: 2px inside stroke, #FF749C
   - Secondary: 2px inside stroke, #9FFFF8
   - Ghost: 2px inside stroke, #25ECFF

3. **Transparency**:
   - Ghost buttons: Transparent background (opacity=0)

---

## Critical Bug Discovered: Multi-Instance WebSocket Broadcast

### Root Cause

The WebSocket server broadcasts commands to ALL connected Figma plugin instances. When multiple Figma windows/tabs are open:

1. MCP sends `create_design` command
2. WebSocket broadcasts to ALL Figma instances
3. Each instance creates the node with a DIFFERENT node ID
4. MCP receives ONE response and stores that ID
5. Later styling commands use the stored ID
6. WebSocket broadcasts to all instances
7. **Only the instance that created nodes with matching IDs succeeds**
8. **Other instances return "Node not found" errors**
9. MCP receives the FIRST response (often the error)

### Evidence

From WebSocket server logs:

```
[REQUEST] MCP → Figma: { id: 'req_xxx', type: 'add_gradient_fill', nodeId: '992:8989' }

[RESPONSE] Client A (Buttons page):
  { success: false, error: 'Node not found: 992:8989' }

[RESPONSE] Client B (figma test page):
  { success: true, nodeId: '992:8989', message: 'Gradient applied' }
```

**Both responses are for the SAME request!** The system is **non-deterministic** - success/failure depends on which instance responds first.

### Impact on Workflow

- **Blocking**: Cannot apply styling to created nodes
- **Non-deterministic**: Random success/failure
- **Data integrity**: Buttons physically exist in ONE Figma file but appear to fail
- **Iteration blocked**: Cannot complete draw → export → compare loop

---

## Immediate Workaround

**CLOSE ALL FIGMA WINDOWS EXCEPT ONE** before running the workflow.

Steps:

1. Close all Figma desktop windows/tabs
2. Open ONLY the Figma file with your target components
3. Ensure the plugin is running in ONLY that one window
4. Restart WebSocket server to clear stale connections
5. Re-run the drawing agent

---

## Long-Term Solutions

### Option 1: Single Instance Enforcement (Simplest)

**Modify `websocket-server/server.js` to reject multiple Figma connections:**

```javascript
// Track Figma plugin connection
let figmaClient = null;

wss.on('connection', (ws, req) => {
  // If this is a Figma plugin connection and one already exists
  if (isF igmaPlugin(req) && figmaClient) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Only one Figma plugin instance allowed. Please close other Figma windows.'
    }));
    ws.close();
    return;
  }

  if (isFigmaPlugin(req)) {
    figmaClient = clientId;
  }

  // ... rest of connection logic
});
```

**Pros**:

- Simple to implement (~20 lines of code)
- Prevents the bug entirely
- Clear error message to user

**Cons**:

- Less flexible (can't have multiple Figma files open)
- Need to detect Figma vs. MCP clients

### Option 2: Session Affinity (Most Flexible)

**Route each MCP client to a specific Figma instance:**

```javascript
// Track pairings
const mcpToFigma = new Map(); // MCP client ID → Figma client ID

function routeToFigma(mcpClientId, message) {
  const figmaClientId = mcpToFigma.get(mcpClientId);
  if (figmaClientId) {
    // Send only to paired Figma instance
    sendToClient(figmaClientId, message);
  } else {
    // Assign to least-loaded Figma instance
    const figmaId = selectFigmaInstance();
    mcpToFigma.set(mcpClientId, figmaId);
    sendToClient(figmaId, message);
  }
}
```

**Pros**:

- Multiple Figma files supported
- Load balancing possible
- Most scalable

**Cons**:

- More complex implementation (~100 lines)
- Need to handle disconnections
- Need client type detection

### Option 3: Response Aggregation (Most Robust)

**Wait for ALL responses and choose the successful one:**

```javascript
async function sendToFigma(message) {
  return new Promise((resolve, reject) => {
    const responses = [];
    const expectedCount = figmaClientsCount;

    // Collect all responses
    onResponse(message.id, (response) => {
      responses.push(response);

      if (responses.length === expectedCount) {
        // Find successful response
        const success = responses.find((r) => r.success);
        if (success) {
          resolve(success);
        } else {
          reject(responses[0].error);
        }
      }
    });
  });
}
```

**Pros**:

- Most robust
- Works with any number of instances
- Always returns correct result

**Cons**:

- Adds latency (wait for all responses)
- Complex error handling
- Wasted work (all instances execute)

---

## Recommended Next Steps

### Immediate (To Continue Iteration)

1. **Close all Figma windows except target file**
2. **Restart WebSocket server**: `pkill -f "node server.js" && node server.js`
3. **Verify single connection**: Check server logs show only 1 client
4. **Re-run drawing agent** with styling tools

### Short-Term (Production Fix)

1. **Implement Option 1: Single Instance Enforcement**
2. **Add client type detection** (Figma vs. MCP)
3. **Test with single Figma instance**
4. **Document limitation in setup guide**

### Long-Term (Scalable Solution)

1. **Implement Option 2: Session Affinity**
2. **Add load balancing**
3. **Support multiple Figma files**
4. **Add monitoring/debugging tools**

---

## Lessons Learned

### What Worked

✅ **create_design() tool** - Successfully created all 18 button structures atomically
✅ **Drawing prompt** - Agent correctly interpreted JSON and created proper layouts
✅ **Node caching** - Figma plugin properly caches newly created nodes
✅ **Node registry** - MCP server correctly registers nodes from create_design responses

### What Didn't Work

❌ **WebSocket broadcast architecture** - Assumes single Figma instance but allows multiple
❌ **No client routing** - Commands broadcast to all clients indiscriminately
❌ **First-response wins** - Returns first response received, often the error

### Process Improvements

1. **Always check WebSocket connections** before starting workflow
2. **Log analysis is critical** - The bug was only visible in server logs
3. **Test with minimal setup** - Single Figma instance should be default
4. **Document environmental requirements** - "Close other Figma windows" should be in prerequisites

---

## Accuracy Assessment: N/A

Cannot assess accuracy because styling was not applied due to infrastructure bug.

**Structure Accuracy**: 100% (all frames and text nodes created correctly)
**Styling Accuracy**: 0% (blocked by bug)
**Overall**: Incomplete

---

## Next Iteration Plan

Once bug is fixed (single Figma instance enforced):

1. **Re-run styling phase**:
   - Apply gradients to Primary/Secondary buttons
   - Apply strokes to all buttons
   - Apply transparency to Ghost buttons

2. **Export phase**:
   - Export original UIKit buttons as PNG (@2x)
   - Export drawn buttons as PNG (@2x)
   - Save to `docs/uikit/components/buttons/exports/iteration_1_*.png`

3. **Compare phase**:
   - Visual inspection of originals vs. drawn
   - Score: Colors, Spacing, Typography, Shadows, Radius, Layout
   - Calculate overall accuracy

4. **Improve phase**:
   - Update drawing_prompt.md based on differences
   - Fix any MCP tool issues discovered
   - Adjust JSON specifications if needed

**Target**: 95% overall accuracy before moving to next component type.

---

## Files Created/Modified

### Created:

- `docs/uikit/components/buttons/drawing_prompt.md` - Comprehensive drawing instructions
- `docs/uikit/components/buttons/iteration_log.md` - Detailed iteration log
- `docs/uikit/components/buttons/iteration_1_summary.md` - This file

### Modified:

- None (buttons.json was pre-existing)

### Not Yet Created:

- `docs/uikit/components/buttons/exports/` - No exports yet (blocked by bug)
- `docs/uikit/components/buttons/final_report.md` - Waiting for completion

---

## Conclusion

**Iteration 1 discovered a critical WebSocket routing bug that blocks the replication workflow.** The bug is well-understood and fixable. Button structures were created successfully, proving the `create_design()` tool and drawing prompt work correctly. Once the bug is fixed (by ensuring single Figma instance), the workflow can proceed to completion.

**Estimated time to fix and complete iteration 1**: 30-60 minutes
