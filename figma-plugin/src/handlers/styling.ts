/**
 * Styling Command Handlers
 *
 * Handles: set_fills, set_corner_radius, set_stroke, set_appearance,
 * set_opacity, set_blend_mode, apply_effects, add_gradient_fill, set_image_fill
 */

import { convertEffects, getNode, hexToRgb } from '../helpers.js';
import { validatePayload } from '../validate.js';
import type { ValidationRule } from '../validate.js';

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
  if (payload.radius !== undefined) {
    rectNode.cornerRadius = payload.radius as number;
  } else {
    if (payload.topLeft !== undefined) rectNode.topLeftRadius = payload.topLeft as number;
    if (payload.topRight !== undefined) rectNode.topRightRadius = payload.topRight as number;
    if (payload.bottomLeft !== undefined) rectNode.bottomLeftRadius = payload.bottomLeft as number;
    if (payload.bottomRight !== undefined)
      rectNode.bottomRightRadius = payload.bottomRight as number;
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
  if (payload.strokeWeight !== undefined) geoNode.strokeWeight = payload.strokeWeight as number;
  if (typeof payload.strokeAlign === 'string') {
    (geoNode as FrameNode).strokeAlign = payload.strokeAlign as 'INSIDE' | 'OUTSIDE' | 'CENTER';
  }
  if (Array.isArray(payload.dashPattern)) {
    geoNode.dashPattern = payload.dashPattern as number[];
  }

  return { nodeId: payload.nodeId, message: 'Stroke applied successfully' };
}

export function handleSetAppearance(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node) throw new Error('Node not found');

  if (typeof payload.blendMode === 'string' && 'blendMode' in node) {
    (node as BlendMixin).blendMode = payload.blendMode as BlendMode;
  }
  if (payload.opacity !== undefined && 'opacity' in node) {
    (node as BlendMixin).opacity = payload.opacity as number;
  }
  if (payload.clipping !== undefined && 'clipsContent' in node) {
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
      frameNode.clipsContent = clipping.enabled as boolean;
    }
  }

  return { nodeId: payload.nodeId, message: 'Appearance set successfully' };
}

export function handleSetOpacity(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node || !('opacity' in node)) throw new Error('Node does not support opacity');

  (node as BlendMixin).opacity = payload.opacity as number;
  return {
    nodeId: payload.nodeId,
    opacity: payload.opacity,
    message: 'Opacity set successfully (deprecated - use set_appearance)'
  };
}

export function handleSetBlendMode(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node || !('blendMode' in node)) throw new Error('Node does not support blend mode');

  (node as BlendMixin).blendMode = payload.blendMode as BlendMode;
  return {
    nodeId: payload.nodeId,
    blendMode: payload.blendMode,
    message: 'Blend mode set successfully'
  };
}

export function handleApplyEffects(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.nodeId as string);
  if (!node || !('effects' in node)) throw new Error('Node does not support effects');

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
  const stops: ColorStop[] = (payload.stops as Array<Record<string, unknown>>).map((stop) => ({
    position: stop.position as number,
    color: {
      ...hexToRgb(stop.color as string),
      a: typeof stop.opacity === 'number' ? stop.opacity : 1
    }
  }));

  let gradientTransform: Transform;
  if (Array.isArray(payload.gradientTransform)) {
    gradientTransform = payload.gradientTransform as Transform;
  } else if (gradientType === 'GRADIENT_LINEAR' && payload.angle !== undefined) {
    const angleRad = ((payload.angle as number) * Math.PI) / 180;
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
    const bytes = new Uint8Array(payload.imageBytes as number[]);

    const imageHash = figma.createImage(bytes).hash;
    const scaleMode =
      typeof payload.scaleMode === 'string'
        ? (payload.scaleMode as ImagePaint['scaleMode'])
        : 'FILL';
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
    const scaleMode = typeof payload.scaleMode === 'string' ? payload.scaleMode : 'FILL';
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
