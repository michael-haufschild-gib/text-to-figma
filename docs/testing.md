# Testing Guide for LLM Coding Agents

**Purpose**: Instructions for writing and running tests in the Text-to-Figma project.

**Test Stack**: Node.js built-in `assert` module | Node.js `--test` runner | WebSocket (`ws`)

---

## Test Structure

```
tests/
├── unit/               # Fast, isolated tests - import compiled modules
│   ├── color-converter.test.js
│   ├── typography-generator.test.js
│   └── *.test.ts       # TypeScript unit tests
│
├── integration/        # Test WebSocket flow and multi-component interaction
│   ├── foundation.test.js
│   ├── wcag-contrast.test.js
│   └── component-tools.test.js
│
├── validation/         # Design token and constraint validation
│   └── design-tokens.test.js
│
├── e2e/                # End-to-end tests (require running servers)
│   ├── button-component.test.js
│   └── login-form.test.js
│
├── agents/             # Agent-based review tests
│   └── design-reviewer.js
│
└── visual/             # Visual regression tests
    └── regression.test.js
```

---

## Running Tests

```bash
# All tests (recommended)
cd tests && npm test

# Unit tests only
cd tests && npm run test:unit

# Integration tests only
cd tests && npm run test:integration

# Single test file
node tests/unit/color-converter.test.js

# TypeScript tests (run via node --test with ts loader or compile first)
cd mcp-server && npm run build && cd ../tests && node unit/tool-router.test.ts
```

---

## How to Write a Unit Test

Create `tests/unit/{module}.test.js`:

```javascript
/**
 * {Module Name} Unit Tests
 *
 * Tests {description of what this module does}
 */

import assert from 'assert';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import from compiled MCP server
const modulePath = join(__dirname, '../../mcp-server/dist/{path/to/module}.js');

let functionToTest;

/**
 * Load module under test
 */
async function loadModule() {
  try {
    const module = await import(modulePath);
    functionToTest = module.functionToTest;
  } catch (error) {
    throw new Error(`Failed to load module: ${error.message}. Ensure MCP server is built.`);
  }
}

/**
 * Test Suite: {Feature Name}
 */
function test{FeatureName}() {
  console.log('\n  Test: {Feature Name}');

  // Test case 1
  const result = functionToTest(input);
  assert.strictEqual(result, expected, 'Should return expected value');
  console.log('    ✓ Test case description');

  // Test case 2 - edge case
  const edgeResult = functionToTest(edgeInput);
  assert.deepStrictEqual(edgeResult, expectedObject, 'Should handle edge case');
  console.log('    ✓ Edge case description');
}

/**
 * Test Suite: Error Handling
 */
function testErrorHandling() {
  console.log('\n  Test: Error Handling');

  // Test throws
  assert.throws(
    () => functionToTest(invalidInput),
    { message: /expected error pattern/ },
    'Should throw on invalid input'
  );
  console.log('    ✓ Throws on invalid input');
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('\n{Module Name} Tests');
  console.log('═'.repeat(50));

  await loadModule();

  test{FeatureName}();
  testErrorHandling();

  console.log('\n═'.repeat(50));
  console.log('All {Module Name} tests passed! ✓\n');
}

runTests().catch((error) => {
  console.error('\nTest failed:', error.message);
  process.exit(1);
});
```

---

## How to Write an Integration Test

Create `tests/integration/{feature}.test.js`:

