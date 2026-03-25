/**
 * Figma Plugin Helpers — Unit Tests
 *
 * Tests pure utility functions (hexToRgb, weightToStyle, convertEffects, getNodeDimensions)
 * and cache-dependent functions (getNode, cacheNode, resolveParent, loadFont) with a
 * minimal figma global mock.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal mock for the subset of PluginAPI that helpers.ts uses.
// Avoids importing the full Figma typings into test context.
interface MockFigmaApi {
  getNodeById: ReturnType<typeof vi.fn>;
  loadFontAsync: ReturnType<typeof vi.fn>;
  currentPage: { appendChild: ReturnType<typeof vi.fn> };
}

let mockFigma: MockFigmaApi;

beforeEach(() => {
  mockFigma = {
    getNodeById: vi.fn().mockReturnValue(null),
    loadFontAsync: vi.fn().mockResolvedValue(undefined),
    currentPage: { appendChild: vi.fn() }
  };
  (globalThis as Record<string, unknown>)['figma'] = mockFigma;
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>)['figma'];
});

// Dynamic import so the module sees the mock `figma` global at load time.
// The module is re-imported per test suite, but cache state persists across tests
// within a suite, so we use resetNodeCache() for isolation.
const {
  hexToRgb,
  weightToStyle,
  convertEffects,
  getNodeDimensions,
  cacheNode,
  getNode,
  resolveParent,
  loadFont,
  resetNodeCache
} = await import('../../figma-plugin/src/helpers.js');

describe('hexToRgb', () => {
  it('converts 6-digit hex with # prefix', () => {
    const rgb = hexToRgb('#FF0000');
    expect(rgb).toEqual({ r: 1, g: 0, b: 0 });
  });

  it('converts 6-digit hex without # prefix', () => {
    const rgb = hexToRgb('00FF00');
    expect(rgb).toEqual({ r: 0, g: 1, b: 0 });
  });

  it('converts black (#000000)', () => {
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('converts white (#FFFFFF)', () => {
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 1, g: 1, b: 1 });
  });

  it('handles lowercase hex', () => {
    expect(hexToRgb('#ff8000')).toEqual({ r: 1, g: 128 / 255, b: 0 });
  });

  it('handles uppercase hex', () => {
    expect(hexToRgb('#FF8000')).toEqual({ r: 1, g: 128 / 255, b: 0 });
  });

  it('converts a mid-range color accurately', () => {
    const rgb = hexToRgb('#808080');
    expect(rgb).toEqual({ r: 128 / 255, g: 128 / 255, b: 128 / 255 });
  });
});

describe('weightToStyle', () => {
  it('maps weight <= 300 to Light', () => {
    expect(weightToStyle(300)).toBe('Light');
    expect(weightToStyle(100)).toBe('Light');
    expect(weightToStyle(200)).toBe('Light');
  });

  it('maps weight 400 to Regular', () => {
    expect(weightToStyle(400)).toBe('Regular');
  });

  it('maps weight 500 to Medium', () => {
    expect(weightToStyle(500)).toBe('Medium');
  });

  it('maps weight 600 to Semi Bold', () => {
    expect(weightToStyle(600)).toBe('Semi Bold');
  });

  it('maps weight >= 700 to Bold', () => {
    expect(weightToStyle(700)).toBe('Bold');
    expect(weightToStyle(800)).toBe('Bold');
    expect(weightToStyle(900)).toBe('Bold');
  });

  it('maps boundary value 301-399 to Regular (not Light, not Medium)', () => {
    expect(weightToStyle(301)).toBe('Regular');
    expect(weightToStyle(399)).toBe('Regular');
  });

  it('maps boundary value 501-599 to Medium (below Semi Bold threshold)', () => {
    expect(weightToStyle(501)).toBe('Medium');
    expect(weightToStyle(599)).toBe('Medium');
  });
});

describe('convertEffects', () => {
  it('converts DROP_SHADOW with x/y offset', () => {
    const result = convertEffects([
      { type: 'DROP_SHADOW', color: '#FF0000', opacity: 0.5, x: 4, y: 8, blur: 10, spread: 2 }
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'DROP_SHADOW',
      color: { r: 1, g: 0, b: 0, a: 0.5 },
      offset: { x: 4, y: 8 },
      radius: 10,
      spread: 2,
      visible: true,
      blendMode: 'NORMAL'
    });
  });

  it('converts DROP_SHADOW with offsetX/offsetY (overrides x/y)', () => {
    const result = convertEffects([
      { type: 'DROP_SHADOW', x: 1, y: 2, offsetX: 10, offsetY: 20, blur: 5 }
    ]);
    const effect = result[0] as Record<string, unknown>;
    expect(effect['offset']).toEqual({ x: 10, y: 20 });
  });

  it('converts INNER_SHADOW with default values', () => {
    const result = convertEffects([{ type: 'INNER_SHADOW' }]);
    expect(result[0]).toEqual({
      type: 'INNER_SHADOW',
      color: { r: 0, g: 0, b: 0, a: 1 },
      offset: { x: 0, y: 0 },
      radius: 0,
      spread: 0,
      visible: true,
      blendMode: 'NORMAL'
    });
  });

  it('converts LAYER_BLUR with radius property', () => {
    const result = convertEffects([{ type: 'LAYER_BLUR', radius: 12 }]);
    expect(result[0]).toEqual({ type: 'LAYER_BLUR', radius: 12, visible: true });
  });

  it('converts LAYER_BLUR falling back to blur property', () => {
    const result = convertEffects([{ type: 'LAYER_BLUR', blur: 8 }]);
    expect(result[0]).toEqual({ type: 'LAYER_BLUR', radius: 8, visible: true });
  });

  it('converts BACKGROUND_BLUR with radius', () => {
    const result = convertEffects([{ type: 'BACKGROUND_BLUR', radius: 20 }]);
    expect(result[0]).toEqual({ type: 'BACKGROUND_BLUR', radius: 20, visible: true });
  });

  it('converts BACKGROUND_BLUR with default radius 0', () => {
    const result = convertEffects([{ type: 'BACKGROUND_BLUR' }]);
    expect(result[0]).toEqual({ type: 'BACKGROUND_BLUR', radius: 0, visible: true });
  });

  it('throws on unknown effect type', () => {
    expect(() => convertEffects([{ type: 'GLOW' }])).toThrow('Unknown effect type: GLOW');
  });

  it('converts multiple effects in a single call', () => {
    const result = convertEffects([
      { type: 'DROP_SHADOW', blur: 4 },
      { type: 'LAYER_BLUR', radius: 6 }
    ]);
    expect(result).toHaveLength(2);
    expect((result[0] as Record<string, unknown>)['type']).toBe('DROP_SHADOW');
    expect((result[1] as Record<string, unknown>)['type']).toBe('LAYER_BLUR');
  });
});

describe('getNodeDimensions', () => {
  it('returns width and height from a node that has them', () => {
    const node = { width: 100, height: 50 } as SceneNode;
    expect(getNodeDimensions(node)).toEqual({ width: 100, height: 50 });
  });

  it('returns 0 for dimensions when node lacks width/height', () => {
    // SceneNode union includes types that may lack width/height at runtime
    const node = {} as SceneNode;
    expect(getNodeDimensions(node)).toEqual({ width: 0, height: 0 });
  });
});

describe('cacheNode + getNode', () => {
  beforeEach(() => {
    resetNodeCache();
  });

  it('retrieves a cached node by ID', () => {
    const node = { id: 'node-1', type: 'FRAME' } as unknown as SceneNode;
    cacheNode(node);
    const result = getNode('node-1');
    expect(result).toBe(node);
    // Should not fall back to figma.getNodeById for a cache hit
    expect(mockFigma.getNodeById).not.toHaveBeenCalled();
  });

  it('falls back to figma.getNodeById on cache miss', () => {
    const node = { id: 'remote-1', type: 'RECTANGLE' } as unknown as SceneNode;
    mockFigma.getNodeById.mockReturnValue(node);
    const result = getNode('remote-1');
    expect(result).toBe(node);
    expect(mockFigma.getNodeById).toHaveBeenCalledWith('remote-1');
  });

  it('returns null for non-existent node', () => {
    mockFigma.getNodeById.mockReturnValue(null);
    const result = getNode('missing-id');
    expect(result).toBe(null);
  });

  it('returns null when figma.getNodeById throws', () => {
    mockFigma.getNodeById.mockImplementation(() => {
      throw new Error('Node removed');
    });
    const result = getNode('error-id');
    expect(result).toBe(null);
  });
});

describe('resolveParent', () => {
  beforeEach(() => {
    resetNodeCache();
  });

  it('returns figma.currentPage when no parentId is provided', () => {
    const result = resolveParent();
    expect(result).toBe(mockFigma.currentPage);
  });

  it('returns figma.currentPage when parentId is undefined', () => {
    const result = resolveParent(undefined);
    expect(result).toBe(mockFigma.currentPage);
  });

  it('returns cached node when parentId is valid and has appendChild', () => {
    const parent = { id: 'parent-1', appendChild: vi.fn() } as unknown as SceneNode;
    cacheNode(parent);
    const result = resolveParent('parent-1');
    expect(result).toBe(parent);
  });

  it('throws when parentId refers to a non-existent node', () => {
    mockFigma.getNodeById.mockReturnValue(null);
    expect(() => resolveParent('bad-id')).toThrow(
      'Parent node not found: bad-id. Node cannot be created without valid parent.'
    );
  });

  it('throws when parentId refers to a node without appendChild', () => {
    const nonContainer = { id: 'leaf-1' } as unknown as SceneNode;
    cacheNode(nonContainer);
    expect(() => resolveParent('leaf-1')).toThrow(
      'Parent node not found: leaf-1. Node cannot be created without valid parent.'
    );
  });
});

describe('loadFont', () => {
  beforeEach(() => {
    resetNodeCache();
  });

  it('returns the requested font when loadFontAsync succeeds', async () => {
    mockFigma.loadFontAsync.mockResolvedValue(undefined);
    const result = await loadFont('Roboto', 700);
    expect(result).toEqual({
      fontName: { family: 'Roboto', style: 'Bold' },
      usedFallback: false,
      requestedFamily: 'Roboto',
      requestedStyle: 'Bold'
    });
    expect(mockFigma.loadFontAsync).toHaveBeenCalledWith({ family: 'Roboto', style: 'Bold' });
  });

  it('falls back to Inter Regular when loadFontAsync rejects', async () => {
    mockFigma.loadFontAsync
      .mockRejectedValueOnce(new Error('Font not found'))
      .mockResolvedValueOnce(undefined);
    const result = await loadFont('Nonexistent', 400);
    expect(result).toEqual({
      fontName: { family: 'Inter', style: 'Regular' },
      usedFallback: true,
      requestedFamily: 'Nonexistent',
      requestedStyle: 'Regular'
    });
    expect(mockFigma.loadFontAsync).toHaveBeenCalledTimes(2);
    expect(mockFigma.loadFontAsync).toHaveBeenLastCalledWith({
      family: 'Inter',
      style: 'Regular'
    });
  });
});

describe('cache eviction', () => {
  beforeEach(() => {
    resetNodeCache();
  });

  it('evicts oldest entries when cache exceeds 1000 nodes', () => {
    // Fill cache to 1001 nodes (triggers eviction of first 100)
    for (let i = 0; i < 1001; i++) {
      const node = { id: `n-${i}` } as unknown as SceneNode;
      cacheNode(node);
    }

    // Oldest 100 nodes (n-0 through n-99) should be evicted.
    // getNode should fall back to figma.getNodeById, which returns null.
    mockFigma.getNodeById.mockReturnValue(null);
    const evicted = getNode('n-0');
    expect(evicted).toBe(null);
    expect(mockFigma.getNodeById).toHaveBeenCalledWith('n-0');

    // n-99 should also be evicted
    mockFigma.getNodeById.mockClear();
    mockFigma.getNodeById.mockReturnValue(null);
    const alsoEvicted = getNode('n-99');
    expect(alsoEvicted).toBe(null);
    expect(mockFigma.getNodeById).toHaveBeenCalledWith('n-99');

    // n-100 should still be in cache (not evicted)
    mockFigma.getNodeById.mockClear();
    const retained = getNode('n-100');
    expect((retained as Record<string, unknown>)['id']).toBe('n-100');
    expect(mockFigma.getNodeById).not.toHaveBeenCalled();

    // n-1000 (most recent) should be in cache
    mockFigma.getNodeById.mockClear();
    const newest = getNode('n-1000');
    expect((newest as Record<string, unknown>)['id']).toBe('n-1000');
    expect(mockFigma.getNodeById).not.toHaveBeenCalled();
  });
});
