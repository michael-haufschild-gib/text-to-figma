/**
 * Parent Validator Async Tests
 *
 * Tests validateParentExists and validateParentRelationship which
 * require a mocked FigmaBridge connection.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    __mockBridge: mockBridge
  };
});

const { validateParentExists, validateParentRelationship } =
  await import('../../mcp-server/src/utils/parent-validator.js');
const { __mockBridge } = (await import('../../mcp-server/src/figma-bridge.js')) as {
  __mockBridge: {
    isConnected: ReturnType<typeof vi.fn>;
    sendToFigma: ReturnType<typeof vi.fn>;
  };
};

describe('validateParentExists', () => {
  beforeEach(() => {
    __mockBridge.isConnected.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns error when bridge is not connected', async () => {
    __mockBridge.isConnected.mockReturnValue(false);

    const result = await validateParentExists('parent-1');

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('not connected to Figma');
    expect(result.suggestion).toContain('Figma plugin');
  });

  it('returns error when parent node does not exist', async () => {
    __mockBridge.sendToFigma.mockResolvedValue({ exists: false });

    const result = await validateParentExists('nonexistent-id');

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('PARENT NOT FOUND');
    expect(result.error).toContain('nonexistent-id');
    expect(result.suggestion).toContain('get_page_hierarchy');
  });

  it('returns error when parent node is an invalid container type', async () => {
    __mockBridge.sendToFigma.mockResolvedValue({
      exists: true,
      node: { type: 'TEXT', id: 'text-1' }
    });

    const result = await validateParentExists('text-1');

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('INVALID PARENT TYPE');
    expect(result.error).toContain('text');
    expect(result.suggestion).toContain('frame container');
  });

  it('returns valid for frame parent type', async () => {
    __mockBridge.sendToFigma.mockResolvedValue({
      exists: true,
      node: { type: 'FRAME', id: 'frame-1' }
    });

    const result = await validateParentExists('frame-1');

    expect(result.isValid).toBe(true);
    expect(result.parentNode).toEqual({ type: 'FRAME', id: 'frame-1' });
  });

  it('returns valid for component parent type', async () => {
    __mockBridge.sendToFigma.mockResolvedValue({
      exists: true,
      node: { type: 'COMPONENT', id: 'comp-1' }
    });

    const result = await validateParentExists('comp-1');

    expect(result.isValid).toBe(true);
  });

  it('returns valid for page parent type', async () => {
    __mockBridge.sendToFigma.mockResolvedValue({
      exists: true,
      node: { type: 'PAGE', id: 'page-1' }
    });

    const result = await validateParentExists('page-1');

    expect(result.isValid).toBe(true);
  });

  it('returns valid for component_set parent type', async () => {
    __mockBridge.sendToFigma.mockResolvedValue({
      exists: true,
      node: { type: 'COMPONENT_SET', id: 'cs-1' }
    });

    const result = await validateParentExists('cs-1');

    expect(result.isValid).toBe(true);
  });

  it('returns error when bridge throws an exception', async () => {
    __mockBridge.sendToFigma.mockRejectedValue(new Error('Connection timeout'));

    const result = await validateParentExists('parent-1');

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Failed to validate parent');
    expect(result.error).toContain('Connection timeout');
    expect(result.suggestion).toContain('parent ID is correct');
  });

  it('handles non-Error thrown value in catch block', async () => {
    __mockBridge.sendToFigma.mockRejectedValue('string error');

    const result = await validateParentExists('parent-1');

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Unknown error');
  });

  it('rejects ellipse as parent type', async () => {
    __mockBridge.sendToFigma.mockResolvedValue({
      exists: true,
      node: { type: 'ELLIPSE', id: 'ellipse-1' }
    });

    const result = await validateParentExists('ellipse-1');

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('INVALID PARENT TYPE');
  });

  it('handles node with undefined type', async () => {
    __mockBridge.sendToFigma.mockResolvedValue({
      exists: true,
      node: { id: 'no-type' }
    });

    const result = await validateParentExists('no-type');

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('INVALID PARENT TYPE');
  });
});

describe('validateParentRelationship', () => {
  beforeEach(() => {
    __mockBridge.isConnected.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns basic validation failure when strict and no parentId for child type', async () => {
    const result = await validateParentRelationship('text', undefined, { strict: true });

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('HIERARCHY VIOLATION');
  });

  it('returns warning (valid) when non-strict and no parentId for child type', async () => {
    const result = await validateParentRelationship('text', undefined, { strict: false });

    expect(result.isValid).toBe(true);
    expect(result.warning).toContain('HIERARCHY VIOLATION');
  });

  it('validates parent existence when parentId is provided', async () => {
    __mockBridge.sendToFigma.mockResolvedValue({
      exists: true,
      node: { type: 'FRAME', id: 'frame-1' }
    });

    const result = await validateParentRelationship('text', 'frame-1', {
      strict: false,
      checkExists: true
    });

    expect(result.isValid).toBe(true);
  });

  it('returns existence error when parent does not exist', async () => {
    __mockBridge.sendToFigma.mockResolvedValue({ exists: false });

    const result = await validateParentRelationship('text', 'missing-id', {
      checkExists: true
    });

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('PARENT NOT FOUND');
  });

  it('skips existence check when checkExists is false', async () => {
    const result = await validateParentRelationship('text', 'any-id', {
      checkExists: false
    });

    expect(result.isValid).toBe(true);
    expect(__mockBridge.sendToFigma).not.toHaveBeenCalled();
  });

  it('returns valid for container types without parentId', async () => {
    const result = await validateParentRelationship('frame', undefined);

    expect(result.isValid).toBe(true);
  });

  it('defaults strict to false and checkExists to true', async () => {
    __mockBridge.sendToFigma.mockResolvedValue({
      exists: true,
      node: { type: 'FRAME', id: 'frame-1' }
    });

    const result = await validateParentRelationship('text', 'frame-1');

    expect(result.isValid).toBe(true);
    expect(__mockBridge.sendToFigma).toHaveBeenCalled();
  });
});
