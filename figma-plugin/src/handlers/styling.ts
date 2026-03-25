/**
 * Styling Command Handlers
 *
 * Handles: set_fills, set_corner_radius, set_stroke, set_appearance,
 * set_opacity, set_blend_mode, apply_effects, add_gradient_fill, set_image_fill
 */

import { z } from 'zod';
import { convertEffects, getNode, hexToRgb } from '../helpers.js';

// ── Return types ─────────────────────────────────────────────────────────────

interface OperationResult {
  nodeId: string;
  message: string;
  [key: string]: unknown;
}

const STROKE_ALIGNS = ['INSIDE', 'OUTSIDE', 'CENTER'] as const;
const SCALE_MODES = ['FILL', 'FIT', 'CROP', 'TILE'] as const;
const BLEND_MODES = [
  'PASS_THROUGH',
  'NORMAL',
  'DARKEN',
  'MULTIPLY',
  'LINEAR_BURN',
  'COLOR_BURN',
  'LIGHTEN',
  'SCREEN',
  'LINEAR_DODGE',
  'COLOR_DODGE',
  'OVERLAY',
  'SOFT_LIGHT',
  'HARD_LIGHT',
  'DIFFERENCE',
  'EXCLUSION',
  'HUE',
  'SATURATION',
  'COLOR',
  'LUMINOSITY'
] as const;

const setFillsSchema = z.object({
  nodeId: z.string(),
  color: z.string().optional(),
  fills: z.array(z.record(z.string(), z.unknown())).optional(),
  opacity: z.number().optional()
});

export function handleSetFills(payload: Record<string, unknown>): OperationResult {
  const input = setFillsSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node || !('fills' in node)) throw new Error('Node not found or does not support fills');

  if (input.color !== undefined) {
    const rgb = hexToRgb(input.color);
    const opacity = input.opacity ?? 1;
    (node as GeometryMixin).fills = [{ type: 'SOLID', color: rgb, opacity }];
  } else if (input.fills !== undefined) {
    (node as GeometryMixin).fills = input.fills as unknown as Paint[];
  } else {
    throw new Error('Either color (hex string) or fills (array) must be provided');
  }

  return { nodeId: input.nodeId, message: 'Fills applied successfully' };
}

const setCornerRadiusSchema = z.object({
  nodeId: z.string(),
  radius: z.number().optional(),
  topLeft: z.number().optional(),
  topRight: z.number().optional(),
  bottomLeft: z.number().optional(),
  bottomRight: z.number().optional()
});

export function handleSetCornerRadius(payload: Record<string, unknown>): OperationResult {
  const input = setCornerRadiusSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node) throw new Error(`Node not found: ${input.nodeId}`);
  if (!('cornerRadius' in node))
    throw new Error(`Node does not support corner radius (type: ${node.type})`);

  const rectNode = node as RectangleNode | FrameNode;
  if (input.radius !== undefined) {
    rectNode.cornerRadius = input.radius;
  } else {
    if (input.topLeft !== undefined) rectNode.topLeftRadius = input.topLeft;
    if (input.topRight !== undefined) rectNode.topRightRadius = input.topRight;
    if (input.bottomLeft !== undefined) rectNode.bottomLeftRadius = input.bottomLeft;
    if (input.bottomRight !== undefined) rectNode.bottomRightRadius = input.bottomRight;
  }

  return { nodeId: input.nodeId, message: 'Corner radius applied successfully' };
}

const setStrokeSchema = z.object({
  nodeId: z.string(),
  strokeColor: z.string().optional(),
  opacity: z.number().optional(),
  strokeWeight: z.number().optional(),
  strokeAlign: z.enum(STROKE_ALIGNS).optional(),
  dashPattern: z.array(z.number()).optional()
});

export function handleSetStroke(payload: Record<string, unknown>): OperationResult {
  const input = setStrokeSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node) throw new Error(`Node not found: ${input.nodeId}`);
  if (!('strokes' in node)) throw new Error(`Node does not support strokes (type: ${node.type})`);

  const geoNode = node as GeometryMixin;
  if (input.strokeColor !== undefined) {
    const rgb = hexToRgb(input.strokeColor);
    const opacity = input.opacity ?? 1;
    geoNode.strokes = [{ type: 'SOLID', color: rgb, opacity }];
  }
  if (input.strokeWeight !== undefined) geoNode.strokeWeight = input.strokeWeight;
  if (input.strokeAlign !== undefined) {
    (geoNode as FrameNode).strokeAlign = input.strokeAlign;
  }
  if (input.dashPattern !== undefined) {
    geoNode.dashPattern = input.dashPattern;
  }

  return { nodeId: input.nodeId, message: 'Stroke applied successfully' };
}

const setAppearanceSchema = z.object({
  nodeId: z.string(),
  blendMode: z.enum(BLEND_MODES).optional(),
  opacity: z.number().optional(),
  clipping: z
    .object({
      useMask: z.boolean().optional(),
      enabled: z.boolean().optional()
    })
    .optional()
});

export function handleSetAppearance(payload: Record<string, unknown>): OperationResult {
  const input = setAppearanceSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node) throw new Error('Node not found');

  if (input.blendMode !== undefined && 'blendMode' in node) {
    (node as BlendMixin).blendMode = input.blendMode;
  }
  if (input.opacity !== undefined && 'opacity' in node) {
    (node as BlendMixin).opacity = input.opacity;
  }
  if (input.clipping !== undefined && 'clipsContent' in node) {
    const frameNode = node as FrameNode;
    if (input.clipping.useMask === true) {
      frameNode.clipsContent = true;
      const children = (node as FrameNode).children;
      const firstChild = children.length > 0 ? children[0] : undefined;
      if (firstChild && 'isMask' in firstChild) {
        (firstChild as SceneNode & { isMask: boolean }).isMask = true;
      }
    } else {
      frameNode.clipsContent = input.clipping.enabled === true;
    }
  }

  return { nodeId: input.nodeId, message: 'Appearance set successfully' };
}

