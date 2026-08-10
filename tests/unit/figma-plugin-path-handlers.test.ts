/**
 * Figma Plugin Path Handlers — Unit Tests
 *
 * Exercises the real plugin handler code with a small Figma API mock. The MCP
 * e2e tests use a simulated plugin, so these tests catch bugs in the actual
 * `figma-plugin/src/handlers/path.ts` implementation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface MockVectorNode {
  id: string;
  type: 'VECTOR';
  name: string;
  x: number;
  y: number;
  vectorPaths: Array<{ windingRule: string; data: string }>;
  fills: unknown[];
  strokes: unknown[];
  strokeWeight: number;
  parent: MockParentNode | null;
}

interface MockParentNode {
  id: string;
  type: 'PAGE' | 'FRAME';
  appendChild: ReturnType<typeof vi.fn>;
}

interface MockFigmaApi {
  createVector: ReturnType<typeof vi.fn>;
  getNodeById: ReturnType<typeof vi.fn>;
  currentPage: MockParentNode;
  viewport: { scrollAndZoomIntoView: ReturnType<typeof vi.fn> };
}

let mockFigma: MockFigmaApi;
let createdVectors: MockVectorNode[];
let vectorSequence: number;

const { resetNodeCache } = await import('../../figma-plugin/src/helpers.js');
const { handleCreatePath, handleEditPath, handleBatchCreatePath } =
  await import('../../figma-plugin/src/handlers/path.js');

function createMockVector(): MockVectorNode {
  const vector: MockVectorNode = {
    id: `vector-${++vectorSequence}`,
    type: 'VECTOR',
    name: '',
    x: 0,
    y: 0,
    vectorPaths: [],
    fills: [],
    strokes: [],
    strokeWeight: 0,
    parent: null
  };
  createdVectors.push(vector);
  return vector;
}

beforeEach(() => {
  createdVectors = [];
  vectorSequence = 0;
  const currentPage: MockParentNode = {
    id: 'page-1',
    type: 'PAGE',
    appendChild: vi.fn((node: MockVectorNode) => {
      node.parent = currentPage;
    })
  };
  mockFigma = {
    createVector: vi.fn(createMockVector),
    getNodeById: vi.fn((id: string) => createdVectors.find((node) => node.id === id) ?? null),
    currentPage,
    viewport: { scrollAndZoomIntoView: vi.fn() }
  };
  (globalThis as Record<string, unknown>)['figma'] = mockFigma;
  resetNodeCache();
});

afterEach(() => {
  resetNodeCache();
  delete (globalThis as Record<string, unknown>)['figma'];
});

describe('handleCreatePath', () => {
  it('creates, appends, caches, and scrolls to a vector from SVG path input', () => {
    const result = handleCreatePath({
      name: 'Triangle',
      x: 10,
      y: 20,
      svgPath: '  M 0 0 L 10 10  ',
      closed: true,
      fillColor: '#FF0000',
      strokeColor: '#000000',
      strokeWeight: 2
    });

    expect(result.pathId).toBe('vector-1');
    expect(createdVectors[0]).toMatchObject({
      id: 'vector-1',
      name: 'Triangle',
      x: 10,
      y: 20,
      vectorPaths: [{ windingRule: 'NONZERO', data: 'M 0 0 L 10 10 Z' }],
      strokeWeight: 2
    });
    expect(mockFigma.currentPage.appendChild).toHaveBeenCalledWith(createdVectors[0]);
    expect(mockFigma.viewport.scrollAndZoomIntoView).toHaveBeenCalledWith([createdVectors[0]]);

    const editResult = handleEditPath({ nodeId: 'vector-1', svgPath: 'M 1 1 L 2 2' });
    expect(editResult.nodeId).toBe('vector-1');
  });

  it('rejects command arrays that do not start with a move command', () => {
    expect(() =>
      handleCreatePath({
        commands: [
          { type: 'L', x: 0, y: 0 },
          { type: 'L', x: 10, y: 10 }
        ]
      })
    ).toThrow('Path must start with M');
  });
});

describe('handleEditPath', () => {
  it('updates an existing vector path and applies the requested winding rule', () => {
    handleCreatePath({ name: 'Editable', svgPath: 'M 0 0 L 1 1' });

    const result = handleEditPath({
      nodeId: 'vector-1',
      commands: [
        { type: 'M', x: 0, y: 0 },
        { type: 'L', x: 20, y: 20 }
      ],
      closed: true,
      windingRule: 'EVENODD'
    });

    expect(result.nodeId).toBe('vector-1');
    expect(createdVectors[0].vectorPaths[0].windingRule).toBe('EVENODD');
    expect(createdVectors[0].vectorPaths[0].data.replace(/\s+/g, ' ').trim()).toBe(
      'M 0 0 L 20 20 Z'
    );
  });

  it('rejects edits for non-vector nodes', () => {
    mockFigma.getNodeById.mockReturnValueOnce({
      id: 'frame-1',
      type: 'FRAME',
      name: 'Frame'
    });

    expect(() => handleEditPath({ nodeId: 'frame-1', svgPath: 'M 0 0 L 1 1' })).toThrow(
      'expected VECTOR'
    );
  });
});

describe('handleBatchCreatePath', () => {
  it('creates valid paths, reports per-item failures, and scrolls to the last success', () => {
    const result = handleBatchCreatePath({
      paths: [
        { name: 'Body', svgPath: 'M 0 0 L 10 10' },
        { name: 'Broken', commands: [{ type: 'L', x: 0, y: 0 }] },
        { name: 'Tail', svgPath: 'M 10 10 L 20 20' }
      ]
    }) as {
      results: Array<{ index: number; pathId?: string; name: string; error?: string }>;
      message: string;
    };

    expect(result.message).toBe('Batch created 2 path(s), 1 failed');
    expect(result.results).toEqual([
      { index: 0, pathId: 'vector-1', name: 'Body' },
      {
        index: 1,
        name: 'Broken',
        error: 'Path must start with M (Move) command'
      },
      { index: 2, pathId: 'vector-3', name: 'Tail' }
    ]);
    expect(mockFigma.viewport.scrollAndZoomIntoView).toHaveBeenCalledWith([createdVectors[2]]);
  });
});
