# Production Readiness Plan - Primitive-First Approach

**Philosophy**: Expose ALL Figma primitives, not pre-made components. Let Claude compose designs from raw capabilities.

**Anti-Pattern**: ❌ "create_button", "create_card", "create_navbar"  
**Correct Pattern**: ✅ All Figma API primitives + Claude composes

---

## Core Problem: Missing Figma Primitives

We need to expose the FULL Figma API as MCP tools, not create high-level abstractions.

---

## Phase 6: Essential Figma Primitives (Critical - 2-3 weeks)

### 1. **Image Primitives** (Week 1)
Tools needed:
- `create_rectangle_with_image_fill` - Rectangle with image fill from URL
- `set_image_fill` - Apply image fill to existing node
- `set_image_scale_mode` - FILL, FIT, CROP, TILE
- `set_image_transform` - Position and scale image within bounds

**Why**: 90% of real designs need images. This is THE biggest gap.

**Figma API**:
```typescript
node.fills = [{
  type: 'IMAGE',
  imageHash: hash,
  scaleMode: 'FILL' | 'FIT' | 'CROP' | 'TILE',
  imageTransform: [[a, b, c], [d, e, f]]
}]
```

---

### 2. **Vector Primitives** (Week 1)
Tools needed:
- `create_line` - Simple line between two points
- `create_ellipse` - Circle/ellipse with dimensions
- `create_polygon` - N-sided polygon
- `create_star` - Star shape with inner/outer radius
- `create_vector_node` - Raw SVG path data
- `set_corner_radius` - Individual corner radii (topLeft, topRight, bottomLeft, bottomRight)
- `set_stroke` - Width, color, alignment (INSIDE, OUTSIDE, CENTER), dash pattern

**Why**: Can't create icons, shapes, or visual elements without these.

**Figma API**:
```typescript
figma.createEllipse()
figma.createPolygon()
figma.createStar()
figma.createVector()
node.cornerRadius = number | {topLeft, topRight, bottomLeft, bottomRight}
```

---

### 3. **Advanced Fill/Stroke Primitives** (Week 1)
Tools needed:
- `add_gradient_fill` - Linear or radial gradient with stops
- `set_fill_opacity` - Opacity per fill (not node opacity)
- `add_multiple_fills` - Stack multiple fills
- `set_blend_mode` - NORMAL, MULTIPLY, SCREEN, OVERLAY, etc.
- `set_stroke_weight` - Different weights per side
- `set_stroke_join` - MITER, BEVEL, ROUND
- `set_stroke_cap` - NONE, ROUND, SQUARE

**Why**: Modern designs use gradients, multiple fills, blend modes.

**Figma API**:
```typescript
node.fills = [
  { type: 'SOLID', color: {...} },
  { type: 'GRADIENT_LINEAR', gradientStops: [...] },
  { type: 'GRADIENT_RADIAL', gradientStops: [...] }
]
node.blendMode = 'MULTIPLY'
```

---

### 4. **Typography Primitives** (Week 1-2)
Tools needed:
- `set_text_decoration` - UNDERLINE, STRIKETHROUGH
- `set_text_case` - UPPER, LOWER, TITLE
- `set_letter_spacing` - Tracking
- `set_paragraph_spacing` - Space between paragraphs
- `set_paragraph_indent` - First line indent
- `set_list_options` - Bullets, numbering (via Figma API if available)
- `apply_text_style` - Reference Figma text style by ID
- `get_available_fonts` - List fonts in Figma file

**Why**: Professional typography needs these details.

**Figma API**:
```typescript
node.textDecoration = 'UNDERLINE' | 'STRIKETHROUGH'
node.textCase = 'UPPER' | 'LOWER' | 'TITLE'
node.letterSpacing = { value: number, unit: 'PIXELS' | 'PERCENT' }
node.paragraphSpacing = number
node.paragraphIndent = number
```

---

### 5. **Effect Primitives** (Week 2)
Tools needed:
- `set_layer_blur` - Blur amount
- `set_background_blur` - Backdrop blur
- `add_drop_shadow` - With all params (x, y, blur, spread, color, opacity)
- `add_inner_shadow` - Inner shadow
- `set_opacity` - Node opacity
- `set_effects_blend_mode` - Per-effect blend mode

