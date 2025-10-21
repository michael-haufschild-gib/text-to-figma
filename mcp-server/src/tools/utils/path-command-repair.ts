/**
 * Intelligent Path Command Repair System
 *
 * This module provides advanced error detection, repair, and detailed error messages
 * for path commands. It handles common AI mistakes and provides actionable feedback.
 *
 * Core capabilities:
 * 1. Auto-fix common mistakes (type coercion, property ordering)
 * 2. Detailed error messages with examples
 * 3. Validation with repair suggestions
 * 4. Command normalization with fix reporting
 */

/**
 * Path command types
 */
export type PathCommand =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: 'Q'; x1: number; y1: number; x: number; y: number }
  | { type: 'Z' };

/**
 * Repair result with details about fixes applied
 */
export interface RepairResult {
  command: PathCommand;
  fixed: boolean;
  fixes: string[];
  warnings: string[];
}

/**
 * Validation error with helpful context
 */
export class PathCommandValidationError extends Error {
  constructor(
    message: string,
    public commandIndex: number,
    public commandType: string,
    public details: string,
    public example?: string
  ) {
    super(message);
    this.name = 'PathCommandValidationError';
  }

  toDetailedMessage(): string {
    let msg = `Command ${this.commandIndex} (type: ${this.commandType}):\n`;
    msg += `  Error: ${this.message}\n`;
    msg += `  Details: ${this.details}\n`;
    if (this.example) {
      msg += `  Example: ${this.example}\n`;
    }
    return msg;
  }
}

/**
 * Command repair result for all commands
 */
export interface CommandRepairReport {
  commands: PathCommand[];
  totalFixed: number;
  fixes: Array<{ index: number; fixes: string[] }>;
  warnings: Array<{ index: number; warnings: string[] }>;
}

/**
 * Attempts to convert a value to a number with intelligent coercion
 */
function toNumberSafe(value: any, _propName: string, _commandIndex: number): number | null {
  // Already a number
  if (typeof value === 'number') {
    if (!isFinite(value)) {
      return null; // Will be caught by validation
    }
    return value;
  }

  // String that can be converted
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;

    const parsed = parseFloat(trimmed);
    if (isFinite(parsed)) {
      return parsed;
    }
  }

  // Can't convert
  return null;
}

/**
 * Repairs and validates a Move (M) command
 */
function repairMCommand(cmd: any, index: number): RepairResult {
  const fixes: string[] = [];
  const warnings: string[] = [];

  // Type coercion
  let x = cmd.x;
  let y = cmd.y;

  if (typeof cmd.x !== 'number') {
    const converted = toNumberSafe(cmd.x, 'x', index);
    if (converted !== null) {
      x = converted;
      fixes.push(`Converted x from ${typeof cmd.x} to number: "${cmd.x}" → ${converted}`);
    } else {
      throw new PathCommandValidationError(
        `Property 'x' must be a number`,
        index,
        'M',
        `Got type ${typeof cmd.x} with value: ${JSON.stringify(cmd.x)}`,
        `{ type: "M", x: 100, y: 200 }`
      );
    }
  }

  if (typeof cmd.y !== 'number') {
    const converted = toNumberSafe(cmd.y, 'y', index);
    if (converted !== null) {
      y = converted;
      fixes.push(`Converted y from ${typeof cmd.y} to number: "${cmd.y}" → ${converted}`);
    } else {
      throw new PathCommandValidationError(
        `Property 'y' must be a number`,
        index,
        'M',
        `Got type ${typeof cmd.y} with value: ${JSON.stringify(cmd.y)}`,
        `{ type: "M", x: 100, y: 200 }`
      );
    }
  }

  // Validate finite
  if (!isFinite(x)) {
    throw new PathCommandValidationError(
      `Property 'x' must be a finite number`,
      index,
      'M',
      `Got: ${x} (${typeof x})`,
      `{ type: "M", x: 100, y: 200 }`
    );
  }

  if (!isFinite(y)) {
    throw new PathCommandValidationError(
      `Property 'y' must be a finite number`,
      index,
      'M',
      `Got: ${y} (${typeof y})`,
      `{ type: "M", x: 100, y: 200 }`
    );
  }

  return {
    command: { type: 'M', x, y },
    fixed: fixes.length > 0,
    fixes,
    warnings
  };
}

/**
 * Repairs and validates a Line (L) command
 */
