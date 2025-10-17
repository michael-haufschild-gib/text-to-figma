# Text-to-Figma Testing Guide

Comprehensive guide to testing philosophy, procedures, and best practices for the Text-to-Figma design system.

**Last Updated**: October 17, 2025
**Version**: 1.0.0

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Manual Testing Procedures](#manual-testing-procedures)
3. [Automated Testing Setup](#automated-testing-setup)
4. [Visual Regression Testing](#visual-regression-testing)
5. [Design Review Checklist](#design-review-checklist)
6. [Troubleshooting Test Failures](#troubleshooting-test-failures)
7. [Writing New Tests](#writing-new-tests)
8. [Performance Testing](#performance-testing)

---

## Testing Philosophy

### Why We Test

The Text-to-Figma system bridges AI (Claude) with design tools (Figma). Testing ensures:

1. **Reliability**: AI-generated designs meet quality standards
2. **Consistency**: Design tokens are enforced correctly
3. **Accessibility**: WCAG compliance is validated automatically
4. **Regression Prevention**: Changes don't break existing functionality
5. **Documentation**: Tests serve as executable specifications

### Testing Pyramid

```
         /\
        /E2E\         ← Few, slow, high-value (5-10 tests)
       /------\
      /Visual \       ← Some, moderate, visual validation (20-30 tests)
     /----------\
    /Integration\     ← More, faster, system validation (50-100 tests)
   /--------------\
  /     Unit       \  ← Many, fast, logic validation (100-200 tests)
 /------------------\
```

**Unit Tests** (70% of tests):
- Test individual functions/modules
- No external dependencies
- Run in milliseconds
- Example: Color conversion, typography scale

**Integration Tests** (20% of tests):
- Test component interactions
- WebSocket, MCP server integration
- Run in seconds
- Example: Message passing, tool execution

**Visual Regression Tests** (8% of tests):
- Test visual output in Figma
- Screenshot comparison
- Run in 10-30 seconds
- Example: Button component, form layout

**End-to-End Tests** (2% of tests):
- Test complete Claude → Figma workflows
- All services running
- Run in 30-60 seconds
- Example: Generate login form, build dashboard

---

### Test-Driven Development (TDD)

**Process**:
1. **Write test first** (Red) - Define expected behavior
2. **Implement feature** (Green) - Make test pass
3. **Refactor** (Refactor) - Improve code quality
4. **Repeat** - Continue cycle

**Example**:
```javascript
// 1. Write test first (FAILS)
function testValidateSpacing() {
  assert.strictEqual(validateSpacing(16), true, '16px should be valid');
  assert.strictEqual(validateSpacing(15), false, '15px should be invalid');
}

// 2. Implement feature (PASSES)
function validateSpacing(value) {
  const SPACING_SCALE = [0, 4, 8, 16, 24, 32, 40, 48, 56, 64];
  return SPACING_SCALE.includes(value);
}

// 3. Refactor (STILL PASSES)
const SPACING_SCALE = [0, 4, 8, 16, 24, 32, 40, 48, 56, 64];
const validateSpacing = (value) => SPACING_SCALE.includes(value);
```

---

### Coverage Goals

**Requirement**: 100% test coverage for all production code

**Metrics**:
- **Line Coverage**: 100% - Every line executed
- **Branch Coverage**: 100% - Every if/else tested
- **Function Coverage**: 100% - Every function called
- **Statement Coverage**: 100% - Every statement run

**Why 100%?**:
- Design quality is critical (accessibility, brand consistency)
- AI-generated code needs validation
- Regressions in design tools are expensive to fix
- Tests serve as documentation

**Exclusions**:
- Third-party dependencies
- Node.js built-ins
- Figma plugin API (tested via integration)
- Development-only code (console logs, debugging)

---

## Manual Testing Procedures

### Pre-Release Checklist

Before releasing any new feature, manually verify:

#### 1. WebSocket Bridge Connection

**Purpose**: Ensure MCP server can communicate with Figma plugin

**Steps**:
```bash
# Terminal 1: Start WebSocket bridge
cd websocket-server
npm start

# Expected output:
# WebSocket bridge server started on ws://localhost:8080

# Terminal 2: Start MCP server
cd mcp-server
npm run dev

# Expected output:
# Connecting to WebSocket bridge at ws://localhost:8080...
# ✓ Connected to WebSocket bridge
# Figma MCP Server ready

# Terminal 3: Check connection
lsof -i :8080

# Expected: Two connections (MCP server + Figma plugin)
```

**Pass Criteria**:
- ✅ WebSocket server starts without errors
- ✅ MCP server connects successfully
- ✅ No connection timeouts or retries

---

#### 2. Figma Plugin Installation

**Purpose**: Verify plugin loads and connects

**Steps**:
1. Open Figma Desktop App
2. Go to Plugins → Development → Import plugin from manifest
3. Select `figma-plugin/manifest.json`
4. Run plugin (Plugins → Development → Text-to-Figma Design Generator)

**Expected UI**:
```
┌─────────────────────────────┐
│ Text-to-Figma Plugin        │
├─────────────────────────────┤
│ Status: Connected           │  ← Green background
├─────────────────────────────┤
│ [Timestamp] Connected to    │
│ WebSocket server            │
└─────────────────────────────┘
```

**Pass Criteria**:
- ✅ Plugin UI appears (400x600 window)
- ✅ Status shows "Connected" (green)
- ✅ No JavaScript errors in DevTools

---

#### 3. MCP Tool Discovery

**Purpose**: Verify Claude can discover available tools

**Steps**:
```bash
# With MCP server running, list tools
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node mcp-server/dist/index.js

# Expected output (partial):
# {
#   "jsonrpc": "2.0",
#   "id": 1,
#   "result": {
#     "tools": [
#       {
#         "name": "create_frame",
#         "description": "Create a frame with auto-layout..."
#       },
#       {
#         "name": "create_text",
#         "description": "Create text with font loading..."
#       }
#     ]
#   }
# }
```

**Pass Criteria**:
- ✅ JSON-RPC response is valid
- ✅ All expected tools are listed
- ✅ Tool descriptions include HTML analogies

---

#### 4. Create Frame Test

**Purpose**: Verify frame creation end-to-end

**Steps**:
1. Ensure WebSocket bridge, MCP server, and Figma plugin are running
2. In Figma, create a new page (to isolate test)
3. Send create_frame command via MCP:

```bash
# Create test frame
echo '{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "create_frame",
    "arguments": {
      "name": "Test Container",
      "width": 320,
      "height": 200,
      "layoutMode": "VERTICAL",
      "itemSpacing": 16,
      "padding": { "top": 16, "right": 16, "bottom": 16, "left": 16 }
    }
  }
}' | node mcp-server/dist/index.js
```

**Expected in Figma**:
- Frame appears on canvas
- Name: "Test Container"
- Size: 320 × 200
- Layout: Vertical (flex-direction: column)
- Item spacing: 16px
- Padding: 16px all sides

**Expected Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"success\":true,\"frameId\":\"...\",\"message\":\"Created frame \\\"Test Container\\\"\"}"
      }
    ]
  }
}
```

**Pass Criteria**:
- ✅ Frame appears in Figma
- ✅ Properties match input
- ✅ Success response received
- ✅ No errors in any terminal

---

#### 5. Create Text Test

**Purpose**: Verify text creation with font loading

**Steps**:
```bash
# Create test text inside frame (get frameId from previous test)
echo '{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "create_text",
    "arguments": {
      "content": "Hello, Figma!",
      "fontSize": 24,
      "fontFamily": "Inter",
      "fontStyle": "Bold",
      "lineHeight": 36
    }
  }
}' | node mcp-server/dist/index.js
```

**Expected in Figma**:
- Text node appears
- Content: "Hello, Figma!"
- Font: Inter Bold
- Font size: 24px
- Line height: 36px (1.5 × font size, baseline grid)

**Pass Criteria**:
- ✅ Text renders correctly
- ✅ Font loads (no missing font warning)
- ✅ Typography follows modular scale
- ✅ Line height respects baseline grid

---

#### 6. Constraint Validation Test

**Purpose**: Verify design constraints are enforced

**Steps**:
```bash
# Test invalid spacing (should fail)
echo '{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "create_frame",
    "arguments": {
      "name": "Invalid Frame",
      "itemSpacing": 15
    }
  }
}' | node mcp-server/dist/index.js
```

**Expected Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "error": {
    "code": -32000,
    "message": "itemSpacing 15 does not follow 8pt grid. Valid values: 0, 4, 8, 16, 24, 32, 40, 48, 56, 64. Nearest valid value: 16"
  }
}
```

