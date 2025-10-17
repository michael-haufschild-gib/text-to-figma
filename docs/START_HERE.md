# Text-to-Figma Implementation Guide - START HERE

**For**: LLM Coding Agents (Claude Code CLI)
**Purpose**: Build a production-ready text-to-Figma design system
**Approach**: Execute tasks sequentially, one at a time

---

## 📋 Quick Start

1. **Read this file first** - Understand the approach
2. **Open docs/IMPLEMENTATION_TASKS.md** - Your main task list
3. **Execute tasks 1-35 in order** - Each task is self-contained
4. **Use docs/TASK_PROGRESS.md** - Track your progress

---

## 🎯 What You're Building

A system that allows Claude (via MCP) to generate high-quality Figma designs using:
- **HTML/CSS mental model** - Claude thinks in HTML/CSS terms, translates to Figma API
- **Design constraints** - 8pt grid, modular typography, WCAG AA accessibility
- **Three-tier architecture** - Claude → MCP Server → WebSocket Bridge → Figma Plugin

**Target Accuracy**: 80-90% (validated by Builder.io production benchmark)

---

## 📂 Key Documents

### 1. docs/IMPLEMENTATION_TASKS.md (THIS IS YOUR MAIN GUIDE)
- **35 sequential tasks** organized in 5 phases
- **Each task is self-contained** with inline code
- **No forward references** - everything you need is in each task
- **Programmatic verification** - test each task before moving on

**How to use**:
```bash
# Read task 1
head -n 200 docs/IMPLEMENTATION_TASKS.md

# Execute task 1
# ... follow instructions ...

# Verify task 1
# ... run verification commands ...

# Move to task 2
# ... repeat ...
```

### 2. docs/CLAUDE_CODE_CLI_COMPATIBILITY.md
- Confirms everything works with Claude Code CLI
- No fine-tuning required
- No model modification required
- Just prompts + MCP + Figma API

### 3. docs/DEVELOPER_HANDOFF_SUMMARY.md
- Executive summary of the entire project
- Explains WHY the HTML/CSS mental model works
- Research evidence and benchmarks

### 4. docs/synthesis.md
- Complete requirements specification (84KB)
- 8 sections covering architecture, API, quality, testing
- **Only reference this if you need deep context**
- **Primary work is in docs/IMPLEMENTATION_TASKS.md**

---

## 🏗️ Architecture Overview

```
┌─────────────┐
│   Claude    │  "Create a login form"
│  Code CLI   │
└──────┬──────┘
       │ MCP Protocol
       ▼
┌─────────────┐
│ MCP Server  │  Tools: create_frame, create_text, etc.
│ (Node.js)   │  Prompts: Zero-shot HTML→Figma mappings
└──────┬──────┘
       │ WebSocket
       ▼
┌─────────────┐
│ WebSocket   │  Bridge between MCP and Figma plugin
│   Bridge    │
└──────┬──────┘
       │ WebSocket
       ▼
┌─────────────┐
│   Figma     │  Executes Figma API calls
│   Plugin    │  Creates frames, text, components
└─────────────┘
```

---

## 📝 Task Phases

### Phase 1: Foundation (Tasks 1-8) - Week 1
**Goal**: Get basic pipeline working
**Output**: Claude can create a frame in Figma

Tasks:
1. Create Figma plugin manifest
2. Create plugin main thread (Figma API)
3. Create plugin UI thread (WebSocket client)
4. Create WebSocket bridge server
5. Create MCP server scaffold
6. Create design constraints module
7. Connect MCP to WebSocket
8. End-to-end foundation test

### Phase 2: Core MCP Tools (Tasks 9-15) - Week 2
**Goal**: Add essential design tools
**Output**: Claude can create frames, text, validate constraints

Tasks:
9. Implement create_frame MCP tool (with HTML analogy)
10. Implement set_layout_properties MCP tool
11. Implement create_text MCP tool
12. Implement set_fills MCP tool
13. Implement validate_design_tokens MCP tool
14. Create HTML→Figma mapping reference
15. Create zero-shot system prompt