const setOpacitySchema = z.object({
  nodeId: z.string(),
  opacity: z.number()
});

export function handleSetOpacity(payload: Record<string, unknown>): OperationResult {
  const input = setOpacitySchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node || !('opacity' in node)) throw new Error('Node does not support opacity');

  (node as BlendMixin).opacity = input.opacity;
  return {
    nodeId: input.nodeId,
    opacity: input.opacity,
    message: 'Opacity set successfully (deprecated - use set_appearance)'
  };
}

const setBlendModeSchema = z.object({
  nodeId: z.string(),
  blendMode: z.enum(BLEND_MODES)
});

export function handleSetBlendMode(payload: Record<string, unknown>): OperationResult {
  const input = setBlendModeSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node || !('blendMode' in node)) throw new Error('Node does not support blend mode');

  (node as BlendMixin).blendMode = input.blendMode;
  return {
    nodeId: input.nodeId,
    blendMode: input.blendMode,
    message: 'Blend mode set successfully'
  };
}

const applyEffectsSchema = z.object({
  nodeId: z.string(),
  effects: z.array(z.record(z.string(), z.unknown()))
});

export function handleApplyEffects(payload: Record<string, unknown>): OperationResult {
  const input = applyEffectsSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node || !('effects' in node)) throw new Error('Node does not support effects');

  const effects = convertEffects(input.effects);
  (node as BlendMixin).effects = effects;

  return {
    nodeId: input.nodeId,
    effectsApplied: effects.length,
    message: 'Effects applied successfully'
  };
}

const addGradientFillSchema = z.object({
  nodeId: z.string(),
  type: z.string().optional(),
  stops: z.array(
    z.object({
      position: z.number().optional(),
      color: z.string().optional(),
      opacity: z.number().optional()
    })
  ),
  gradientTransform: z.unknown().optional(),
  angle: z.number().optional()
});

export function handleAddGradientFill(payload: Record<string, unknown>): OperationResult {
  const input = addGradientFillSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node) throw new Error(`Node not found: ${input.nodeId}`);
  if (!('fills' in node)) throw new Error(`Node type ${node.type} does not support fills`);

  const gradientType = input.type === 'RADIAL' ? 'GRADIENT_RADIAL' : 'GRADIENT_LINEAR';
  const stops: ColorStop[] = input.stops.map((stop) => ({
    position: stop.position ?? 0,
    color: {
      ...hexToRgb(stop.color ?? '#000000'),
      a: stop.opacity ?? 1
    }
  }));

  let gradientTransform: Transform;
  if (Array.isArray(input.gradientTransform)) {
    gradientTransform = input.gradientTransform as Transform;
  } else if (gradientType === 'GRADIENT_LINEAR' && input.angle !== undefined) {
    const angleRad = (input.angle * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    gradientTransform = [
      [cos, sin, 0.5 - sin * 0.5 - cos * 0.5],
      [-sin, cos, 0.5 + sin * 0.5 - cos * 0.5]
    ];
  } else {
    gradientTransform = [
      [1, 0, 0],
      [0, 1, 0]
    ];
  }

  (node as GeometryMixin).fills = [
    {
      type: gradientType,
      gradientStops: stops,
      gradientTransform
    } as GradientPaint
  ];

  return {
    nodeId: input.nodeId,
    type: gradientType,
    stopCount: stops.length,
    message: 'Gradient fill applied successfully'
  };
}

const setImageFillSchema = z.object({
  nodeId: z.string(),
  imageBytes: z.union([z.array(z.number()), z.string()]).optional(),
  imageUrl: z.string().optional(),
  scaleMode: z.enum(SCALE_MODES).optional(),
  opacity: z.number().optional()
});

export function handleSetImageFill(payload: Record<string, unknown>): OperationResult {
  const input = setImageFillSchema.parse(payload);

  const node = getNode(input.nodeId);
  if (!node || !('fills' in node)) throw new Error('Node does not support fills');

  if (Array.isArray(input.imageBytes)) {
    const bytes = new Uint8Array(input.imageBytes);

    const imageHash = figma.createImage(bytes).hash;
    const scaleMode = input.scaleMode ?? 'FILL';
    const opacity = input.opacity ?? 1;
    const imageFill: ImagePaint = {
      type: 'IMAGE',
      imageHash,
      scaleMode,
      opacity
    };
    (node as GeometryMixin).fills = [imageFill];

    return {
      nodeId: input.nodeId,
      scaleMode,
      opacity,
      message: 'Image fill applied successfully from byte array'
    };
  } else if (typeof input.imageBytes === 'string') {
    throw new Error(
      'Base64 strings not supported in plugin main thread. Please send image data as a byte array.'
    );
  } else if (input.imageUrl !== undefined) {
    const scaleMode = input.scaleMode ?? 'FILL';
    const opacity = input.opacity ?? 1;
    return {
      nodeId: input.nodeId,
      imageUrl: input.imageUrl,
      scaleMode,
      opacity,
      message:
        'Image URL received. To load: fetch image in UI thread, convert to byte array, then call set_image_fill with imageBytes.',
      requiresUiFetch: true
    };
  }
  throw new Error('Either imageBytes (byte array) or imageUrl must be provided');
}
