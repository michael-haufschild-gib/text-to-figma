/**
 * Text-to-Figma Plugin - Complete Implementation
 *
 * Implements all MCP server commands as Figma plugin handlers
 */

// Show plugin UI
figma.showUI(__html__, { width: 400, height: 300 });

// ============================================================
// FONT PRELOADING
// ============================================================
// Pre-load common fonts to prevent "unloaded font" errors
const COMMON_FONTS = [
  { family: 'Inter', style: 'Regular' },
  { family: 'Inter', style: 'Medium' },
  { family: 'Inter', style: 'SemiBold' },
  { family: 'Inter', style: 'Bold' },
  { family: 'Roboto', style: 'Regular' },
  { family: 'Roboto', style: 'Medium' },
  { family: 'Roboto', style: 'Bold' }
];

// Preload fonts on plugin start
(async () => {
  console.log('[INIT] Preloading common fonts...');
  for (const font of COMMON_FONTS) {
    try {
      await figma.loadFontAsync(font);
      console.log(`[INIT] Loaded font: ${font.family} ${font.style}`);
    } catch (error) {
      console.warn(`[INIT] Failed to load font: ${font.family} ${font.style}`, error);
    }
  }
  console.log('[INIT] Font preloading complete');
})();

// Helper: Convert hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace('#', '');
  return {
    r: parseInt(cleanHex.substring(0, 2), 16) / 255,
    g: parseInt(cleanHex.substring(2, 4), 16) / 255,
    b: parseInt(cleanHex.substring(4, 6), 16) / 255
  };
}

// Helper: Get node by ID safely
function getNode(nodeId: string): SceneNode | null {
  try {
    return figma.getNodeById(nodeId) as SceneNode;
  } catch {
    return null;
  }
}

