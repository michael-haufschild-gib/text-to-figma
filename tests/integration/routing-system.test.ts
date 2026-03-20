/**
 * Integration Tests for Routing System
 *
 * Tests that registered tools work correctly through the routing pipeline.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAllTools } from '../../mcp-server/src/routing/register-tools.js';
import { getToolRegistry, resetToolRegistry } from '../../mcp-server/src/routing/tool-registry.js';
import { routeToolCall } from '../../mcp-server/src/routing/tool-router.js';

describe('Routing System Integration', () => {
  beforeEach(() => {
    resetToolRegistry();
    registerAllTools();
  });

  afterEach(() => {
    resetToolRegistry();
  });

  it('registers all expected tools', () => {
    const registry = getToolRegistry();
    const toolCount = registry.getAll().length;

    expect(toolCount).toBeGreaterThan(0);
    expect(registry.get('create_frame')?.name).toBe('create_frame');
    expect(registry.get('set_fills')?.name).toBe('set_fills');
    expect(registry.get('create_text')?.name).toBe('create_text');
    expect(registry.get('set_layout_properties')?.name).toBe('set_layout_properties');
    expect(registry.get('validate_design_tokens')?.name).toBe('validate_design_tokens');
    expect(registry.get('check_wcag_contrast')?.name).toBe('check_wcag_contrast');
  });

  it('routes validate_design_tokens with valid input', async () => {
    const result = await routeToolCall('validate_design_tokens', {
      spacing: [8, 16, 24],
      typography: [
        { fontSize: 16, name: 'body' },
        { fontSize: 24, name: 'heading' }
      ],
      colors: [{ foreground: '#000000', background: '#FFFFFF', name: 'text/bg' }]
    });

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('text');
    expect(result[0].text).toContain('Validation Report');
  });

  it('routes check_wcag_contrast with valid input', async () => {
    const result = await routeToolCall('check_wcag_contrast', {
      foreground: '#000000',
      background: '#FFFFFF',
      fontSize: 16,
      fontWeight: 400
    });

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('text');
    expect(result[0].text).toContain('Contrast Check');
  });

  it('rejects invalid input with validation error', async () => {
    await expect(
      routeToolCall('validate_design_tokens', {
        spacing: ['invalid']
      })
    ).rejects.toThrow();
  });

  it('lists tool definitions with correct structure', () => {
    const registry = getToolRegistry();
    const definitions = registry.listDefinitions();

    expect(definitions.length).toBeGreaterThan(50);
    for (const def of definitions) {
      expect(def.name).toMatch(/^[a-z_]+$/);
      expect(def.inputSchema.type).toBe('object');
    }
  });

  it('rejects unknown tool names', async () => {
    await expect(routeToolCall('nonexistent_tool', {})).rejects.toThrow('Unknown tool');
  });

  it('routes check_wcag_contrast with poor contrast pair', async () => {
    const result = await routeToolCall('check_wcag_contrast', {
      foreground: '#CCCCCC',
      background: '#FFFFFF',
      fontSize: 14,
      fontWeight: 400
    });

    expect(result[0].text).toContain('FAIL');
  });

  it('get_node_info throws for unknown node IDs', async () => {
    await expect(routeToolCall('get_node_info', { nodeId: 'nonexistent_node' })).rejects.toThrow();
  });

  describe('schema validation edge cases', () => {
    it('accepts empty object for validate_design_tokens (all fields optional)', async () => {
      const result = await routeToolCall('validate_design_tokens', {});
      expect(result[0].text).toContain('Validation Report');
    });

    it('accepts validate_design_tokens with only colors', async () => {
      const result = await routeToolCall('validate_design_tokens', {
        colors: [{ foreground: '#000000', background: '#FFFFFF', name: 'test' }]
      });
      expect(result[0].text).toContain('Validation Report');
    });

    it('rejects check_wcag_contrast with missing background', async () => {
      await expect(
        routeToolCall('check_wcag_contrast', { foreground: '#000000' })
      ).rejects.toThrow();
    });

    it('rejects check_wcag_contrast with invalid hex', async () => {
      await expect(
        routeToolCall('check_wcag_contrast', {
          foreground: 'not-hex',
          background: '#FFFFFF'
        })
      ).rejects.toThrow();
    });
  });

  describe('tool definition structure', () => {
    it('no tools have empty descriptions', () => {
      const definitions = getToolRegistry().listDefinitions();
      for (const def of definitions) {
        expect(def.description.length).toBeGreaterThan(0);
      }
    });

    it('all tool names use snake_case', () => {
      const definitions = getToolRegistry().listDefinitions();
      for (const def of definitions) {
        expect(def.name).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    });

    it('all inputSchemas have type: object', () => {
      const definitions = getToolRegistry().listDefinitions();
      for (const def of definitions) {
        expect(def.inputSchema.type).toBe('object');
      }
    });

    it('all inputSchemas have properties', () => {
      const definitions = getToolRegistry().listDefinitions();
      for (const def of definitions) {
        expect(def.inputSchema.properties).toBeTypeOf('object');
      }
    });
  });

  describe('validate_design_tokens with various inputs', () => {
    it('validates all-valid spacing', async () => {
      const result = await routeToolCall('validate_design_tokens', {
        spacing: [0, 8, 16, 24, 32]
      });
      const text = result[0].text as string;
      expect(text).toContain('SPACING');
    });

    it('validates invalid spacing values', async () => {
      const result = await routeToolCall('validate_design_tokens', {
        spacing: [10, 15, 20]
      });
      const text = result[0].text as string;
      expect(text).toContain('Suggested');
    });

    it('validates typography entries', async () => {
      const result = await routeToolCall('validate_design_tokens', {
        typography: [
          { fontSize: 16, name: 'body' },
          { fontSize: 15, name: 'bad-size' }
        ]
      });
      const text = result[0].text as string;
      expect(text).toContain('TYPOGRAPHY');
    });
  });

  describe('check_wcag_contrast precision', () => {
    it('returns exact 21:1 ratio for black on white', async () => {
      const result = await routeToolCall('check_wcag_contrast', {
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });
      const text = result[0].text as string;
      expect(text).toContain('21');
      expect(text).toContain('PASS');
    });

    it('detects large text for fontSize >= 18 and normal weight', async () => {
      const result = await routeToolCall('check_wcag_contrast', {
        foreground: '#767676',
        background: '#FFFFFF',
        fontSize: 24,
        fontWeight: 400
      });
      const text = result[0].text as string;
      expect(text).toContain('Contrast Check');
    });

    it('detects large text for fontSize >= 14 and bold weight', async () => {
      const result = await routeToolCall('check_wcag_contrast', {
        foreground: '#767676',
        background: '#FFFFFF',
        fontSize: 14,
        fontWeight: 700
      });
      const text = result[0].text as string;
      expect(text).toContain('Contrast Check');
    });
  });
});
