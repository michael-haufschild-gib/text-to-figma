---
description: Create ANY type of drawing, illustration, icon, or visual graphic in Figma.
---

=== CRITICAL INSTRUCTION BLOCK [CIB-001] ===

## MANDATORY WORKFLOW FOR ANY DRAWING TASK

### Phase 1: VISUAL PLANNING (NEVER SKIP)

Before creating ANY shapes, you MUST plan visually:

**1. ASCII Art Sketch**

- Draw a rough layout using ASCII characters
- Mark key anchor points with approximate coordinates
- Show spatial relationships between major elements

**2. Coordinate System**

- Establish canvas dimensions (typically 800x600 or 1000x800)
- Define reference point (usually center or top-left)
- Calculate positions for major elements

**3. Detailed Shape Inventory**

- List ALL shapes needed including depth/shading layers:
  - **Primary shapes** (main elements) - use paths for organic/detailed work!
  - **Shading layers** (shadows, highlights, gradients)
  - **Detail elements** (fine details, textures, accents)
  - For EACH shape specify:
    - Shape type (PATH preferred for organic/detailed work!)
    - Exact position (x, y)
    - Dimensions OR path coordinates
    - Base color + shading colors
    - Layering order (back to front)
    - Opacity if translucent

**Example for Detailed Organic Illustration:**

```
Canvas: 800x600
Subject: Detailed leaf illustration with depth

ASCII Layout:
      /\
     /  \
    |    |  <- Main leaf shape
    |    |
     \  /
      ||    <- Stem

DETAILED SHAPE PLAN (20+ shapes for quality):

LAYER 1 (BACK - Shadows):
1. Leaf shadow: Path offset below, dark green (#2D5016, 30% opacity)
2. Ground shadow: Soft ellipse underneath

LAYER 2 (BASE SHAPES):
3. Main leaf: Custom path with Bezier curves, #4CAF50
   - Smooth organic outline with curves
   - Pointed tip, rounded base
4. Stem: Custom path (tapered), #388E3C
   - Wider at base, narrow at top

LAYER 3 (STRUCTURE/DETAILS):
5. Center vein: Thin path down middle, #2E7D32
6. Side veins (8x): Curved paths branching out, #2E7D32, 70% opacity
   - Each vein is custom Bezier curve

LAYER 4 (SHADING/DEPTH):
7. Leaf gradient: Linear gradient, #66BB6A to #388E3C
8. Shadow side: Darker green path along one edge, 25% opacity
9. Highlight side: Light path along opposite edge, white, 20% opacity
10. Vein shadows: Subtle dark paths beside veins, 15% opacity

LAYER 5 (TEXTURE):
11-15. Texture spots: 5 small organic paths, darker green, 10% opacity
16-18. Light spots: 3 paths simulating light through leaf, yellow-green, 15% opacity

LAYER 6 (FINAL POLISH):
19. Edge highlight: White path along top edge, 25% opacity
20. Drop shadow: Blur effect on entire leaf
21. Stem highlight: White path, 30% opacity
22. Subtle glow: Radial gradient behind leaf, soft yellow

TOTAL: ~22 shapes for professional quality
Export checkpoints: After base (4 shapes), after veins (12 shapes), after shading (18 shapes), final (22 shapes)
```

**Example for Complex Subject - Logo:**

```
Canvas: 600x400

ASCII Plan:
  ╔══════════╗
  ║ LOGO CO  ║  <- Text, centered
  ╠══════════╣
  ║  [icon]  ║  <- Icon centered below
  ╚══════════╝

SHAPE PLAN:
1. Canvas: 600x400
2. Text "LOGO CO": size 48, bold, centered at (300, 120)
3. Icon (abstract geometric):
   - Base circle: 80x80 at (300, 260) - #0066FF
   - Triangle overlay: 60x60 polygon at (300, 260) - #00CCFF
   - INTERSECT boolean for interesting shape
4. Container frame with rounded corners
5. Export for review
```

### Phase 2: ITERATIVE BUILD WITH EXPORTS

**CRITICAL: Export visual feedback every 5-10 shapes**