**Pass Criteria**:
- ✅ Command is rejected
- ✅ Error message explains constraint
- ✅ Nearest valid value suggested
- ✅ No frame created in Figma

---

### Smoke Test (Quick Validation)

**Purpose**: Rapid validation after code changes

**Time**: 2 minutes

**Steps**:
1. Build MCP server: `cd mcp-server && npm run build`
2. Start WebSocket: `cd websocket-server && npm start &`
3. Run unit tests: `cd tests && node unit/color-converter.test.js`
4. Run integration test: `node integration/foundation.test.js`
5. Stop WebSocket: `kill %1`

**Pass Criteria**:
- ✅ All tests pass
- ✅ No errors or warnings
- ✅ Exit code 0

---

### Full Manual Test (Comprehensive)

**Purpose**: Complete system validation before release

**Time**: 15 minutes

**Steps**:
1. **Environment Setup** (2 min)
   - Build all packages
   - Start WebSocket bridge
   - Start MCP server
   - Open Figma, load plugin

2. **Basic Operations** (3 min)
   - Create frame with auto-layout
   - Create text with various font sizes
   - Apply fills and strokes
   - Validate spacing constraints

3. **Design Constraints** (3 min)
   - Test 8pt grid validation (valid/invalid spacing)
   - Test typography scale (valid/invalid font sizes)
   - Test WCAG contrast (AA/AAA compliance)

