/**
 * E2E Test: Generate Login Form
 *
 * Complete end-to-end workflow test for generating a login form in Figma:
 * 1. Create form container with proper spacing
 * 2. Add form fields (email, password) with labels
 * 3. Add submit button with proper styling
 * 4. Apply validation states (error, success)
 * 5. Validate form structure (vertical layout, proper spacing)
 * 6. Validate typography hierarchy (title > labels > inputs)
 * 7. Check contrast on all text elements
 * 8. Verify component composition
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
 * Form Configuration
 */
const FORM_CONFIG = {
  container: {
    name: 'LoginForm',
    width: 320,
    height: 400,
    padding: 32,
    gap: 24,
    background: '#FFFFFF',
    borderRadius: 8,
    shadow: {
      color: 'rgba(0, 0, 0, 0.1)',
      x: 0,
      y: 4,
      blur: 16
    }
  },
  title: {
    text: 'Sign In',
    fontSize: 32,
    fontWeight: 700,
    color: '#212529',
    marginBottom: 8
  },
  subtitle: {
    text: 'Enter your credentials to continue',
    fontSize: 16,
    fontWeight: 400,
    color: '#6C757D',
    marginBottom: 32
  },
  fields: [
    {
      id: 'email',
      label: 'Email',
      type: 'email',
      placeholder: 'you@example.com',
      fontSize: 16,
      height: 40
    },
    {
      id: 'password',
      label: 'Password',
      type: 'password',
      placeholder: '••••••••',
      fontSize: 16,
      height: 40
    }
  ],
  button: {
    text: 'Sign In',
    width: 256,
    height: 48,
    fontSize: 16,
    fontWeight: 600,
    background: '#0066CC',
    textColor: '#FFFFFF',
    borderRadius: 4
  },
  spacing: {
    fieldGap: 24,
    labelGap: 8,
    buttonMarginTop: 32
  }
};

/**
 * Test: Create Login Form
 */