```typescript
// Create first 5-10 shapes following plan

// MANDATORY CHECKPOINT: Export current state
await export_node({
  nodeId: canvas.frameId,
  format: 'PNG',
  scale: 1,
  returnBase64: true
});

// ANALYZE the exported image:
// ✓ Positions match plan?
// ✓ Proportions look correct?
// ✓ Shapes properly connected?
// ✓ Colors as intended?

// ADJUST if needed using spatial/transform tools
// THEN continue with next batch of shapes
```

**Why Frequent Exports Are Non-Negotiable:**

- You can't see what you're creating without exports
- Errors compound quickly in spatial positioning
- Proportion mistakes are invisible until rendered
- Course-correction is cheaper early than late
- Visual feedback confirms or refutes your mental model

### Phase 3: SELECT APPROPRIATE DRAWING PRIMITIVES

**Choose the right tool for each shape:**

Always prefer paths over simple primitives!

**Core Shape Primitives:**

- `create_ellipse`: Circles, ovals (eyes, heads, organic shapes)
- `create_frame`: Rectangles, containers (bodies, backgrounds)
- `create_polygon`: Multi-sided shapes (triangles, hexagons, diamonds)
  - 3 sides = triangle (ears, arrows, mountains)
  - 4 sides = diamond (rotated 45°)
  - 5 sides = pentagon
  - 6 sides = hexagon (tiles, honeycomb)
  - 8 sides = octagon (stop signs)
- `create_star`: Star shapes (ratings, decorations, burst effects)
- `create_line`: Straight lines (connecting lines, technical drawings, geometric designs)
- `create_path`: Custom vector paths (smooth curves, complex organic shapes)
  - Use Bezier curves (C command) for smooth flowing shapes
  - Use quadratic curves (Q command) for simpler arcs
  - Essential for hand-drawn look or character outlines

**Shape Combination (Boolean Operations):**

- `create_boolean_operation`: Build complex shapes from simple ones
  - **UNION**: Merge overlapping shapes (combine circles for cloud, flower)
  - **SUBTRACT**: Cut out shapes (donut = circle - smaller circle)
  - **INTERSECT**: Keep only overlaps (lens shape = 2 circles intersected)
  - **EXCLUDE**: Remove overlaps (opposing crescents)

**Positioning & Alignment Tools:**

- `set_absolute_position`: Move shape to exact (x, y) coordinates
- `align_nodes`: Align multiple shapes
  - TOP, BOTTOM, LEFT, RIGHT: Align edges
  - CENTER_H, CENTER_V: Align centers (symmetry!)
- `distribute_nodes`: Even spacing between shapes
  - HORIZONTAL/VERTICAL
  - SPACING: Equal gaps
  - CENTERS: Equal center-to-center distance
- `get_absolute_bounds`: Check exact position/size of shape
- `get_relative_bounds`: Measure distances between shapes

**Connection & Composition:**

- `connect_shapes`: Position shapes to touch/overlap/merge
  - POSITION_ONLY: Just touch (adjacent shapes)
  - POSITION_OVERLAP: Overlap slightly (smooth visual connection)
  - UNION: Overlap AND boolean union (seamless merge)

**Layer Management (Critical for Depth):**

- `set_layer_order`: Control what appears on top
  - BRING_TO_FRONT: Details, eyes, highlights
  - SEND_TO_BACK: Large base shapes, backgrounds
  - BRING_FORWARD/SEND_BACKWARD: Fine adjustments

**Transform Tools:**

- `set_rotation`: Rotate shapes (angled elements)
- `set_scale`: Scale shapes (mirror with negative values)
- `flip_node`: Flip horizontally/vertically

### Phase 4: VERIFICATION & ITERATION PROTOCOL

**After Every 5-10 Shapes:**

```markdown
MANDATORY CHECKPOINT:

1. EXPORT CURRENT STATE:
   await export_node({
   nodeId: canvas.frameId,
   format: "PNG",
   scale: 1
   });

2. VISUAL ANALYSIS (Study the exported image):
   ✓ Does it match my plan? [Y/N]
   ✓ Are proportions correct? [Y/N]
   ✓ Are shapes positioned correctly? [Y/N]
   ✓ Is layer order creating proper depth? [Y/N]
   ✓ Do colors/styles look right? [Y/N]

3. SPATIAL VERIFICATION (If uncertain):
   const bounds = await get_absolute_bounds({ nodeId: shape.id });
   // Check if coordinates match plan

4. DECISION:
   - All Y: Continue to next shapes
   - Any N: STOP and fix issues before proceeding
```

