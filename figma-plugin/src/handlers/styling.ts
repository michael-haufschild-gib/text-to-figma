/**
 * Styling Command Handlers
 *
 * Handles: set_fills, set_corner_radius, set_stroke, set_appearance,
 * set_opacity, set_blend_mode, apply_effects, add_gradient_fill, set_image_fill
 */

import { convertEffects, getNode, hexToRgb } from '../helpers.js';
import { checkEnum, validatePayload } from '../validate.js';
import type { ValidationRule } from '../validate.js';

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

const setFillsRules: ValidationRule[] = [
  { field: 'nodeId', type: 'string', required: true },
  { field: 'color', type: 'string' },
  { field: 'fills', type: 'array' },
  { field: 'opacity', type: 'number' }
];

export function handleSetFills(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, setFillsRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.nodeId as string);
  if (!node || !('fills' in node)) throw new Error('Node not found or does not support fills');

  if (typeof payload.color === 'string') {
    const rgb = hexToRgb(payload.color);
    const opacity = typeof payload.opacity === 'number' ? payload.opacity : 1;
    (node as GeometryMixin).fills = [{ type: 'SOLID', color: rgb, opacity }];
  } else if (Array.isArray(payload.fills)) {
    (node as GeometryMixin).fills = payload.fills as Paint[];
  }

  return { nodeId: payload.nodeId, message: 'Fills applied successfully' };
}

export function handleSetCornerRadius(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node) throw new Error(`Node not found: ${String(payload.nodeId)}`);
  if (!('cornerRadius' in node))
    throw new Error(`Node does not support corner radius (type: ${node.type})`);

  const rectNode = node as RectangleNode | FrameNode;
  if (typeof payload.radius === 'number') {
    rectNode.cornerRadius = payload.radius;
  } else {
    if (typeof payload.topLeft === 'number') rectNode.topLeftRadius = payload.topLeft;
    if (typeof payload.topRight === 'number') rectNode.topRightRadius = payload.topRight;
    if (typeof payload.bottomLeft === 'number') rectNode.bottomLeftRadius = payload.bottomLeft;
    if (typeof payload.bottomRight === 'number') rectNode.bottomRightRadius = payload.bottomRight;
  }

  return { nodeId: payload.nodeId, message: 'Corner radius applied successfully' };
}

export function handleSetStroke(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node) throw new Error(`Node not found: ${String(payload.nodeId)}`);
  if (!('strokes' in node)) throw new Error(`Node does not support strokes (type: ${node.type})`);

  const geoNode = node as GeometryMixin;
  if (typeof payload.strokeColor === 'string') {
    const rgb = hexToRgb(payload.strokeColor);
    const opacity = typeof payload.opacity === 'number' ? payload.opacity : 1;
    geoNode.strokes = [{ type: 'SOLID', color: rgb, opacity }];
  }
  if (typeof payload.strokeWeight === 'number') geoNode.strokeWeight = payload.strokeWeight;
  const strokeAlign = checkEnum(payload.strokeAlign, STROKE_ALIGNS);
  if (strokeAlign !== undefined) {
    (geoNode as FrameNode).strokeAlign = strokeAlign;
  }
  if (
    Array.isArray(payload.dashPattern) &&
    payload.dashPattern.every((el: unknown) => typeof el === 'number')
  ) {
    geoNode.dashPattern = payload.dashPattern;
  }

  return { nodeId: payload.nodeId, message: 'Stroke applied successfully' };
}

export function handleSetAppearance(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node) throw new Error('Node not found');

  const blendMode = checkEnum(payload.blendMode, BLEND_MODES);
  if (blendMode !== undefined && 'blendMode' in node) {
    (node as BlendMixin).blendMode = blendMode;
  }
  if (typeof payload.opacity === 'number' && 'opacity' in node) {
    (node as BlendMixin).opacity = payload.opacity;
  }
  if (typeof payload.clipping === 'object' && payload.clipping !== null && 'clipsContent' in node) {
    const clipping = payload.clipping as Record<string, unknown>;
    const frameNode = node as FrameNode;
    if (clipping.useMask === true) {
      frameNode.clipsContent = true;
      const children = (node as FrameNode).children;
      const firstChild = children.length > 0 ? children[0] : undefined;
      if (firstChild && 'isMask' in firstChild) {
        (firstChild as SceneNode & { isMask: boolean }).isMask = true;
      }
    } else {
      frameNode.clipsContent = clipping.enabled === true;
    }
  }

  return { nodeId: payload.nodeId, message: 'Appearance set successfully' };
}

