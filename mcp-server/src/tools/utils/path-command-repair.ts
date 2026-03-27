/**
 * Intelligent Path Command Repair System
 *
 * This module provides advanced error detection, repair, and detailed error messages
 * for path commands. It handles common AI mistakes and provides actionable feedback.
 *
 * Core capabilities:
 * 1. Auto-fix common mistakes (type coercion, case normalization)
 * 2. Detailed error messages with examples
 * 3. Validation with repair suggestions
 * 4. Command normalization with fix reporting
 */

/**
 * Raw path command from LLM input — may have wrong types or missing fields.
 * This is the input to the repair system.
 */
export interface RawPathCommand {
  type?: unknown;
  x?: unknown;
  y?: unknown;
  x1?: unknown;
  y1?: unknown;
  x2?: unknown;
  y2?: unknown;
  [key: string]: unknown;
}

/**
 * Path command types
 */
export type PathCommand =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: 'Q'; x1: number; y1: number; x: number; y: number }
  | {
      type: 'A';
      rx: number;
      ry: number;
      rotation: number;
      largeArcFlag: number;
      sweepFlag: number;
      x: number;
      y: number;
    }
  | { type: 'Z' };

/**
 * Repair result with details about fixes applied
 */
export interface RepairResult {
  command: PathCommand;
  fixed: boolean;
  fixes: string[];
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
}

/**
 * Coerces a raw coordinate value to a finite number, recording fixes.
 * Throws PathCommandValidationError if the value cannot be coerced.
 */
function coerceCoord(
  value: unknown,
  prop: string,
  index: number,
  cmdType: string,
  fixes: string[]
): number {
  if (typeof value === 'number') {
    if (!isFinite(value)) {
      throw new PathCommandValidationError(
        `Property '${prop}' must be a finite number`,
        index,
        cmdType,
        `Got: ${value}`,
        `{ type: "${cmdType}", ${prop}: 100 }`
      );
    }
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      throw new PathCommandValidationError(
        `Property '${prop}' must be a number`,
        index,
        cmdType,
        `Got type string with value: ""`,
        `{ type: "${cmdType}", ${prop}: 100 }`
      );
    }

    const parsed = parseFloat(trimmed);
    if (isFinite(parsed)) {
      fixes.push(`Converted ${prop} from string to number: "${value}" -> ${parsed}`);
      return parsed;
    }
  }

  throw new PathCommandValidationError(
    `Property '${prop}' must be a number`,
    index,
    cmdType,
    `Got type ${typeof value} with value: ${JSON.stringify(value)}`,
    `{ type: "${cmdType}", ${prop}: 100 }`
  );
}

/**
 * Repairs and validates a Move (M) command
 */
function repairMCommand(cmd: RawPathCommand, index: number): RepairResult {
  const fixes: string[] = [];
  const x = coerceCoord(cmd.x, 'x', index, 'M', fixes);
  const y = coerceCoord(cmd.y, 'y', index, 'M', fixes);

  return { command: { type: 'M', x, y }, fixed: fixes.length > 0, fixes };
}

/**
 * Repairs and validates a Line (L) command
 */
function repairLCommand(cmd: RawPathCommand, index: number): RepairResult {
  const fixes: string[] = [];
  const x = coerceCoord(cmd.x, 'x', index, 'L', fixes);
  const y = coerceCoord(cmd.y, 'y', index, 'L', fixes);

  return { command: { type: 'L', x, y }, fixed: fixes.length > 0, fixes };
}

/**
 * Repairs and validates a Cubic Bezier (C) command
 */
function repairCCommand(cmd: RawPathCommand, index: number): RepairResult {
  const fixes: string[] = [];
  const x1 = coerceCoord(cmd.x1, 'x1', index, 'C', fixes);
  const y1 = coerceCoord(cmd.y1, 'y1', index, 'C', fixes);
  const x2 = coerceCoord(cmd.x2, 'x2', index, 'C', fixes);
  const y2 = coerceCoord(cmd.y2, 'y2', index, 'C', fixes);
  const x = coerceCoord(cmd.x, 'x', index, 'C', fixes);
  const y = coerceCoord(cmd.y, 'y', index, 'C', fixes);

  return {
    command: { type: 'C', x1, y1, x2, y2, x, y },
    fixed: fixes.length > 0,
    fixes
  };
}

/**
 * Repairs and validates a Quadratic Bezier (Q) command
 */
function repairQCommand(cmd: RawPathCommand, index: number): RepairResult {
  const fixes: string[] = [];
  const x1 = coerceCoord(cmd.x1, 'x1', index, 'Q', fixes);
  const y1 = coerceCoord(cmd.y1, 'y1', index, 'Q', fixes);
  const x = coerceCoord(cmd.x, 'x', index, 'Q', fixes);
  const y = coerceCoord(cmd.y, 'y', index, 'Q', fixes);

  return {
    command: { type: 'Q', x1, y1, x, y },
    fixed: fixes.length > 0,
    fixes
  };
}