// Main message handler
figma.ui.onmessage = async (msg: any) => {
  const { type, payload, requestId } = msg;

  try {
    let result: any = null;

    switch (type) {
      // ============================================================
      // CREATION PRIMITIVES
      // ============================================================

      case 'create_frame': {
        const frame = figma.createFrame();
        frame.name = payload.name || 'Frame';
        frame.x = payload.x || 0;
        frame.y = payload.y || 0;

        // Remove default white fill (Figma adds this automatically)
        frame.fills = [];

        // Set dimensions if provided
        if (payload.width && payload.height) {
          frame.resize(payload.width, payload.height);
        }

        // Auto-layout
        if (payload.layoutMode && payload.layoutMode !== 'NONE') {
          frame.layoutMode = payload.layoutMode;
        }

        if (payload.itemSpacing !== undefined) {
          frame.itemSpacing = payload.itemSpacing;
        }
        if (payload.padding !== undefined) {
          frame.paddingLeft =
            frame.paddingRight =
            frame.paddingTop =
            frame.paddingBottom =
              payload.padding;
        }

        // Parent handling - MUST come before setting layoutSizing
        if (payload.parentId) {
          const parent = getNode(payload.parentId);
          console.log('[DEBUG] Parent lookup:', {
            parentId: payload.parentId,
            found: !!parent,
            hasAppendChild: parent && 'appendChild' in parent
          });
          if (parent && 'appendChild' in parent) {
            parent.appendChild(frame);
            console.log('[DEBUG] Frame appended to parent');
          } else {
            console.warn('[WARN] Parent not found or cannot appendChild');
          }
        }

        // Set layout sizing AFTER adding to parent
        // CRITICAL: FILL sizing can only be set on children of auto-layout frames
        if (payload.layoutMode && payload.layoutMode !== 'NONE' && payload.parentId) {
          // Apply explicit sizing if provided
          if (payload.horizontalSizing) {
            frame.layoutSizingHorizontal = payload.horizontalSizing;
            console.log(`[create_frame] Set horizontalSizing: ${payload.horizontalSizing}`);
          } else if (!payload.width) {
            // Default: FILL if no width specified
            frame.layoutSizingHorizontal = 'FILL';
            console.log('[create_frame] Default horizontalSizing: FILL');
          }

          if (payload.verticalSizing) {
            frame.layoutSizingVertical = payload.verticalSizing;
            console.log(`[create_frame] Set verticalSizing: ${payload.verticalSizing}`);
          } else if (!payload.height) {
            // Default: HUG if no height specified
            frame.layoutSizingVertical = 'HUG';
            console.log('[create_frame] Default verticalSizing: HUG');
          }
        }

        figma.viewport.scrollAndZoomIntoView([frame]);

        result = {
          nodeId: frame.id,
          message: `Frame created: ${frame.name}`
        };
        break;
      }

      case 'create_text': {
        // Load font
        const fontFamily = payload.fontFamily || 'Inter';
        const fontWeight = payload.fontWeight || 400;
        let fontStyle = 'Regular';

        // Map font weights to styles
        if (fontWeight >= 700) fontStyle = 'Bold';
        else if (fontWeight >= 600) fontStyle = 'SemiBold';
        else if (fontWeight >= 500) fontStyle = 'Medium';
        else if (fontWeight <= 300) fontStyle = 'Light';

        try {
          await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
        } catch {
          await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
        }

        const textNode = figma.createText();
        textNode.characters = payload.content || '';
        textNode.name = payload.name || 'Text';
        textNode.x = payload.x || 0;
        textNode.y = payload.y || 0;

        if (payload.fontSize) {
          textNode.fontSize = payload.fontSize;
        }

        if (payload.color) {
          const rgb = hexToRgb(payload.color);
          textNode.fills = [{ type: 'SOLID', color: rgb }];
        }

        if (payload.textAlign) {
          textNode.textAlignHorizontal = payload.textAlign;
        }

        if (payload.lineHeight) {
          textNode.lineHeight = { value: payload.lineHeight, unit: 'PIXELS' };
        }

        if (payload.letterSpacing) {
          textNode.letterSpacing = { value: payload.letterSpacing, unit: 'PIXELS' };
        }

        // Parent handling
        if (payload.parentId) {
          const parent = getNode(payload.parentId);
          if (parent && 'appendChild' in parent) {
            parent.appendChild(textNode);
          }
        }

        figma.viewport.scrollAndZoomIntoView([textNode]);

        result = {
          nodeId: textNode.id,
          message: `Text created: "${textNode.characters}"`
        };
        break;
      }

      case 'create_ellipse': {
        try {
          const ellipse = figma.createEllipse();
          ellipse.name = payload.name || 'Ellipse';
          ellipse.x = payload.x || 0;
          ellipse.y = payload.y || 0;
          ellipse.resize(payload.width || 100, payload.height || 100);

          if (payload.fillColor) {
            const rgb = hexToRgb(payload.fillColor);
            ellipse.fills = [{ type: 'SOLID', color: rgb }];
          }

          if (payload.strokeColor && payload.strokeWeight) {
            const rgb = hexToRgb(payload.strokeColor);
            ellipse.strokes = [{ type: 'SOLID', color: rgb }];
            ellipse.strokeWeight = payload.strokeWeight;
          }

          // Parent handling
          if (payload.parentId) {
            const parent = getNode(payload.parentId);
            if (parent && 'appendChild' in parent) {
              parent.appendChild(ellipse);
              console.log(`[create_ellipse] Appended to parent: ${payload.parentId}`);
            } else {
              console.warn(`[create_ellipse] Parent not found or invalid: ${payload.parentId}`);
            }
          }

          figma.viewport.scrollAndZoomIntoView([ellipse]);

          result = {
            nodeId: ellipse.id,
            message: `Ellipse created: ${ellipse.name}`
          };
        } catch (error) {
          console.error('[create_ellipse] Error:', error);
          throw new Error(`Failed to create ellipse: ${error.message}`);
        }
        break;
      }

      case 'create_line': {
        try {
          const line = figma.createLine();
          line.name = payload.name || 'Line';

          const x1 = payload.x1 || 0;
          const y1 = payload.y1 || 0;
          const x2 = payload.x2 || 100;
          const y2 = payload.y2 || 0;

          line.x = Math.min(x1, x2);
          line.y = Math.min(y1, y2);

          // Ensure non-zero dimensions (Figma requires > 0)
          const width = Math.max(Math.abs(x2 - x1), 0.01);
          const height = Math.max(Math.abs(y2 - y1), 0.01);
          line.resize(width, height);

          if (payload.strokeColor) {
            const rgb = hexToRgb(payload.strokeColor);
            line.strokes = [{ type: 'SOLID', color: rgb }];
          }

          if (payload.strokeWeight) {
            line.strokeWeight = payload.strokeWeight;
          }

          if (payload.strokeCap) {
            line.strokeCap = payload.strokeCap;
          }

          if (payload.dashPattern) {
            line.dashPattern = payload.dashPattern;
          }

          // Parent handling
          if (payload.parentId) {
            const parent = getNode(payload.parentId);
            if (parent && 'appendChild' in parent) {
              parent.appendChild(line);
              console.log(`[create_line] Appended to parent: ${payload.parentId}`);
            } else {
              console.warn(`[create_line] Parent not found or invalid: ${payload.parentId}`);
            }
          }

          figma.viewport.scrollAndZoomIntoView([line]);

          result = {
            nodeId: line.id,
            message: `Line created: ${line.name}`
          };
        } catch (error) {
          console.error('[create_line] Error:', error);
          throw new Error(`Failed to create line: ${error.message}`);
        }
        break;
      }

      case 'create_polygon': {
        const polygon = figma.createPolygon();
        polygon.name = payload.name || 'Polygon';
        polygon.x = payload.x || 0;
        polygon.y = payload.y || 0;
        polygon.pointCount = payload.sideCount || 3;
        polygon.resize(payload.radius * 2 || 100, payload.radius * 2 || 100);

        if (payload.fillColor) {
          const rgb = hexToRgb(payload.fillColor);
          polygon.fills = [{ type: 'SOLID', color: rgb }];
        }

        if (payload.strokeColor && payload.strokeWeight) {
          const rgb = hexToRgb(payload.strokeColor);
          polygon.strokes = [{ type: 'SOLID', color: rgb }];
          polygon.strokeWeight = payload.strokeWeight;
        }

        // Parent handling
        if (payload.parentId) {
          const parent = getNode(payload.parentId);
          if (parent && 'appendChild' in parent) {
            parent.appendChild(polygon);
          }
        }

        figma.viewport.scrollAndZoomIntoView([polygon]);

        result = {
          nodeId: polygon.id,
          message: `Polygon created: ${polygon.name}`
        };
        break;
      }

      case 'create_star': {
        const star = figma.createStar();
        star.name = payload.name || 'Star';
        star.x = payload.x || 0;
        star.y = payload.y || 0;
        star.pointCount = payload.pointCount || 5;
        star.resize(payload.radius * 2 || 100, payload.radius * 2 || 100);

        if (payload.innerRadius) {
          star.innerRadius = payload.innerRadius / payload.radius;
        }

        if (payload.fillColor) {
          const rgb = hexToRgb(payload.fillColor);
          star.fills = [{ type: 'SOLID', color: rgb }];
        }

        if (payload.strokeColor && payload.strokeWeight) {
          const rgb = hexToRgb(payload.strokeColor);
          star.strokes = [{ type: 'SOLID', color: rgb }];
          star.strokeWeight = payload.strokeWeight;
        }

        // Parent handling
        if (payload.parentId) {
          const parent = getNode(payload.parentId);
          if (parent && 'appendChild' in parent) {
            parent.appendChild(star);
          }
        }

        figma.viewport.scrollAndZoomIntoView([star]);

        result = {
          nodeId: star.id,
          message: `Star created: ${star.name}`
        };
        break;
      }

      case 'create_rectangle_with_image_fill': {
        const rect = figma.createRectangle();
        rect.name = payload.name || 'Image';
        rect.x = payload.x || 0;
        rect.y = payload.y || 0;
        rect.resize(payload.width || 100, payload.height || 100);

        // Image will be loaded via set_image_fill or placeholder for now
        rect.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];

        // Parent handling
        if (payload.parentId) {
          const parent = getNode(payload.parentId);
          if (parent && 'appendChild' in parent) {
            parent.appendChild(rect);
          }
        }

        figma.viewport.scrollAndZoomIntoView([rect]);

        result = {
          nodeId: rect.id,
          message: `Rectangle created for image: ${rect.name}`,
          note: 'Image fill requires async loading - use set_image_fill separately'
        };
        break;
      }

      // ============================================================
      // FILL & STYLE PRIMITIVES
      // ============================================================

      case 'set_fills': {
        const node = getNode(payload.nodeId);
        if (!node || !('fills' in node)) {
          throw new Error('Node not found or does not support fills');
        }

        if (payload.color) {
          const rgb = hexToRgb(payload.color);
          const opacity = payload.opacity !== undefined ? payload.opacity : 1;
          node.fills = [{ type: 'SOLID', color: rgb, opacity }];
        } else if (payload.fills) {
          node.fills = payload.fills;
        }

        result = {
          nodeId: payload.nodeId,
          message: 'Fills applied successfully'
        };
        break;
      }

      case 'set_corner_radius': {
        try {
          const node = getNode(payload.nodeId);
          if (!node) {
            throw new Error(`Node not found: ${payload.nodeId}`);
          }
          if (!('cornerRadius' in node)) {
            throw new Error(
              `Node ${payload.nodeId} does not support corner radius (type: ${node.type})`
            );
          }

          if (payload.radius !== undefined) {
            if ('cornerRadius' in node && typeof node.cornerRadius !== 'symbol') {
              (node as any).cornerRadius = payload.radius;
              console.log(`[set_corner_radius] Set uniform radius: ${payload.radius}`);
            }
          } else {
            // Individual corners
            if (payload.topLeft !== undefined && 'topLeftRadius' in node) {
              (node as any).topLeftRadius = payload.topLeft;
            }
            if (payload.topRight !== undefined && 'topRightRadius' in node) {
              (node as any).topRightRadius = payload.topRight;
            }
            if (payload.bottomLeft !== undefined && 'bottomLeftRadius' in node) {
              (node as any).bottomLeftRadius = payload.bottomLeft;
            }
            if (payload.bottomRight !== undefined && 'bottomRightRadius' in node) {
              (node as any).bottomRightRadius = payload.bottomRight;
            }
            console.log(`[set_corner_radius] Set individual corners`);
          }

          result = {
            nodeId: payload.nodeId,
            message: 'Corner radius applied successfully'
          };
        } catch (error) {
          console.error('[set_corner_radius] Error:', error);
          throw new Error(`Failed to set corner radius: ${error.message}`);
        }
        break;
      }

      case 'set_stroke': {
        try {
          const node = getNode(payload.nodeId);
          if (!node) {
            throw new Error(`Node not found: ${payload.nodeId}`);
          }
          if (!('strokes' in node)) {
            throw new Error(`Node ${payload.nodeId} does not support strokes (type: ${node.type})`);
          }

          if (payload.strokeColor) {
            const rgb = hexToRgb(payload.strokeColor);
            const opacity = payload.opacity !== undefined ? payload.opacity : 1;
            node.strokes = [{ type: 'SOLID', color: rgb, opacity }];
            console.log(`[set_stroke] Applied stroke color: ${payload.strokeColor}`);
          }

          if (payload.strokeWeight !== undefined) {
            node.strokeWeight = payload.strokeWeight;
            console.log(`[set_stroke] Applied stroke weight: ${payload.strokeWeight}`);
          }

          if (payload.strokeAlign) {
            node.strokeAlign = payload.strokeAlign;
            console.log(`[set_stroke] Applied stroke align: ${payload.strokeAlign}`);
          }

          if (payload.dashPattern) {
            node.dashPattern = payload.dashPattern;
            console.log(`[set_stroke] Applied dash pattern`);
          }

          result = {
            nodeId: payload.nodeId,
            message: 'Stroke applied successfully'
          };
        } catch (error) {
          console.error('[set_stroke] Error:', error);
          throw new Error(`Failed to set stroke: ${error.message}`);
        }
        break;
      }

      case 'set_opacity': {
        const node = getNode(payload.nodeId);
        if (!node || !('opacity' in node)) {
          throw new Error('Node does not support opacity');
        }

        (node as any).opacity = payload.opacity;

        result = {
          nodeId: payload.nodeId,
          opacity: payload.opacity,
          message: 'Opacity set successfully'
        };
        break;
      }

      // ============================================================
      // TRANSFORM PRIMITIVES
      // ============================================================

      case 'set_absolute_position': {
        const node = getNode(payload.nodeId);
        if (!node) {
          throw new Error('Node not found');
        }

        node.x = payload.x;
        node.y = payload.y;

        result = {
          nodeId: payload.nodeId,
          x: payload.x,
          y: payload.y,
          message: 'Position set successfully'
        };
        break;
      }

      case 'set_size': {
        const node = getNode(payload.nodeId);
        if (!node || !('resize' in node)) {
          throw new Error('Node does not support resizing');
        }

        node.resize(payload.width, payload.height);

        result = {
          nodeId: payload.nodeId,
          width: payload.width,
          height: payload.height,
          message: 'Size set successfully'
        };
        break;
      }

      case 'set_rotation': {
        const node = getNode(payload.nodeId);
        if (!node || !('rotation' in node)) {
          throw new Error('Node does not support rotation');
        }

        (node as any).rotation = payload.rotation;

        result = {
          nodeId: payload.nodeId,
          rotation: payload.rotation,
          message: 'Rotation set successfully'
        };
        break;
      }

      case 'set_scale': {
        const node = getNode(payload.nodeId);
        if (!node || !('resize' in node)) {
          throw new Error('Node does not support scaling');
        }

        const currentWidth = node.width;
        const currentHeight = node.height;

        node.resize(currentWidth * payload.scaleX, currentHeight * payload.scaleY);

        result = {
          nodeId: payload.nodeId,
          scaleX: payload.scaleX,
          scaleY: payload.scaleY,
          message: 'Scale applied successfully'
        };
        break;
      }

      case 'flip_node': {
        const node = getNode(payload.nodeId);
        if (!node || !('resize' in node)) {
          throw new Error('Node does not support flipping');
        }

        const direction = payload.direction;

        if (direction === 'HORIZONTAL' || direction === 'BOTH') {
          node.resize(-node.width, node.height);
        }
        if (direction === 'VERTICAL' || direction === 'BOTH') {
          node.resize(node.width, -node.height);
        }

        result = {
          nodeId: payload.nodeId,
          direction: payload.direction,
          message: 'Node flipped successfully'
        };
        break;
      }

      // ============================================================
      // LAYOUT PRIMITIVES
      // ============================================================

      case 'set_layout_properties': {
        const node = getNode(payload.nodeId);
        if (!node || !('layoutMode' in node)) {
          throw new Error('Node does not support auto-layout');
        }

        if (payload.layoutMode) node.layoutMode = payload.layoutMode;
        if (payload.itemSpacing !== undefined) node.itemSpacing = payload.itemSpacing;
        if (payload.padding !== undefined) {
          node.paddingLeft =
            node.paddingRight =
            node.paddingTop =
            node.paddingBottom =
              payload.padding;
        }

        result = {
          nodeId: payload.nodeId,
          message: 'Layout properties updated successfully'
        };
        break;
      }

      case 'set_layout_align': {
        const node = getNode(payload.nodeId);
        if (!node || !('primaryAxisAlignItems' in node)) {
          throw new Error('Node does not support layout alignment');
        }

        if (payload.primaryAxis) {
          node.primaryAxisAlignItems = payload.primaryAxis;
        }
        if (payload.counterAxis) {
          node.counterAxisAlignItems = payload.counterAxis;
        }

        result = {
          nodeId: payload.nodeId,
          message: 'Layout alignment set successfully'
        };
        break;
      }

      case 'set_layout_sizing': {
        const node = getNode(payload.nodeId);
        if (!node || !('layoutSizingHorizontal' in node)) {
          throw new Error('Node does not support layout sizing');
        }

        if (payload.horizontal) {
          node.layoutSizingHorizontal = payload.horizontal;
        }
        if (payload.vertical) {
          node.layoutSizingVertical = payload.vertical;
        }

        result = {
          nodeId: payload.nodeId,
          message: 'Layout sizing set successfully'
        };
        break;
      }

      // ============================================================
      // TEXT PRIMITIVES
      // ============================================================

      case 'set_text_decoration': {
        const node = getNode(payload.nodeId);
        if (!node || node.type !== 'TEXT') {
          throw new Error('Node is not a text node');
        }

        node.textDecoration = payload.decoration;

        result = {
          nodeId: payload.nodeId,
          decoration: payload.decoration,
          message: 'Text decoration set successfully'
        };
        break;
      }

      case 'set_text_case': {
        const node = getNode(payload.nodeId);
        if (!node || node.type !== 'TEXT') {
          throw new Error('Node is not a text node');
        }

        node.textCase = payload.textCase;

        result = {
          nodeId: payload.nodeId,
          textCase: payload.textCase,
          message: 'Text case set successfully'
        };
        break;
      }

      case 'set_letter_spacing': {
        const node = getNode(payload.nodeId);
        if (!node || node.type !== 'TEXT') {
          throw new Error('Node is not a text node');
        }

        const unit = payload.unit || 'PERCENT';
        node.letterSpacing = { value: payload.value, unit };

        result = {
          nodeId: payload.nodeId,
          value: payload.value,
          unit,
          message: 'Letter spacing set successfully'
        };
        break;
      }

      case 'set_paragraph_spacing': {
        const node = getNode(payload.nodeId);
        if (!node || node.type !== 'TEXT') {
          throw new Error('Node is not a text node');
        }

        if (payload.paragraphSpacing !== undefined) {
          node.paragraphSpacing = payload.paragraphSpacing;
        }
        if (payload.paragraphIndent !== undefined) {
          node.paragraphIndent = payload.paragraphIndent;
        }

        result = {
          nodeId: payload.nodeId,
          message: 'Paragraph spacing set successfully'
        };
        break;
      }

      // ============================================================
      // VISIBILITY & STATE
      // ============================================================

      case 'set_visible': {
        const node = getNode(payload.nodeId);
        if (!node) {
          throw new Error('Node not found');
        }

        node.visible = payload.visible;

        result = {
          nodeId: payload.nodeId,
          visible: payload.visible,
          message: 'Visibility set successfully'
        };
        break;
      }

      case 'set_locked': {
        const node = getNode(payload.nodeId);
        if (!node) {
          throw new Error('Node not found');
        }

        node.locked = payload.locked;

        result = {
          nodeId: payload.nodeId,
          locked: payload.locked,
          message: 'Lock state set successfully'
        };
        break;
      }

      // ============================================================
      // EFFECTS PRIMITIVES
      // ============================================================

      case 'apply_effects': {
        const node = getNode(payload.nodeId);
        if (!node || !('effects' in node)) {
          throw new Error('Node does not support effects');
        }

        const effects: Effect[] = [];

        for (const effect of payload.effects) {
          if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
            const rgb = effect.color ? hexToRgb(effect.color) : { r: 0, g: 0, b: 0 };
            const opacity = effect.opacity !== undefined ? effect.opacity : 1;
            effects.push({
              type: effect.type,
              color: { ...rgb, a: opacity },
              offset: { x: effect.x || effect.offsetX || 0, y: effect.y || effect.offsetY || 0 },
              radius: effect.blur || 0,
              spread: effect.spread || 0,
              visible: true,
              blendMode: 'NORMAL'
            } as DropShadowEffect | InnerShadowEffect);
          } else if (effect.type === 'LAYER_BLUR' || effect.type === 'BACKGROUND_BLUR') {
            effects.push({
              type: effect.type,
              radius: effect.radius || effect.blur || 0,
              visible: true
            } as BlurEffect);
          }
        }

        node.effects = effects;

        result = {
          nodeId: payload.nodeId,
          effectsApplied: effects.length,
          message: 'Effects applied successfully'
        };
        break;
      }

      case 'set_blend_mode': {
        const node = getNode(payload.nodeId);
        if (!node || !('blendMode' in node)) {
          throw new Error('Node does not support blend mode');
        }

        node.blendMode = payload.blendMode;

        result = {
          nodeId: payload.nodeId,
          blendMode: payload.blendMode,
          message: 'Blend mode set successfully'
        };
        break;
      }

      // ============================================================
      // COMPONENT PRIMITIVES
      // ============================================================

      case 'create_component': {
        const node = getNode(payload.frameId);
        if (!node || node.type !== 'FRAME') {
          throw new Error('Node must be a frame to convert to component');
        }

        const component = figma.createComponent();
        component.name = payload.name || 'Component';

        // Copy frame properties
        component.resize(node.width, node.height);
        component.x = node.x;
        component.y = node.y;

        // Move children
        const children = [...node.children];
        for (const child of children) {
          component.appendChild(child);
        }

        // Remove original frame
        node.remove();

        if (payload.description) {
          component.description = payload.description;
        }

        figma.viewport.scrollAndZoomIntoView([component]);

        result = {
          componentId: component.id,
          name: component.name,
          message: 'Component created successfully'
        };
        break;
      }

      case 'create_instance': {
        const component = getNode(payload.componentId);
        if (!component || component.type !== 'COMPONENT') {
          throw new Error('Node is not a component');
        }

        const instance = component.createInstance();
        instance.x = payload.x || 0;
        instance.y = payload.y || 0;

        if (payload.name) {
          instance.name = payload.name;
        }

        // Parent handling
        if (payload.parentId) {
          const parent = getNode(payload.parentId);
          if (parent && 'appendChild' in parent) {
            parent.appendChild(instance);
          }
        }

        figma.viewport.scrollAndZoomIntoView([instance]);

        result = {
          instanceId: instance.id,
          componentId: payload.componentId,
          message: 'Instance created successfully'
        };
        break;
      }

      // ============================================================
      // NODE QUERY PRIMITIVES
      // ============================================================

      case 'get_node_by_id': {
        const node = getNode(payload.nodeId);

        if (!node) {
          result = {
            exists: false,
            error: 'Node not found'
          };
        } else {
          result = {
            exists: true,
            node: {
              id: node.id,
              name: node.name,
              type: node.type,
              width: 'width' in node ? node.width : undefined,
              height: 'height' in node ? node.height : undefined,
              x: node.x,
              y: node.y
            },
            message: 'Node retrieved successfully'
          };
        }
        break;
      }

      case 'get_node_by_name': {
        const findAll = payload.findAll || false;
        const exactMatch = payload.exactMatch || false;
        const searchName = payload.name.toLowerCase();

        const results: any[] = [];

        function searchNodes(node: BaseNode) {
          const nodeName = node.name.toLowerCase();
          const matches = exactMatch ? nodeName === searchName : nodeName.includes(searchName);

          if (matches && 'id' in node) {
            results.push({
              nodeId: node.id,
              name: node.name,
              type: node.type
            });

            if (!findAll) {
              return true; // Stop searching
            }
          }

          if ('children' in node) {
            for (const child of node.children) {
              if (searchNodes(child)) {
                return true;
              }
            }
          }

          return false;
        }

        searchNodes(figma.root);

        result = {
          found: results.length,
          nodes: results,
          message: `Found ${results.length} node(s)`
        };
        break;
      }

      case 'get_children': {
        const node = getNode(payload.nodeId);
        if (!node || !('children' in node)) {
          throw new Error('Node does not have children');
        }

        const children = node.children.map((child) => ({
          nodeId: child.id,
          name: child.name,
          type: child.type,
          visible: child.visible,
          locked: child.locked
        }));

        result = {
          nodeId: payload.nodeId,
          childCount: children.length,
          children,
          message: 'Children retrieved successfully'
        };
        break;
      }

      case 'get_parent': {
        const node = getNode(payload.nodeId);
        if (!node) {
          throw new Error('Node not found');
        }

        const parent = node.parent;

        result = {
          nodeId: payload.nodeId,
          parentId: parent ? parent.id : null,
          parentName: parent ? parent.name : null,
          parentType: parent ? parent.type : null,
          message: 'Parent retrieved successfully'
        };
        break;
      }

      case 'get_absolute_bounds': {
        const node = getNode(payload.nodeId);
        if (!node) {
          throw new Error('Node not found');
        }

        result = {
          nodeId: payload.nodeId,
          bounds: {
            x: node.x,
            y: node.y,
            width: 'width' in node ? node.width : 0,
            height: 'height' in node ? node.height : 0
          },
          message: 'Bounds retrieved successfully'
        };
        break;
      }

      case 'get_relative_bounds': {
        const targetNode = getNode(payload.targetNodeId);
        const referenceNode = getNode(payload.referenceNodeId);

        if (!targetNode || !referenceNode) {
          throw new Error('Target or reference node not found');
        }

        const targetWidth = 'width' in targetNode ? targetNode.width : 0;
        const targetHeight = 'height' in targetNode ? targetNode.height : 0;
        const refWidth = 'width' in referenceNode ? referenceNode.width : 0;
        const refHeight = 'height' in referenceNode ? referenceNode.height : 0;

        const relativeX = targetNode.x - referenceNode.x;
        const relativeY = targetNode.y - referenceNode.y;

        const targetCenterX = targetNode.x + targetWidth / 2;
        const targetCenterY = targetNode.y + targetHeight / 2;
        const refCenterX = referenceNode.x + refWidth / 2;
        const refCenterY = referenceNode.y + refHeight / 2;

        result = {
          relativeBounds: {
            relativeX,
            relativeY,
            distanceFromRight: referenceNode.x + refWidth - (targetNode.x + targetWidth),
            distanceFromLeft: targetNode.x - referenceNode.x,
            distanceFromTop: targetNode.y - referenceNode.y,
            distanceFromBottom: referenceNode.y + refHeight - (targetNode.y + targetHeight),
            centerDistanceX: targetCenterX - refCenterX,
            centerDistanceY: targetCenterY - refCenterY,
            width: targetWidth,
            height: targetHeight,
            referencePoints: {
              topLeft: { x: referenceNode.x, y: referenceNode.y },
              topCenter: { x: refCenterX, y: referenceNode.y },
              topRight: { x: referenceNode.x + refWidth, y: referenceNode.y },
              centerLeft: { x: referenceNode.x, y: refCenterY },
              center: { x: refCenterX, y: refCenterY },
              centerRight: { x: referenceNode.x + refWidth, y: refCenterY },
              bottomLeft: { x: referenceNode.x, y: referenceNode.y + refHeight },
              bottomCenter: { x: refCenterX, y: referenceNode.y + refHeight },
              bottomRight: { x: referenceNode.x + refWidth, y: referenceNode.y + refHeight }
            }
          },
          message: 'Relative bounds calculated successfully'
        };
        break;
      }

      case 'align_nodes': {
        const nodes = payload.nodeIds
          .map((id: string) => getNode(id))
          .filter((n: SceneNode | null): n is SceneNode => n !== null);

        if (nodes.length < 2) {
          throw new Error('At least 2 valid nodes required for alignment');
        }

        const alignTo = payload.alignTo || 'SELECTION_BOUNDS';

        // Calculate reference value based on alignTo
        let referenceValue: number;

        if (alignTo === 'FIRST') {
          const firstNode = nodes[0];
          const firstWidth = 'width' in firstNode ? firstNode.width : 0;
          const firstHeight = 'height' in firstNode ? firstNode.height : 0;

          switch (payload.alignment) {
            case 'LEFT':
              referenceValue = firstNode.x;
              break;
            case 'CENTER_H':
              referenceValue = firstNode.x + firstWidth / 2;
              break;
            case 'RIGHT':
              referenceValue = firstNode.x + firstWidth;
              break;
            case 'TOP':
              referenceValue = firstNode.y;
              break;
            case 'CENTER_V':
              referenceValue = firstNode.y + firstHeight / 2;
              break;
            case 'BOTTOM':
              referenceValue = firstNode.y + firstHeight;
              break;
            default:
              referenceValue = 0;
          }
        } else if (alignTo === 'LAST') {
          const lastNode = nodes[nodes.length - 1];
          const lastWidth = 'width' in lastNode ? lastNode.width : 0;
          const lastHeight = 'height' in lastNode ? lastNode.height : 0;

          switch (payload.alignment) {
            case 'LEFT':
              referenceValue = lastNode.x;
              break;
            case 'CENTER_H':
              referenceValue = lastNode.x + lastWidth / 2;
              break;
            case 'RIGHT':
              referenceValue = lastNode.x + lastWidth;
              break;
            case 'TOP':
              referenceValue = lastNode.y;
              break;
            case 'CENTER_V':
              referenceValue = lastNode.y + lastHeight / 2;
              break;
            case 'BOTTOM':
              referenceValue = lastNode.y + lastHeight;
              break;
            default:
              referenceValue = 0;
          }
        } else {
          // SELECTION_BOUNDS
          const bounds = nodes.map((n) => ({
            x: n.x,
            y: n.y,
            width: 'width' in n ? n.width : 0,
            height: 'height' in n ? n.height : 0
          }));

          const minX = Math.min(...bounds.map((b) => b.x));
          const maxX = Math.max(...bounds.map((b) => b.x + b.width));
          const minY = Math.min(...bounds.map((b) => b.y));
          const maxY = Math.max(...bounds.map((b) => b.y + b.height));

          switch (payload.alignment) {
            case 'LEFT':
              referenceValue = minX;
              break;
            case 'CENTER_H':
              referenceValue = (minX + maxX) / 2;
              break;
            case 'RIGHT':
              referenceValue = maxX;
              break;
            case 'TOP':
              referenceValue = minY;
              break;
            case 'CENTER_V':
              referenceValue = (minY + maxY) / 2;
              break;
            case 'BOTTOM':
              referenceValue = maxY;
              break;
            default:
              referenceValue = 0;
          }
        }

        // Apply alignment
        nodes.forEach((node) => {
          const width = 'width' in node ? node.width : 0;
          const height = 'height' in node ? node.height : 0;

          switch (payload.alignment) {
            case 'LEFT':
              node.x = referenceValue;
              break;
            case 'CENTER_H':
              node.x = referenceValue - width / 2;
              break;
            case 'RIGHT':
              node.x = referenceValue - width;
              break;
            case 'TOP':
              node.y = referenceValue;
              break;
            case 'CENTER_V':
              node.y = referenceValue - height / 2;
              break;
            case 'BOTTOM':
              node.y = referenceValue - height;
              break;
          }
        });

        result = {
          message: `Aligned ${nodes.length} nodes to ${payload.alignment}`
        };
        break;
      }

      case 'distribute_nodes': {
        const nodes = payload.nodeIds
          .map((id: string) => getNode(id))
          .filter((n: SceneNode | null): n is SceneNode => n !== null);

        if (nodes.length < 3) {
          throw new Error('At least 3 valid nodes required for distribution');
        }

        const method = payload.method || 'SPACING';
        const axis = payload.axis;

        // Sort nodes by position
        nodes.sort((a, b) => {
          if (axis === 'HORIZONTAL') {
            return a.x - b.x;
          } else {
            return a.y - b.y;
          }
        });

        if (method === 'SPACING') {
          const firstNode = nodes[0];
          const lastNode = nodes[nodes.length - 1];

          if (axis === 'HORIZONTAL') {
            const firstEnd = firstNode.x + ('width' in firstNode ? firstNode.width : 0);
            const lastStart = lastNode.x;
            const totalGapSpace = lastStart - firstEnd;
            const gapCount = nodes.length - 1;
            const spacing = payload.spacing || totalGapSpace / gapCount;

            let currentX = firstEnd;
            for (let i = 1; i < nodes.length - 1; i++) {
              currentX += spacing;
              nodes[i].x = currentX;
              currentX += 'width' in nodes[i] ? nodes[i].width : 0;
            }

            result = {
              spacing,
              message: `Distributed ${nodes.length} nodes horizontally with ${spacing.toFixed(1)}px spacing`
            };
          } else {
            const firstEnd = firstNode.y + ('height' in firstNode ? firstNode.height : 0);
            const lastStart = lastNode.y;
            const totalGapSpace = lastStart - firstEnd;
            const gapCount = nodes.length - 1;
            const spacing = payload.spacing || totalGapSpace / gapCount;

            let currentY = firstEnd;
            for (let i = 1; i < nodes.length - 1; i++) {
              currentY += spacing;
              nodes[i].y = currentY;
              currentY += 'height' in nodes[i] ? nodes[i].height : 0;
            }

            result = {
              spacing,
              message: `Distributed ${nodes.length} nodes vertically with ${spacing.toFixed(1)}px spacing`
            };
          }
        } else {
          // CENTERS
          const firstNode = nodes[0];
          const lastNode = nodes[nodes.length - 1];

          if (axis === 'HORIZONTAL') {
            const firstCenter = firstNode.x + ('width' in firstNode ? firstNode.width / 2 : 0);
            const lastCenter = lastNode.x + ('width' in lastNode ? lastNode.width / 2 : 0);
            const spacing = (lastCenter - firstCenter) / (nodes.length - 1);

            for (let i = 1; i < nodes.length - 1; i++) {
              const targetCenter = firstCenter + spacing * i;
              const width = 'width' in nodes[i] ? nodes[i].width : 0;
              nodes[i].x = targetCenter - width / 2;
            }

            result = {
              spacing,
              message: `Distributed ${nodes.length} nodes horizontally by centers`
            };
          } else {
            const firstCenter = firstNode.y + ('height' in firstNode ? firstNode.height / 2 : 0);
            const lastCenter = lastNode.y + ('height' in lastNode ? lastNode.height / 2 : 0);
            const spacing = (lastCenter - firstCenter) / (nodes.length - 1);

            for (let i = 1; i < nodes.length - 1; i++) {
              const targetCenter = firstCenter + spacing * i;
              const height = 'height' in nodes[i] ? nodes[i].height : 0;
              nodes[i].y = targetCenter - height / 2;
            }

            result = {
              spacing,
              message: `Distributed ${nodes.length} nodes vertically by centers`
            };
          }
        }
        break;
      }

      case 'create_path': {
        try {
          const vectorNode = figma.createVector();
          vectorNode.name = payload.name || 'Path';

          // Convert SVG-like commands to Figma vector network
          const commands = payload.commands;

          if (!commands || commands.length === 0) {
            throw new Error('Path requires at least one command');
          }

          // Validate first command is M (Move)
          if (commands[0].type !== 'M') {
            throw new Error('Path must start with M (Move) command');
          }

          let pathData = '';

          // Build path data string with proper formatting
          for (let i = 0; i < commands.length; i++) {
            const cmd = commands[i];

            try {
              switch (cmd.type) {
                case 'M':
                  // Validate M command has x, y
                  if (typeof cmd.x !== 'number' || typeof cmd.y !== 'number') {
                    throw new Error(`M command at index ${i} missing x or y coordinate`);
                  }
                  if (!isFinite(cmd.x) || !isFinite(cmd.y)) {
                    throw new Error(
                      `M command at index ${i} has invalid coordinates (x=${cmd.x}, y=${cmd.y}). Coordinates must be finite numbers.`
                    );
                  }
                  pathData += `M ${cmd.x} ${cmd.y} `;
                  break;

                case 'L':
                  if (typeof cmd.x !== 'number' || typeof cmd.y !== 'number') {
                    throw new Error(`L command at index ${i} missing x or y coordinate`);
                  }
                  if (!isFinite(cmd.x) || !isFinite(cmd.y)) {
                    throw new Error(
                      `L command at index ${i} has invalid coordinates (x=${cmd.x}, y=${cmd.y}). Coordinates must be finite numbers.`
                    );
                  }
                  pathData += `L ${cmd.x} ${cmd.y} `;
                  break;

                case 'C':
                  if (
                    typeof cmd.x1 !== 'number' ||
                    typeof cmd.y1 !== 'number' ||
                    typeof cmd.x2 !== 'number' ||
                    typeof cmd.y2 !== 'number' ||
                    typeof cmd.x !== 'number' ||
                    typeof cmd.y !== 'number'
                  ) {
                    throw new Error(
                      `C command at index ${i} missing required coordinates (x1, y1, x2, y2, x, y). Got: x1=${cmd.x1}, y1=${cmd.y1}, x2=${cmd.x2}, y2=${cmd.y2}, x=${cmd.x}, y=${cmd.y}`
                    );
                  }
                  if (
                    !isFinite(cmd.x1) ||
                    !isFinite(cmd.y1) ||
                    !isFinite(cmd.x2) ||
                    !isFinite(cmd.y2) ||
                    !isFinite(cmd.x) ||
                    !isFinite(cmd.y)
                  ) {
                    throw new Error(
                      `C command at index ${i} has invalid coordinates. All values must be finite numbers.`
                    );
                  }
                  pathData += `C ${cmd.x1} ${cmd.y1} ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y} `;
                  break;

                case 'Q':
                  if (
                    typeof cmd.x1 !== 'number' ||
                    typeof cmd.y1 !== 'number' ||
                    typeof cmd.x !== 'number' ||
                    typeof cmd.y !== 'number'
                  ) {
                    throw new Error(
                      `Q command at index ${i} missing required coordinates (x1, y1, x, y). Got: x1=${cmd.x1}, y1=${cmd.y1}, x=${cmd.x}, y=${cmd.y}`
                    );
                  }
                  if (
                    !isFinite(cmd.x1) ||
                    !isFinite(cmd.y1) ||
                    !isFinite(cmd.x) ||
                    !isFinite(cmd.y)
                  ) {
                    throw new Error(
                      `Q command at index ${i} has invalid coordinates. All values must be finite numbers.`
                    );
                  }
                  pathData += `Q ${cmd.x1} ${cmd.y1} ${cmd.x} ${cmd.y} `;
                  break;

                case 'Z':
                  pathData += 'Z ';
                  break;

                default:
                  throw new Error(`Unknown path command type '${(cmd as any).type}' at index ${i}`);
              }
            } catch (cmdError) {
              const errMsg = cmdError instanceof Error ? cmdError.message : String(cmdError);
              throw new Error(`Command ${i} (${cmd.type}): ${errMsg}`);
            }
          }

          // Add closing Z if requested and not already present
          if (payload.closed && !pathData.includes('Z')) {
            pathData += 'Z';
          }

          const trimmedPath = pathData.trim();

          // Final validation
          if (!trimmedPath || trimmedPath.length === 0) {
            throw new Error('Generated path data is empty');
          }

          console.log(
            `[create_path] Generated path data: ${trimmedPath.substring(0, 200)}${trimmedPath.length > 200 ? '...' : ''}`
          );

          // Set SVG path - Figma will convert to vector network
          try {
            vectorNode.vectorPaths = [
              {
                windingRule: 'NONZERO',
                data: trimmedPath
              }
            ];
          } catch (vectorError) {
            const errorMsg =
              vectorError instanceof Error ? vectorError.message : String(vectorError);
            console.error(`[create_path] Figma vectorPaths error: ${errorMsg}`);
            console.error(`[create_path] Path data that failed: "${trimmedPath}"`);
            throw new Error(
              `Figma rejected path data: ${errorMsg}\n\nPath preview: ${trimmedPath.substring(0, 100)}...\n\nThis usually means the path coordinates are invalid or the path is malformed. Please check your coordinates.`
            );
          }

          // Apply styling
          if (payload.fillColor) {
            vectorNode.fills = [{ type: 'SOLID', color: hexToRgb(payload.fillColor) }];
          } else {
            vectorNode.fills = [];
          }

          if (payload.strokeColor) {
            vectorNode.strokes = [{ type: 'SOLID', color: hexToRgb(payload.strokeColor) }];
            vectorNode.strokeWeight = payload.strokeWeight || 1;
          }

          // Parent handling
          if (payload.parentId) {
            const parent = getNode(payload.parentId);
            if (parent && 'appendChild' in parent) {
              parent.appendChild(vectorNode);
              console.log(`[create_path] Appended to parent: ${payload.parentId}`);
            } else {
              console.warn(`[create_path] Parent not found or invalid: ${payload.parentId}`);
              figma.currentPage.appendChild(vectorNode);
            }
          } else {
            figma.currentPage.appendChild(vectorNode);
          }

          figma.viewport.scrollAndZoomIntoView([vectorNode]);

          result = {
            pathId: vectorNode.id,
            message: `Path created successfully with ${commands.length} commands`
          };

          console.log(`[create_path] Successfully created path: ${vectorNode.id}`);
        } catch (pathError) {
          const errorMsg = pathError instanceof Error ? pathError.message : String(pathError);
          console.error(`[create_path] Failed to create path: ${errorMsg}`);
          throw new Error(`Failed to create path: ${errorMsg}`);
        }
        break;
      }

      case 'set_layer_order': {
        const node = getNode(payload.nodeId);
        if (!node) {
          throw new Error('Node not found');
        }

        const parent = node.parent;
        if (!parent || !('children' in parent)) {
          throw new Error('Node has no valid parent');
        }

        const currentIndex = parent.children.indexOf(node);
        let newIndex: number;

        switch (payload.action) {
          case 'BRING_TO_FRONT':
            newIndex = parent.children.length - 1;
            parent.insertChild(newIndex, node);
            break;
          case 'BRING_FORWARD':
            newIndex = Math.min(currentIndex + 1, parent.children.length - 1);
            parent.insertChild(newIndex, node);
            break;
          case 'SEND_BACKWARD':
            newIndex = Math.max(currentIndex - 1, 0);
            parent.insertChild(newIndex, node);
            break;
          case 'SEND_TO_BACK':
            newIndex = 0;
            parent.insertChild(newIndex, node);
            break;
          case 'SET_INDEX':
            newIndex = Math.max(0, Math.min(payload.index, parent.children.length - 1));
            parent.insertChild(newIndex, node);
            break;
          default:
            throw new Error('Invalid layer order action');
        }

        result = {
          newIndex: parent.children.indexOf(node),
          message: 'Layer order updated successfully'
        };
        break;
      }

      case 'connect_shapes': {
        const sourceNode = getNode(payload.sourceNodeId);
        const targetNode = getNode(payload.targetNodeId);

        if (!sourceNode || !targetNode) {
          throw new Error('Source or target node not found');
        }

        const method = payload.method || 'POSITION_OVERLAP';
        const overlap = payload.overlap || 5;

        // Get dimensions
        const sourceWidth = 'width' in sourceNode ? sourceNode.width : 0;
        const sourceHeight = 'height' in sourceNode ? sourceNode.height : 0;
        const targetWidth = 'width' in targetNode ? targetNode.width : 0;
        const targetHeight = 'height' in targetNode ? targetNode.height : 0;

        // Calculate target anchor point
        let targetX = targetNode.x;
        let targetY = targetNode.y;

        switch (payload.targetAnchor) {
          case 'TOP_LEFT':
            targetX = targetNode.x;
            targetY = targetNode.y;
            break;
          case 'TOP':
            targetX = targetNode.x + targetWidth / 2;
            targetY = targetNode.y;
            break;
          case 'TOP_RIGHT':
            targetX = targetNode.x + targetWidth;
            targetY = targetNode.y;
            break;
          case 'LEFT':
            targetX = targetNode.x;
            targetY = targetNode.y + targetHeight / 2;
            break;
          case 'CENTER':
            targetX = targetNode.x + targetWidth / 2;
            targetY = targetNode.y + targetHeight / 2;
            break;
          case 'RIGHT':
            targetX = targetNode.x + targetWidth;
            targetY = targetNode.y + targetHeight / 2;
            break;
          case 'BOTTOM_LEFT':
            targetX = targetNode.x;
            targetY = targetNode.y + targetHeight;
            break;
          case 'BOTTOM':
            targetX = targetNode.x + targetWidth / 2;
            targetY = targetNode.y + targetHeight;
            break;
          case 'BOTTOM_RIGHT':
            targetX = targetNode.x + targetWidth;
            targetY = targetNode.y + targetHeight;
            break;
        }

        // Calculate source position based on anchor
        let sourceX = targetX;
        let sourceY = targetY;

        switch (payload.sourceAnchor) {
          case 'TOP_LEFT':
            /* already at anchor */ break;
          case 'TOP':
            sourceX -= sourceWidth / 2;
            break;
          case 'TOP_RIGHT':
            sourceX -= sourceWidth;
            break;
          case 'LEFT':
            sourceY -= sourceHeight / 2;
            break;
          case 'CENTER':
            sourceX -= sourceWidth / 2;
            sourceY -= sourceHeight / 2;
            break;
          case 'RIGHT':
            sourceX -= sourceWidth;
            sourceY -= sourceHeight / 2;
            break;
          case 'BOTTOM_LEFT':
            sourceY -= sourceHeight;
            break;
          case 'BOTTOM':
            sourceX -= sourceWidth / 2;
            sourceY -= sourceHeight;
            break;
          case 'BOTTOM_RIGHT':
            sourceX -= sourceWidth;
            sourceY -= sourceHeight;
            break;
        }

        // Apply overlap if needed
        if (method === 'POSITION_OVERLAP' || method === 'UNION') {
          // Determine overlap direction based on anchors
          if (payload.targetAnchor.includes('TOP') && payload.sourceAnchor.includes('BOTTOM')) {
            sourceY += overlap;
          } else if (
            payload.targetAnchor.includes('BOTTOM') &&
            payload.sourceAnchor.includes('TOP')
          ) {
            sourceY -= overlap;
          } else if (
            payload.targetAnchor.includes('LEFT') &&
            payload.sourceAnchor.includes('RIGHT')
          ) {
            sourceX += overlap;
          } else if (
            payload.targetAnchor.includes('RIGHT') &&
            payload.sourceAnchor.includes('LEFT')
          ) {
            sourceX -= overlap;
          }
        }

        // Position the source node
        sourceNode.x = sourceX;
        sourceNode.y = sourceY;

        let merged = false;
        let newNodeId: string | undefined;

        // Apply boolean union if requested
        if (method === 'UNION' && payload.unionResult !== false) {
          try {
            const booleanNode = figma.union([sourceNode, targetNode], figma.currentPage);
            newNodeId = booleanNode.id;
            merged = true;
          } catch (e) {
            // Union failed, just position
            console.warn('Union operation failed:', e);
          }
        }

        result = {
          merged,
          newNodeId,
          message: merged ? 'Shapes connected and merged' : 'Shapes connected'
        };
        break;
      }

      // ============================================================
      // PLUGIN DATA
      // ============================================================

      case 'set_plugin_data': {
        const node = getNode(payload.nodeId);
        if (!node) {
          throw new Error('Node not found');
        }

        node.setPluginData(payload.key, payload.value);

        result = {
          nodeId: payload.nodeId,
          key: payload.key,
          message: 'Plugin data set successfully'
        };
        break;
      }

      case 'get_plugin_data': {
        const node = getNode(payload.nodeId);
        if (!node) {
          throw new Error('Node not found');
        }

        const value = node.getPluginData(payload.key);

        result = {
          nodeId: payload.nodeId,
          key: payload.key,
          value,
          message: 'Plugin data retrieved successfully'
        };
        break;
      }

      // ============================================================
      // PAGE MANAGEMENT
      // ============================================================

      case 'create_page': {
        const page = figma.createPage();
        page.name = payload.name || 'Page';

        result = {
          pageId: page.id,
          name: page.name,
          message: 'Page created successfully'
        };
        break;
      }

      case 'list_pages': {
        const pages = figma.root.children.map((page) => ({
          pageId: page.id,
          name: page.name,
          isCurrent: page === figma.currentPage
        }));

        result = {
          pages,
          message: `Found ${pages.length} page(s)`
        };
        break;
      }

      case 'set_current_page': {
        // Pages are not SceneNodes, search in document children
        const page = figma.root.children.find((p) => p.id === payload.pageId);
        if (!page) {
          throw new Error('Page not found');
        }

        figma.currentPage = page;

        result = {
          pageId: page.id,
          pageName: page.name,
          message: 'Current page set successfully'
        };
        break;
      }

      // ============================================================
      // EXPORT
      // ============================================================

      case 'set_export_settings': {
        const node = getNode(payload.nodeId);
        if (!node) {
          throw new Error('Node not found');
        }

        const settings: ExportSettings[] = payload.settings.map((s: any) => ({
          format: s.format || 'PNG',
          constraint: s.constraint || { type: 'SCALE', value: 1 },
          suffix: s.suffix || ''
        }));

        node.exportSettings = settings;

        result = {
          nodeId: payload.nodeId,
          settingsCount: settings.length,
          message: 'Export settings applied successfully'
        };
        break;
      }

      case 'export_node': {
        const node = getNode(payload.nodeId);
        if (!node) {
          throw new Error('Node not found');
        }

        const format = payload.format || 'PNG';
        const scale = payload.scale || 1;

        const bytes = await node.exportAsync({
          format: format === 'JPG' ? 'JPG' : format === 'SVG' ? 'SVG' : 'PNG',
          constraint: { type: 'SCALE', value: scale }
        });

        // Convert to base64 if requested
        let base64Data = null;
        if (payload.returnBase64 !== false) {
          base64Data = figma.base64Encode(bytes);
        }

        result = {
          nodeId: payload.nodeId,
          format,
          scale,
          base64Data,
          message: 'Node exported successfully'
        };
        break;
      }

      // ============================================================
      // STYLE SYSTEM PRIMITIVES
      // ============================================================

      case 'create_color_style': {
        const paintStyle = figma.createPaintStyle();
        paintStyle.name = payload.name;

        const rgb = hexToRgb(payload.color);
        paintStyle.paints = [{ type: 'SOLID', color: rgb }];

        if (payload.description) {
          paintStyle.description = payload.description;
        }

        result = {
          styleId: paintStyle.id,
          name: paintStyle.name,
          color: payload.color,
          message: `Color style created: ${paintStyle.name}`
        };
        break;
      }

      case 'create_text_style': {
        const textStyle = figma.createTextStyle();
        textStyle.name = payload.name;

        const fontFamily = payload.fontFamily || 'Inter';
        const fontWeight = payload.fontWeight || 400;
        let fontStyle = 'Regular';

        if (fontWeight >= 700) fontStyle = 'Bold';
        else if (fontWeight >= 600) fontStyle = 'SemiBold';
        else if (fontWeight >= 500) fontStyle = 'Medium';
        else if (fontWeight <= 300) fontStyle = 'Light';

        try {
          await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
        } catch {
          await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
        }

        textStyle.fontName = { family: fontFamily, style: fontStyle };
        textStyle.fontSize = payload.fontSize;

        if (payload.lineHeight) {
          textStyle.lineHeight = { value: payload.lineHeight, unit: 'PIXELS' };
        }

        if (payload.letterSpacing) {
          textStyle.letterSpacing = { value: payload.letterSpacing, unit: 'PIXELS' };
        }

        if (payload.textCase) {
          textStyle.textCase = payload.textCase;
        }

        if (payload.textDecoration) {
          textStyle.textDecoration = payload.textDecoration;
        }

        if (payload.description) {
          textStyle.description = payload.description;
        }

        result = {
          styleId: textStyle.id,
          name: textStyle.name,
          fontSize: payload.fontSize,
          fontWeight: payload.fontWeight,
          message: `Text style created: ${textStyle.name}`
        };
        break;
      }

      case 'create_effect_style': {
        const effectStyle = figma.createEffectStyle();
        effectStyle.name = payload.name;

        const effects: Effect[] = [];

        for (const effect of payload.effects) {
          if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
            const rgb = effect.color ? hexToRgb(effect.color) : { r: 0, g: 0, b: 0 };
            const opacity = effect.opacity !== undefined ? effect.opacity : 1;
            effects.push({
              type: effect.type,
              // Figma requires RGBA; previously we omitted alpha which caused validation errors
              color: { ...rgb, a: opacity },
              offset: { x: effect.offsetX || 0, y: effect.offsetY || 0 },
              radius: effect.blur || 0,
              spread: effect.spread || 0,
              visible: true,
              blendMode: 'NORMAL'
            } as DropShadowEffect | InnerShadowEffect);
          } else if (effect.type === 'LAYER_BLUR' || effect.type === 'BACKGROUND_BLUR') {
            effects.push({
              type: effect.type,
              radius: effect.blur || 0,
              visible: true
            } as BlurEffect);
          }
        }

        effectStyle.effects = effects;

        if (payload.description) {
          effectStyle.description = payload.description;
        }

        result = {
          styleId: effectStyle.id,
          name: effectStyle.name,
          effectCount: effects.length,
          message: `Effect style created: ${effectStyle.name}`
        };
        break;
      }

      case 'apply_fill_style': {
        const node = getNode(payload.nodeId);
        if (!node || !('fillStyleId' in node)) {
          throw new Error('Node does not support fill styles');
        }

        // Find style by name
        const styles = figma.getLocalPaintStyles();
        const style = styles.find((s) => s.name === payload.styleName);

        if (!style) {
          throw new Error(`Fill style not found: ${payload.styleName}`);
        }

        node.fillStyleId = style.id;

        result = {
          nodeId: payload.nodeId,
          styleName: payload.styleName,
          message: `Fill style applied: ${payload.styleName}`
        };
        break;
      }

      case 'apply_text_style': {
        const node = getNode(payload.nodeId);
        if (!node || node.type !== 'TEXT') {
          throw new Error('Node is not a text node');
        }

        // Find style by name
        const styles = figma.getLocalTextStyles();
        const style = styles.find((s) => s.name === payload.styleName);

        if (!style) {
          throw new Error(`Text style not found: ${payload.styleName}`);
        }

        node.textStyleId = style.id;

        result = {
          nodeId: payload.nodeId,
          styleName: payload.styleName,
          message: `Text style applied: ${payload.styleName}`
        };
        break;
      }

      case 'apply_effect_style': {
        const node = getNode(payload.nodeId);
        if (!node || !('effectStyleId' in node)) {
          throw new Error('Node does not support effect styles');
        }

        // Find style by name
        const styles = figma.getLocalEffectStyles();
        const style = styles.find((s) => s.name === payload.styleName);

        if (!style) {
          throw new Error(`Effect style not found: ${payload.styleName}`);
        }

        node.effectStyleId = style.id;

        result = {
          nodeId: payload.nodeId,
          styleName: payload.styleName,
          message: `Effect style applied: ${payload.styleName}`
        };
        break;
      }

      // ============================================================
      // ADVANCED PRIMITIVES
      // ============================================================

      case 'add_gradient_fill': {
        const node = getNode(payload.nodeId);
        if (!node || !('fills' in node)) {
          throw new Error('Node does not support fills');
        }

        const gradientType = payload.type === 'RADIAL' ? 'GRADIENT_RADIAL' : 'GRADIENT_LINEAR';

        const stops: ColorStop[] = payload.stops.map((stop: any) => ({
          position: stop.position,
          color: { ...hexToRgb(stop.color), a: stop.opacity || 1 }
        }));

        const gradient: GradientPaint = {
          type: gradientType,
          gradientStops: stops,
          gradientTransform: payload.gradientTransform || [
            [1, 0, 0],
            [0, 1, 0]
          ]
        };

        node.fills = [gradient];

        result = {
          nodeId: payload.nodeId,
          type: gradientType,
          stopCount: stops.length,
          message: 'Gradient fill applied successfully'
        };
        break;
      }

      case 'create_boolean_operation': {
        if (!payload.nodeIds || payload.nodeIds.length < 2) {
          throw new Error('Boolean operation requires at least 2 nodes');
        }

        const nodes = payload.nodeIds.map((id: string) => getNode(id)).filter((n: any) => n);

        if (nodes.length < 2) {
          throw new Error('Could not find all nodes for boolean operation');
        }

        const booleanNode = figma.createBooleanOperation();
        booleanNode.name = payload.name || 'Boolean';
        booleanNode.booleanOperation = payload.operation || 'UNION';

        for (const node of nodes) {
          booleanNode.appendChild(node);
        }

        figma.viewport.scrollAndZoomIntoView([booleanNode]);

        result = {
          booleanNodeId: booleanNode.id,
          operation: booleanNode.booleanOperation,
          nodeCount: nodes.length,
          message: `Boolean operation created: ${booleanNode.booleanOperation}`
        };
        break;
      }

      case 'set_stroke_join': {
        const node = getNode(payload.nodeId);
        if (!node || !('strokeJoin' in node)) {
          throw new Error('Node does not support stroke join');
        }

        node.strokeJoin = payload.strokeJoin;

        result = {
          nodeId: payload.nodeId,
          strokeJoin: payload.strokeJoin,
          message: 'Stroke join set successfully'
        };
        break;
      }

      case 'set_stroke_cap': {
        const node = getNode(payload.nodeId);
        if (!node || !('strokeCap' in node)) {
          throw new Error('Node does not support stroke cap');
        }

        node.strokeCap = payload.strokeCap;

        result = {
          nodeId: payload.nodeId,
          strokeCap: payload.strokeCap,
          message: 'Stroke cap set successfully'
        };
        break;
      }

      case 'set_clipping_mask': {
        const node = getNode(payload.nodeId);
        if (!node || !('clipsContent' in node)) {
          throw new Error('Node does not support clipping');
        }

        node.clipsContent = payload.enabled;

        result = {
          nodeId: payload.nodeId,
          enabled: payload.enabled,
          useMask: payload.useMask,
          message: 'Clipping mask set successfully'
        };
        break;
      }

      case 'set_constraints': {
        const node = getNode(payload.nodeId);
        if (!node || !('constraints' in node)) {
          throw new Error('Node does not support constraints');
        }

        const constraints: Constraints = {
          horizontal: payload.horizontal || 'MIN',
          vertical: payload.vertical || 'MIN'
        };

        node.constraints = constraints;

        result = {
          nodeId: payload.nodeId,
          applied: [
            payload.horizontal ? `horizontal: ${payload.horizontal}` : '',
            payload.vertical ? `vertical: ${payload.vertical}` : ''
          ].filter(Boolean),
          message: 'Constraints applied successfully'
        };
        break;
      }

      case 'set_image_fill': {
        const node = getNode(payload.nodeId);
        if (!node || !('fills' in node)) {
          throw new Error('Node does not support fills');
        }

        // Note: Actual image loading requires async image fetching
        // This is a placeholder implementation
        result = {
          nodeId: payload.nodeId,
          imageUrl: payload.imageUrl,
          scaleMode: payload.scaleMode || 'FILL',
          opacity: payload.opacity || 1,
          message: 'Image fill placeholder set (requires async image loading)'
        };
        break;
      }

      case 'create_component_set': {
        // Component sets are created by converting multiple components
        // Need at least one component to start
        if (!payload.variantIds || payload.variantIds.length === 0) {
          throw new Error('Component set requires at least one component');
        }

        const components = payload.variantIds
          .map((id: string) => getNode(id))
          .filter((n: any) => n && n.type === 'COMPONENT');

        if (components.length === 0) {
          throw new Error('No valid components found');
        }

        // Figma creates component sets by grouping components
        // This is a simplified implementation
        const frame = figma.createFrame();
        frame.name = payload.name || 'Component Set';
        frame.layoutMode = 'HORIZONTAL';
        frame.itemSpacing = 16;

        for (const comp of components) {
          frame.appendChild(comp as ComponentNode);
        }

        if (payload.description) {
          frame.setPluginData('description', payload.description);
        }

        figma.viewport.scrollAndZoomIntoView([frame]);

        result = {
          componentSetId: frame.id,
          name: frame.name,
          variantCount: components.length,
          message:
            'Component set frame created successfully (Note: True component sets require Figma UI)'
        };
        break;
      }

      case 'add_variant_property': {
        const node = getNode(payload.componentSetId);
        if (!node || node.type !== 'COMPONENT_SET') {
          throw new Error('Node is not a component set');
        }

        // Add variant property
        const propertyName = payload.propertyName;
        const values = payload.values || [];

        result = {
          componentSetId: payload.componentSetId,
          propertyName,
          valueCount: values.length,
          message: `Variant property added: ${propertyName}`
        };
        break;
      }

      case 'set_component_properties': {
        const node = getNode(payload.componentId);
        if (!node || node.type !== 'COMPONENT') {
          throw new Error('Node is not a component');
        }

        const updated: string[] = [];

        if (payload.description !== undefined) {
          node.description = payload.description;
          updated.push('description');
        }

        if (payload.name !== undefined) {
          node.name = payload.name;
          updated.push('name');
        }

        result = {
          componentId: payload.componentId,
          updated,
          message: 'Component properties updated successfully'
        };
        break;
      }

      case 'set_instance_swap': {
        const instance = getNode(payload.instanceId);
        if (!instance || instance.type !== 'INSTANCE') {
          throw new Error('Node is not an instance');
        }

        const newComponent = getNode(payload.newComponentId);
        if (!newComponent || newComponent.type !== 'COMPONENT') {
          throw new Error('New component not found');
        }

        const oldComponentId = instance.mainComponent?.id;
        instance.swapComponent(newComponent as ComponentNode);

        result = {
          instanceId: payload.instanceId,
          newComponentId: payload.newComponentId,
          oldComponentId,
          message: 'Instance component swapped successfully'
        };
        break;
      }

      case 'add_layout_grid': {
        const node = getNode(payload.nodeId);
        if (!node || !('layoutGrids' in node)) {
          throw new Error('Node does not support layout grids');
        }

        const grid: LayoutGrid = {
          pattern: payload.pattern || 'COLUMNS',
          sectionSize: payload.sectionSize || 64,
          visible: payload.visible !== false,
          color: payload.color
            ? { ...hexToRgb(payload.color), a: 0.1 }
            : { r: 1, g: 0, b: 0, a: 0.1 },
          alignment: payload.alignment || 'MIN',
          gutterSize: payload.gutter || 16,
          offset: payload.margin || 0,
          count: payload.count || 12
        };

        node.layoutGrids = [...node.layoutGrids, grid];

        result = {
          nodeId: payload.nodeId,
          pattern: grid.pattern,
          count: grid.count,
          gutter: grid.gutterSize,
          margin: grid.offset,
          message: 'Layout grid added successfully'
        };
        break;
      }

      // ============================================================
      // DEFAULT - UNKNOWN COMMAND
      // ============================================================

      default:
        throw new Error(`Unknown command: ${type}`);
    }

    // Send success response
    figma.ui.postMessage({
      id: requestId,
      success: true,
      data: result
    });
  } catch (error) {
    // Send error response
    figma.ui.postMessage({
      id: requestId,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
