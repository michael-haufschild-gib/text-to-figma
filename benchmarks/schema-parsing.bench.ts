/**
 * Zod schema parsing benchmarks for MCP tool inputs.
 *
 * Measures the cost of Zod validation per tool call.
 * The MCP server processes tool calls sequentially (stdio),
 * so throughput matters less than per-call latency.
 */

import { bench, describe } from 'vitest';
import { CreateFrameInputSchema } from '../mcp-server/src/tools/create_frame.js';
import { CreateDesignInputSchema } from '../mcp-server/src/tools/create_design.js';
import { CreateTextInputSchema } from '../mcp-server/src/tools/create_text.js';
import { SetFillsInputSchema } from '../mcp-server/src/tools/set_fills.js';
import { ApplyEffectsInputSchema } from '../mcp-server/src/tools/apply_effects.js';

// ─── Valid inputs ────────────────────────────────────────────────────

const validFrame = {
  name: 'MainContainer',
  width: 400,
  height: 600,
  layoutMode: 'VERTICAL',
  itemSpacing: 16,
  padding: 24
};

const validText = {
  content: 'Hello World',
  fontSize: 16,
  parentId: '1:2'
};

const validFills = {
  nodeId: '1:2',
  fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8 }, opacity: 1 }]
};

const validEffects = {
  nodeId: '1:2',
  effects: [
    { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 4 }, radius: 8 }
  ]
};

const validDesignSimple = {
  spec: {
    type: 'frame' as const,
    name: 'Card',
    props: { width: 300, height: 200, layoutMode: 'VERTICAL', padding: 16 },
    children: [
      { type: 'text' as const, name: 'Title', props: { content: 'Card Title', fontSize: 24 } },
      { type: 'text' as const, name: 'Body', props: { content: 'Body text here', fontSize: 16 } }
    ]
  }
};

const validDesignDeep = {
  spec: {
    type: 'frame' as const,
    name: 'Dashboard',
    props: { width: 1200, height: 800, layoutMode: 'VERTICAL', padding: 24, itemSpacing: 16 },
    children: Array.from({ length: 10 }, (_, i) => ({
      type: 'frame' as const,
      name: `Row-${i}`,
      props: { layoutMode: 'HORIZONTAL' as const, itemSpacing: 8 },
      children: Array.from({ length: 5 }, (_, j) => ({
        type: 'frame' as const,
        name: `Cell-${i}-${j}`,
        props: { width: 200, height: 100, fillColor: '#F0F0F0' },
        children: [
          {
            type: 'text' as const,
            name: `Label-${i}-${j}`,
            props: { content: `Cell ${i},${j}`, fontSize: 14 }
          }
        ]
      }))
    }))
  }
};

// ─── Schema parsing benchmarks ───────────────────────────────────────

describe('simple schemas', () => {
  bench('CreateFrameInputSchema.parse', () => {
    CreateFrameInputSchema.parse(validFrame);
  });

  bench('CreateTextInputSchema.parse', () => {
    CreateTextInputSchema.parse(validText);
  });

  bench('SetFillsInputSchema.parse', () => {
    SetFillsInputSchema.parse(validFills);
  });

  bench('ApplyEffectsInputSchema.parse', () => {
    ApplyEffectsInputSchema.parse(validEffects);
  });
});

describe('create_design (recursive schema)', () => {
  bench('simple spec (3 nodes)', () => {
    CreateDesignInputSchema.parse(validDesignSimple);
  });

  bench('deep spec (60 nodes)', () => {
    CreateDesignInputSchema.parse(validDesignDeep);
  });
});

describe('schema validation rejection', () => {
  bench('CreateFrameInputSchema with invalid input', () => {
    try {
      CreateFrameInputSchema.parse({ name: '' }); // min(1) fails
    } catch {
      // expected
    }
  });

  bench('CreateDesignInputSchema with missing required field', () => {
    try {
      CreateDesignInputSchema.parse({ spec: { name: 'test' } }); // missing type
    } catch {
      // expected
    }
  });
});