4. **Component Tools** (3 min)
   - Create component
   - Create instance
   - Set component properties
   - Apply effects (shadows, blurs)

5. **Error Handling** (2 min)
   - Invalid inputs (negative sizes, empty names)
   - Missing fonts (should load or fail gracefully)
   - Disconnected WebSocket (should reconnect)

6. **Cleanup** (2 min)
   - Stop services
   - Check for zombie processes
   - Review logs for warnings

**Pass Criteria**:
- ✅ All operations succeed
- ✅ Constraints enforced correctly
- ✅ Error messages are helpful
- ✅ No crashes or hangs

---

## Automated Testing Setup

### Prerequisites

**System Requirements**:
- Node.js 20.x or higher
- npm 10.x or higher
- 8GB RAM minimum
- macOS, Linux, or Windows (WSL2)

**Install Dependencies**:
```bash
# Root dependencies
cd /Users/michaelhaufschild/Documents/code/text-to-figma

# MCP Server
cd mcp-server
npm install
npm run build

# WebSocket Server
cd ../websocket-server
npm install

# Tests
cd ../tests
npm install
```

---

### Running Automated Tests

#### Quick Run (All Tests)

```bash
cd tests
./run-integration-tests.sh
```

**Expected Output**:
```
========================================
Text-to-Figma Test Runner
========================================

Node.js version: v20.11.0

========================================
Running Unit Tests
========================================

Running: color-converter.test.js

=== Color Converter Unit Tests ===
  Test: Hex to RGB Conversion
    ✓ Basic color conversions work
  Test: RGB to Hex Conversion
    ✓ Basic color conversions work
  ...
=== All Color Converter Tests Passed ===

✓ color-converter.test.js passed

Running: typography-generator.test.js
  ...
✓ typography-generator.test.js passed

========================================
Running Integration Tests
========================================

Running: foundation.test.js
  ...
✓ foundation.test.js passed

Running: component-tools.test.js
  ...
✓ component-tools.test.js passed

Running: wcag-contrast.test.js
  ...
✓ wcag-contrast.test.js passed

========================================
Test Summary
========================================
Total Tests: 5
Passed: 5
Failed: 0

Pass Rate: 100%

All tests passed!

Test Coverage:
  ✓ Unit Tests (color conversion, typography, WCAG contrast)
  ✓ Integration Tests (WebSocket, component tools)
```

---

#### Individual Test Suites

**Unit Tests Only**:
```bash
cd tests
node unit/color-converter.test.js
node unit/typography-generator.test.js
```

**Integration Tests Only**:
```bash
cd tests
node integration/foundation.test.js
node integration/component-tools.test.js
node integration/wcag-contrast.test.js
```

**Single Test File**:
```bash
cd tests
node unit/color-converter.test.js
```

---

### CI/CD Integration

#### GitHub Actions Setup

**File**: `.github/workflows/test.yml`

```yaml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [20.x]

    steps:
      - name: Checkout Code
        uses: actions/checkout@v3

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install MCP Server Dependencies
        run: cd mcp-server && npm ci

      - name: Install WebSocket Server Dependencies
        run: cd websocket-server && npm ci

      - name: Install Test Dependencies
        run: cd tests && npm ci

      - name: Build MCP Server
        run: cd mcp-server && npm run build

      - name: Run Tests
        run: cd tests && npm test

      - name: Upload Test Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: tests/results/

      - name: Comment PR with Results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const results = fs.readFileSync('tests/results/summary.txt', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Test Results\n\n\`\`\`\n${results}\n\`\`\``
            });
