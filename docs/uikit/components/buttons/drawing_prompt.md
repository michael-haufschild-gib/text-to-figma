# Task: Draw Button Components from JSON Specification

## Objective

Read the extracted button data from `docs/uikit/components/buttons.json` and recreate ALL button variants in Figma using the `create_design()` tool with EXACT property matching.

## Critical Requirements

1. **Read the JSON file first** - All specifications are in `docs/uikit/components/buttons.json`
2. **Create ALL button variants** - Primary, Secondary, and Ghost types in ALL sizes (2XL, XL, LG, MD, SM, XS)
3. **Match properties exactly** - Colors, dimensions, spacing, typography must be pixel-perfect
4. **Use create_design() only** - Single atomic operation per button for consistency
5. **Name each button** - Format: `{Type}_{Size}_Drawn` (e.g., "Primary_2XL_Drawn")

## Button Specifications Overview

### Primary Buttons (Pink/Red Gradient)

- **Gradient**: Linear vertical (90°), #FF5981 → #C83558
- **Stroke**: 2px inside, #FF749C
- **Text**: White (#FFFFFF), Lato Black (900 weight), CENTER aligned
- **Corner Radius**: 50px (pill shape)
- **Layout**: HORIZONTAL, itemSpacing=10, padding=10
- **Sizes**: 2XL (180×70), XL (160×64), LG (140×58), MD (120×50), SM (100×42), XS (80×32)

### Secondary Buttons (Teal/Cyan Gradient)

- **Gradient**: Linear vertical (90°), #47FFF4 (0%) → #0586AE (93.2%)
- **Stroke**: 2px inside, #9FFFF8
- **Text**: White (#FFFFFF), Lato Black (900 weight), LEFT aligned
- **Corner Radius**: 50px (pill shape)
- **Layout**: HORIZONTAL, itemSpacing=10, padding=10
- **Sizes**: 2XL (180×70), XL (160×64), LG (140×58), MD (120×50), SM (100×42), XS (80×33.6)

### Ghost Buttons (Transparent with Stroke)

- **Fill**: Transparent (#FFFFFF with opacity=0)
- **Stroke**: 2px inside, #25ECFF
- **Text**: Cyan (#25ECFF), Lato Black (900 weight), CENTER aligned
- **Corner Radius**: 50px (pill shape)
- **Layout**: HORIZONTAL, itemSpacing=10, padding=10
- **Sizes**:
  - 2XL-MD: AUTO sizing (HUG content)
  - SM: 100×42 (fixed)
  - XS: 80×32 (fixed), 1.5px stroke

## Implementation Steps

### For EACH button variant:

1. **Read size specifications from JSON**

   ```
   buttonTypes.{Type}.sizes.{Size}
   ```

2. **Create using create_design() with this exact structure**:

#### For Primary/Secondary Buttons:

```typescript
{
  spec: {
    type: 'frame',
    name: '{Type}_{Size}_Drawn',
    props: {
      width: <from JSON>,
      height: <from JSON>,
      layoutMode: 'HORIZONTAL',
      padding: 10,
      itemSpacing: 10,
      cornerRadius: 50
    },
    children: [
      {
        type: 'text',
        props: {
          content: 'BUTTON',
          fontSize: <from JSON>,
          fontFamily: 'Lato',
          fontWeight: 900,
          color: '#FFFFFF',
          textAlign: <'CENTER' for Primary, 'LEFT' for Secondary>
        }
      }
    ]
  }
}
```

3. **After creation, apply gradient fill**:

   ```typescript
   add_gradient_fill({
     nodeId: <created frame ID>,
     type: 'LINEAR',
     angle: 90,
     stops: <from JSON gradient.stops>
   })
   ```

4. **Apply stroke**:
   ```typescript
   set_stroke({
     nodeId: <created frame ID>,
     strokeWeight: 2,
     strokeColor: <from JSON stroke.color>,
     strokeAlign: 'INSIDE'
   })
   ```

#### For Ghost Buttons (2XL-MD sizes with AUTO):

```typescript
{
  spec: {
    type: 'frame',
    name: 'Ghost_{Size}_Drawn',
    props: {
      layoutMode: 'HORIZONTAL',
      padding: 10,
      itemSpacing: 10,
      cornerRadius: 50,
      horizontalSizing: 'HUG',  // AUTO width
      verticalSizing: 'HUG'      // AUTO height
    },
    children: [
      {
        type: 'text',
        props: {
          content: 'BUTTON',
          fontSize: <from JSON>,
          fontFamily: 'Lato',
          fontWeight: 900,
          color: '#25ECFF',
          textAlign: 'CENTER'
        }
      }
    ]
  }
}
```

Then apply:

```typescript
set_fills({ nodeId: <frame ID>, color: '#FFFFFF', opacity: 0 })
set_stroke({ nodeId: <frame ID>, strokeWeight: 2, strokeColor: '#25ECFF', strokeAlign: 'INSIDE' })
```

#### For Ghost Buttons (SM/XS sizes with FIXED):

```typescript
{
  spec: {
    type: 'frame',
    name: 'Ghost_{Size}_Drawn',
    props: {
      width: <from JSON>,
      height: <from JSON>,
      layoutMode: 'HORIZONTAL',
      padding: 10,  // Note: SM/XS have special padding object in JSON
      itemSpacing: 10,
      cornerRadius: 50
    },
    children: [
      {
        type: 'text',
        props: {
          content: 'BUTTON',
          fontSize: <from JSON>,
          fontFamily: 'Lato',
          fontWeight: <700 for XS, 900 for SM>,
          color: '#25ECFF',
          textAlign: 'CENTER'
        }
      }
    ]
  }
}
```

## Important Details to Match Exactly

### From JSON - Critical Properties:

1. **Gradient stops** - Use EXACT position values (e.g., Secondary stop at 0.932, not 1.0)
2. **Font sizes** - Match decimal values (e.g., Ghost MD is 12.74, not 12)
3. **Dimensions** - Match decimals (e.g., Secondary XS height is 33.6, not 34)
4. **Stroke weight** - Ghost XS uses 1.5px, Secondary XS uses 1.6px
5. **Text alignment** - Primary/Ghost are CENTER, Secondary is LEFT
6. **Text case** - XS buttons use UPPER case transformation

### Color Reference (from JSON):

- Primary gradient: #FF5981 → #C83558
- Primary stroke: #FF749C
- Secondary gradient: #47FFF4 → #0586AE
- Secondary stroke: #9FFFF8
- Ghost stroke/text: #25ECFF

## Output Requirements

After completing ALL buttons, you should have created:

- **18 total buttons** (3 types × 6 sizes)
- Each named with format: `{Type}_{Size}_Drawn`
- All positioned in Figma canvas
- All properties matching JSON exactly

## Verification Checklist

Before finishing, verify:

- [ ] All 18 buttons created
- [ ] Gradients use correct colors and stop positions
- [ ] Strokes are 2px (except Ghost XS: 1.5px, Secondary XS: 1.6px)
- [ ] Corner radius is 50px for all
- [ ] Font is Lato Black (900) for all except Ghost XS (700)
- [ ] Text alignment: Primary/Ghost CENTER, Secondary LEFT
- [ ] Ghost buttons 2XL-MD use AUTO sizing
- [ ] Ghost buttons SM/XS use FIXED sizing
- [ ] All dimensions match JSON (including decimals)

## Expected Tool Usage

Total tool calls: ~54-72

- 18× create_design (one per button)
- 18× add_gradient_fill (for Primary/Secondary) or set_fills (for Ghost)
- 18× set_stroke (one per button)

Complete this task systematically - one button type at a time, one size at a time.
