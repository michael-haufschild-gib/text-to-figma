/**
 * Path Command Repair — Core Validation & Auto-Fix Tests
 *
 * Tests valid command passthrough, type coercion, case normalization,
 * error detection, and basic edge cases.
 */

import { describe, expect, it } from 'vitest';
import {
  formatRepairReport,
  repairPathCommands
} from '../../mcp-server/src/tools/utils/path-command-repair.js';

describe('Path Command Repair — core validation', () => {
  describe('Valid Commands', () => {
    it('should pass through valid commands without modification', () => {
      const commands = [
        { type: 'M', x: 100, y: 200 },
        { type: 'L', x: 150, y: 250 },
        { type: 'C', x1: 120, y1: 180, x2: 140, y2: 220, x: 160, y: 200 },
        { type: 'Q', x1: 180, y1: 220, x: 200, y: 250 },
        { type: 'Z' }
      ];

      const result = repairPathCommands(commands);

      expect(result.commands).toHaveLength(5);
      expect(result.totalFixed).toBe(0);
      expect(result.fixes).toHaveLength(0);
      expect(result.commands[0]).toEqual({ type: 'M', x: 100, y: 200 });
      expect(result.commands[4]).toEqual({ type: 'Z' });
    });

    it('should handle minimal valid path (M + L)', () => {
      const commands = [
        { type: 'M', x: 0, y: 0 },
        { type: 'L', x: 100, y: 100 }
      ];

      const result = repairPathCommands(commands);

      expect(result.commands).toHaveLength(2);
      expect(result.totalFixed).toBe(0);
    });
  });

  describe('Auto-Fix: Type Coercion', () => {
    it('should convert string numbers to numbers', () => {
      const commands = [
        { type: 'M', x: '100', y: '200' },
        { type: 'L', x: '150', y: '250' }
      ];

      const result = repairPathCommands(commands);

      expect(result.commands[0]).toEqual({ type: 'M', x: 100, y: 200 });
      expect(result.commands[1]).toEqual({ type: 'L', x: 150, y: 250 });
      expect(result.totalFixed).toBe(2);
      expect(result.fixes).toHaveLength(2);
    });

    it('should handle string numbers in cubic bezier', () => {
      const commands = [
        { type: 'M', x: 100, y: 200 },
        { type: 'C', x1: '120', y1: '180', x2: '140', y2: '220', x: '160', y: '200' }
      ];

      const result = repairPathCommands(commands);

      expect(result.commands[1]).toEqual({
        type: 'C',
        x1: 120,
        y1: 180,
        x2: 140,
        y2: 220,
        x: 160,
        y: 200
      });
      expect(result.totalFixed).toBe(1);
    });

    it('should handle mixed valid and string numbers', () => {
      const commands = [
        { type: 'M', x: 100, y: '200' },
        { type: 'L', x: '150', y: 250 }
      ];

      const result = repairPathCommands(commands);

      expect(result.totalFixed).toBe(2);
      expect(result.fixes[0].fixes).toEqual(
        expect.arrayContaining([expect.stringMatching(/Converted y from string to number/)])
      );
      expect(result.fixes[1].fixes).toEqual(
        expect.arrayContaining([expect.stringMatching(/Converted x from string to number/)])
      );
    });
  });

  describe('Auto-Fix: Case Normalization', () => {
    it('should handle lowercase command types', () => {
      const commands = [
        { type: 'm', x: 100, y: 200 },
        { type: 'l', x: 150, y: 250 }
      ];

      const result = repairPathCommands(commands);

      expect(result.commands[0].type).toBe('M');
      expect(result.commands[1].type).toBe('L');
    });

    it('should handle mixed case command types', () => {
      const commands = [
        { type: 'M', x: 100, y: 200 },
        { type: 'c', x1: 120, y1: 180, x2: 140, y2: 220, x: 160, y: 200 },
        { type: 'Z' }
      ];

      const result = repairPathCommands(commands);

      expect(result.commands[1].type).toBe('C');
    });
  });

  describe('Error Detection: Invalid Structure', () => {
    it('should reject non-array input', () => {
      expect(() => {
        repairPathCommands('not an array' as never);
      }).toThrow('Commands must be an array');
    });

    it('should reject empty array', () => {
      expect(() => {
        repairPathCommands([]);
      }).toThrow('Path must have at least 2 commands');
    });

    it('should reject array with only 1 command', () => {
      expect(() => {
        repairPathCommands([{ type: 'M', x: 100, y: 200 }]);
      }).toThrow('Path must have at least 2 commands');
    });

    it('should reject path not starting with M', () => {
      expect(() => {
        repairPathCommands([
          { type: 'L', x: 100, y: 200 },
          { type: 'L', x: 150, y: 250 }
        ]);
      }).toThrow('Path must start with M (Move) command');
    });

    it('should reject non-object commands', () => {
      expect(() => {
        repairPathCommands([{ type: 'M', x: 100, y: 200 }, 'invalid' as never]);
      }).toThrow('Command must be an object');
    });

    it('should reject commands without type property', () => {
      expect(() => {
        repairPathCommands([{ type: 'M', x: 100, y: 200 }, { x: 150, y: 250 } as never]);
      }).toThrow("Command must have a 'type' property");
    });
  });

  describe('Error Detection: Missing Properties', () => {
    it('should reject M command with missing x', () => {
      expect(() => {
        repairPathCommands([{ type: 'M', y: 200 } as never, { type: 'L', x: 150, y: 250 }]);
      }).toThrow("Property 'x' must be a number");
    });

    it('should reject C command with missing control points', () => {
      expect(() => {
        repairPathCommands([
          { type: 'M', x: 100, y: 200 },
          { type: 'C', x1: 120, y1: 180, x: 160, y: 200 } as never
        ]);
      }).toThrow("Property 'x2' must be a number");
    });

    it('should reject Q command with missing control point', () => {
      expect(() => {
        repairPathCommands([
          { type: 'M', x: 100, y: 200 },
          { type: 'Q', x1: 180, x: 200, y: 250 } as never
        ]);
      }).toThrow("Property 'y1' must be a number");
    });
  });

  describe('Error Detection: Invalid Values', () => {
    it('should reject NaN values', () => {
      expect(() => {
        repairPathCommands([
          { type: 'M', x: NaN, y: 200 },
          { type: 'L', x: 150, y: 250 }
        ]);
      }).toThrow("Property 'x' must be a finite number");
    });

    it('should reject Infinity values', () => {
      expect(() => {
        repairPathCommands([
          { type: 'M', x: 100, y: 200 },
          { type: 'L', x: Infinity, y: 250 }
        ]);
      }).toThrow("Property 'x' must be a finite number");
    });

    it('should reject unconvertible strings', () => {
      expect(() => {
        repairPathCommands([
          { type: 'M', x: 'abc', y: 200 },
          { type: 'L', x: 150, y: 250 }
        ]);
      }).toThrow("Property 'x' must be a number");
    });

    it('should reject null values', () => {
      expect(() => {
        repairPathCommands([
          { type: 'M', x: null, y: 200 },
          { type: 'L', x: 150, y: 250 }
        ]);
      }).toThrow("Property 'x' must be a number");
    });

    it('should reject undefined values', () => {
      expect(() => {
        repairPathCommands([
          { type: 'M', x: 100, y: 200 },
          { type: 'L', x: undefined, y: 250 }
        ]);
      }).toThrow("Property 'x' must be a number");
    });
  });

  describe('Error Detection: Unknown Commands', () => {
    it('should reject unknown command types', () => {
      expect(() => {
        repairPathCommands([{ type: 'M', x: 100, y: 200 }, { type: 'X', x: 150, y: 250 } as never]);
      }).toThrow("Unknown command type 'X'");
    });
  });

  describe('Error Messages', () => {
    it('should provide detailed error with command index', () => {
      expect(() =>
        repairPathCommands([
          { type: 'M', x: 100, y: 200 },
          { type: 'L', x: 'invalid', y: 250 }
        ])
      ).toThrow(/Command 1.*type: L/s);
    });

    it('should provide examples in error messages', () => {
      expect(() =>
        repairPathCommands([
          { type: 'M', x: 100, y: 200 },
          { type: 'C', x1: 120, y1: 180 } as never
        ])
      ).toThrow(/Example:.*\{ type: "C"/s);
    });
  });
});

describe('Path Command Repair — reports & edge cases', () => {
  describe('Repair Report Formatting', () => {
    it('should format repair report for valid commands', () => {
      const result = repairPathCommands([
        { type: 'M', x: 100, y: 200 },
        { type: 'L', x: 150, y: 250 }
      ]);

      const formatted = formatRepairReport(result);
      expect(formatted).toBe('All commands validated successfully (no repairs needed)');
    });

    it('should format repair report with fixes', () => {
      const result = repairPathCommands([
        { type: 'M', x: '100', y: '200' },
        { type: 'L', x: 150, y: 250 }
      ]);

      const formatted = formatRepairReport(result);
      expect(formatted).toContain('Repaired 1 command(s)');
      expect(formatted).toContain('Command 0:');
      expect(formatted).toContain('Converted');
    });
  });

  describe('Edge Cases', () => {
    it('should handle large path with many commands', () => {
      const commands: Array<Record<string, unknown>> = [{ type: 'M', x: 0, y: 0 }];
      for (let i = 1; i <= 50; i++) {
        commands.push({ type: 'L', x: i * 10, y: i * 5 });
      }
      commands.push({ type: 'Z' });

      const result = repairPathCommands(commands);
      expect(result.commands).toHaveLength(52);
      expect(result.totalFixed).toBe(0);
    });

    it('should handle negative coordinates (valid for positioning)', () => {
      const result = repairPathCommands([
        { type: 'M', x: -100, y: -200 },
        { type: 'L', x: -50, y: -100 }
      ]);
      expect(result.commands[0].x).toBe(-100);
      expect(result.commands[0].y).toBe(-200);
      expect(result.totalFixed).toBe(0);
    });

    it('should handle zero coordinates', () => {
      const result = repairPathCommands([
        { type: 'M', x: 0, y: 0 },
        { type: 'L', x: 0, y: 0 }
      ]);
      expect(result.totalFixed).toBe(0);
    });

    it('should handle very large coordinates', () => {
      const result = repairPathCommands([
        { type: 'M', x: 99999, y: 99999 },
        { type: 'L', x: 100000, y: 100000 }
      ]);
      expect(result.totalFixed).toBe(0);
    });

    it('should handle fractional coordinates', () => {
      const result = repairPathCommands([
        { type: 'M', x: 100.5, y: 200.3 },
        { type: 'L', x: 150.7, y: 250.9 }
      ]);
      expect(result.commands[0].x).toBeCloseTo(100.5);
      expect(result.totalFixed).toBe(0);
    });

    it('should handle multiple M (moveto) commands', () => {
      const result = repairPathCommands([
        { type: 'M', x: 0, y: 0 },
        { type: 'L', x: 100, y: 100 },
        { type: 'M', x: 200, y: 200 },
        { type: 'L', x: 300, y: 300 }
      ]);
      expect(result.commands).toHaveLength(4);
      expect(result.totalFixed).toBe(0);
    });

    it('should convert string numbers in Q command control points', () => {
      const result = repairPathCommands([
        { type: 'M', x: 0, y: 0 },
        { type: 'Q', x1: '50', y1: '50', x: '100', y: '100' }
      ]);
      expect(result.commands[1].x1).toBe(50);
      expect(result.commands[1].y1).toBe(50);
      expect(result.commands[1].x).toBe(100);
      expect(result.commands[1].y).toBe(100);
      expect(result.totalFixed).toBe(1);
    });
  });
});