```

**Setup Steps**:
1. Create `.github/workflows/` directory
2. Add `test.yml` file with above content
3. Commit and push to repository
4. GitHub Actions will run automatically on push/PR

---

#### Pre-commit Hooks (Husky)

**Setup**:
```bash
# Install Husky
npm install --save-dev husky

# Initialize Husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "cd tests && npm test"

# Make executable
chmod +x .husky/pre-commit
```

**File**: `.husky/pre-commit`
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "Running pre-commit tests..."

# Build MCP server
cd mcp-server
npm run build || exit 1

# Run tests
cd ../tests
npm test || exit 1

echo "All tests passed! Proceeding with commit."
```

**Result**:
- Tests run automatically before every commit
- Commit is blocked if tests fail
- Ensures only tested code is committed

---

## Visual Regression Testing

### Purpose

Detect unintended visual changes in Figma designs generated by the system.

**Use Cases**:
- Component library changes
- Design system updates
- Claude prompt modifications
- Figma API updates

---

### Workflow

#### 1. Capture Baseline Screenshots

**First Time Setup**:
```bash
# Generate baseline images
cd tests
node visual/capture-baselines.js

# Output:
# tests/visual/baselines/
#   ├── button-primary.png
#   ├── button-secondary.png
#   ├── login-form.png
#   └── dashboard-layout.png
```

**Baseline Criteria**:
- Designs are visually correct
- WCAG compliance verified
- Approved by designer
- Version controlled in Git

---

#### 2. Run Visual Regression Tests

**After Code Changes**:
```bash
# Capture new screenshots
cd tests
node visual/capture-current.js

# Compare with baselines
node visual/compare.js

# Output:
# Comparing: button-primary.png
#   ✓ No changes detected (0% difference)
#
# Comparing: login-form.png
#   ✗ Changes detected (2.3% difference)
#   Diff saved to: tests/visual/diffs/login-form-diff.png
```

---

#### 3. Review Differences

**If Changes Detected**:
1. Open diff image: `tests/visual/diffs/login-form-diff.png`
2. Review highlighted differences (red pixels)
3. Determine if intentional or regression

**If Intentional**:
```bash
# Update baseline
cp tests/visual/current/login-form.png tests/visual/baselines/login-form.png

# Commit new baseline
git add tests/visual/baselines/login-form.png
git commit -m "Update login form baseline (spacing adjustment)"
```

**If Regression**:
```bash
# Fix code causing regression
# Re-run tests to verify fix
node visual/compare.js
```

---

### Implementation (Playwright)

**File**: `tests/visual/capture-baselines.js`

```javascript
import { chromium } from 'playwright';
import fs from 'fs';

async function captureBaselines() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Navigate to Figma (requires auth)
  await page.goto('https://www.figma.com/file/YOUR_FILE_ID');

  // Wait for canvas to load
  await page.waitForSelector('canvas');

  // Capture screenshots of specific frames
  const frames = [
    { name: 'button-primary', selector: '[data-frame-id="123"]' },
    { name: 'login-form', selector: '[data-frame-id="456"]' }
  ];

  for (const frame of frames) {
    const element = await page.$(frame.selector);
    await element.screenshot({
      path: `tests/visual/baselines/${frame.name}.png`
    });
  }

  await browser.close();
}

captureBaselines();
```

**File**: `tests/visual/compare.js`

```javascript
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'fs';

function compareImages(baseline, current, diff, threshold = 0.1) {
  const img1 = PNG.sync.read(fs.readFileSync(baseline));
  const img2 = PNG.sync.read(fs.readFileSync(current));
  const { width, height } = img1;

  const diffImg = new PNG({ width, height });

  const numDiffPixels = pixelmatch(
    img1.data,
    img2.data,
    diffImg.data,
    width,
    height,
    { threshold }
  );

  fs.writeFileSync(diff, PNG.sync.write(diffImg));

  const diffPercent = (numDiffPixels / (width * height)) * 100;

  return {
    passed: diffPercent < threshold,
    diffPercent,
    numDiffPixels
  };
}

// Compare all baselines
const tests = ['button-primary', 'login-form'];

tests.forEach(test => {
  const result = compareImages(
    `tests/visual/baselines/${test}.png`,
    `tests/visual/current/${test}.png`,
    `tests/visual/diffs/${test}-diff.png`
  );

  if (result.passed) {
    console.log(`✓ ${test}: No changes (${result.diffPercent.toFixed(2)}%)`);
  } else {
    console.log(`✗ ${test}: Changes detected (${result.diffPercent.toFixed(2)}%)`);
  }
});
```

---

### Visual Test Configuration

