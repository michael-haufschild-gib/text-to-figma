/**
 * Component Tools Tests
 *
 * Tests execute functions and schema validation for: create_component,
 * create_instance, create_component_set, set_component_properties,
 * add_variant_property, set_instance_swap
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the figma bridge
vi.mock('../../mcp-server/src/figma-bridge.js', () => {
  const mockBridge = {
    isConnected: vi.fn(() => true),
    sendToFigma: vi.fn(),
    sendToFigmaWithRetry: vi.fn(),
    sendToFigmaValidated: vi.fn(),
    sendToFigmaWithAbort: vi.fn(),
    getConnectionStatus: vi.fn(() => ({
      connected: true,
      pendingRequests: 0,
      circuitBreakerState: 'CLOSED',
      reconnectAttempts: 0
    })),
    connect: vi.fn(),
    disconnect: vi.fn()
  };

  return {
    getFigmaBridge: () => mockBridge,
    FigmaBridge: vi.fn(() => mockBridge),
    __mockBridge: mockBridge
  };
});

const { createComponent, CreateComponentInputSchema } =
  await import('../../mcp-server/src/tools/create_component.js');
const { createInstance, CreateInstanceInputSchema } =
  await import('../../mcp-server/src/tools/create_instance.js');
const { createComponentSet, CreateComponentSetInputSchema } =
  await import('../../mcp-server/src/tools/create_component_set.js');
const { setComponentProperties } =
  await import('../../mcp-server/src/tools/set_component_properties.js');
const { addVariantProperty } = await import('../../mcp-server/src/tools/add_variant_property.js');
const { setInstanceSwap } = await import('../../mcp-server/src/tools/set_instance_swap.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigmaWithRetry: ReturnType<typeof vi.fn>;
    sendToFigmaValidated: ReturnType<typeof vi.fn>;
  };
};

describe('createComponent', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({ componentId: 'comp-42' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns componentId, name, and descriptive message', async () => {
    const result = await createComponent({
      frameId: 'frame-1',
      name: 'Button/Primary',
      description: 'Primary action button'
    });

    expect(result.componentId).toBe('comp-42');
    expect(result.name).toBe('Button/Primary');
    expect(result.description).toBe('Primary action button');
    expect(result.message).toBe(
      'Component "Button/Primary" created successfully. Use this component ID to create instances.'
    );
  });

  it('sends correct payload to bridge', async () => {
    await createComponent({
      frameId: 'frame-99',
      name: 'Card/Default',
      description: 'Default card layout'
    });

    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledWith(
      'create_component',
      {
        frameId: 'frame-99',
        name: 'Card/Default',
        description: 'Default card layout'
      },
      expect.anything() // Zod response schema
    );
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Connection lost'));

    await expect(createComponent({ frameId: 'frame-1', name: 'Fail' })).rejects.toThrow(
      'Connection lost'
    );
  });
});

describe('createInstance', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({ instanceId: 'inst-7' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns zero overridesApplied when no overrides provided', async () => {
    const result = await createInstance({
      componentId: 'comp-42'
    });

    expect(result.instanceId).toBe('inst-7');
    expect(result.componentId).toBe('comp-42');
    expect(result.overridesApplied).toBe(0);
    expect(result.message).toBe('Instance created successfully.');
  });

  it('counts overrides and includes count in message', async () => {
    const result = await createInstance({
      componentId: 'comp-42',
      name: 'Submit Button',
      x: 100,
      y: 200,
      parentId: 'parent-1',
      overrides: [
        { type: 'text', nodeId: 'label-1', value: 'Submit' },
        { type: 'fill', nodeId: 'bg-1', color: '#FF0000' }
      ]
    });

    expect(result.instanceId).toBe('inst-7');
    expect(result.overridesApplied).toBe(2);
    expect(result.message).toBe('Instance created successfully with 2 override(s).');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Plugin timeout'));

    await expect(createInstance({ componentId: 'comp-42' })).rejects.toThrow('Plugin timeout');
  });
});

describe('createComponentSet', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      componentSetId: 'set-99'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns componentSetId, name, and variant count', async () => {
    const result = await createComponentSet({
      componentIds: ['comp-1', 'comp-2', 'comp-3'],
      name: 'Button',
      description: 'Button component with states'
    });

    expect(result.componentSetId).toBe('set-99');
    expect(result.name).toBe('Button');
    expect(result.variantCount).toBe(3);
    expect(result.message).toBe('Created component set "Button" with 3 variants');
  });

  it('rejects response when bridge returns no componentSetId', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Required at "componentSetId"'));

    await expect(
      createComponentSet({
        componentIds: ['comp-a', 'comp-b'],
        name: 'Card'
      })
    ).rejects.toThrow();
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Figma crashed'));

    await expect(
      createComponentSet({
        componentIds: ['comp-1', 'comp-2'],
        name: 'Fail'
      })
    ).rejects.toThrow('Figma crashed');
  });
});

describe('setComponentProperties', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaWithRetry.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tracks name and description in updated array', async () => {
    const result = await setComponentProperties({
      componentId: 'comp-1',
      name: 'Button/Secondary',
      description: 'Secondary action button'
    });

    expect(result.componentId).toBe('comp-1');
    expect(result.updated).toEqual(['name', 'description']);
    expect(result.message).toBe('Component properties updated: name, description');
  });

  it('tracks variant properties count in updated array', async () => {
    const result = await setComponentProperties({
      componentId: 'comp-2',
      variantProperties: [
        { name: 'Size', value: 'Large' },
        { name: 'State', value: 'Active' }
      ]
    });

    expect(result.updated).toEqual(['2 variant properties']);
    expect(result.message).toContain('2 variant properties');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaWithRetry.mockRejectedValue(new Error('Bridge down'));

    await expect(setComponentProperties({ componentId: 'comp-3', name: 'Fail' })).rejects.toThrow(
      'Bridge down'
    );
  });
});

describe('addVariantProperty', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaWithRetry.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns property name, value count, and descriptive message', async () => {
    const result = await addVariantProperty({
      componentSetId: 'set-1',
      propertyName: 'State',
      values: ['Default', 'Hover', 'Pressed', 'Disabled']
    });

    expect(result.componentSetId).toBe('set-1');
    expect(result.propertyName).toBe('State');
    expect(result.valueCount).toBe(4);
    expect(result.message).toBe('Added variant property "State" with 4 values to component set');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaWithRetry.mockRejectedValue(new Error('Network failure'));

    await expect(
      addVariantProperty({
        componentSetId: 'set-1',
        propertyName: 'Size',
        values: ['Small', 'Large']
      })
    ).rejects.toThrow('Network failure');
  });
});

describe('setInstanceSwap', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      oldComponentId: 'comp-old'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns oldComponentId from bridge response', async () => {
    const result = await setInstanceSwap({
      instanceId: 'inst-1',
      newComponentId: 'comp-new'
    });

    expect(result.instanceId).toBe('inst-1');
    expect(result.oldComponentId).toBe('comp-old');
    expect(result.newComponentId).toBe('comp-new');
    expect(result.message).toBe('Instance swapped successfully');
  });

  it('handles missing oldComponentId from bridge response', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({ success: true });

    const result = await setInstanceSwap({
      instanceId: 'inst-2',
      newComponentId: 'comp-new-2'
    });

    expect(result.oldComponentId).toBeUndefined();
    expect(result.newComponentId).toBe('comp-new-2');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Swap failed'));

    await expect(
      setInstanceSwap({ instanceId: 'inst-3', newComponentId: 'comp-fail' })
    ).rejects.toThrow('Swap failed');
  });
});

// ─── Schema Validation ─────────────────────────────────────────────────

describe('CreateComponentInputSchema', () => {
  it('requires frameId and name', () => {
    expect(CreateComponentInputSchema.safeParse({}).success).toBe(false);
    expect(CreateComponentInputSchema.safeParse({ frameId: 'f' }).success).toBe(false);
    expect(CreateComponentInputSchema.safeParse({ name: 'n' }).success).toBe(false);
  });

  it('rejects empty frameId', () => {
    expect(CreateComponentInputSchema.safeParse({ frameId: '', name: 'n' }).success).toBe(false);
  });

  it('rejects empty name', () => {
    expect(CreateComponentInputSchema.safeParse({ frameId: 'f', name: '' }).success).toBe(false);
  });

  it('accepts valid input with optional description', () => {
    expect(
      CreateComponentInputSchema.safeParse({
        frameId: 'frame-1',
        name: 'Button',
        description: 'Primary button'
      }).success
    ).toBe(true);
  });
});

describe('CreateInstanceInputSchema', () => {
  it('requires componentId', () => {
    expect(CreateInstanceInputSchema.safeParse({}).success).toBe(false);
  });

  it('accepts minimal input', () => {
    expect(CreateInstanceInputSchema.safeParse({ componentId: 'comp-1' }).success).toBe(true);
  });

  it('accepts overrides with text and fill types', () => {
    const result = CreateInstanceInputSchema.safeParse({
      componentId: 'comp-1',
      overrides: [
        { type: 'text', nodeId: 'label', value: 'Hello' },
        { type: 'fill', nodeId: 'bg', color: '#FF0000' }
      ]
    });
    expect(result.success).toBe(true);
  });

  it('rejects fill override with invalid hex color', () => {
    const result = CreateInstanceInputSchema.safeParse({
      componentId: 'comp-1',
      overrides: [{ type: 'fill', nodeId: 'bg', color: 'red' }]
    });
    expect(result.success).toBe(false);
  });

  it('rejects fill override with 3-char hex color', () => {
    const result = CreateInstanceInputSchema.safeParse({
      componentId: 'comp-1',
      overrides: [{ type: 'fill', nodeId: 'bg', color: '#F00' }]
    });
    expect(result.success).toBe(false);
  });
});

describe('CreateInstanceInputSchema — override edge cases', () => {
  it('rejects override with unknown type discriminator', () => {
    const result = CreateInstanceInputSchema.safeParse({
      componentId: 'comp-1',
      overrides: [{ type: 'visibility', nodeId: 'n1', value: true }]
    });
    expect(result.success).toBe(false);
  });

  it('rejects text override missing value field', () => {
    const result = CreateInstanceInputSchema.safeParse({
      componentId: 'comp-1',
      overrides: [{ type: 'text', nodeId: 'label' }]
    });
    expect(result.success).toBe(false);
  });

  it('rejects fill override missing color field', () => {
    const result = CreateInstanceInputSchema.safeParse({
      componentId: 'comp-1',
      overrides: [{ type: 'fill', nodeId: 'bg' }]
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty overrides array', () => {
    const result = CreateInstanceInputSchema.safeParse({
      componentId: 'comp-1',
      overrides: []
    });
    expect(result.success).toBe(true);
  });

  it('rejects fill override with 8-char hex (alpha channel)', () => {
    const result = CreateInstanceInputSchema.safeParse({
      componentId: 'comp-1',
      overrides: [{ type: 'fill', nodeId: 'bg', color: '#FF000080' }]
    });
    expect(result.success).toBe(false);
  });

  it('accepts fill override with lowercase hex', () => {
    const result = CreateInstanceInputSchema.safeParse({
      componentId: 'comp-1',
      overrides: [{ type: 'fill', nodeId: 'bg', color: '#ff00aa' }]
    });
    expect(result.success).toBe(true);
  });
});

describe('CreateComponentSetInputSchema', () => {
  it('requires componentIds array with at least 2 elements', () => {
    expect(
      CreateComponentSetInputSchema.safeParse({ componentIds: ['a'], name: 'S' }).success
    ).toBe(false);
  });

  it('accepts 2 component IDs', () => {
    expect(
      CreateComponentSetInputSchema.safeParse({
        componentIds: ['comp-1', 'comp-2'],
        name: 'Button'
      }).success
    ).toBe(true);
  });

  it('rejects empty componentIds array', () => {
    expect(
      CreateComponentSetInputSchema.safeParse({ componentIds: [], name: 'Empty' }).success
    ).toBe(false);
  });

  it('requires name field', () => {
    expect(CreateComponentSetInputSchema.safeParse({ componentIds: ['a', 'b'] }).success).toBe(
      false
    );
  });
});