### Phase 3: Design Quality (Tasks 16-23) - Weeks 3-4
**Goal**: Add color, typography, components
**Output**: Claude can create complete, accessible designs

Tasks:
16. Implement LCh color space converter
17. Implement WCAG contrast validator
18. Implement modular typography scale
19. Implement create_component MCP tool
20. Implement create_instance MCP tool
21. Implement set_component_properties MCP tool
22. Implement apply_effects MCP tool
23. Create few-shot system prompt

### Phase 4: Testing (Tasks 24-29) - Weeks 5-6
**Goal**: Automated quality validation
**Output**: Test suite ensuring design quality

Tasks:
24. Create design token validation tests
25. Create visual regression test scaffold
26. Create agentic review agent
27. Implement check_wcag_contrast tool
28. E2E test: Generate button component
29. E2E test: Generate login form

### Phase 5: Advanced (Tasks 30-35) - Weeks 7-12
**Goal**: Production features
**Output**: Iterative refinement, monitoring, prompt library

Tasks:
30. Implement grid-based layout algorithm
31. Implement set_constraints MCP tool
32. Implement iterative refinement loop
33. Create caching layer
34. Create production monitoring
35. Create LLM prompt library

---

## 🔧 HTML/CSS Mental Model (Core Innovation)

**Why it works**: Claude has extensive HTML/CSS training data but limited Figma API knowledge.

**Example mapping**:
```
HTML/CSS:
  <div style="display: flex; flex-direction: row; gap: 16px;">

Maps to Figma API:
  frame.layoutMode = 'HORIZONTAL'
  frame.itemSpacing = 16
```

**Implementation**: All MCP tool descriptions include HTML analogies:
```typescript
{
  name: 'create_frame',
  description: 'Create a frame with auto-layout. Think of this as creating a <div> with display: flex in HTML/CSS.'
}
```

---

## ✅ Task Execution Checklist

For each task:

1. **Prerequisites Check**
   - [ ] All prerequisite tasks completed
   - [ ] Required files from previous tasks exist

2. **Read Task Completely**
   - [ ] Read entire task (Objective → Output Artifacts)
   - [ ] Understand the Context (why it matters)
   - [ ] Review Implementation steps

3. **Execute Implementation**
   - [ ] Create all required files
   - [ ] Copy code exactly as provided
   - [ ] Install dependencies if needed
   - [ ] Compile TypeScript if needed

4. **Run Verification**
   - [ ] Execute all verification commands
   - [ ] Check expected outputs match
   - [ ] Run programmatic checks

5. **Confirm Success Criteria**
   - [ ] All checkboxes in Success Criteria are ✓
   - [ ] All Output Artifacts exist
   - [ ] No errors in console/logs

6. **Update Progress**
   - [ ] Mark task complete in docs/TASK_PROGRESS.md
   - [ ] Commit changes (if using git)
   - [ ] Move to next task

---

## 🚨 Important Notes for LLM Agents

### Context Window Management
- **Read one task at a time** from docs/IMPLEMENTATION_TASKS.md
- Each task is designed to fit in ~4000 tokens
- Don't try to load entire document at once
- Use line numbers: `head -n 500 docs/IMPLEMENTATION_TASKS.md | tail -n 200`

### Self-Contained Tasks
- All code is inline in each task
- No "see Section X" references
- No "refer to Task Y" for code
- Everything needed is in the task

### Verification is Critical
- **MUST verify each task before proceeding**
- Don't skip verification steps
- If verification fails, fix before continuing
- Tests ensure foundation is solid

### Dependencies
- Follow prerequisite order strictly
- Task 10 requires Task 9, which requires Task 5-8, etc.
- Don't skip tasks
- Dependencies are explicitly listed

### Error Handling
If a task fails:
1. Read error message carefully
2. Check prerequisite tasks completed correctly
3. Verify all files from previous tasks exist
4. Check code was copied exactly
5. Review Implementation steps again