**Thresholds**:
- **0-0.1%**: Acceptable (anti-aliasing, rounding)
- **0.1-1%**: Review required (minor changes)
- **1-5%**: Likely regression (significant changes)
- **> 5%**: Definite regression (major changes)

**Ignore Patterns**:
- Timestamps (dynamic text)
- User avatars (profile images)
- Live data (API responses)
- Animations (mid-frame captures)

---

## Design Review Checklist

### Pre-Flight Checks

Before generating any design with Claude:

- [ ] MCP server is running and connected
- [ ] WebSocket bridge is healthy (no disconnections)
- [ ] Figma plugin is installed and connected
- [ ] Design system constraints are loaded
- [ ] WCAG compliance tools are available

---

### Post-Generation Review

After Claude generates a design:

#### 1. Layout Structure

- [ ] Frames use auto-layout (HORIZONTAL/VERTICAL)
- [ ] Spacing follows 8pt grid (0, 4, 8, 16, 24, 32...)
- [ ] Padding is consistent and grid-aligned
- [ ] Nesting hierarchy is logical (container → content)

**How to Check**:
1. Select any frame in Figma
2. Verify "Auto layout" is enabled
3. Check "Item spacing" value (should be grid-aligned)
4. Check padding values (should be grid-aligned)

---

#### 2. Typography

- [ ] Font sizes use modular scale (12, 16, 20, 24, 32, 40, 48, 64)
- [ ] Line heights respect baseline grid (divisible by 4)
- [ ] Font weights are consistent (e.g., Regular, Medium, Bold)
- [ ] Text hierarchy is clear (headings, body, captions)

**How to Check**:
1. Select text nodes
2. Verify font size matches scale
3. Calculate line height: `lineHeight / fontSize` should ≈ 1.5
4. Check line height % 4 === 0

---

#### 3. Color & Contrast

- [ ] Text/background pairs meet WCAG AA (4.5:1)
- [ ] Large text meets WCAG AA (3:1)
- [ ] AAA compliance achieved where possible (7:1)
- [ ] Color palette is consistent (brand colors)

**How to Check**:
```bash
# Use WCAG contrast validation tool
echo '{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "check_wcag_contrast",
    "arguments": {
      "foreground": "#333333",
      "background": "#FFFFFF"
    }
  }
}' | node mcp-server/dist/index.js

# Expected: Ratio ≥ 4.5:1 for normal text
```

---

#### 4. Components

- [ ] Reusable elements are components (not frames)
- [ ] Component variants are defined (states, sizes)
- [ ] Instances are used (not duplicated components)
- [ ] Component properties are logical and minimal

**How to Check**:
1. Look for purple outline (components) vs blue (frames)
2. Check component panel for variants
3. Verify instances reference same component

---

#### 5. Effects & Styles

- [ ] Shadows are subtle and consistent
- [ ] Blur effects have performance considerations
- [ ] Styles are reusable (text styles, color styles)
- [ ] Effects don't interfere with accessibility

**How to Check**:
1. Select nodes with effects
2. Verify effect parameters are reasonable
3. Check text styles panel for consistency

---

#### 6. Naming Conventions

- [ ] Frames have descriptive names (e.g., "Header Container", "Button Primary")
- [ ] Layers are organized logically
- [ ] No "Frame 123" or "Text 456" names
- [ ] Component names follow convention (Category/Name/Variant)

**How to Check**:
1. Review layer panel
2. Ensure all items are named meaningfully
3. Check for auto-generated names (bad)

---

### Accessibility Audit

**WCAG 2.1 AA Compliance**:

1. **Perceivable**
   - [ ] Text contrast ≥ 4.5:1 (normal), ≥ 3:1 (large)
   - [ ] Images have alt text (if applicable)
   - [ ] Color is not the only visual cue

2. **Operable**
   - [ ] Interactive elements are ≥ 44×44px (touch targets)
   - [ ] Focus states are visible
   - [ ] Tab order is logical

3. **Understandable**
   - [ ] Text is readable (font size ≥ 16px for body)
   - [ ] Language is clear and concise
   - [ ] Errors are identified and explained

4. **Robust**
   - [ ] Designs work on multiple screen sizes
   - [ ] Components are reusable and maintainable
   - [ ] No dependency on specific plugins

**How to Check**:
```bash
# Run WCAG validation test
cd tests
node integration/wcag-contrast.test.js

# Expected: All contrast ratios pass AA
```

---

## Troubleshooting Test Failures

### Unit Test Failures

#### Symptom: Color Conversion Test Fails

```
AssertionError: Expected '#ff0000' but got '#ff0001'
```

**Cause**: Rounding error in RGB → Hex conversion

