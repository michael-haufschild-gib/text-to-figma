/**
 * Path Command Repair — Advanced Coercion, Formatting & Real-World Tests
 *
 * Tests coercion edge cases, formatRepairReport, error message quality,
 * and complex real-world scenarios.
 */

import { describe, expect, it } from 'vitest';
import {
  formatRepairReport,
  repairPathCommands
} from '../../mcp-server/src/tools/utils/path-command-repair.js';

describe('Path Command Repair — advanced', () => {
  describe('Coercion edge cases', () => {
    it('should reject empty string coordinates', () => {
      expect(() => {
        repairPathCommands([
          { type: 'M', x: '', y: 200 },
          { type: 'L', x: 150, y: 250 }
        ]);
      }).toThrow("Property 'x' must be a number");
    });

    it('should reject whitespace-only string coordinates', () => {
      expect(() => {
        repairPathCommands([
          { type: 'M', x: '   ', y: 200 },
          { type: 'L', x: 150, y: 250 }
        ]);
      }).toThrow("Property 'x' must be a number");
    });

    it('should trim whitespace from string numbers before parsing', () => {
      const result = repairPathCommands([
        { type: 'M', x: ' 100 ', y: ' 200 ' },
        { type: 'L', x: 150, y: 250 }
      ]);
      expect(result.commands[0].x).toBe(100);
      expect(result.commands[0].y).toBe(200);
      expect(result.totalFixed).toBe(1);
    });

    it('should reject -Infinity coordinates', () => {
      expect(() => {
        repairPathCommands([
          { type: 'M', x: -Infinity, y: 200 },
          { type: 'L', x: 150, y: 250 }
        ]);
      }).toThrow("Property 'x' must be a finite number");
    });

    it('should reject boolean coordinates', () => {
      expect(() => {
        repairPathCommands([
          { type: 'M', x: true, y: 200 },
          { type: 'L', x: 150, y: 250 }
        ]);
      }).toThrow("Property 'x' must be a number");
    });

    it('should reject array coordinates', () => {
      expect(() => {
        repairPathCommands([
          { type: 'M', x: [100], y: 200 },
          { type: 'L', x: 150, y: 250 }
        ]);
      }).toThrow("Property 'x' must be a number");
    });

    it('should handle type property as number (not a string)', () => {
      expect(() => {
        repairPathCommands([{ type: 'M', x: 100, y: 200 }, { type: 42, x: 150, y: 250 } as never]);
      }).toThrow("Command must have a 'type' property");
    });

    it('should preserve distinct coordinates in C command (no swaps)', () => {
      const result = repairPathCommands([
        { type: 'M', x: 0, y: 0 },
        { type: 'C', x1: 10, y1: 20, x2: 30, y2: 40, x: 50, y: 60 }
      ]);
      const c = result.commands[1] as {
        type: 'C';
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        x: number;
        y: number;
      };
      expect(c.x1).toBe(10);
      expect(c.y1).toBe(20);
      expect(c.x2).toBe(30);
      expect(c.y2).toBe(40);
      expect(c.x).toBe(50);
      expect(c.y).toBe(60);
    });

    it('should preserve distinct coordinates in Q command (no swaps)', () => {
      const result = repairPathCommands([
        { type: 'M', x: 0, y: 0 },
        { type: 'Q', x1: 10, y1: 20, x: 30, y: 40 }
      ]);
      const q = result.commands[1] as { type: 'Q'; x1: number; y1: number; x: number; y: number };
      expect(q.x1).toBe(10);
      expect(q.y1).toBe(20);
      expect(q.x).toBe(30);
      expect(q.y).toBe(40);
    });

    it('should coerce string coordinates in C command with distinct values', () => {
      const result = repairPathCommands([
        { type: 'M', x: 0, y: 0 },
        { type: 'C', x1: '11', y1: '22', x2: '33', y2: '44', x: '55', y: '66' }
      ]);
      const c = result.commands[1] as {
        type: 'C';
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        x: number;
        y: number;
      };
      expect(c.x1).toBe(11);
      expect(c.y1).toBe(22);
      expect(c.x2).toBe(33);
      expect(c.y2).toBe(44);
      expect(c.x).toBe(55);
      expect(c.y).toBe(66);
    });
  });

  describe('formatRepairReport', () => {
    it('should format report with multiple fixed commands', () => {
      const result = repairPathCommands([
        { type: 'M', x: '100', y: '200' },
        { type: 'L', x: '150', y: '250' },
        { type: 'L', x: 300, y: 400 }
      ]);

      expect(result.totalFixed).toBe(2);
      const formatted = formatRepairReport(result);
      expect(formatted).toContain('Repaired 2 command(s)');
      expect(formatted).toContain('Command 0:');
      expect(formatted).toContain('Command 1:');
      expect(formatted).not.toContain('Command 2:');
    });

    it('should not include repair section when totalFixed is 0', () => {
      const result = repairPathCommands([
        { type: 'M', x: 100, y: 200 },
        { type: 'L', x: 150, y: 250 }
      ]);

      const formatted = formatRepairReport(result);
      expect(formatted).toBe('All commands validated successfully (no repairs needed)');
      expect(formatted).not.toContain('Repaired');
    });

    it('formatted output has no trailing whitespace', () => {
      const result = repairPathCommands([
        { type: 'M', x: '100', y: '200' },
        { type: 'L', x: 150, y: 250 }
      ]);

      const formatted = formatRepairReport(result);
      expect(formatted).toBe(formatted.trim());
      expect(formatted.endsWith('\n')).toBe(false);
    });

    it('Z command produces empty fixes array', () => {
      const result = repairPathCommands([
        { type: 'M', x: 0, y: 0 },
        { type: 'L', x: 100, y: 100 },
        { type: 'Z' }
      ]);

      expect(result.totalFixed).toBe(0);
      expect(result.fixes).toHaveLength(0);
    });
  });

  describe('Error message quality', () => {
    it('error includes command index in message', () => {
      try {
        repairPathCommands([
          { type: 'M', x: 100, y: 200 },
          { type: 'L', x: 100, y: 200 },
          { type: 'L', x: 'bad', y: 250 }
        ]);
        expect.fail('Should have thrown');
      } catch (e) {
        const msg = (e as Error).message;
        expect(msg).toContain('Command 2');
        expect(msg).toContain('type: L');
      }
    });

    it('error includes example for unknown command type', () => {
      try {
        repairPathCommands([{ type: 'M', x: 0, y: 0 }, { type: 'A', x: 100, y: 100 } as never]);
        expect.fail('Should have thrown');
      } catch (e) {
        const msg = (e as Error).message;
        expect(msg).toContain('Example:');
      }
    });
  });

  describe('Complex Real-World Scenarios', () => {
    it('should handle butterfly wing path with mixed issues', () => {
      const commands = [
        { type: 'm', x: '400', y: 300 },
        { type: 'C', x1: '370', y1: 280, x2: '340', y2: 260, x: 310, y: 250 },
        { type: 'c', x1: 270, y1: '235', x2: '230', y2: '240', x: 200, y: 260 },
        { type: 'Z' }
      ];

      const result = repairPathCommands(commands);

      expect(result.commands).toHaveLength(4);
      expect(result.totalFixed).toBeGreaterThan(0);
      expect(result.commands[0]).toEqual({ type: 'M', x: 400, y: 300 });
      expect(result.commands[3]).toEqual({ type: 'Z' });
    });

    it('should handle quadratic bezier with all string numbers', () => {
      const commands = [
        { type: 'M', x: '100', y: '200' },
        { type: 'Q', x1: '180', y1: '220', x: '200', y: '250' }
      ];

      const result = repairPathCommands(commands);

      expect(result.commands[1]).toEqual({
        type: 'Q',
        x1: 180,
        y1: 220,
        x: 200,
        y: 250
      });
      expect(result.totalFixed).toBe(2);
    });
  });
});
