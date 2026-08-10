/**
 * Figma Plugin Query, Style, Component, and Utility Handlers — Unit Tests
 *
 * Direct coverage for handler behavior that e2e simulator responses cannot
 * validate: rich query serialization, local style uniqueness, component
 * mutation, and utility/cache side effects.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface MockNode {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parent: MockContainerNode | null;
  [key: string]: unknown;
}

interface MockContainerNode extends MockNode {
  children: MockNode[];
  appendChild: ReturnType<typeof vi.fn>;
}

let nodesById: Map<string, MockNode>;
let figmaMixed: symbol;
let currentPage: MockContainerNode & { selection: MockNode[] };
let getLocalPaintStylesAsync: ReturnType<typeof vi.fn>;
let createTextStyle: ReturnType<typeof vi.fn>;
let loadFontAsync: ReturnType<typeof vi.fn>;
let base64Encode: ReturnType<typeof vi.fn>;

const { cacheNode, resetNodeCache } = await import('../../figma-plugin/src/helpers.js');
const { handleGetNodeByName, handleGetSelection } =
  await import('../../figma-plugin/src/handlers/query.js');
const { handleAddVariantProperty, handleSetInstanceSwap } =
  await import('../../figma-plugin/src/handlers/components.js');
const { handleApplyFillStyle, handleCreateTextStyle } =
  await import('../../figma-plugin/src/handlers/styles.js');
const { handleExportNode, handleRemoveNode, handleRenameNode, handleSetExportSettings } =
  await import('../../figma-plugin/src/handlers/utility.js');

function cacheMockNode<T extends MockNode>(node: T): T {
  nodesById.set(node.id, node);
  cacheNode(node as unknown as SceneNode);
  return node;
}

function makeNode(overrides: Partial<MockNode> = {}): MockNode {
  return cacheMockNode({
    id: 'node-1',
    type: 'RECTANGLE',
    name: 'Node',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    parent: null,
    visible: true,
    locked: false,
    exportSettings: [],
    remove: vi.fn(function remove(this: MockNode) {
      if (this.parent) {
        this.parent.children = this.parent.children.filter((child) => child !== this);
      }
      nodesById.delete(this.id);
    }),
    ...overrides
  });
}

function makeContainer(overrides: Partial<MockContainerNode> = {}): MockContainerNode {
  const container = {
    id: 'container-1',
    type: 'FRAME',
    name: 'Container',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    parent: null,
    children: [],
    appendChild: vi.fn(function appendChild(this: MockContainerNode, child: MockNode) {
      this.children.push(child);
      child.parent = this;
    }),
    ...overrides
  } satisfies MockContainerNode;
  return cacheMockNode(container);
}

beforeEach(() => {
  resetNodeCache();
  nodesById = new Map();
  figmaMixed = Symbol('mixed');
  currentPage = makeContainer({
    id: 'page-1',
    type: 'PAGE',
    name: 'Page',
    selection: []
  }) as MockContainerNode & { selection: MockNode[] };
  getLocalPaintStylesAsync = vi.fn().mockResolvedValue([]);
  createTextStyle = vi.fn(() => ({
    id: 'text-style-1',
    name: '',
    fontName: null,
    fontSize: 0
  }));
  loadFontAsync = vi.fn().mockResolvedValue(undefined);
  base64Encode = vi.fn((bytes: Uint8Array) => `encoded:${Array.from(bytes).join(',')}`);

  (globalThis as Record<string, unknown>)['figma'] = {
    mixed: figmaMixed,
    root: { id: 'root', name: 'Document', type: 'DOCUMENT', children: [currentPage] },
    currentPage,
    getNodeById: vi.fn((id: string) => nodesById.get(id) ?? null),
    getLocalPaintStylesAsync,
    createTextStyle,
    loadFontAsync,
    base64Encode
  };
});

afterEach(() => {
  resetNodeCache();
  delete (globalThis as Record<string, unknown>)['figma'];
});

describe('query handlers', () => {
  it('finds only the first partial name match unless findAll is requested', () => {
    const first = makeNode({ id: 'first', name: 'Primary Button' });
    const second = makeNode({ id: 'second', name: 'Secondary Button' });
    currentPage.appendChild(first);
    currentPage.appendChild(second);

    const result = handleGetNodeByName({ name: 'button' });

    expect(result.found).toBe(1);
    expect(result.nodes).toEqual([{ nodeId: 'first', name: 'Primary Button', type: 'RECTANGLE' }]);
  });

  it('serializes mixed text selection as styled segments and respects maxDepth', () => {
    const child = makeNode({ id: 'child', name: 'Nested' });
    const text = makeNode({
      id: 'text-1',
      type: 'TEXT',
      name: 'Mixed text',
      characters: 'Hi',
      fontSize: figmaMixed,
      fontName: figmaMixed,
      fontWeight: figmaMixed,
      textCase: 'ORIGINAL',
      textDecoration: 'NONE',
      lineHeight: { value: 16, unit: 'PIXELS' },
      letterSpacing: { value: 0, unit: 'PIXELS' },
      fills: figmaMixed,
      children: [child],
      getStyledTextSegments: vi.fn(() => [
        {
          characters: 'H',
          start: 0,
          end: 1,
          fontSize: 12,
          fontName: { family: 'Inter', style: 'Bold' },
          fontWeight: 700,
          textDecoration: 'UNDERLINE',
          textCase: 'UPPER',
          lineHeight: { value: 18, unit: 'PIXELS' },
          letterSpacing: { value: 1, unit: 'PIXELS' },
          fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }]
        }
      ])
    });
    currentPage.selection = [text];

    const result = handleGetSelection({ includeDetails: true, maxDepth: 0 });

    expect(result.count).toBe(1);
    expect(result.selection).toMatchObject([
      {
        nodeId: 'text-1',
        type: 'TEXT',
        styledSegments: [{ characters: 'H', start: 0, end: 1, fontWeight: 700 }]
      }
    ]);
    expect((result.selection as Array<Record<string, unknown>>)[0]).not.toHaveProperty('children');
    expect(text.getStyledTextSegments).toHaveBeenCalledWith([
      'fontSize',
      'fontName',
      'fontWeight',
      'textDecoration',
      'textCase',
      'lineHeight',
      'letterSpacing',
      'fills'
    ]);
  });
});

describe('style handlers', () => {
  it('rejects duplicate local fill style names before mutating the target node', async () => {
    const setFillStyleIdAsync = vi.fn();
    makeNode({ id: 'rect-1', fillStyleId: '', setFillStyleIdAsync });
    getLocalPaintStylesAsync.mockResolvedValue([
      { id: 'style-1', name: 'Brand/Primary' },
      { id: 'style-2', name: 'Brand/Primary' }
    ]);

    await expect(
      handleApplyFillStyle({ nodeId: 'rect-1', styleName: 'Brand/Primary' })
    ).rejects.toThrow('Multiple fill styles named "Brand/Primary"');
    expect(setFillStyleIdAsync).not.toHaveBeenCalled();
  });

  it('falls back to Inter Regular when the requested text style font cannot load', async () => {
    const createdStyle = { id: 'text-style-1', name: '', fontName: null, fontSize: 0 };
    createTextStyle.mockReturnValue(createdStyle);
    loadFontAsync.mockRejectedValueOnce(new Error('missing font')).mockResolvedValueOnce(undefined);

    const result = await handleCreateTextStyle({
      name: 'Display',
      fontSize: 32,
      fontFamily: 'Nonexistent',
      fontWeight: 700
    });

    expect(loadFontAsync).toHaveBeenNthCalledWith(1, {
      family: 'Nonexistent',
      style: 'Bold'
    });
    expect(loadFontAsync).toHaveBeenNthCalledWith(2, {
      family: 'Inter',
      style: 'Regular'
    });
    expect(createdStyle).toMatchObject({
      name: 'Display',
      fontName: { family: 'Inter', style: 'Regular' },
      fontSize: 32
    });
    expect(result).toMatchObject({ styleId: 'text-style-1', name: 'Display' });
  });
});

describe('component handlers', () => {
  it('appends a variant property to component names without touching non-component children', () => {
    const component = makeNode({ id: 'component-1', type: 'COMPONENT', name: 'State=Default' });
    const nonComponent = makeNode({ id: 'frame-1', type: 'FRAME', name: 'Wrapper' });
    const componentSet = makeContainer({
      id: 'set-1',
      type: 'COMPONENT_SET',
      name: 'Button',
      children: [component, nonComponent]
    });

    const result = handleAddVariantProperty({
      componentSetId: 'set-1',
      propertyName: 'Size',
      values: ['Large']
    });

    expect(component.name).toBe('State=Default, Size=Large');
    expect(nonComponent.name).toBe('Wrapper');
    expect(result).toMatchObject({
      componentSetId: 'set-1',
      propertyName: 'Size',
      defaultValue: 'Large',
      updatedVariants: 1
    });
    expect(componentSet.children).toHaveLength(2);
  });

  it('reports the previous main component id before swapping an instance', async () => {
    const nextComponent = makeNode({ id: 'component-next', type: 'COMPONENT', name: 'Next' });
    const swapComponent = vi.fn();
    makeNode({
      id: 'instance-1',
      type: 'INSTANCE',
      name: 'Instance',
      getMainComponentAsync: vi.fn().mockResolvedValue({ id: 'component-old' }),
      swapComponent
    });

    const result = await handleSetInstanceSwap({
      instanceId: 'instance-1',
      newComponentId: 'component-next'
    });

    expect(swapComponent).toHaveBeenCalledWith(nextComponent);
    expect(result).toMatchObject({
      instanceId: 'instance-1',
      oldComponentId: 'component-old',
      newComponentId: 'component-next'
    });
  });
});

describe('utility handlers', () => {
  it('rejects an unsupported export format instead of silently exporting PNG', async () => {
    const exportAsync = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
    makeNode({ id: 'exportable', exportAsync });

    // A mislabelled export (PNG bytes reported as WEBP) is worse than a refusal:
    // the caller writes the wrong file extension and never learns why.
    await expect(
      handleExportNode({
        nodeId: 'exportable',
        format: 'WEBP',
        scale: 2,
        returnBase64: false
      })
    ).rejects.toThrow();

    expect(exportAsync).not.toHaveBeenCalled();
    expect(base64Encode).not.toHaveBeenCalled();
  });

  it('omits base64 data when the caller opts out, without exporting a null field', async () => {
    const exportAsync = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
    makeNode({ id: 'exportable', exportAsync });

    const result = await handleExportNode({
      nodeId: 'exportable',
      format: 'PNG',
      scale: 2,
      returnBase64: false
    });

    expect(exportAsync).toHaveBeenCalledWith({
      format: 'PNG',
      constraint: { type: 'SCALE', value: 2 }
    });
    expect(result).toMatchObject({ nodeId: 'exportable', format: 'PNG', scale: 2, byteLength: 3 });
    expect('base64Data' in result).toBe(false);
    expect(base64Encode).not.toHaveBeenCalled();
  });

  it('applies export setting defaults per item and omits constraints SVG cannot carry', () => {
    const node = makeNode({ id: 'node-1', exportSettings: [] });

    const result = handleSetExportSettings({
      nodeId: 'node-1',
      settings: [{ format: 'SVG', suffix: '@icon' }, { format: 'PNG' }]
    });

    expect(node.exportSettings).toEqual([
      { format: 'SVG', suffix: '@icon' },
      { format: 'PNG', constraint: { type: 'SCALE', value: 1 } }
    ]);
    expect(result.settingsCount).toBe(2);
  });

  it('rejects an unsupported export setting format', () => {
    makeNode({ id: 'node-1', exportSettings: [] });

    expect(() =>
      handleSetExportSettings({ nodeId: 'node-1', settings: [{ format: 'GIF' }] })
    ).toThrow();
  });

  it('uncaches removed nodes so later utility operations cannot mutate stale handles', () => {
    const node = makeNode({ id: 'remove-me', name: 'Remove me' });

    const result = handleRemoveNode({ nodeId: 'remove-me' });

    expect(node.remove).toHaveBeenCalled();
    expect(result).toMatchObject({ nodeId: 'remove-me', name: 'Remove me' });
    expect(() => handleRenameNode({ nodeId: 'remove-me', name: 'Stale mutation' })).toThrow(
      'Node not found'
    );
  });
});