**Solution**:
1. Check conversion logic in `mcp-server/src/constraints/color.ts`
2. Verify rounding behavior (should round, not truncate)
3. Update test if rounding is intentional

```typescript
// Correct rounding
function componentToHex(c: number): string {
  const hex = Math.round(c).toString(16);
  return hex.length === 1 ? '0' + hex : hex;
}
```

---

#### Symptom: Typography Test Fails

```
AssertionError: Expected line height 36 but got 35
```

**Cause**: Line height calculation not respecting baseline grid

**Solution**:
1. Check `calculateLineHeight` function
2. Ensure rounding up to nearest 4px

```typescript
// Correct baseline grid rounding
function calculateLineHeight(fontSize: number): number {
  const calculated = fontSize * 1.5;
  return Math.ceil(calculated / 4) * 4; // Round UP to nearest 4
}
```

---

### Integration Test Failures

#### Symptom: WebSocket Connection Timeout

```
Error: Server failed to start within timeout
```

**Possible Causes**:
1. Port 8080 already in use
2. WebSocket server failed to start
3. Firewall blocking connection
4. Server start delay too short

**Solutions**:

```bash
# Check if port is in use
lsof -i :8080

# If in use, kill process
lsof -ti:8080 | xargs kill -9

# Increase timeout in test
const SERVER_START_DELAY = 5000; // Increase from 2000

# Check firewall (macOS)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Check server can start manually
cd websocket-server
npm start
```

---

#### Symptom: Message Not Received

```
Error: Message wait timeout
```

**Possible Causes**:
1. WebSocket not connected
2. Message parsing error
3. Request ID mismatch
4. Server not forwarding messages

**Solutions**:

```javascript
// Add debug logging
ws.on('message', (data) => {
  console.log('[DEBUG] Received:', data.toString());
  const message = JSON.parse(data.toString());
  console.log('[DEBUG] Parsed:', message);
});

// Verify message format
const testMessage = {
  requestId: 'test-123',
  type: 'test_type',
  data: { ... }
};

// Check requestId matches
console.log('Sent requestId:', testMessage.requestId);
console.log('Received requestId:', receivedMessage.requestId);
```

---

### Visual Regression Failures

#### Symptom: False Positives (No Actual Change)

```
✗ button-primary: Changes detected (0.5% difference)
```

**Possible Causes**:
1. Anti-aliasing differences
2. Font rendering variations
3. System-specific rendering
4. Timing issues (animation mid-frame)

**Solutions**:

```javascript
// Increase threshold for anti-aliasing
const result = pixelmatch(img1.data, img2.data, diffImg.data, width, height, {
  threshold: 0.2  // Increase from 0.1
});

// Add delay for animations to settle
await page.waitForTimeout(1000);
await element.screenshot({ ... });

// Use consistent environment (Docker)
// Ensure same OS, browser version, font rendering
```

---

#### Symptom: Large Unexplained Differences

```
✗ dashboard-layout: Changes detected (15.7% difference)
```

**Possible Causes**:
1. Code regression (layout changed)
2. Design system update (intentional)
3. Figma API change (upstream)
4. Incorrect baseline

**Solutions**:

```bash
# Compare baseline vs current side-by-side
open tests/visual/baselines/dashboard-layout.png
open tests/visual/current/dashboard-layout.png

# Check Git history for recent changes
git log -p tests/visual/baselines/dashboard-layout.png

# If intentional, update baseline
cp tests/visual/current/dashboard-layout.png \
   tests/visual/baselines/dashboard-layout.png

# Re-run test to verify
node visual/compare.js
```

---

## Writing New Tests

### Unit Test Template

```javascript
/**
 * [Feature Name] Unit Tests
 *
 * Tests [description of what's being tested]
 */

import assert from 'assert';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import from compiled MCP server
const modulePath = join(__dirname, '../../mcp-server/dist/my-module.js');
let functionToTest;

/**
 * Load module from MCP server
 */
async function loadModule() {
  try {
    const module = await import(modulePath);
    functionToTest = module.functionToTest;
  } catch (error) {
    throw new Error(`Failed to load module: ${error.message}`);
  }
}

/**
 * Test Suite: [Feature Name]
 */
function testFeatureName() {
  console.log('\n  Test: Feature Name');

  // Test basic functionality
  const result = functionToTest(input);
  assert.strictEqual(result, expectedOutput, 'Should return expected output');

  // Test edge cases
  const edgeResult = functionToTest(edgeInput);
  assert.strictEqual(edgeResult, edgeExpected, 'Should handle edge case');

  // Test error conditions
  assert.throws(
    () => functionToTest(invalidInput),
    Error,
    'Should throw on invalid input'
  );

  console.log('    ✓ Basic functionality works');
  console.log('    ✓ Edge cases handled');
  console.log('    ✓ Error conditions validated');
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('\n=== [Feature Name] Unit Tests ===\n');

  try {
    await loadModule();
    testFeatureName();

    console.log('\n=== All Tests Passed ===\n');
    console.log('Validated:');
    console.log('  ✓ Feature works correctly');
    console.log('  ✓ Edge cases handled');
    console.log('  ✓ Errors thrown appropriately');
    console.log('');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    throw error;
  }
}

runTests()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
```

