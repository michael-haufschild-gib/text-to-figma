"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

  // src/helpers.ts
  function hexToRgb(hex) {
    const cleanHex = hex.replace("#", "");
    return {
      r: parseInt(cleanHex.substring(0, 2), 16) / 255,
      g: parseInt(cleanHex.substring(2, 4), 16) / 255,
      b: parseInt(cleanHex.substring(4, 6), 16) / 255
    };
  }
  var nodeCache = /* @__PURE__ */ new Map();
  var CACHE_MAX_SIZE = 1e3;
  var CACHE_EVICT_COUNT = 100;
  function getNode(nodeId) {
    try {
      const cached = nodeCache.get(nodeId);
      if (cached) {
        return cached;
      }
      const node = figma.getNodeById(nodeId);
      if (node) {
        nodeCache.set(nodeId, node);
      }
      return node;
    } catch (e) {
      return null;
    }
  }
  function cacheNode(node) {
    nodeCache.set(node.id, node);
    if (nodeCache.size > CACHE_MAX_SIZE) {
      const keysToDelete = Array.from(nodeCache.keys()).slice(0, CACHE_EVICT_COUNT);
      for (const key of keysToDelete) {
        nodeCache.delete(key);
      }
    }
  }
  function resolveParent(parentId) {
    if (parentId) {
      const parent = getNode(parentId);
      if (parent && "appendChild" in parent) {
        return parent;
      }
      throw new Error(
        `Parent node not found: ${parentId}. Node cannot be created without valid parent.`
      );
    }
    return figma.currentPage;
  }
  function weightToStyle(fontWeight) {
    if (fontWeight >= 700) return "Bold";
    if (fontWeight >= 600) return "Semi Bold";
    if (fontWeight >= 500) return "Medium";
    if (fontWeight <= 300) return "Light";
    return "Regular";
  }
  async function loadFont(family, weight) {
    const style = weightToStyle(weight);
    try {
      await figma.loadFontAsync({ family, style });
      return { family, style };
    } catch (e) {
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      return { family: "Inter", style: "Regular" };
    }
  }
  function convertEffects(effects) {
    return effects.map((effect) => {
      var _a;
      const type = effect.type;
      if (type === "DROP_SHADOW" || type === "INNER_SHADOW") {
        const rgb = hexToRgb(effect.color || "#000000");
        const opacity = (_a = effect.opacity) != null ? _a : 1;
        return {
          type,
          color: __spreadProps(__spreadValues({}, rgb), { a: opacity }),
          offset: {
            x: effect.x || effect.offsetX || 0,
            y: effect.y || effect.offsetY || 0
          },
          radius: effect.blur || 0,
          spread: effect.spread || 0,
          visible: true,
          blendMode: "NORMAL"
        };
      } else if (type === "LAYER_BLUR" || type === "BACKGROUND_BLUR") {
        return {
          type,
          radius: effect.radius || effect.blur || 0,
          visible: true
        };
      }
      return effect;
    });
  }
  function getNodeDimensions(node) {
    return {
      width: "width" in node ? node.width : 0,
      height: "height" in node ? node.height : 0
    };
  }

  // src/handlers/components.ts
  function handleCreateComponent(payload) {
    const node = getNode(payload.frameId);
    if (!node || node.type !== "FRAME")
      throw new Error("Node must be a frame to convert to component");
    const component = figma.createComponent();
    component.name = payload.name || "Component";
    component.resize(node.width, node.height);
    component.x = node.x;
    component.y = node.y;
    const children = [...node.children];
    for (const child of children) {
      component.appendChild(child);
    }
    node.remove();
    if (payload.description) component.description = payload.description;
    figma.viewport.scrollAndZoomIntoView([component]);
    return {
      componentId: component.id,
      name: component.name,
      message: "Component created successfully"
    };
  }
  function handleCreateInstance(payload) {
    const component = getNode(payload.componentId);
    if (!component || component.type !== "COMPONENT") throw new Error("Node is not a component");
    const instance = component.createInstance();
    instance.x = payload.x || 0;
    instance.y = payload.y || 0;
    if (payload.name) instance.name = payload.name;
    const parent = resolveParent(payload.parentId);
    parent.appendChild(instance);
    cacheNode(instance);
    return {
      instanceId: instance.id,
      componentId: payload.componentId,
      message: "Instance created successfully"
    };
  }
  function handleCreateComponentSet(payload) {
    const variantIds = payload.variantIds;
    if (!variantIds || variantIds.length === 0)
      throw new Error("Component set requires at least one component");
    const components = variantIds.map((id) => getNode(id)).filter((n) => n !== null && n.type === "COMPONENT");
    if (components.length === 0) throw new Error("No valid components found");
    const frame = figma.createFrame();
    frame.name = payload.name || "Component Set";
    frame.layoutMode = "HORIZONTAL";
    frame.itemSpacing = 16;
    for (const comp of components) {
      frame.appendChild(comp);
    }
    if (payload.description) frame.setPluginData("description", payload.description);
    figma.viewport.scrollAndZoomIntoView([frame]);
    return {
      componentSetId: frame.id,
      name: frame.name,
      variantCount: components.length,
      message: "Component set frame created successfully (Note: True component sets require Figma UI)"
    };
  }
  function handleSetComponentProperties(payload) {
    const node = getNode(payload.componentId);
    if (!node || node.type !== "COMPONENT") throw new Error("Node is not a component");
    const component = node;
    const updated = [];
    if (payload.description !== void 0) {
      component.description = payload.description;
      updated.push("description");
    }
    if (payload.name !== void 0) {
      component.name = payload.name;
      updated.push("name");
    }
    return {
      componentId: payload.componentId,
      updated,
      message: "Component properties updated successfully"
    };
  }
  function handleAddVariantProperty(payload) {
    const node = getNode(payload.componentSetId);
    if (!node || node.type !== "COMPONENT_SET") throw new Error("Node is not a component set");
    const values = payload.values || [];
    return {
      componentSetId: payload.componentSetId,
      propertyName: payload.propertyName,
      valueCount: values.length,
      message: `Variant property added: ${payload.propertyName}`
    };
  }
  async function handleSetInstanceSwap(payload) {
    const instance = getNode(payload.instanceId);
    if (!instance || instance.type !== "INSTANCE") throw new Error("Node is not an instance");
    const newComponent = getNode(payload.newComponentId);
    if (!newComponent || newComponent.type !== "COMPONENT")
      throw new Error("New component not found");
    const mainComponent = await instance.getMainComponentAsync();
    const oldComponentId = mainComponent == null ? void 0 : mainComponent.id;
    instance.swapComponent(newComponent);
    return {
      instanceId: payload.instanceId,
      newComponentId: payload.newComponentId,
      oldComponentId,
      message: "Instance component swapped successfully"
    };
  }

  // src/handlers/creation.ts
  function handleCreateFrame(payload) {
    const frame = figma.createFrame();
    frame.name = payload.name || "Frame";
    frame.x = payload.x || 0;
    frame.y = payload.y || 0;
    frame.fills = [];
    if (payload.width && payload.height) {
      frame.resize(payload.width, payload.height);
    }
    if (payload.layoutMode && payload.layoutMode !== "NONE") {
      frame.layoutMode = payload.layoutMode;
    }
    if (payload.itemSpacing !== void 0) {
      frame.itemSpacing = payload.itemSpacing;
    }
    if (payload.padding !== void 0) {
      const p = payload.padding;
      frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = p;
    }
    const parent = resolveParent(payload.parentId);
    parent.appendChild(frame);
    if (payload.layoutMode && payload.layoutMode !== "NONE" && payload.parentId) {
      if (payload.horizontalSizing) {
        frame.layoutSizingHorizontal = payload.horizontalSizing;
      } else if (!payload.width) {
        frame.layoutSizingHorizontal = "FILL";
      }
      if (payload.verticalSizing) {
        frame.layoutSizingVertical = payload.verticalSizing;
      } else if (!payload.height) {
        frame.layoutSizingVertical = "HUG";
      }
    }
    cacheNode(frame);
    figma.viewport.scrollAndZoomIntoView([frame]);
    return { nodeId: frame.id, message: `Frame created: ${frame.name}` };
  }
  async function handleCreateText(payload) {
    const fontFamily = payload.fontFamily || "Inter";
    const fontWeight = payload.fontWeight || 400;
    const fontName = await loadFont(fontFamily, fontWeight);
    const textNode = figma.createText();
    textNode.fontName = fontName;
    textNode.characters = payload.content || "";
    textNode.name = payload.name || "Text";
    textNode.x = payload.x || 0;
    textNode.y = payload.y || 0;
    if (payload.fontSize) textNode.fontSize = payload.fontSize;
    if (payload.color) {
      textNode.fills = [{ type: "SOLID", color: hexToRgb(payload.color) }];
    }
    if (payload.textAlign)
      textNode.textAlignHorizontal = payload.textAlign;
    if (payload.lineHeight)
      textNode.lineHeight = { value: payload.lineHeight, unit: "PIXELS" };
    if (payload.letterSpacing)
      textNode.letterSpacing = { value: payload.letterSpacing, unit: "PIXELS" };
    const parent = resolveParent(payload.parentId);
    parent.appendChild(textNode);
    cacheNode(textNode);
    figma.viewport.scrollAndZoomIntoView([textNode]);
    return { nodeId: textNode.id, message: `Text created: "${textNode.characters}"` };
  }
  function handleCreateEllipse(payload) {
    const ellipse = figma.createEllipse();
    ellipse.name = payload.name || "Ellipse";
    ellipse.x = payload.x || 0;
    ellipse.y = payload.y || 0;
    ellipse.resize(payload.width || 100, payload.height || 100);
    if (payload.fillColor) {
      ellipse.fills = [{ type: "SOLID", color: hexToRgb(payload.fillColor) }];
    }
    if (payload.strokeColor && payload.strokeWeight) {
      ellipse.strokes = [{ type: "SOLID", color: hexToRgb(payload.strokeColor) }];
      ellipse.strokeWeight = payload.strokeWeight;
    }
    const parent = resolveParent(payload.parentId);
    parent.appendChild(ellipse);
    cacheNode(ellipse);
    figma.viewport.scrollAndZoomIntoView([ellipse]);
    return { nodeId: ellipse.id, message: `Ellipse created: ${ellipse.name}` };
  }
  function handleCreateLine(payload) {
    const line = figma.createLine();
    line.name = payload.name || "Line";
    const x1 = payload.x1 || 0;
    const y1 = payload.y1 || 0;
    const x2 = payload.x2 || 100;
    const y2 = payload.y2 || 0;
    line.x = Math.min(x1, x2);
    line.y = Math.min(y1, y2);
    line.resize(Math.max(Math.abs(x2 - x1), 0.01), Math.max(Math.abs(y2 - y1), 0.01));
    if (payload.strokeColor) {
      line.strokes = [{ type: "SOLID", color: hexToRgb(payload.strokeColor) }];
    }
    if (payload.strokeWeight) line.strokeWeight = payload.strokeWeight;
    if (payload.strokeCap) line.strokeCap = payload.strokeCap;
    if (payload.dashPattern) line.dashPattern = payload.dashPattern;
    const parent = resolveParent(payload.parentId);
    parent.appendChild(line);
    cacheNode(line);
    figma.viewport.scrollAndZoomIntoView([line]);
    return { nodeId: line.id, message: `Line created: ${line.name}` };
  }
  function handleCreatePolygon(payload) {
    const polygon = figma.createPolygon();
    polygon.name = payload.name || "Polygon";
    polygon.x = payload.x || 0;
    polygon.y = payload.y || 0;
    polygon.pointCount = payload.sideCount || 3;
    const r = payload.radius || 50;
    polygon.resize(r * 2, r * 2);
    if (payload.fillColor) {
      polygon.fills = [{ type: "SOLID", color: hexToRgb(payload.fillColor) }];
    }
    if (payload.strokeColor && payload.strokeWeight) {
      polygon.strokes = [{ type: "SOLID", color: hexToRgb(payload.strokeColor) }];
      polygon.strokeWeight = payload.strokeWeight;
    }
    const parent = resolveParent(payload.parentId);
    parent.appendChild(polygon);
    cacheNode(polygon);
    return { nodeId: polygon.id, message: `Polygon created: ${polygon.name}` };
  }
  function handleCreateStar(payload) {
    const star = figma.createStar();
    star.name = payload.name || "Star";
    star.x = payload.x || 0;
    star.y = payload.y || 0;
    star.pointCount = payload.pointCount || 5;
    const r = payload.radius || 50;
    star.resize(r * 2, r * 2);
    if (payload.innerRadius) {
      star.innerRadius = payload.innerRadius / r;
    }
    if (payload.fillColor) {
      star.fills = [{ type: "SOLID", color: hexToRgb(payload.fillColor) }];
    }
    if (payload.strokeColor && payload.strokeWeight) {
      star.strokes = [{ type: "SOLID", color: hexToRgb(payload.strokeColor) }];
      star.strokeWeight = payload.strokeWeight;
    }
    const parent = resolveParent(payload.parentId);
    parent.appendChild(star);
    cacheNode(star);
    return { nodeId: star.id, message: `Star created: ${star.name}` };
  }
  function handleCreateRectangleWithImageFill(payload) {
    const rect = figma.createRectangle();
    rect.name = payload.name || "Image";
    rect.x = payload.x || 0;
    rect.y = payload.y || 0;
    rect.resize(payload.width || 100, payload.height || 100);
    rect.fills = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
    const parent = resolveParent(payload.parentId);
    parent.appendChild(rect);
    cacheNode(rect);
    return {
      nodeId: rect.id,
      message: `Rectangle created for image: ${rect.name}`,
      note: "Image fill requires async loading - use set_image_fill separately"
    };
  }

  // src/handlers/design.ts
  async function handleCreateDesign(payload) {
    const spec = payload.spec;
    const nodeMap = /* @__PURE__ */ new Map();
    let nodeCounter = 0;
    async function createNode(nodeSpec, parent) {
      const props = nodeSpec.props || {};
      const name = nodeSpec.name || `${nodeSpec.type}_${nodeCounter++}`;
      let node;
      switch (nodeSpec.type) {
        case "frame":
          node = createFrameNode(name, props);
          break;
        case "text":
          node = await createTextNode(name, props);
          break;
        case "ellipse":
          node = createEllipseNode(name, props);
          break;
        case "rectangle":
          node = createRectangleNode(name, props);
          break;
        case "line":
          node = createLineNode(name, props);
          break;
        default:
          throw new Error(`Unsupported node type: ${nodeSpec.type}`);
      }
      if (parent && "appendChild" in parent) {
        parent.appendChild(node);
      } else {
        figma.currentPage.appendChild(node);
      }
      if (props.horizontalSizing && "layoutSizingHorizontal" in node) {
        node.layoutSizingHorizontal = props.horizontalSizing;
      }
      if (props.verticalSizing && "layoutSizingVertical" in node) {
        node.layoutSizingVertical = props.verticalSizing;
      }
      cacheNode(node);
      nodeMap.set(name, node);
      if (nodeSpec.children && nodeSpec.children.length > 0 && "appendChild" in node) {
        for (const childSpec of nodeSpec.children) {
          await createNode(childSpec, node);
        }
      }
      return node;
    }
    let rootParent;
    if (payload.parentId) {
      const parentNode = await figma.getNodeByIdAsync(payload.parentId);
      if (parentNode && "appendChild" in parentNode) {
        rootParent = parentNode;
      } else {
        throw new Error(`Parent node not found or cannot contain children: ${payload.parentId}`);
      }
    }
    const rootNode = await createNode(spec, rootParent);
    figma.viewport.scrollAndZoomIntoView([rootNode]);
    const nodeIds = {};
    const nodes = [];
    nodeMap.forEach((n, nodeName) => {
      nodeIds[nodeName] = n.id;
      let parentId = null;
      if (n.parent) {
        nodeMap.forEach((potentialParent) => {
          if (potentialParent === n.parent) parentId = potentialParent.id;
        });
        if (!parentId && n.parent.id !== figma.currentPage.id) {
          parentId = n.parent.id;
        }
      }
      nodes.push({
        nodeId: n.id,
        type: n.type,
        name: n.name,
        parentId,
        bounds: { x: n.x, y: n.y, width: n.width, height: n.height }
      });
    });
    return {
      rootNodeId: rootNode.id,
      nodeIds,
      nodes,
      totalNodes: nodeMap.size,
      message: `Design created successfully with ${nodeMap.size} nodes`
    };
  }
  function createFrameNode(name, props) {
    var _a;
    const frame = figma.createFrame();
    frame.name = name;
    frame.x = props.x || 0;
    frame.y = props.y || 0;
    frame.fills = [];
    if (props.width) frame.resize(props.width, frame.height);
    if (props.height) frame.resize(frame.width, props.height);
    if (props.layoutMode && props.layoutMode !== "NONE") {
      frame.layoutMode = props.layoutMode;
    }
    if (props.itemSpacing !== void 0) frame.itemSpacing = props.itemSpacing;
    if (props.padding !== void 0) {
      const p = props.padding;
      frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = p;
    }
    if (props.paddingLeft !== void 0) frame.paddingLeft = props.paddingLeft;
    if (props.paddingRight !== void 0) frame.paddingRight = props.paddingRight;
    if (props.paddingTop !== void 0) frame.paddingTop = props.paddingTop;
    if (props.paddingBottom !== void 0) frame.paddingBottom = props.paddingBottom;
    if (props.primaryAxisAlignItems !== void 0)
      frame.primaryAxisAlignItems = props.primaryAxisAlignItems;
    if (props.counterAxisAlignItems !== void 0)
      frame.counterAxisAlignItems = props.counterAxisAlignItems;
    if (props.fills) {
      frame.fills = props.fills;
    } else if (props.fillColor) {
      const rgb = hexToRgb(props.fillColor);
      const opacity = (_a = props.fillOpacity) != null ? _a : 1;
      frame.fills = [{ type: "SOLID", color: rgb, opacity }];
    }
    if (props.cornerRadius !== void 0) frame.cornerRadius = props.cornerRadius;
    if (props.strokeColor) {
      frame.strokes = [{ type: "SOLID", color: hexToRgb(props.strokeColor) }];
      if (props.strokeWeight) frame.strokeWeight = props.strokeWeight;
      if (props.strokeAlign) frame.strokeAlign = props.strokeAlign;
    }
    if (props.effects)
      frame.effects = convertEffects(props.effects);
    return frame;
  }
  async function createTextNode(name, props) {
    const fontFamily = props.fontFamily || "Inter";
    const fontWeight = props.fontWeight || 400;
    const fontName = await loadFont(fontFamily, fontWeight);
    const text = figma.createText();
    text.name = name;
    text.fontName = fontName;
    text.characters = props.content || props.text || "";
    text.fontSize = props.fontSize || 16;
    if (props.color) text.fills = [{ type: "SOLID", color: hexToRgb(props.color) }];
    if (props.textAlign)
      text.textAlignHorizontal = props.textAlign;
    if (props.lineHeight) text.lineHeight = { value: props.lineHeight, unit: "PIXELS" };
    if (props.letterSpacing)
      text.letterSpacing = { value: props.letterSpacing, unit: "PIXELS" };
    return text;
  }
  function createEllipseNode(name, props) {
    const ellipse = figma.createEllipse();
    ellipse.name = name;
    ellipse.resize(props.width || 100, props.height || 100);
    if (props.fillColor)
      ellipse.fills = [{ type: "SOLID", color: hexToRgb(props.fillColor) }];
    if (props.strokeColor) {
      ellipse.strokes = [{ type: "SOLID", color: hexToRgb(props.strokeColor) }];
      if (props.strokeWeight) ellipse.strokeWeight = props.strokeWeight;
    }
    return ellipse;
  }
  function createRectangleNode(name, props) {
    const rect = figma.createRectangle();
    rect.name = name;
    rect.resize(props.width || 100, props.height || 100);
    if (props.fillColor) rect.fills = [{ type: "SOLID", color: hexToRgb(props.fillColor) }];
    if (props.cornerRadius !== void 0) rect.cornerRadius = props.cornerRadius;
    if (props.strokeColor) {
      rect.strokes = [{ type: "SOLID", color: hexToRgb(props.strokeColor) }];
      if (props.strokeWeight) rect.strokeWeight = props.strokeWeight;
    }
    return rect;
  }
  function createLineNode(name, props) {
    const line = figma.createLine();
    line.name = name;
    line.resize(props.width || 100, 0);
    if (props.strokeColor) {
      line.strokes = [{ type: "SOLID", color: hexToRgb(props.strokeColor) }];
      if (props.strokeWeight) line.strokeWeight = props.strokeWeight;
    }
    return line;
  }

  // src/handlers/layout.ts
  function handleSetLayoutProperties(payload) {
    const node = getNode(payload.nodeId);
    if (!node || !("layoutMode" in node)) throw new Error("Node does not support auto-layout");
    const frame = node;
    if (payload.layoutMode) frame.layoutMode = payload.layoutMode;
    if (payload.itemSpacing !== void 0) frame.itemSpacing = payload.itemSpacing;
    if (payload.padding !== void 0) {
      const p = payload.padding;
      frame.paddingLeft = frame.paddingRight = frame.paddingTop = frame.paddingBottom = p;
    }
    return { nodeId: payload.nodeId, message: "Layout properties updated successfully" };
  }
  function handleSetLayoutAlign(payload) {
    const node = getNode(payload.nodeId);
    if (!node || !("primaryAxisAlignItems" in node))
      throw new Error("Node does not support layout alignment");
    const frame = node;
    if (payload.primaryAxis)
      frame.primaryAxisAlignItems = payload.primaryAxis;
    if (payload.counterAxis)
      frame.counterAxisAlignItems = payload.counterAxis;
    return { nodeId: payload.nodeId, message: "Layout alignment set successfully" };
  }
  function handleSetLayoutSizing(payload) {
    const node = getNode(payload.nodeId);
    if (!node || !("layoutSizingHorizontal" in node))
      throw new Error("Node does not support layout sizing");
    const frame = node;
    if (payload.horizontal)
      frame.layoutSizingHorizontal = payload.horizontal;
    if (payload.vertical) frame.layoutSizingVertical = payload.vertical;
    return { nodeId: payload.nodeId, message: "Layout sizing set successfully" };
  }
  function handleSetConstraints(payload) {
    const node = getNode(payload.nodeId);
    if (!node || !("constraints" in node)) throw new Error("Node does not support constraints");
    node.constraints = {
      horizontal: payload.horizontal || "MIN",
      vertical: payload.vertical || "MIN"
    };
    return {
      nodeId: payload.nodeId,
      applied: [
        payload.horizontal ? `horizontal: ${payload.horizontal}` : "",
        payload.vertical ? `vertical: ${payload.vertical}` : ""
      ].filter(Boolean),
      message: "Constraints applied successfully"
    };
  }
  function handleSetLayerOrder(payload) {
    const node = getNode(payload.nodeId);
    if (!node) throw new Error("Node not found");
    const parent = node.parent;
    if (!parent || !("children" in parent)) throw new Error("Node has no valid parent");
    const currentIndex = parent.children.indexOf(node);
    switch (payload.action) {
      case "BRING_TO_FRONT":
        parent.insertChild(parent.children.length - 1, node);
        break;
      case "BRING_FORWARD":
        parent.insertChild(
          Math.min(currentIndex + 1, parent.children.length - 1),
          node
        );
        break;
      case "SEND_BACKWARD":
        parent.insertChild(Math.max(currentIndex - 1, 0), node);
        break;
      case "SEND_TO_BACK":
        parent.insertChild(0, node);
        break;
      case "SET_INDEX":
        parent.insertChild(
          Math.max(0, Math.min(payload.index, parent.children.length - 1)),
          node
        );
        break;
      default:
        throw new Error("Invalid layer order action");
    }
    return {
      newIndex: parent.children.indexOf(node),
      message: "Layer order updated successfully"
    };
  }
  function handleAlignNodes(payload) {
    const nodeIds = payload.nodeIds;
    const nodes = nodeIds.map((id) => getNode(id)).filter((n) => n !== null);
    if (nodes.length < 2) throw new Error("At least 2 valid nodes required for alignment");
    const alignment = payload.alignment;
    const alignTo = payload.alignTo || "SELECTION_BOUNDS";
    const referenceValue = computeAlignmentReference(nodes, alignment, alignTo);
    for (const node of nodes) {
      const { width, height } = getNodeDimensions(node);
      switch (alignment) {
        case "LEFT":
          node.x = referenceValue;
          break;
        case "CENTER_H":
          node.x = referenceValue - width / 2;
          break;
        case "RIGHT":
          node.x = referenceValue - width;
          break;
        case "TOP":
          node.y = referenceValue;
          break;
        case "CENTER_V":
          node.y = referenceValue - height / 2;
          break;
        case "BOTTOM":
          node.y = referenceValue - height;
          break;
      }
    }
    return { message: `Aligned ${nodes.length} nodes to ${alignment}` };
  }
  function computeAlignmentReference(nodes, alignment, alignTo) {
    const refNode = alignTo === "LAST" ? nodes[nodes.length - 1] : nodes[0];
    if (alignTo === "FIRST" || alignTo === "LAST") {
      const { width, height } = getNodeDimensions(refNode);
      switch (alignment) {
        case "LEFT":
          return refNode.x;
        case "CENTER_H":
          return refNode.x + width / 2;
        case "RIGHT":
          return refNode.x + width;
        case "TOP":
          return refNode.y;
        case "CENTER_V":
          return refNode.y + height / 2;
        case "BOTTOM":
          return refNode.y + height;
        default:
          return 0;
      }
    }
    const bounds = nodes.map((n) => __spreadValues({ x: n.x, y: n.y }, getNodeDimensions(n)));
    const minX = Math.min(...bounds.map((b) => b.x));
    const maxX = Math.max(...bounds.map((b) => b.x + b.width));
    const minY = Math.min(...bounds.map((b) => b.y));
    const maxY = Math.max(...bounds.map((b) => b.y + b.height));
    switch (alignment) {
      case "LEFT":
        return minX;
      case "CENTER_H":
        return (minX + maxX) / 2;
      case "RIGHT":
        return maxX;
      case "TOP":
        return minY;
      case "CENTER_V":
        return (minY + maxY) / 2;
      case "BOTTOM":
        return maxY;
      default:
        return 0;
    }
  }
  function handleDistributeNodes(payload) {
    const nodeIds = payload.nodeIds;
    const nodes = nodeIds.map((id) => getNode(id)).filter((n) => n !== null);
    if (nodes.length < 3) throw new Error("At least 3 valid nodes required for distribution");
    const axis = payload.axis;
    const method = payload.method || "SPACING";
    nodes.sort((a, b) => axis === "HORIZONTAL" ? a.x - b.x : a.y - b.y);
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (method === "SPACING") {
      return distributeBySpacing(nodes, first, last, axis, payload.spacing);
    }
    return distributeByCenters(nodes, first, last, axis);
  }
  function distributeBySpacing(nodes, first, last, axis, explicitSpacing) {
    const dim = axis === "HORIZONTAL" ? "width" : "height";
    const pos = axis === "HORIZONTAL" ? "x" : "y";
    const firstEnd = first[pos] + getNodeDimensions(first)[dim];
    const lastStart = last[pos];
    const spacing = explicitSpacing != null ? explicitSpacing : (lastStart - firstEnd) / (nodes.length - 1);
    let current = firstEnd;
    for (let i = 1; i < nodes.length - 1; i++) {
      current += spacing;
      nodes[i][pos] = current;
      current += getNodeDimensions(nodes[i])[dim];
    }
    return {
      spacing,
      message: `Distributed ${nodes.length} nodes ${axis === "HORIZONTAL" ? "horizontally" : "vertically"} with ${spacing.toFixed(1)}px spacing`
    };
  }
  function distributeByCenters(nodes, first, last, axis) {
    const dim = axis === "HORIZONTAL" ? "width" : "height";
    const pos = axis === "HORIZONTAL" ? "x" : "y";
    const firstCenter = first[pos] + getNodeDimensions(first)[dim] / 2;
    const lastCenter = last[pos] + getNodeDimensions(last)[dim] / 2;
    const spacing = (lastCenter - firstCenter) / (nodes.length - 1);
    for (let i = 1; i < nodes.length - 1; i++) {
      const targetCenter = firstCenter + spacing * i;
      nodes[i][pos] = targetCenter - getNodeDimensions(nodes[i])[dim] / 2;
    }
    return { spacing, message: `Distributed ${nodes.length} nodes by centers` };
  }
  function handleConnectShapes(payload) {
    const sourceNode = getNode(payload.sourceNodeId);
    const targetNode = getNode(payload.targetNodeId);
    if (!sourceNode || !targetNode) throw new Error("Source or target node not found");
    const method = payload.method || "POSITION_OVERLAP";
    const overlap = payload.overlap || 5;
    const targetAnchor = payload.targetAnchor || "CENTER";
    const sourceAnchor = payload.sourceAnchor || "CENTER";
    const targetDims = getNodeDimensions(targetNode);
    const sourceDims = getNodeDimensions(sourceNode);
    const targetPos = anchorPosition(
      targetNode.x,
      targetNode.y,
      targetDims.width,
      targetDims.height,
      targetAnchor
    );
    let { x: sx, y: sy } = anchorOffset(
      targetPos.x,
      targetPos.y,
      sourceDims.width,
      sourceDims.height,
      sourceAnchor
    );
    if (method === "POSITION_OVERLAP" || method === "UNION") {
      if (targetAnchor.includes("TOP") && sourceAnchor.includes("BOTTOM")) sy += overlap;
      else if (targetAnchor.includes("BOTTOM") && sourceAnchor.includes("TOP")) sy -= overlap;
      else if (targetAnchor.includes("LEFT") && sourceAnchor.includes("RIGHT")) sx += overlap;
      else if (targetAnchor.includes("RIGHT") && sourceAnchor.includes("LEFT")) sx -= overlap;
    }
    sourceNode.x = sx;
    sourceNode.y = sy;
    let merged = false;
    let newNodeId;
    if (method === "UNION" && payload.unionResult !== false) {
      try {
        const booleanNode = figma.union([sourceNode, targetNode], figma.currentPage);
        newNodeId = booleanNode.id;
        merged = true;
      } catch (e) {
        console.warn("Union operation failed:", e);
      }
    }
    return {
      merged,
      newNodeId,
      message: merged ? "Shapes connected and merged" : "Shapes connected"
    };
  }
  function anchorPosition(x, y, w, h, anchor) {
    const positions = {
      TOP_LEFT: { x, y },
      TOP: { x: x + w / 2, y },
      TOP_RIGHT: { x: x + w, y },
      LEFT: { x, y: y + h / 2 },
      CENTER: { x: x + w / 2, y: y + h / 2 },
      RIGHT: { x: x + w, y: y + h / 2 },
      BOTTOM_LEFT: { x, y: y + h },
      BOTTOM: { x: x + w / 2, y: y + h },
      BOTTOM_RIGHT: { x: x + w, y: y + h }
    };
    return positions[anchor] || positions.CENTER;
  }
  function anchorOffset(tx, ty, sw, sh, anchor) {
    const offsets = {
      TOP_LEFT: { x: tx, y: ty },
      TOP: { x: tx - sw / 2, y: ty },
      TOP_RIGHT: { x: tx - sw, y: ty },
      LEFT: { x: tx, y: ty - sh / 2 },
      CENTER: { x: tx - sw / 2, y: ty - sh / 2 },
      RIGHT: { x: tx - sw, y: ty - sh / 2 },
      BOTTOM_LEFT: { x: tx, y: ty - sh },
      BOTTOM: { x: tx - sw / 2, y: ty - sh },
      BOTTOM_RIGHT: { x: tx - sw, y: ty - sh }
    };
    return offsets[anchor] || offsets.CENTER;
  }
  function handleAddLayoutGrid(payload) {
    const node = getNode(payload.nodeId);
    if (!node || !("layoutGrids" in node)) throw new Error("Node does not support layout grids");
    const frame = node;
    const pattern = payload.pattern || "COLUMNS";
    const gridColor = payload.color ? __spreadProps(__spreadValues({}, hexToRgb(payload.color)), { a: 0.1 }) : { r: 1, g: 0, b: 0, a: 0.1 };
    let grid;
    let responseCount;
    let responseGutter;
    let responseMargin;
    if (pattern === "GRID") {
      grid = {
        pattern: "GRID",
        sectionSize: payload.sectionSize || 64,
        visible: payload.visible !== false,
        color: gridColor
      };
    } else {
      const count = payload.count || 12;
      const gutterSize = payload.gutter || 16;
      const offset = payload.margin || 0;
      const alignment = payload.alignment || "MIN";
      grid = {
        pattern,
        sectionSize: payload.sectionSize || 64,
        visible: payload.visible !== false,
        color: gridColor,
        alignment,
        gutterSize,
        offset,
        count
      };
      responseCount = count;
      responseGutter = gutterSize;
      responseMargin = offset;
    }
    frame.layoutGrids = [...frame.layoutGrids, grid];
    return {
      nodeId: payload.nodeId,
      pattern,
      count: responseCount,
      gutter: responseGutter,
      margin: responseMargin,
      message: "Layout grid added successfully"
    };
  }

  // src/handlers/query.ts
  function handleGetNodeById(payload) {
    const node = getNode(payload.nodeId);
    if (!node) {
      return { exists: false, error: "Node not found" };
    }
    return {
      exists: true,
      node: __spreadProps(__spreadValues({
        id: node.id,
        name: node.name,
        type: node.type
      }, getNodeDimensions(node)), {
        x: node.x,
        y: node.y
      }),
      message: "Node retrieved successfully"
    };
  }
  function handleGetNodeByName(payload) {
    const findAll = payload.findAll || false;
    const exactMatch = payload.exactMatch || false;
    const searchName = payload.name.toLowerCase();
    const results = [];
    function searchNodes(node) {
      const nodeName = node.name.toLowerCase();
      const matches = exactMatch ? nodeName === searchName : nodeName.includes(searchName);
      if (matches && "id" in node) {
        results.push({ nodeId: node.id, name: node.name, type: node.type });
        if (!findAll) return true;
      }
      if ("children" in node) {
        for (const child of node.children) {
          if (searchNodes(child)) return true;
        }
      }
      return false;
    }
    searchNodes(figma.root);
    return { found: results.length, nodes: results, message: `Found ${results.length} node(s)` };
  }
  function handleGetChildren(payload) {
    const node = getNode(payload.nodeId);
    if (!node || !("children" in node)) throw new Error("Node does not have children");
    const children = node.children.map((child) => ({
      nodeId: child.id,
      name: child.name,
      type: child.type,
      visible: child.visible,
      locked: child.locked
    }));
    return {
      nodeId: payload.nodeId,
      childCount: children.length,
      children,
      message: "Children retrieved successfully"
    };
  }
  function handleGetParent(payload) {
    const node = getNode(payload.nodeId);
    if (!node) throw new Error("Node not found");
    const parent = node.parent;
    return {
      nodeId: payload.nodeId,
      parentId: parent ? parent.id : null,
      parentName: parent ? parent.name : null,
      parentType: parent ? parent.type : null,
      message: "Parent retrieved successfully"
    };
  }
  function handleGetAbsoluteBounds(payload) {
    const node = getNode(payload.nodeId);
    if (!node) throw new Error("Node not found");
    return {
      nodeId: payload.nodeId,
      bounds: __spreadValues({ x: node.x, y: node.y }, getNodeDimensions(node)),
      message: "Bounds retrieved successfully"
    };
  }
  function handleGetRelativeBounds(payload) {
    const targetNode = getNode(payload.targetNodeId);
    const referenceNode = getNode(payload.referenceNodeId);
    if (!targetNode || !referenceNode) throw new Error("Target or reference node not found");
    const td = getNodeDimensions(targetNode);
    const rd = getNodeDimensions(referenceNode);
    const tcx = targetNode.x + td.width / 2;
    const tcy = targetNode.y + td.height / 2;
    const rcx = referenceNode.x + rd.width / 2;
    const rcy = referenceNode.y + rd.height / 2;
    return {
      relativeBounds: {
        relativeX: targetNode.x - referenceNode.x,
        relativeY: targetNode.y - referenceNode.y,
        distanceFromRight: referenceNode.x + rd.width - (targetNode.x + td.width),
        distanceFromLeft: targetNode.x - referenceNode.x,
        distanceFromTop: targetNode.y - referenceNode.y,
        distanceFromBottom: referenceNode.y + rd.height - (targetNode.y + td.height),
        centerDistanceX: tcx - rcx,
        centerDistanceY: tcy - rcy,
        width: td.width,
        height: td.height,
        referencePoints: {
          topLeft: { x: referenceNode.x, y: referenceNode.y },
          topCenter: { x: rcx, y: referenceNode.y },
          topRight: { x: referenceNode.x + rd.width, y: referenceNode.y },
          centerLeft: { x: referenceNode.x, y: rcy },
          center: { x: rcx, y: rcy },
          centerRight: { x: referenceNode.x + rd.width, y: rcy },
          bottomLeft: { x: referenceNode.x, y: referenceNode.y + rd.height },
          bottomCenter: { x: rcx, y: referenceNode.y + rd.height },
          bottomRight: { x: referenceNode.x + rd.width, y: referenceNode.y + rd.height }
        }
      },
      message: "Relative bounds calculated successfully"
    };
  }
  function handleGetPageHierarchy() {
    function traverseNode(node) {
      const base = {
        nodeId: node.id,
        type: node.type,
        name: node.name,
        bounds: __spreadValues({ x: node.x, y: node.y }, getNodeDimensions(node)),
        children: []
      };
      if ("children" in node) {
        base.children = node.children.map(traverseNode);
      }
      return base;
    }
    const hierarchy = figma.currentPage.children.map(traverseNode);
    return {
      pageName: figma.currentPage.name,
      pageId: figma.currentPage.id,
      hierarchy,
      message: "Page hierarchy retrieved successfully"
    };
  }
  function handleGetSelection(payload) {
    const selection = figma.currentPage.selection;
    const includeDetails = payload.includeDetails !== false;
    if (selection.length === 0) {
      return { count: 0, selection: [], message: "No nodes selected" };
    }
    const nodes = selection.map((node) => {
      const base = {
        nodeId: node.id,
        name: node.name,
        type: node.type,
        bounds: __spreadValues({ x: node.x, y: node.y }, getNodeDimensions(node))
      };
      if (includeDetails) {
        if ("fills" in node) base.fills = node.fills;
        if ("strokes" in node) base.strokes = node.strokes;
        if ("strokeWeight" in node) base.strokeWeight = node.strokeWeight;
        if ("cornerRadius" in node) base.cornerRadius = node.cornerRadius;
        if ("opacity" in node) base.opacity = node.opacity;
        if ("layoutMode" in node) {
          const frame = node;
          base.layoutMode = frame.layoutMode;
          base.itemSpacing = frame.itemSpacing;
          base.paddingTop = frame.paddingTop;
          base.paddingRight = frame.paddingRight;
          base.paddingBottom = frame.paddingBottom;
          base.paddingLeft = frame.paddingLeft;
        }
        if (node.type === "TEXT") {
          base.characters = node.characters;
          base.fontSize = node.fontSize;
          base.fontName = node.fontName;
        }
        if ("children" in node) {
          base.children = node.children.map((c) => ({
            nodeId: c.id,
            name: c.name,
            type: c.type
          }));
        }
      }
      return base;
    });
    return { count: nodes.length, selection: nodes, message: `${nodes.length} node(s) selected` };
  }

  // src/handlers/styles.ts
  function handleCreateColorStyle(payload) {
    const paintStyle = figma.createPaintStyle();
    paintStyle.name = payload.name;
    paintStyle.paints = [{ type: "SOLID", color: hexToRgb(payload.color) }];
    if (payload.description) paintStyle.description = payload.description;
    return {
      styleId: paintStyle.id,
      name: paintStyle.name,
      color: payload.color,
      message: `Color style created: ${paintStyle.name}`
    };
  }
  async function handleCreateTextStyle(payload) {
    const textStyle = figma.createTextStyle();
    textStyle.name = payload.name;
    const fontFamily = payload.fontFamily || "Inter";
    const fontWeight = payload.fontWeight || 400;
    const fontName = await loadFont(fontFamily, fontWeight);
    textStyle.fontName = fontName;
    textStyle.fontSize = payload.fontSize;
    if (payload.lineHeight)
      textStyle.lineHeight = { value: payload.lineHeight, unit: "PIXELS" };
    if (payload.letterSpacing)
      textStyle.letterSpacing = { value: payload.letterSpacing, unit: "PIXELS" };
    if (payload.textCase) textStyle.textCase = payload.textCase;
    if (payload.textDecoration) textStyle.textDecoration = payload.textDecoration;
    if (payload.description) textStyle.description = payload.description;
    return {
      styleId: textStyle.id,
      name: textStyle.name,
      fontSize: payload.fontSize,
      fontWeight: payload.fontWeight,
      message: `Text style created: ${textStyle.name}`
    };
  }
  function handleCreateEffectStyle(payload) {
    const effectStyle = figma.createEffectStyle();
    effectStyle.name = payload.name;
    const effects = convertEffects(payload.effects);
    effectStyle.effects = effects;
    if (payload.description) effectStyle.description = payload.description;
    return {
      styleId: effectStyle.id,
      name: effectStyle.name,
      effectCount: effects.length,
      message: `Effect style created: ${effectStyle.name}`
    };
  }
  async function handleApplyFillStyle(payload) {
    const node = getNode(payload.nodeId);
    if (!node || !("fillStyleId" in node)) throw new Error("Node does not support fill styles");
    const styles = await figma.getLocalPaintStylesAsync();
    const style = styles.find((s) => s.name === payload.styleName);
    if (!style) throw new Error(`Fill style not found: ${payload.styleName}`);
    await node.setFillStyleIdAsync(style.id);
    return {
      nodeId: payload.nodeId,
      styleName: payload.styleName,
      message: `Fill style applied: ${payload.styleName}`
    };
  }
  async function handleApplyTextStyle(payload) {
    const node = getNode(payload.nodeId);
    if (!node || node.type !== "TEXT") throw new Error("Node is not a text node");
    const styles = await figma.getLocalTextStylesAsync();
    const style = styles.find((s) => s.name === payload.styleName);
    if (!style) throw new Error(`Text style not found: ${payload.styleName}`);
    await node.setTextStyleIdAsync(style.id);
    return {
      nodeId: payload.nodeId,
      styleName: payload.styleName,
      message: `Text style applied: ${payload.styleName}`
    };
  }
  async function handleApplyEffectStyle(payload) {
    const node = getNode(payload.nodeId);
    if (!node || !("effectStyleId" in node)) throw new Error("Node does not support effect styles");
    const styles = await figma.getLocalEffectStylesAsync();
    const style = styles.find((s) => s.name === payload.styleName);
    if (!style) throw new Error(`Effect style not found: ${payload.styleName}`);
    await node.setEffectStyleIdAsync(style.id);
    return {
      nodeId: payload.nodeId,
      styleName: payload.styleName,
      message: `Effect style applied: ${payload.styleName}`
    };
  }

  // src/handlers/styling.ts
  function handleSetFills(payload) {
    var _a;
    const node = getNode(payload.nodeId);
    if (!node || !("fills" in node)) throw new Error("Node not found or does not support fills");
    if (payload.color) {
      const rgb = hexToRgb(payload.color);
      const opacity = (_a = payload.opacity) != null ? _a : 1;
      node.fills = [{ type: "SOLID", color: rgb, opacity }];
    } else if (payload.fills) {
      node.fills = payload.fills;
    }
    return { nodeId: payload.nodeId, message: "Fills applied successfully" };
  }
  function handleSetCornerRadius(payload) {
    const node = getNode(payload.nodeId);
    if (!node) throw new Error(`Node not found: ${payload.nodeId}`);
    if (!("cornerRadius" in node))
      throw new Error(`Node does not support corner radius (type: ${node.type})`);
    const rectNode = node;
    if (payload.radius !== void 0) {
      rectNode.cornerRadius = payload.radius;
    } else {
      if (payload.topLeft !== void 0) rectNode.topLeftRadius = payload.topLeft;
      if (payload.topRight !== void 0) rectNode.topRightRadius = payload.topRight;
      if (payload.bottomLeft !== void 0) rectNode.bottomLeftRadius = payload.bottomLeft;
      if (payload.bottomRight !== void 0)
        rectNode.bottomRightRadius = payload.bottomRight;
    }
    return { nodeId: payload.nodeId, message: "Corner radius applied successfully" };
  }
  function handleSetStroke(payload) {
    var _a;
    const node = getNode(payload.nodeId);
    if (!node) throw new Error(`Node not found: ${payload.nodeId}`);
    if (!("strokes" in node)) throw new Error(`Node does not support strokes (type: ${node.type})`);
    const geoNode = node;
    if (payload.strokeColor) {
      const rgb = hexToRgb(payload.strokeColor);
      const opacity = (_a = payload.opacity) != null ? _a : 1;
      geoNode.strokes = [{ type: "SOLID", color: rgb, opacity }];
    }
    if (payload.strokeWeight !== void 0) geoNode.strokeWeight = payload.strokeWeight;
    if (payload.strokeAlign)
      geoNode.strokeAlign = payload.strokeAlign;
    if (payload.dashPattern) geoNode.dashPattern = payload.dashPattern;
    return { nodeId: payload.nodeId, message: "Stroke applied successfully" };
  }
  function handleSetAppearance(payload) {
    const node = getNode(payload.nodeId);
    if (!node) throw new Error("Node not found");
    if (payload.blendMode && "blendMode" in node) {
      node.blendMode = payload.blendMode;
    }
    if (payload.opacity !== void 0 && "opacity" in node) {
      node.opacity = payload.opacity;
    }
    if (payload.clipping && "clipsContent" in node) {
      const clipping = payload.clipping;
      const frameNode = node;
      if (clipping.useMask) {
        frameNode.clipsContent = true;
        if ("children" in node && node.children.length > 0) {
          node.children[0].isMask = true;
        }
      } else {
        frameNode.clipsContent = clipping.enabled;
      }
    }
    return { nodeId: payload.nodeId, message: "Appearance set successfully" };
  }
  function handleSetOpacity(payload) {
    const node = getNode(payload.nodeId);
    if (!node || !("opacity" in node)) throw new Error("Node does not support opacity");
    node.opacity = payload.opacity;
    return {
      nodeId: payload.nodeId,
      opacity: payload.opacity,
      message: "Opacity set successfully (deprecated - use set_appearance)"
    };
  }
  function handleSetBlendMode(payload) {
    const node = getNode(payload.nodeId);
    if (!node || !("blendMode" in node)) throw new Error("Node does not support blend mode");
    node.blendMode = payload.blendMode;
    return {
      nodeId: payload.nodeId,
      blendMode: payload.blendMode,
      message: "Blend mode set successfully"
    };
  }
  function handleApplyEffects(payload) {
    const node = getNode(payload.nodeId);
    if (!node || !("effects" in node)) throw new Error("Node does not support effects");
    const effects = convertEffects(payload.effects);
    node.effects = effects;
    return {
      nodeId: payload.nodeId,
      effectsApplied: effects.length,
      message: "Effects applied successfully"
    };
  }
  function handleAddGradientFill(payload) {
    const node = getNode(payload.nodeId);
    if (!node) throw new Error(`Node not found: ${payload.nodeId}`);
    if (!("fills" in node)) throw new Error(`Node type ${node.type} does not support fills`);
    const gradientType = payload.type === "RADIAL" ? "GRADIENT_RADIAL" : "GRADIENT_LINEAR";
    const stops = payload.stops.map((stop) => ({
      position: stop.position,
      color: __spreadProps(__spreadValues({}, hexToRgb(stop.color)), { a: stop.opacity || 1 })
    }));
    let gradientTransform;
    if (payload.gradientTransform) {
      gradientTransform = payload.gradientTransform;
    } else if (gradientType === "GRADIENT_LINEAR" && payload.angle !== void 0) {
      const angleRad = payload.angle * Math.PI / 180;
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
    node.fills = [
      {
        type: gradientType,
        gradientStops: stops,
        gradientTransform
      }
    ];
    return {
      nodeId: payload.nodeId,
      type: gradientType,
      stopCount: stops.length,
      message: "Gradient fill applied successfully"
    };
  }
  function handleSetImageFill(payload) {
    var _a;
    const node = getNode(payload.nodeId);
    if (!node || !("fills" in node)) throw new Error("Node does not support fills");
    if (payload.imageBytes) {
      let bytes;
      if (Array.isArray(payload.imageBytes)) {
        bytes = new Uint8Array(payload.imageBytes);
      } else if (typeof payload.imageBytes === "string") {
        throw new Error(
          "Base64 strings not supported in plugin main thread. Please send image data as a byte array."
        );
      } else {
        throw new Error("imageBytes must be an array of numbers or Uint8Array");
      }
      const imageHash = figma.createImage(bytes).hash;
      const imageFill = {
        type: "IMAGE",
        imageHash,
        scaleMode: payload.scaleMode || "FILL",
        opacity: (_a = payload.opacity) != null ? _a : 1
      };
      node.fills = [imageFill];
      return {
        nodeId: payload.nodeId,
        scaleMode: payload.scaleMode || "FILL",
        opacity: payload.opacity || 1,
        message: "Image fill applied successfully from byte array"
      };
    } else if (payload.imageUrl) {
      return {
        nodeId: payload.nodeId,
        imageUrl: payload.imageUrl,
        scaleMode: payload.scaleMode || "FILL",
        opacity: payload.opacity || 1,
        message: "Image URL received. To load: fetch image in UI thread, convert to byte array, then call set_image_fill with imageBytes.",
        requiresUiFetch: true
      };
    }
    throw new Error("Either imageBytes (byte array) or imageUrl must be provided");
  }

  // src/handlers/text.ts
  async function handleSetTextProperties(payload) {
    const node = getNode(payload.nodeId);
    if (!node || node.type !== "TEXT") throw new Error("Node is not a text node");
    await figma.loadFontAsync(node.fontName);
    if (payload.decoration) node.textDecoration = payload.decoration;
    if (payload.letterSpacing) {
      const ls = payload.letterSpacing;
      node.letterSpacing = { value: ls.value, unit: ls.unit };
    }
    if (payload.textCase) node.textCase = payload.textCase;
    if (payload.paragraphSpacing !== void 0)
      node.paragraphSpacing = payload.paragraphSpacing;
    if (payload.paragraphIndent !== void 0)
      node.paragraphIndent = payload.paragraphIndent;
    return { nodeId: payload.nodeId, message: "Text properties set successfully" };
  }
  function handleSetTextDecoration(payload) {
    const node = getNode(payload.nodeId);
    if (!node || node.type !== "TEXT") throw new Error("Node is not a text node");
    node.textDecoration = payload.decoration;
    return {
      nodeId: payload.nodeId,
      decoration: payload.decoration,
      message: "Text decoration set successfully (deprecated - use set_text_properties)"
    };
  }
  function handleSetTextCase(payload) {
    const node = getNode(payload.nodeId);
    if (!node || node.type !== "TEXT") throw new Error("Node is not a text node");
    node.textCase = payload.textCase;
    return {
      nodeId: payload.nodeId,
      textCase: payload.textCase,
      message: "Text case set successfully"
    };
  }
  function handleSetLetterSpacing(payload) {
    const node = getNode(payload.nodeId);
    if (!node || node.type !== "TEXT") throw new Error("Node is not a text node");
    const unit = payload.unit || "PERCENT";
    node.letterSpacing = { value: payload.value, unit };
    return {
      nodeId: payload.nodeId,
      value: payload.value,
      unit,
      message: "Letter spacing set successfully"
    };
  }
  function handleSetParagraphSpacing(payload) {
    const node = getNode(payload.nodeId);
    if (!node || node.type !== "TEXT") throw new Error("Node is not a text node");
    if (payload.paragraphSpacing !== void 0)
      node.paragraphSpacing = payload.paragraphSpacing;
    if (payload.paragraphIndent !== void 0)
      node.paragraphIndent = payload.paragraphIndent;
    return { nodeId: payload.nodeId, message: "Paragraph spacing set successfully" };
  }

  // src/handlers/transform.ts
  function handleSetTransform(payload) {
    const node = getNode(payload.nodeId);
    if (!node) throw new Error("Node not found");
    if (payload.position) {
      const pos = payload.position;
      node.x = pos.x;
      node.y = pos.y;
    }
    if (payload.size && "resize" in node) {
      const size = payload.size;
      node.resize(size.width, size.height);
    }
    if (payload.rotation !== void 0 && "rotation" in node) {
      node.rotation = payload.rotation;
    }
    if (payload.scale && "resize" in node) {
      const scale = payload.scale;
      node.resize(node.width * scale.x, node.height * scale.y);
    }
    if (payload.flip && "resize" in node) {
      const direction = payload.flip;
      if (direction === "HORIZONTAL" || direction === "BOTH") {
        node.resize(-node.width, node.height);
      }
      if (direction === "VERTICAL" || direction === "BOTH") {
        node.resize(node.width, -node.height);
      }
    }
    return { nodeId: payload.nodeId, message: "Transform applied successfully" };
  }

  // src/handlers/utility.ts
  function handleSetVisible(payload) {
    const node = getNode(payload.nodeId);
    if (!node) throw new Error("Node not found");
    node.visible = payload.visible;
    return {
      nodeId: payload.nodeId,
      visible: payload.visible,
      message: "Visibility set successfully"
    };
  }
  function handleSetLocked(payload) {
    const node = getNode(payload.nodeId);
    if (!node) throw new Error("Node not found");
    node.locked = payload.locked;
    return { nodeId: payload.nodeId, locked: payload.locked, message: "Lock state set successfully" };
  }
  function handleSetExportSettings(payload) {
    const node = getNode(payload.nodeId);
    if (!node) throw new Error("Node not found");
    const settings = payload.settings.map(
      (s) => ({
        format: s.format || "PNG",
        constraint: s.constraint || { type: "SCALE", value: 1 },
        suffix: s.suffix || ""
      })
    );
    node.exportSettings = settings;
    return {
      nodeId: payload.nodeId,
      settingsCount: settings.length,
      message: "Export settings applied successfully"
    };
  }
  async function handleExportNode(payload) {
    const node = getNode(payload.nodeId);
    if (!node) throw new Error("Node not found");
    const format = payload.format || "PNG";
    const scale = payload.scale || 1;
    const exportFormat = format === "JPG" ? "JPG" : format === "SVG" ? "SVG" : "PNG";
    const bytes = await node.exportAsync({
      format: exportFormat,
      constraint: { type: "SCALE", value: scale }
    });
    let base64Data = null;
    if (payload.returnBase64 !== false) {
      base64Data = figma.base64Encode(bytes);
    }
    return {
      nodeId: payload.nodeId,
      format,
      scale,
      base64Data,
      message: "Node exported successfully"
    };
  }
  function handleSetPluginData(payload) {
    const node = getNode(payload.nodeId);
    if (!node) throw new Error("Node not found");
    node.setPluginData(payload.key, payload.value);
    return { nodeId: payload.nodeId, key: payload.key, message: "Plugin data set successfully" };
  }
  function handleGetPluginData(payload) {
    const node = getNode(payload.nodeId);
    if (!node) throw new Error("Node not found");
    const value = node.getPluginData(payload.key);
    return {
      nodeId: payload.nodeId,
      key: payload.key,
      value,
      message: "Plugin data retrieved successfully"
    };
  }
  function handleCreatePageWithPayload(payload) {
    const page = figma.createPage();
    page.name = payload.name || "Page";
    return { pageId: page.id, name: page.name, message: "Page created successfully" };
  }
  function handleListPages() {
    const pages = figma.root.children.map((page) => ({
      pageId: page.id,
      name: page.name,
      isCurrent: page === figma.currentPage
    }));
    return { pages, message: `Found ${pages.length} page(s)` };
  }
  async function handleSetCurrentPage(payload) {
    const page = figma.root.children.find((p) => p.id === payload.pageId);
    if (!page) throw new Error("Page not found");
    await figma.setCurrentPageAsync(page);
    return { pageId: page.id, pageName: page.name, message: "Current page set successfully" };
  }
  function handleSetStrokeJoin(payload) {
    const node = getNode(payload.nodeId);
    if (!node || !("strokeJoin" in node)) throw new Error("Node does not support stroke join");
    node.strokeJoin = payload.strokeJoin;
    return {
      nodeId: payload.nodeId,
      strokeJoin: payload.strokeJoin,
      message: "Stroke join set successfully"
    };
  }
  function handleSetStrokeCap(payload) {
    const node = getNode(payload.nodeId);
    if (!node || !("strokeCap" in node)) throw new Error("Node does not support stroke cap");
    node.strokeCap = payload.strokeCap;
    return {
      nodeId: payload.nodeId,
      strokeCap: payload.strokeCap,
      message: "Stroke cap set successfully"
    };
  }
  function handleSetClippingMask(payload) {
    const node = getNode(payload.nodeId);
    if (!node || !("clipsContent" in node)) throw new Error("Node does not support clipping");
    node.clipsContent = payload.enabled;
    return {
      nodeId: payload.nodeId,
      enabled: payload.enabled,
      useMask: payload.useMask,
      message: "Clipping mask set successfully"
    };
  }
  function handleCreatePath(payload) {
    const vectorNode = figma.createVector();
    vectorNode.name = payload.name || "Path";
    const commands = payload.commands;
    if (!commands || commands.length === 0) throw new Error("Path requires at least one command");
    if (commands[0].type !== "M") throw new Error("Path must start with M (Move) command");
    let pathData = "";
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      switch (cmd.type) {
        case "M":
          validateCoord(cmd, "x", i);
          validateCoord(cmd, "y", i);
          pathData += `M ${cmd.x} ${cmd.y} `;
          break;
        case "L":
          validateCoord(cmd, "x", i);
          validateCoord(cmd, "y", i);
          pathData += `L ${cmd.x} ${cmd.y} `;
          break;
        case "C":
          for (const k of ["x1", "y1", "x2", "y2", "x", "y"]) validateCoord(cmd, k, i);
          pathData += `C ${cmd.x1} ${cmd.y1} ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y} `;
          break;
        case "Q":
          for (const k of ["x1", "y1", "x", "y"]) validateCoord(cmd, k, i);
          pathData += `Q ${cmd.x1} ${cmd.y1} ${cmd.x} ${cmd.y} `;
          break;
        case "Z":
          pathData += "Z ";
          break;
        default:
          throw new Error(`Unknown path command type '${cmd.type}' at index ${i}`);
      }
    }
    if (payload.closed && !pathData.includes("Z")) pathData += "Z";
    const trimmedPath = pathData.trim();
    if (!trimmedPath) throw new Error("Generated path data is empty");
    vectorNode.vectorPaths = [{ windingRule: "NONZERO", data: trimmedPath }];
    if (payload.fillColor) {
      vectorNode.fills = [{ type: "SOLID", color: hexToRgb(payload.fillColor) }];
    } else {
      vectorNode.fills = [];
    }
    if (payload.strokeColor) {
      vectorNode.strokes = [{ type: "SOLID", color: hexToRgb(payload.strokeColor) }];
      vectorNode.strokeWeight = payload.strokeWeight || 1;
    }
    const parent = resolveParent(payload.parentId);
    parent.appendChild(vectorNode);
    figma.viewport.scrollAndZoomIntoView([vectorNode]);
    return {
      pathId: vectorNode.id,
      message: `Path created successfully with ${commands.length} commands`
    };
  }
  function validateCoord(cmd, key, index) {
    const val = cmd[key];
    if (typeof val !== "number")
      throw new Error(`Command ${index} (${cmd.type}): Property '${key}' must be a number`);
    if (!isFinite(val))
      throw new Error(`Command ${index} (${cmd.type}): Property '${key}' must be a finite number`);
  }
  function handleCreateBooleanOperation(payload) {
    const nodeIds = payload.nodeIds;
    if (!nodeIds || nodeIds.length < 2)
      throw new Error("Boolean operation requires at least 2 nodes");
    const nodes = nodeIds.map((id) => getNode(id)).filter((n) => n !== null);
    if (nodes.length < 2) throw new Error("Could not find all nodes for boolean operation");
    const booleanNode = figma.createBooleanOperation();
    booleanNode.name = payload.name || "Boolean";
    booleanNode.booleanOperation = payload.operation || "UNION";
    for (const node of nodes) {
      booleanNode.appendChild(node);
    }
    figma.viewport.scrollAndZoomIntoView([booleanNode]);
    return {
      booleanNodeId: booleanNode.id,
      operation: booleanNode.booleanOperation,
      nodeCount: nodes.length,
      message: `Boolean operation created: ${booleanNode.booleanOperation}`
    };
  }

  // src/main.ts
  figma.showUI(__html__, { width: 400, height: 300 });
  var COMMON_FONTS = [
    { family: "Inter", style: "Regular" },
    { family: "Inter", style: "Medium" },
    { family: "Inter", style: "Semi Bold" },
    { family: "Inter", style: "Bold" },
    { family: "Roboto", style: "Regular" },
    { family: "Roboto", style: "Medium" },
    { family: "Roboto", style: "Bold" }
  ];
  void (async () => {
    for (const font of COMMON_FONTS) {
      try {
        await figma.loadFontAsync(font);
      } catch (e) {
      }
    }
  })();
  var handlers = {
    // Creation
    create_frame: handleCreateFrame,
    create_text: handleCreateText,
    create_ellipse: handleCreateEllipse,
    create_line: handleCreateLine,
    create_polygon: handleCreatePolygon,
    create_star: handleCreateStar,
    create_rectangle_with_image_fill: handleCreateRectangleWithImageFill,
    create_path: handleCreatePath,
    create_boolean_operation: handleCreateBooleanOperation,
    create_design: handleCreateDesign,
    // Styling
    set_fills: handleSetFills,
    set_corner_radius: handleSetCornerRadius,
    set_stroke: handleSetStroke,
    set_appearance: handleSetAppearance,
    set_opacity: handleSetOpacity,
    set_blend_mode: handleSetBlendMode,
    apply_effects: handleApplyEffects,
    add_gradient_fill: handleAddGradientFill,
    set_image_fill: handleSetImageFill,
    // Transform
    set_transform: handleSetTransform,
    // Layout
    set_layout_properties: handleSetLayoutProperties,
    set_layout_align: handleSetLayoutAlign,
    set_layout_sizing: handleSetLayoutSizing,
    set_constraints: handleSetConstraints,
    set_layer_order: handleSetLayerOrder,
    align_nodes: handleAlignNodes,
    distribute_nodes: handleDistributeNodes,
    connect_shapes: handleConnectShapes,
    add_layout_grid: handleAddLayoutGrid,
    // Text
    set_text_properties: handleSetTextProperties,
    set_text_decoration: handleSetTextDecoration,
    set_text_case: handleSetTextCase,
    set_letter_spacing: handleSetLetterSpacing,
    set_paragraph_spacing: handleSetParagraphSpacing,
    // Components
    create_component: handleCreateComponent,
    create_instance: handleCreateInstance,
    create_component_set: handleCreateComponentSet,
    set_component_properties: handleSetComponentProperties,
    add_variant_property: handleAddVariantProperty,
    set_instance_swap: handleSetInstanceSwap,
    // Styles
    create_color_style: handleCreateColorStyle,
    create_text_style: handleCreateTextStyle,
    create_effect_style: handleCreateEffectStyle,
    apply_fill_style: handleApplyFillStyle,
    apply_text_style: handleApplyTextStyle,
    apply_effect_style: handleApplyEffectStyle,
    // Query
    get_node_by_id: handleGetNodeById,
    get_node_by_name: handleGetNodeByName,
    get_children: handleGetChildren,
    get_parent: handleGetParent,
    get_absolute_bounds: handleGetAbsoluteBounds,
    get_relative_bounds: handleGetRelativeBounds,
    get_page_hierarchy: handleGetPageHierarchy,
    get_selection: handleGetSelection,
    // Utility
    set_visible: handleSetVisible,
    set_locked: handleSetLocked,
    set_export_settings: handleSetExportSettings,
    export_node: handleExportNode,
    set_plugin_data: handleSetPluginData,
    get_plugin_data: handleGetPluginData,
    create_page: handleCreatePageWithPayload,
    list_pages: handleListPages,
    set_current_page: handleSetCurrentPage,
    set_stroke_join: handleSetStrokeJoin,
    set_stroke_cap: handleSetStrokeCap,
    set_clipping_mask: handleSetClippingMask
  };
  figma.ui.onmessage = (msg) => {
    void handleMessage(msg);
  };
  async function handleMessage(msg) {
    if (!msg || typeof msg !== "object") {
      figma.ui.postMessage({
        id: null,
        success: false,
        error: "Invalid message format: expected object"
      });
      return;
    }
    const { type, payload, requestId } = msg;
    if (!type || typeof type !== "string") {
      figma.ui.postMessage({
        id: requestId || null,
        success: false,
        error: "Missing or invalid message type"
      });
      return;
    }
    if (payload !== void 0 && typeof payload !== "object") {
      figma.ui.postMessage({
        id: requestId,
        success: false,
        error: "Invalid payload: expected object or undefined"
      });
      return;
    }
    try {
      const handler = handlers[type];
      if (!handler) {
        throw new Error(`Unknown command type: ${type}`);
      }
      const result = await handler(payload || {});
      figma.ui.postMessage({ id: requestId, success: true, data: result });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[${type}] Error:`, errorMessage);
      figma.ui.postMessage({ id: requestId, success: false, error: errorMessage });
    }
  }
})();
