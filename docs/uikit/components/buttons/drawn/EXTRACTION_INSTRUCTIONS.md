# NEW_BATCH Property Extraction Instructions

## Overview

This document provides instructions for extracting complete properties from the 6 drawn components in the NEW_BATCH.

## Drawn Components (NEW_BATCH)

The following 6 components need property extraction:

1. **ghost disabled_Drawn_Iter1** (NodeID: 993:9366)
2. **ghost_Drawn_Iter1** (NodeID: 993:9370)
3. **primary disabled_Drawn_Iter1** (NodeID: 993:9373)
4. **primary_Drawn_Iter1** (NodeID: 993:9375)
5. **secondary disabled_Drawn_Iter1** (NodeID: 993:9377)
6. **secondary_Drawn_Iter1** (NodeID: 993:9379)

## Prerequisites

1. **WebSocket Server Running**

   ```bash
   cd /Users/Spare/Documents/code/text-to-figma
   npm run start:websocket
   ```

2. **Figma Plugin Installed and Running**
   - Open Figma
   - Load the text-to-figma plugin
   - Ensure plugin is connected to WebSocket server

3. **Nodes Selected in Figma**
   - In Figma, hold Shift and click all 6 drawn components listed above
   - Verify all 6 are highlighted in the layers panel

## Extraction Process

### Step 1: Start WebSocket Server

```bash
cd /Users/Spare/Documents/code/text-to-figma
npm run start:websocket
```

### Step 2: Select Components in Figma

1. Open Figma and navigate to the page containing the drawn components
2. Use Cmd+F (Mac) or Ctrl+F (Windows) to search for: `ghost disabled_Drawn_Iter1`
3. Hold Shift and select all 6 components:
   - ghost disabled_Drawn_Iter1
   - ghost_Drawn_Iter1
   - primary disabled_Drawn_Iter1
   - primary_Drawn_Iter1
   - secondary disabled_Drawn_Iter1
   - secondary_Drawn_Iter1

### Step 3: Run Extraction Script

```bash
cd /Users/Spare/Documents/code/text-to-figma
node extract-new-batch.js
```

## Expected Output

### Success Output

```
[Extraction Agent] NEW_BATCH Property Extraction

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[✓] EXTRACTION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Timestamp: 2025-10-28T...
Expected components: 6
Successfully extracted: 6
Errors: 0
Output file: /Users/Spare/Documents/code/text-to-figma/docs/uikit/components/buttons/drawn/iteration_1.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Output Files

1. **iteration_1.json** - Complete property extraction
   - Location: `docs/uikit/components/buttons/drawn/iteration_1.json`
   - Structure:
     ```json
     {
       "timestamp": "ISO 8601",
       "iteration": 1,
       "components": [
         {
           "nodeId": "993:9366",
           "name": "ghost disabled_Drawn_Iter1",
           "type": "FRAME",
           "bounds": { "x": ..., "y": ..., "width": ..., "height": ... },
           "fills": [...],
           "strokes": [...],
           "effects": [],
           "cornerRadius": 50,
           "opacity": 1,
           "visible": true,
           "locked": false,
           "blendMode": "NORMAL",
           "layout": {
             "mode": "HORIZONTAL",
             "padding": { "top": 10, "right": 10, "bottom": 10, "left": 10 },
             "itemSpacing": 10,
             "primaryAxisSizingMode": "AUTO",
             "counterAxisSizingMode": "AUTO",
             "primaryAxisAlignItems": "CENTER",
             "counterAxisAlignItems": "CENTER"
           },
           "children": [...]
         },
         ...
       ]
     }
     ```

2. **extraction_errors_iteration_1.json** (only if errors occur)
   - Location: `docs/uikit/components/buttons/drawn/extraction_errors_iteration_1.json`
   - Contains details of any extraction failures

## Properties Extracted

The extraction script captures ALL properties from each component, matching the structure of `originals/iteration_1.json`:

### Node Level Properties

- `nodeId` - Figma node ID
- `name` - Node name
- `type` - Node type (FRAME, TEXT, RECTANGLE, etc.)
- `bounds` - Position and dimensions (x, y, width, height)
- `opacity` - Node opacity (0-1)
- `visible` - Visibility flag
- `locked` - Lock status
- `blendMode` - Blend mode (NORMAL, MULTIPLY, etc.)

### Visual Properties

- `fills` - Array of fill paints with:
  - type, color, opacity, visible, blendMode, boundVariables
- `strokes` - Array of stroke paints with:
  - type, color, opacity, visible, blendMode, boundVariables
  - strokeWeight, strokeAlign
- `effects` - Array of effects (shadows, blur)
- `cornerRadius` - Corner radius (number or object)

### Layout Properties (for FRAME nodes)

- `layout.mode` - Layout mode (HORIZONTAL, VERTICAL, NONE)
- `layout.padding` - Padding (top, right, bottom, left)
- `layout.itemSpacing` - Spacing between children
- `layout.primaryAxisSizingMode` - Primary axis sizing
- `layout.counterAxisSizingMode` - Counter axis sizing
- `layout.primaryAxisAlignItems` - Primary axis alignment
- `layout.counterAxisAlignItems` - Counter axis alignment

### Typography Properties (for TEXT nodes)

- `typography.fontSize` - Font size
- `typography.fontName` - Font family and style
- `typography.fontWeight` - Font weight
- `typography.textAlignHorizontal` - Horizontal text alignment
- `typography.textAlignVertical` - Vertical text alignment
- `typography.lineHeight` - Line height
- `typography.letterSpacing` - Letter spacing
- `typography.textCase` - Text case transformation
- `typography.textDecoration` - Text decoration
- `characters` - Text content

### Children

- `children` - Array of child nodes (recursive, same structure)

## Troubleshooting

### Error: "No nodes selected in Figma"

**Solution**: Make sure all 6 components are selected in Figma before running the script.

### Error: "Request timeout"

**Solution**:

1. Check WebSocket server is running
2. Verify Figma plugin is loaded and connected
3. Try restarting both the WebSocket server and Figma

### Error: "WebSocket connection failed"

**Solution**:

1. Start WebSocket server: `npm run start:websocket`
2. Check port 8080 is not in use
3. Verify firewall settings allow WebSocket connections

### Wrong Number of Components Extracted

**Solution**:

1. Clear Figma selection
2. Search for each component by name using Cmd+F
3. Hold Shift and click each component to add to selection
4. Verify layers panel shows 6 selected items
5. Run extraction script again

## Verification

After extraction, verify the output:

1. **Check File Exists**

   ```bash
   ls -lh docs/uikit/components/buttons/drawn/iteration_1.json
   ```

2. **Check Component Count**

   ```bash
   cat docs/uikit/components/buttons/drawn/iteration_1.json | grep -c '"nodeId"'
   ```

   Should output: 9 (6 root components + 3 total children)

3. **Verify Structure**
   ```bash
   cat docs/uikit/components/buttons/drawn/iteration_1.json | jq '.components[0] | keys'
   ```
   Should show: nodeId, name, type, bounds, fills, strokes, effects, cornerRadius, opacity, visible, locked, blendMode, layout, children

## Next Steps

After successful extraction:

1. Compare extracted properties with originals
2. Generate comparison report
3. Calculate fidelity scores
4. Identify any discrepancies