**Why This Matters:**

- Prevents building on faulty foundation
- Catches errors early (cheap to fix)
- Confirms mental model vs reality
- Builds confidence iteratively

=== END CIB-001 ===

## Tool Selection Guide

### For Different Drawing Types:

**Organic/Detailed Drawings (MOST COMMON):**

- **Primary tool: `create_path` (80-90% of shapes)**
- Use Bezier curves (C command) extensively for smooth, natural forms
- Create 15-25+ shapes for proper detail and depth
- Mandatory shading layers for EACH major element:
  - Base shape (path with custom curves)
  - Shadow layer (darker path, 25-40% opacity)
  - Highlight layer (lighter path or white, 15-30% opacity)
  - Contour/texture definition (subtle darker paths)
- `set_layer_order` extensively for depth
- `add_gradient_fill` for smooth color transitions
- `apply_effects` for drop shadows and depth
- **Never settle for simple ellipses/frames for main elements!**

**Geometric/Technical Drawings:**

- Primary: `create_frame`, `create_polygon`, `create_line`
- Boolean ops for complex shapes
- `align_nodes` and `distribute_nodes` for precision
- Paths still useful for rounded technical elements

**Icons/Logos (Simple, Flat Style):**

- Can use `create_ellipse`, `create_polygon`, `create_star`
- Boolean operations for complex forms
- High precision positioning
- Still prefer `create_path` for custom brand shapes
- 5-10 shapes usually sufficient

**Illustrations (High Quality Expected):**

- **Primary tool: `create_path` for ALL major elements**
- 20-40+ shapes for professional quality
- Multiple shading/highlight layers per element
- Heavy use of gradients and effects
- Layer management crucial (10+ layers common)
- Color variation for depth and interest

**Styling Tools (USE EXTENSIVELY FOR DEPTH):**

- `set_fills`: Solid base colors
- `add_gradient_fill`: **CRITICAL FOR DEPTH!** (LINEAR, RADIAL)
  - Use on bodies for 3D effect (darker bottom, lighter top)
  - Example: Body gradient from #A0522D (top) to #654321 (bottom)
- `set_stroke`: Outlines for definition (1-3px, darker than fill)
- `set_corner_radius`: Rounded corners (when using frames)
- `set_opacity`: **ESSENTIAL FOR SHADING LAYERS!** (20-40% for shadows, 15-30% for highlights)
- `apply_effects`: **MANDATORY for professional quality!**
  - DROP_SHADOW: Add depth (y: 4-8, blur: 8-16, opacity: 0.2-0.3)
  - INNER_SHADOW: Subtle depth (y: 2, blur: 4, opacity: 0.1)
- `set_blend_mode`: Overlay effects for advanced shading
  - MULTIPLY: For shadow layers
  - SCREEN: For highlight layers

**Export for Verification:**

- `export_node`: Generate PNG/JPG/SVG for visual feedback

## Complete Example: Heart Icon

### Step 1: VISUAL PLANNING

```
HEART ICON PLAN
Canvas: 200x200
Centered at (100, 100)

ASCII Layout:
    ●   ●       <- Two circles (top lobes)
   ●  ●  ●
  ●   ❤️   ●     <- Union of circles + triangle
   ●     ●
    ●   ●
     ● ●
      ●         <- Point at bottom

SHAPE APPROACH:
Method 1: Two circles + triangle with UNION boolean
Method 2: Custom path with Bezier curves (smoother)

SHAPE INVENTORY (Method 1):
1. Canvas: 200x200, white background
2. Left circle: 50x50 at (75, 80) - #FF4444
3. Right circle: 50x50 at (105, 80) - #FF4444
4. Triangle: 80x60 at (90, 95) - #FF4444
5. Boolean UNION all three shapes
6. Optional: Small highlight ellipse (white, 30% opacity)

DIMENSIONS:
- Total heart: ~90px wide, ~80px tall
- Centered in 200x200 canvas
```

### Step 2: IMPLEMENTATION WITH CHECKPOINTS

