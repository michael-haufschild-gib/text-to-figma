/**
 * create_text Tool Tests
 *
 * Tests execute function behavior: parent validation, bridge communication,
 * node registry integration, CSS generation, and line height calculation.
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

// Mock parent validator
vi.mock('../../mcp-server/src/utils/parent-validator.js', () => ({
  validateParentRelationship: vi.fn().mockResolvedValue({ isValid: true }),
  validateParentId: vi.fn().mockReturnValue({ isValid: true }),
  formatValidationError: vi.fn().mockReturnValue('mock validation error'),
  getHierarchyPatternExamples: vi.fn().mockReturnValue('mock pattern examples')
}));

const { createText } = await import('../../mcp-server/src/tools/create_text.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    sendToFigmaValidated: ReturnType<typeof vi.fn>;
  };
};
const parentValidator = await import('../../mcp-server/src/utils/parent-validator.js');

describe('createText', () => {
  beforeEach(() => {
    loadConfig();
    resetNodeRegistry();
    __mockBridge.sendToFigmaValidated.mockResolvedValue({ nodeId: '2:10' });
    vi.mocked(parentValidator.validateParentRelationship).mockResolvedValue({ isValid: true });
    vi.mocked(parentValidator.formatValidationError).mockReturnValue('mock validation error');
    vi.mocked(parentValidator.getHierarchyPatternExamples).mockReturnValue('mock pattern examples');
  });

  afterEach(() => {
    resetConfig();
    vi.restoreAllMocks();
  });

  it('returns textId and auto-calculated line height for body text', async () => {
    const result = await createText({
      content: 'Hello World',
      fontSize: 16,
      fontFamily: 'Inter',
      fontWeight: 400,
      textAlign: 'LEFT',
      parentId: 'parent-1'
    });

    expect(result.textId).toBe('2:10');
    // fontSize 16 <= 20 → lineHeight = round(16 * 1.5) = 24
    expect(result.appliedLineHeight).toBe(24);
    expect(result.cssEquivalent).toContain('font-size: 16px');
    expect(result.cssEquivalent).toContain('font-family: Inter');
  });

  it('auto-calculates heading line height for large font sizes', async () => {
    const result = await createText({
      content: 'Heading',
      fontSize: 32,
      fontFamily: 'Inter',
      fontWeight: 700,
      textAlign: 'LEFT',
      parentId: 'parent-1'
    });

    // fontSize 32 > 20 → lineHeight = round(32 * 1.2) = 38
    expect(result.appliedLineHeight).toBe(38);
    expect(result.cssEquivalent).toContain('font-size: 32px');
    expect(result.cssEquivalent).toContain('bold (700)');
  });

  it('uses explicit line height when provided', async () => {
    const result = await createText({
      content: 'Custom',
      fontSize: 16,
      fontFamily: 'Inter',
      fontWeight: 400,
      lineHeight: 28,
      textAlign: 'LEFT',
      parentId: 'parent-1'
    });

    expect(result.appliedLineHeight).toBe(28);
    expect(result.cssEquivalent).toContain('line-height: 28px');
  });

  it('includes text-align in CSS when not LEFT', async () => {
    const result = await createText({
      content: 'Centered',
      fontSize: 16,
      fontFamily: 'Inter',
      fontWeight: 400,
      textAlign: 'CENTER',
      parentId: 'parent-1'
    });

    expect(result.cssEquivalent).toContain('text-align: center');
  });

  it('includes color and letter-spacing in CSS when provided', async () => {
    const result = await createText({
      content: 'Styled',
      fontSize: 16,
      fontFamily: 'Inter',
      fontWeight: 400,
      textAlign: 'LEFT',
      color: '#FF0000',
      letterSpacing: 2,
      parentId: 'parent-1'
    });

    expect(result.cssEquivalent).toContain('color: #FF0000');
    expect(result.cssEquivalent).toContain('letter-spacing: 2px');
  });

  it('registers node in NodeRegistry with truncated name', async () => {
    const longContent = 'A'.repeat(100);

    await createText({
      content: longContent,
      fontSize: 16,
      fontFamily: 'Inter',
      fontWeight: 400,
      textAlign: 'LEFT',
      parentId: 'parent-1'
    });

    const registry = getNodeRegistry();
    const node = registry.getNode('2:10');
    expect(node?.type).toBe('TEXT');
    expect(node?.name).toBe('A'.repeat(50));
    expect(node?.parentId).toBe('parent-1');
  });

  it('sends correct payload to bridge', async () => {
    await createText({
      content: 'Test',
      fontSize: 24,
      fontFamily: 'Roboto',
      fontWeight: 600,
      textAlign: 'RIGHT',
      color: '#333333',
      letterSpacing: 1.5,
      parentId: 'frame-99'
    });

    expect(__mockBridge.sendToFigmaValidated).toHaveBeenCalledWith(
      'create_text',
      expect.objectContaining({
        content: 'Test',
        fontSize: 24,
        fontFamily: 'Roboto',
        fontWeight: 600,
        // lineHeight auto-calculated: round(24 * 1.2) = 29
        lineHeight: 29,
        textAlign: 'RIGHT',
        color: '#333333',
        letterSpacing: 1.5,
        parentId: 'frame-99'
      }),
      expect.anything() // Zod response schema
    );
  });

  it('throws when parent validation fails', async () => {
    vi.mocked(parentValidator.validateParentRelationship).mockResolvedValue({
      isValid: false,
      error: 'No parent specified'
    });

    await expect(
      createText({
        content: 'Orphan',
        fontSize: 16,
        fontFamily: 'Inter',
        fontWeight: 400,
        textAlign: 'LEFT'
      })
    ).rejects.toThrow('mock validation error');
  });

  it('throws when bridge returns empty nodeId (Zod validation rejects it)', async () => {
    const { ZodError } = await import('zod');
    __mockBridge.sendToFigmaValidated.mockRejectedValue(
      new ZodError([
        {
          code: 'too_small',
          minimum: 1,
          type: 'string',
          inclusive: true,
          exact: false,
          message: 'String must contain at least 1 character(s)',
          path: ['nodeId']
        }
      ])
    );

    await expect(
      createText({
        content: 'Test',
        fontSize: 16,
        fontFamily: 'Inter',
        fontWeight: 400,
        textAlign: 'LEFT',
        parentId: 'parent-1'
      })
    ).rejects.toThrow();
  });

  it('omits text-align from CSS when LEFT (default)', async () => {
    const result = await createText({
      content: 'Left aligned',
      fontSize: 16,
      fontFamily: 'Inter',
      fontWeight: 400,
      textAlign: 'LEFT',
      parentId: 'parent-1'
    });

    // LEFT alignment should NOT appear in CSS (it's the default)
    expect(result.cssEquivalent).not.toContain('text-align');
  });

  it('generates JUSTIFIED text-align CSS', async () => {
    const result = await createText({
      content: 'Justified text',
      fontSize: 16,
      fontFamily: 'Inter',
      fontWeight: 400,
      textAlign: 'JUSTIFIED',
      parentId: 'parent-1'
    });

    expect(result.cssEquivalent).toContain('text-align: justified');
  });

  it('maps font weight to named CSS value', async () => {
    const result = await createText({
      content: 'Thin text',
      fontSize: 16,
      fontFamily: 'Inter',
      fontWeight: 100,
      textAlign: 'LEFT',
      parentId: 'parent-1'
    });

    // fontWeight 100 should map to "thin" in CSS
    expect(result.cssEquivalent).toContain('100');
  });

  it('handles very long content — truncates name to 50 chars for registry', async () => {
    const longContent =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor';

    await createText({
      content: longContent,
      fontSize: 16,
      fontFamily: 'Inter',
      fontWeight: 400,
      textAlign: 'LEFT',
      parentId: 'parent-1'
    });

    const registry = getNodeRegistry();
    const node = registry.getNode('2:10');
    // Name should be truncated to 50 chars
    expect(node?.name.length).toBeLessThanOrEqual(50);
  });

  it('propagates bridge errors without wrapping', async () => {
    __mockBridge.sendToFigmaValidated.mockRejectedValue(new Error('WebSocket connection lost'));

    await expect(
      createText({
        content: 'Test',
        fontSize: 16,
        fontFamily: 'Inter',
        fontWeight: 400,
        textAlign: 'LEFT',
        parentId: 'parent-1'
      })
    ).rejects.toThrow('WebSocket connection lost');
  });
});
