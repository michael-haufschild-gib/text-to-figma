# UI Kit Documentation

Complete documentation of all UI components and design foundations extracted from the Figma UI kit, enabling recreation of components in new files without access to the original design system.

## 📁 File Structure

```
docs/uikit/
├── index.json              # Master catalog and quick reference
├── foundations/
│   ├── colors.json         # 34 colors with hex values
│   ├── typography.json     # Font system and text styles
│   └── spacing.json        # 8pt grid spacing scale
└── components/
    ├── buttons.json        # 38 button variants
    ├── forms.json          # Input, checkbox, radio, pill, selector
    ├── cards.json          # Thumbnail, payment, coin pack cards
    └── modals.json         # Informational and marketing popups
```

## 🎯 Quick Start

1. **Start with `index.json`** - Master catalog with overview and quick reference
2. **Check foundations** - Colors, typography, spacing for design tokens
3. **Find your component** - Look up specific component in appropriate .json file
4. **Follow recreation guide** - Step-by-step instructions in each file

## 📚 What's Documented

### Foundations (Atoms)

- **Colors** - 34 colors across base, brand, system categories with hex values
- **Typography** - Lato font family, 10 font sizes, 3 weights, text styles
- **Spacing** - 15 spacing values (2px-80px) based on 8pt grid

### Components

#### Buttons (`buttons.json`)

- **Types**: Primary, Secondary, Ghost
- **Sizes**: XS, SM, MD, LG, XL, 2XL
- **States**: Default, Disabled
- **Total**: 38 documented variants

#### Forms (`forms.json`)

- **Input**: 12 states (Default, Filled, Hover, Focus, Error, Success, Disabled)
- **Checkbox**: Checked/Unchecked/Disabled
- **Radio**: Selected/Unselected/Disabled
- **Pill**: Default/Selected (tag-like selectors)
- **Selector**: Default/Open/Selected (dropdowns)

#### Cards (`cards.json`)

- **Thumbnail**: 112×149px game cards
- **Payment Card**: 370×66px with selection states
- **Coin Pack**: 176×264px promotional cards
- **Provider**: Game provider filter cards

#### Modals (`modals.json`)

- **Informational**: 366×229px alert/confirmation modals
- **Marketing**: 383×439px promotional popups
- **Structure**: Header (title + close) → Body (content) → Footer (actions)

## 💡 Usage Examples

### Example 1: Create a Primary Button (Medium)

```javascript
// Reference: buttons.json → variants.primary.sizes.MD
// Colors: colors.json → brandAccentPrimary, base0
// Typography: typography.json → fontMD

1. create_frame({
   layoutMode: "HORIZONTAL",
   padding: { h: 20, v: 10 },
   itemSpacing: 8
})
2. set_fills({ color: "#25ECFF" }) // brandAccentPrimary
3. set_corner_radius({ radius: 8 })
4. create_text({
   content: "BUTTON",
   fontSize: 14,
   fontWeight: 500,
   color: "#1D092F" // base0
})
5. set_text_case({ textCase: "UPPER" })

Result: 120×50px cyan button with dark text
```

### Example 2: Create a Modal with Login Form

```javascript
// Reference: modals.json (informational), forms.json (input), buttons.json
// Combines 3 component types

1. Create overlay (full viewport, background: #1D092F @ 0.6 opacity)
2. Create modal frame (width: 400, cornerRadius: 16, shadow)
3. Add header section:
   - Title: "Login" (h3)
   - Close button (24×24 icon)
4. Add body section:
   - Email input (from forms.json structure)
   - Password input (from forms.json structure)
   - "Remember me" checkbox
5. Add footer section:
   - "Cancel" button (Secondary, MD)
   - "Login" button (Primary, MD)

Result: Complete login modal with validation-ready form
```

### Example 3: Create a Payment Card with Selection

```javascript
// Reference: cards.json → paymentCard
// Combines card structure with radio button from forms.json

1. Create frame (370×66px, horizontal layout, padding: 16/12)
2. Set background (#FFFFFF), border (#CEB6D8), cornerRadius: 8
3. Add radio button (20×20, unselected)
4. Add card logo (Mastercard/Visa, 40×24)
5. Add card info:
   - Card number: "**** 1234" (fontSize: 14, weight: 500)
   - Expiry: "Exp: 12/25" (fontSize: 12, color: #8C6C9C)
6. Add action buttons (edit, delete icons)

For selected state: Change border to #25ECFF (2px)
```

