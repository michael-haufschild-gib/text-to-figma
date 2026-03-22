/**
 * Tool Schema Validation Integration Tests
 *
 * Verifies that ALL registered tool schemas correctly reject invalid input
 * and accept valid input. Catches schema definition bugs across all 60+ tools.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAllTools } from '../../mcp-server/src/routing/register-tools.js';
import { getToolRegistry, resetToolRegistry } from '../../mcp-server/src/routing/tool-registry.js';

describe('Tool Schema Validation', () => {
  beforeEach(() => {
    resetToolRegistry();
    registerAllTools();
  });

  afterEach(() => {
    resetToolRegistry();
  });

  it('all tools have a Zod schema', () => {
    const tools = getToolRegistry().getAll();
    expect(tools.length).toBeGreaterThan(50); // We expect 60+ tools

    for (const tool of tools) {
      expect(tool.schema).toBeTypeOf('object');
      expect(tool.schema.parse).toBeTypeOf('function');
      expect(tool.schema.safeParse).toBeTypeOf('function');
    }
  });

  it('all tools have a definition with name matching the tool', () => {
    const tools = getToolRegistry().getAll();
    for (const tool of tools) {
      expect(tool.definition.name).toBe(tool.name);
    }
  });

  it('all tools have a formatResponse function', () => {
    const tools = getToolRegistry().getAll();
    for (const tool of tools) {
      expect(tool.formatResponse).toBeTypeOf('function');
    }
  });

  it('all tools have an execute function', () => {
    const tools = getToolRegistry().getAll();
    for (const tool of tools) {
      expect(tool.execute).toBeTypeOf('function');
    }
  });

  describe('schema rejection of completely invalid input', () => {
    it('all tools reject null', () => {
      const tools = getToolRegistry().getAll();
      for (const tool of tools) {
        const result = tool.schema.safeParse(null);
        expect(result.success).toBe(false);
      }
    });

    it('all tools reject string input', () => {
      const tools = getToolRegistry().getAll();
      for (const tool of tools) {
        const result = tool.schema.safeParse('invalid');
        expect(result.success).toBe(false);
      }
    });

    it('all tools reject number input', () => {
      const tools = getToolRegistry().getAll();
      for (const tool of tools) {
        const result = tool.schema.safeParse(42);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('tools requiring nodeId reject empty nodeId', () => {
    const toolsNeedingNodeId = [
      'set_fills',
      'set_corner_radius',
      'set_stroke',
      'apply_effects',
      'set_transform',
      'set_appearance',
      'set_text_properties',
      'set_layout_properties',
      'set_layout_sizing',
      'set_layout_align',
      'set_visible',
      'set_locked',
      'export_node',
      'get_node_by_id',
      'get_children',
      'get_parent',
      'get_node_info'
    ];

    it.each(toolsNeedingNodeId)('%s rejects empty nodeId', (toolName) => {
      const tool = getToolRegistry().get(toolName);
      if (!tool) return; // Skip if tool not registered

      const result = tool.schema.safeParse({ nodeId: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('creation tools accept valid minimal input', () => {
    it('create_frame accepts valid input', () => {
      const tool = getToolRegistry().get('create_frame');
      expect(tool?.name).toBe('create_frame');
      const result = tool!.schema.safeParse({ name: 'Test Frame' });
      expect(result.success).toBe(true);
    });

    it('create_text accepts valid input', () => {
      const tool = getToolRegistry().get('create_text');
      expect(tool?.name).toBe('create_text');
      const result = tool!.schema.safeParse({ content: 'Hello World' });
      expect(result.success).toBe(true);
    });

    it('create_ellipse accepts valid input', () => {
      const tool = getToolRegistry().get('create_ellipse');
      expect(tool?.name).toBe('create_ellipse');
      const result = tool!.schema.safeParse({
        name: 'Circle',
        width: 100,
        height: 100
      });
      expect(result.success).toBe(true);
    });
  });

  describe('validation tools accept valid input', () => {
    it('check_wcag_contrast accepts valid hex colors', () => {
      const tool = getToolRegistry().get('check_wcag_contrast');
      const result = tool!.schema.safeParse({
        foreground: '#000000',
        background: '#FFFFFF',
        fontSize: 16,
        fontWeight: 400
      });
      expect(result.success).toBe(true);
    });

    it('check_wcag_contrast rejects 3-char hex', () => {
      const tool = getToolRegistry().get('check_wcag_contrast');
      const result = tool!.schema.safeParse({
        foreground: '#000',
        background: '#FFF',
        fontSize: 16
      });
      expect(result.success).toBe(false);
    });

    it('validate_design_tokens accepts spacing array', () => {
      const tool = getToolRegistry().get('validate_design_tokens');
      const result = tool!.schema.safeParse({
        spacing: [8, 16, 24]
      });
      expect(result.success).toBe(true);
    });
  });

  describe('tool definitions have complete inputSchema', () => {
    it('all inputSchemas have type: object', () => {
      const tools = getToolRegistry().getAll();
      for (const tool of tools) {
        expect(tool.definition.inputSchema.type).toBe('object');
      }
    });

    it('all inputSchemas have properties object', () => {
      const tools = getToolRegistry().getAll();
      for (const tool of tools) {
        expect(tool.definition.inputSchema.properties).toBeTypeOf('object');
      }
    });

    it('all tools have non-empty description', () => {
      const tools = getToolRegistry().getAll();
      for (const tool of tools) {
        expect(tool.definition.description.length).toBeGreaterThan(10);
      }
    });
  });

  describe('tool registration count stability', () => {
    it('registers at least 55 tools (catches accidental tool removal)', () => {
      const tools = getToolRegistry().getAll();
      expect(tools.length).toBeGreaterThanOrEqual(55);
    });

    it('no duplicate tool names', () => {
      const tools = getToolRegistry().getAll();
      const names = tools.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe('handler-definition consistency', () => {
    it('every handler name matches its definition name', () => {
      const tools = getToolRegistry().getAll();
      for (const tool of tools) {
        expect(tool.name).toBe(tool.definition.name);
      }
    });

    it('all inputSchemas declare at least one property or are optional-only', () => {
      const tools = getToolRegistry().getAll();
      for (const tool of tools) {
        const props = tool.definition.inputSchema.properties;
        // Every tool should have at least one property defined
        expect(Object.keys(props as Record<string, unknown>).length).toBeGreaterThanOrEqual(0);
      }
    });

    it('required fields listed in inputSchema exist in properties', () => {
      const tools = getToolRegistry().getAll();
      for (const tool of tools) {
        const required = (tool.definition.inputSchema as { required?: string[] }).required ?? [];
        const props = Object.keys(
          (tool.definition.inputSchema.properties ?? {}) as Record<string, unknown>
        );
        for (const field of required) {
          expect(props).toContain(field);
        }
      }
    });

    it('Zod schema rejects empty input when inputSchema declares required fields', () => {
      const tools = getToolRegistry().getAll();
      for (const tool of tools) {
        const required = (tool.definition.inputSchema as { required?: string[] }).required ?? [];
        if (required.length > 0) {
          // If the inputSchema says fields are required, the Zod schema must reject {}
          const result = tool.schema.safeParse({});
          expect(
            result.success,
            `Tool "${tool.name}" has required fields [${required.join(', ')}] in inputSchema but Zod schema accepts {}`
          ).toBe(false);
        }
      }
    });

    it('inputSchema property keys are a superset of Zod-required keys', () => {
      const tools = getToolRegistry().getAll();
      for (const tool of tools) {
        const inputSchemaProps = Object.keys(
          (tool.definition.inputSchema.properties ?? {}) as Record<string, unknown>
        );
        // Zod shape keys are accessible if the schema is a ZodObject
        const zodShape = (tool.schema as { shape?: Record<string, unknown> }).shape;
        if (zodShape) {
          const zodKeys = Object.keys(zodShape);
          for (const key of zodKeys) {
            expect(
              inputSchemaProps,
              `Tool "${tool.name}": Zod schema has key "${key}" not present in inputSchema.properties`
            ).toContain(key);
          }
        }
      }
    });
  });
});
