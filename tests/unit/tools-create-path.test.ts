/**
 * create_path Tool Tests
 *
 * Tests execute function behavior: path command repair integration,
 * bridge communication, error handling for invalid commands and
 * empty pathId responses.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, resetConfig } from '../../mcp-server/src/config.js';

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

const { createPath } = await import('../../mcp-server/src/tools/create_path.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigmaWithRetry: ReturnType<typeof vi.fn>;
    sendToFigmaValidated: ReturnType<typeof vi.fn>;
  };
};

describe('createPath', () => {
  beforeEach(() => {
    loadConfig();
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      pathId: '7:60',
      message: 'Path created'
    });
  });

  afterEach(() => {
    resetConfig();
    vi.restoreAllMocks();
  });

  it('creates a path with valid line commands', async () => {
    const result = await createPath({
      name: 'Triangle',
      commands: [
        { type: 'M', x: 0, y: 0 },
        { type: 'L', x: 100, y: 0 },
        { type: 'L', x: 50, y: 100 },
        { type: 'Z' }
      ],
      fillColor: '#FF0000'
    });

    expect(result.pathId).toBe('7:60');
    expect(result.name).toBe('Triangle');
    expect(result.commandCount).toBe(4);
    expect(result.closed).toBe(false); // closed prop default is false
    expect(result.message).toContain('Triangle');
    expect(result.message).toContain('4 commands');
  });

  it('creates a closed path when closed flag is true', async () => {
    const result = await createPath({
      name: 'Closed Shape',
      commands: [
        { type: 'M', x: 0, y: 0 },
        { type: 'L', x: 100, y: 100 }
      ],
      closed: true
    });

    expect(result.closed).toBe(true);
    expect(result.message).toContain('(closed)');
  });

  it('creates a path with cubic bezier commands', async () => {
    const result = await createPath({
      name: 'Curve',
      commands: [
        { type: 'M', x: 0, y: 0 },
        { type: 'C', x1: 50, y1: -50, x2: 100, y2: -50, x: 150, y: 0 }
      ],
      strokeColor: '#000000',
      strokeWeight: 2
    });

    expect(result.pathId).toBe('7:60');
    expect(result.commandCount).toBe(2);
  });

  it('uses default name "Path" when name is not provided', async () => {
    const result = await createPath({
      commands: [
        { type: 'M', x: 0, y: 0 },
        { type: 'L', x: 50, y: 50 }
      ]
    });

    expect(result.name).toBe('Path');
    expect(result.message).toContain('"Path"');
  });

  it('sends correct payload to bridge', async () => {
    await createPath({
      name: 'Custom Path',
      commands: [
        { type: 'M', x: 10, y: 20 },
        { type: 'L', x: 100, y: 200 }
      ],
      fillColor: '#0066FF',
      strokeColor: '#003399',
      strokeWeight: 3,
      closed: true,
      parentId: 'frame-15'
    });

    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledWith(
      'create_path',
      expect.objectContaining({
        name: 'Custom Path',
        fillColor: '#0066FF',
        strokeColor: '#003399',
        strokeWeight: 3,
        closed: true,
        parentId: 'frame-15'
      }),
      expect.anything()
    );

    // Verify commands are passed through (after repair normalization)
    const callArgs = __mockBridge.sendToFigmaValidated.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    expect(callArgs.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'M', x: 10, y: 20 }),
        expect.objectContaining({ type: 'L', x: 100, y: 200 })
      ])
    );
  });

  it('throws when bridge returns empty pathId', async () => {
    __mockBridge.sendToFigmaValidated.mockResolvedValue({
      pathId: '',
      message: 'Failed'
    });

    await expect(
      createPath({
        commands: [
          { type: 'M', x: 0, y: 0 },
          { type: 'L', x: 50, y: 50 }
        ]
      })
    ).rejects.toThrow('No pathId returned');
  });

  it('throws on invalid path commands (missing required coordinates)', async () => {
    await expect(
      createPath({
        commands: [
          { type: 'M', x: 0, y: 0 },
          { type: 'L' } // missing x and y
        ] as never[]
      })
    ).rejects.toThrow();
  });

  it('propagates bridge errors without wrapping', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('Figma plugin disconnected'));

    await expect(
      createPath({
        commands: [
          { type: 'M', x: 0, y: 0 },
          { type: 'L', x: 100, y: 100 }
        ]
      })
    ).rejects.toThrow('Figma plugin disconnected');
  });
});
