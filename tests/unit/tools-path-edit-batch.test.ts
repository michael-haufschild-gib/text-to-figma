/**
 * edit_path and batch_create_path Tool Tests
 *
 * Covers path-editing and multi-path creation contracts that are easy to miss
 * in create_path-only tests: input mode validation, bridge payload
 * normalization, partial batch failures, and registry side effects.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getNodeRegistry, resetNodeRegistry } from '../../mcp-server/src/node-registry.js';

vi.mock('../../mcp-server/src/figma-bridge.js', () => {
  const mockBridge = {
    sendToFigmaValidated: vi.fn()
  };

  return {
    FigmaAckResponseSchema: { parse: (value: unknown) => value },
    getFigmaBridge: () => mockBridge,
    __mockBridge: mockBridge
  };
});

const { editPath, EditPathInputSchema } = await import('../../mcp-server/src/tools/edit_path.js');
const { batchCreatePath, BatchCreatePathInputSchema } =
  await import('../../mcp-server/src/tools/batch_create_path.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigmaValidated: ReturnType<typeof vi.fn>;
  };
};

describe('EditPathInputSchema', () => {
  it('requires a nodeId and exactly one non-empty path source mode', () => {
    expect(EditPathInputSchema.safeParse({ svgPath: 'M 0 0 L 1 1' }).success).toBe(false);
    expect(EditPathInputSchema.safeParse({ nodeId: 'vector-1' }).success).toBe(false);
    expect(EditPathInputSchema.safeParse({ nodeId: 'vector-1', svgPath: '   ' }).success).toBe(
      false
    );
    expect(
      EditPathInputSchema.safeParse({
        nodeId: 'vector-1',
        commands: [{ type: 'M', x: 0, y: 0 }]
      }).success
    ).toBe(false);
    expect(
      EditPathInputSchema.safeParse({ nodeId: 'vector-1', svgPath: 'M 0 0 L 1 1' }).success
    ).toBe(true);
  });
});

describe('editPath', () => {
  beforeEach(() => {
    __mockBridge.sendToFigmaValidated.mockReset();
    __mockBridge.sendToFigmaValidated.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('trims svgPath input and sends only the SVG path mode to the bridge', async () => {
    const result = await editPath({
      nodeId: 'vector-1',
      svgPath: '  M 0 0 L 100 0 Z  ',
      windingRule: 'EVENODD'
    });

    expect(result.message).toContain('SVG path string');
    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledWith(
      'edit_path',
      {
        nodeId: 'vector-1',
        commands: undefined,
        svgPath: 'M 0 0 L 100 0 Z',
        closed: undefined,
        windingRule: 'EVENODD'
      },
      expect.anything()
    );
  });

  it('normalizes command-array input before sending it to the bridge', async () => {
    await editPath({
      nodeId: 'vector-2',
      commands: [{ type: 'M', x: 0, y: 0 }, { type: 'L', x: 100, y: 0 }, { type: 'Z' }],
      closed: true
    });

    const payload = __mockBridge.sendToFigmaValidated.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.svgPath).toBeUndefined();
    expect(payload.closed).toBe(true);
    expect(payload.commands).toEqual([
      { type: 'M', x: 0, y: 0 },
      { type: 'L', x: 100, y: 0 },
      { type: 'Z' }
    ]);
  });

  it('rejects malformed commands before sending anything to the bridge', async () => {
    await expect(
      editPath({
        nodeId: 'vector-bad',
        commands: [{ type: 'M', x: 0, y: 0 }, { type: 'L' }] as never[]
      })
    ).rejects.toThrow('Path command validation failed');

    expect(__mockBridge.sendToFigmaValidated).not.toHaveBeenCalled();
  });
});

describe('BatchCreatePathInputSchema', () => {
  const validPath = { svgPath: 'M 0 0 L 1 1' };

  it('requires between 1 and 200 valid path items', () => {
    expect(BatchCreatePathInputSchema.safeParse({ paths: [] }).success).toBe(false);
    expect(BatchCreatePathInputSchema.safeParse({ paths: [validPath] }).success).toBe(true);
    expect(
      BatchCreatePathInputSchema.safeParse({ paths: Array.from({ length: 201 }, () => validPath) })
        .success
    ).toBe(false);
  });

  it('rejects batch items without a valid path source', () => {
    expect(BatchCreatePathInputSchema.safeParse({ paths: [{ name: 'Empty' }] }).success).toBe(
      false
    );
    expect(BatchCreatePathInputSchema.safeParse({ paths: [{ svgPath: '   ' }] }).success).toBe(
      false
    );
  });
});

describe('batchCreatePath', () => {
  beforeEach(() => {
    resetNodeRegistry();
    __mockBridge.sendToFigmaValidated.mockReset();
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      results: [
        { index: 0, pathId: 'path-1', name: 'Body' },
        { index: 1, pathId: 'path-2', name: 'Tail' },
        { index: 2, name: 'Broken', error: 'Invalid path' }
      ]
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes mixed SVG and command paths into one bridge call', async () => {
    const result = await batchCreatePath({
      parentId: 'animal-frame',
      paths: [
        { name: 'Body', svgPath: '  M 0 0 L 100 0 Z  ', fillColor: '#8B4513' },
        {
          name: 'Tail',
          commands: [
            { type: 'M', x: 100, y: 0 },
            { type: 'L', x: 130, y: 20 }
          ],
          strokeColor: '#000000',
          strokeWeight: 2,
          closed: true
        },
        { name: 'Broken', svgPath: 'M 0 0 L 1 1' }
      ]
    });

    expect(result.created).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.message).toContain('Batch created 2 path(s), 1 failed');
    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledOnce();

    const payload = __mockBridge.sendToFigmaValidated.mock.calls[0][1] as {
      parentId: string;
      paths: Array<Record<string, unknown>>;
    };
    expect(payload.parentId).toBe('animal-frame');
    expect(payload.paths[0]).toMatchObject({
      name: 'Body',
      svgPath: 'M 0 0 L 100 0 Z',
      fillColor: '#8B4513',
      closed: false
    });
    expect(payload.paths[1]).toMatchObject({
      name: 'Tail',
      commands: [
        { type: 'M', x: 100, y: 0 },
        { type: 'L', x: 130, y: 20 }
      ],
      strokeColor: '#000000',
      strokeWeight: 2,
      closed: true
    });
  });

  it('registers only successfully created path nodes from partial batch responses', async () => {
    await batchCreatePath({
      parentId: 'animal-frame',
      paths: [
        { name: 'Body', svgPath: 'M 0 0 L 100 0 Z' },
        { name: 'Tail', svgPath: 'M 0 0 L 20 20' },
        { name: 'Broken', svgPath: 'M 0 0 L 1 1' }
      ]
    });

    expect(getNodeRegistry().getNode('path-1')).toMatchObject({
      nodeId: 'path-1',
      type: 'VECTOR',
      name: 'Body',
      parentId: 'animal-frame'
    });
    expect(getNodeRegistry().getNode('path-2')).toMatchObject({
      nodeId: 'path-2',
      type: 'VECTOR',
      name: 'Tail',
      parentId: 'animal-frame'
    });
    expect(
      getNodeRegistry()
        .getAllNodes()
        .map((node) => node.nodeId)
    ).toEqual(['path-1', 'path-2']);
  });

  it('rejects empty SVG path items before sending the batch', async () => {
    await expect(
      batchCreatePath({
        paths: [{ name: 'Empty', svgPath: '   ' }]
      })
    ).rejects.toThrow('Path item 0: svgPath cannot be empty');

    expect(__mockBridge.sendToFigmaValidated).not.toHaveBeenCalled();
  });
});