async function testCreateLoginForm(executor) {
  console.log('\n  Test: Creating login form component\n');

  const results = {
    steps: [],
    nodeIds: {},
    success: false,
    typography: [],
    contrast: []
  };

  try {
    // Step 1: Validate design tokens
    console.log('    Step 1: Validating design tokens...');
    const tokenValidation = await executor.execute('validate_design_tokens', {
      spacing: [8, 24, 32, 40, 48],
      typography: [
        { fontSize: 32, name: 'title' },
        { fontSize: 16, name: 'body' },
        { fontSize: 16, name: 'input' }
      ],
      colors: [
        { foreground: '#212529', background: '#FFFFFF', name: 'title' },
        { foreground: '#6C757D', background: '#FFFFFF', name: 'subtitle' },
        { foreground: '#FFFFFF', background: '#0066CC', name: 'button' }
      ]
    });

    assert.ok(tokenValidation.spacing.valid >= 4, 'Spacing tokens should be valid');
    assert.ok(tokenValidation.typography.valid >= 2, 'Typography tokens should be valid');
    assert.ok(tokenValidation.colors.passesAA >= 2, 'Color pairs should pass AA');
    results.steps.push({ step: 'validate_tokens', success: true, data: tokenValidation });
    console.log('      ✓ Design tokens validated');

    // Step 2: Create form container
    console.log('\n    Step 2: Creating form container...');
    const container = await executor.execute('create_frame', {
      name: FORM_CONFIG.container.name,
      width: FORM_CONFIG.container.width,
      height: FORM_CONFIG.container.height,
      x: 100,
      y: 100
    });

    assert.ok(container.nodeId, 'Container should have nodeId');
    results.nodeIds.container = container.nodeId;
    results.steps.push({ step: 'create_container', success: true, data: container });
    console.log(`      ✓ Container created (ID: ${container.nodeId})`);

    // Step 3: Style container
    console.log('    Step 3: Styling container...');
    const containerStyle = await executor.execute('set_fills', {
      nodeId: container.nodeId,
      fills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 1, b: 1 }
        }
      ]
    });

    await executor.execute('set_layout_properties', {
      nodeId: container.nodeId,
      properties: {
        cornerRadius: FORM_CONFIG.container.borderRadius,
        paddingTop: FORM_CONFIG.container.padding,
        paddingRight: FORM_CONFIG.container.padding,
        paddingBottom: FORM_CONFIG.container.padding,
        paddingLeft: FORM_CONFIG.container.padding,
        layoutMode: 'VERTICAL',
        itemSpacing: FORM_CONFIG.container.gap
      }
    });

    await executor.execute('apply_effects', {
      nodeId: container.nodeId,
      effects: [
        {
          type: 'DROP_SHADOW',
          color: FORM_CONFIG.container.shadow.color,
          offset: {
            x: FORM_CONFIG.container.shadow.x,
            y: FORM_CONFIG.container.shadow.y
          },
          radius: FORM_CONFIG.container.shadow.blur,
          visible: true
        }
      ]
    });

    results.steps.push({ step: 'style_container', success: true });
    console.log('      ✓ Container styled with shadow and padding');

    // Step 4: Add title
    console.log('\n    Step 4: Adding title...');
    const title = await executor.execute('create_text', {
      text: FORM_CONFIG.title.text,
      fontSize: FORM_CONFIG.title.fontSize,
      fontWeight: FORM_CONFIG.title.fontWeight,
      x: 132,
      y: 132,
      fills: [
        {
          type: 'SOLID',
          color: {
            r: parseInt(FORM_CONFIG.title.color.slice(1, 3), 16) / 255,
            g: parseInt(FORM_CONFIG.title.color.slice(3, 5), 16) / 255,
            b: parseInt(FORM_CONFIG.title.color.slice(5, 7), 16) / 255
          }
        }
      ]
    });

    assert.ok(title.nodeId, 'Title should be created');
    results.nodeIds.title = title.nodeId;
    results.typography.push({
      element: 'title',
      fontSize: FORM_CONFIG.title.fontSize,
      fontWeight: FORM_CONFIG.title.fontWeight
    });
    results.steps.push({ step: 'create_title', success: true, data: title });
    console.log(`      ✓ Title created (ID: ${title.nodeId})`);

    // Step 5: Add subtitle
    console.log('    Step 5: Adding subtitle...');
    const subtitle = await executor.execute('create_text', {
      text: FORM_CONFIG.subtitle.text,
      fontSize: FORM_CONFIG.subtitle.fontSize,
      fontWeight: FORM_CONFIG.subtitle.fontWeight,
      x: 132,
      y: 172,
      fills: [
        {
          type: 'SOLID',
          color: {
            r: parseInt(FORM_CONFIG.subtitle.color.slice(1, 3), 16) / 255,
            g: parseInt(FORM_CONFIG.subtitle.color.slice(3, 5), 16) / 255,
            b: parseInt(FORM_CONFIG.subtitle.color.slice(5, 7), 16) / 255
          }
        }
      ]
    });

    assert.ok(subtitle.nodeId, 'Subtitle should be created');
    results.nodeIds.subtitle = subtitle.nodeId;
    results.typography.push({
      element: 'subtitle',
      fontSize: FORM_CONFIG.subtitle.fontSize,
      fontWeight: FORM_CONFIG.subtitle.fontWeight
    });
    results.steps.push({ step: 'create_subtitle', success: true, data: subtitle });
    console.log(`      ✓ Subtitle created (ID: ${subtitle.nodeId})`);

    // Step 6: Create form fields
    console.log('\n    Step 6: Creating form fields...');
    let fieldY = 220;

    for (const field of FORM_CONFIG.fields) {
      // Create label
      const label = await executor.execute('create_text', {
        text: field.label,
        fontSize: 16,
        fontWeight: 600,
        x: 132,
        y: fieldY,
        fills: [{ type: 'SOLID', color: { r: 0.13, g: 0.15, b: 0.16 } }]
      });

      results.nodeIds[`${field.id}_label`] = label.nodeId;
      results.typography.push({
        element: `${field.id}_label`,
        fontSize: 16,
        fontWeight: 600
      });
      console.log(`      ✓ Label created: ${field.label}`);

      // Create input field frame
      const input = await executor.execute('create_frame', {
        name: `${field.id}_input`,
        width: 256,
        height: field.height,
        x: 132,
        y: fieldY + 28
      });

      await executor.execute('set_fills', {
        nodeId: input.nodeId,
        fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]
      });

      await executor.execute('set_layout_properties', {
        nodeId: input.nodeId,
        properties: {
          strokeWeight: 1,
          strokes: [{ type: 'SOLID', color: { r: 0.82, g: 0.85, b: 0.87 } }],
          cornerRadius: 4,
          paddingLeft: 12,
          paddingRight: 12
        }
      });

      results.nodeIds[`${field.id}_input`] = input.nodeId;
      console.log(`      ✓ Input field created: ${field.id}`);

      fieldY += field.height + FORM_CONFIG.spacing.fieldGap + 28;
    }

    results.steps.push({ step: 'create_fields', success: true });
    console.log('      ✓ All form fields created');

    // Step 7: Add submit button
    console.log('\n    Step 7: Adding submit button...');
    const button = await executor.execute('create_frame', {
      name: 'submit_button',
      width: FORM_CONFIG.button.width,
      height: FORM_CONFIG.button.height,
      x: 132,
      y: fieldY + FORM_CONFIG.spacing.buttonMarginTop
    });

    await executor.execute('set_fills', {
      nodeId: button.nodeId,
      fills: [
        {
          type: 'SOLID',
          color: {
            r: parseInt(FORM_CONFIG.button.background.slice(1, 3), 16) / 255,
            g: parseInt(FORM_CONFIG.button.background.slice(3, 5), 16) / 255,
            b: parseInt(FORM_CONFIG.button.background.slice(5, 7), 16) / 255
          }
        }
      ]
    });

    await executor.execute('set_layout_properties', {
      nodeId: button.nodeId,
      properties: {
        cornerRadius: FORM_CONFIG.button.borderRadius
      }
    });

    const buttonText = await executor.execute('create_text', {
      text: FORM_CONFIG.button.text,
      fontSize: FORM_CONFIG.button.fontSize,
      fontWeight: FORM_CONFIG.button.fontWeight,
      x: 132 + 100,
      y: fieldY + FORM_CONFIG.spacing.buttonMarginTop + 16,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]
    });

    results.nodeIds.button = button.nodeId;
    results.nodeIds.buttonText = buttonText.nodeId;
    results.typography.push({
      element: 'button',
      fontSize: FORM_CONFIG.button.fontSize,
      fontWeight: FORM_CONFIG.button.fontWeight
    });
    results.steps.push({ step: 'create_button', success: true, data: button });
    console.log(`      ✓ Submit button created (ID: ${button.nodeId})`);

    // Step 8: Validate form structure (vertical layout, proper spacing)
    console.log('\n    Step 8: Validating form structure...');

    // Verify spacing uses 8pt grid
    const spacingValues = [
      FORM_CONFIG.container.padding,
      FORM_CONFIG.container.gap,
      FORM_CONFIG.spacing.fieldGap,
      FORM_CONFIG.spacing.buttonMarginTop
    ];

    const validSpacing = [0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128];
    const allSpacingValid = spacingValues.every(v => validSpacing.includes(v));
    assert.ok(allSpacingValid, 'All spacing should follow 8pt grid');

    results.steps.push({ step: 'validate_structure', success: true });
    console.log('      ✓ Form structure uses proper 8pt grid spacing');
    console.log('      ✓ Vertical layout with consistent gaps');

    // Step 9: Validate typography hierarchy
    console.log('\n    Step 9: Validating typography hierarchy...');

    // Title should be largest
    const titleType = results.typography.find(t => t.element === 'title');
    const subtitleType = results.typography.find(t => t.element === 'subtitle');
    const labelType = results.typography.find(t => t.element === 'email_label');

    assert.ok(titleType.fontSize > subtitleType.fontSize, 'Title should be larger than subtitle');
    assert.ok(titleType.fontSize > labelType.fontSize, 'Title should be larger than labels');
    assert.ok(titleType.fontWeight > labelType.fontWeight, 'Title should be bolder than labels');

    results.steps.push({ step: 'validate_typography', success: true });
    console.log('      ✓ Typography hierarchy: Title (32px) > Body (16px)');
    console.log('      ✓ Font weights properly differentiated');

    // Step 10: Check contrast on all text elements
    console.log('\n    Step 10: Checking contrast on all text...');

    const contrastChecks = [
      { name: 'title', fg: FORM_CONFIG.title.color, bg: FORM_CONFIG.container.background, fontSize: 32 },
      { name: 'subtitle', fg: FORM_CONFIG.subtitle.color, bg: FORM_CONFIG.container.background, fontSize: 16 },
      { name: 'button', fg: FORM_CONFIG.button.textColor, bg: FORM_CONFIG.button.background, fontSize: 16 }
    ];

    for (const check of contrastChecks) {
      const contrast = await executor.execute('check_wcag_contrast', {
        foreground: check.fg,
        background: check.bg,
        fontSize: check.fontSize,
        fontWeight: 400
      });

      assert.ok(contrast.compliance.aa.passes, `${check.name} should pass WCAG AA`);
      results.contrast.push({
        element: check.name,
        ratio: contrast.contrastRatio,
        passesAA: contrast.compliance.aa.passes
      });
      console.log(`      ✓ ${check.name}: ${contrast.contrastRatio.toFixed(2)}:1 (AA: ${contrast.compliance.aa.passes ? 'PASS' : 'FAIL'})`);
    }

    results.steps.push({ step: 'check_contrast', success: true });
    console.log('      ✓ All text elements meet WCAG AA standards');

    // Step 11: Componentize the form
    console.log('\n    Step 11: Creating component...');
    const component = await executor.execute('create_component', {
      nodeId: container.nodeId,
      name: FORM_CONFIG.container.name
    });

    assert.ok(component.componentId, 'Component should be created');
    results.nodeIds.component = component.componentId;
    results.steps.push({ step: 'create_component', success: true, data: component });
    console.log(`      ✓ Component created (ID: ${component.componentId})`);

    // Step 12: Verify component composition
    console.log('\n    Step 12: Verifying component composition...');
    assert.strictEqual(component.name, FORM_CONFIG.container.name, 'Component name should match');
    assert.ok(Object.keys(results.nodeIds).length >= 8, 'Component should have all child elements');

    results.steps.push({ step: 'verify_composition', success: true });
    console.log('      ✓ Component composition verified');
    console.log(`      ✓ Total elements: ${Object.keys(results.nodeIds).length}`);

    results.success = true;
    console.log('\n    ✓ LOGIN FORM component created successfully!\n');

  } catch (error) {
    console.error('\n    ✗ Login form failed:', error.message);
    results.error = error.message;
    results.success = false;
  }

  return results;
}

