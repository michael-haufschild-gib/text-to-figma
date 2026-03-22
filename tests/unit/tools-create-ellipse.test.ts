/**
 * create_ellipse Tool Tests
 *
 * Tests execute function behavior: circle vs oval detection, CSS generation,
 * node registry integration, and bridge error propagation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, resetConfig } from '../../mcp-server/src/config.js';
import { resetNodeRegistry, getNodeRegistry } from '../../mcp-server/src/node-registry.js';

// Mock the figma bridge
vi.mock('../../mcp-server/src/figma-bridge.js', () => {
  const mockBridge = {
    isConnected: vi.fn(() => true),
    sendToFigma: vi.fn(),
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

const { createEllipse } = await import('../../mcp-server/src/tools/create_ellipse.js');
type CreateEllipseInput = import('../../mcp-server/src/tools/create_ellipse.js').CreateEllipseInput;
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigmaValidated: ReturnType<typeof vi.fn>;
  };
};

describe('createEllipse', () => {
  beforeEach(() => {
    loadConfig();
    resetNodeRegistry();
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true,
      nodeId: '3:20'
    });
  });

  afterEach(() => {
    resetConfig();
    vi.restoreAllMocks();
  });

  it('detects a perfect circle when width equals height', async () => {
    const result = await createEllipse({
      width: 48,
      height: 48,
      name: 'Avatar'
    });

    expect(result.isCircle).toBe(true);
    expect(result.ellipseId).toBe('3:20');
    expect(result.width).toBe(48);
    expect(result.height).toBe(48);
    expect(result.message).toContain('circle');
    expect(result.cssEquivalent).toContain('border-radius: 50%');
    expect(result.cssEquivalent).toContain('a circle');
  });

  it('detects an oval when width differs from height', async () => {
    const result = await createEllipse({
      width: 120,
      height: 80,
      name: 'Oval Background'
    });

    expect(result.isCircle).toBe(false);
    expect(result.width).toBe(120);
    expect(result.height).toBe(80);
    expect(result.message).toContain('ellipse');
    expect(result.cssEquivalent).toContain('an ellipse');
  });

  it('includes fill and stroke in CSS when both stroke properties are provided', async () => {
    const result = await createEllipse({
      width: 60,
      height: 60,
      name: 'Styled Circle',
      fillColor: '#0066FF',
      strokeColor: '#003399',
      strokeWeight: 2
    });

    expect(result.cssEquivalent).toContain('background-color: #0066FF');
    expect(result.cssEquivalent).toContain('border: 2px solid #003399');
  });

  it('omits stroke CSS when only strokeColor is provided without strokeWeight', async () => {
    const result = await createEllipse({
      width: 60,
      height: 60,
      name: 'No Stroke Weight',
      strokeColor: '#003399'
    });

    expect(result.cssEquivalent).not.toContain('border:');
  });

  it('registers node in NodeRegistry with correct type and bounds', async () => {
    await createEllipse({
      width: 100,
      height: 50,
      name: 'Tracked Ellipse',
      parentId: 'frame-42'
    });

    const registry = getNodeRegistry();
    const node = registry.getNode('3:20');
    expect(node?.type).toBe('ELLIPSE');
    expect(node?.name).toBe('Tracked Ellipse');
    expect(node?.parentId).toBe('frame-42');
    expect(node?.bounds).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });

  it('registers as root node when no parentId provided', async () => {
    await createEllipse({
      width: 40,
      height: 40,
      name: 'Root Ellipse'
    });

    const registry = getNodeRegistry();
    const node = registry.getNode('3:20');
    expect(node?.parentId).toBeNull();
  });

  it('sends correct payload to bridge', async () => {
    await createEllipse({
      width: 80,
      height: 60,
      name: 'Test Ellipse',
      parentId: 'parent-5',
      fillColor: '#FF0000',
      strokeColor: '#000000',
      strokeWeight: 1
    });

    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledWith(
      'create_ellipse',
      expect.objectContaining({
        width: 80,
        height: 60,
        name: 'Test Ellipse',
        parentId: 'parent-5',
        fillColor: '#FF0000',
        strokeColor: '#000000',
        strokeWeight: 1
      }),
      expect.anything() // Zod response schema
    );
  });

  it('handles missing nodeId in response gracefully', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      success: true
      // nodeId not present
    });

    const result = await createEllipse({
      width: 40,
      height: 40,
      name: 'No ID'
    });

    // Returns empty string when nodeId is missing
    expect(result.ellipseId).toBe('');
    // Should not register in registry (guarded by if response.nodeId)
    const registry = getNodeRegistry();
    expect(registry.getNode('')).toBeNull();
  });

  it('handles name with special characters in CSS class generation', async () => {
    const result = await createEllipse({
      width: 48,
      height: 48,
      name: 'Icon / Avatar (Large)'
    });

    // CSS class name derived from name should not break CSS syntax
    expect(result.cssEquivalent).toContain('border-radius: 50%');
    // The name is lowercased and spaces replaced with hyphens
    expect(result.cssEquivalent).toContain('.icon-/-avatar-(large)');
  });

  it('crashes when name is undefined (not routed through schema parse)', async () => {
    // BUG EXPOSURE: createEllipse relies on Zod's .default('Ellipse') to provide
    // a name, but the execute function receives the raw input. If called directly
    // without schema.parse(), name can be undefined causing a TypeError on
    // `.toLowerCase()`. This is safe in production because the router always
    // does schema.parse() first, but it's a latent fragility.
    await expect(createEllipse({ width: 100, height: 100 } as CreateEllipseInput)).rejects.toThrow(
      TypeError
    );
  });

  it('propagates bridge errors without wrapping', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Connection timeout'));

    await expect(createEllipse({ width: 40, height: 40, name: 'Fail' })).rejects.toThrow(
      'Connection timeout'
    );
  });
});
