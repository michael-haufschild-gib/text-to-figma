/**
 * Tool Handlers — Styling, Effects & Transform
 *
 * Handlers for tools that modify visual properties, effects,
 * and spatial transforms on existing nodes.
 */

import { handler as setFills } from '../tools/set_fills.js';
import { handler as setCornerRadius } from '../tools/set_corner_radius.js';
import { handler as setStroke } from '../tools/set_stroke.js';
import { handler as addGradientFill } from '../tools/add_gradient_fill.js';
import { handler as setImageFill } from '../tools/set_image_fill.js';
import { handler as applyEffects } from '../tools/apply_effects.js';
import { handler as setTransform } from '../tools/set_transform.js';
import { handler as setAppearance } from '../tools/set_appearance.js';
import { handler as setTextProperties } from '../tools/set_text_properties.js';
import { handler as createColorStyle } from '../tools/create_color_style.js';
import { handler as applyFillStyle } from '../tools/apply_fill_style.js';
import { handler as createTextStyle } from '../tools/create_text_style.js';
import { handler as applyTextStyle } from '../tools/apply_text_style.js';
import { handler as createEffectStyle } from '../tools/create_effect_style.js';
import { handler as applyEffectStyle } from '../tools/apply_effect_style.js';

export const stylingHandlers = [
  setFills,
  setCornerRadius,
  setStroke,
  addGradientFill,
  setImageFill,
  applyEffects,
  setTransform,
  setAppearance,
  setTextProperties,
  createColorStyle,
  applyFillStyle,
  createTextStyle,
  applyTextStyle,
  createEffectStyle,
  applyEffectStyle
];
