---
description: AUTONOMOUS Iterative Component Extraction & Replication with Empty-Context Agents
---

## Purpose

**FULLY AUTONOMOUS** workflow with **separate agents starting from empty context**:

1. **Agent A (Extractor)**: Empty context → Extract originals from Figma selection
2. **Agent B (Drawer)**: Empty context → Draw from extracted specs
3. **Agent C (Verifier)**: Empty context → Extract what was drawn
4. **Orchestrator (YOU)**: Compare, score, fix code/prompts, repeat

**Why Empty Context?** Simulates realistic production scenarios where agents execute weeks later without codebase knowledge.

**CRITICAL PRINCIPLES**:

- ❌ NEVER assume existing JSON files are correct - always re-extract
- ❌ NEVER stop at discovering bugs - fix them immediately
- ✅ ALWAYS use separate agents with empty context for extraction/drawing
- ✅ ALWAYS extract both originals AND drawn to compare
- ✅ ALWAYS attempt to fix MCP tools / Figma plugin code when issues found

## Prerequisites

1. **WebSocket server running** (auto-starts if needed)
2. **Only ONE Figma window open** (server enforces single-instance)
3. **Components selected in Figma**
4. **MCP server configured**

## Arguments

User will provide in their message:

1. **Parent node identifier** - How to find the original components:
   - Node name (e.g., "UIKit Buttons")
   - Node ID (e.g., "2846:8221")
   - Or "current selection" to use what's currently selected

2. **Output file path** - Where to save extracted styles:
   - e.g., "docs/uikit/components/buttons.json"

3. **Optional**: target_accuracy (default 95), max_iterations (default 10)

**Example user message:**

```
in figma selected is now the parent node that contains as children all buttons from our UIkit.
the extracted button styles are in docs/uikit/components/buttons.json
```

Parse this to extract:

- parent_node: "current selection" (or parse the node name/ID if provided)
- output_path: "docs/uikit/components/buttons.json"
- component_type: derive from path → "buttons"
- target_accuracy: 95 (default)
- max_iterations: 10 (default)

---

## AUTONOMOUS ITERATION LOOP

### Initialization

1. **Verify/Start WebSocket Server**:

   ```bash
   lsof -i :8080 || (cd websocket-server && node server.js &)
   ```

2. **Verify Figma Connection & Get Parent Node**:

   ```typescript
   // Test connection
   let parentNodeId;
   try {
     if (parent_node === 'current selection') {
       const selection = (await mcp__text) - to - figma__get_selection();
       if (selection.count === 0) {
         ERROR: 'No node selected in Figma. Please select the parent node.';
         STOP;
       }
       // Use first selected node as parent
       parentNodeId = selection.selection[0].id;
     } else if (parent_node.includes(':')) {
       // It's a node ID
       parentNodeId = parent_node;
     } else {
       // It's a node name - find it
       const result =
         (await mcp__text) -
         to -
         figma__get_node_by_name({
           name: parent_node,
           exactMatch: true
         });
       if (result.found === 0) {
         ERROR: `Node "${parent_node}" not found in Figma.`;
         STOP;
       }
       parentNodeId = result.nodes[0].id;
     }
   } catch (error) {
     ERROR: 'Figma plugin not connected. Please reload the plugin in Figma.';
     STOP;
   }
   ```

3. **Setup Directories**:

   ```bash
   mkdir -p docs/uikit/components/{component_type}/{originals,drawn,comparisons,exports}
   ```

4. **Initialize Iteration Log**

---

### For Each Iteration (1 to max_iterations):

#### Phase 1: EXTRACT ORIGINALS (Agent A - Empty Context)

**Launch extraction agent with ZERO context about codebase:**

```typescript
Task({
  subagent_type: 'general-purpose',
  description: 'Extract original button styles from Figma',
  prompt: `
You are an extraction agent. Your task is to extract UI component styles from Figma.

## Tools Available
- mcp__text-to-figma__get_children() - Get children of parent node
- mcp__text-to-figma__get_node_by_id() - Get node details by ID

## Task
1. Find the parent node by ID: ${parentNodeId}
2. Get all children of this parent node
3. For EACH child component, extract ALL properties:
   - nodeId, name, type, bounds (x, y, width, height)
   - fills (COMPLETE: type, color, gradientTransform, gradientStops, opacity)
   - strokes (COMPLETE: type, color, weight, align)
   - effects (COMPLETE: all shadows/blur with offset, blur, spread, color, opacity)
   - cornerRadius (all four corners if available)
   - layout properties (layoutMode, padding, itemSpacing, primaryAxisAlignItems, counterAxisAlignItems)
   - typography (fontSize, fontName, fontWeight, textAlignHorizontal, lineHeight, letterSpacing)
   - children (complete hierarchy with all properties)