**Why**: Shadows and blur are essential for depth and polish.

**Already implemented in Phase 3, but verify completeness**

---

## Phase 7: Layout & Transform Primitives (Important - 2 weeks)

### 6. **Transform Primitives** (Week 3)
Tools needed:
- `set_rotation` - Rotate node by degrees
- `set_absolute_position` - X, Y coordinates
- `set_size` - Width, height (separate from resize)
- `set_constraints` - How node responds to parent resize
- `set_layout_align` - Alignment within auto-layout parent
- `set_layout_grow` - Flex grow in auto-layout
- `flip_horizontal` / `flip_vertical`

**Why**: Precise positioning and responsive behavior.

**Figma API**:
```typescript
node.rotation = degrees
node.x = x
node.y = y
node.resize(width, height)
node.constraints = { horizontal: 'MIN' | 'MAX' | 'STRETCH', vertical: ... }
```

---

### 7. **Clipping & Masking Primitives** (Week 3)
Tools needed:
- `set_clipping` - Set as clipping mask
- `set_mask` - Use as mask for group
- `create_boolean_operation` - UNION, SUBTRACT, INTERSECT, EXCLUDE
- `flatten_to_image` - Rasterize selection

**Why**: Complex shapes, image masks, icon composition.

**Figma API**:
```typescript
node.clipsContent = true
figma.union(nodes)
figma.subtract(nodes)
figma.intersect(nodes)
figma.exclude(nodes)
```

---

### 8. **Layout Grid Primitives** (Week 4)
Tools needed:
- `add_layout_grid` - Column grid, row grid, or both
- `set_grid_properties` - Count, gutter, margin, offset
- `set_grid_visibility` - Show/hide
- `remove_grid`

**Why**: Designers use grids for alignment and consistency.

**Figma API**:
```typescript
node.layoutGrids = [{
  pattern: 'COLUMNS' | 'ROWS' | 'GRID',
  count: 12,
  gutter: 20,
  margin: 64,
  offset: 0
}]
```

---

## Phase 8: Style System Primitives (Important - 2 weeks)

### 9. **Style Primitives** (Week 5)
Tools needed:
- `create_color_style` - Name, color, description
- `create_text_style` - Font, size, weight, line-height, etc.
- `create_effect_style` - Shadow or blur style
- `apply_fill_style` - Apply color style to node
- `apply_text_style` - Apply text style to text node
- `apply_effect_style` - Apply effect style
- `list_styles` - Get all styles in file
- `get_style_by_name` - Find style

**Why**: Design systems need reusable styles, not duplicated values.

**Figma API**:
```typescript
figma.createPaintStyle()
figma.createTextStyle()
figma.createEffectStyle()
node.fillStyleId = styleId
textNode.textStyleId = styleId
node.effectStyleId = styleId
```

---

### 10. **Component Property Primitives** (Week 5-6)
Tools needed:
- `add_component_property` - Boolean, text, instance-swap
- `set_component_property_value` - Set value on instance
- `create_component_set` - Group variants
- `add_variant_property` - Size, state, type, etc.
- `set_default_variant` - Which variant is default

**Why**: Real design systems use component properties and variants.

**Figma API**:
```typescript
component.addComponentProperty('propertyName', 'BOOLEAN')
instance.setProperties({ propertyName: true })
figma.combineAsVariants([component1, component2])
```

---

## Phase 9: Advanced Primitives (Enhancement - 2-3 weeks)

### 11. **Plugin Data & Metadata** (Week 7)
Tools needed:
- `set_plugin_data` - Store arbitrary data on node
- `get_plugin_data` - Retrieve plugin data
- `set_shared_plugin_data` - Shared across plugins
- `set_node_name` - Set layer name
- `set_locked` - Lock/unlock node
- `set_visible` - Show/hide node

**Why**: Metadata for design systems, tooling integration.

---

