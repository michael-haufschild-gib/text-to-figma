# Quick Start Guide - Running Tests

## Prerequisites

1. **Build MCP Server** (required for most tests):
```bash
cd mcp-server
npm install
npm run build
cd ../tests
```

2. **Install Test Dependencies**:
```bash
cd tests
npm install
```

## Running Tests

### Run Everything

```bash
cd tests
npm test
```

or

```bash
cd tests
./run-all-tests.sh
```

### Run Specific Categories

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Validation tests
npm run test:validation

# Agent tests
npm run test:agent

# E2E tests
npm run test:e2e

# Just button component
npm run test:e2e:button

# Just login form
npm run test:e2e:form

# WCAG contrast tests
npm run test:contrast
npm run test:contrast:enhanced

# Foundation tests
npm run test:foundation
```

## Expected Results

### All Tests Pass ✓

```
===========================================
Test Summary
===========================================

Total Suites: 10
Passed: 10
Failed: 0

===========================================
ALL TESTS PASSED ✓
===========================================

Test Coverage:
  ✓ Unit tests (2 suites)
  ✓ Integration tests (4 suites)
  ✓ Validation tests (1 suite)
  ✓ Agent tests (1 suite)
  ✓ E2E tests (2 suites)

Total: 10/10 test suites passed
```

### Individual Test Output

Each test suite provides detailed output:

**Unit Tests:**
- Test name
- Pass/fail status
- Specific assertions validated
- Edge cases covered

**Integration Tests:**
- Server startup confirmation
- Connection status
- Tool execution results
- Validation results

**Validation Tests:**
- Token validation results
- Pass/fail counts
- Suggested corrections
- WCAG compliance levels

**E2E Tests:**
- Step-by-step progress (1-12 steps)
- Node IDs created
- Validation checkpoints
- Final component verification

**Agent Tests:**
- Design review score (0-100)
- Grade (Excellent/Good/Acceptable/Needs Improvement/Failing)
- Violations by category
- Actionable recommendations

## Test Output Examples

### Successful Test

```
    Step 1: Validating design tokens...
      ✓ Design tokens validated

    Step 2: Creating frame...
      ✓ Frame created (ID: 123:456)

    Step 3: Styling frame...
      ✓ Frame styled with background

    ✓ BUTTON component created successfully!
```

### Failed Test

```
    Step 3: Styling frame...
      ✗ FAIL: Invalid color format

    ✗ BUTTON component failed: Invalid color format
```

## Troubleshooting

### "MCP server not built"

```bash
cd mcp-server
npm run build
cd ../tests
```

### "WebSocket connection failed"

- Check if port 8080 is available
- Ensure no other WebSocket server is running
- Verify firewall settings

### "Test timeout"

- Some tests require server startup time (~2 seconds)
- Network/system slowness may cause timeouts
- Check system resources

### "Module not found"

```bash
cd tests
npm install
```

## Test Files

| Test File | Category | Purpose |
|-----------|----------|---------|
| `unit/color-converter.test.js` | Unit | Color utility functions |
| `unit/typography-generator.test.js` | Unit | Typography utilities |
| `integration/foundation.test.js` | Integration | WebSocket pipeline |
| `integration/wcag-contrast.test.js` | Integration | WCAG calculations |
| `integration/wcag-contrast-enhanced.test.js` | Integration | Batch contrast + reports |
| `integration/component-tools.test.js` | Integration | Component creation |
| `validation/design-tokens.test.js` | Validation | Design token validation |
| `agents/design-reviewer.js` | Agent | Automated design review |
| `e2e/button-component.test.js` | E2E | Button generation workflow |
| `e2e/login-form.test.js` | E2E | Form generation workflow |

## Test Duration

| Category | Duration |
|----------|----------|
| Unit Tests | < 1 second |
| Integration Tests | 5-10 seconds per suite |
| Validation Tests | 3-5 seconds |
| Agent Tests | 2-3 seconds |
| E2E Tests | 10-20 seconds per suite |
| **Total (All Tests)** | **~60-90 seconds** |

## CI/CD Integration

Add to your CI pipeline:

```yaml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
    - name: Build MCP Server
      run: cd mcp-server && npm install && npm run build
    - name: Install Test Dependencies
      run: cd tests && npm install
    - name: Run All Tests
      run: cd tests && npm test
```

## What Gets Tested

### ✓ Color System
- Color conversions (Hex, RGB, LCH)
- Contrast ratio calculations
- WCAG AA/AAA compliance
- Perceptual lightness adjustments

### ✓ Typography
- Font size validation
- Type scale adherence
- Line height recommendations
- Font weight validation

### ✓ Spacing
- 8pt grid validation
- Snap-to-grid suggestions
- Layout property application

### ✓ Components
- Frame creation
- Text nodes
- Fills and strokes
- Effects (shadows, blurs)
- Layout properties (auto-layout)
- Component creation

### ✓ Design Tokens
- Spacing validation
- Typography validation
- Color contrast validation
- Export formats (CSS, Tailwind, JSON)

### ✓ Workflows
- Complete button generation (3 variants)
- Complete form generation (12 steps)
- Design system compliance

### ✓ Quality
- Automated design reviews
- Naming convention validation
- Design system scoring
- Actionable recommendations

## Next Steps

1. **Run all tests** to verify your setup
2. **Review test output** to understand validation
3. **Check TEST_SUMMARY.md** for detailed documentation
4. **Integrate into CI/CD** for automated quality checks

## Support

For issues or questions:
1. Check test output for specific error messages
2. Review TEST_SUMMARY.md for troubleshooting
3. Verify MCP server is built and running
4. Check that all dependencies are installed