## 🔍 How to Use This Documentation

### Workflow

1. **Identify components** in your design (button, input, modal, etc.)
2. **Look up in index.json** for quick reference
3. **Open specific .json file** for detailed specs
4. **Check foundations** for colors, typography, spacing values
5. **Follow recreation guide** step-by-step instructions
6. **Test states** (hover, focus, error) for interactive elements

### Finding Information

**Need a color?**
→ `foundations/colors.json` → Find by name or hex value

**Need button specs?**
→ `components/buttons.json` → Find by type and size

**Need to build a form?**
→ `components/forms.json` → Input structure + states

**Need modal structure?**
→ `components/modals.json` → 3-section pattern

**Need quick reference?**
→ `index.json` → Component overview + examples

## 📋 Each Component File Contains

1. **Component Overview** - Description, ID, dimensions
2. **Structure** - Hierarchy and layout (HORIZONTAL/VERTICAL)
3. **Children** - Sub-components and their properties
4. **Styling** - Colors, borders, shadows, corner radius
5. **States** - Variants (hover, focus, error, disabled, etc.)
6. **Recreation Guide** - Step-by-step instructions with MCP tool calls
7. **Extraction Notes** - Source page, methodology, status

## 🎨 Design Tokens

All color values are provided as **hex codes** (not token references):

- Primary: `#25ECFF` (cyan)
- Secondary: `#C6FF77` (lime)
- Background: `#1D092F` (dark purple)
- Error: `#DD1717` (red)
- Success: `#11DF16` (green)

All spacing follows **8pt grid**:

- Button padding: 12-32px
- Card padding: 16-24px
- Field spacing: 24px
- Section spacing: 32-64px

## 🔗 Component Relationships

### Modals contain:

- Buttons (header close, footer actions)
- Forms (body content)
- Text (title, description)

### Forms contain:

- Inputs with validation states
- Checkboxes/radios for selection
- Buttons for submission

### Cards contain:

- Images/backgrounds
- Text content
- Optional action buttons

## ⚡ Pro Tips

1. **Start with foundations** - Always reference colors, typography, spacing first
2. **Use exact hex values** - Don't rely on token names in new files
3. **Follow 8pt grid** - Use spacing.json values for consistency
4. **Check all states** - Hover, focus, error, disabled for interactive components
5. **Combine components** - Modals + forms + buttons = complete UIs
6. **Test accessibility** - Verify color contrast for text elements
7. **Use auto-layout** - HORIZONTAL/VERTICAL for responsive components

## 🚀 Common Combinations

### Modal + Form + Buttons

Complete dialog with input fields and actions

### Card + Button

Promotional cards with CTAs (e.g., coin packs)

### Form + Validation

Input fields with error states and help text

### Card List + Selection

Selectable cards (e.g., payment methods)

## 📊 Statistics

- **Total colors**: 34 (base, brand, system, gradients)
- **Total buttons**: 38 variants (3 types × 6 sizes)
- **Total form components**: 5 (input with 12 states + 4 control types)
- **Total card types**: 4 (thumbnail, payment, coin pack, provider)
- **Total modal types**: 2 (informational, marketing)
- **Total spacing values**: 15 (2px-80px)
- **Total font sizes**: 10 (8px-48px)
- **Total text styles**: 14 (headings, paragraphs, component-specific)

## 📖 Documentation Status

✅ **COMPLETE** - Ready for production use

- All core foundations documented
- All critical components documented
- Recreation guides included
- Cross-references complete
- Usage examples provided

## 🎯 Your Goal Achieved

You can now ask to create:

- ✅ Primary button → `buttons.json`
- ✅ Modal with form (2 inputs + checkbox + buttons) → `modals.json` + `forms.json` + `buttons.json`
- ✅ Any form field with validation → `forms.json`
- ✅ Payment selection card → `cards.json`
- ✅ Promotional coin pack → `cards.json`

**All with exact color values (not tokens) and complete recreation instructions.**

## 🔮 Future Enhancements

Additional components to document:

- Accordions, dropdowns, switches, tags (Molecules)
- Headers, menus, banners (Organisms)
- Full page templates
- Animation specifications
- Responsive breakpoints

---

**Last Updated**: 2025-10-24
**Version**: 1.0.0
**Status**: Production Ready
