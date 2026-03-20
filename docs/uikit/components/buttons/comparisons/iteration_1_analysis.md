# Iteration 1 Analysis & Fixes

## Overall Accuracy: 53.65%

### Score Breakdown:

- ✅ Corner Radius: 100% - Perfect match
- ✅ Opacity: 100% - Perfect match
- ✅ Layout: 100% - Perfect match (layoutMode, itemSpacing, padding)
- ⚠️ Strokes: 79% - Mostly good, some issues
- ❌ Dimensions: 50% - All buttons wider than expected
- ❌ Fills: 0% - Critical issues with gradients and transparent fills
- ❌ Gradients: 0% - All angles inverted
- ❌ Typography: 0% - Not scored (needs implementation)

---

## Critical Issues Found

### 1. GRADIENT ANGLE INVERTED (Priority: CRITICAL)

**Impact:** All gradient buttons have wrong angle (0% fills score)

**Evidence:**

- Primary buttons: Expected 90°, got -90° (180° off)
- Secondary buttons: Expected 72.9°, got -72.9° (145.8° off)

**Root Cause:** `figma-plugin/code.ts:2254-2256`

```typescript
gradientTransform = [
  [cos, -sin, 0.5 + sin * 0.5 - cos * 0.5], // <-- -sin inverts the angle
  [sin, cos, 0.5 - sin * 0.5 - cos * 0.5]
];
```

**Fix:** Change `-sin` to `sin` in the first row:

```typescript
gradientTransform = [
  [cos, sin, 0.5 - sin * 0.5 - cos * 0.5], // Fixed: sin instead of -sin
  [-sin, cos, 0.5 + sin * 0.5 - cos * 0.5] // Fixed: -sin moved to second row
];
```

**Test:** After fixing, gradients should match the extracted transform matrices exactly.

---

### 2. FILL OPACITY NOT APPLIED (Priority: CRITICAL)

**Impact:** Transparent fills rendered as solid (0% fills score)

**Evidence:**

- Ghost buttons: Expected fill opacity: 0, got: 1
- All transparent backgrounds are showing as solid white

**Root Cause:** `create_design()` doesn't support fill opacity parameter

**Current code:**

```typescript
props: {
  fillColor: '#FFFFFF'; // Only sets color, not opacity
}
```

**Fix Options:**

**Option A:** Add fillOpacity parameter to create_design props

```typescript
// In create_design.ts tool
props: {
  fillColor: '#FFFFFF',
  fillOpacity: 0  // New parameter
}
```

**Option B (RECOMMENDED):** Use set_fills() after create_design()

```typescript
// After creating the frame
await set_fills({
  nodeId: result.rootNodeId,
  color: '#FFFFFF',
  opacity: 0
});
```

**Chosen Fix:** Option B (less invasive, uses existing tool)

---

### 3. DIMENSIONS MISMATCH (Priority: HIGH)

**Impact:** All buttons wider than expected (50% dimensions score)

**Evidence:**

- Expected width: 180px, Got: ~419px (2.3x wider)
- Height mostly correct (70px)

**Root Cause:** Sizing modes not correctly applied

- Original uses `primaryAxisSizingMode: 'FIXED'` with explicit width
- Drawn uses `horizontalSizing: 'HUG'` which expands to content

**Agent Code Issue (from drawing agent):**

```typescript
horizontalSizing: component.primaryAxisSizingMode === 'FIXED'
  ? 'FIXED'
  : component.primaryAxisSizingMode === 'AUTO'
    ? 'HUG'
    : 'FILL';
```

This mapping is WRONG. The correct mapping is:

- `primaryAxisSizingMode: 'FIXED'` → `horizontalSizing: 'FIXED'` ✅
- `primaryAxisSizingMode: 'AUTO'` → `horizontalSizing: 'HUG'` ✅
- `primaryAxisSizingMode: 'FILL'` → `horizontalSizing: 'FILL'` ❌ (should use counterAxisSizingMode for vertical)

**Fix:** Update drawing agent prompt to correctly set width property when FIXED:

```typescript
// For FIXED sizing mode in horizontal layout
if (component.primaryAxisSizingMode === 'FIXED') {
  props.width = component.bounds.width;
  props.horizontalSizing = 'FIXED';
}
```

---

### 4. STROKE COLOR/WEIGHT MISMATCH (Priority: MEDIUM)

**Impact:** Some buttons have wrong stroke properties (79% strokes score)

**Evidence:**

- Ghost button: Expected stroke weight 3.19px, got 2px
- Ghost button: Expected stroke color #25ecff, got #76f3ff
- Ghost button: Expected stroke opacity 1, got 0.4

**Root Cause:** Drawing agent selecting wrong data from JSON

The ghost button has TWO different stroke specifications:

1. Parent frame: `strokeWeight: 3.19, strokes[0].color: {r:0.145, g:0.925, b:1}, opacity: 1`
2. Shadow child: `strokeWeight: 2, strokes[0].color: different, opacity: 0.5`

**Fix:** Drawing agent must use parent-level stroke properties, not child properties

---

### 5. STROKE COLOR COMPLETELY WRONG (Priority: MEDIUM)

**Impact:** Secondary button has completely different stroke color

**Evidence:**

- Secondary: Expected #9ffff8 (cyan), got #2badd5 (blue) - completely different hue

**Root Cause:** Drawing agent extracting wrong stroke from JSON or gradient stop instead of stroke

**Fix:** Verify drawing agent is using `component.strokes[0].color` not `component.gradientStops[0].color`

---

## Fixes to Apply for Iteration 2

### Code Fixes (Autonomous):

1. **Fix gradient angle calculation** (`figma-plugin/code.ts:2254-2256`)
   - Change rotation matrix formula
   - Rebuild plugin: `cd figma-plugin && npm run build`

2. **Add fill opacity support to set_fills tool** (if needed)
   - OR document that set_fills already supports opacity
   - Verify: `set_fills({ nodeId, color, opacity })`

### Agent Prompt Fixes (Iteration 2):

3. **Drawing Agent Prompt Updates:**
   - Apply transparent fills AFTER create_design using set_fills with opacity
   - Use correct sizing mode mapping (FIXED + width, AUTO → HUG, not FILL)
   - Use parent-level stroke properties, not child stroke properties
   - Verify stroke color extraction uses `component.strokes[0].color` not gradientStops

---

## Expected Iteration 2 Results:

With all fixes applied:

- **Fills**: 0% → 100% (gradient angles fixed, transparent fills applied)
- **Strokes**: 79% → 100% (correct source data used)
- **Dimensions**: 50% → 100% (correct sizing + width)
- **Overall**: 53.65% → **95%+**

---

## Action Plan:

1. ✅ Fix gradient angle in Figma plugin
2. ✅ Rebuild plugin
3. ✅ Update drawing agent prompt with fixes
4. ▶️ Run Iteration 2 (re-draw with improved agent)
5. ▶️ Extract and compare
6. ▶️ Verify 95%+ accuracy achieved