export function handleSetOpacity(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node || !('opacity' in node)) throw new Error('Node does not support opacity');

  if (typeof payload.opacity !== 'number') throw new Error('opacity must be a number');
  (node as BlendMixin).opacity = payload.opacity;
  return {
    nodeId: payload.nodeId,
    opacity: payload.opacity,
    message: 'Opacity set successfully (deprecated - use set_appearance)'
  };
}

export function handleSetBlendMode(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node || !('blendMode' in node)) throw new Error('Node does not support blend mode');

  const blendMode = checkEnum(payload.blendMode, BLEND_MODES);
  if (blendMode === undefined) throw new Error(`Invalid blendMode: ${String(payload.blendMode)}`);
  (node as BlendMixin).blendMode = blendMode;
  return {
    nodeId: payload.nodeId,
    blendMode: payload.blendMode,
    message: 'Blend mode set successfully'
  };
}

export function handleApplyEffects(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node || !('effects' in node)) throw new Error('Node does not support effects');

  if (!Array.isArray(payload.effects)) throw new Error('effects must be an array');
  const effects = convertEffects(payload.effects as Array<Record<string, unknown>>);
  (node as BlendMixin).effects = effects;

  return {
    nodeId: payload.nodeId,
    effectsApplied: effects.length,
    message: 'Effects applied successfully'
  };
}

export function handleAddGradientFill(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node) throw new Error(`Node not found: ${String(payload.nodeId)}`);
  if (!('fills' in node)) throw new Error(`Node type ${node.type} does not support fills`);

  const gradientType = payload.type === 'RADIAL' ? 'GRADIENT_RADIAL' : 'GRADIENT_LINEAR';
  if (!Array.isArray(payload.stops)) throw new Error('stops must be an array');
  const stops: ColorStop[] = (payload.stops as Array<Record<string, unknown>>).map((stop) => ({
    position: typeof stop.position === 'number' ? stop.position : 0,
    color: {
      ...hexToRgb(typeof stop.color === 'string' ? stop.color : '#000000'),
      a: typeof stop.opacity === 'number' ? stop.opacity : 1
    }
  }));

  let gradientTransform: Transform;
  if (Array.isArray(payload.gradientTransform)) {
    gradientTransform = payload.gradientTransform as Transform;
  } else if (gradientType === 'GRADIENT_LINEAR' && typeof payload.angle === 'number') {
    const angleRad = (payload.angle * Math.PI) / 180;
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
    nodeId: payload.nodeId,
    type: gradientType,
    stopCount: stops.length,
    message: 'Gradient fill applied successfully'
  };
}

export function handleSetImageFill(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node || !('fills' in node)) throw new Error('Node does not support fills');

  if (Array.isArray(payload.imageBytes)) {
    if (!payload.imageBytes.every((el: unknown) => typeof el === 'number')) {
      throw new Error('imageBytes must contain only numbers');
    }
    const bytes = new Uint8Array(payload.imageBytes);

    const imageHash = figma.createImage(bytes).hash;
    const scaleMode = checkEnum(payload.scaleMode, SCALE_MODES) ?? 'FILL';
    const opacity = typeof payload.opacity === 'number' ? payload.opacity : 1;
    const imageFill: ImagePaint = {
      type: 'IMAGE',
      imageHash,
      scaleMode,
      opacity
    };
    (node as GeometryMixin).fills = [imageFill];

    return {
      nodeId: payload.nodeId,
      scaleMode,
      opacity,
      message: 'Image fill applied successfully from byte array'
    };
  } else if (typeof payload.imageBytes === 'string') {
    throw new Error(
      'Base64 strings not supported in plugin main thread. Please send image data as a byte array.'
    );
  } else if (typeof payload.imageUrl === 'string') {
    const scaleMode = checkEnum(payload.scaleMode, SCALE_MODES) ?? 'FILL';
    const opacity = typeof payload.opacity === 'number' ? payload.opacity : 1;
    return {
      nodeId: payload.nodeId,
      imageUrl: payload.imageUrl,
      scaleMode,
      opacity,
      message:
        'Image URL received. To load: fetch image in UI thread, convert to byte array, then call set_image_fill with imageBytes.',
      requiresUiFetch: true
    };
  }
  throw new Error('Either imageBytes (byte array) or imageUrl must be provided');
}
