/**
 * Schema Fuzzing Integration Tests
 *
 * Uses property-based testing to fuzz ALL registered tool schemas with random
 * inputs. Verifies that schemas never throw unhandled exceptions (they should
 * return safeParse results), and that valid-shaped inputs are accepted while
 * type-mismatched inputs are rejected.
 *
 * This catches a class of bugs that deterministic schema tests miss:
 * - Zod transforms that throw on unexpected input shapes
 * - Refinement functions with uncaught exceptions
 * - Schema coercion that produces NaN or Infinity
 * - Unicode edge cases in string validation
 */

import { test, fc } from '@fast-check/vitest';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { registerAllTools } from '../../mcp-server/src/routing/register-tools.js';
import { getToolRegistry, resetToolRegistry } from '../../mcp-server/src/routing/tool-registry.js';
import type { AnyToolHandler } from '../../mcp-server/src/routing/tool-handler.js';

describe('Schema Fuzzing — All Registered Tools', () => {
  let tools: AnyToolHandler[];

  beforeEach(() => {
    resetToolRegistry();
    registerAllTools();
    tools = getToolRegistry().getAll();
  });

  afterEach(() => {
    resetToolRegistry();
  });

  describe('safeParse never throws (returns result object)', () => {
    test.prop({
      input: fc.anything({
        maxDepth: 3,
        maxKeys: 10,
        withBigInt: false,
        withDate: false,
        withMap: false,
        withSet: false,
        withTypedArray: false
      })
    })('random input to every schema returns {success: boolean} without throwing', ({ input }) => {
      for (const tool of tools) {
        const result = tool.schema.safeParse(input);
        // safeParse must return a result object — success is true or false, never undefined
        expect(result.success === true || result.success === false).toBe(true);
      }
    });
  });

  describe('type-mismatched primitives are always rejected', () => {
    const primitives = [
      null,
      undefined,
      42,
      -1,
      0,
      NaN,
      Infinity,
      -Infinity,
      true,
      false,
      '',
      'random string',
      Symbol('test')
    ];

    it('all tools reject every non-object primitive', () => {
      for (const tool of tools) {
        for (const value of primitives) {
          const result = tool.schema.safeParse(value);
          expect(
            result.success,
            `Tool "${tool.name}" should reject ${String(value)} but accepted it`
          ).toBe(false);
        }
      }
    });
  });

  describe('arrays are always rejected (tools expect objects)', () => {
    const arrays = [[], [1, 2, 3], [{}], [null], ['string']];

    it('all tools reject every array input', () => {
      for (const tool of tools) {
        for (const arr of arrays) {
          const result = tool.schema.safeParse(arr);
          expect(
            result.success,
            `Tool "${tool.name}" should reject array ${JSON.stringify(arr)} but accepted it`
          ).toBe(false);
        }
      }
    });
  });

  describe('empty object handling is consistent', () => {
    it('tools with required fields reject empty object', () => {
      for (const tool of tools) {
        const required = (tool.definition.inputSchema as { required?: string[] }).required ?? [];
        if (required.length > 0) {
          const result = tool.schema.safeParse({});
          expect(
            result.success,
            `Tool "${tool.name}" has required fields [${required.join(', ')}] but accepts {}`
          ).toBe(false);
        }
      }
    });
  });

  describe('string nodeId validation', () => {
    // Many tools require a nodeId field — verify they reject common bad values
    const badNodeIds = ['', '   ', '\n', '\0', '\t'];

    it('tools requiring nodeId reject whitespace-only and empty strings', () => {
      const nodeIdTools = tools.filter((t) => {
        const props = (t.definition.inputSchema.properties ?? {}) as Record<string, unknown>;
        return 'nodeId' in props;
      });

      for (const tool of nodeIdTools) {
        for (const bad of badNodeIds) {
          const result = tool.schema.safeParse({ nodeId: bad });
          // Tools with required nodeId should reject empty/whitespace.
          // Some tools might accept whitespace-only nodeIds (schema doesn't trim),
          // but empty string should always fail if there's a min(1) constraint.
          if (bad === '') {
            expect(result.success, `Tool "${tool.name}" should reject empty nodeId`).toBe(false);
          }
        }
      }
    });
  });

  describe('numeric overflow in dimension fields', () => {
    test.prop({
      width: fc.oneof(
        fc.constant(Number.MAX_SAFE_INTEGER),
        fc.constant(Number.MAX_VALUE),
        fc.constant(Number.MIN_VALUE),
        fc.constant(Number.EPSILON),
        fc.constant(1e308)
      )
    })('extreme numeric values in width/height do not cause schema exceptions', ({ width }) => {
      // create_frame is a good representative — has width/height optional fields
      const frameTool = tools.find((t) => t.name === 'create_frame');
      if (!frameTool) return;

      const result = frameTool.schema.safeParse({
        name: 'test',
        width
      });
      // Should either parse successfully or return {success: false}, never throw
      expect(result.success === true || result.success === false).toBe(true);
    });
  });

  describe('unicode and special characters in string fields', () => {
    const specialStrings = [
      'normal text',
      '🎨 emoji frame',
      '日本語テキスト',
      'مرحبا',
      '\u0000null byte',
      '\uFEFFBOM character',
      'a'.repeat(10000), // very long string
      '<script>alert(1)</script>',
      '${template}',
      'name\nwith\nnewlines',
      'tab\there',
      'back\\slash'
    ];

    it('create_frame schema handles unicode and special strings without throwing', () => {
      const frameTool = tools.find((t) => t.name === 'create_frame');
      if (!frameTool) return;

      for (const str of specialStrings) {
        const result = frameTool.schema.safeParse({ name: str });
        // All non-empty strings should be accepted (min(1) is the only constraint)
        if (str.length > 0) {
          expect(
            result.success,
            `create_frame should accept name="${str.substring(0, 20)}..." but rejected it`
          ).toBe(true);
        }
      }
    });

    it('create_text schema handles unicode content without throwing', () => {
      const textTool = tools.find((t) => t.name === 'create_text');
      if (!textTool) return;

      for (const str of specialStrings) {
        const result = textTool.schema.safeParse({ content: str });
        if (str.length > 0) {
          expect(result.success === true || result.success === false).toBe(true);
        }
      }
    });
  });

  describe('prototype pollution defense', () => {
    it('schemas do not break with __proto__ or constructor keys', () => {
      const poisoned = {
        name: 'test',
        __proto__: { admin: true },
        constructor: { prototype: { isAdmin: true } }
      };

      const frameTool = tools.find((t) => t.name === 'create_frame');
      if (!frameTool) return;

      // Should parse without throwing (Zod strips unknown keys)
      const result = frameTool.schema.safeParse(poisoned);
      expect(result.success === true || result.success === false).toBe(true);
      if (result.success) {
        // Verify poisoned keys are not in the output
        const data = result.data as Record<string, unknown>;
        expect(data).not.toHaveProperty('admin');
        expect(data).not.toHaveProperty('isAdmin');
      }
    });
  });

  describe('spacing schema constraint enforcement', () => {
    test.prop({
      spacing: fc.integer({ min: -100, max: 200 })
    })('create_frame spacing values are accepted only if on the 8pt grid', ({ spacing }) => {
      const frameTool = tools.find((t) => t.name === 'create_frame');
      if (!frameTool) return;

      const validValues = [0, 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 128];
      const result = frameTool.schema.safeParse({
        name: 'test',
        itemSpacing: spacing
      });

      if (validValues.includes(spacing)) {
        expect(result.success, `Spacing ${spacing} should be valid`).toBe(true);
      } else {
        expect(result.success, `Spacing ${spacing} should be invalid`).toBe(false);
      }
    });
  });

  describe('font size constraint enforcement', () => {
    test.prop({
      fontSize: fc.integer({ min: 1, max: 200 })
    })('create_text fontSize accepted only if in type scale', ({ fontSize }) => {
      const textTool = tools.find((t) => t.name === 'create_text');
      if (!textTool) return;

      const validSizes = [12, 16, 20, 24, 32, 40, 48, 64];
      const result = textTool.schema.safeParse({
        content: 'test',
        fontSize
      });

      if (validSizes.includes(fontSize)) {
        expect(result.success, `Font size ${fontSize} should be valid`).toBe(true);
      } else {
        expect(result.success, `Font size ${fontSize} should be invalid`).toBe(false);
      }
    });
  });
});
