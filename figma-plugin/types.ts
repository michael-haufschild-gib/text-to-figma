/**
 * Shared type definitions for Figma plugin message contracts
 * Zero 'any' types - strict type safety enforced
 */

// Base command types
export type CommandType = 'create_frame' | 'create_text';

// Command payload interfaces
export interface CreateFramePayload {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly name?: string;
  readonly fillColor?: { r: number; g: number; b: number };
}

export interface CreateTextPayload {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly fontSize?: number;
  readonly fontName?: { family: string; style: string };
}

// Discriminated union for commands
export interface CreateFrameCommand {
  readonly type: 'create_frame';
  readonly payload: CreateFramePayload;
}

export interface CreateTextCommand {
  readonly type: 'create_text';
  readonly payload: CreateTextPayload;
}

export type FigmaCommand = CreateFrameCommand | CreateTextCommand;

// WebSocket message types
export interface WebSocketMessage {
  readonly type: CommandType;
  readonly payload: CreateFramePayload | CreateTextPayload;
}

// Response types
export interface SuccessResponse {
  readonly status: 'success';
  readonly message: string;
  readonly nodeId?: string;
}

export interface ErrorResponse {
  readonly status: 'error';
  readonly message: string;
  readonly error?: string;
}

export type PluginResponse = SuccessResponse | ErrorResponse;

// UI to Plugin messages
export interface UIToPluginMessage {
  readonly pluginMessage: FigmaCommand;
}

// Plugin to UI messages
export interface PluginToUIMessage {
  readonly type: 'response';
  readonly data: PluginResponse;
}

// Type guards for runtime validation
export function isCreateFrameCommand(cmd: FigmaCommand): cmd is CreateFrameCommand {
  return cmd.type === 'create_frame';
}

export function isCreateTextCommand(cmd: FigmaCommand): cmd is CreateTextCommand {
  return cmd.type === 'create_text';
}

export function isSuccessResponse(response: PluginResponse): response is SuccessResponse {
  return response.status === 'success';
}

export function isErrorResponse(response: PluginResponse): response is ErrorResponse {
  return response.status === 'error';
}

// Validation helpers
export function validateCreateFramePayload(payload: unknown): payload is CreateFramePayload {
  if (!payload || typeof payload !== 'object') return false;

  const p = payload as Record<string, unknown>;

  return (
    typeof p.x === 'number' &&
    typeof p.y === 'number' &&
    typeof p.width === 'number' &&
    typeof p.height === 'number' &&
    (p.name === undefined || typeof p.name === 'string') &&
    (p.fillColor === undefined || (
      typeof p.fillColor === 'object' &&
      p.fillColor !== null &&
      typeof (p.fillColor as Record<string, unknown>).r === 'number' &&
      typeof (p.fillColor as Record<string, unknown>).g === 'number' &&
      typeof (p.fillColor as Record<string, unknown>).b === 'number'
    ))
  );
}

export function validateCreateTextPayload(payload: unknown): payload is CreateTextPayload {
  if (!payload || typeof payload !== 'object') return false;

  const p = payload as Record<string, unknown>;

  return (
    typeof p.x === 'number' &&
    typeof p.y === 'number' &&
    typeof p.text === 'string' &&
    (p.fontSize === undefined || typeof p.fontSize === 'number') &&
    (p.fontName === undefined || (
      typeof p.fontName === 'object' &&
      p.fontName !== null &&
      typeof (p.fontName as Record<string, unknown>).family === 'string' &&
      typeof (p.fontName as Record<string, unknown>).style === 'string'
    ))
  );
}
