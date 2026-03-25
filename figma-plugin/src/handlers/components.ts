/**
 * Component Command Handlers
 *
 * Handles: create_component, create_instance, create_component_set,
 * set_component_properties, add_variant_property, set_instance_swap
 */

import { cacheNode, getNode, resolveParent, uncacheNode } from '../helpers.js';
import { validatePayload, type ValidationRule } from '../validate.js';

const createComponentRules: ValidationRule[] = [
  { field: 'frameId', type: 'string', required: true }
];
const createInstanceRules: ValidationRule[] = [
  { field: 'componentId', type: 'string', required: true }
];
const createComponentSetRules: ValidationRule[] = [
  { field: 'variantIds', type: 'array', required: true }
];
const setComponentPropertiesRules: ValidationRule[] = [
  { field: 'componentId', type: 'string', required: true }
];
const addVariantPropertyRules: ValidationRule[] = [
  { field: 'componentSetId', type: 'string', required: true },
  { field: 'propertyName', type: 'string', required: true }
];
const setInstanceSwapRules: ValidationRule[] = [
  { field: 'instanceId', type: 'string', required: true },
  { field: 'newComponentId', type: 'string', required: true }
];

export function handleCreateComponent(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, createComponentRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.frameId as string);
  if (node?.type !== 'FRAME') throw new Error('Node must be a frame to convert to component');

  const component = figma.createComponent();
  component.name = typeof payload.name === 'string' ? payload.name : 'Component';
  component.resize(node.width, node.height);
  component.x = node.x;
  component.y = node.y;

  component.fills = JSON.parse(JSON.stringify(node.fills)) as Paint[];
  component.strokes = JSON.parse(JSON.stringify(node.strokes)) as Paint[];
  component.effects = JSON.parse(JSON.stringify(node.effects)) as Effect[];
  component.strokeWeight = node.strokeWeight;
  component.strokeAlign = node.strokeAlign;
  component.cornerRadius = node.cornerRadius;
  component.clipsContent = node.clipsContent;
  if (node.layoutMode !== 'NONE') {
    component.layoutMode = node.layoutMode;
    component.primaryAxisSizingMode = node.primaryAxisSizingMode;
    component.counterAxisSizingMode = node.counterAxisSizingMode;
    component.primaryAxisAlignItems = node.primaryAxisAlignItems;
    component.counterAxisAlignItems = node.counterAxisAlignItems;
    component.itemSpacing = node.itemSpacing;
    component.paddingLeft = node.paddingLeft;
    component.paddingRight = node.paddingRight;
    component.paddingTop = node.paddingTop;
    component.paddingBottom = node.paddingBottom;
  }

  const children = [...node.children];
  for (const child of children) {
    component.appendChild(child);
  }
  uncacheNode(payload.frameId as string);
  node.remove();
  cacheNode(component);

  if (typeof payload.description === 'string') {
    component.description = payload.description;
  }
  figma.viewport.scrollAndZoomIntoView([component]);

  return {
    componentId: component.id,
    name: component.name,
    message: 'Component created successfully'
  };
}

export function handleCreateInstance(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, createInstanceRules);
  if (error !== null) throw new Error(error);

  const component = getNode(payload.componentId as string);
  if (component?.type !== 'COMPONENT') throw new Error('Node is not a component');

  const instance = component.createInstance();
  instance.x = typeof payload.x === 'number' ? payload.x : 0;
  instance.y = typeof payload.y === 'number' ? payload.y : 0;
  if (typeof payload.name === 'string') {
    instance.name = payload.name;
  }

  const parent = resolveParent(typeof payload.parentId === 'string' ? payload.parentId : undefined);
  parent.appendChild(instance);
  cacheNode(instance);

  return {
    instanceId: instance.id,
    componentId: payload.componentId,
    message: 'Instance created successfully'
  };
}

