/**
 * detach_component Tool Tests
 *
 * Tests execute function behavior: bridge call, Zod response validation,
 * node registry cleanup, and error propagation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, resetConfig } from '../../mcp-server/src/config.js';
import { resetNodeRegistry, getNodeRegistry } from '../../mcp-server/src/node-registry.js';

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
    FigmaAckResponseSchema: { parse: (v: unknown) => v },
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

const { detachComponent, DetachComponentInputSchema } =
  await import('../../mcp-server/src/tools/detach_component.js');
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

describe('DetachComponentInputSchema', () => {
  it('accepts valid nodeId', () => {
    expect(DetachComponentInputSchema.safeParse({ nodeId: '2052:3953' }).success).toBe(true);
  });

  it('rejects empty nodeId', () => {
    expect(DetachComponentInputSchema.safeParse({ nodeId: '' }).success).toBe(false);
  });

  it('rejects missing nodeId', () => {
    expect(DetachComponentInputSchema.safeParse({}).success).toBe(false);
  });
});

describe('detachComponent', () => {
  it('detaches a single component and cleans up registry', async () => {
    const registry = getNodeRegistry();
    registry.register('comp-1', {
      type: 'COMPONENT',
      name: 'Button',
      parentId: null,
      children: []
    });

    __mockBridge.sendToFigmaValidated.mockResolvedValueOnce({
      type: 'COMPONENT',
      frameId: 'frame-1',
      detached: [{ oldId: 'comp-1', newId: 'frame-1', name: 'Button' }],
      message: 'Detached 1 component'
    });

    const result = await detachComponent({ nodeId: 'comp-1' });

    expect(result.type).toBe('COMPONENT');
    expect(result.frameId).toBe('frame-1');
    expect(result.detached).toHaveLength(1);
    expect(result.detached[0].oldId).toBe('comp-1');
    expect(result.message).toBe('Detached 1 component');

    // Old component should be removed from registry
    expect(registry.has('comp-1')).toBe(false);
  });

  it('detaches a component set with multiple variants', async () => {
    const registry = getNodeRegistry();
    registry.register('set-1', {
      type: 'COMPONENT_SET',
      name: 'ButtonSet',
      parentId: null,
      children: ['var-1', 'var-2']
    });
    registry.register('var-1', {
      type: 'COMPONENT',
      name: 'Default',
      parentId: 'set-1',
      children: []
    });
    registry.register('var-2', {
      type: 'COMPONENT',
      name: 'Hover',
      parentId: 'set-1',
      children: []
    });

    __mockBridge.sendToFigmaValidated.mockResolvedValueOnce({
      type: 'COMPONENT_SET',
      frameId: 'frame-set',
      detached: [
        { oldId: 'var-1', newId: 'frame-v1', name: 'Default' },
        { oldId: 'var-2', newId: 'frame-v2', name: 'Hover' }
      ],
      message: 'Detached 2 variants'
    });

    const result = await detachComponent({ nodeId: 'set-1' });

    expect(result.detached).toHaveLength(2);
    // Old variant IDs removed from registry
    expect(registry.has('var-1')).toBe(false);
    expect(registry.has('var-2')).toBe(false);
    // Component set ID removed
    expect(registry.has('set-1')).toBe(false);
  });

  it('detaches an instance from its source component', async () => {
    const registry = getNodeRegistry();
    registry.register('inst-1', {
      type: 'INSTANCE',
      name: 'Button Instance',
      parentId: 'frame-parent',
      children: []
    });

    __mockBridge.sendToFigmaValidated.mockResolvedValueOnce({
      type: 'INSTANCE',
      detached: [{ oldId: 'inst-1', newId: 'frame-detached', name: 'Button Instance' }],
      message: 'Detached instance "Button Instance" from its component'
    });

    const result = await detachComponent({ nodeId: 'inst-1' });

    expect(result.type).toBe('INSTANCE');
    expect(result.detached).toHaveLength(1);
    expect(result.detached[0].newId).toBe('frame-detached');
    expect(registry.has('inst-1')).toBe(false);
  });

  it('handles response without frameId (no component set)', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValueOnce({
      type: 'COMPONENT',
      detached: [{ oldId: 'comp-1', newId: 'frame-1', name: 'Button' }],
      message: 'Detached'
    });

    const result = await detachComponent({ nodeId: 'comp-1' });
    expect(result.frameId).toBeUndefined();
  });

  it('propagates bridge errors', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValueOnce(new Error('Node is not a component'));

    await expect(detachComponent({ nodeId: 'text-1' })).rejects.toThrow('Node is not a component');
  });
});
