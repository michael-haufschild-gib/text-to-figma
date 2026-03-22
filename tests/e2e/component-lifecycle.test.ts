/**
 * Component Lifecycle E2E Tests
 *
 * Tests component creation, instantiation, property management,
 * and variant workflows through the full three-tier chain.
 *
 * Bug this catches:
 * - create_component doesn't forward frameId correctly
 * - create_instance doesn't link to the correct componentId
 * - Component property updates don't reach the Figma plugin
 * - create_component_set / add_variant_property chain breaks
 * - set_instance_swap doesn't forward the new component ID
 * - create_boolean_operation doesn't send all nodeIds
 * - Component workflow: create frame → convert to component → instantiate fails
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { routeToolCall } from '../../mcp-server/src/routing/tool-router.js';
import {
  setupThreeTier,
  teardownThreeTier,
  resetPerTest,
  createParentFrame,
  extractId,
  type ThreeTierContext
} from './helpers/three-tier-setup.js';

let ctx: ThreeTierContext;

beforeAll(async () => {
  ctx = await setupThreeTier();
});

afterAll(async () => {
  await teardownThreeTier(ctx);
});

beforeEach(() => {
  resetPerTest(ctx);
});

// ─── create_component ────────────────────────────────────────────────────

describe('Component Lifecycle E2E — create_component', () => {
  it('converts a frame to a component and returns componentId', async () => {
    const frameId = await createParentFrame('ButtonFrame');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('create_component', {
      frameId,
      name: 'Button'
    });

    expect(result[0].text).toContain('Component Created Successfully');
    expect(result[0].text).toContain('Component ID:');
    expect(result[0].text).toContain('Name: Button');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_component');
    expect(cmd).toEqual(expect.objectContaining({ type: 'create_component' }));
    expect(cmd!.payload.frameId).toBe(frameId);
    expect(cmd!.payload.name).toBe('Button');
  });

  it('includes description when provided', async () => {
    const frameId = await createParentFrame('CardFrame');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('create_component', {
      frameId,
      name: 'Card',
      description: 'A reusable card component with title and body'
    });

    expect(result[0].text).toContain('Card');
    expect(result[0].text).toContain('reusable card component');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_component');
    expect(cmd!.payload.description).toBe('A reusable card component with title and body');
  });

  it('rejects empty frameId', async () => {
    await expect(
      routeToolCall('create_component', {
        frameId: '',
        name: 'Invalid'
      })
    ).rejects.toThrow();

    expect(ctx.plugin.getReceivedCommands()).toHaveLength(0);
  });

  it('rejects empty name', async () => {
    await expect(
      routeToolCall('create_component', {
        frameId: 'some-frame',
        name: ''
      })
    ).rejects.toThrow();

    expect(ctx.plugin.getReceivedCommands()).toHaveLength(0);
  });
});

// ─── create_instance ─────────────────────────────────────────────────────

describe('Component Lifecycle E2E — create_instance', () => {
  it('creates an instance of a component', async () => {
    const frameId = await createParentFrame('SourceFrame');
    ctx.plugin.clearCommands();

    // Step 1: Create component
    const compResult = await routeToolCall('create_component', {
      frameId,
      name: 'SourceComponent'
    });
    const componentId = extractId(compResult[0].text!, /Component ID:\s*(\S+)/);
    ctx.plugin.clearCommands();

    // Step 2: Create instance
    const instResult = await routeToolCall('create_instance', {
      componentId,
      name: 'InstanceOfSource'
    });

    expect(instResult[0].text).toContain('Instance Created Successfully');
    expect(instResult[0].text).toContain('Instance ID:');
    expect(instResult[0].text).toContain(`Component ID: ${componentId}`);

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_instance');
    expect(cmd).toEqual(expect.objectContaining({ type: 'create_instance' }));
    expect(cmd!.payload.componentId).toBe(componentId);
    expect(cmd!.payload.name).toBe('InstanceOfSource');
  });

  it('passes position and parentId to the plugin', async () => {
    const frameId = await createParentFrame('CompFrame');
    const compResult = await routeToolCall('create_component', { frameId, name: 'Comp' });
    const componentId = extractId(compResult[0].text!, /Component ID:\s*(\S+)/);

    const parentId = await createParentFrame('InstanceContainer');
    ctx.plugin.clearCommands();

    await routeToolCall('create_instance', {
      componentId,
      name: 'PositionedInstance',
      x: 100,
      y: 200,
      parentId
    });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_instance');
    expect(cmd!.payload.componentId).toBe(componentId);
    expect(cmd!.payload.x).toBe(100);
    expect(cmd!.payload.y).toBe(200);
    expect(cmd!.payload.parentId).toBe(parentId);
  });

  it('passes overrides to the plugin', async () => {
    const frameId = await createParentFrame('OverrideFrame');
    const compResult = await routeToolCall('create_component', { frameId, name: 'OverrideComp' });
    const componentId = extractId(compResult[0].text!, /Component ID:\s*(\S+)/);
    ctx.plugin.clearCommands();

    await routeToolCall('create_instance', {
      componentId,
      overrides: [
        { type: 'text', nodeId: 'text-1', value: 'New Label' },
        { type: 'fill', nodeId: 'bg-1', color: '#FF0000' }
      ]
    });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_instance');
    const overrides = cmd!.payload.overrides as Array<Record<string, unknown>>;
    expect(overrides).toHaveLength(2);
    expect(overrides[0]).toEqual(
      expect.objectContaining({ type: 'text', nodeId: 'text-1', value: 'New Label' })
    );
    expect(overrides[1]).toEqual(
      expect.objectContaining({ type: 'fill', nodeId: 'bg-1', color: '#FF0000' })
    );
  });
});

// ─── create_component_set & add_variant_property ─────────────────────────

describe('Component Lifecycle E2E — component sets and variants', () => {
  it('creates a component set and returns its ID', async () => {
    const result = await routeToolCall('create_component_set', {
      name: 'ButtonVariants',
      componentIds: ['comp-1', 'comp-2']
    });

    expect(result[0].text).toContain('Component Set ID:');
    expect(result[0].text).toContain('ButtonVariants');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_component_set');
    expect(cmd).toEqual(expect.objectContaining({ type: 'create_component_set' }));
    expect(cmd!.payload.name).toBe('ButtonVariants');
  });

  it('adds a variant property to a component set', async () => {
    const setResult = await routeToolCall('create_component_set', {
      name: 'SizeVariants',
      componentIds: ['comp-1', 'comp-2']
    });
    const setId = extractId(setResult[0].text!, /Component Set ID:\s*(\S+)/);
    ctx.plugin.clearCommands();

    const result = await routeToolCall('add_variant_property', {
      componentSetId: setId,
      propertyName: 'Size',
      values: ['Small', 'Medium', 'Large']
    });

    expect(result[0].text).toContain('Property: Size');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'add_variant_property');
    expect(cmd).toEqual(expect.objectContaining({ type: 'add_variant_property' }));
    expect(cmd!.payload.componentSetId).toBe(setId);
    expect(cmd!.payload.propertyName).toBe('Size');
    expect(cmd!.payload.values).toEqual(['Small', 'Medium', 'Large']);
  });
});

// ─── set_component_properties ────────────────────────────────────────────

describe('Component Lifecycle E2E — set_component_properties', () => {
  it('updates component properties', async () => {
    const frameId = await createParentFrame('PropFrame');
    const compResult = await routeToolCall('create_component', { frameId, name: 'PropComp' });
    const componentId = extractId(compResult[0].text!, /Component ID:\s*(\S+)/);
    ctx.plugin.clearCommands();

    const result = await routeToolCall('set_component_properties', {
      componentId,
      properties: { label: 'Click Me', disabled: false }
    });

    expect(result[0].text).toContain('Component Properties Updated');
    expect(result[0].text).toContain(`Component ID: ${componentId}`);

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_component_properties');
    expect(cmd).toEqual(expect.objectContaining({ type: 'set_component_properties' }));
    expect(cmd!.payload.componentId).toBe(componentId);
  });
});

// ─── set_instance_swap ───────────────────────────────────────────────────

describe('Component Lifecycle E2E — set_instance_swap', () => {
  it('swaps an instance to a different component', async () => {
    // Create source component
    const frame1 = await createParentFrame('Frame1');
    const comp1Result = await routeToolCall('create_component', {
      frameId: frame1,
      name: 'Comp1'
    });
    const comp1Id = extractId(comp1Result[0].text!, /Component ID:\s*(\S+)/);

    // Create instance of comp1
    const instResult = await routeToolCall('create_instance', { componentId: comp1Id });
    const instId = extractId(instResult[0].text!, /Instance ID:\s*(\S+)/);

    // Create target component
    const frame2 = await createParentFrame('Frame2');
    const comp2Result = await routeToolCall('create_component', {
      frameId: frame2,
      name: 'Comp2'
    });
    const comp2Id = extractId(comp2Result[0].text!, /Component ID:\s*(\S+)/);
    ctx.plugin.clearCommands();

    // Swap instance to comp2
    const result = await routeToolCall('set_instance_swap', {
      instanceId: instId,
      newComponentId: comp2Id
    });

    expect(result[0].text).toContain('Instance ID:');
    expect(result[0].text).toContain(`New Component ID: ${comp2Id}`);

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_instance_swap');
    expect(cmd).toEqual(expect.objectContaining({ type: 'set_instance_swap' }));
    expect(cmd!.payload.instanceId).toBe(instId);
    expect(cmd!.payload.newComponentId).toBe(comp2Id);
  });
});

// ─── create_boolean_operation ────────────────────────────────────────────

describe('Component Lifecycle E2E — create_boolean_operation', () => {
  it('creates a boolean union of multiple nodes', async () => {
    const ellipse1Result = await routeToolCall('create_ellipse', {
      name: 'Circle1',
      width: 100,
      height: 100
    });
    const ellipse1Id = extractId(ellipse1Result[0].text!, /Ellipse ID:\s*(\S+)/);

    const ellipse2Result = await routeToolCall('create_ellipse', {
      name: 'Circle2',
      width: 100,
      height: 100
    });
    const ellipse2Id = extractId(ellipse2Result[0].text!, /Ellipse ID:\s*(\S+)/);
    ctx.plugin.clearCommands();

    const result = await routeToolCall('create_boolean_operation', {
      operation: 'UNION',
      nodeIds: [ellipse1Id, ellipse2Id],
      name: 'MergedCircles'
    });

    expect(result[0].text).toContain('Boolean Node ID:');
    expect(result[0].text).toContain('Operation: UNION');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_boolean_operation');
    expect(cmd).toEqual(expect.objectContaining({ type: 'create_boolean_operation' }));
    expect(cmd!.payload.operation).toBe('UNION');
    expect(cmd!.payload.nodeIds).toEqual([ellipse1Id, ellipse2Id]);
    expect(cmd!.payload.name).toBe('MergedCircles');
  });

  it('supports SUBTRACT, INTERSECT, and EXCLUDE operations', async () => {
    for (const operation of ['SUBTRACT', 'INTERSECT', 'EXCLUDE']) {
      resetPerTest(ctx);

      const e1 = await routeToolCall('create_ellipse', { name: 'A', width: 50, height: 50 });
      const e2 = await routeToolCall('create_ellipse', { name: 'B', width: 50, height: 50 });
      const id1 = extractId(e1[0].text!, /Ellipse ID:\s*(\S+)/);
      const id2 = extractId(e2[0].text!, /Ellipse ID:\s*(\S+)/);
      ctx.plugin.clearCommands();

      const result = await routeToolCall('create_boolean_operation', {
        operation,
        nodeIds: [id1, id2]
      });

      expect(result[0].text).toContain(`Operation: ${operation}`);

      const cmd = ctx.plugin
        .getReceivedCommands()
        .find((c) => c.type === 'create_boolean_operation');
      expect(cmd!.payload.operation).toBe(operation);
    }
  });
});

// ─── Full Component Workflow ─────────────────────────────────────────────

describe('Component Lifecycle E2E — full workflow', () => {
  it('create frame → add children → convert to component → instantiate → modify instance', async () => {
    // Step 1: Create a frame to be the component base
    const frameResult = await routeToolCall('create_frame', {
      name: 'ButtonBase',
      layoutMode: 'HORIZONTAL',
      padding: 16,
      itemSpacing: 8
    });
    const frameId = extractId(frameResult[0].text!, /Frame ID:\s*(\S+)/);

    // Step 2: Add a text child
    await routeToolCall('create_text', {
      content: 'Submit',
      fontSize: 16,
      parentId: frameId
    });

    // Step 3: Convert to component
    ctx.plugin.clearCommands();
    const compResult = await routeToolCall('create_component', {
      frameId,
      name: 'SubmitButton',
      description: 'Primary submit button'
    });
    const componentId = extractId(compResult[0].text!, /Component ID:\s*(\S+)/);
    expect(compResult[0].text).toContain('SubmitButton');

    // Step 4: Create instance
    const instResult = await routeToolCall('create_instance', {
      componentId,
      name: 'SubmitButton-Hero',
      x: 200,
      y: 100
    });
    expect(instResult[0].text).toContain('Instance Created Successfully');
    expect(instResult[0].text).toContain(componentId);

    // Step 5: Verify the chain of commands
    const allCmds = ctx.plugin.getReceivedCommands();
    const compCmd = allCmds.find((c) => c.type === 'create_component');
    const instCmd = allCmds.find((c) => c.type === 'create_instance');

    expect(compCmd!.payload.frameId).toBe(frameId);
    expect(instCmd!.payload.componentId).toBe(componentId);
  });
});

// ─── Component Library Workflow ────────────────────────────────────────────

describe('Component Lifecycle E2E — component library with styles', () => {
  it('creates a design system: color style + text style + component + styled instance', async () => {
    // Bug this catches: the full design system workflow where an agent
    // creates styles, creates a component, then instantiates it with
    // overrides — any ID mismatch between steps breaks the chain.

    // Step 1: Create a color style for the button
    const colorResult = await routeToolCall('create_color_style', {
      name: 'Brand/Primary',
      color: '#0066FF'
    });
    const colorStyleId = extractId(colorResult[0].text!, /Style ID:\s*(\S+)/);

    // Step 2: Create a text style for button labels
    const textStyleResult = await routeToolCall('create_text_style', {
      name: 'Button/Label',
      fontSize: 16,
      fontWeight: 600
    });
    const textStyleId = extractId(textStyleResult[0].text!, /Style ID:\s*(\S+)/);

    // Step 3: Create the button frame
    const buttonFrame = await routeToolCall('create_frame', {
      name: 'PrimaryButton',
      layoutMode: 'HORIZONTAL',
      padding: 16,
      itemSpacing: 8
    });
    const buttonFrameId = extractId(buttonFrame[0].text!, /Frame ID:\s*(\S+)/);

    // Step 4: Add label text to button
    const labelResult = await routeToolCall('create_text', {
      content: 'Click Me',
      fontSize: 16,
      parentId: buttonFrameId
    });
    const labelId = extractId(labelResult[0].text!, /Text ID:\s*(\S+)/);

    // Step 5: Apply color style to button frame
    await routeToolCall('apply_fill_style', {
      nodeId: buttonFrameId,
      styleNameOrId: colorStyleId
    });

    // Step 6: Apply text style to label
    await routeToolCall('apply_text_style', {
      nodeId: labelId,
      styleNameOrId: textStyleId
    });

    // Step 7: Convert to component
    ctx.plugin.clearCommands();
    const compResult = await routeToolCall('create_component', {
      frameId: buttonFrameId,
      name: 'PrimaryButton',
      description: 'Primary brand button with label'
    });
    const componentId = extractId(compResult[0].text!, /Component ID:\s*(\S+)/);

    // Step 8: Instantiate with overrides
    const instanceResult = await routeToolCall('create_instance', {
      componentId,
      name: 'HeroButton',
      overrides: [{ type: 'text', nodeId: labelId, value: 'Get Started' }]
    });
    expect(instanceResult[0].text).toContain('Instance Created Successfully');
    expect(instanceResult[0].text).toContain(componentId);

    // Verify the full chain: component creation used the right frame,
    // instance creation used the right component
    const compCmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_component');
    const instCmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_instance');
    expect(compCmd!.payload.frameId).toBe(buttonFrameId);
    expect(instCmd!.payload.componentId).toBe(componentId);

    // Instance overrides should be forwarded
    const overrides = instCmd!.payload.overrides as Array<Record<string, unknown>>;
    expect(overrides).toHaveLength(1);
    expect(overrides[0].value).toBe('Get Started');
  });
});
