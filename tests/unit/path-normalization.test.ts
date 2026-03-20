/**
 * Path Normalization Tests
 *
 * Tests property order normalization, string-to-number coercion,
 * and error messages via the repairPathCommands function.
 */

import { describe, expect, it } from 'vitest';
import { repairPathCommands } from '../../mcp-server/src/tools/utils/path-command-repair.js';

describe('Path Normalization', () => {
  it('handles commands with properties in different order', () => {
    const result = repairPathCommands([
      { type: 'M', y: 100, x: 50 },
      { type: 'L', y: 200, x: 150 }
    ]);

    expect(result.commands[0]).toEqual({ type: 'M', x: 50, y: 100 });
    expect(result.commands[1]).toEqual({ type: 'L', x: 150, y: 200 });
  });

  it('converts string numbers to numbers', () => {
    const result = repairPathCommands([
      { type: 'M', x: '50', y: '100' },
      { type: 'L', x: '150', y: '200' }
    ]);

    expect(result.commands[0].x).toBe(50);
    expect(result.commands[0].y).toBe(100);
    expect(result.totalFixed).toBe(2);
  });

  it('provides helpful error for missing required properties', () => {
    expect(() =>
      repairPathCommands([{ type: 'M', x: 50 } as never, { type: 'L', x: 150, y: 200 }])
    ).toThrow("Property 'y' must be a number");
  });

  it('rejects Infinity and NaN', () => {
    expect(() =>
      repairPathCommands([
        { type: 'M', x: Infinity, y: 100 },
        { type: 'L', x: 50, y: 200 }
      ])
    ).toThrow('must be a finite number');

    expect(() =>
      repairPathCommands([
        { type: 'M', x: 100, y: 200 },
        { type: 'L', x: 50, y: NaN }
      ])
    ).toThrow('must be a finite number');
  });

  it('accepts valid path commands without modification', () => {
    const result = repairPathCommands([
      { type: 'M', x: 100, y: 200 },
      { type: 'C', x1: 150, y1: 150, x2: 250, y2: 150, x: 300, y: 180 },
      { type: 'L', x: 280, y: 280 },
      { type: 'Z' }
    ]);

    expect(result.commands).toHaveLength(4);
    expect(result.totalFixed).toBe(0);
  });

  it('normalizes lowercase command types to uppercase', () => {
    const result = repairPathCommands([
      { type: 'm', x: 50, y: 100 },
      { type: 'l', x: 150, y: 200 }
    ]);

    expect(result.commands[0].type).toBe('M');
    expect(result.commands[1].type).toBe('L');
  });

  it('requires first command to be M', () => {
    expect(() =>
      repairPathCommands([
        { type: 'L', x: 50, y: 100 },
        { type: 'L', x: 150, y: 200 }
      ])
    ).toThrow('Path must start with M (Move) command');
  });
});

describe('Path Command — cubic bezier structure', () => {
  it('validates all six required coordinates', () => {
    const result = repairPathCommands([
      { type: 'M', x: 0, y: 0 },
      { type: 'C', x1: 180, y1: 130, x2: 150, y2: 120, x: 120, y: 125 }
    ]);

    const c = result.commands[1];
    expect(c.x1).toBe(180);
    expect(c.y1).toBe(130);
    expect(c.x2).toBe(150);
    expect(c.y2).toBe(120);
    expect(c.x).toBe(120);
    expect(c.y).toBe(125);
  });
});
