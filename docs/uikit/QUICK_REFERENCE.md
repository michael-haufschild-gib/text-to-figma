# UI Kit Quick Reference Guide

One-page cheat sheet for rapid component recreation.

## 🎨 Foundations Quick Lookup

### Colors (Most Used)

```
Primary:    #25ECFF (cyan)
Secondary:  #C6FF77 (lime)
Background: #1D092F (dark purple)
Text:       #1D092F (dark purple)
Error:      #DD1717 (red)
Success:    #11DF16 (green)
Warning:    #FFCE1A (yellow)
Info:       #2A9CFF (blue)
White:      #FFFFFF
Border:     #CEB6D8 (base70)
```

### Typography Quick Reference

```
Font Family: Lato
Weights: 400 (Regular), 500 (Medium), 700 (Bold)

Headings:
H1: 48px / 700
H2: 32px / 700
H3: 24px / 700
H4: 20px / 700
H5: 18px / 700
H6: 16px / 700

Body:
Large:  16px / 400
Medium: 14px / 400
Small:  12px / 400

Button: 10-16px / 500 / UPPERCASE
```

### Spacing (8pt Grid)

```
XS:  4px
S:   8px
M:   16px (base)
L:   24px
XL:  32px
2XL: 48px
3XL: 64px

Common Usage:
- Button padding: 12-32px H, 6-16px V
- Card padding: 16-24px
- Field spacing: 24px
- Modal padding: 24px
```

## 🔘 Button Recipes

### Primary Button (MD)

```
Frame: 120×50px, H-layout, padding(20,10), gap:8
Fill: #25ECFF
Corner: 8px
Text: fontSize:14, weight:500, color:#1D092F, UPPER
```

### Secondary Button (MD)

```
Frame: 120×50px, H-layout, padding(20,10), gap:8
Fill: transparent
Border: #25ECFF, 2px
Corner: 8px
Text: fontSize:14, weight:500, color:#25ECFF, UPPER
```

### Ghost Button (MD)

```
Frame: 100×50px, H-layout, padding(16,10), gap:8
Fill: transparent
Text: fontSize:14, weight:500, color:#25ECFF, UPPER
```

## 📝 Form Field Recipes

### Text Input (Default)

```
Root: 320×62px, V-layout, gap:4

Label: fontSize:12, color:#A88FB6
Field: 320×48px, H-layout, gap:8
  - Icon: 16×16 (optional)
  - Text: fontSize:16, color:#8C6C9C
  - Icon: 16×16 (optional)
Help: fontSize:12, color:#A88FB6
```

### Input Error State

```
Same as default BUT:
- Border: #DD1717, 2px
- Help text color: #DD1717
- Add error icon (16×16)
```

### Input Focus State

```
Same as default BUT:
- Border: #25ECFF, 2px
- Add glow effect
```

### Checkbox

```
Box: 20×20px, corner:4px
Unchecked: border:#8C6C9C, 2px
Checked: fill:#25ECFF, checkmark:#1D092F
Label: 8px spacing, fontSize:14
```

### Radio Button

```
Circle: 20×20px, circular
Unselected: border:#8C6C9C, 2px
Selected: fill:#25ECFF, inner circle:8×8 #1D092F
Label: 8px spacing, fontSize:14
```

## 🃏 Card Recipes

### Thumbnail Card

```
Frame: 112×149px
Corner: 8px
Fill: Image
Shadow: y:2, blur:8, opacity:0.15
```

### Payment Card

```
Frame: 370×66px, H-layout, padding(16,12), gap:12
Fill: #FFFFFF
Border: #CEB6D8, 1px
Corner: 8px

Children:
- Radio: 20×20
- Logo: 40×24
- Info: V-layout, gap:4
  * Number: fontSize:14, weight:500
  * Expiry: fontSize:12, color:#8C6C9C
- Actions: H-layout, gap:8
  * Edit: 32×32
  * Delete: 32×32

Selected: Border → #25ECFF, 2px
```

### Coin Pack Card

```
Frame: 176×264px, V-layout, corner:12
Gradient: #FFD700 → #FFA500
Shadow: y:4, blur:16, opacity:0.2

Sections:
- Hero: 176×120 (gradient/image)
- Amount: fontSize:16, weight:700, UPPER
- Divider: 1px line
- Title: fontSize:12, weight:700, UPPER
- Icon: 60×60
- Button: 144×40
```

## 🪟 Modal Recipes

### Informational Modal

```
Overlay: Full viewport, #1D092F @ 0.6
Modal: 366px width, V-layout, corner:16
Fill: #FFFFFF
Shadow: y:8, blur:32, opacity:0.25

HEADER (67px):
  Padding: 24px
  Border-bottom: #E5DBE9, 1px
  - Title: fontSize:20, weight:700
  - Close: 24×24 icon

BODY (variable):
  Padding: 24px
  Gap: 16px
  - Content: fontSize:14, lineHeight:21

FOOTER (128px):
  Padding: 24px
  Border-top: #E5DBE9, 1px
  - Actions: H-layout, gap:16, align:right
    * Secondary button: MD
    * Primary button: MD
```

### Marketing Modal

```
Same as Informational BUT:
- Width: 383px
- Hero image: 383×200, corner:16 16 0 0
- Title: fontSize:24, weight:700, CENTER
- Description: fontSize:16, CENTER
- CTA: Full-width primary button (LG)
```

## ⚡ Lightning Fast Commands

### Create Primary Button

```
create_frame + set_fills(#25ECFF) + set_corner_radius(8) +
create_text("BUTTON", 14, 500, #1D092F) + set_text_case(UPPER)
```

### Create Input Field

```
create_frame(V, 320) + create_text(label, 12, #A88FB6) +
create_frame(H, field) + create_text(placeholder, 16, #8C6C9C) +
create_text(help, 12, #A88FB6)
```

### Create Modal

```
create_frame(overlay) + create_frame(modal, 366, V, corner:16) +
apply_effects(shadow) +
create_frame(header, padding:24, border-bottom) +
create_frame(body, padding:24) +
create_frame(footer, padding:24, border-top)
```

## 🎯 Common Patterns

### Selection States

```
Default:  border:#CEB6D8, 1px
Hover:    border:#25ECFF, 1px
Selected: border:#25ECFF, 2px
Focus:    border:#25ECFF, 2px + glow
```

### Validation States

```
Default: border:#CEB6D8, 1px
Error:   border:#DD1717, 2px + error icon + red text
Success: border:#11DF16, 2px + success icon + green text
```

### Elevation (Shadows)

```
Level 1: y:2, blur:8, opacity:0.15
Level 2: y:4, blur:16, opacity:0.2
Level 4: y:8, blur:32, opacity:0.25
```

### Corner Radius

```
Buttons:  8px
Cards:    8px
Modals:   16px
Pills:    18px (half height)
Checkbox: 4px
Radio:    50% (circular)
```

## 📦 Component Combinations

### Modal + Login Form

```
Modal (366px) →
  Header (title + close) →
  Body (email input + password input + checkbox) →
  Footer (cancel + login buttons)
```

### Card + Selection

```
Card (370×66) →
  Radio button + Logo + Info (number + expiry) + Actions
```

### Promotional Card

```
Card (176×264) →
  Gradient background + Amount + Divider + Title + Icon + Button
```

## 🔍 Where to Find More

- **Detailed specs**: See individual .json files
- **Full examples**: See `index.json` → usageExamples
- **Complete guide**: See `README.md`

---

**Pro Tip**: Use this page for quick lookups during development. For detailed recreation instructions, refer to the specific component .json file.
