/**
 * Tests for Intelligent Path Command Repair System
 *
 * Tests auto-fix capabilities, error messages, and validation
 */

import { describe, expect, it } from 'vitest';
import {
    formatRepairReport,
    repairPathCommands
} from '../../../mcp-server/src/tools/utils/path-command-repair.js';

describe('Path Command Repair System', () => {
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
      expect(result.fixes[0].fixes).toContain(
        expect.stringMatching(/Converted y from string to number/)
      );
      expect(result.fixes[1].fixes).toContain(
        expect.stringMatching(/Converted x from string to number/)
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
        repairPathCommands('not an array' as any);
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
        repairPathCommands([{ type: 'M', x: 100, y: 200 }, 'invalid' as any]);
      }).toThrow('Command must be an object');
    });

    it('should reject commands without type property', () => {
      expect(() => {
        repairPathCommands([{ type: 'M', x: 100, y: 200 }, { x: 150, y: 250 } as any]);
      }).toThrow("Command must have a 'type' property");
    });
  });

  describe('Error Detection: Missing Properties', () => {
    it('should reject M command with missing x', () => {
      expect(() => {
        repairPathCommands([{ type: 'M', y: 200 } as any, { type: 'L', x: 150, y: 250 }]);
      }).toThrow("Property 'x' must be a number");
    });

    it('should reject C command with missing control points', () => {
      expect(() => {
        repairPathCommands([
          { type: 'M', x: 100, y: 200 },
          { type: 'C', x1: 120, y1: 180, x: 160, y: 200 } as any
        ]);
      }).toThrow("Property 'x2' must be a number");
    });

    it('should reject Q command with missing control point', () => {
      expect(() => {
        repairPathCommands([
          { type: 'M', x: 100, y: 200 },
          { type: 'Q', x1: 180, x: 200, y: 250 } as any
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
        repairPathCommands([
          { type: 'M', x: 100, y: 200 },
          { type: 'X', x: 150, y: 250 } as any
        ]);
      }).toThrow("Unknown command type 'X'");
    });
  });

  describe('Error Messages', () => {
    it('should provide detailed error with command index', () => {
      try {
        repairPathCommands([
          { type: 'M', x: 100, y: 200 },
          { type: 'L', x: 'invalid', y: 250 }
        ]);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Command 1');
        expect(error.message).toContain('type: L');
      }
    });

    it('should provide examples in error messages', () => {
      try {
        repairPathCommands([
          { type: 'M', x: 100, y: 200 },
          { type: 'C', x1: 120, y1: 180 } as any
        ]);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Example:');
        expect(error.message).toContain('{ type: "C"');
      }
    });
  });

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
