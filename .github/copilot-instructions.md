# Copilot Instructions for Plinko

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
USE: todo_write
WHEN: Any task with 3+ steps
WHY: Tracks progress, maintains focus
```

=== END CIB-001===

## MANDATORY CODE STYLE AND ARCHITECTURE RULES

Coding tasks must follow `docs/meta/styleguide.md` - No exceptions!

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

## Workflow & commands

- Run the app with `npm run dev` (dev tools enabled) or `npm run build` for production;
- Always execute tests through `npm test` (wrapper sets deterministic env and kills stray workers).
- End-to-end suites run through `npm run test:e2e` (or `...:headed`); the wrapper shares the same deterministic env variables as unit tests.
- If Vitest processes wedge, call `node scripts/cleanup-vitest.mjs` before re-running to avoid the historical memory leak.
- Lint with `npm run lint`; type-check with `npm run typecheck` when touching shared types.

## Reference docs

- Architecture overview: `docs/architecture.md`
- Coding style: `docs/meta/styleguide.md`
