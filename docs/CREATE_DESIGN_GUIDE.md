# Batch Hierarchy Creation with `create_design`

## Overview

The `create_design` command solves the fundamental node coordination problem in Text-to-Figma by creating **entire design hierarchies in a single atomic operation**.

## The Problem It Solves

### Before: Sequential Command Coordination

```javascript
// ❌ OLD APPROACH - Fragile and error-prone
create_frame({ name: 'Modal' }); // → returns ID "123"
set_fills({ nodeId: '123', color: '#FFF' }); // ❌ Node not found!
create_text({ parentId: '123', content: 'Title' }); // ❌ Parent not found!
```

**Issues:**

- Race conditions between commands
- Parent node lookup failures
- Cache coordination complexity
- N round-trips to Figma
- Partial failures leave broken hierarchy

### After: Batch Hierarchy Creation

```javascript
// ✅ NEW APPROACH - Robust and atomic
create_design({
  spec: {
    type: 'frame',
    name: 'Modal',
    props: { fillColor: '#FFF' },
    children: [{ type: 'text', name: 'Title', props: { content: 'Hello' } }]
  }
}); // → All nodes created in single execution
```

**Benefits:**

- ✅ Single atomic operation
- ✅ All nodes created together
- ✅ Proper parent-child relationships guaranteed
- ✅ 1 round-trip instead of N
- ✅ All succeed or all fail

## Specification Format

```typescript
{
  type: 'frame' | 'text' | 'ellipse' | 'rectangle' | 'line',
  name?: string,
  props?: {
    // Dimensions
    width?: number,
    height?: number,
    x?: number,
    y?: number,

    // Layout (frame only)
    layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE',
    itemSpacing?: number,
    padding?: number,
    horizontalSizing?: 'FILL' | 'HUG' | 'FIXED',
    verticalSizing?: 'FILL' | 'HUG' | 'FIXED',

    // Fills
    fillColor?: string,  // Hex color
    fillOpacity?: number,

    // Stroke
    strokeColor?: string,
    strokeWeight?: number,
    strokeAlign?: 'INSIDE' | 'OUTSIDE' | 'CENTER',

    // Effects
    effects?: [...],
    cornerRadius?: number,

    // Text (text nodes only)
    content?: string,
    fontSize?: number,
    fontFamily?: string,
    fontWeight?: number,
    color?: string,
    textAlign?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED'
  },
  children?: [...]  // Nested node specs (frames only)
}
```

## Usage Examples

### Simple Button

```javascript
create_design({
  spec: {
    type: 'frame',
    name: 'Button',
    props: {
      height: 44,
      layoutMode: 'HORIZONTAL',
      padding: 16,
      fillColor: '#0066FF',
      cornerRadius: 8
    },
    children: [
      {
        type: 'text',
        name: 'Label',
        props: {
          content: 'Click Me',
          fontSize: 16,
          fontWeight: 600,
          color: '#FFFFFF'
        }
      }
    ]
  }
});
```

### Card with Multiple Sections

```javascript
create_design({
  spec: {
    type: 'frame',
    name: 'Product Card',
    props: {
      width: 300,
      layoutMode: 'VERTICAL',
      itemSpacing: 16,
      padding: 20,
      fillColor: '#FFFFFF',
      cornerRadius: 12,
      effects: [{ type: 'DROP_SHADOW', x: 0, y: 2, blur: 8, opacity: 0.1 }]
    },
    children: [
      {
        type: 'rectangle',
        name: 'Image',
        props: {
          height: 180,
          horizontalSizing: 'FILL',
          fillColor: '#E0E0E0',
          cornerRadius: 8
        }
      },
      {
        type: 'text',
        name: 'Title',
        props: {
          content: 'Product Name',
          fontSize: 18,
          fontWeight: 700
        }
      },
      {
        type: 'text',
        name: 'Description',
        props: {
          content: 'Product description goes here',
          fontSize: 14,
          color: '#666666'
        }
      },
      {
        type: 'frame',
        name: 'Price Row',
        props: {
          layoutMode: 'HORIZONTAL',
          itemSpacing: 8,
          horizontalSizing: 'FILL'
        },
        children: [
          {
            type: 'text',
            name: 'Price',
            props: { content: '$99', fontSize: 20, fontWeight: 700 }
          },
          {
            type: 'text',
            name: 'Old Price',
            props: { content: '$149', fontSize: 16, color: '#999999' }
          }
        ]
      }
    ]
  }
});
```

### Complex Login Modal

See `test-create-design.js` for a complete example with:

- Modal container with shadow
- Title and subtitle
- Email input field with label
- Password input field with label
- Primary action button
- Social login buttons

## Return Value

```javascript
{
  success: true,
  rootNodeId: '10112:44211',
  nodeIds: {
    'Login Modal': '10112:44211',
    'Title': '10112:44212',
    'Subtitle': '10112:44213',
    'Email Input Container': '10112:44214',
    // ... all node IDs
  },
  totalNodes: 17,
  message: 'Design created successfully with 17 nodes'
}
```

## When to Use

### Use `create_design` for:

- ✅ Any multi-level hierarchy (3+ nodes)
- ✅ Forms with inputs and labels
- ✅ Cards with sections
- ✅ Navigation bars
- ✅ Modals and dialogs
- ✅ Complex components

### Use individual commands for:

- ⚠️ Single node creation
- ⚠️ Updating existing nodes
- ⚠️ Quick prototypes

## Testing

1. **Reload Figma plugin**: Plugins → Development → Reload
2. **Run test script**:
   ```bash
   node test-create-design.js
   ```
3. **Check Figma**: Login modal should appear with proper hierarchy

## Architecture

### Flow

1. MCP server receives `create_design` request
2. Sends complete spec to Figma plugin via WebSocket
3. Plugin creates nodes **depth-first** recursively
4. Maintains local `nodeMap` for references
5. Returns map of `{name → id}` to MCP server

### Key Implementation Details

- **Atomic**: All nodes created in single execution context
- **Depth-first**: Children created immediately after parent
- **Object references**: Uses actual node objects, not string IDs
- **Cache integrated**: All nodes cached for subsequent commands
- **Error handling**: Operation fails if any node creation fails

## Migration Guide

### Old Pattern

```javascript
const frame = await createFrame({ name: 'Card' });
await setFills({ nodeId: frame.frameId, color: '#FFF' });
const text = await createText({
  parentId: frame.frameId,
  content: 'Title'
});
```

### New Pattern

```javascript
await createDesign({
  spec: {
    type: 'frame',
    name: 'Card',
    props: { fillColor: '#FFF' },
    children: [{ type: 'text', name: 'Title', props: { content: 'Title' } }]
  }
});
```

## Performance

- **Before**: 17 commands × ~50ms latency = **850ms+**
- **After**: 1 command × ~50ms latency = **~50ms**

**17x faster** for typical login modal!