export function handleCreateComponentSet(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, createComponentSetRules);
  if (error !== null) throw new Error(error);

  const variantIds = payload.variantIds;
  if (
    !Array.isArray(variantIds) ||
    variantIds.length === 0 ||
    !variantIds.every((el: unknown) => typeof el === 'string')
  ) {
    throw new Error('Component set requires a non-empty array of string IDs');
  }

  const missingIds = variantIds.filter((id) => {
    const n = getNode(id);
    return n?.type !== 'COMPONENT';
  });
  if (missingIds.length > 0) {
    throw new Error(
      `Invalid or missing component IDs: ${missingIds.join(', ')}. All IDs must reference existing COMPONENT nodes.`
    );
  }

  const components = variantIds
    .map((id) => getNode(id))
    .filter((n): n is ComponentNode => n !== null && n.type === 'COMPONENT');

  if (components.length < 2) throw new Error('Component set requires at least 2 components');

  const componentSet = figma.combineAsVariants(components, figma.currentPage);
  componentSet.name = typeof payload.name === 'string' ? payload.name : 'Component Set';

  if (typeof payload.description === 'string') {
    componentSet.description = payload.description;
  }
  figma.viewport.scrollAndZoomIntoView([componentSet]);

  return {
    componentSetId: componentSet.id,
    name: componentSet.name,
    variantCount: components.length,
    message: 'Component set created successfully'
  };
}

export function handleSetComponentProperties(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, setComponentPropertiesRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.componentId as string);
  if (node?.type !== 'COMPONENT') throw new Error('Node is not a component');

  const component = node;
  const updated: string[] = [];

  if (typeof payload.description === 'string') {
    component.description = payload.description;
    updated.push('description');
  }
  if (typeof payload.name === 'string') {
    component.name = payload.name;
    updated.push('name');
  }

  return {
    componentId: payload.componentId,
    updated,
    message: 'Component properties updated successfully'
  };
}

export function handleAddVariantProperty(payload: Record<string, unknown>): unknown {
  const error = validatePayload(payload, addVariantPropertyRules);
  if (error !== null) throw new Error(error);

  const node = getNode(payload.componentSetId as string);
  if (node?.type !== 'COMPONENT_SET') throw new Error('Node is not a component set');

  const rawValues = payload.values;
  const values: string[] =
    Array.isArray(rawValues) && rawValues.every((el): el is string => typeof el === 'string')
      ? rawValues
      : [];

  const propertyName = String(payload.propertyName);
  const defaultValue = values.at(0) ?? 'Default';

  const children = [...node.children];
  if (children.length === 0) {
    throw new Error('Component set has no children to update');
  }

  for (const child of children) {
    if (child.type !== 'COMPONENT') continue;
    const currentName = child.name.trim();
    child.name =
      currentName.length > 0
        ? `${currentName}, ${propertyName}=${defaultValue}`
        : `${propertyName}=${defaultValue}`;
  }

  return {
    componentSetId: payload.componentSetId,
    propertyName,
    defaultValue,
    updatedVariants: children.filter((c) => c.type === 'COMPONENT').length,
    message: `Variant property "${propertyName}" added to ${String(children.length)} variant(s)`
  };
}

export async function handleSetInstanceSwap(payload: Record<string, unknown>): Promise<unknown> {
  const error = validatePayload(payload, setInstanceSwapRules);
  if (error !== null) throw new Error(error);

  const instance = getNode(payload.instanceId as string);
  if (instance?.type !== 'INSTANCE') throw new Error('Node is not an instance');

  const newComponent = getNode(payload.newComponentId as string);
  if (newComponent?.type !== 'COMPONENT') throw new Error('New component not found');

  const mainComponent = await instance.getMainComponentAsync();
  const oldComponentId = mainComponent?.id;
  instance.swapComponent(newComponent);

  return {
    instanceId: payload.instanceId,
    newComponentId: payload.newComponentId,
    oldComponentId,
    message: 'Instance component swapped successfully'
  };
}
