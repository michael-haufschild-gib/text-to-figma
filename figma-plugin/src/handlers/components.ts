/**
 * Component Command Handlers
 *
 * Handles: create_component, create_instance, create_component_set,
 * set_component_properties, add_variant_property, set_instance_swap
 */

import { z } from 'zod';
import { cacheNode, getNode, resolveParent, uncacheNode } from '../helpers.js';

// ── Return types ─────────────────────────────────────────────────────────────

interface ComponentResult {
  message: string;
  [key: string]: unknown;
}

const createComponentSchema = z.object({
  frameId: z.string(),
  name: z.string().optional(),
  description: z.string().optional()
});

const createInstanceSchema = z.object({
  componentId: z.string(),
  x: z.number().optional(),
  y: z.number().optional(),
  name: z.string().optional(),
  parentId: z.string().optional()
});

const createComponentSetSchema = z.object({
  variantIds: z.array(z.string()).min(1, 'Component set requires a non-empty array of string IDs'),
  name: z.string().optional(),
  description: z.string().optional()
});

const setComponentPropertiesSchema = z.object({
  componentId: z.string(),
  description: z.string().optional(),
  name: z.string().optional()
});

const addVariantPropertySchema = z.object({
  componentSetId: z.string(),
  propertyName: z.string(),
  values: z.array(z.string()).optional()
});

const setInstanceSwapSchema = z.object({
  instanceId: z.string(),
  newComponentId: z.string()
});

export function handleCreateComponent(payload: Record<string, unknown>): ComponentResult {
  const input = createComponentSchema.parse(payload);

  const node = getNode(input.frameId);
  if (node?.type !== 'FRAME') throw new Error('Node must be a frame to convert to component');

  const component = figma.createComponent();
  component.name = input.name ?? 'Component';
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
  uncacheNode(input.frameId);
  node.remove();
  cacheNode(component);

  if (input.description !== undefined) {
    component.description = input.description;
  }
  figma.viewport.scrollAndZoomIntoView([component]);

  return {
    componentId: component.id,
    name: component.name,
    message: 'Component created successfully'
  };
}

export function handleCreateInstance(payload: Record<string, unknown>): ComponentResult {
  const input = createInstanceSchema.parse(payload);

  const component = getNode(input.componentId);
  if (component?.type !== 'COMPONENT') throw new Error('Node is not a component');

  const instance = component.createInstance();
  instance.x = input.x ?? 0;
  instance.y = input.y ?? 0;
  if (input.name !== undefined) {
    instance.name = input.name;
  }

  const parent = resolveParent(input.parentId);
  parent.appendChild(instance);
  cacheNode(instance);

  return {
    instanceId: instance.id,
    componentId: input.componentId,
    message: 'Instance created successfully'
  };
}

export function handleCreateComponentSet(payload: Record<string, unknown>): ComponentResult {
  const input = createComponentSetSchema.parse(payload);

  const missingIds = input.variantIds.filter((id) => {
    const n = getNode(id);
    return n?.type !== 'COMPONENT';
  });
  if (missingIds.length > 0) {
    throw new Error(
      `Invalid or missing component IDs: ${missingIds.join(', ')}. All IDs must reference existing COMPONENT nodes.`
    );
  }

  const components = input.variantIds
    .map((id) => getNode(id))
    .filter((n): n is ComponentNode => n !== null && n.type === 'COMPONENT');

  if (components.length < 2) throw new Error('Component set requires at least 2 components');

  const componentSet = figma.combineAsVariants(components, figma.currentPage);
  componentSet.name = input.name ?? 'Component Set';

  if (input.description !== undefined) {
    componentSet.description = input.description;
  }
  figma.viewport.scrollAndZoomIntoView([componentSet]);

  return {
    componentSetId: componentSet.id,
    name: componentSet.name,
    variantCount: components.length,
    message: 'Component set created successfully'
  };
}

export function handleSetComponentProperties(payload: Record<string, unknown>): ComponentResult {
  const input = setComponentPropertiesSchema.parse(payload);

  const node = getNode(input.componentId);
  if (node?.type !== 'COMPONENT') throw new Error('Node is not a component');

  const component = node;
  const updated: string[] = [];

  if (input.description !== undefined) {
    component.description = input.description;
    updated.push('description');
  }
  if (input.name !== undefined) {
    component.name = input.name;
    updated.push('name');
  }

  return {
    componentId: input.componentId,
    updated,
    message: 'Component properties updated successfully'
  };
}

export function handleAddVariantProperty(payload: Record<string, unknown>): ComponentResult {
  const input = addVariantPropertySchema.parse(payload);

  const node = getNode(input.componentSetId);
  if (node?.type !== 'COMPONENT_SET') throw new Error('Node is not a component set');

  const values = input.values ?? [];
  const defaultValue = values[0] ?? 'Default';

  const children = [...node.children];
  if (children.length === 0) {
    throw new Error('Component set has no children to update');
  }

  for (const child of children) {
    if (child.type !== 'COMPONENT') continue;
    const currentName = child.name.trim();
    child.name =
      currentName.length > 0
        ? `${currentName}, ${input.propertyName}=${defaultValue}`
        : `${input.propertyName}=${defaultValue}`;
  }

  return {
    componentSetId: input.componentSetId,
    propertyName: input.propertyName,
    defaultValue,
    updatedVariants: children.filter((c) => c.type === 'COMPONENT').length,
    message: `Variant property "${input.propertyName}" added to ${String(children.length)} variant(s)`
  };
}

export async function handleSetInstanceSwap(
  payload: Record<string, unknown>
): Promise<ComponentResult> {
  const input = setInstanceSwapSchema.parse(payload);

  const instance = getNode(input.instanceId);
  if (instance?.type !== 'INSTANCE') throw new Error('Node is not an instance');

  const newComponent = getNode(input.newComponentId);
  if (newComponent?.type !== 'COMPONENT') throw new Error('New component not found');

  const mainComponent = await instance.getMainComponentAsync();
  const oldComponentId = mainComponent?.id;
  instance.swapComponent(newComponent);

  return {
    instanceId: input.instanceId,
    newComponentId: input.newComponentId,
    oldComponentId,
    message: 'Instance component swapped successfully'
  };
}
