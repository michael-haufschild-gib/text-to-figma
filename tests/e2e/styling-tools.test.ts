/**
 * Styling Tools E2E Tests
 *
 * Tests all styling, effects, transform, appearance, text properties,
 * and named style tools through the full three-tier chain.
 *
 * Bug this catches:
 * - Gradient fill stops are not serialized correctly
 * - set_image_fill doesn't forward URL or scaleMode
 * - set_transform rotation/position values are lost in transit
 * - set_appearance opacity or blendMode not forwarded
 * - set_text_properties font/alignment fields dropped
 * - Named style creation → application chain: styleId mismatch
 * - Style application sends wrong styleId to the plugin
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { routeToolCall } from '../../mcp-server/src/routing/tool-router.js';
import {
  setupThreeTier,
  teardownThreeTier,
  resetPerTest,
  createParentFrame,
  extractId,
  type ThreeTierContext
} from './helpers/three-tier-setup.js';

let ctx: ThreeTierContext;

beforeAll(async () => {
  ctx = await setupThreeTier();
});

afterAll(async () => {
  await teardownThreeTier(ctx);
});

beforeEach(() => {
  resetPerTest(ctx);
});

// ─── add_gradient_fill ───────────────────────────────────────────────────

describe('Styling Tools E2E — add_gradient_fill', () => {
  it('applies a linear gradient with multiple stops', async () => {
    const frameId = await createParentFrame('GradientFrame');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('add_gradient_fill', {
      nodeId: frameId,
      type: 'LINEAR',
      stops: [
        { position: 0, color: '#FF0000', opacity: 1 },
        { position: 0.5, color: '#00FF00', opacity: 0.8 },
        { position: 1, color: '#0000FF', opacity: 1 }
      ],
      angle: 45,
      opacity: 0.9
    });

    expect(result[0].text).toContain('Node ID:');
    expect(result[0].text).toContain('Type: LINEAR');
    expect(result[0].text).toContain('Stops: 3');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'add_gradient_fill');
    expect(cmd).toEqual(expect.objectContaining({ type: 'add_gradient_fill' }));
    expect(cmd!.payload.nodeId).toBe(frameId);
    expect(cmd!.payload.type).toBe('LINEAR');
    expect(cmd!.payload.angle).toBe(45);
    expect(cmd!.payload.opacity).toBe(0.9);

    const stops = cmd!.payload.stops as Array<Record<string, unknown>>;
    expect(stops).toHaveLength(3);
    expect(stops[0]).toEqual(expect.objectContaining({ position: 0, color: '#FF0000' }));
    expect(stops[1]).toEqual(expect.objectContaining({ position: 0.5, color: '#00FF00' }));
    expect(stops[2]).toEqual(expect.objectContaining({ position: 1, color: '#0000FF' }));
  });

  it('applies a radial gradient', async () => {
    const frameId = await createParentFrame('RadialFrame');
    ctx.plugin.clearCommands();

    await routeToolCall('add_gradient_fill', {
      nodeId: frameId,
      type: 'RADIAL',
      stops: [
        { position: 0, color: '#FFFFFF' },
        { position: 1, color: '#000000' }
      ]
    });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'add_gradient_fill');
    expect(cmd!.payload.type).toBe('RADIAL');
    expect((cmd!.payload.stops as unknown[]).length).toBe(2);
  });

  it('rejects gradient with fewer than 2 stops', async () => {
    const frameId = await createParentFrame('BadGradient');
    ctx.plugin.clearCommands();

    await expect(
      routeToolCall('add_gradient_fill', {
        nodeId: frameId,
        type: 'LINEAR',
        stops: [{ position: 0, color: '#FF0000' }]
      })
    ).rejects.toThrow();

    expect(ctx.plugin.getReceivedCommands()).toHaveLength(0);
  });
});

// ─── set_image_fill ──────────────────────────────────────────────────────

describe('Styling Tools E2E — set_image_fill', () => {
  it('applies an image fill with URL and scale mode', async () => {
    const frameId = await createParentFrame('ImageFrame');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('set_image_fill', {
      nodeId: frameId,
      imageUrl: 'https://example.com/image.png',
      scaleMode: 'FILL'
    });

    expect(result[0].text).toContain('Image Fill Applied');
    expect(result[0].text).toContain('Image URL:');
    expect(result[0].text).toContain('Scale Mode: FILL');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_image_fill');
    expect(cmd).toEqual(expect.objectContaining({ type: 'set_image_fill' }));
    expect(cmd!.payload.nodeId).toBe(frameId);
    expect(cmd!.payload.imageUrl).toBe('https://example.com/image.png');
    expect(cmd!.payload.scaleMode).toBe('FILL');
  });
});

// ─── set_transform ───────────────────────────────────────────────────────

describe('Styling Tools E2E — set_transform', () => {
  it('sends position and rotation to the plugin', async () => {
    const frameId = await createParentFrame('TransformFrame');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('set_transform', {
      nodeId: frameId,
      position: { x: 150, y: 250 },
      rotation: 45
    });

    expect(result[0].text).toContain('Node ID:');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_transform');
    expect(cmd).toEqual(expect.objectContaining({ type: 'set_transform' }));
    expect(cmd!.payload.nodeId).toBe(frameId);
    expect((cmd!.payload.position as Record<string, number>).x).toBe(150);
    expect((cmd!.payload.position as Record<string, number>).y).toBe(250);
    expect(cmd!.payload.rotation).toBe(45);
  });

  it('sends scale values to the plugin', async () => {
    const frameId = await createParentFrame('ScaleFrame');
    ctx.plugin.clearCommands();

    await routeToolCall('set_transform', {
      nodeId: frameId,
      scale: { x: 2, y: 0.5 }
    });

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_transform');
    expect((cmd!.payload.scale as Record<string, number>).x).toBe(2);
    expect((cmd!.payload.scale as Record<string, number>).y).toBe(0.5);
  });
});

// ─── set_appearance ──────────────────────────────────────────────────────

describe('Styling Tools E2E — set_appearance', () => {
  it('sends opacity and blendMode to the plugin', async () => {
    const frameId = await createParentFrame('AppearanceFrame');
    ctx.plugin.clearCommands();

    const result = await routeToolCall('set_appearance', {
      nodeId: frameId,
      opacity: 0.7,
      blendMode: 'MULTIPLY'
    });

    expect(result[0].text).toContain('Node ID:');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_appearance');
    expect(cmd).toEqual(expect.objectContaining({ type: 'set_appearance' }));
    expect(cmd!.payload.nodeId).toBe(frameId);
    expect(cmd!.payload.opacity).toBe(0.7);
    expect(cmd!.payload.blendMode).toBe('MULTIPLY');
  });
});

// ─── set_text_properties ─────────────────────────────────────────────────

describe('Styling Tools E2E — set_text_properties', () => {
  it('sends text formatting properties to the plugin', async () => {
    const parentId = await createParentFrame('TextParent');
    const textResult = await routeToolCall('create_text', {
      content: 'Hello',
      fontSize: 16,
      parentId
    });
    const textId = extractId(textResult[0].text!, /Text ID:\s*(\S+)/);
    ctx.plugin.clearCommands();

    const result = await routeToolCall('set_text_properties', {
      nodeId: textId,
      decoration: 'UNDERLINE',
      letterSpacing: { value: 1.5, unit: 'PERCENT' },
      textCase: 'UPPER'
    });

    expect(result[0].text).toContain('Node ID:');

    const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'set_text_properties');
    expect(cmd).toEqual(expect.objectContaining({ type: 'set_text_properties' }));
    expect(cmd!.payload.nodeId).toBe(textId);
    expect(cmd!.payload.decoration).toBe('UNDERLINE');
    expect(cmd!.payload.textCase).toBe('UPPER');
    const spacing = cmd!.payload.letterSpacing as Record<string, unknown>;
    expect(spacing.value).toBe(1.5);
    expect(spacing.unit).toBe('PERCENT');
  });
});

// ─── Named Styles: Create → Apply chains ─────────────────────────────────

describe('Styling Tools E2E — named style workflows', () => {
  describe('color style workflow', () => {
    it('create_color_style returns styleId', async () => {
      const result = await routeToolCall('create_color_style', {
        name: 'Primary Blue',
        color: '#0066FF'
      });

      expect(result[0].text).toContain('Style ID:');
      expect(result[0].text).toContain('Name: Primary Blue');
      expect(result[0].text).toContain('Color: #0066FF');

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_color_style');
      expect(cmd).toEqual(expect.objectContaining({ type: 'create_color_style' }));
      expect(cmd!.payload.name).toBe('Primary Blue');
      expect(cmd!.payload.color).toBe('#0066FF');
    });

    it('create_color_style → apply_fill_style chain forwards styleId', async () => {
      const styleResult = await routeToolCall('create_color_style', {
        name: 'Error Red',
        color: '#FF0000'
      });
      const styleId = extractId(styleResult[0].text!, /Style ID:\s*(\S+)/);

      const frameId = await createParentFrame('StyledFrame');
      ctx.plugin.clearCommands();

      const applyResult = await routeToolCall('apply_fill_style', {
        nodeId: frameId,
        styleNameOrId: styleId
      });

      expect(applyResult[0].text).toContain('Node ID:');

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'apply_fill_style');
      expect(cmd).toEqual(expect.objectContaining({ type: 'apply_fill_style' }));
      expect(cmd!.payload.nodeId).toBe(frameId);
      expect(cmd!.payload.styleNameOrId).toBe(styleId);
    });
  });

  describe('text style workflow', () => {
    it('create_text_style returns styleId', async () => {
      const result = await routeToolCall('create_text_style', {
        name: 'Heading 1',
        fontSize: 32,
        fontWeight: 700,
        lineHeight: 40
      });

      expect(result[0].text).toContain('Style ID:');
      expect(result[0].text).toContain('Name: Heading 1');

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_text_style');
      expect(cmd!.payload.name).toBe('Heading 1');
      expect(cmd!.payload.fontSize).toBe(32);
      expect(cmd!.payload.fontWeight).toBe(700);
    });

    it('create_text_style → apply_text_style chain forwards styleNameOrId', async () => {
      const styleResult = await routeToolCall('create_text_style', {
        name: 'Body',
        fontSize: 16,
        fontWeight: 400
      });
      const styleId = extractId(styleResult[0].text!, /Style ID:\s*(\S+)/);

      const parentId = await createParentFrame('TextStyleTarget');
      const textResult = await routeToolCall('create_text', {
        content: 'Styled',
        fontSize: 16,
        parentId
      });
      const textId = extractId(textResult[0].text!, /Text ID:\s*(\S+)/);
      ctx.plugin.clearCommands();

      await routeToolCall('apply_text_style', {
        nodeId: textId,
        styleNameOrId: styleId
      });

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'apply_text_style');
      expect(cmd!.payload.nodeId).toBe(textId);
      expect(cmd!.payload.styleNameOrId).toBe(styleId);
    });
  });

  describe('effect style workflow', () => {
    it('create_effect_style returns styleId', async () => {
      const result = await routeToolCall('create_effect_style', {
        name: 'Card Shadow',
        effects: [
          {
            type: 'DROP_SHADOW',
            color: '#000000',
            opacity: 0.15,
            x: 0,
            y: 4,
            blur: 8,
            spread: 0
          }
        ]
      });

      expect(result[0].text).toContain('Style ID:');
      expect(result[0].text).toContain('Name: Card Shadow');

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'create_effect_style');
      expect(cmd!.payload.name).toBe('Card Shadow');
      expect((cmd!.payload.effects as unknown[]).length).toBe(1);
    });

    it('create_effect_style → apply_effect_style chain forwards styleId', async () => {
      const styleResult = await routeToolCall('create_effect_style', {
        name: 'Elevation 2',
        effects: [
          { type: 'DROP_SHADOW', color: '#000000', opacity: 0.1, x: 0, y: 2, blur: 4, spread: 0 }
        ]
      });
      const styleId = extractId(styleResult[0].text!, /Style ID:\s*(\S+)/);

      const frameId = await createParentFrame('ShadowTarget');
      ctx.plugin.clearCommands();

      await routeToolCall('apply_effect_style', {
        nodeId: frameId,
        styleNameOrId: styleId
      });

      const cmd = ctx.plugin.getReceivedCommands().find((c) => c.type === 'apply_effect_style');
      expect(cmd!.payload.nodeId).toBe(frameId);
      expect(cmd!.payload.styleNameOrId).toBe(styleId);
    });
  });
});

// ─── Complete Styling Workflow ────────────────────────────────────────────

describe('Styling Tools E2E — multi-step styling workflow', () => {
  it('create frame → set fill → add gradient → set stroke → add shadow → set corner radius', async () => {
    // Step 1: Create frame
    const frameId = await createParentFrame('FullyStyled');
    ctx.plugin.clearCommands();

    // Step 2: Set solid fill
    await routeToolCall('set_fills', {
      nodeId: frameId,
      color: '#FFFFFF',
      opacity: 1
    });

    // Step 3: Add gradient overlay
    await routeToolCall('add_gradient_fill', {
      nodeId: frameId,
      type: 'LINEAR',
      stops: [
        { position: 0, color: '#0066FF', opacity: 0.1 },
        { position: 1, color: '#0066FF', opacity: 0 }
      ]
    });

    // Step 4: Set stroke
    await routeToolCall('set_stroke', {
      nodeId: frameId,
      strokeColor: '#E0E0E0',
      strokeWeight: 1,
      strokeAlign: 'INSIDE'
    });

    // Step 5: Add shadow
    await routeToolCall('apply_effects', {
      nodeId: frameId,
      effects: [
        { type: 'DROP_SHADOW', color: '#000000', opacity: 0.1, x: 0, y: 2, blur: 8, spread: 0 }
      ]
    });

    // Step 6: Set corner radius
    await routeToolCall('set_corner_radius', {
      nodeId: frameId,
      radius: 12
    });

    // Verify all 5 styling commands were sent with the correct nodeId
    const cmds = ctx.plugin.getReceivedCommands();
    const types = cmds.map((c) => c.type);

    expect(types).toContain('set_fills');
    expect(types).toContain('add_gradient_fill');
    expect(types).toContain('set_stroke');
    expect(types).toContain('apply_effects');
    expect(types).toContain('set_corner_radius');

    // Every styling command should reference the same frameId
    for (const cmd of cmds) {
      if (
        [
          'set_fills',
          'add_gradient_fill',
          'set_stroke',
          'apply_effects',
          'set_corner_radius'
        ].includes(cmd.type)
      ) {
        expect(cmd.payload.nodeId).toBe(frameId);
      }
    }
  });
});