function repairLCommand(cmd: any, index: number): RepairResult {
  const fixes: string[] = [];
  const warnings: string[] = [];

  let x = cmd.x;
  let y = cmd.y;

  if (typeof cmd.x !== 'number') {
    const converted = toNumberSafe(cmd.x, 'x', index);
    if (converted !== null) {
      x = converted;
      fixes.push(`Converted x from ${typeof cmd.x} to number`);
    } else {
      throw new PathCommandValidationError(
        `Property 'x' must be a number`,
        index,
        'L',
        `Got type ${typeof cmd.x} with value: ${JSON.stringify(cmd.x)}`,
        `{ type: "L", x: 150, y: 250 }`
      );
    }
  }

  if (typeof cmd.y !== 'number') {
    const converted = toNumberSafe(cmd.y, 'y', index);
    if (converted !== null) {
      y = converted;
      fixes.push(`Converted y from ${typeof cmd.y} to number`);
    } else {
      throw new PathCommandValidationError(
        `Property 'y' must be a number`,
        index,
        'L',
        `Got type ${typeof cmd.y} with value: ${JSON.stringify(cmd.y)}`,
        `{ type: "L", x: 150, y: 250 }`
      );
    }
  }

  if (!isFinite(x) || !isFinite(y)) {
    throw new PathCommandValidationError(
      `Properties 'x' and 'y' must be finite numbers`,
      index,
      'L',
      `Got x=${x}, y=${y}`,
      `{ type: "L", x: 150, y: 250 }`
    );
  }

  return {
    command: { type: 'L', x, y },
    fixed: fixes.length > 0,
    fixes,
    warnings
  };
}

/**
 * Repairs and validates a Cubic Bezier (C) command
 */
function repairCCommand(cmd: any, index: number): RepairResult {
  const fixes: string[] = [];
  const warnings: string[] = [];

  const props = ['x1', 'y1', 'x2', 'y2', 'x', 'y'];
  const values: Record<string, number> = {};

  for (const prop of props) {
    let value = cmd[prop];

    if (typeof value !== 'number') {
      const converted = toNumberSafe(value, prop, index);
      if (converted !== null) {
        value = converted;
        fixes.push(`Converted ${prop} from ${typeof cmd[prop]} to number`);
      } else {
        throw new PathCommandValidationError(
          `Property '${prop}' must be a number`,
          index,
          'C',
          `Got type ${typeof cmd[prop]} with value: ${JSON.stringify(cmd[prop])}. All 6 properties (x1, y1, x2, y2, x, y) are required.`,
          `{ type: "C", x1: 120, y1: 180, x2: 140, y2: 220, x: 160, y: 200 }`
        );
      }
    }

    if (!isFinite(value)) {
      throw new PathCommandValidationError(
        `Property '${prop}' must be a finite number`,
        index,
        'C',
        `Got: ${value}`,
        `{ type: "C", x1: 120, y1: 180, x2: 140, y2: 220, x: 160, y: 200 }`
      );
    }

    values[prop] = value;
  }

  return {
    command: {
      type: 'C',
      x1: values.x1,
      y1: values.y1,
      x2: values.x2,
      y2: values.y2,
      x: values.x,
      y: values.y
    },
    fixed: fixes.length > 0,
    fixes,
    warnings
  };
}

/**
 * Repairs and validates a Quadratic Bezier (Q) command
 */
function repairQCommand(cmd: any, index: number): RepairResult {
  const fixes: string[] = [];
  const warnings: string[] = [];

  const props = ['x1', 'y1', 'x', 'y'];
  const values: Record<string, number> = {};

  for (const prop of props) {
    let value = cmd[prop];

    if (typeof value !== 'number') {
      const converted = toNumberSafe(value, prop, index);
      if (converted !== null) {
        value = converted;
        fixes.push(`Converted ${prop} from ${typeof cmd[prop]} to number`);
      } else {
        throw new PathCommandValidationError(
          `Property '${prop}' must be a number`,
          index,
          'Q',
          `Got type ${typeof cmd[prop]} with value: ${JSON.stringify(cmd[prop])}. All 4 properties (x1, y1, x, y) are required.`,
          `{ type: "Q", x1: 180, y1: 220, x: 200, y: 250 }`
        );
      }
    }

    if (!isFinite(value)) {
      throw new PathCommandValidationError(
        `Property '${prop}' must be a finite number`,
        index,
        'Q',
        `Got: ${value}`,
        `{ type: "Q", x1: 180, y1: 220, x: 200, y: 250 }`
      );
    }

    values[prop] = value;
  }

  return {
    command: {
      type: 'Q',
      x1: values.x1,
      y1: values.y1,
      x: values.x,
      y: values.y
    },
    fixed: fixes.length > 0,
    fixes,
    warnings
  };
}

