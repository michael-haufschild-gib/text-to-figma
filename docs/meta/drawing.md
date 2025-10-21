Purpose: Convert a vague concept into a clean vector graphic in Figma.

## Core Workflow Principles
- Three-phase structure: define purpose → collect visual pieces → bring together
- Start simple: basic shapes → boolean ops → pen/vector edit
- Pixel grid discipline for icons; path simplification for performance
- Visual hierarchy, color harmony (3-color family), composition via grids
- Organization: layer naming, components, simple design system
- Non-destructive boolean workflow encourages safe iteration

## 1) Phase 1 — Define Purpose
Goal: Make the drawing task unambiguous.
- Write one-line intent: “[concept], [style/feel], for [medium].”
- Scope: icon = minimal features; illustration = more forms and shading.

## 2) Phase 2 — Collect Visual Pieces
Goal: Break the idea into simple geometric parts and relationships.
- Decompose into primitives: circles, ellipses, rectangles, triangles, and lines; map each element to the simplest shapes that capture its form.
- Choose composition grammar: for icons, symmetry and strong silhouette; for illustrations, readable forms and overlaps.
- Rough diagram on canvas with basic shapes only; ignore color and detail.

Acceptance: all major parts represented with simple shapes; overall silhouette recognizable.

## 3) Phase 3 — Bring Together
Goal: Transform the rough composition into a clean vector.
1) Structure
  - Create frame at target size; add layout grid (icons: 8px; others: 8–16px).
2) Build
  - Block forms with basic shapes; prioritize silhouette clarity.
  - Use boolean ops: Union to merge, Subtract for cutouts, Intersect/Exclude for overlaps. Keep non-destructive.
3) Refine
  - Enter vector edit: minimize points, smooth bezier handles, remove kinks.
  - Simplify paths conservatively; verify shape integrity.
4) Style
  - Apply a single fill first. For icons: consistent stroke weight (e.g., 2px @24px).
  - If depth needed, add one gradient (linear/radial). Avoid tiny details at icon sizes.
5) Organize
  - Name layers immediately with neutral, descriptive labels (e.g., subject-primary, subject-secondary-1).
  - Group related parts; convert repeated elements to components when reused.

Acceptance: crisp silhouette, minimal points, clear hierarchy, named layers.

## 4) Decision rules you can apply automatically
- Shapes first: if a form can be made with primitives + booleans, do that before Pen.
- Pen usage: only for curves/forms not achievable via shapes; keep points minimal.
- Icon sizes: 16/24/32 px; keep strokes consistent across a set.
- Components: when an element repeats ≥2 times or you’re building a set.

## 5) QA checklist (must pass)
Technical
- For icons: frame size in 8px multiples; pixel grid + snapping used; edges align to pixels.
- Paths simplified; no redundant points; bezier curves smooth.
- Consistent stroke weights for all similar parts.
Design
- Visual hierarchy obvious (primary forms read first; details secondary).
- Palette limited and harmonious (main/support/accent ≈ 60/30/10 when applicable).
- Balanced composition with grid-based alignment; adequate whitespace.
Organization
- All layers named descriptively; related elements grouped.
- Boolean operations non-destructive (until final flatten if required).

Export readiness: SVG primary; PNG at needed scales; correct color mode.

## 6) Recipe templates (concept-agnostic)
Use these fill-in-the-blank sequences for any subject.

A) Icon (24×24 or 32×32)
1) Define purpose: “[concept] icon, legible at [size]px, [style].”
2) Setup: Frame [size]×[size]; add 8px grid; enable pixel grid + snap.
3) Collect pieces (shapes only): identify primary silhouette shapes (rects/ellipses) and a minimal set of secondary shapes.
4) Bring together: Union for merges; Subtract for cutouts; Intersect/Exclude for overlaps; keep non-destructive; refine with vector edit and simplify.
5) Style: single fill or consistent stroke (e.g., 2px at 24px); avoid details below 1px.
6) Organize: name layers (subject-primary, subject-secondary-1…); group; componentize if part of a set.
7) QA: sharp at 100%; crisp edges; simplified paths; consistent strokes; clear silhouette.

B) Illustration (custom frame)
1) Define purpose: “[concept] illustration, [style], [target frame].”
2) Setup: Create frame (e.g., 800×600); grid 8–16px.
3) Collect pieces: block primary masses with basic shapes; reserve Pen for curves only where shapes can’t achieve the form.
4) Bring together: non-destructive booleans for form/depth; vector edit to minimize points; simplify paths.
5) Style: apply 3-color family (main/support/accent ≈ 60/30/10); optional subtle gradients for volume.
6) Organize: group by functional regions; consistent naming.
7) QA: balanced composition; clear focal area; smooth curves; limited palette; tidy layers.
