/**
 * Few-Shot System Prompt for Text-to-Figma
 *
 * Shows complete examples of HTML → Figma translation workflow
 */

export const FEW_SHOT_PROMPT = `# Text-to-Figma: Complete Examples

These examples demonstrate the MANDATORY workflow:
1. Think in HTML/SVG first
2. Extract layout patterns
3. Translate to Figma primitives (prefer create_design for multi-element designs)
4. Apply correct width strategy

---

## Example 1: Login Form (Recommended: create_design)

**User Request**: "Create a login form with email, password, and submit button"

### Step 1: HTML Mental Model
\`\`\`html
<form style="display: flex; flex-direction: column; gap: 24px; padding: 32px; width: 400px; background: white; border-radius: 16px;">
  <h2 style="font-size: 24px; font-weight: 700;">Sign In</h2>
  <div class="field" style="display: flex; flex-direction: column; gap: 8px;">
    <label>Email</label>
    <input style="width: 100%; height: 48px; padding: 16px; background: #F5F5F5; border-radius: 8px;" />
  </div>
  <div class="field" style="display: flex; flex-direction: column; gap: 8px;">
    <label>Password</label>
    <input style="width: 100%; height: 48px; padding: 16px; background: #F5F5F5; border-radius: 8px;" />
  </div>
  <button style="padding: 16px; background: #0066FF; color: white; border-radius: 8px;">Sign In</button>
</form>
\`\`\`

### Step 2: Translate to create_design (single atomic call)
\`\`\`typescript
create_design({
  spec: {
    type: 'frame',
    name: 'Login Form',
    props: {
      width: 400,
      layoutMode: 'VERTICAL',
      itemSpacing: 24,
      padding: 32,
      fillColor: '#FFFFFF',
      cornerRadius: 16,
      horizontalSizing: 'FIXED',
      verticalSizing: 'HUG'
    },
    children: [
      { type: 'text', name: 'Title', props: { content: 'Sign In', fontSize: 24, fontWeight: 700, color: '#000000' } },
      {
        type: 'frame', name: 'Email Field', props: { layoutMode: 'VERTICAL', itemSpacing: 8, horizontalSizing: 'FILL' },
        children: [
          { type: 'text', name: 'Email Label', props: { content: 'Email', fontSize: 16, fontWeight: 600, color: '#2D3748' } },
          { type: 'frame', name: 'Email Input', props: { height: 48, layoutMode: 'HORIZONTAL', padding: 16, fillColor: '#F5F5F5', cornerRadius: 8, horizontalSizing: 'FILL', verticalSizing: 'FIXED' },
            children: [
              { type: 'text', name: 'Email Placeholder', props: { content: 'you@example.com', fontSize: 16, color: '#A0AEC0' } }
            ]
          }
        ]
      },
      {
        type: 'frame', name: 'Password Field', props: { layoutMode: 'VERTICAL', itemSpacing: 8, horizontalSizing: 'FILL' },
        children: [
          { type: 'text', name: 'Password Label', props: { content: 'Password', fontSize: 16, fontWeight: 600, color: '#2D3748' } },
          { type: 'frame', name: 'Password Input', props: { height: 48, layoutMode: 'HORIZONTAL', padding: 16, fillColor: '#F5F5F5', cornerRadius: 8, horizontalSizing: 'FILL', verticalSizing: 'FIXED' },
            children: [
              { type: 'text', name: 'Password Placeholder', props: { content: '********', fontSize: 16, color: '#A0AEC0' } }
            ]
          }
        ]
      },
      {
        type: 'frame', name: 'Submit Button', props: { layoutMode: 'HORIZONTAL', padding: 16, fillColor: '#0066FF', cornerRadius: 8, horizontalSizing: 'FILL', verticalSizing: 'HUG', primaryAxisAlignItems: 'CENTER' },
        children: [
          { type: 'text', name: 'Submit Label', props: { content: 'Sign In', fontSize: 16, fontWeight: 600, color: '#FFFFFF' } }
        ]
      }
    ]
  }
})
\`\`\`

**Key Lesson**: create_design builds the entire hierarchy atomically. No parentId coordination, no race conditions, auto-corrects spacing to 8pt grid.

---

## Example 2: Button Component (Step-by-step alternative)

**User Request**: "Create a blue button with white text"

### Step 1: HTML Mental Model
\`\`\`html
<button style="
  display: flex;
  flex-direction: row;
  padding: 16px;
  gap: 8px;
  background: #0066FF;
  color: white;
  border-radius: 8px;
  width: fit-content;
">
  Click me
</button>
\`\`\`

### Step 2: Extract Patterns
- Container: \`<button>\` → frame with HORIZONTAL layout
- \`padding: 16px\` → padding: 16
- \`gap: 8px\` → itemSpacing: 8
- \`background: #0066FF\` → set_fills
- \`width: fit-content\` → **HUG mode**
- \`border-radius: 8px\` → set_corner_radius
- Text: "Click me" → create_text

### Step 3: Translate to Figma
\`\`\`typescript
// Validate
validate_design_tokens({
  spacing: [8, 16],
  typography: [{ fontSize: 16 }],
  colors: [{ foreground: "#FFFFFF", background: "#0066FF" }]
});

// Create frame (button container)
create_frame({
  name: "Button",
  layoutMode: "HORIZONTAL",
  padding: 16,
  itemSpacing: 8
});

// Set width mode (fit-content → HUG)
set_layout_sizing({
  nodeId: "button-frame",
  horizontal: 'HUG',
  vertical: 'HUG'
});

// Background
set_fills({
  nodeId: "button-frame",
  color: "#0066FF"
});

// Rounded corners
set_corner_radius({
  nodeId: "button-frame",
  radius: 8
});

// Text
create_text({
  content: "Click me",
  fontSize: 16,
  fontWeight: 600,
  color: "#FFFFFF",
  parentId: "button-frame"
});
\`\`\`

**Key Lesson**: \`width: fit-content\` in CSS = HUG mode in Figma. Button shrink-wraps to text.

---

## Example 3: Input Field (Step-by-step alternative)

**User Request**: "Create an email input field with label"

### Step 1: HTML Mental Model
\`\`\`html
<div class="field-group" style="display: flex; flex-direction: column; gap: 8px;">
  <label style="font-weight: 600;">Email</label>
  <input
    type="email"
    placeholder="you@example.com"
    style="
      width: 100%;
      height: 48px;
      padding: 16px;
      background: #F7FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
    "
  />
</div>
\`\`\`

### Step 2: Extract Patterns
- Container: \`<div>\` with column layout → VERTICAL frame
- \`gap: 8px\` → itemSpacing: 8
- Label: \`<label>\` → create_text
- Input: \`<input>\` → frame with HORIZONTAL layout
- **Input width: 100%** → **FILL mode** (critical!)
- Input height: 48px → FIXED height
- \`padding: 16px\` → padding: 16
- \`background\` → set_fills
- \`border\` → set_stroke

### Step 3: Translate to Figma
\`\`\`typescript
// Field group container
create_frame({
  name: "Email Field",
  layoutMode: "VERTICAL",
  itemSpacing: 8
});

// Label text
create_text({
  content: "Email",
  fontSize: 16,
  fontWeight: 600,
  color: "#2D3748",
  parentId: "field-group"
});

// Input frame
create_frame({
  name: "Email Input",
  layoutMode: "HORIZONTAL",
  padding: 16,
  parentId: "field-group"
});

// **CRITICAL**: width: 100% → FILL mode
set_layout_sizing({
  nodeId: "input-frame",
  horizontal: 'FILL',  // width: 100%
  vertical: 'FIXED'
});

// Fixed height — set via create_frame({ height: 48 }) or resize after creation

// Background
set_fills({
  nodeId: "input-frame",
  color: "#F7FAFC"
});

// Border
set_stroke({
  nodeId: "input-frame",
  strokeWeight: 1,
  strokeColor: "#E2E8F0",
  strokeAlign: "INSIDE"
});

// Corner radius
set_corner_radius({
  nodeId: "input-frame",
  radius: 8
});

// Placeholder text
create_text({
  content: "you@example.com",
  fontSize: 16,
  fontWeight: 400,
  color: "#A0AEC0",
  parentId: "input-frame"
});
\`\`\`

**Key Lesson**: \`width: 100%\` in CSS = FILL mode in Figma. Input adapts to container width - no cutoff!

---

## Example 4: Card Component (Step-by-step alternative)

**User Request**: "Create a product card with image, title, and description"

### Step 1: HTML Mental Model
\`\`\`html
<div class="card" style="
  display: flex;
  flex-direction: column;
  width: 320px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
">
  <img src="product.jpg" style="width: 320px; height: 200px;" />

  <div class="content" style="padding: 24px; gap: 16px; display: flex; flex-direction: column;">
    <h3 style="font-size: 24px; font-weight: 700;">Product Name</h3>
    <p style="font-size: 16px; color: #666;">Description goes here</p>
  </div>
</div>
\`\`\`

### Step 2: Extract Patterns
- Card container: VERTICAL layout
- **Card width: 320px** → FIXED (needed for image sizing)
- Image: 320×200 → FIXED dimensions
- Content: VERTICAL layout with gap
- Title: 24px bold text
- Description: 16px regular text

### Step 3: Translate to Figma
\`\`\`typescript
// Card container
create_frame({
  name: "Product Card",
  layoutMode: "VERTICAL",
  itemSpacing: 0
});

// Fixed width — set via create_frame({ width: 320, horizontalSizing: 'FIXED' })

// Background
set_fills({
  nodeId: "card",
  color: "#FFFFFF"
});

// Rounded corners
set_corner_radius({
  nodeId: "card",
  radius: 12
});

// Shadow
apply_effects({
  nodeId: "card",
  effects: [{
    type: "DROP_SHADOW",
    offsetX: 0,
    offsetY: 4,
    blur: 16,
    color: "#000000",
    opacity: 0.08
  }]
});

// Image placeholder
create_frame({
  name: "Image",
  layoutMode: "NONE",
  parentId: "card"
});

// Dimensions set via create_frame({ width: 320, height: 200 }) above

set_fills({
  nodeId: "image",
  color: "#E5E5E5"
});

// Content container
create_frame({
  name: "Content",
  layoutMode: "VERTICAL",
  padding: 24,
  itemSpacing: 16,
  parentId: "card"
});

// Title
create_text({
  content: "Product Name",
  fontSize: 24,
  fontWeight: 700,
  color: "#000000",
  parentId: "content"
});

// Description
create_text({
  content: "Description goes here",
  fontSize: 16,
  fontWeight: 400,
  color: "#666666",
  parentId: "content"
});
\`\`\`

**Key Lesson**: Fixed width (320px) is OK when you have images with specific dimensions. But text containers inside should still be responsive.

---

## Width Strategy Summary

| HTML CSS Pattern | Figma Approach | Use Case |
|------------------|----------------|----------|
| \`width: 100%\` | FILL mode | Input fields, content areas |
| \`width: fit-content\` | HUG mode | Buttons, labels, badges |
| \`width: 320px\` | FIXED | Images, fixed-width cards |

## Common Patterns

### Login Form
\`\`\`html
<form style="display: flex; flex-direction: column; gap: 24px;">
  <input style="width: 100%;" />  <!-- FILL -->
  <button style="width: fit-content;">  <!-- HUG -->
</form>
\`\`\`

### Sidebar Navigation
\`\`\`html
<nav style="width: 240px;">  <!-- FIXED -->
  <a style="width: 100%;">Home</a>  <!-- FILL -->
  <a style="width: 100%;">About</a>  <!-- FILL -->
</nav>
\`\`\`

### Dashboard Card
\`\`\`html
<div class="card" style="padding: 24px;">  <!-- HUG or FIXED -->
  <h2>Stats</h2>
  <div class="stat" style="width: 100%;">  <!-- FILL -->
</div>
\`\`\`

---

**Remember**: ALWAYS think HTML first, then translate to Figma. The width strategy comes naturally from CSS.
`;

export function getFewShotPrompt(): string {
  return FEW_SHOT_PROMPT;
}
