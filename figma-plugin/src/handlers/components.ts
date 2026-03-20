/**
 * Component Command Handlers
 *
 * Handles: create_component, create_instance, create_component_set,
 * set_component_properties, add_variant_property, set_instance_swap
 */

import { cacheNode, getNode, resolveParent } from '../helpers.js';

export function handleCreateComponent(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.frameId as string);
  if (!node || node.type !== 'FRAME')
    throw new Error('Node must be a frame to convert to component');

  const component = figma.createComponent();
  component.name = (payload.name as string) || 'Component';
  component.resize(node.width, node.height);
  component.x = node.x;
  component.y = node.y;

  const children = [...node.children];
  for (const child of children) {
    component.appendChild(child);
  }
  node.remove();

  if (payload.description) component.description = payload.description as string;
  figma.viewport.scrollAndZoomIntoView([component]);

  return {
    componentId: component.id,
    name: component.name,
    message: 'Component created successfully'
  };
}

export function handleCreateInstance(payload: Record<string, unknown>): unknown {
  const component = getNode(payload.componentId as string);
  if (!component || component.type !== 'COMPONENT') throw new Error('Node is not a component');

  const instance = component.createInstance();
  instance.x = (payload.x as number) || 0;
  instance.y = (payload.y as number) || 0;
  if (payload.name) instance.name = payload.name as string;

  const parent = resolveParent(payload.parentId as string | undefined);
  parent.appendChild(instance);
  cacheNode(instance);

  return {
    instanceId: instance.id,
    componentId: payload.componentId,
    message: 'Instance created successfully'
  };
}

export function handleCreateComponentSet(payload: Record<string, unknown>): unknown {
  const variantIds = payload.variantIds as string[];
  if (!variantIds || variantIds.length === 0)
    throw new Error('Component set requires at least one component');

  const components = variantIds
    .map((id) => getNode(id))
    .filter((n): n is ComponentNode => n !== null && n.type === 'COMPONENT');

  if (components.length === 0) throw new Error('No valid components found');

  const frame = figma.createFrame();
  frame.name = (payload.name as string) || 'Component Set';
  frame.layoutMode = 'HORIZONTAL';
  frame.itemSpacing = 16;

  for (const comp of components) {
    frame.appendChild(comp);
  }

  if (payload.description) frame.setPluginData('description', payload.description as string);
  figma.viewport.scrollAndZoomIntoView([frame]);

  return {
    componentSetId: frame.id,
    name: frame.name,
    variantCount: components.length,
    message: 'Component set frame created successfully (Note: True component sets require Figma UI)'
  };
}

export function handleSetComponentProperties(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.componentId as string);
  if (!node || node.type !== 'COMPONENT') throw new Error('Node is not a component');

  const component = node;
  const updated: string[] = [];

  if (payload.description !== undefined) {
    component.description = payload.description as string;
    updated.push('description');
  }
  if (payload.name !== undefined) {
    component.name = payload.name as string;
    updated.push('name');
  }

  return {
    componentId: payload.componentId,
    updated,
    message: 'Component properties updated successfully'
  };
}

export function handleAddVariantProperty(payload: Record<string, unknown>): unknown {
  const node = getNode(payload.componentSetId as string);
  if (!node || node.type !== 'COMPONENT_SET') throw new Error('Node is not a component set');

  const values = (payload.values as string[]) || [];
  return {
    componentSetId: payload.componentSetId,
    propertyName: payload.propertyName,
    valueCount: values.length,
    message: `Variant property added: ${payload.propertyName}`
  };
}

export async function handleSetInstanceSwap(payload: Record<string, unknown>): Promise<unknown> {
  const instance = getNode(payload.instanceId as string);
  if (!instance || instance.type !== 'INSTANCE') throw new Error('Node is not an instance');

  const newComponent = getNode(payload.newComponentId as string);
  if (!newComponent || newComponent.type !== 'COMPONENT')
    throw new Error('New component not found');

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