/**
 * Repairs and validates an Arc (A) command
 */
function repairACommand(cmd: RawPathCommand, index: number): RepairResult {
  const fixes: string[] = [];
  const rx = coerceCoord(cmd.rx, 'rx', index, 'A', fixes);
  const ry = coerceCoord(cmd.ry, 'ry', index, 'A', fixes);
  const rotation = coerceCoord(cmd.rotation, 'rotation', index, 'A', fixes);
  const rawLargeArc = coerceCoord(cmd.largeArcFlag, 'largeArcFlag', index, 'A', fixes);
  const rawSweep = coerceCoord(cmd.sweepFlag, 'sweepFlag', index, 'A', fixes);
  const x = coerceCoord(cmd.x, 'x', index, 'A', fixes);
  const y = coerceCoord(cmd.y, 'y', index, 'A', fixes);

  // Clamp flags to 0 or 1
  const largeArcFlag = rawLargeArc === 0 ? 0 : 1;
  const sweepFlag = rawSweep === 0 ? 0 : 1;

  if (rawLargeArc !== 0 && rawLargeArc !== 1) {
    fixes.push(`Clamped largeArcFlag from ${rawLargeArc} to ${largeArcFlag}`);
  }
  if (rawSweep !== 0 && rawSweep !== 1) {
    fixes.push(`Clamped sweepFlag from ${rawSweep} to ${sweepFlag}`);
  }

  return {
    command: { type: 'A', rx, ry, rotation, largeArcFlag, sweepFlag, x, y },
    fixed: fixes.length > 0,
    fixes
  };
}

/**
 * Repairs a single path command with intelligent error handling
 */
function repairCommand(cmd: RawPathCommand, index: number): RepairResult {
  if (typeof cmd !== 'object') {
    throw new PathCommandValidationError(
      `Command must be an object`,
      index,
      'unknown',
      `Got type ${typeof cmd} with value: ${JSON.stringify(cmd)}`,
      `{ type: "M", x: 100, y: 200 }`
    );
  }

  if (typeof cmd.type !== 'string' || cmd.type === '') {
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
    case 'A':
      return repairACommand(cmd, index);
    case 'Z':
      return { command: { type: 'Z' }, fixed: false, fixes: [] };
    default:
      throw new PathCommandValidationError(
        `Unknown command type '${type}'`,
        index,
        type,
        `Valid types are: M (move), L (line), C (cubic bezier), Q (quadratic bezier), A (arc), Z (close)`,
        `{ type: "M", x: 100, y: 200 }`
      );
  }
}

/**
 * Repairs an array of path commands with comprehensive error handling
 */
export function repairPathCommands(commands: RawPathCommand[]): CommandRepairReport {
  if (!Array.isArray(commands)) {
    throw new Error(
      `Commands must be an array, got ${typeof commands}. Example: [{ type: "M", x: 100, y: 200 }, { type: "L", x: 150, y: 250 }]`
    );
  }

  if (commands.length < 2) {
    throw new Error(
      `Path must have at least 2 commands (got ${commands.length}). A path needs at minimum a starting point (M command) and one other command. Example: [{ type: "M", x: 100, y: 200 }, { type: "L", x: 150, y: 250 }]`
    );
  }

  const repairedCommands: PathCommand[] = [];
  const fixes: Array<{ index: number; fixes: string[] }> = [];
  let totalFixed = 0;

  for (let i = 0; i < commands.length; i++) {
    try {
      const cmd = commands[i];
      if (!cmd) {
        continue;
      }
      const result = repairCommand(cmd, i);
      repairedCommands.push(result.command);

      if (result.fixed) {
        totalFixed++;
        fixes.push({ index: i, fixes: result.fixes });
      }
    } catch (error) {
      if (error instanceof PathCommandValidationError) {
        throw new Error(error.toDetailedMessage());
      }
      throw error;
    }
  }

  const firstCommand = repairedCommands[0];
  if (firstCommand?.type !== 'M') {
    throw new Error(
      `Path must start with M (Move) command, but started with ${firstCommand?.type ?? 'nothing'}.\n` +
        `The first command sets the starting point of the path.\n` +
        `Example: [{ type: "M", x: 100, y: 200 }, { type: "L", x: 150, y: 250 }]`
    );
  }

  return { commands: repairedCommands, totalFixed, fixes };
}

/**
 * Formats repair report as a human-readable message
 */
export function formatRepairReport(report: CommandRepairReport): string {
  if (report.totalFixed === 0) {
    return 'All commands validated successfully (no repairs needed)';
  }

  let message = `Repaired ${report.totalFixed} command(s):\n`;
  for (const fix of report.fixes) {
    message += `  Command ${fix.index}:\n`;
    for (const fixMsg of fix.fixes) {
      message += `    - ${fixMsg}\n`;
    }
  }

  return message.trim();
}