/**
 * Repairs and validates a Close (Z) command
 */
function repairZCommand(_cmd: any, _index: number): RepairResult {
  return {
    command: { type: 'Z' },
    fixed: false,
    fixes: [],
    warnings: []
  };
}

/**
 * Repairs a single path command with intelligent error handling
 */
function repairCommand(cmd: any, index: number): RepairResult {
  // Validate command is an object
  if (!cmd || typeof cmd !== 'object') {
    throw new PathCommandValidationError(
      `Command must be an object`,
      index,
      'unknown',
      `Got type ${typeof cmd} with value: ${JSON.stringify(cmd)}`,
      `{ type: "M", x: 100, y: 200 }`
    );
  }

  // Validate type property exists
  if (!cmd.type || typeof cmd.type !== 'string') {
    throw new PathCommandValidationError(
      `Command must have a 'type' property`,
      index,
      'unknown',
      `Got: ${JSON.stringify(cmd)}`,
      `{ type: "M", x: 100, y: 200 }`
    );
  }

  const type = cmd.type.toUpperCase();

  switch (type) {
    case 'M':
      return repairMCommand(cmd, index);
    case 'L':
      return repairLCommand(cmd, index);
    case 'C':
      return repairCCommand(cmd, index);
    case 'Q':
      return repairQCommand(cmd, index);
    case 'Z':
      return repairZCommand(cmd, index);
    default:
      throw new PathCommandValidationError(
        `Unknown command type '${type}'`,
        index,
        type,
        `Valid types are: M (move), L (line), C (cubic bezier), Q (quadratic bezier), Z (close)`,
        `{ type: "M", x: 100, y: 200 }`
      );
  }
}

/**
 * Repairs an array of path commands with comprehensive error handling
 */
export function repairPathCommands(commands: any[]): CommandRepairReport {
  // Validate input is array
  if (!Array.isArray(commands)) {
    throw new Error(
      `Commands must be an array, got ${typeof commands}. Example: [{ type: "M", x: 100, y: 200 }, { type: "L", x: 150, y: 250 }]`
    );
  }

  // Validate minimum length
  if (commands.length < 2) {
    throw new Error(
      `Path must have at least 2 commands (got ${commands.length}). A path needs at minimum a starting point (M command) and one other command. Example: [{ type: "M", x: 100, y: 200 }, { type: "L", x: 150, y: 250 }]`
    );
  }

  const repairedCommands: PathCommand[] = [];
  const fixes: Array<{ index: number; fixes: string[] }> = [];
  const warnings: Array<{ index: number; warnings: string[] }> = [];
  let totalFixed = 0;

  // Repair each command
  for (let i = 0; i < commands.length; i++) {
    try {
      const result = repairCommand(commands[i], i);
      repairedCommands.push(result.command);

      if (result.fixed) {
        totalFixed++;
        fixes.push({ index: i, fixes: result.fixes });
      }

      if (result.warnings.length > 0) {
        warnings.push({ index: i, warnings: result.warnings });
      }
    } catch (error) {
      if (error instanceof PathCommandValidationError) {
        throw new Error(error.toDetailedMessage());
      }
      throw error;
    }
  }

  // Validate first command is M
  if (repairedCommands[0].type !== 'M') {
    throw new Error(
      `Path must start with M (Move) command, but started with ${repairedCommands[0].type}.\n` +
        `The first command sets the starting point of the path.\n` +
        `Example: [{ type: "M", x: 100, y: 200 }, { type: "L", x: 150, y: 250 }]`
    );
  }

  return {
    commands: repairedCommands,
    totalFixed,
    fixes,
    warnings
  };
}

/**
 * Formats repair report as a human-readable message
 */
export function formatRepairReport(report: CommandRepairReport): string {
  if (report.totalFixed === 0 && report.warnings.length === 0) {
    return 'All commands validated successfully (no repairs needed)';
  }

  let message = '';

  if (report.totalFixed > 0) {
    message += `✓ Repaired ${report.totalFixed} command(s):\n`;
    for (const fix of report.fixes) {
      message += `  Command ${fix.index}:\n`;
      for (const fixMsg of fix.fixes) {
        message += `    - ${fixMsg}\n`;
      }
    }
  }

  if (report.warnings.length > 0) {
    message += `\n⚠ Warnings:\n`;
    for (const warning of report.warnings) {
      message += `  Command ${warning.index}:\n`;
      for (const warnMsg of warning.warnings) {
        message += `    - ${warnMsg}\n`;
      }
    }
  }

  return message.trim();
}