---

### Integration Test Template

```javascript
/**
 * [Integration Test Name]
 *
 * Tests [description of integration being tested]
 */

import { spawn } from 'child_process';
import { WebSocket } from 'ws';
import assert from 'assert';

const TEST_PORT = 8080;
const SERVER_START_DELAY = 2000;

/**
 * Start WebSocket server
 */
function startWebSocketServer() {
  return new Promise((resolve, reject) => {
    const serverPath = join(__dirname, '../../websocket-server/server.js');
    const serverProcess = spawn('node', [serverPath]);

    let serverStarted = false;

    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes('WebSocket bridge server started')) {
        serverStarted = true;
        setTimeout(() => resolve(serverProcess), 500);
      }
    });

    serverProcess.on('error', (error) => {
      if (!serverStarted) reject(error);
    });

    setTimeout(() => {
      if (!serverStarted) {
        serverProcess.kill();
        reject(new Error('Server start timeout'));
      }
    }, SERVER_START_DELAY);
  });
}

/**
 * Connect WebSocket client
 */
function connectClient() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);

    ws.on('open', () => resolve(ws));
    ws.on('error', (error) => reject(error));
  });
}

/**
 * Clean up resources
 */
function cleanup(serverProcess, clients = []) {
  clients.forEach(ws => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  if (serverProcess) {
    serverProcess.kill('SIGTERM');
  }
}

/**
 * Run integration tests
 */
async function runTests() {
  console.log('\n=== [Integration Test Name] ===\n');

  let serverProcess = null;
  let client = null;

  try {
    // Start server
    console.log('Starting WebSocket server...');
    serverProcess = await startWebSocketServer();
    console.log('✓ Server started\n');

    // Connect client
    console.log('Connecting client...');
    client = await connectClient();
    console.log('✓ Client connected\n');

    // Test logic here
    console.log('Running tests...');
    // ... your test code ...

    console.log('\n=== All Tests Passed ===\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    throw error;
  } finally {
    cleanup(serverProcess, [client]);
  }
}

runTests()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
```

---

## Performance Testing

### Load Testing

**Purpose**: Ensure system can handle high message throughput

**Scenario**:
- 100 concurrent Claude requests
- Each creates 10 frames (1000 total operations)
- Measure latency, throughput, error rate

**Implementation**:

```javascript
// tests/performance/load-test.js
import { WebSocket } from 'ws';

async function loadTest(numClients = 100, numRequests = 10) {
  const clients = [];
  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;

  // Create clients
  for (let i = 0; i < numClients; i++) {
    const ws = new WebSocket('ws://localhost:8080');
    clients.push(ws);
  }

  // Wait for all connections
  await Promise.all(clients.map(ws =>
    new Promise(resolve => ws.on('open', resolve))
  ));

  // Send requests
  const requests = [];
  for (const ws of clients) {
    for (let i = 0; i < numRequests; i++) {
      const promise = new Promise((resolve, reject) => {
        const request = {
          type: 'create_frame',
          requestId: `req-${Date.now()}-${Math.random()}`,
          name: `Frame ${i}`
        };

        ws.send(JSON.stringify(request));

        ws.once('message', (data) => {
          const response = JSON.parse(data.toString());
          if (response.type === 'command_success') {
            successCount++;
            resolve();
          } else {
            errorCount++;
            reject();
          }
        });
      });

      requests.push(promise);
    }
  }

  // Wait for all requests to complete
  await Promise.allSettled(requests);

  const endTime = Date.now();
  const duration = endTime - startTime;
  const throughput = (successCount / duration) * 1000; // ops/sec

  console.log('\n=== Load Test Results ===');
  console.log(`Clients: ${numClients}`);
  console.log(`Requests per client: ${numRequests}`);
  console.log(`Total requests: ${numClients * numRequests}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${errorCount}`);
  console.log(`Duration: ${duration}ms`);
  console.log(`Throughput: ${throughput.toFixed(2)} ops/sec`);

  // Cleanup
  clients.forEach(ws => ws.close());
}

loadTest();
```