```typescript
// 1. Create canvas
const canvas = await create_frame({
  name: 'Heart Icon',
  layoutMode: 'NONE'
});

await set_size({
  nodeId: canvas.frameId,
  width: 200,
  height: 200
});

await set_fills({
  nodeId: canvas.frameId,
  color: '#FFFFFF'
});

// 2. Create left lobe (circle)
const leftLobe = await create_ellipse({
  name: 'Left Lobe',
  width: 50,
  height: 50,
  fillColor: '#FF4444',
  parentId: canvas.frameId
});

await set_absolute_position({
  nodeId: leftLobe.ellipseId,
  x: 75,
  y: 80
});

// 3. Create right lobe (circle)
const rightLobe = await create_ellipse({
  name: 'Right Lobe',
  width: 50,
  height: 50,
  fillColor: '#FF4444',
  parentId: canvas.frameId
});

await set_absolute_position({
  nodeId: rightLobe.ellipseId,
  x: 105,
  y: 80
});

// 4. Create bottom point (triangle/polygon)
const bottomPoint = await create_polygon({
  name: 'Bottom Point',
  sideCount: 3,
  radius: 40,
  fillColor: '#FF4444',
  parentId: canvas.frameId
});

await set_absolute_position({
  nodeId: bottomPoint.polygonId,
  x: 100,
  y: 110
});

await set_rotation({
  nodeId: bottomPoint.polygonId,
  rotation: 180 // Point down
});

// CHECKPOINT 1: Export to see shape positioning
await export_node({
  nodeId: canvas.frameId,
  format: 'PNG',
  scale: 1
});
// ANALYZE: Do the shapes overlap properly to form a heart? ✓

// 5. Boolean union to create seamless heart
const heart = await create_boolean_operation({
  nodeIds: [leftLobe.ellipseId, rightLobe.ellipseId, bottomPoint.polygonId],
  operation: 'UNION',
  name: 'Heart Shape'
});

// CHECKPOINT 2: Export unified heart
await export_node({
  nodeId: canvas.frameId,
  format: 'PNG',
  scale: 1
});
// ANALYZE: Does the merged shape look smooth? ✓

// 6. Optional: Add highlight for depth
const highlight = await create_ellipse({
  name: 'Highlight',
  width: 20,
  height: 15,
  fillColor: '#FFFFFF',
  parentId: canvas.frameId
});

await set_absolute_position({
  nodeId: highlight.ellipseId,
  x: 85,
  y: 90
});

await set_opacity({
  nodeId: highlight.ellipseId,
  opacity: 0.3
});

await set_layer_order({
  nodeId: highlight.ellipseId,
  action: 'BRING_TO_FRONT'
});

// FINAL EXPORT: Verify complete icon
await export_node({
  nodeId: canvas.frameId,
  format: 'PNG',
  scale: 2 // Higher resolution for final check
});

// VERIFICATION:
// ✓ Heart shape is smooth and symmetrical?
// ✓ Color is correct (#FF4444)?
// ✓ Highlight adds nice depth?
// ✓ Centered in canvas?
```

### Step 3: Result

A clean, professional heart icon created by:

1. Planning shape composition
2. Building with basic primitives
3. Using boolean UNION for seamless merge
4. Adding subtle highlight for depth
5. Verifying at each checkpoint

## Universal Drawing Workflow

For ANY drawing task (icon, illustration, character, logo, etc):

**1. PLAN VISUALLY (5-10 min)**

- Create ASCII sketch showing layout
- Define canvas size and coordinates
- List all shapes needed with type/position/color
- Plan layer order (back to front)

**2. SELECT APPROPRIATE PRIMITIVES** (1-2 min)

- Geometric: frames, polygons, stars
- Organic: ellipses, paths (Bezier curves)
- Complex: boolean operations
- Consider what combines well

**3. BUILD ITERATIVELY** (main work)

- Start with largest/base shapes
- **Export every 5-10 shapes** (non-negotiable!)
- Analyze exported image vs plan
- Adjust using spatial/transform tools
- Continue next batch

**4. MANAGE LAYERS THROUGHOUT**

- Keep background elements at back
- Bring details/highlights to front
- Use set_layer_order early and often
- Think "painting in layers"

**5. POLISH & VERIFY** (2-5 min)

- Apply final styling (gradients, effects, shadows)
- Export at 2x scale
- Check against original plan
- Verify proportions, alignment, colors