```javascript
/**
 * {Feature} Integration Test
 *
 * Tests the complete WebSocket pipeline for {feature}
 */

import { spawn } from 'child_process';
import { WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import assert from 'assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_PORT = 8080;
const SERVER_START_DELAY = 2000;

/**
 * Start the WebSocket server
 */
function startWebSocketServer() {
  return new Promise((resolve, reject) => {
    const serverPath = join(__dirname, '../../websocket-server/server.js');

    const serverProcess = spawn('node', [serverPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });

    let serverStarted = false;

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[Server] ${output.trim()}`);

      if (output.includes('WebSocket bridge server started')) {
        serverStarted = true;
        setTimeout(() => resolve(serverProcess), 500);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[Server Error] ${data.toString().trim()}`);
    });

    setTimeout(() => {
      if (!serverStarted) {
        serverProcess.kill();
        reject(new Error('Server failed to start within timeout'));
      }
    }, SERVER_START_DELAY);
  });
}

/**
 * Connect test client
 */
function connectClient() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);

    ws.on('open', () => resolve(ws));
    ws.on('error', reject);

    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });
}

/**
 * Send message and wait for response
 */
function sendAndReceive(ws, message) {
  return new Promise((resolve, reject) => {
    const requestId = `test-${Date.now()}`;

    ws.on('message', (data) => {
      const response = JSON.parse(data.toString());
      if (response.requestId === requestId) {
        resolve(response);
      }
    });

    ws.send(JSON.stringify({ ...message, requestId }));

    setTimeout(() => reject(new Error('Response timeout')), 10000);
  });
}

/**
 * Main test runner
 */
async function runTests() {
  let serverProcess;
  let client;

  try {
    console.log('\n{Feature} Integration Tests');
    console.log('═'.repeat(50));

    // Setup
    serverProcess = await startWebSocketServer();
    client = await connectClient();
    console.log('✓ Server started and client connected');

    // Test 1: {Description}
    console.log('\nTest: {Description}');
    const response = await sendAndReceive(client, {
      type: '{command_type}',
      payload: {
        /* test payload */
      }
    });
    assert.strictEqual(response.status, 'success');
    console.log('  ✓ {Test assertion}');

    console.log('\n═'.repeat(50));
    console.log('All integration tests passed! ✓\n');
  } finally {
    // Cleanup
    if (client) client.close();
    if (serverProcess) serverProcess.kill();
  }
}

runTests().catch((error) => {
  console.error('\nTest failed:', error.message);
  process.exit(1);
});
```

---

## Testing Patterns

### Pattern 1: Testing Constraint Validators

```javascript
function testSpacingConstraint() {
  // Valid values should pass
  const valid = validateSpacing(16);
  assert.strictEqual(valid.isValid, true);

  // Invalid values should fail with suggestion
  const invalid = validateSpacing(15);
  assert.strictEqual(invalid.isValid, false);
  assert.strictEqual(invalid.suggested, 16);
}
```

### Pattern 2: Testing Color Conversions

```javascript
function testHexToRgb() {
  // Standard colors
  assert.deepStrictEqual(hexToRgb('#FF0000'), { r: 255, g: 0, b: 0 });

  // Without hash
  assert.deepStrictEqual(hexToRgb('00FF00'), { r: 0, g: 255, b: 0 });

  // Case insensitive
  assert.deepStrictEqual(hexToRgb('#ffffff'), { r: 255, g: 255, b: 255 });
}
```

### Pattern 3: Testing WCAG Contrast

```javascript
function testContrastRatio() {
  // Black on white = 21:1 (max)
  const ratio = getContrastRatio('#FFFFFF', '#000000');
  assert.strictEqual(ratio.toFixed(1), '21.0');

  // Verify WCAG AA compliance
  const result = validateContrast('#FFFFFF', '#0066FF', 'AA', 'normal');
  assert.strictEqual(result.passes, true);
}
```

### Pattern 4: Testing WebSocket Messages

```javascript
function testMessageHandling() {
  const message = {
    type: 'create_frame',
    payload: { name: 'Test', layoutMode: 'VERTICAL' },
    requestId: 'test-123'
  };

  // Verify message structure
  assert.ok(message.type);
  assert.ok(message.requestId);
  assert.strictEqual(message.payload.layoutMode, 'VERTICAL');
}
```

---

## Test Assertions Reference

```javascript
// Strict equality (use for primitives)
assert.strictEqual(actual, expected);

// Deep equality (use for objects/arrays)
assert.deepStrictEqual(actualObj, expectedObj);

// Truthy/Falsy
assert.ok(value);

// Throws
assert.throws(() => functionThatThrows(), { message: /pattern/ });

// Does not throw
assert.doesNotThrow(() => safeFn());

// Regex match
assert.match(string, /pattern/);
```

---

## Test Dependencies

Tests import from compiled MCP server. Always build first:

```bash
cd mcp-server && npm run build
```

Import pattern:

```javascript
const modulePath = join(__dirname, '../../mcp-server/dist/constraints/color.js');
const { hexToRgb } = await import(modulePath);
```

---

## Common Mistakes

❌ **Don't**: Import from `.ts` files directly
✅ **Do**: Import from compiled `.js` in `mcp-server/dist/`

❌ **Don't**: Skip the build step before running tests
✅ **Do**: Run `npm run build` in mcp-server first

❌ **Don't**: Use `assert.equal()` (loose comparison)
✅ **Do**: Use `assert.strictEqual()` (strict comparison)

❌ **Don't**: Forget cleanup in integration tests
✅ **Do**: Always close WebSocket connections and kill server processes

❌ **Don't**: Hard-code absolute paths
✅ **Do**: Use `__dirname` and `join()` for relative paths

❌ **Don't**: Use async/await without proper error handling
✅ **Do**: Wrap tests in try/catch and call `process.exit(1)` on failure

❌ **Don't**: Create tests that depend on network or external services
✅ **Do**: Mock external dependencies or use local servers

❌ **Don't**: Test trivial things (default values, existence checks)
✅ **Do**: Test actual functionality that could reveal bugs

❌ **Don't**: Leave zombie server processes running
✅ **Do**: Use try/finally blocks to ensure cleanup

❌ **Don't**: Use timeouts longer than 30 seconds in tests
✅ **Do**: Keep timeouts short (5-10 seconds) for fast feedback