**Run**:
```bash
cd tests
node performance/load-test.js
```

**Expected Results**:
- Throughput: > 100 ops/sec
- Error rate: < 1%
- P95 latency: < 500ms
- No crashes or hangs

---

### Memory Leak Detection

**Purpose**: Ensure system doesn't accumulate memory over time

**Implementation**:

```javascript
// tests/performance/memory-test.js
async function memoryTest(duration = 60000) {
  const snapshots = [];
  const interval = 5000; // Capture every 5 seconds

  const timer = setInterval(() => {
    const usage = process.memoryUsage();
    snapshots.push({
      timestamp: Date.now(),
      heapUsed: usage.heapUsed / 1024 / 1024, // MB
      external: usage.external / 1024 / 1024
    });

    console.log(`Heap: ${snapshots[snapshots.length - 1].heapUsed.toFixed(2)} MB`);
  }, interval);

  // Run load for duration
  await new Promise(resolve => setTimeout(resolve, duration));

  clearInterval(timer);

  // Analyze trend
  const firstSnapshot = snapshots[0];
  const lastSnapshot = snapshots[snapshots.length - 1];
  const growth = lastSnapshot.heapUsed - firstSnapshot.heapUsed;
  const growthPercent = (growth / firstSnapshot.heapUsed) * 100;

  console.log('\n=== Memory Test Results ===');
  console.log(`Initial heap: ${firstSnapshot.heapUsed.toFixed(2)} MB`);
  console.log(`Final heap: ${lastSnapshot.heapUsed.toFixed(2)} MB`);
  console.log(`Growth: ${growth.toFixed(2)} MB (${growthPercent.toFixed(2)}%)`);

  if (growthPercent > 50) {
    console.warn('⚠ Possible memory leak detected');
  } else {
    console.log('✓ Memory usage stable');
  }
}

memoryTest();
```

**Expected Results**:
- Heap growth: < 50% over 1 minute
- No continuous upward trend
- Memory stabilizes after warmup

---

## Best Practices

### 1. Test Naming

**Good**:
- `testValidateSpacing`
- `testHexToRgbConversion`
- `testWCAGContrastRatio`

**Bad**:
- `test1`, `test2`, `test3`
- `myTest`, `anotherTest`
- `foo`, `bar`, `baz`

---

### 2. Assertions

**Good**:
```javascript
assert.strictEqual(actual, expected, 'Descriptive failure message');
assert.deepStrictEqual(obj1, obj2, 'Objects should match');
assert.throws(() => fn(invalid), Error, 'Should throw on invalid input');
```

**Bad**:
```javascript
assert(actual == expected); // No message, loose equality
assert.strictEqual(actual, expected); // No message
```

---

### 3. Test Independence

**Good**:
```javascript
// Each test creates its own data
function testFeatureA() {
  const data = createTestData();
  // ... test using data
}

function testFeatureB() {
  const data = createTestData();
  // ... test using data
}
```

**Bad**:
```javascript
// Tests share state
let sharedData;

function testFeatureA() {
  sharedData = createTestData();
  // ... test using sharedData
}

function testFeatureB() {
  // Depends on testFeatureA running first!
  // ... test using sharedData
}
```

---

### 4. Cleanup

**Good**:
```javascript
async function runTests() {
  let serverProcess = null;

  try {
    serverProcess = await startServer();
    // ... tests
  } finally {
    // Always cleanup, even if tests fail
    if (serverProcess) serverProcess.kill();
  }
}
```

**Bad**:
```javascript
async function runTests() {
  const serverProcess = await startServer();
  // ... tests

  serverProcess.kill(); // Won't run if tests throw!
}
```

---

## Resources

### Documentation
- **Test Structure**: `tests/README.md`
- **Task Progress**: `docs/TASK_PROGRESS.md`
- **Implementation Tasks**: `docs/IMPLEMENTATION_TASKS.md`

### Tools
- **Node.js Assert**: https://nodejs.org/api/assert.html
- **Playwright**: https://playwright.dev/
- **Pixelmatch**: https://github.com/mapbox/pixelmatch
- **WebSocket (ws)**: https://github.com/websockets/ws

### Standards
- **WCAG 2.1**: https://www.w3.org/WAI/WCAG21/quickref/
- **Model Context Protocol**: https://modelcontextprotocol.io/
- **Figma Plugin API**: https://www.figma.com/plugin-docs/

---

**Last Updated**: October 17, 2025
**Maintained By**: Text-to-Figma Development Team
**Version**: 1.0.0