## Adherence & Quality Check Protocol

**After Every 10 Shapes:**

```markdown
SELF-CHECK:

1. RECALL: "I am drawing [subject] following my visual plan"

2. VERIFY:
   ✓ Followed my shape plan? [Y/N]
   ✓ Chose appropriate primitives? [Y/N]
   ✓ Exported in last 10 shapes? [Y/N]
   ✓ Analyzed the export? [Y/N]
   ✓ Layer order maintained? [Y/N]

3. ACTION:
   - All Y: Continue confidently
   - Any N: STOP, export now, analyze, fix

4. EXPORT NOW if you haven't yet!
```

## Common Mistakes & Best Practices

### ❌ Working Without Visual Planning

**WRONG:**

```typescript
// Just start creating random shapes
await create_ellipse({ width: 100, height: 80 });
await create_frame({ width: 50, height: 60 });
// No plan, no idea if proportions are right
```

**RIGHT:**

```typescript
// Plan first with ASCII art and coordinates
/*
Plan:
Canvas: 400x300
Circle 1: 80x80 at (150, 120) - blue
Circle 2: 60x60 at (200, 140) - red
Boolean INTERSECT for lens shape
*/

// Then implement systematically
const canvas = await create_frame({ ... });
// ... follow plan
```

### ❌ No Export Feedback

**WRONG:**

```typescript
// Create 30 shapes without looking
// Discover at end: completely wrong proportions!
```

**RIGHT:**

```typescript
// Create 5-8 shapes
await export_node({ nodeId: canvas.frameId, format: 'PNG' });
// Look at result, verify against plan
// Adjust if needed, THEN continue
```

### ❌ Wrong Tool Selection

**WRONG - Simple primitives for detailed organic work:**

```typescript
// Using basic ellipse for a complex organic shape - TOO SIMPLE!
const mainShape = await create_ellipse({
  width: 200,
  height: 140,
  fillColor: '#4CAF50'
});
// Result: Flat, generic, lacks character
```

**STILL WRONG - No shading or depth:**

```typescript
const mainShape = await create_path({
  commands: [
    /* basic outline */
  ],
  fillColor: '#4CAF50'
});
// Better shape, but still flat and lifeless
```

**RIGHT - Detailed path with shading layers:**

```typescript
// 1. Base shape (custom path with Bezier curves)
const mainShape = await create_path({
  name: 'Main Element',
  commands: [
    { type: 'M', x: 100, y: 150 },
    { type: 'C', x1: 120, y1: 120, x2: 180, y2: 110, x: 220, y: 130 }, // Smooth curve
    { type: 'C', x1: 260, y1: 150, x2: 270, y2: 200, x: 250, y: 240 }, // Flowing contour
    { type: 'C', x1: 220, y1: 270, x2: 160, y2: 280, x: 120, y: 260 }, // Bottom curve
    { type: 'C', x1: 80, y1: 240, x2: 70, y2: 190, x: 100, y: 150 }, // Back to start
    { type: 'Z' }
  ],
  fillColor: '#4CAF50',
  strokeColor: '#2E7D32',
  strokeWeight: 2
});

// 2. Add gradient for depth
await add_gradient_fill({
  nodeId: mainShape.pathId,
  type: 'LINEAR',
  angle: 270, // Top to bottom
  stops: [
    { position: 0, color: '#66BB6A', opacity: 1 }, // Lighter top
    { position: 1, color: '#388E3C', opacity: 1 } // Darker bottom
  ]
});

// 3. Shadow layer for depth
const shadow = await create_path({
  name: 'Shadow Layer',
  commands: [
    /* slightly offset shadow path following main contour */
  ],
  fillColor: '#1B5E20'
});
await set_opacity({ nodeId: shadow.pathId, opacity: 0.35 });
await set_layer_order({ nodeId: shadow.pathId, action: 'SEND_TO_BACK' });

// 4. Highlight for 3D effect
const highlight = await create_path({
  name: 'Highlight',
  commands: [
    /* curved highlight along one edge */
  ],
  fillColor: '#FFFFFF'
});
await set_opacity({ nodeId: highlight.pathId, opacity: 0.25 });
await set_layer_order({ nodeId: highlight.pathId, action: 'BRING_TO_FRONT' });

// 5. Drop shadow for overall depth
await apply_effects({
  nodeId: mainShape.pathId,
  effects: [
    {
      type: 'DROP_SHADOW',
      color: '#000000',
      opacity: 0.25,
      x: 0,
      y: 6,
      blur: 12,
      spread: 0
    }
  ]
});

// Result: Professional, detailed, dimensional shape with depth!
```

