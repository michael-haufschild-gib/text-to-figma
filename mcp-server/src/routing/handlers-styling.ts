/**
 * Tool Handlers — Styling, Effects & Transform
 *
 * Handlers for tools that modify visual properties, effects,
 * and spatial transforms on existing nodes.
 */

import { z } from 'zod';
import { defineHandler, textResponse } from './handler-utils.js';
import type { ToolHandler } from './tool-handler.js';

import {
  setFills,
  setFillsToolDefinition,
  SetFillsInputSchema,
  type SetFillsInput,
  type SetFillsResult
} from '../tools/set_fills.js';
import {
  applyEffects,
  applyEffectsToolDefinition,
  ApplyEffectsInputSchema,
  type ApplyEffectsInput,
  type ApplyEffectsResult
} from '../tools/apply_effects.js';
import {
  setCornerRadius,
  setCornerRadiusToolDefinition,
  SetCornerRadiusInputSchema,
  type SetCornerRadiusInput,
  type SetCornerRadiusResult
} from '../tools/set_corner_radius.js';
import {
  setStroke,
  setStrokeToolDefinition,
  SetStrokeInputSchema,
  type SetStrokeInput,
  type SetStrokeResult
} from '../tools/set_stroke.js';
import {
  addGradientFill,
  addGradientFillToolDefinition,
  AddGradientFillInputSchema,
  type AddGradientFillInput,
  type AddGradientFillResult
} from '../tools/add_gradient_fill.js';
import {
  setImageFill,
  setImageFillToolDefinition,
  SetImageFillInputSchema,
  type SetImageFillInput,
  type SetImageFillResult
} from '../tools/set_image_fill.js';
import {
  setTransform,
  setTransformToolDefinition,
  SetTransformInputSchema,
  type SetTransformInput,
  type SetTransformResult
} from '../tools/set_transform.js';
import {
  setAppearance,
  setAppearanceToolDefinition,
  SetAppearanceInputSchema,
  type SetAppearanceInput,
  type SetAppearanceResult
} from '../tools/set_appearance.js';
import {
  setTextProperties,
  setTextPropertiesToolDefinition,
  SetTextPropertiesInputSchema,
  type SetTextPropertiesInput,
  type SetTextPropertiesResult
} from '../tools/set_text_properties.js';
import {
  createColorStyle,
  createColorStyleToolDefinition,
  CreateColorStyleInputSchema,
  type CreateColorStyleInput,
  type CreateColorStyleResult
} from '../tools/create_color_style.js';
import {
  applyFillStyle,
  applyFillStyleToolDefinition,
  ApplyFillStyleInputSchema,
  type ApplyFillStyleInput,
  type ApplyFillStyleResult
} from '../tools/apply_fill_style.js';
import {
  createTextStyle,
  createTextStyleToolDefinition,
  CreateTextStyleInputSchema,
  type CreateTextStyleInput,
  type CreateTextStyleResult
} from '../tools/create_text_style.js';
import {
  applyTextStyle,
  applyTextStyleToolDefinition,
  ApplyTextStyleInputSchema,
  type ApplyTextStyleInput,
  type ApplyTextStyleResult
} from '../tools/apply_text_style.js';
import {
  createEffectStyle,
  createEffectStyleToolDefinition,
  CreateEffectStyleInputSchema,
  type CreateEffectStyleInput,
  type CreateEffectStyleResult
} from '../tools/create_effect_style.js';
import {
  applyEffectStyle,
  applyEffectStyleToolDefinition,
  ApplyEffectStyleInputSchema,
  type ApplyEffectStyleInput,
  type ApplyEffectStyleResult
} from '../tools/apply_effect_style.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous handler list
export const stylingHandlers: ToolHandler<any, any>[] = [
  // ─── Fills & Stroke ─────────────────────────────────────────────────────
  defineHandler<SetFillsInput, SetFillsResult>({
    name: 'set_fills',
    schema: SetFillsInputSchema as z.ZodSchema<SetFillsInput>,
    execute: (input) => setFills(input),
    formatResponse: (r) =>
      textResponse(
        `Fills Applied Successfully\nNode ID: ${r.nodeId}\nApplied Color: ${r.appliedColor}\n\nCSS Equivalent:\n  ${r.cssEquivalent}\n`
      ),
    definition: setFillsToolDefinition
  }),

  defineHandler<SetCornerRadiusInput, SetCornerRadiusResult>({
    name: 'set_corner_radius',
    schema: SetCornerRadiusInputSchema as z.ZodSchema<SetCornerRadiusInput>,
    execute: setCornerRadius,
    formatResponse: (r) =>
      textResponse(
        `${r.message}\nNode ID: ${r.nodeId}\nIs Uniform: ${r.isUniform}\n\nCSS Equivalent:\n${r.cssEquivalent}\n`
      ),
    definition: setCornerRadiusToolDefinition
  }),

  defineHandler<SetStrokeInput, SetStrokeResult>({
    name: 'set_stroke',
    schema: SetStrokeInputSchema as z.ZodSchema<SetStrokeInput>,
    execute: setStroke,
    formatResponse: (r) =>
      textResponse(
        `${r.message}\nNode ID: ${r.nodeId}\nStroke Weight: ${r.strokeWeight}px\nAlignment: ${r.strokeAlign}\n\nCSS Equivalent:\n${r.cssEquivalent}\n`
      ),
    definition: setStrokeToolDefinition
  }),

  defineHandler<AddGradientFillInput, AddGradientFillResult>({
    name: 'add_gradient_fill',
    schema: AddGradientFillInputSchema as z.ZodSchema<AddGradientFillInput>,
    execute: addGradientFill,
    formatResponse: (r) =>
      textResponse(
        `${r.message}\nNode ID: ${r.nodeId}\nType: ${r.type}\nStops: ${r.stopCount}\n\nCSS Equivalent:\n${r.cssEquivalent}\n`
      ),
    definition: addGradientFillToolDefinition
  }),

  defineHandler<SetImageFillInput, SetImageFillResult>({
    name: 'set_image_fill',
    schema: SetImageFillInputSchema as z.ZodSchema<SetImageFillInput>,
    execute: setImageFill,
    formatResponse: (r) =>
      textResponse(
        `Image Fill Applied Successfully\nNode ID: ${r.nodeId}\nImage URL: ${r.imageUrl}\nScale Mode: ${r.scaleMode}\nOpacity: ${r.opacity}\n\nCSS Equivalent:\n${r.cssEquivalent}\n`
      ),
    definition: setImageFillToolDefinition
  }),

  // ─── Effects ────────────────────────────────────────────────────────────
  defineHandler<ApplyEffectsInput, ApplyEffectsResult>({
    name: 'apply_effects',
    schema: ApplyEffectsInputSchema as z.ZodSchema<ApplyEffectsInput>,
    execute: applyEffects,
    formatResponse: (r) =>
      textResponse(
        `Effects Applied Successfully\nNode ID: ${r.nodeId}\nEffects Applied: ${r.effectsApplied}\n\nCSS Equivalent:\n  ${r.cssEquivalent}\n`
      ),
    definition: applyEffectsToolDefinition
  }),

  // ─── Transform & Appearance ─────────────────────────────────────────────
  defineHandler<SetTransformInput, SetTransformResult>({
    name: 'set_transform',
    schema: SetTransformInputSchema as z.ZodSchema<SetTransformInput>,
    execute: setTransform,
    formatResponse: (r) =>
      textResponse(
        `${r.message}\nNode ID: ${r.nodeId}\nApplied: ${r.applied.join(', ')}\n\nCSS Equivalent:\n${r.cssEquivalent}\n`
      ),
    definition: setTransformToolDefinition
  }),

  defineHandler<SetAppearanceInput, SetAppearanceResult>({
    name: 'set_appearance',
    schema: SetAppearanceInputSchema as z.ZodSchema<SetAppearanceInput>,
    execute: setAppearance,
    formatResponse: (r) =>
      textResponse(
        `${r.message}\nNode ID: ${r.nodeId}\nApplied: ${r.applied.join(', ')}\n\nCSS Equivalent:\n${r.cssEquivalent}\n`
      ),
    definition: setAppearanceToolDefinition
  }),

  // ─── Text Properties ────────────────────────────────────────────────────
  defineHandler<SetTextPropertiesInput, SetTextPropertiesResult>({
    name: 'set_text_properties',
    schema: SetTextPropertiesInputSchema as z.ZodSchema<SetTextPropertiesInput>,
    execute: setTextProperties,
    formatResponse: (r) =>
      textResponse(
        `${r.message}\nNode ID: ${r.nodeId}\nApplied: ${r.applied.join(', ')}\n\nCSS Equivalent:\n${r.cssEquivalent}\n`
      ),
    definition: setTextPropertiesToolDefinition
  }),

  // ─── Named Styles ──────────────────────────────────────────────────────
  defineHandler<CreateColorStyleInput, CreateColorStyleResult>({
    name: 'create_color_style',
    schema: CreateColorStyleInputSchema as z.ZodSchema<CreateColorStyleInput>,
    execute: createColorStyle,
    formatResponse: (r) =>
      textResponse(`${r.message}\nStyle ID: ${r.styleId}\nName: ${r.name}\nColor: ${r.color}\n`),
    definition: createColorStyleToolDefinition
  }),

  defineHandler<ApplyFillStyleInput, ApplyFillStyleResult>({
    name: 'apply_fill_style',
    schema: ApplyFillStyleInputSchema as z.ZodSchema<ApplyFillStyleInput>,
    execute: applyFillStyle,
    formatResponse: (r) =>
      textResponse(`${r.message}\nNode ID: ${r.nodeId}\nStyle: ${r.styleName}\n`),
    definition: applyFillStyleToolDefinition
  }),

  defineHandler<CreateTextStyleInput, CreateTextStyleResult>({
    name: 'create_text_style',
    schema: CreateTextStyleInputSchema as z.ZodSchema<CreateTextStyleInput>,
    execute: createTextStyle,
    formatResponse: (r) =>
      textResponse(
        `${r.message}\nStyle ID: ${r.styleId}\nName: ${r.name}\nFont: ${r.fontSize}px, weight ${r.fontWeight}\n`
      ),
    definition: createTextStyleToolDefinition
  }),

  defineHandler<ApplyTextStyleInput, ApplyTextStyleResult>({
    name: 'apply_text_style',
    schema: ApplyTextStyleInputSchema as z.ZodSchema<ApplyTextStyleInput>,
    execute: applyTextStyle,
    formatResponse: (r) =>
      textResponse(`${r.message}\nNode ID: ${r.nodeId}\nStyle: ${r.styleName}\n`),
    definition: applyTextStyleToolDefinition
  }),

  defineHandler<CreateEffectStyleInput, CreateEffectStyleResult>({
    name: 'create_effect_style',
    schema: CreateEffectStyleInputSchema as z.ZodSchema<CreateEffectStyleInput>,
    execute: createEffectStyle,
    formatResponse: (r) =>
      textResponse(
        `${r.message}\nStyle ID: ${r.styleId}\nName: ${r.name}\nEffects: ${r.effectCount}\n`
      ),
    definition: createEffectStyleToolDefinition
  }),

  defineHandler<ApplyEffectStyleInput, ApplyEffectStyleResult>({
    name: 'apply_effect_style',
    schema: ApplyEffectStyleInputSchema as z.ZodSchema<ApplyEffectStyleInput>,
    execute: applyEffectStyle,
    formatResponse: (r) =>
      textResponse(`${r.message}\nNode ID: ${r.nodeId}\nStyle: ${r.styleName}\n`),
    definition: applyEffectStyleToolDefinition
  })
];