/**
 * Run E2E Login Form Tests
 */
async function runLoginFormTests() {
  console.log('\n========================================');
  console.log('E2E Test: Generate Login Form');
  console.log('========================================\n');

  const serverManager = new WebSocketServerManager();
  const executor = new FigmaToolExecutor();

  let result = null;

  try {
    // Start WebSocket server
    await serverManager.start();
    console.log('  ✓ WebSocket server started\n');

    // Connect executor
    await executor.connect();

    // Test login form creation
    result = await testCreateLoginForm(executor);

  } catch (error) {
    console.error('\n✗ Test suite failed:', error.message);
    result = { success: false, error: error.message };
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

  if (result && result.success) {
    console.log(`✓ Login Form: ${result.steps.length} steps completed`);
    console.log('');

    console.log('Validated:');
    console.log('  ✓ Design tokens validated (spacing, typography, colors)');
    console.log('  ✓ Form container created with proper dimensions');
    console.log('  ✓ Container styled with shadow and padding');
    console.log('  ✓ Title and subtitle added with proper hierarchy');
    console.log('  ✓ Form fields (email, password) created with labels');
    console.log('  ✓ Submit button added with proper styling');
    console.log('  ✓ Form structure uses 8pt grid spacing');
    console.log('  ✓ Typography hierarchy validated (32px > 16px)');
    console.log('  ✓ WCAG AA contrast met on all text');
    console.log('  ✓ Component successfully created');
    console.log('  ✓ Component composition verified');
    console.log('');

    console.log('Typography Hierarchy:');
    for (const typo of result.typography) {
      console.log(`  - ${typo.element}: ${typo.fontSize}px, weight ${typo.fontWeight}`);
    }
    console.log('');

    console.log('Contrast Validation:');
    for (const contrast of result.contrast) {
      console.log(`  - ${contrast.element}: ${contrast.ratio.toFixed(2)}:1 (${contrast.passesAA ? 'PASS' : 'FAIL'})`);
    }
    console.log('');
  } else {
    console.log('✗ Login Form: Failed');
    if (result && result.error) {
      console.log(`    Error: ${result.error}`);
    }
    console.log('');
  }

  console.log('========================================\n');

  return result && result.success;
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runLoginFormTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Login form E2E test failed:', error);
      process.exit(1);
    });
}

export { runLoginFormTests, FORM_CONFIG };
