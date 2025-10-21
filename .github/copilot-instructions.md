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
WHEN: Any task with multiple steps
WHY: Tracks progress, maintains focus
```
## No summaries or stopping before fully completing tasks

1. Always complete all tasks fully. Do not simplify approaches, do not skip tasks.
2. There is no token or time limit. Always complete tasks fully.
3. Do not write summary files or output long summaries of your actions in chat.


=== END CIB-001===

## MANDATORY EXECUTION PROTOCOL

1. Always follow `docs/meta/styleguide.md` - No exceptions!
Always complete all tasks fully. Do not simplify approaches, do not skip tasks.
2. Always keep tests up to date and maintain 100% test coverage.
3. Always test. 100% of tests must pass.
4. Always fix bugs. Never changes tests only to make them pass if the cause is in the code it is testing.
5. Never run Vitest in watch mode; automation must use `npm test`. Only set `ALLOW_VITEST_WATCH=1` when a human explicitly authorizes interactive debugging.
6. **CRITICAL**: After implementing new functionality, ALWAYS create comprehensive tests:
   - Unit tests for logic and components (Vitest)
   - Integration tests
   - Playwright tests for frontend functionality (must visually confirm UI works)
   - Run ALL tests before considering task complete
   - Maintain 100% test coverage - no exceptions


## Reference docs

- Coding style: `docs/meta/styleguide.md`

## Checklist for Task Completion

If not all criteria are met, continue working until they are:

1. All tasks are fully completed. No shortcuts were taken. No approaches were simplified. No tasks were skipped.
2. Used `mcp__mcp_docker__sequentialthinking` for complex tasks.
3. Used `todo_write` for task management.
4. No summary files or long summaries of actions are output in chat.
5. All tests are updated and maintain 100% test coverage.
6. All tests pass successfully.
7. Bugs are fixed without changing tests to make them pass.
8. Code follows `docs/meta/styleguide.md` without exceptions.
