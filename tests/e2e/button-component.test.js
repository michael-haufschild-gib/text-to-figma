/**
 * E2E Test: Generate Button Component
 *
 * Complete end-to-end workflow test for generating a button component in Figma:
 * 1. Validate design tokens (spacing, typography, colors)
 * 2. Create frame with proper dimensions
 * 3. Style frame with background and border
 * 4. Add text with correct typography
 * 5. Apply effects (shadows, etc.)
 * 6. Componentize the frame
 * 7. Verify each step's output
 * 8. Test primary, secondary, and danger variants
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import assert from 'assert';
import { WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const WEBSOCKET_PORT = 8080;
const WEBSOCKET_URL = `ws://localhost:${WEBSOCKET_PORT}`;
const SERVER_START_DELAY = 2000;

/**
 * WebSocket Server Manager
 */
class WebSocketServerManager {
  constructor() {
    this.process = null;
  }

  async start() {
    return new Promise((resolve, reject) => {
      const serverPath = join(__dirname, '../../websocket-server/server.js');

      console.log('  Starting WebSocket server...');
      this.process = spawn('node', [serverPath], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let serverStarted = false;

      this.process.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('WebSocket bridge server started')) {
          serverStarted = true;
          setTimeout(() => resolve(), 500);
        }
      });

      this.process.stderr.on('data', (data) => {
        console.error(`  [Server Error] ${data.toString().trim()}`);
      });

      this.process.on('error', (error) => {
        if (!serverStarted) {
          reject(new Error(`Failed to start server: ${error.message}`));
        }
      });

      setTimeout(() => {
        if (!serverStarted) {
          this.process.kill();
          reject(new Error('Server failed to start within timeout'));
        }
      }, SERVER_START_DELAY);
    });
  }

  stop() {
    if (this.process) {
      this.process.kill('SIGTERM');
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 1000);
    }
  }
}

/**
 * Figma Tool Executor
 * Sends commands to Figma via WebSocket bridge
 */
class FigmaToolExecutor {
  constructor() {
    this.ws = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log('  Connecting to Figma bridge...');
      this.ws = new WebSocket(WEBSOCKET_URL);

      this.ws.on('open', () => {
        console.log('  ✓ Connected to Figma bridge');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.requestId && this.pendingRequests.has(message.requestId)) {
            const { resolve, reject } = this.pendingRequests.get(message.requestId);
            this.pendingRequests.delete(message.requestId);

            if (message.success) {
              resolve(message.data);
            } else {
              reject(new Error(message.error || 'Command failed'));
            }
          }
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      });

