# create_path Tool - Complete Guide

## Overview

The `create_path` tool creates custom vector paths using Bezier curves and line segments. It's essential for creating organic, smooth shapes like animals, characters, logos, and illustrations.

## Command Reference

### M - Move To

Moves the drawing cursor to a new position without drawing.

```typescript
{ type: 'M', x: 100, y: 200 }
```

**Requirements:**

- `x`: number (X coordinate)
- `y`: number (Y coordinate)

**Note:** **Every path MUST start with an M command.**

### L - Line To

Draws a straight line from current position to the specified point.

```typescript
{ type: 'L', x: 200, y: 200 }
```

**Requirements:**

- `x`: number (X coordinate of end point)
- `y`: number (Y coordinate of end point)

### C - Cubic Bezier Curve

Draws a smooth curve using two control points.

```typescript
{
  type: 'C',
  x1: 150, y1: 150,  // First control point
  x2: 250, y2: 150,  // Second control point
  x: 300, y: 200     // End point
}
```

**Requirements:**

- `x1, y1`: number (First control point)
- `x2, y2`: number (Second control point)
- `x, y`: number (End point)

**Use for:** Smooth, flowing curves (animal bodies, waves, organic shapes)

### Q - Quadratic Bezier Curve

Draws a simpler curve using one control point.

```typescript
{
  type: 'Q',
  x1: 200, y1: 150,  // Control point
  x: 250, y: 200     // End point
}
```

**Requirements:**

- `x1, y1`: number (Control point)
- `x, y`: number (End point)

**Use for:** Simple arcs and rounded corners

### Z - Close Path

Closes the path by drawing a line back to the starting point.

```typescript
{
  type: 'Z';
}
```

**No coordinates required.** Automatically connects to the first M command.

## Complete Examples

### Example 1: Simple Rectangle

```typescript
await create_path({
  name: 'Rectangle',
  commands: [
    { type: 'M', x: 100, y: 100 }, // Start at top-left
    { type: 'L', x: 300, y: 100 }, // Line to top-right
    { type: 'L', x: 300, y: 200 }, // Line to bottom-right
    { type: 'L', x: 100, y: 200 }, // Line to bottom-left
    { type: 'Z' } // Close path
  ],
  fillColor: '#4CAF50',
  strokeColor: '#2E7D32',
  strokeWeight: 2
});
```

### Example 2: Smooth Wave

```typescript
await create_path({
  name: 'Wave',
  commands: [
    { type: 'M', x: 0, y: 200 },
    { type: 'C', x1: 100, y1: 150, x2: 200, y2: 150, x: 300, y: 200 },
    { type: 'C', x1: 400, y1: 250, x2: 500, y2: 250, x: 600, y: 200 }
  ],
  strokeColor: '#2196F3',
  strokeWeight: 3,
  closed: false // Open path (no fill)
});
```

### Example 3: Heart Shape

```typescript
await create_path({
  name: 'Heart',
  commands: [
    { type: 'M', x: 200, y: 150 }, // Start at top center
    { type: 'C', x1: 200, y1: 120, x2: 180, y2: 100, x: 150, y: 100 }, // Left top curve
    { type: 'C', x1: 110, y1: 100, x2: 90, y2: 130, x: 90, y: 160 }, // Left side curve
    { type: 'C', x1: 90, y1: 200, x2: 150, y2: 240, x: 200, y: 280 }, // Left bottom to point
    { type: 'C', x1: 250, y1: 240, x2: 310, y2: 200, x: 310, y: 160 }, // Right bottom to point
    { type: 'C', x1: 310, y1: 130, x2: 290, y2: 100, x: 250, y: 100 }, // Right side curve
    { type: 'C', x1: 220, y1: 100, x2: 200, y2: 120, x: 200, y: 150 }, // Right top curve
    { type: 'Z' }
  ],
  fillColor: '#FF1744',
  strokeColor: '#C51162',
  strokeWeight: 2
});
```

### Example 4: Leaf with Stem

```typescript
await create_path({
  name: 'Leaf',
  commands: [
    // Leaf outline
    { type: 'M', x: 200, y: 100 }, // Top point
    { type: 'C', x1: 250, y1: 130, x2: 260, y2: 180, x: 240, y: 220 }, // Right curve
    { type: 'C', x1: 220, y1: 250, x2: 180, y2: 250, x: 160, y: 220 }, // Bottom curve
    { type: 'C', x1: 140, y1: 180, x2: 150, y2: 130, x: 200, y: 100 }, // Left curve back to top
    { type: 'Z' }
  ],
  fillColor: '#4CAF50'
});

// Then create stem separately
await create_path({
  name: 'Stem',
  commands: [
    { type: 'M', x: 200, y: 220 },
    { type: 'Q', x1: 195, y1: 250, x: 190, y: 280 }
  ],
  strokeColor: '#388E3C',
  strokeWeight: 4,
  closed: false
});
```

## Common Patterns

### Smooth Organic Curves

Use C (cubic Bezier) commands for flowing, natural shapes:

```typescript
{ type: 'C', x1: cp1x, y1: cp1y, x2: cp2x, y2: cp2y, x: endx, y: endy }
```

**Tips:**

- Control points (x1,y1 and x2,y2) determine curve shape
- Place control points further from the line for more pronounced curves
- Keep control points aligned for smooth S-curves

### Simple Rounded Corners

Use Q (quadratic Bezier) for simple arcs:

```typescript
{ type: 'Q', x1: cpx, y1: cpy, x: endx, y: endy }
```

