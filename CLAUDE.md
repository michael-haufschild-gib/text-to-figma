=== CRITICAL INSTRUCTION BLOCK (CIB-001)===

## MANDATORY TOOLS

### For Complex Tasks (research, analysis, debugging)
```
USE: mcp__mcp_docker__sequentialthinking
WHEN: Multi-step problems, research, complex reasoning
WHY: Prevents cognitive overload, ensures systematic approach
```

### For Task Management
```
USE: TodoWrite
WHEN: Any task with 3+ steps
WHY: Tracks progress, maintains focus
```

## MANDATORY CODE STYLE AND ARCHITECTURE RULES
Coding agents must follow .claude/meta/styleguide.md - No exceptions!

## MANDATORY EXECUTION PROTOCOL
1. Always complete all tasks fully. Do not simplify approaches, do not skip tasks.
2. Always keep tests up to date and maintain 100% test coverage.
3. Always test. 100% of tests must pass.
4. Always fix bugs. Never changes tests only to make them pass if the cause is in the code it is testing.
5. Never run Vitest in watch mode; automation must use `npm test`. Only set `ALLOW_VITEST_WATCH=1` when a human explicitly authorizes interactive debugging.
6. **CRITICAL**: After implementing new functionality, ALWAYS create comprehensive tests:
   - Unit tests for logic and components (Vitest)
   - Integration tests for game flow
   - Playwright tests for frontend functionality (must visually confirm UI works)
   - All tests must be in `src/tests/` or `scripts/playwright/`
   - Run ALL tests before considering task complete
   - Maintain 100% test coverage - no exceptions

=== END CONSTITUTIONAL PRINCIPLES ===

## High-Level Data Flow

**Co-located Metadata System** - The project uses component-based metadata where folder structure IS the single source of truth:

1. **Component Level**: Each animation component exports its own metadata:
   - `export const metadata: AnimationMetadata = { id, title, description, tags }`
   - Metadata lives next to implementation (no external config files)

2. **Group Aggregation**: Each group's `index.ts` aggregates all animations:
   - Imports all animation components + their metadata exports
   - Exports `groupMetadata: GroupMetadata` (id, title, tech, demo)
   - Exports `groupExport: GroupExport` combining group metadata with animations

3. **Category Aggregation**: Each category's `index.ts` aggregates all groups:
   - Imports all group exports
   - Exports `categoryMetadata: CategoryMetadata` (id, title)
   - Exports `categoryExport: CategoryExport` combining category metadata with groups

4. **Central Registry** (`src/components/animationRegistry.ts`):
   - Imports all category exports
   - Exports `categories: Record<string, CategoryExport>` (hierarchical registry)
   - Provides `buildRegistryFromCategories()` helper (flattens to id→component map)
   - Provides `getAnimationMetadata(id)` helper (retrieves metadata by id)

5. **Data Service** (`src/services/animationData.ts`):
   - Builds catalog from category exports (not external JSON)
   - Transforms hierarchical registry into UI-friendly Category[] structure
   - Exposes through `animationDataService` for hooks/components

6. **UI Consumption**: `GroupSection` uses `buildRegistryFromCategories()` to get flat id→component mapping and renders each animation inside `AnimationCard`.

## File/Folder Layout

```
src/
├─ components/
│  ├─ ui/                     // Catalog UI (CategorySection, GroupSection, AnimationCard)
│  ├─ <category-id>/          // One folder per category (folder structure defines hierarchy)
│  │  ├─ index.ts             // Category aggregation (exports categoryExport)
│  │  └─ <group-id>/          // One folder per group within that category
│  │     ├─ index.ts          // Group aggregation (exports groupExport)
│  │     ├─ framer/           // Framer Motion components + metadata exports
│  │     ├─ css/              // CSS-animation components and styles
│  │     └─ shared assets     // Shared CSS/TS utilities that remain at group root
│  ├─ animationRegistry.ts    // Central registry (exports categories + helpers)
├─ services/animationData.ts  // Builds catalog from component exports
├─ hooks/useAnimations.ts     // Loads catalog data for the app
├─ types/animation.ts         // Core types (metadata types, export types)
```

## Locating an Animation Component

Given an animation id `category-group__variant` :

1. Split the id into parts:
   - Category id → folder name under `src/components/` (e.g. `modal-base__scale-gentle-pop` ⇒ category `dialogs`).
   - Group id → folder inside the category (e.g. `modal-base`).
2. Inside `src/components/<category>/<group>/framer/` or `css/`, open the component whose filename is the PascalCase version of the animation id (e.g. `ModalBaseScaleGentlePop.tsx`).
3. Each component should include only the DOM necessary for the animation and import its own stylesheet from the group's `css/` folder (or shared CSS at the root when reused). Avoid shared or global CSS.

## Rendering Context

- Components render as children of `<AnimationCard>` inside `GroupSection` (both in `src/components/ui`). The card supplies the title, description, replay button, and `.pf-demo-canvas` wrapper. Do not duplicate those wrappers inside the animation component.
- Components should render deterministic DOM and handle a replay by restarting animations when remounted. The replay button remounts the child by toggling a key.
