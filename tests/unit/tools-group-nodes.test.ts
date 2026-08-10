/**
 * group_nodes Tool Tests
 *
 * Verifies the MCP contract for grouping nodes: schema validation, bridge
 * payload shape, response validation, and node registry side effects.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getNodeRegistry, resetNodeRegistry } from '../../mcp-server/src/node-registry.js';

vi.mock('../../mcp-server/src/figma-bridge.js', () => {
  const mockBridge = {
    sendToFigmaValidated: vi.fn()
  };

  return {
    getFigmaBridge: () => mockBridge,
    __mockBridge: mockBridge
  };
});

const { groupNodes, GroupNodesInputSchema } =
  await import('../../mcp-server/src/tools/group_nodes.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigmaValidated: ReturnType<typeof vi.fn>;
  };
};

describe('GroupNodesInputSchema', () => {
  it('requires at least one non-empty nodeId', () => {
    expect(GroupNodesInputSchema.safeParse({ nodeIds: [] }).success).toBe(false);
    expect(GroupNodesInputSchema.safeParse({ nodeIds: [''] }).success).toBe(false);
    expect(GroupNodesInputSchema.safeParse({ nodeIds: ['node-1'] }).success).toBe(true);
  });
});

describe('groupNodes', () => {
  beforeEach(() => {
    resetNodeRegistry();
    __mockBridge.sendToFigmaValidated.mockReset();
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      groupId: 'group-1',
      nodeCount: 2
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends all child node IDs and explicit parent to the Figma bridge', async () => {
    await groupNodes({
      nodeIds: ['icon-1', 'label-1'],
      name: 'Nav Item',
      parentId: 'nav-frame'
    });

    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledWith(
      'group_nodes',
      {
        nodeIds: ['icon-1', 'label-1'],
        name: 'Nav Item',
        parentId: 'nav-frame'
      },
      expect.anything()
    );
  });

  it('registers the returned group with its children and parent', async () => {
    const result = await groupNodes({
      nodeIds: ['icon-1', 'label-1'],
      name: 'Nav Item',
      parentId: 'nav-frame'
    });

    expect(result).toMatchObject({
      groupId: 'group-1',
      name: 'Nav Item',
      nodeCount: 2
    });
    expect(getNodeRegistry().getNode('group-1')).toMatchObject({
      nodeId: 'group-1',
      type: 'GROUP',
      name: 'Nav Item',
      parentId: 'nav-frame',
      children: ['icon-1', 'label-1']
    });
  });

  it('defaults the group name and records a root-level parent when parentId is omitted', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      groupId: 'group-root',
      nodeCount: 1
    });

    const result = await groupNodes({ nodeIds: ['shape-1'] });

    expect(result.name).toBe('Group');
    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledWith(
      'group_nodes',
      {
        nodeIds: ['shape-1'],
        name: 'Group',
        parentId: undefined
      },
      expect.anything()
    );
    expect(getNodeRegistry().getNode('group-root')?.parentId).toBeNull();
  });

  it('uses a response schema that rejects plugin responses without groupId', async () => {
    await groupNodes({ nodeIds: ['shape-1'], name: 'Shape Group' });

    const responseSchema = __mockBridge.sendToFigmaValidated.mock.calls[0][2] as {
      safeParse: (value: unknown) => { success: boolean };
    };
    expect(responseSchema.safeParse({ groupId: 'group-1', nodeCount: 1 }).success).toBe(true);
    expect(responseSchema.safeParse({ nodeId: 'legacy-group', nodeCount: 1 }).success).toBe(false);
  });

  it('propagates bridge failures without mutating the registry', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Cannot group locked node'));

    await expect(groupNodes({ nodeIds: ['locked-1'], name: 'Locked' })).rejects.toThrow(
      'Cannot group locked node'
    );
    expect(getNodeRegistry().getAllNodes()).toEqual([]);
  });
});
