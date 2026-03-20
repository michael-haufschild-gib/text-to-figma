# Text-to-Figma MCP Server - User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Core Concepts](#core-concepts)
4. [Primitive Categories](#primitive-categories)
5. [Common Workflows](#common-workflows)
6. [Design System Integration](#design-system-integration)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Introduction

The Text-to-Figma MCP Server is a **primitive-first** design automation system that exposes 67+ raw Figma API primitives through the Model Context Protocol (MCP). Unlike traditional design tools that provide high-level abstractions, this system gives you direct access to Figma's building blocks, enabling Claude to compose complex designs from simple primitives.

### Philosophy: Primitive-First Design

**There is no "draw button" function.** Just like Figma itself, you must compose designs from raw primitives:

```
Button = create_frame + set_fills + create_text + apply_effects + validate_contrast
```

This approach ensures:

- **Full control** over every design aspect
- **Transparency** - you see exactly what's being created
- **Flexibility** - compose primitives in infinite ways
- **Learning** - understand how designs are constructed

---

## Getting Started

### Prerequisites

1. **Figma Desktop App** with plugin support
2. **Node.js** 18+ installed
3. **Claude Desktop** or any MCP-compatible client
4. **WebSocket Bridge** running (connects MCP server to Figma plugin)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/text-to-figma.git
cd text-to-figma/mcp-server

# Install dependencies
npm install

# Build the server
npm run build

# Start the server
npm start
```

### Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "text-to-figma": {
      "command": "node",
      "args": ["/path/to/text-to-figma/mcp-server/build/index.js"]
    }
  }
}
```

### Connecting to Figma

1. Open Figma Desktop App
2. Open your design file
3. Run the Text-to-Figma plugin (loads WebSocket bridge)
4. The MCP server will connect automatically
5. Start creating with Claude!

---

## Core Concepts

### 1. Primitives vs. Abstractions

**❌ What you WON'T find:**

```javascript
create_button({ label: 'Click me', style: 'primary' });
```

**✅ What you WILL find:**

```javascript
// 1. Create container
create_frame({ width: 120, height: 40 })

// 2. Set background color
set_fills({ nodeId: "frame-123", color: "#0066FF" })

// 3. Add text
create_text({ parentId: "frame-123", content: "Click me" })

// 4. Add shadow effect
apply_effects({ nodeId: "frame-123", effects: [...] })
```

### 2. Design System Constraints

The server enforces professional design standards:

**8pt Grid System:**

```
Valid: 0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128
Invalid: 5, 13, 25, 37
```

**Modular Type Scale:**

```
Valid: 12, 16, 20, 24, 32, 40, 48, 64
Invalid: 14, 18, 22, 28
```

**WCAG Contrast Ratios:**

```
AA Normal Text: 4.5:1 minimum
AA Large Text: 3.0:1 minimum
AAA Normal Text: 7.0:1 minimum
```

### 3. Node IDs

Every Figma element has a unique ID. You'll use these IDs to reference and modify nodes:

```javascript
// Create a frame
const result = create_frame({ name: 'Container', width: 200, height: 100 });
// Returns: { frameId: "123:456", ... }

// Modify it later
set_fills({ nodeId: '123:456', color: '#FF0000' });
```

### 4. CSS Equivalents

Most primitives include CSS equivalents for learning and reference:

```javascript
set_corner_radius({ nodeId: 'card-123', radius: 8 });
// CSS: border-radius: 8px;

set_opacity({ nodeId: 'overlay-456', opacity: 0.5 });
// CSS: opacity: 0.5;
```

---

## Primitive Categories

### Shape Primitives

Create basic geometric shapes:

```javascript
// Rectangle/Frame
create_frame({
  name: 'Card',
  width: 320,
  height: 200,
  x: 0,
  y: 0
});

// Circle/Ellipse
create_ellipse({
  name: 'Avatar',
  width: 48,
  height: 48
});

// Line
create_line({
  name: 'Divider',
  x1: 0,
  y1: 0,
  x2: 200,
  y2: 0
});

// Polygon (3-100 sides)
create_polygon({
  name: 'Triangle',
  pointCount: 3,
  radius: 50
});

// Star
create_star({
  name: 'Rating Icon',
  pointCount: 5,
  radius: 24,
  innerRadiusRatio: 0.5
});
```

### Text Primitives

Create and style text:

```javascript
// Create text
create_text({
  content: 'Hello World',
  fontSize: 24,
  fontWeight: 600,
  lineHeight: 32
});

// Typography styling
set_text_decoration({ nodeId: 'text-123', decoration: 'UNDERLINE' });
set_letter_spacing({ nodeId: 'text-123', value: 0.5, unit: 'PIXELS' });
set_text_case({ nodeId: 'text-123', textCase: 'UPPER' });
set_paragraph_spacing({ nodeId: 'text-123', spacing: 16, indent: 0 });
```

### Fill Primitives

Apply colors, gradients, and images:

```javascript
// Solid color
set_fills({
  nodeId: 'button-123',
  color: '#0066FF'
});

// Linear gradient
add_gradient_fill({
  nodeId: 'header-456',
  type: 'LINEAR',
  stops: [
    { position: 0, color: '#FF0000' },
    { position: 1, color: '#0000FF' }
  ]
});

// Image fill
set_image_fill({
  nodeId: 'banner-789',
  imageUrl: 'https://example.com/image.jpg',
  scaleMode: 'FILL'
});
```

### Styling Primitives

Add visual polish:

```javascript
// Corner radius
set_corner_radius({
  nodeId: 'card-123',
  radius: 12 // Uniform
});

set_corner_radius({
  nodeId: 'card-456',
  topLeft: 8,
  topRight: 8,
  bottomLeft: 0,
  bottomRight: 0
});

// Strokes/Borders
set_stroke({
  nodeId: 'input-789',
  color: '#CCCCCC',
  weight: 1,
  align: 'INSIDE'
});

set_stroke_join({ nodeId: 'shape-123', strokeJoin: 'ROUND' });
set_stroke_cap({ nodeId: 'line-456', strokeCap: 'ROUND' });

// Opacity & Blend modes
set_opacity({ nodeId: 'overlay-123', opacity: 0.8 });
set_blend_mode({ nodeId: 'layer-456', blendMode: 'MULTIPLY' });
```

### Transform Primitives

Position, rotate, and scale:

```javascript
// Position
set_absolute_position({
  nodeId: 'button-123',
  x: 100,
  y: 200
});

// Rotation
set_rotation({
  nodeId: 'icon-456',
  rotation: 45 // degrees
});

// Scale
set_scale({
  nodeId: 'image-789',
  scaleX: 1.5,
  scaleY: 1.5
});

// Size
set_size({
  nodeId: 'card-123',
  width: 320,
  height: 240
});

// Flip
flip_node({
  nodeId: 'arrow-456',
  direction: 'HORIZONTAL'
});
```

### Layout Primitives

Auto-layout (Flexbox-like):

```javascript
// Configure auto-layout
set_layout_properties({
  nodeId: 'container-123',
  layoutMode: 'HORIZONTAL',
  itemSpacing: 16,
  paddingLeft: 24,
  paddingRight: 24,
  paddingTop: 16,
  paddingBottom: 16
});

// Layout sizing (Fixed/Hug/Fill)
set_layout_sizing({
  nodeId: 'button-456',
  horizontal: 'HUG', // Shrink-wrap content
  vertical: 'FIXED' // Fixed height
});

// Layout alignment
set_layout_align({
  nodeId: 'navbar-789',
  primaryAxis: 'SPACE_BETWEEN', // justify-content
  counterAxis: 'CENTER' // align-items
});

// Layout grids
add_layout_grid({
  nodeId: 'page-123',
  pattern: 'COLUMNS',
  count: 12,
  gutter: 20,
  margin: 40
});
```

### Effect Primitives

Shadows and blur:

```javascript
apply_effects({
  nodeId: 'card-123',
  effects: [
    {
      type: 'DROP_SHADOW',
      color: '#00000033',
      offsetX: 0,
      offsetY: 4,
      blur: 12,
      spread: 0
    },
    {
      type: 'LAYER_BLUR',
      blur: 8
    }
  ]
});
```

### Component Primitives

Reusable components:

```javascript
// Create component
create_component({
  nodeId: 'button-frame-123',
  name: 'Button/Primary',
  description: 'Primary action button'
});

// Create instance
create_instance({
  componentId: 'component-456',
  name: 'Login Button',
  x: 100,
  y: 200
});

// Swap instance
set_instance_swap({
  instanceId: 'instance-789',
  newComponentId: 'component-large-012'
});

// Component sets (variants)
create_component_set({
  componentIds: ['btn-small-123', 'btn-medium-456', 'btn-large-789'],
  name: 'Button'
});

add_variant_property({
  componentSetId: 'set-123',
  propertyName: 'State',
  values: ['Default', 'Hover', 'Active', 'Disabled']
});

// Set component properties
set_component_properties({
  componentId: 'button-123',
  properties: {
    exposedTextProperty: 'label',
    exposedFillProperty: 'background'
  }
});
```

### Style System Primitives

Reusable styles:

```javascript
// Color styles
create_color_style({
  name: 'Primary/600',
  color: '#0066FF',
  description: 'Primary brand color'
});

apply_fill_style({
  nodeId: 'button-123',
  styleName: 'Primary/600'
});

// Text styles
create_text_style({
  name: 'Heading/H1',
  fontFamily: 'Inter',
  fontSize: 48,
  fontWeight: 700,
  lineHeight: 56,
  letterSpacing: -0.5
});

apply_text_style({
  nodeId: 'text-456',
  styleName: 'Heading/H1'
});

// Effect styles
create_effect_style({
  name: 'Shadow/Card',
  effects: [
    {
      type: 'DROP_SHADOW',
      color: '#00000014',
      offsetX: 0,
      offsetY: 4,
      blur: 12
    }
  ]
});

apply_effect_style({
  nodeId: 'card-789',
  styleName: 'Shadow/Card'
});
```

### Boolean Operations

Combine shapes:

```javascript
create_boolean_operation({
  nodeIds: ['circle-123', 'circle-456'],
  operation: 'UNION', // Also: SUBTRACT, INTERSECT, EXCLUDE
  name: 'Combined Shape'
});
```

### Clipping & Masking

```javascript
set_clipping_mask({
  nodeId: 'frame-123',
  enabled: true,
  useMask: false // false = clip to bounds, true = use first child as mask
});
```

### Export Primitives

Asset generation:

```javascript
// Configure export settings
set_export_settings({
  nodeId: 'icon-123',
  settings: [
    { format: 'PNG', scale: 1, suffix: '' },
    { format: 'PNG', scale: 2, suffix: '@2x' },
    { format: 'SVG', scale: 1, suffix: '' }
  ]
});

// Export node
export_node({
  nodeId: 'card-456',
  format: 'PNG',
  scale: 2,
  returnBase64: true
});
```

### Node Navigation

Tree traversal:

```javascript
// Get node by ID
get_node_by_id({
  nodeId: '123:456'
});

// Find nodes by name
get_node_by_name({
  name: 'Button',
  findAll: true,
  recursive: true
});

// Get children
get_children({
  nodeId: 'frame-123',
  recursive: false // false = direct children, true = all descendants
});

// Get parent
get_parent({
  nodeId: 'text-456'
});

// Get absolute bounds
get_absolute_bounds({
  nodeId: 'card-789'
});
```

### Plugin Data

Store custom metadata:

```javascript
// Store data
set_plugin_data({
  nodeId: 'button-123',
  key: 'componentVersion',
  value: '2.1.0'
});

// Retrieve data
get_plugin_data({
  nodeId: 'button-123',
  key: 'componentVersion'
});
```

### Page Management

Multi-page documents:

```javascript
// Create new page
create_page({
  name: 'User Flow - Onboarding'
});

// List all pages
list_pages({});

// Switch to page
set_current_page({
  pageId: 'page-123'
});
```

### Node Management

Visibility and locking:

```javascript
// Show/hide
set_visible({
  nodeId: 'layer-123',
  visible: false
});

// Lock/unlock
set_locked({
  nodeId: 'background-456',
  locked: true
});
```

### Constraints

Responsive behavior:

```javascript
set_constraints({
  nodeId: 'button-123',
  horizontal: 'CENTER', // LEFT, RIGHT, CENTER, STRETCH, SCALE
  vertical: 'TOP' // TOP, BOTTOM, CENTER, STRETCH, SCALE
});
```

### Validation Primitives

Design system compliance:

```javascript
// Validate design tokens
validate_design_tokens({
  spacing: [16, 24, 32], // 8pt grid
  fontSizes: [16, 20, 24], // Type scale
  colors: [{ foreground: '#000000', background: '#FFFFFF' }]
});

// Check WCAG contrast
check_wcag_contrast({
  foreground: '#0066FF',
  background: '#FFFFFF',
  fontSize: 16,
  fontWeight: 400
});
```

---

## Common Workflows

### Workflow 1: Create a Button

```javascript
// 1. Create container
const frame = create_frame({
  name: 'Button',
  width: 120,
  height: 40
});

// 2. Configure auto-layout
set_layout_properties({
  nodeId: frame.frameId,
  layoutMode: 'HORIZONTAL',
  itemSpacing: 8,
  paddingLeft: 24,
  paddingRight: 24,
  paddingTop: 12,
  paddingBottom: 12
});

// 3. Set background color
set_fills({
  nodeId: frame.frameId,
  color: '#0066FF'
});

// 4. Add corner radius
set_corner_radius({
  nodeId: frame.frameId,
  radius: 8
});

// 5. Create text
const text = create_text({
  parentId: frame.frameId,
  content: 'Click Me',
  fontSize: 16,
  fontWeight: 600
});

// 6. Set text color
set_fills({
  nodeId: text.textId,
  color: '#FFFFFF'
});

// 7. Add drop shadow
apply_effects({
  nodeId: frame.frameId,
  effects: [
    {
      type: 'DROP_SHADOW',
      color: '#00000033',
      offsetX: 0,
      offsetY: 2,
      blur: 8
    }
  ]
});

// 8. Validate contrast
check_wcag_contrast({
  foreground: '#FFFFFF',
  background: '#0066FF',
  fontSize: 16,
  fontWeight: 600
});

// 9. Convert to component
create_component({
  nodeId: frame.frameId,
  name: 'Button/Primary'
});
```

### Workflow 2: Create a Card Layout

```javascript
// 1. Create card frame
const card = create_frame({
  name: 'Card',
  width: 320,
  height: 400
});

// 2. Configure vertical auto-layout
set_layout_properties({
  nodeId: card.frameId,
  layoutMode: 'VERTICAL',
  itemSpacing: 16,
  paddingLeft: 24,
  paddingRight: 24,
  paddingTop: 24,
  paddingBottom: 24
});

// 3. Style card
set_fills({
  nodeId: card.frameId,
  color: '#FFFFFF'
});

set_corner_radius({
  nodeId: card.frameId,
  radius: 12
});

apply_effects({
  nodeId: card.frameId,
  effects: [
    {
      type: 'DROP_SHADOW',
      color: '#00000014',
      offsetX: 0,
      offsetY: 4,
      blur: 12
    }
  ]
});

// 4. Add image
const image = create_frame({
  name: 'Image',
  width: 272,
  height: 180,
  parentId: card.frameId
});

set_image_fill({
  nodeId: image.frameId,
  imageUrl: 'https://example.com/image.jpg',
  scaleMode: 'FILL'
});

set_corner_radius({
  nodeId: image.frameId,
  radius: 8
});

// 5. Add title
const title = create_text({
  parentId: card.frameId,
  content: 'Card Title',
  fontSize: 24,
  fontWeight: 700,
  lineHeight: 32
});

// 6. Add description
const description = create_text({
  parentId: card.frameId,
  content: 'Card description goes here with more details about the content.',
  fontSize: 16,
  lineHeight: 24
});

set_size({
  nodeId: description.textId,
  width: 272
});

// 7. Create button inside card
// ... (use button workflow from above)
```

### Workflow 3: Create a Navigation Bar

```javascript
// 1. Create navbar container
const navbar = create_frame({
  name: 'Navbar',
  width: 1200,
  height: 64
});

// 2. Configure horizontal layout with space-between
set_layout_properties({
  nodeId: navbar.frameId,
  layoutMode: 'HORIZONTAL',
  itemSpacing: 0,
  paddingLeft: 40,
  paddingRight: 40
});

set_layout_align({
  nodeId: navbar.frameId,
  primaryAxis: 'SPACE_BETWEEN',
  counterAxis: 'CENTER'
});

set_fills({
  nodeId: navbar.frameId,
  color: '#FFFFFF'
});

// 3. Add logo (left side)
const logo = create_text({
  parentId: navbar.frameId,
  content: 'Logo',
  fontSize: 24,
  fontWeight: 700
});

// 4. Create navigation links container (right side)
const navLinks = create_frame({
  name: 'Nav Links',
  parentId: navbar.frameId
});

set_layout_properties({
  nodeId: navLinks.frameId,
  layoutMode: 'HORIZONTAL',
  itemSpacing: 32
});

set_layout_sizing({
  nodeId: navLinks.frameId,
  horizontal: 'HUG',
  vertical: 'HUG'
});

// 5. Add navigation links
const links = ['Home', 'About', 'Services', 'Contact'];
for (const linkText of links) {
  const link = create_text({
    parentId: navLinks.frameId,
    content: linkText,
    fontSize: 16,
    fontWeight: 500
  });
}

// 6. Add bottom border
set_stroke({
  nodeId: navbar.frameId,
  color: '#E5E5E5',
  weight: 1,
  align: 'INSIDE'
});
```

### Workflow 4: Create Component Variants

```javascript
// 1. Create button components in different sizes
const sizes = [
  { name: 'Button/Small', width: 80, height: 32, fontSize: 14, padding: 16 },
  { name: 'Button/Medium', width: 120, height: 40, fontSize: 16, padding: 24 },
  { name: 'Button/Large', width: 160, height: 48, fontSize: 18, padding: 32 }
];

const componentIds = [];

for (const size of sizes) {
  // Create frame
  const frame = create_frame({
    name: size.name,
    width: size.width,
    height: size.height
  });

  // Configure layout
  set_layout_properties({
    nodeId: frame.frameId,
    layoutMode: 'HORIZONTAL',
    itemSpacing: 8,
    paddingLeft: size.padding,
    paddingRight: size.padding
  });

  // Style
  set_fills({ nodeId: frame.frameId, color: '#0066FF' });
  set_corner_radius({ nodeId: frame.frameId, radius: 8 });

  // Add text
  const text = create_text({
    parentId: frame.frameId,
    content: 'Button',
    fontSize: size.fontSize,
    fontWeight: 600
  });

  set_fills({ nodeId: text.textId, color: '#FFFFFF' });

  // Convert to component
  const component = create_component({
    nodeId: frame.frameId,
    name: size.name
  });

  componentIds.push(component.componentId);
}

// 2. Create component set (combine variants)
const componentSet = create_component_set({
  componentIds: componentIds,
  name: 'Button'
});

// 3. Add variant properties
add_variant_property({
  componentSetId: componentSet.componentSetId,
  propertyName: 'Size',
  values: ['Small', 'Medium', 'Large']
});

add_variant_property({
  componentSetId: componentSet.componentSetId,
  propertyName: 'State',
  values: ['Default', 'Hover', 'Active', 'Disabled']
});
```

### Workflow 5: Create Design System Styles

```javascript
// 1. Define color palette
const colors = [
  { name: 'Primary/600', hex: '#0066FF' },
  { name: 'Primary/700', hex: '#0052CC' },
  { name: 'Secondary/600', hex: '#6B7280' },
  { name: 'Success/600', hex: '#10B981' },
  { name: 'Error/600', hex: '#EF4444' },
  { name: 'Neutral/50', hex: '#F9FAFB' },
  { name: 'Neutral/900', hex: '#111827' }
];

for (const color of colors) {
  create_color_style({
    name: color.name,
    color: color.hex
  });
}

// 2. Define text styles
const textStyles = [
  { name: 'Display/Large', size: 48, weight: 700, lineHeight: 56 },
  { name: 'Heading/H1', size: 32, weight: 700, lineHeight: 40 },
  { name: 'Heading/H2', size: 24, weight: 700, lineHeight: 32 },
  { name: 'Body/Large', size: 16, weight: 400, lineHeight: 24 },
  { name: 'Body/Small', size: 14, weight: 400, lineHeight: 20 },
  { name: 'Caption', size: 12, weight: 400, lineHeight: 16 }
];

for (const style of textStyles) {
  create_text_style({
    name: style.name,
    fontFamily: 'Inter',
    fontSize: style.size,
    fontWeight: style.weight,
    lineHeight: style.lineHeight
  });
}

// 3. Define effect styles
const effectStyles = [
  {
    name: 'Shadow/Small',
    effects: [{ type: 'DROP_SHADOW', color: '#00000014', offsetX: 0, offsetY: 2, blur: 4 }]
  },
  {
    name: 'Shadow/Medium',
    effects: [{ type: 'DROP_SHADOW', color: '#00000014', offsetX: 0, offsetY: 4, blur: 12 }]
  },
  {
    name: 'Shadow/Large',
    effects: [{ type: 'DROP_SHADOW', color: '#00000029', offsetX: 0, offsetY: 8, blur: 24 }]
  }
];

for (const style of effectStyles) {
  create_effect_style({
    name: style.name,
    effects: style.effects
  });
}
```

---

## Design System Integration

### Using Design Tokens

```javascript
// Define tokens
const tokens = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48
  },
  colors: {
    primary: '#0066FF',
    secondary: '#6B7280',
    success: '#10B981',
    error: '#EF4444',
    neutral: {
      50: '#F9FAFB',
      900: '#111827'
    }
  },
  typography: {
    h1: { size: 32, weight: 700, lineHeight: 40 },
    h2: { size: 24, weight: 700, lineHeight: 32 },
    body: { size: 16, weight: 400, lineHeight: 24 }
  }
};

// Validate tokens
validate_design_tokens({
  spacing: Object.values(tokens.spacing),
  fontSizes: [tokens.typography.h1.size, tokens.typography.h2.size, tokens.typography.body.size],
  colors: [
    { foreground: tokens.colors.neutral[900], background: tokens.colors.neutral[50] },
    { foreground: '#FFFFFF', background: tokens.colors.primary }
  ]
});

// Use tokens
create_frame({
  width: 320,
  height: 240,
  paddingLeft: tokens.spacing.lg,
  paddingRight: tokens.spacing.lg
});
```

### Creating Semantic Components

```javascript
// Store metadata as plugin data
const cardId = create_frame({ name: 'Card' }).frameId;

set_plugin_data({
  nodeId: cardId,
  key: 'componentType',
  value: 'card'
});

set_plugin_data({
  nodeId: cardId,
  key: 'version',
  value: '2.1.0'
});

set_plugin_data({
  nodeId: cardId,
  key: 'designTokens',
  value: JSON.stringify({
    spacing: 'lg',
    shadow: 'medium',
    borderRadius: 'md'
  })
});

// Retrieve metadata
const version = get_plugin_data({
  nodeId: cardId,
  key: 'version'
});
```

---

## Best Practices

### 1. Always Name Your Nodes

```javascript
// ✅ Good
create_frame({ name: 'Navigation Bar', width: 1200, height: 64 });

// ❌ Bad
create_frame({ width: 1200, height: 64 });
```

### 2. Use Design System Constraints

```javascript
// ✅ Good - 8pt grid
set_layout_properties({
  nodeId: 'card-123',
  itemSpacing: 16,
  paddingLeft: 24
});

// ❌ Bad - arbitrary values
set_layout_properties({
  nodeId: 'card-123',
  itemSpacing: 13,
  paddingLeft: 27
});
```

### 3. Validate Before Creating

```javascript
// Check contrast before creating
const contrast = check_wcag_contrast({
  foreground: '#0066FF',
  background: '#FFFFFF',
  fontSize: 16,
  fontWeight: 400
});

if (contrast.passes.AA.normal) {
  // Safe to create
  create_text({ content: 'Text', fontSize: 16, color: '#0066FF' });
}
```

### 4. Use Auto-Layout for Responsive Designs

```javascript
// ✅ Good - flexible layout
create_frame({ name: 'Container' });
set_layout_properties({
  layoutMode: 'VERTICAL',
  itemSpacing: 16
});

// Each child can adapt
set_layout_sizing({
  nodeId: 'child-123',
  horizontal: 'FILL',
  vertical: 'HUG'
});

// ❌ Bad - fixed positions
set_absolute_position({ nodeId: 'child-123', x: 100, y: 200 });
```

### 5. Create Components for Reusability

```javascript
// Create once
const button = create_component({
  nodeId: 'button-frame-123',
  name: 'Button/Primary'
});

// Reuse everywhere
create_instance({
  componentId: button.componentId,
  x: 100,
  y: 200
});

create_instance({
  componentId: button.componentId,
  x: 250,
  y: 200
});
```

### 6. Use Style System for Consistency

```javascript
// Define once
create_color_style({ name: 'Primary/600', color: '#0066FF' });

// Apply everywhere
apply_fill_style({ nodeId: 'button-1', styleName: 'Primary/600' });
apply_fill_style({ nodeId: 'button-2', styleName: 'Primary/600' });
apply_fill_style({ nodeId: 'link-1', styleName: 'Primary/600' });
```

### 7. Export at Multiple Scales

```javascript
set_export_settings({
  nodeId: 'icon-123',
  settings: [
    { format: 'PNG', scale: 1 },
    { format: 'PNG', scale: 2, suffix: '@2x' },
    { format: 'PNG', scale: 3, suffix: '@3x' },
    { format: 'SVG', scale: 1 }
  ]
});
```

### 8. Use Plugin Data for Metadata

```javascript
// Version tracking
set_plugin_data({
  nodeId: 'component-123',
  key: 'version',
  value: '2.1.0'
});

// Change tracking
set_plugin_data({
  nodeId: 'component-123',
  key: 'lastModified',
  value: new Date().toISOString()
});

// Custom properties
set_plugin_data({
  nodeId: 'component-123',
  key: 'githubIssue',
  value: '#1234'
});
```

---

## Troubleshooting

### Connection Issues

**Problem:** "Not connected to Figma"

**Solutions:**

1. Ensure Figma Desktop App is running
2. Check that the Text-to-Figma plugin is active
3. Verify WebSocket bridge is running (default port 8765)
4. Restart the MCP server
5. Check for firewall blocking WebSocket connections

### Invalid Node IDs

**Problem:** "Node not found" or "Invalid node ID"

**Solutions:**

1. Verify the node ID is correct
2. Check if the node was deleted
3. Use `get_node_by_name()` to find nodes
4. Store node IDs after creation for later reference

### Design Constraint Violations

**Problem:** Validation errors for spacing/typography

**Solutions:**

1. Use the allowed values from the design system
2. Call `validate_design_tokens()` before creating
3. Round values to the nearest valid constraint
4. Consult the constraint tables in this guide

### Layout Issues

**Problem:** Nodes not positioning correctly

**Solutions:**

1. Check if parent has auto-layout enabled
2. Use `set_layout_sizing()` to control sizing behavior
3. Use `set_layout_align()` for alignment
4. Verify constraints are set correctly
5. Use absolute positioning only when necessary

### Performance Issues

**Problem:** Slow performance with many nodes

**Solutions:**

1. Batch operations when possible
2. Use components and instances instead of duplicating
3. Limit recursive operations depth
4. Use `get_children()` with `recursive: false` when possible
5. Export large designs in chunks

### Style Not Applying

**Problem:** Color/text/effect style not applying

**Solutions:**

1. Verify the style exists (create it first)
2. Check the style name exactly matches
3. Ensure you're using the correct apply function:
   - `apply_fill_style()` for colors
   - `apply_text_style()` for text
   - `apply_effect_style()` for effects
4. Check if the node type supports that style

### Export Issues

**Problem:** Export fails or returns empty data

**Solutions:**

1. Verify the node exists and is visible
2. Check that the format is supported
3. For base64, check the data isn't too large
4. Try exporting to file instead
5. Ensure the node has content (not empty)

---

## Advanced Topics

### Working with Complex Layouts

Use nested auto-layout for complex structures:

```javascript
// Outer container (vertical)
const page = create_frame({ name: 'Page' });
set_layout_properties({
  nodeId: page.frameId,
  layoutMode: 'VERTICAL',
  itemSpacing: 32
});

// Header (horizontal)
const header = create_frame({ name: 'Header', parentId: page.frameId });
set_layout_properties({
  nodeId: header.frameId,
  layoutMode: 'HORIZONTAL',
  itemSpacing: 16
});

// Content (grid-like with multiple vertical columns)
const content = create_frame({ name: 'Content', parentId: page.frameId });
set_layout_properties({
  nodeId: content.frameId,
  layoutMode: 'HORIZONTAL',
  itemSpacing: 24
});

// Each column is vertical
const column1 = create_frame({ name: 'Column 1', parentId: content.frameId });
set_layout_properties({
  nodeId: column1.frameId,
  layoutMode: 'VERTICAL',
  itemSpacing: 16
});
```

### Creating Responsive Designs

Use layout sizing and constraints:

```javascript
// Container that fills width
const container = create_frame({ name: 'Container' });
set_layout_sizing({
  nodeId: container.frameId,
  horizontal: 'FILL',
  vertical: 'HUG'
});

// Card that adapts to container
const card = create_frame({ name: 'Card', parentId: container.frameId });
set_layout_sizing({
  nodeId: card.frameId,
  horizontal: 'FILL',
  vertical: 'HUG'
});

// Image that maintains aspect ratio
const image = create_frame({ name: 'Image', parentId: card.frameId });
set_layout_sizing({
  nodeId: image.frameId,
  horizontal: 'FILL',
  vertical: 'FIXED'
});
set_constraints({
  nodeId: image.frameId,
  horizontal: 'STRETCH',
  vertical: 'SCALE'
});
```

### Programmatic Design Generation

Generate designs from data:

```javascript
const products = [
  { name: 'Product 1', price: '$29', image: 'url1' },
  { name: 'Product 2', price: '$39', image: 'url2' },
  { name: 'Product 3', price: '$49', image: 'url3' }
];

// Create grid container
const grid = create_frame({ name: 'Product Grid' });
set_layout_properties({
  nodeId: grid.frameId,
  layoutMode: 'HORIZONTAL',
  itemSpacing: 24
});

// Generate cards from data
for (const product of products) {
  const card = create_frame({ name: product.name, parentId: grid.frameId });

  set_layout_properties({
    nodeId: card.frameId,
    layoutMode: 'VERTICAL',
    itemSpacing: 12,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 16,
    paddingBottom: 16
  });

  // Add image
  const image = create_frame({ parentId: card.frameId });
  set_image_fill({ nodeId: image.frameId, imageUrl: product.image });

  // Add name
  create_text({
    parentId: card.frameId,
    content: product.name,
    fontSize: 16,
    fontWeight: 600
  });

  // Add price
  create_text({
    parentId: card.frameId,
    content: product.price,
    fontSize: 20,
    fontWeight: 700
  });
}
```

---

## Getting Help

### Resources

- **Documentation:** This user guide
- **API Reference:** `/path/to/API_REFERENCE.md`
- **Examples:** `/path/to/examples/`
- **GitHub Issues:** https://github.com/yourusername/text-to-figma/issues

### Common Commands

Get available constraints:

```javascript
get_constraints({});
```

Get system prompt:

```javascript
get_system_prompt({});
```

Get workflow examples:

```javascript
get_few_shot_examples({});
```

### Debugging

Use node inspection tools:

```javascript
// Get node details
get_node_by_id({ nodeId: '123:456' });

// Get node bounds
get_absolute_bounds({ nodeId: '123:456' });

// Get node hierarchy
get_children({ nodeId: '123:456', recursive: true });
get_parent({ nodeId: '123:456' });

// Get plugin data
get_plugin_data({ nodeId: '123:456', key: 'debug' });
```

---

## Appendix

### Complete Primitive List

#### Creation (8)

- create_frame
- create_text
- create_ellipse
- create_line
- create_polygon
- create_star
- create_rectangle_with_image_fill
- create_boolean_operation

#### Fills & Colors (4)

- set_fills
- add_gradient_fill
- set_image_fill
- create_color_style

#### Styling (8)

- set_corner_radius
- set_stroke
- set_stroke_join
- set_stroke_cap
- set_blend_mode
- set_opacity
- set_clipping_mask
- apply_effects

#### Typography (9)

- set_text_decoration
- set_letter_spacing
- set_text_case
- set_paragraph_spacing
- create_text_style
- apply_text_style

#### Transforms (6)

- set_absolute_position
- set_rotation
- set_scale
- set_size
- flip_node

#### Layout (8)

- set_layout_properties
- set_layout_sizing
- set_layout_align
- set_constraints
- add_layout_grid

#### Components (7)

- create_component
- create_instance
- set_component_properties
- set_instance_swap
- create_component_set
- add_variant_property

#### Styles (3)

- apply_fill_style
- create_effect_style
- apply_effect_style

#### Navigation (6)

- get_node_by_id
- get_node_by_name
- get_children
- get_parent
- get_absolute_bounds

#### Export (2)

- set_export_settings
- export_node

#### Plugin Data (2)

- set_plugin_data
- get_plugin_data

#### Pages (3)

- create_page
- list_pages
- set_current_page

#### Node Management (2)

- set_visible
- set_locked

#### Validation (3)

- validate_design_tokens
- check_wcag_contrast
- validate_spacing
- validate_typography
- validate_contrast

#### Utility (3)

- get_constraints
- get_system_prompt
- get_few_shot_examples

**Total: 67 primitives**

---

## Changelog

### Version 0.1.0 (Current)

- Initial release with 67 primitives
- Full Figma API coverage
- Design system constraints
- MCP integration
- WebSocket bridge

---

## License

MIT License - See LICENSE file for details

---

**Happy Designing! 🎨**

For questions or feedback, please open an issue on GitHub.