---

## 📊 Progress Tracking

Create file `docs/TASK_PROGRESS.md`:

```markdown
# Implementation Progress

Started: [DATE]
Current Phase: Phase 1 (Foundation)
Current Task: Task 1

## Completed Tasks
- [x] Task 1: Figma Plugin Manifest

## Current Task
- [ ] Task 2: Plugin Main Thread

## Next Tasks
- [ ] Task 3: Plugin UI Thread
- [ ] Task 4: WebSocket Bridge Server
...
```

Update after each task completion.

---

## 🎓 Learning Resources

If you need context on specific topics:

- **Figma Plugin API**: Read Task 2 context section
- **MCP (Model Context Protocol)**: Read Task 5 context section
- **WebSocket Bridge**: Read Task 4 context section
- **HTML→Figma Mappings**: See Task 14 (HTML mapping reference)
- **Design Constraints**: See Task 6 (constraints module)

---

## 🚀 Ready to Start?

1. **Create project directory**:
   ```bash
   mkdir text-to-figma
   cd text-to-figma
   ```

2. **Open docs/IMPLEMENTATION_TASKS.md**:
   ```bash
   # Read Task 1
   head -n 200 docs/IMPLEMENTATION_TASKS.md
   ```

3. **Execute Task 1**:
   - Follow Implementation steps
   - Create manifest.json
   - Run Verification
   - Confirm Success Criteria

4. **Move to Task 2**:
   - Repeat process
   - Each task builds on previous

---

## 💡 Success Metrics

You'll know the system is working when:

**After Phase 1** (Task 8):
- ✅ Claude can send command via MCP
- ✅ WebSocket bridge forwards to Figma
- ✅ Figma plugin creates frame
- ✅ Response flows back to Claude

**After Phase 2** (Task 15):
- ✅ Claude can create frames with HTML mental model
- ✅ Spacing validated against 8pt grid
- ✅ Text created with proper fonts
- ✅ Design tokens validated

**After Phase 3** (Task 23):
- ✅ Claude generates accessible colors (WCAG AA)
- ✅ Components created and instantiated
- ✅ Few-shot prompts improve accuracy
- ✅ Complete designs generated from prompts

**Final System** (Task 35):
- ✅ 80-90% conversion accuracy (HTML→Figma)
- ✅ Iterative refinement converges in 3 iterations
- ✅ All designs pass quality validation
- ✅ Production-ready monitoring in place

---

## ❓ FAQ

**Q: Do I need to fine-tune Claude?**
A: No. Everything works with prompt engineering.

**Q: What if I don't understand HTML/CSS?**
A: Tasks include all mappings inline. Just copy the code provided.

**Q: Can I skip tasks?**
A: No. Dependencies require sequential execution.

**Q: How long will this take?**
A: Phase 1 (MVP): 1-2 weeks. Complete system: 10-12 weeks.

**Q: What if a task fails?**
A: Check prerequisites, re-read Implementation, verify previous tasks.

**Q: Can I modify the code?**
A: Yes, but verify it still works before proceeding.

---

## 🎯 Your Next Step

**→ Open docs/IMPLEMENTATION_TASKS.md**
**→ Read Task 1 completely**
**→ Execute Task 1**
**→ Verify Task 1**
**→ Move to Task 2**

Good luck! The foundation is solid, the research is validated, and the path is clear. Execute one task at a time, verify each step, and you'll have a production-ready text-to-Figma system.

---

**Questions or Issues?**
- Review docs/CLAUDE_CODE_CLI_COMPATIBILITY.md for technical details
- Check docs/DEVELOPER_HANDOFF_SUMMARY.md for research context
- Refer to docs/synthesis-main.md and docs/synthesis.md only if you need deep architectural understanding

**Remember**: docs/IMPLEMENTATION_TASKS.md is your primary guide. It contains everything you need, one task at a time.