4. Save to TWO locations:
   - Main file: ${output_path} (overwrites existing)
   - Iteration backup: docs/uikit/components/${component_type}/originals/iteration_${N}.json

## Output Format
{
  "timestamp": "ISO 8601",
  "iteration": ${N},
  "components": [
    {
      "nodeId": "...",
      "name": "...",
      "type": "FRAME" | "TEXT" | ...,
      "bounds": { "x": 0, "y": 0, "width": 100, "height": 50 },
      "fills": [...],  // Complete fill data
      "strokes": [...],  // Complete stroke data
      "effects": [...],  // Complete effects
      "cornerRadius": 8,
      "layout": { "mode": "HORIZONTAL", "padding": 10, "itemSpacing": 10, ... },
      "typography": { ... },  // If text node
      "children": [...]  // Recursive
    }
  ]
}

## Important
- Extract EVERYTHING from get_selection() response
- Don't skip any properties
- Preserve exact values (don't round)
- Save the complete JSON file
`
});
```

**Wait for agent completion**, then verify output exists.

#### Phase 2: DRAW FROM SPECS (Agent B - Empty Context)

**Launch drawing agent with ZERO context:**

```typescript
Task({
  subagent_type: 'general-purpose',
  description: 'Draw components from extracted specifications',
  prompt: `
You are a drawing agent. Your task is to recreate UI components in Figma from JSON specifications.

## Tools Available
- mcp__text-to-figma__create_design() - Creates hierarchical designs
- mcp__text-to-figma__add_gradient_fill() - Applies gradients
- mcp__text-to-figma__set_stroke() - Applies strokes
- mcp__text-to-figma__set_fills() - Applies solid fills
- mcp__text-to-figma__apply_effects() - Applies shadows/blur

## Input File
docs/uikit/components/${component_type}/originals/iteration_${N}.json

## Task
1. Read the originals JSON file
2. For EACH component:
   a. Create structure with create_design():
      - Match exact dimensions from bounds
      - Set layoutMode, padding, itemSpacing from layout
      - Set cornerRadius
      - Add children with same structure
      - **CAPTURE the response.rootNodeId or response.nodeIds from the result**
   b. Apply fills:
      - If GRADIENT_LINEAR: use add_gradient_fill() with angle and stops
      - If SOLID: use set_fills() with color and opacity
   c. Apply strokes: use set_stroke() with weight, color, align
   d. Apply effects: use apply_effects() with shadows/blur
3. **IMPORTANT**: Save drawn node IDs (captured from create_design responses) to: docs/uikit/components/${component_type}/drawn/node_ids_iteration_${N}.json
   Format:
   {
     "iteration": ${N},
     "timestamp": "ISO timestamp",
     "drawnNodes": [
       {"originalNodeId": "...", "originalName": "...", "drawnNodeId": "...", "drawnName": "..."}
     ]
   }

## Critical Requirements
- Match EVERY property exactly
- Don't skip gradients, strokes, or effects
- Use exact color values from JSON
- Preserve decimal precision
- Name drawn nodes: "{originalName}_Drawn_Iter${N}"

## Error Handling
- If a tool call fails, LOG the error and continue with next component
- Save error log to: docs/uikit/components/${component_type}/drawn/errors_iteration_${N}.json
`
});
```

**Wait for agent completion**, verify node IDs saved.

#### Phase 3: EXTRACT DRAWN (Agent C - Empty Context)

**Launch verification agent with ZERO context:**

```typescript
Task({
  subagent_type: 'general-purpose',
  description: 'Extract properties of drawn components',
  prompt: `
You are a verification agent. Your task is to extract properties from components that were just drawn using their node IDs.

## Tools Available
- Read tool - To read the node IDs file
- Write tool - To save extracted properties
- WebSocket bridge - To call get_node_properties_by_id command

## Input File
docs/uikit/components/${component_type}/drawn/node_ids_iteration_${N}.json

## Task
1. Read the drawn node IDs file
2. Extract the array of drawnNodeId values
3. Call the Figma plugin command 'get_node_properties_by_id' via WebSocket:
   - Connect to ws://localhost:8080
   - Send message: {type: 'get_node_properties_by_id', payload: {nodeIds: [array of IDs]}, requestId: 'extract-N'}
   - Wait for response with full node properties
4. Format the response to match originals structure:
   {
     "timestamp": "ISO timestamp",
     "iteration": ${N},
     "components": [extracted nodes with ALL properties]
   }
5. Save to: docs/uikit/components/${component_type}/drawn/iteration_${N}.json

## Properties to Extract (automatically returned by command)
- nodeId, name, type, bounds (x, y, width, height)
- fills (COMPLETE: type, color, gradientTransform, gradientStops, opacity)
- strokes (COMPLETE: type, color, weight, align, opacity)
- effects (COMPLETE: shadows/blur with offset, blur, spread, color, opacity)
- cornerRadius (individual corners or uniform)
- layout properties (layoutMode, padding, itemSpacing, sizing, alignment)
- typography (fontSize, fontName, fontWeight, alignment, lineHeight, letterSpacing, characters, textCase)
- opacity, visible, locked, blendMode
- children (complete recursive hierarchy with all properties)

## Output Format
{
  "timestamp": "ISO 8601",
  "iteration": ${N},
  "components": [array of node objects with complete properties]
}

## Important
- Use get_node_properties_by_id command (added to Figma plugin)
- Command returns SAME detailed properties as get_selection
- Output structure must match originals for direct comparison
- All properties extracted automatically - no manual selection needed
`
});
```

**Wait for agent completion**, verify output exists.

#### Phase 4: COMPARE & SCORE (Orchestrator - Full Context)

**YOU do this directly with full context:**

```typescript
const originals = JSON.parse(read(`originals/iteration_${N}.json`));
const drawn = JSON.parse(read(`drawn/iteration_${N}.json`));

const comparison = {
  iteration: N,
  timestamp: new Date().toISOString(),
  scores: { colors: 0, dimensions: 0, typography: 0, effects: 0, cornerRadius: 0, layout: 0 },
  issues: [],
  componentResults: []
};

for (let i = 0; i < originals.components.length; i++) {
  const orig = originals.components[i];
  const drw = drawn.components[i];

  const result = {
    name: orig.name,
    scores: {},
    issues: []
  };

  // Compare fills
  if (compareFills(orig.fills, drw.fills, 0.02)) {
    // 2% tolerance
    result.scores.colors = 100;
  } else {
    result.scores.colors = partialScore(orig.fills, drw.fills);
    result.issues.push({
      category: 'colors',
      expected: orig.fills,
      actual: drw.fills,
      diff: describeFillDiff(orig.fills, drw.fills)
    });
  }

  // Compare dimensions
  if (compareBounds(orig.bounds, drw.bounds, 2)) {
    // 2px tolerance
    result.scores.dimensions = 100;
  } else {
    result.scores.dimensions = partialScore(orig.bounds, drw.bounds);
    result.issues.push({
      category: 'dimensions',
      expected: orig.bounds,
      actual: drw.bounds,
      diff: `Expected ${orig.bounds.width}×${orig.bounds.height}, got ${drw.bounds.width}×${drw.bounds.height}`
    });
  }

  // Compare effects (shadows)
  if (compareEffects(orig.effects, drw.effects, 0.1)) {
    // 10% tolerance
    result.scores.effects = 100;
  } else {
    result.scores.effects = partialScore(orig.effects, drw.effects);
    result.issues.push({
      category: 'effects',
      expected: orig.effects,
      actual: drw.effects,
      diff: describeEffectsDiff(orig.effects, drw.effects)
    });
  }

  // ... compare other categories

  comparison.componentResults.push(result);

  // Aggregate scores
  for (const category in result.scores) {
    comparison.scores[category] += result.scores[category] / originals.components.length;
  }
}

comparison.overallAccuracy = Object.values(comparison.scores).reduce((a, b) => a + b) / 6;

write(`comparisons/iteration_${N}.json`, JSON.stringify(comparison, null, 2));
```

**Also export PNGs for visual inspection:**

```typescript
// Export originals
for (const comp of originals.components) {
  const png = await export_node({ nodeId: comp.nodeId, format: 'PNG', scale: 2 });
  write(`exports/iter${N}_original_${comp.name}.png`, png);
}

// Export drawn
const drawnIds = JSON.parse(read(`drawn/node_ids_iteration_${N}.json`));
for (const nodeId of drawnIds) {
  const png = await export_node({ nodeId, format: 'PNG', scale: 2 });
  write(`exports/iter${N}_drawn_${nodeId}.png`, png);
}
```

#### Phase 5: AUTONOMOUS FIX (Orchestrator - Full Context)

**Analyze issues and fix code/prompts autonomously:**

```typescript
// Categorize issues
const issueTypes = categorizeIssues(comparison.issues);

// FIX STRATEGY 1: MCP Tool Bug
if (issueTypes.gradients_not_applying) {
  console.log('[AUTO-FIX] Gradients not applying - fixing add_gradient_fill.ts');

  const toolCode = read('mcp-server/src/tools/add_gradient_fill.ts');

  // Analyze: Are gradients being passed to Figma correctly?
  // Check: Is angle calculation correct?
  // Check: Are stops being formatted properly?

  // Apply fix (example)
  edit('mcp-server/src/tools/add_gradient_fill.ts', {
    old_string: 'const angle = payload.angle || 0;',
    new_string: 'const angle = payload.angle !== undefined ? payload.angle : 90;'
  });

  bash('cd mcp-server && npm run build');
  console.log('✅ Tool fixed and rebuilt');
}

// FIX STRATEGY 2: Agent Prompt Issue
if (issueTypes.agent_not_extracting_property) {
  console.log('[AUTO-FIX] Agent missing properties - updating extraction prompt');

  // Update Phase 1 prompt to emphasize missing properties
  // This happens automatically next iteration since we regenerate prompts
}

// FIX STRATEGY 3: Figma Plugin Bug
if (issueTypes.plugin_not_caching) {
  console.log('[AUTO-FIX] Plugin bug detected - fixing code.ts');

  const pluginCode = read('figma-plugin/code.ts');

  // Apply fix
  edit('figma-plugin/code.ts', { ... });

  bash('cd figma-plugin && npm run build');
  console.log('⚠️  Plugin rebuilt - please reload in Figma');
}

// Log all fixes
write(`comparisons/fixes_applied_iteration_${N}.md`,
      `# Fixes Applied in Iteration ${N}\n\n${fixes.join('\n')}`);
```

#### Phase 6: STOP CONDITION

```typescript
if (comparison.overallAccuracy >= target_accuracy) {
  console.log(`✅ Target ${target_accuracy}% reached! (${comparison.overallAccuracy}%)`);
  generateFinalReport();
  break;
}

if (N >= max_iterations) {
  console.log(`⚠️  Max iterations ${max_iterations} reached`);
  console.log(`Final accuracy: ${comparison.overallAccuracy}%`);
  generateFinalReport();
  break;
}

if (N > 3 && noImprovementInLast3Iterations()) {
  console.log(`⚠️  Plateau detected - no improvement in 3 iterations`);
  generateFinalReport();
  break;
}

console.log(`✅ Iteration ${N} complete: ${comparison.overallAccuracy}%`);
console.log(`Continuing to iteration ${N + 1}...`);
```

---

## Key Architecture Points

1. **Agents Have Empty Context**: Each agent (A, B, C) starts fresh with only:
   - Tool access
   - Specific instructions
   - Input file path

2. **Orchestrator Has Full Context**: YOU maintain:
   - Iteration history
   - Comparison logic
   - Code fixing capability
   - Decision making

3. **Autonomous Fixing**: Don't just report bugs:
   - Read tool/plugin code
   - Identify root cause
   - Apply fix
   - Rebuild
   - Continue iteration

4. **Comparison on Ground Truth**: Compare actual extracted data, not assumptions

5. **Iterative Improvement**: Each iteration improves:
   - Tool code (if bugs found)
   - Plugin code (if bugs found)
   - Indirectly: Agent prompts get regenerated with emphasis on problem areas

---

## Final Report Structure

```markdown
# Final Report: {Component_Type}

## Summary

- Iterations: ${N}
- Final Accuracy: ${X}%
- Target: ${target_accuracy}%
- Status: ${status}

## Accuracy Progression

| Iteration | Colors | Dimensions | Typography | Effects | Radius | Layout | Overall |
| --------- | ------ | ---------- | ---------- | ------- | ------ | ------ | ------- |
| 1         | ...    | ...        | ...        | ...     | ...    | ...    | ...     |
| 2         | ...    | ...        | ...        | ...     | ...    | ...    | ...     |

## Code Fixes Applied

1. Iteration 1: WebSocket routing → server.js
2. Iteration 2: Gradient angle calculation → add_gradient_fill.ts
3. Iteration 3: Stroke not applying → set_stroke.ts

## Remaining Issues

...

## Files Generated

- originals/iteration\_{1..N}.json
- drawn/iteration\_{1..N}.json
- comparisons/iteration\_{1..N}.json
- exports/iter{1..N}\_\*.png
```

This approach ensures agents operate realistically (empty context) while orchestrator maintains control and autonomously fixes issues.
