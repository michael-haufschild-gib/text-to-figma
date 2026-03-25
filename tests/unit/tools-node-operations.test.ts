/**
 * Node Operation Tool Tests — remove_node, rename_node, reparent_node
 *
 * Tests execute function behavior: bridge call, Zod response validation,
 * node registry updates, and error propagation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, resetConfig } from '../../mcp-server/src/config.js';
import { resetNodeRegistry, getNodeRegistry } from '../../mcp-server/src/node-registry.js';

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
    FigmaBridgeError: class extends Error {
      constructor(msg: string) {
        super(typeof msg === 'string' ? msg : 'bridge error');
        this.name = 'FigmaBridgeError';
      }
    },
    __mockBridge: mockBridge
  };
});

const { removeNode } = await import('../../mcp-server/src/tools/remove_node.js');
const { renameNode } = await import('../../mcp-server/src/tools/rename_node.js');
const { reparentNode } = await import('../../mcp-server/src/tools/reparent_node.js');
const { RemoveNodeInputSchema } = await import('../../mcp-server/src/tools/remove_node.js');
const { RenameNodeInputSchema } = await import('../../mcp-server/src/tools/rename_node.js');
const { ReparentNodeInputSchema } = await import('../../mcp-server/src/tools/reparent_node.js');

const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigmaValidated: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  loadConfig();
  resetNodeRegistry();
  vi.clearAllMocks();
});

afterEach(() => {
  resetConfig();
  resetNodeRegistry();
});

// ─── remove_node ─────────────────────────────────────────────────────────────

describe('RemoveNodeInputSchema', () => {
  it('accepts valid nodeId', () => {
    const result = RemoveNodeInputSchema.safeParse({ nodeId: '10:1' });
    expect(result.success).toBe(true);
  });

  it('rejects empty nodeId', () => {
    const result = RemoveNodeInputSchema.safeParse({ nodeId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing nodeId', () => {
    const result = RemoveNodeInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('removeNode', () => {
  it('removes node via bridge and returns result with metadata', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValueOnce({
      parentId: 'parent-1',
      name: 'OldRect',
      type: 'RECTANGLE'
    });

    const result = await removeNode({ nodeId: '10:5' });

    expect(result.nodeId).toBe('10:5');
    expect(result.parentId).toBe('parent-1');
    expect(result.name).toBe('OldRect');
    expect(result.type).toBe('RECTANGLE');
    expect(result.message).toBe('Node removed successfully');

    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledWith(
      'remove_node',
      { nodeId: '10:5' },
      expect.anything()
    );
  });

  it('removes node from registry after successful bridge call', async () => {
    const registry = getNodeRegistry();
    registry.register('10:5', {
      type: 'RECTANGLE',
      name: 'Rect',
      parentId: null,
      children: []
    });
    expect(registry.has('10:5')).toBe(true);

    __mockBridge.sendToFigmaValidated.mockResolvedValueOnce({});

    await removeNode({ nodeId: '10:5' });
    expect(registry.has('10:5')).toBe(false);
  });

  it('handles missing optional fields in response gracefully', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValueOnce({});

    const result = await removeNode({ nodeId: '10:5' });
    expect(result.parentId).toBeNull();
    expect(result.name).toBe('unknown');
    expect(result.type).toBe('unknown');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValueOnce(
      new Error('Node not found in document')
    );

    await expect(removeNode({ nodeId: 'nonexistent' })).rejects.toThrow(
      'Node not found in document'
    );
  });
});

// ─── rename_node ─────────────────────────────────────────────────────────────

describe('RenameNodeInputSchema', () => {
  it('accepts valid input', () => {
    const result = RenameNodeInputSchema.safeParse({ nodeId: '10:1', name: 'NewName' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = RenameNodeInputSchema.safeParse({ nodeId: '10:1', name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const result = RenameNodeInputSchema.safeParse({ nodeId: '10:1' });
    expect(result.success).toBe(false);
  });
});

describe('renameNode', () => {
  it('renames node via bridge and returns old + new name', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValueOnce({
      oldName: 'OriginalName'
    });

    const result = await renameNode({ nodeId: '10:1', name: 'Header' });

    expect(result.nodeId).toBe('10:1');
    expect(result.oldName).toBe('OriginalName');
    expect(result.name).toBe('Header');
    expect(result.message).toBe('Node renamed successfully');
  });

  it('updates node name in registry', async () => {
    const registry = getNodeRegistry();
    registry.register('10:1', {
      type: 'FRAME',
      name: 'OldName',
      parentId: null,
      children: []
    });

    __mockBridge.sendToFigmaValidated.mockResolvedValueOnce({ oldName: 'OldName' });

    await renameNode({ nodeId: '10:1', name: 'NewName' });

    const node = registry.getNode('10:1');
    expect(node?.name).toBe('NewName');
  });

  it('handles missing oldName in response', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValueOnce({});

    const result = await renameNode({ nodeId: '10:1', name: 'X' });
    expect(result.oldName).toBe('unknown');
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValueOnce(new Error('Connection lost'));

    await expect(renameNode({ nodeId: '10:1', name: 'X' })).rejects.toThrow('Connection lost');
  });
});

// ─── reparent_node ───────────────────────────────────────────────────────────

describe('ReparentNodeInputSchema', () => {
  it('accepts valid input', () => {
    const result = ReparentNodeInputSchema.safeParse({ nodeId: '10:1', parentId: '10:2' });
    expect(result.success).toBe(true);
  });

  it('rejects missing parentId', () => {
    const result = ReparentNodeInputSchema.safeParse({ nodeId: '10:1' });
    expect(result.success).toBe(false);
  });

  it('rejects empty nodeId', () => {
    const result = ReparentNodeInputSchema.safeParse({ nodeId: '', parentId: '10:2' });
    expect(result.success).toBe(false);
  });
});

describe('reparentNode', () => {
  it('reparents node via bridge and returns old + new parent', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValueOnce({
      oldParentId: 'parent-old',
      newParentId: '10:2'
    });

    const result = await reparentNode({ nodeId: '10:1', parentId: '10:2' });

    expect(result.nodeId).toBe('10:1');
    expect(result.oldParentId).toBe('parent-old');
    expect(result.newParentId).toBe('10:2');
    expect(result.message).toBe('Node reparented successfully');
  });

  it('updates parentId in registry', async () => {
    const registry = getNodeRegistry();
    registry.register('10:1', {
      type: 'TEXT',
      name: 'Label',
      parentId: 'old-parent',
      children: []
    });

    __mockBridge.sendToFigmaValidated.mockResolvedValueOnce({});

    await reparentNode({ nodeId: '10:1', parentId: 'new-parent' });

    const node = registry.getNode('10:1');
    expect(node?.parentId).toBe('new-parent');
  });

  it('handles missing oldParentId in response', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValueOnce({});

    const result = await reparentNode({ nodeId: '10:1', parentId: '10:2' });
    expect(result.oldParentId).toBeNull();
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValueOnce(new Error('Parent not found'));

    await expect(reparentNode({ nodeId: '10:1', parentId: 'bad' })).rejects.toThrow(
      'Parent not found'
    );
  });
});