### 12. **Selection & Navigation** (Week 7)
Tools needed:
- `get_selection` - Current selected nodes
- `set_selection` - Select specific nodes
- `get_node_by_id` - Find node by ID
- `get_node_by_name` - Find nodes by name
- `get_children` - Get child nodes
- `get_parent` - Get parent node
- `scroll_to_node` - Focus viewport on node

**Why**: Navigation and context awareness for multi-step operations.

---

### 13. **Export Primitives** (Week 8)
Tools needed:
- `set_export_settings` - Format (PNG, JPG, SVG, PDF), scale, suffix
- `export_node` - Export to bytes or URL
- `get_absolute_bounds` - Get position/size in canvas

**Why**: Design handoff and asset generation.

**Figma API**:
```typescript
node.exportSettings = [{
  format: 'PNG',
  suffix: '@2x',
  constraint: { type: 'SCALE', value: 2 }
}]
await node.exportAsync({ format: 'PNG' })
```

---

### 14. **Page & Document Primitives** (Week 8)
Tools needed:
- `create_page` - New page in document
- `list_pages` - Get all pages
- `set_current_page` - Switch active page
- `get_document_colors` - Colors used in document
- `get_document_fonts` - Fonts used in document

**Why**: Multi-page workflows, organization.

---

## Phase 10: Visual Feedback Loop (Critical - 2 weeks)

### 15. **Screenshot/Rendering Primitives** (Week 9-10)
Tools needed:
- `render_node_to_image` - Get PNG/JPG of node
- `get_node_thumbnail` - Small preview image
- `compare_designs` - Visual diff between two states

**Why**: Claude needs to "see" what it created to iterate.

**Implementation**:
- Figma plugin can use `node.exportAsync()`
- Return base64 image data through WebSocket
- MCP server provides to Claude for vision analysis

**This is THE key feature that's missing** - without visual feedback, Claude is blind.

---

## Critical Changes to Existing Code

### 1. **Remove High-Level Component Templates** (Immediate)

**DELETE**:
- `mcp-server/src/prompts/library/button-component.ts`
- `mcp-server/src/prompts/library/card-component.ts`
- `mcp-server/src/prompts/library/form-component.ts`
- All 10 pre-made templates

**KEEP**:
- Example workflows showing how to COMPOSE components
- Patterns like "container → children → style → effects"

**REPLACE WITH**:
- Documentation showing primitive composition
- Examples: "To create a button: 1) create rectangle, 2) add text, 3) add shadow effect, 4) group and componentize"

---

### 2. **Refactor Prompt System** (Week 1)

**Current**: Zero-shot and few-shot prompts tell Claude about high-level components  
**New**: Teach Claude about Figma primitives and composition patterns

**New System Prompt Structure**:
```
You have access to ALL Figma primitives via MCP tools:

SHAPES: create_rectangle, create_ellipse, create_polygon, create_star, create_vector
IMAGES: create_rectangle_with_image_fill, set_image_fill, set_image_scale_mode
TEXT: create_text, set_text_decoration, set_letter_spacing, set_text_case
FILLS: set_fills (solid, gradient), add_gradient_fill, set_fill_opacity
STROKES: set_stroke, set_stroke_weight, set_stroke_join, set_stroke_cap
EFFECTS: add_drop_shadow, add_inner_shadow, set_layer_blur, set_background_blur
LAYOUT: set_layout_properties, set_absolute_position, set_rotation, set_constraints
STYLES: create_color_style, create_text_style, apply_fill_style, apply_text_style
COMPONENTS: create_component, create_instance, add_component_property, create_component_set
BOOLEAN: create_boolean_operation (union, subtract, intersect, exclude)
MASKING: set_clipping, set_mask
GRIDS: add_layout_grid, set_grid_properties
EXPORT: set_export_settings, export_node

COMPOSITION PATTERN:
1. Create primitive shapes (rectangles, ellipses, text)
2. Position and size them
3. Apply fills (solid colors, gradients, images)
4. Apply strokes
5. Apply effects (shadows, blur)
6. Group related elements
7. Componentize if reusable
8. Apply styles for consistency

NEVER assume high-level components exist. ALWAYS compose from primitives.
```

---

### 3. **Add Visual Feedback to Refinement Loop** (Week 9-10)