### Geometric Shapes

Use M, L, and Z for straight-edged shapes:

```typescript
{ type: 'M', x: x1, y: y1 },
{ type: 'L', x: x2, y: y2 },
{ type: 'L', x: x3, y: y3 },
{ type: 'Z' }
```

## Validation Rules

### ✅ Valid Paths

```typescript
// Must start with M
[{ type: 'M', x: 100, y: 100 }, { type: 'L', x: 200, y: 200 }, { type: 'Z' }];
```

```typescript
// Coordinates must be finite numbers
{ type: 'M', x: 150.5, y: 200.25 }  // ✓ Decimals OK
```

```typescript
// All required coordinates present
{
  type: 'C',
  x1: 100, y1: 100,
  x2: 200, y2: 100,
  x: 300, y: 200
}  // ✓ All 6 coordinates
```

### ❌ Invalid Paths (Will Fail Validation)

```typescript
// Missing starting M command
[
  { type: 'L', x: 100, y: 100 }, // ✗ Must start with M
  { type: 'Z' }
];
// Error: Path must start with M (Move) command
```

```typescript
// Missing coordinates
{ type: 'M', x: 100 }  // ✗ Missing y
// Error: M command at index 0 missing x or y coordinate
```

```typescript
// Invalid coordinate types
{ type: 'L', x: "100", y: 200 }  // ✗ x is string, not number
// Error: Command 1 (L): Missing x or y coordinate
```

```typescript
// Non-finite coordinates
{ type: 'M', x: NaN, y: 100 }  // ✗ NaN not allowed
// Error: Command 0 (M): Coordinates must be finite numbers (got x=NaN, y=100)
```

```typescript
// Incomplete C command
{
  type: 'C',
  x1: 100, y1: 100,
  x: 200, y: 200  // ✗ Missing x2, y2
}
// Error: Command 1 (C): Missing required coordinates (x1, y1, x2, y2, x, y)
```

## Styling Options

### Fill

```typescript
fillColor: '#FF0000'; // Hex color for filled shapes
```

Use `fillColor` for closed shapes. Omit for outlines only.

### Stroke

```typescript
strokeColor: "#000000",   // Outline color
strokeWeight: 2           // Outline thickness in pixels
```

### Closed vs Open Paths

```typescript
closed: true; // Automatically adds Z command (closed shape, can be filled)
closed: false; // Open path (typically stroked only)
```

## Best Practices

### 1. Start Simple

Begin with basic shapes using M, L, and Z:

```typescript
// Triangle
[
  { type: 'M', x: 100, y: 100 },
  { type: 'L', x: 200, y: 200 },
  { type: 'L', x: 50, y: 200 },
  { type: 'Z' }
];
```

### 2. Add Curves Gradually

Replace straight lines with C or Q commands for smoother shapes:

```typescript
// From: { type: 'L', x: 200, y: 200 }
// To:   { type: 'C', x1: 150, y1: 180, x2: 170, y2: 190, x: 200, y: 200 }
```

### 3. Use Descriptive Names

```typescript
name: 'Horse Head Left Side'; // ✓ Clear and specific
name: 'Path 1'; // ✗ Not descriptive
```

### 4. Parent Shapes Properly

```typescript
parentId: canvasFrame.frameId; // Add to existing frame
```

### 5. Test Incrementally

Build complex paths step by step, exporting frequently to verify:

```typescript
// Create base shape
const basePath = await create_path({ ... });

// Export to verify
await export_node({ nodeId: basePath.pathId, format: "PNG" });

// Continue building if correct
```

## Troubleshooting

### "Path must start with M (Move) command"

**Problem:** First command is not M.
**Solution:** Add M command at the beginning:

```typescript
commands: [
  { type: 'M', x: 100, y: 100 }, // Add this
  { type: 'L', x: 200, y: 200 }
  // ...
];
```

### "Missing x or y coordinate"

**Problem:** Command missing required coordinate.
**Solution:** Check all commands have required coordinates:

```typescript
// M and L need: x, y
{ type: 'M', x: 100, y: 100 }  // ✓

// C needs: x1, y1, x2, y2, x, y
{ type: 'C', x1: 100, y1: 100, x2: 200, y2: 100, x: 300, y: 200 }  // ✓

// Q needs: x1, y1, x, y
{ type: 'Q', x1: 150, y1: 150, x: 200, y: 200 }  // ✓
```

### "Coordinates must be finite numbers"

**Problem:** Coordinate is NaN, Infinity, or not a number.
**Solution:** Ensure all coordinates are valid numbers:

```typescript
// ✗ Wrong
{ type: 'M', x: parseInt("abc"), y: 100 }  // NaN

// ✓ Correct
{ type: 'M', x: 100, y: 100 }
```

### "Figma rejected path data"

**Problem:** Path format invalid for Figma.
**Solution:** Check console logs for path preview, verify coordinates are reasonable values (not extremely large/small).

## Performance Tips

1. **Minimize commands**: Use fewer, well-placed curves instead of many small segments
2. **Simplify curves**: Use Q (quadratic) instead of C (cubic) when possible
3. **Avoid redundancy**: Don't add unnecessary M commands or duplicate points
4. **Close paths**: Use `closed: true` instead of manual Z command when appropriate

## See Also

- [Drawing Workflow Guide](../.claude/commands/draw.md) - Complete drawing workflow
- [Boolean Operations](./BOOLEAN_OPERATIONS.md) - Combining paths
- [Path Examples Collection](./examples/) - More path examples
