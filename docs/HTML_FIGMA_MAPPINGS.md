# HTML → Figma Mappings Reference

This document provides a comprehensive mapping between HTML/CSS concepts and their Figma equivalents, designed to help developers think about Figma in familiar web development terms.

## Table of Contents

- [Container Elements](#container-elements)
- [Flexbox Layout](#flexbox-layout)
- [Spacing](#spacing)
- [Typography](#typography)
- [Colors and Fills](#colors-and-fills)
- [Quick Reference Table](#quick-reference-table)

---

## Container Elements

### HTML `<div>` → Figma Frame

In Figma, a **Frame** is equivalent to a `<div>` element in HTML. It's a container that can hold other elements.

**HTML:**
```html
<div class="container">
  <!-- child elements -->
</div>
```

**Figma MCP Tool:**
```typescript
create_frame({
  name: "container"
})
```

---

## Flexbox Layout

Figma's Auto Layout system is directly analogous to CSS Flexbox.

### Layout Direction

| CSS Property | CSS Value | Figma Property | Figma Value |
|--------------|-----------|----------------|-------------|
| `display` | `flex` | Auto Layout | Enabled |
| `flex-direction` | `row` | `layoutMode` | `HORIZONTAL` |
| `flex-direction` | `column` | `layoutMode` | `VERTICAL` |
| N/A | N/A | `layoutMode` | `NONE` (absolute positioning) |

**HTML/CSS:**
```css
.container {
  display: flex;
  flex-direction: column;
}
```

**Figma MCP Tool:**
```typescript
create_frame({
  name: "container",
  layoutMode: "VERTICAL"
})
```

### Gap Between Children

| CSS Property | Figma Property | Constraint |
|--------------|----------------|------------|
| `gap` | `itemSpacing` | Must follow 8pt grid |

**Valid Values (8pt grid):** 0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128

**HTML/CSS:**
```css
.container {
  display: flex;
  flex-direction: row;
  gap: 16px;
}
```

**Figma MCP Tool:**
```typescript
create_frame({
  name: "container",
  layoutMode: "HORIZONTAL",
  itemSpacing: 16  // Must be 8pt grid value
})
```

### Padding

| CSS Property | Figma Property | Constraint |
|--------------|----------------|------------|
| `padding` | `padding` | Must follow 8pt grid |

**Valid Values (8pt grid):** 0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128

**HTML/CSS:**
```css
.container {
  display: flex;
  padding: 24px;
}
```

**Figma MCP Tool:**
```typescript
create_frame({
  name: "container",
  layoutMode: "VERTICAL",
  padding: 24  // Must be 8pt grid value
})
```

---

## Spacing

All spacing in Figma must follow the **8pt grid system** for consistency.

### CSS Properties → Figma Properties

| CSS Property | Figma Property | Valid Values |
|--------------|----------------|--------------|
| `gap` | `itemSpacing` | 0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128 |
| `padding` | `padding` | 0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128 |
| `margin` | Manual positioning | Use 8pt grid values |

### Example: Complete Container Layout

**HTML/CSS:**
```css
.card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  width: 320px;
}
```

**Figma MCP Tool:**
```typescript
create_frame({
  name: "card",
  layoutMode: "VERTICAL",
  itemSpacing: 16,
  padding: 24,
  width: 320
})
```

**CSS Equivalent Output:**
```css
.card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  width: 320px;
}
```

---

## Typography

Typography in Figma follows a **modular type scale** similar to typographic scales in CSS frameworks.

### Font Properties

| CSS Property | Figma Property | Constraint |
|--------------|----------------|------------|
| `font-size` | `fontSize` | Must be in type scale |
| `font-family` | `fontFamily` | String (e.g., "Inter") |
| `font-weight` | `fontWeight` | 100-900 in steps of 100 |
| `line-height` | `lineHeight` | Auto-calculated or manual |
| `text-align` | `textAlign` | LEFT, CENTER, RIGHT, JUSTIFIED |
| `letter-spacing` | `letterSpacing` | Number in pixels |
| `color` | `color` | Hex string |

### Type Scale

**Valid Font Sizes:** 12, 16, 20, 24, 32, 40, 48, 64

**Font Weights:**
- 100: Thin
- 200: Extra Light
- 300: Light
- 400: Normal (Regular)
- 500: Medium
- 600: Semibold
- 700: Bold
- 800: Extra Bold
- 900: Black

### Line Height Recommendations

- **Body text (≤20px):** 1.5x font size
- **Headings (>20px):** 1.2x font size

### Example: Text Creation

**HTML/CSS:**
```html
<h2 style="
  font-family: Inter;
  font-size: 24px;
  font-weight: 600;
  line-height: 29px;
  color: #000000;
">Heading Text</h2>
```

**Figma MCP Tool:**
```typescript
create_text({
  content: "Heading Text",
  fontSize: 24,      // Must be in type scale
  fontFamily: "Inter",
  fontWeight: 600,   // Semibold
  lineHeight: 29,    // Auto-calculated: 24 * 1.2 ≈ 29
  color: "#000000"
})
```

**CSS Equivalent Output:**
```css
font-family: Inter;
font-size: 24px;
font-weight: semibold (600);
line-height: 29px;
```

---

## Colors and Fills

Colors in Figma are similar to CSS `background-color` and `color` properties.

### Frame Fills (Background)

| CSS Property | Figma Property | Format |
|--------------|----------------|--------|
| `background-color` | `fills` | Hex (#FF0000) or RGB object |
| `opacity` | `opacity` | 0-1 |

**HTML/CSS:**
```css
.card {
  background-color: #0066FF;
  opacity: 1;
}
```

**Figma MCP Tool:**
```typescript
set_fills({
  nodeId: "frame-id",
  color: "#0066FF",
  opacity: 1
})
```

**CSS Equivalent Output:**
```css
background-color: #0066FF;
```

### Text Color

**HTML/CSS:**
```css
.text {
  color: #FF0000;
  opacity: 0.8;
}
```

**Figma MCP Tool:**
```typescript
set_fills({
  nodeId: "text-id",
  color: "#FF0000",
  opacity: 0.8
})
```

**CSS Equivalent Output:**
```css
color: #FF0000;
opacity: 0.8;
```

### Color Formats

1. **Hex String:** `"#FF0000"` or `"FF0000"`
2. **RGB Object:** `{ r: 255, g: 0, b: 0 }`

### WCAG Contrast Requirements

Always validate color contrast for text:

- **WCAG AA Normal Text:** 4.5:1 minimum
- **WCAG AA Large Text:** 3.0:1 minimum
- **WCAG AAA Normal Text:** 7.0:1 minimum
- **WCAG AAA Large Text:** 4.5:1 minimum

**Validation Tool:**
```typescript
validate_contrast({
  foreground: "#000000",
  background: "#FFFFFF"
})
```

---

## Quick Reference Table

### Complete Mapping

| HTML/CSS | Figma | Tool | Constraint |
|----------|-------|------|------------|
| `<div>` | Frame | `create_frame` | - |
| `display: flex` | Auto Layout | `layoutMode` | - |
| `flex-direction: row` | Layout Horizontal | `HORIZONTAL` | - |
| `flex-direction: column` | Layout Vertical | `VERTICAL` | - |
| `gap: 16px` | Item Spacing | `itemSpacing: 16` | 8pt grid |
| `padding: 24px` | Padding | `padding: 24` | 8pt grid |
| `width: 320px` | Width | `width: 320` | - |
| `height: 480px` | Height | `height: 480` | - |
| `font-size: 24px` | Font Size | `fontSize: 24` | Type scale |
| `font-weight: 600` | Font Weight | `fontWeight: 600` | 100-900 |
| `line-height: 29px` | Line Height | `lineHeight: 29` | - |
| `text-align: center` | Text Align | `textAlign: "CENTER"` | - |
| `background-color: #FF0000` | Frame Fill | `set_fills` | - |
| `color: #000000` | Text Color | `set_fills` | - |
| `opacity: 0.8` | Opacity | `opacity: 0.8` | 0-1 |

---

## Workflow Examples

### Example 1: Card Component

**HTML/CSS:**
```html
<div class="card">
  <h3>Card Title</h3>
  <p>Card description text goes here.</p>
</div>

<style>
.card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  width: 320px;
  background-color: #FFFFFF;
}

.card h3 {
  font-family: Inter;
  font-size: 24px;
  font-weight: 600;
  color: #000000;
}

.card p {
  font-family: Inter;
  font-size: 16px;
  font-weight: 400;
  color: #666666;
}
</style>
```

**Figma MCP Tools:**
```typescript
// 1. Create card frame
const card = await create_frame({
  name: "card",
  layoutMode: "VERTICAL",
  itemSpacing: 16,
  padding: 24,
  width: 320
});

// 2. Set card background
await set_fills({
  nodeId: card.frameId,
  color: "#FFFFFF"
});

// 3. Create title text
const title = await create_text({
  content: "Card Title",
  fontSize: 24,
  fontWeight: 600,
  fontFamily: "Inter",
  color: "#000000",
  parentId: card.frameId
});

// 4. Create description text
const description = await create_text({
  content: "Card description text goes here.",
  fontSize: 16,
  fontWeight: 400,
  fontFamily: "Inter",
  color: "#666666",
  parentId: card.frameId
});

// 5. Validate contrast
await validate_contrast({
  foreground: "#000000",
  background: "#FFFFFF"
});
```

### Example 2: Button Component

**HTML/CSS:**
```html
<button class="primary-button">Click Me</button>

<style>
.primary-button {
  display: flex;
  padding: 16px 24px;
  background-color: #0066FF;
  font-family: Inter;
  font-size: 16px;
  font-weight: 600;
  color: #FFFFFF;
}
</style>
```

**Figma MCP Tools:**
```typescript
// 1. Create button frame
const button = await create_frame({
  name: "primary-button",
  layoutMode: "HORIZONTAL",
  padding: 16  // Note: CSS uses different horizontal/vertical padding
});

// 2. Set button background
await set_fills({
  nodeId: button.frameId,
  color: "#0066FF"
});

// 3. Create button text
const buttonText = await create_text({
  content: "Click Me",
  fontSize: 16,
  fontWeight: 600,
  fontFamily: "Inter",
  color: "#FFFFFF",
  parentId: button.frameId
});

// 4. Validate text contrast
await validate_contrast({
  foreground: "#FFFFFF",
  background: "#0066FF"
});
```

---

## Design System Constraints Summary

### 8pt Grid (Spacing)
- **Valid values:** 0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128
- **Applies to:** `itemSpacing`, `padding`
- **Tool:** `validate_spacing(value)`

### Modular Type Scale (Typography)
- **Valid sizes:** 12, 16, 20, 24, 32, 40, 48, 64
- **Font weights:** 100, 200, 300, 400, 500, 600, 700, 800, 900
- **Applies to:** `fontSize`, `fontWeight`
- **Tool:** `validate_typography(fontSize)`

### WCAG Contrast (Colors)
- **AA Normal:** 4.5:1 minimum
- **AA Large:** 3.0:1 minimum
- **AAA Normal:** 7.0:1 minimum
- **AAA Large:** 4.5:1 minimum
- **Applies to:** Text on backgrounds
- **Tool:** `validate_contrast(foreground, background)`

---

## Common Patterns

### Stack Layout (Vertical)
```typescript
// HTML: <div style="display: flex; flex-direction: column; gap: 16px;">
create_frame({
  layoutMode: "VERTICAL",
  itemSpacing: 16
})
```

### Row Layout (Horizontal)
```typescript
// HTML: <div style="display: flex; flex-direction: row; gap: 24px;">
create_frame({
  layoutMode: "HORIZONTAL",
  itemSpacing: 24
})
```

### Padded Container
```typescript
// HTML: <div style="padding: 32px;">
create_frame({
  padding: 32
})
```

### Centered Text
```typescript
// HTML: <p style="text-align: center;">
create_text({
  content: "Centered text",
  textAlign: "CENTER"
})
```

---

## Notes

1. **Always validate constraints:** Use `validate_spacing`, `validate_typography`, and `validate_contrast` tools before creating nodes.

2. **8pt grid is mandatory:** All spacing values must align to the 8pt grid. Use the `validate_spacing` tool to check values.

3. **Type scale is mandatory:** All font sizes must be in the type scale. Use the `validate_typography` tool to check values.

4. **Accessibility is critical:** Always validate color contrast for text using `validate_contrast` to ensure WCAG compliance.

5. **CSS equivalents are provided:** Every MCP tool returns a CSS equivalent string to help you understand the mapping.

---

## Additional Resources

- **Figma Auto Layout Guide:** [figma.com/autolayout](https://figma.com/autolayout)
- **CSS Flexbox Guide:** [css-tricks.com/snippets/css/a-guide-to-flexbox](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
- **WCAG Guidelines:** [w3.org/WAI/WCAG21](https://www.w3.org/WAI/WCAG21/)
- **8pt Grid System:** [spec.fm/specifics/8-pt-grid](https://spec.fm/specifics/8-pt-grid)