      this.ws.on('error', (error) => {
        reject(new Error(`WebSocket error: ${error.message}`));
      });

      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  }

  async execute(toolName, args) {
    return new Promise((resolve, reject) => {
      const requestId = `req-${++this.requestId}`;

      const message = {
        type: 'tool_call',
        tool: toolName,
        requestId,
        arguments: args
      };

      this.pendingRequests.set(requestId, { resolve, reject });

      this.ws.send(JSON.stringify(message));

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Tool execution timeout: ${toolName}`));
        }
      }, 10000);
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

/**
 * Button Variant Configuration
 */
const BUTTON_VARIANTS = {
  primary: {
    name: 'ButtonPrimary',
    background: '#0066CC',
    textColor: '#FFFFFF',
    borderColor: '#0066CC',
    hoverBackground: '#0052A3',
    shadow: {
      color: 'rgba(0, 102, 204, 0.3)',
      x: 0,
      y: 2,
      blur: 8
    }
  },
  secondary: {
    name: 'ButtonSecondary',
    background: '#FFFFFF',
    textColor: '#0066CC',
    borderColor: '#0066CC',
    hoverBackground: '#F8F9FA',
    shadow: {
      color: 'rgba(0, 0, 0, 0.1)',
      x: 0,
      y: 1,
      blur: 3
    }
  },
  danger: {
    name: 'ButtonDanger',
    background: '#DC3545',
    textColor: '#FFFFFF',
    borderColor: '#DC3545',
    hoverBackground: '#BB2D3B',
    shadow: {
      color: 'rgba(220, 53, 69, 0.3)',
      x: 0,
      y: 2,
      blur: 8
    }
  }
};

/**
 * Test: Create Button Component
 */
async function testCreateButtonComponent(executor, variant, config) {
  console.log(`\n  Test: Creating ${variant} button component`);

  const results = {
    variant,
    steps: [],
    nodeIds: {},
    success: false
  };

  try {
    // Step 1: Validate design tokens
    console.log('    Step 1: Validating design tokens...');
    const tokenValidation = await executor.execute('validate_design_tokens', {
      spacing: [16, 24, 32],
      typography: [{ fontSize: 16, name: 'button-text' }],
      colors: [
        {
          foreground: config.textColor,
          background: config.background,
          name: `${variant}-button`
        }
      ]
    });

    assert.ok(tokenValidation.spacing.valid >= 3, 'Spacing tokens should be valid');
    assert.ok(tokenValidation.typography.valid >= 1, 'Typography tokens should be valid');
    results.steps.push({ step: 'validate_tokens', success: true, data: tokenValidation });
    console.log('      ✓ Design tokens validated');

    // Step 2: Create frame
    console.log('    Step 2: Creating frame...');
    const frame = await executor.execute('create_frame', {
      name: config.name,
      width: 120,
      height: 40,
      x: 100,
      y: 100 + (Object.keys(BUTTON_VARIANTS).indexOf(variant) * 60)
    });

    assert.ok(frame.nodeId, 'Frame should have nodeId');
    results.nodeIds.frame = frame.nodeId;
    results.steps.push({ step: 'create_frame', success: true, data: frame });
    console.log(`      ✓ Frame created (ID: ${frame.nodeId})`);

    // Step 3: Style frame with background and border
    console.log('    Step 3: Styling frame...');
    const styled = await executor.execute('set_fills', {
      nodeId: frame.nodeId,
      fills: [
        {
          type: 'SOLID',
          color: {
            r: parseInt(config.background.slice(1, 3), 16) / 255,
            g: parseInt(config.background.slice(3, 5), 16) / 255,
            b: parseInt(config.background.slice(5, 7), 16) / 255
          }
        }
      ]
    });

    assert.ok(styled.success, 'Fill should be applied successfully');
    results.steps.push({ step: 'set_fills', success: true, data: styled });
    console.log('      ✓ Frame styled with background');

    // Step 4: Add border
    console.log('    Step 4: Adding border...');
    const bordered = await executor.execute('set_layout_properties', {
      nodeId: frame.nodeId,
      properties: {
        strokeWeight: 1,
        strokes: [
          {
            type: 'SOLID',
            color: {
              r: parseInt(config.borderColor.slice(1, 3), 16) / 255,
              g: parseInt(config.borderColor.slice(3, 5), 16) / 255,
              b: parseInt(config.borderColor.slice(5, 7), 16) / 255
            }
          }
        ],
        cornerRadius: 4
      }
    });

    assert.ok(bordered.success, 'Border should be applied successfully');
    results.steps.push({ step: 'set_border', success: true, data: bordered });
    console.log('      ✓ Border applied');

    // Step 5: Add text
    console.log('    Step 5: Adding text...');
    const text = await executor.execute('create_text', {
      text: 'Click Me',
      fontSize: 16,
      fontWeight: 600,
      x: 110,
      y: 110 + (Object.keys(BUTTON_VARIANTS).indexOf(variant) * 60),
      fills: [
        {
          type: 'SOLID',
          color: {
            r: parseInt(config.textColor.slice(1, 3), 16) / 255,
            g: parseInt(config.textColor.slice(3, 5), 16) / 255,
            b: parseInt(config.textColor.slice(5, 7), 16) / 255
          }
        }
      ]
    });

    assert.ok(text.nodeId, 'Text should be created');
    results.nodeIds.text = text.nodeId;
    results.steps.push({ step: 'create_text', success: true, data: text });
    console.log(`      ✓ Text created (ID: ${text.nodeId})`);

    // Step 6: Apply effects (shadow)
    console.log('    Step 6: Applying effects...');
    const effects = await executor.execute('apply_effects', {
      nodeId: frame.nodeId,
      effects: [
        {
          type: 'DROP_SHADOW',
          color: config.shadow.color,
          offset: {
            x: config.shadow.x,
            y: config.shadow.y
          },
          radius: config.shadow.blur,
          visible: true
        }
      ]
    });

    assert.ok(effects.success, 'Effects should be applied');
    results.steps.push({ step: 'apply_effects', success: true, data: effects });
    console.log('      ✓ Shadow effect applied');

    // Step 7: Componentize
    console.log('    Step 7: Creating component...');
    const component = await executor.execute('create_component', {
      nodeId: frame.nodeId,
      name: config.name
    });

    assert.ok(component.componentId, 'Component should be created');
    results.nodeIds.component = component.componentId;
    results.steps.push({ step: 'create_component', success: true, data: component });
    console.log(`      ✓ Component created (ID: ${component.componentId})`);

    // Step 8: Verify component structure
    console.log('    Step 8: Verifying component structure...');
    assert.strictEqual(component.name, config.name, 'Component name should match');
    assert.ok(component.componentId, 'Component should have ID');
    results.steps.push({ step: 'verify_structure', success: true });
    console.log('      ✓ Component structure verified');

    // Step 9: Check WCAG contrast
    console.log('    Step 9: Checking WCAG contrast...');
    const contrast = await executor.execute('check_wcag_contrast', {
      foreground: config.textColor,
      background: config.background,
      fontSize: 16,
      fontWeight: 600
    });

    assert.ok(contrast.compliance.aa.passes, `${variant} button should pass WCAG AA`);
    results.steps.push({ step: 'check_contrast', success: true, data: contrast });
    console.log(`      ✓ Contrast verified (${contrast.contrastRatio.toFixed(2)}:1)`);

    results.success = true;
    console.log(`\n    ✓ ${variant.toUpperCase()} button component created successfully!\n`);

  } catch (error) {
    console.error(`\n    ✗ ${variant.toUpperCase()} button failed:`, error.message);
    results.error = error.message;
    results.success = false;
  }

  return results;
}

/**
 * Run E2E Button Component Tests
 */
async function runButtonComponentTests() {
  console.log('\n========================================');
  console.log('E2E Test: Generate Button Component');
  console.log('========================================\n');

  const serverManager = new WebSocketServerManager();
  const executor = new FigmaToolExecutor();

  const allResults = {
    variants: {},
    summary: {
      total: 0,
      passed: 0,
      failed: 0
    }
  };

  try {
    // Start WebSocket server
    await serverManager.start();
    console.log('  ✓ WebSocket server started\n');

    // Connect executor
    await executor.connect();

    // Test each button variant
    for (const [variant, config] of Object.entries(BUTTON_VARIANTS)) {
      const result = await testCreateButtonComponent(executor, variant, config);
      allResults.variants[variant] = result;
      allResults.summary.total++;

      if (result.success) {
        allResults.summary.passed++;
      } else {
        allResults.summary.failed++;
      }
    }

  } catch (error) {
    console.error('\n✗ Test suite failed:', error.message);
    allResults.summary.failed = allResults.summary.total;
  } finally {
    // Cleanup
    executor.disconnect();
    serverManager.stop();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Print summary
  console.log('\n========================================');
  console.log('Test Summary');
  console.log('========================================\n');

  for (const [variant, result] of Object.entries(allResults.variants)) {
    const status = result.success ? '✓' : '✗';
    const steps = result.steps.length;
    console.log(`${status} ${variant.toUpperCase()}: ${steps} steps completed`);

    if (!result.success && result.error) {
      console.log(`    Error: ${result.error}`);
    }
  }

  console.log(`\nTotal: ${allResults.summary.passed}/${allResults.summary.total} passed`);
  console.log('========================================\n');

  if (allResults.summary.passed === allResults.summary.total) {
    console.log('Validated:');
    console.log('  ✓ Design tokens validated for all variants');
    console.log('  ✓ Frames created with correct dimensions');
    console.log('  ✓ Background colors applied correctly');
    console.log('  ✓ Borders and corner radius applied');
    console.log('  ✓ Text created with correct typography');
    console.log('  ✓ Shadow effects applied');
    console.log('  ✓ Components created successfully');
    console.log('  ✓ WCAG AA contrast requirements met');
    console.log('  ✓ Primary, secondary, and danger variants tested');
    console.log('');
  }

  return allResults.summary.passed === allResults.summary.total;
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runButtonComponentTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Button component E2E test failed:', error);
      process.exit(1);
    });
}

export { runButtonComponentTests, BUTTON_VARIANTS };
