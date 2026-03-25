/**
 * Figma Bridge Types & Schemas
 *
 * Shared types for the Figma WebSocket bridge communication protocol.
 * Extracted from figma-bridge.ts to keep the bridge under the line limit.
 */

import { z } from 'zod';

// ── Context ─────────────────────────────────────────────────────────────────

/**
 * Context envelope attached to every Figma plugin response.
 * Enables the MCP server to detect page/file changes without polling.
 */
export interface FigmaContext {
  pageId: string;
  pageName: string;
  fileName: string;
}

export const figmaContextSchema = z.object({
  pageId: z.string(),
  pageName: z.string(),
  fileName: z.string()
});

// ── Response ────────────────────────────────────────────────────────────────

export const responseSchema = z.object({
  id: z.string(),
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  _ctx: figmaContextSchema.optional()
});

export type FigmaResponse = z.infer<typeof responseSchema>;

// ── Notification ────────────────────────────────────────────────────────────

/** Push notification from the Figma plugin (document changes, page switches). */
export interface FigmaNotification {
  type: 'figma_notification';
  kind: string;
  data?: { _ctx?: FigmaContext; [key: string]: unknown };
}

export const notificationSchema = z.object({
  type: z.literal('figma_notification'),
  kind: z.string(),
  data: z.object({ _ctx: figmaContextSchema.optional() }).passthrough().optional()
});

// ── Request ─────────────────────────────────────────────────────────────────

export interface FigmaRequest {
  id: string;
  type: string;
  payload: unknown;
}
