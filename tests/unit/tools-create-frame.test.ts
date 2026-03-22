/**
 * create_frame Tool Tests
 *
 * Tests schema validation, execute function behavior including error wrapping,
 * node registry integration, and HTML/CSS analogy generation.
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

// Mock parent validator to bypass Figma connection requirement
vi.mock('../../mcp-server/src/utils/parent-validator.js', () => ({
  validateParentRelationship: vi.fn().mockResolvedValue({ isValid: true }),
  validateParentId: vi.fn().mockReturnValue({ isValid: true }),
  formatValidationError: vi.fn().mockReturnValue('mock validation error')
}));

const { CreateFrameInputSchema, createFrame } =
  await import('../../mcp-server/src/tools/create_frame.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigmaWithRetry: ReturnType<typeof vi.fn>;
    sendToFigmaValidated: ReturnType<typeof vi.fn>;
  };
};

describe('CreateFrameInputSchema', () => {
  it('accepts minimal input with name only', () => {
    const result = CreateFrameInputSchema.safeParse({ name: 'Test Frame' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.layoutMode).toBe('VERTICAL'); // default
      expect(result.data.itemSpacing).toBe(16); // default
      expect(result.data.padding).toBe(16); // default
    }
  });

  it('accepts full input', () => {
    const result = CreateFrameInputSchema.safeParse({
      name: 'Full Frame',
      width: 400,
      height: 300,
      layoutMode: 'HORIZONTAL',
      itemSpacing: 24,
      padding: 32,
      parentId: 'parent-123',
      horizontalSizing: 'FILL',
      verticalSizing: 'HUG'
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = CreateFrameInputSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const result = CreateFrameInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-grid spacing values', () => {
    const result = CreateFrameInputSchema.safeParse({
      name: 'Test',
      itemSpacing: 15 // not on 8pt grid
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid layout mode', () => {
    const result = CreateFrameInputSchema.safeParse({
      name: 'Test',
      layoutMode: 'DIAGONAL'
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative width', () => {
    const result = CreateFrameInputSchema.safeParse({
      name: 'Test',
      width: -100
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero width', () => {
    const result = CreateFrameInputSchema.safeParse({
      name: 'Test',
      width: 0
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid spacing values', () => {
    const validValues = [0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128];
    for (const val of validValues) {
      const result = CreateFrameInputSchema.safeParse({
        name: 'Test',
        itemSpacing: val,
        padding: val
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('createFrame', () => {
  beforeEach(() => {
    loadConfig();
    resetNodeRegistry();
    __mockBridge.sendToFigmaValidated.mockResolvedValue({ nodeId: '1:42' });
  });

  afterEach(() => {
    resetConfig();
    vi.restoreAllMocks();
  });

  it('returns frameId and HTML/CSS analogies on success', async () => {
    const result = await createFrame({
      name: 'TestFrame',
      layoutMode: 'VERTICAL',
      itemSpacing: 16,
      padding: 16
    });

    expect(result.frameId).toBe('1:42');
    expect(result.htmlAnalogy).toContain('TestFrame');
    expect(result.cssEquivalent).toContain('flex-direction: column');
    expect(result.cssEquivalent).toContain('gap: 16px');
  });

  it('generates correct CSS for HORIZONTAL layout', async () => {
    const result = await createFrame({
      name: 'HorzFrame',
      layoutMode: 'HORIZONTAL',
      itemSpacing: 24,
      padding: 32
    });

    expect(result.cssEquivalent).toContain('flex-direction: row');
    expect(result.cssEquivalent).toContain('gap: 24px');
    expect(result.cssEquivalent).toContain('padding: 32px');
  });

  it('generates correct CSS for NONE layout', async () => {
    const result = await createFrame({
      name: 'NoLayout',
      layoutMode: 'NONE',
      itemSpacing: 0,
      padding: 0
    });

    expect(result.cssEquivalent).toContain('position: relative');
    expect(result.cssEquivalent).not.toContain('display: flex');
  });

  it('includes width/height in CSS when provided', async () => {
    const result = await createFrame({
      name: 'Sized',
      width: 400,
      height: 300,
      layoutMode: 'VERTICAL',
      itemSpacing: 16,
      padding: 16
    });

    expect(result.cssEquivalent).toContain('width: 400px');
    expect(result.cssEquivalent).toContain('height: 300px');
  });

  it('registers node in NodeRegistry', async () => {
    await createFrame({
      name: 'Registered',
      layoutMode: 'VERTICAL',
      itemSpacing: 16,
      padding: 16
    });

    const registry = getNodeRegistry();
    const node = registry.getNode('1:42');
    expect(node?.type).toBe('FRAME');
    expect(node?.name).toBe('Registered');
    expect(node?.parentId).toBeNull();
  });

  it('registers node with parentId when provided', async () => {
    await createFrame({
      name: 'Child',
      layoutMode: 'VERTICAL',
      itemSpacing: 16,
      padding: 16,
      parentId: 'parent-1'
    });

    const registry = getNodeRegistry();
    const node = registry.getNode('1:42');
    expect(node!.parentId).toBe('parent-1');
  });

  it('wraps FigmaBridgeError with CONN_ code as NetworkError', async () => {
    const {
      FigmaBridgeError: RealBridgeError,
      createError,
      ErrorCode
    } = await import('../../mcp-server/src/errors/index.js');
    __mockBridge.sendToFigmaValidated.mockRejectedValue(
      new RealBridgeError(
        createError(ErrorCode.CONN_NOT_CONNECTED, 'Not connected to Figma plugin')
      )
    );

    await expect(
      createFrame({
        name: 'Fail',
        layoutMode: 'VERTICAL',
        itemSpacing: 16,
        padding: 16
      })
    ).rejects.toThrow('Failed to communicate with Figma');
  });

  it('wraps non-bridge errors as FigmaAPIError', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Internal Figma error'));

    await expect(
      createFrame({
        name: 'Fail',
        layoutMode: 'VERTICAL',
        itemSpacing: 16,
        padding: 16
      })
    ).rejects.toThrow('Figma frame creation failed');
  });

  it('wraps Figma API errors containing "Connection" correctly as FigmaAPIError (not NetworkError)', async () => {
    // Previously a bug: broad string matching on 'Connection' misclassified
    // Figma API errors about node connections as NetworkError.
    // Now fixed: only FigmaBridgeError with CONN_* codes are NetworkErrors.
    __mockBridge.sendToFigmaValidated.mockRejectedValue(
      new Error('Connection between nodes is not supported for this type')
    );

    await expect(
      createFrame({
        name: 'FixedBug',
        layoutMode: 'VERTICAL',
        itemSpacing: 16,
        padding: 16
      })
    ).rejects.toThrow('Figma frame creation failed');
  });

  it('wraps non-Error thrown values via wrapError', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue('string error value');

    await expect(
      createFrame({
        name: 'NonError',
        layoutMode: 'VERTICAL',
        itemSpacing: 16,
        padding: 16
      })
    ).rejects.toThrow();
  });

  it('sends correct payload to bridge', async () => {
    await createFrame({
      name: 'PayloadTest',
      width: 200,
      height: 100,
      layoutMode: 'HORIZONTAL',
      itemSpacing: 8,
      padding: 24,
      horizontalSizing: 'FILL',
      verticalSizing: 'HUG'
    });

    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledWith(
      'create_frame',
      expect.objectContaining({
        name: 'PayloadTest',
        width: 200,
        height: 100,
        layoutMode: 'HORIZONTAL',
        itemSpacing: 8,
        padding: 24,
        horizontalSizing: 'FILL',
        verticalSizing: 'HUG'
      }),
      expect.any(Object)
    );
  });
});