### ❌ Ignoring Layer Order

**WRONG:**

```typescript
// Create details first, then base shapes
await create_ellipse({ ... }); // small detail
await create_path({ ... }); // large main element
// Result: Detail hidden behind main element!
```

**RIGHT:**

```typescript
// Large base shapes first
const mainElement = await create_path({ ... });
await set_layer_order({ nodeId: mainElement.pathId, action: "SEND_TO_BACK" });

// Details later
const detail = await create_ellipse({ ... });
await set_layer_order({ nodeId: detail.ellipseId, action: "BRING_TO_FRONT" });
```

### ✅ Complete Correct Pattern

```typescript
// 1. PLAN (written down)
/*
Logo: Tech Company
Canvas: 600x400
- Circle base: 120x120 at (300, 200) - #0066FF
- Triangle overlay: 80x80 at (300, 200) - #00CCFF
- INTERSECT boolean for unique shape
- Text: "TECH" below, size 32, centered
*/

// 2. CREATE WITH CHECKPOINTS
const canvas = await create_frame({ name: "Logo", layoutMode: "NONE" });
await set_size({ nodeId: canvas.frameId, width: 600, height: 400 });

const circle = await create_ellipse({ ... });
const triangle = await create_polygon({ sideCount: 3, ... });

// EXPORT #1 - Check positioning
await export_node({ nodeId: canvas.frameId, format: "PNG" });

const logo = await create_boolean_operation({
  nodeIds: [circle.ellipseId, triangle.polygonId],
  operation: "INTERSECT"
});

// EXPORT #2 - Check boolean result
await export_node({ nodeId: canvas.frameId, format: "PNG" });

await create_text({ content: "TECH", fontSize: 32, ... });

// EXPORT #3 - Final verification
await export_node({ nodeId: canvas.frameId, format: "PNG", scale: 2 });
```

## Quality Gates for Drawing

Before marking a drawing task complete:

**PLANNING:**
✓ ASCII plan created with detailed coordinates
✓ Shape inventory includes 15-25+ shapes (for detailed work)
✓ Shading/highlight layers planned for EACH major element

**EXECUTION:**
✓ Used `create_path` for 80-90% of organic shapes (NOT ellipses!)
✓ Each major element has AT LEAST:

- Base shape (path with gradients)
- Shadow layer (darker, 25-40% opacity)
- Highlight layer (lighter, 15-30% opacity)
  ✓ Exported at least 4-5 checkpoints during creation
  ✓ Layer order properly managed (shadows back, highlights front)

**DEPTH & POLISH:**
✓ Gradients applied to major shapes for 3D effect
✓ Drop shadows added for depth (apply_effects)
✓ Strokes used for definition (1-3px outlines)
✓ Opacity variations create layered depth
✓ Blend modes used where appropriate (MULTIPLY for shadows, SCREEN for highlights)

**FINAL VERIFICATION:**
✓ Final export at 2x scale analyzed for quality
✓ Drawing has depth and dimensionality (not flat!)
✓ Details are crisp and well-defined
✓ Shading creates realistic form
✓ Professional quality - would look good in portfolio

**MINIMUM QUALITY STANDARD:**
❌ REJECT: Simple shapes with flat colors (toy-like appearance)
❌ REJECT: Missing shadows or highlights (2D, flat)
❌ REJECT: Using ellipses for complex organic forms
✓ ACCEPT: Multi-layered with gradients, shadows, highlights
✓ ACCEPT: Custom paths for all major organic elements
✓ ACCEPT: Professional depth and dimensionality

=== RECALL CIB-001 ===
For EVERY drawing task:

1. Create ASCII plan with coordinates FIRST
2. Use appropriate tools (not just frames/ellipses)
3. Export and analyze every 5-10 shapes
4. Use spatial tools to verify and adjust
5. Manage layer order throughout
6. Verify final result against plan
   === END RECALL ===