**Current**: Iterative refinement without seeing results  
**New**: Screenshot → Claude vision analysis → Iterate

```typescript
// refinement-loop.ts modifications
async function refineDesign(nodeId: string, requirements: string) {
  for (let i = 0; i < 3; i++) {
    // 1. Render current state
    const screenshot = await renderNodeToImage(nodeId);
    
    // 2. Ask Claude to analyze
    const analysis = await analyzeDesignWithVision(screenshot, requirements);
    
    // 3. If good enough, done
    if (analysis.score >= 90) break;
    
    // 4. Apply suggested improvements
    await applyImprovements(nodeId, analysis.improvements);
  }
}
```

---

## Revised Tool Count

**Current**: 18 tools (many high-level abstractions)  
**Target**: ~60-80 tools (all Figma primitives)

**Breakdown by Category**:
- **Shapes** (7): rectangle, ellipse, polygon, star, vector, line, frame
- **Images** (4): image fill, scale mode, transform, placeholder
- **Text** (8): create, decoration, case, spacing, indent, style
- **Fills** (6): solid, gradient (linear/radial), image, multiple, opacity
- **Strokes** (5): weight, color, alignment, join, cap
- **Effects** (5): drop shadow, inner shadow, blur, background blur, opacity
- **Layout** (8): position, size, rotation, constraints, align, grow, grid
- **Boolean** (4): union, subtract, intersect, exclude
- **Masking** (2): clipping, mask
- **Styles** (8): create (color, text, effect), apply (fill, text, effect), list, get
- **Components** (7): create, instance, properties, variants, component set
- **Selection** (5): get, set, find by ID, find by name, navigate tree
- **Export** (3): settings, export, bounds
- **Document** (4): pages, colors, fonts
- **Visual** (3): render, thumbnail, compare
- **Metadata** (4): plugin data, name, locked, visible

**Total**: ~73 primitive tools

---

## What This Enables

With ALL Figma primitives exposed, Claude can:

✅ Create any shape or icon from vectors  
✅ Place and manipulate images  
✅ Compose complex components from primitives  
✅ Apply gradients and advanced fills  
✅ Use boolean operations for complex shapes  
✅ Create professional typography  
✅ Build design systems with styles  
✅ Generate component variants  
✅ SEE what it created (via screenshots)  
✅ Iterate based on visual feedback  
✅ Match any design shown in a reference  

---

## Timeline

**Week 1-2**: Image + Vector + Fill primitives (critical)  
**Week 3-4**: Transform + Layout + Grid primitives  
**Week 5-6**: Styles + Component properties  
**Week 7-8**: Selection + Export + Document primitives  
**Week 9-10**: Visual feedback loop (CRITICAL)  

**Total**: 10 weeks to production-ready primitive-based system

---

## Success Criteria

**Before**: "Create a button" → High-level abstraction  
**After**: Claude composes button from primitives:
```
1. create_rectangle (100x40)
2. set_corner_radius (8)
3. add_gradient_fill (blue gradient)
4. add_drop_shadow (subtle)
5. create_text ("Click me")
6. set_text_style (16px, semi-bold, white)
7. position text centered in rectangle
8. group both
9. create_component ("Button")
10. add_component_property ("label", TEXT)
11. add_component_property ("disabled", BOOLEAN)
```

**This is how real Figma works.** We need to match that.

---

## Anti-Patterns to Avoid

❌ Pre-made "button" tool  
❌ Pre-made "card" tool  
❌ Pre-made "navbar" tool  
❌ Any high-level component abstractions  
❌ "Smart" tools that make design decisions  

✅ Raw Figma API primitives  
✅ Composition examples in docs  
✅ Claude decides how to compose  
✅ Visual feedback for iteration  
✅ Style system for consistency  

---

## Bottom Line

**Current State**: High-level abstractions, no images, no vectors, blind iteration  
**Target State**: All Figma primitives, full API access, visual feedback loop  
**Philosophy**: Tool exposes primitives, Claude composes designs  
**Timeline**: 10 weeks to production-ready  
**Result**: Can match ANY Figma design through primitive composition  

This is the correct approach. No shortcuts, no pre-made components, just raw Figma power exposed to Claude.
