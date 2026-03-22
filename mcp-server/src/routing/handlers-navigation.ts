/**
 * Tool Handlers — Navigation & Query
 *
 * Handlers for tools that read/query Figma nodes without modifying them.
 */

import { z } from 'zod';
import { defineHandler, formatHierarchyTree, textResponse } from './handler-utils.js';

import {
  getPageHierarchy,
  getPageHierarchyToolDefinition,
  GetPageHierarchyInputSchema,
  type GetPageHierarchyInput,
  type GetPageHierarchyResult
} from '../tools/get_page_hierarchy.js';
import {
  getSelection,
  getSelectionToolDefinition,
  GetSelectionInputSchema,
  type GetSelectionInput,
  type GetSelectionResult
} from '../tools/get_selection.js';
import {
  getNodeInfo,
  getNodeInfoToolDefinition,
  GetNodeInfoInputSchema,
  type GetNodeInfoInput,
  type GetNodeInfoResult
} from '../tools/get_node_info.js';
import {
  getNodeById,
  getNodeByIdToolDefinition,
  GetNodeByIdInputSchema,
  type GetNodeByIdInput,
  type GetNodeByIdResult
} from '../tools/get_node_by_id.js';
import {
  getNodeByName,
  getNodeByNameToolDefinition,
  GetNodeByNameInputSchema,
  type GetNodeByNameInput,
  type GetNodeByNameResult
} from '../tools/get_node_by_name.js';
import {
  getChildren,
  getChildrenToolDefinition,
  GetChildrenInputSchema,
  type GetChildrenInput,
  type GetChildrenResult
} from '../tools/get_children.js';
import {
  getParent,
  getParentToolDefinition,
  GetParentInputSchema,
  type GetParentInput,
  type GetParentResult
} from '../tools/get_parent.js';
import {
  getAbsoluteBounds,
  getAbsoluteBoundsToolDefinition,
  GetAbsoluteBoundsInputSchema,
  type GetAbsoluteBoundsInput,
  type GetAbsoluteBoundsResult
} from '../tools/get_absolute_bounds.js';
import {
  getRelativeBounds,
  getRelativeBoundsToolDefinition,
  GetRelativeBoundsInputSchema,
  type GetRelativeBoundsInput,
  type GetRelativeBoundsResult
} from '../tools/get_relative_bounds.js';
import {
  getPluginData,
  getPluginDataToolDefinition,
  GetPluginDataInputSchema,
  type GetPluginDataInput,
  type GetPluginDataResult
} from '../tools/get_plugin_data.js';

export const navigationHandlers = [
  defineHandler<GetPageHierarchyInput, GetPageHierarchyResult>({
    name: 'get_page_hierarchy',
    schema: GetPageHierarchyInputSchema as z.ZodSchema<GetPageHierarchyInput>,
    execute: getPageHierarchy,
    formatResponse: (result) => {
      const hierarchyTree = formatHierarchyTree(result.hierarchy);
      let text = `Page Hierarchy\n\nSource: ${result.source === 'cache' ? 'Cached Registry' : 'Fresh from Figma'}\n`;
      text += `Total Nodes: ${result.stats.totalNodes}\nRoot Nodes: ${result.stats.rootNodes}\n\nNode Types:\n`;
      for (const [type, count] of Object.entries(result.stats.nodesByType)) {
        text += `  ${type}: ${count}\n`;
      }
      text += `\nHierarchy Tree:\n\n${hierarchyTree}`;
      return textResponse(text);
    },
    definition: getPageHierarchyToolDefinition
  }),

  defineHandler<GetSelectionInput, GetSelectionResult>({
    name: 'get_selection',
    schema: GetSelectionInputSchema as z.ZodSchema<GetSelectionInput>,
    execute: getSelection,
    formatResponse: (result) => {
      let text = `Selected Nodes\n\nCount: ${result.count}\n\n`;
      if (result.count === 0) {
        text += `No nodes selected. Please select a layer in Figma first.\n`;
      } else {
        text += `---\n\n${JSON.stringify(result.selection, null, 2)}`;
      }
      return textResponse(text);
    },
    definition: getSelectionToolDefinition
  }),

  defineHandler<GetNodeInfoInput, GetNodeInfoResult>({
    name: 'get_node_info',
    schema: GetNodeInfoInputSchema as z.ZodSchema<GetNodeInfoInput>,
    execute: (input) => Promise.resolve(getNodeInfo(input)),
    formatResponse: (result) => {
      if (!result.node) {
        return textResponse('Node not found');
      }
      let text = `Node Information\n\nNode: ${result.node.name}\nID: ${result.node.nodeId}\nType: ${result.node.type}\n`;
      if (result.node.bounds) {
        text += `Position: (${result.node.bounds.x}, ${result.node.bounds.y})\nSize: ${result.node.bounds.width} x ${result.node.bounds.height}\n`;
      }
      text += `Path: ${result.path.join(' > ')}\n\n`;
      if (result.parent) {
        text += `Parent: ${result.parent.name} (${result.parent.type})\n  ID: ${result.parent.nodeId}\n\n`;
      } else {
        text += `Parent: None (root node)\n\n`;
      }
      text += `Children: ${result.children.length}\n`;
      for (const child of result.children) {
        text += `  - ${child.name} (${child.type}) - ${child.nodeId}\n`;
      }
      return textResponse(text);
    },
    definition: getNodeInfoToolDefinition
  }),

  defineHandler<GetNodeByIdInput, GetNodeByIdResult>({
    name: 'get_node_by_id',
    schema: GetNodeByIdInputSchema as z.ZodSchema<GetNodeByIdInput>,
    execute: getNodeById,
    formatResponse: (r) => {
      let text = `${r.message}\nNode ID: ${r.nodeId}\nName: ${r.name}\nType: ${r.type}\n`;
      if (r.width !== undefined && r.height !== undefined) {
        text += `Dimensions: ${r.width}x${r.height}\n`;
      }
      if (r.x !== undefined && r.y !== undefined) {
        text += `Position: (${r.x}, ${r.y})\n`;
      }
      return textResponse(text);
    },
    definition: getNodeByIdToolDefinition
  }),

  defineHandler<GetNodeByNameInput, GetNodeByNameResult>({
    name: 'get_node_by_name',
    schema: GetNodeByNameInputSchema as z.ZodSchema<GetNodeByNameInput>,
    execute: getNodeByName,
    formatResponse: (r) => {
      let text = `${r.message}\nFound: ${r.found} node(s)\n\n`;
      if (r.nodes.length > 0) {
        text += 'Nodes:\n';
        r.nodes.forEach((node, i) => {
          text += `${i + 1}. ${node.name} (${node.type}) - ID: ${node.nodeId}\n`;
        });
      }
      return textResponse(text);
    },
    definition: getNodeByNameToolDefinition
  }),

  defineHandler<GetChildrenInput, GetChildrenResult>({
    name: 'get_children',
    schema: GetChildrenInputSchema as z.ZodSchema<GetChildrenInput>,
    execute: getChildren,
    formatResponse: (r) => {
      let text = `${r.message}\nNode ID: ${r.nodeId}\nChild Count: ${r.childCount}\n\n`;
      if (r.children.length > 0) {
        text += 'Children:\n';
        r.children.forEach((child, i) => {
          text += `${i + 1}. ${child.name} (${child.type}) - ID: ${child.nodeId}\n`;
          text += `   Visible: ${child.visible}, Locked: ${child.locked}\n`;
        });
      }
      return textResponse(text);
    },
    definition: getChildrenToolDefinition
  }),

  defineHandler<GetParentInput, GetParentResult>({
    name: 'get_parent',
    schema: GetParentInputSchema as z.ZodSchema<GetParentInput>,
    execute: getParent,
    formatResponse: (r) => {
      let text = `${r.message}\nNode ID: ${r.nodeId}\n`;
      if (r.parentId) {
        text += `Parent ID: ${r.parentId}\nParent Name: ${r.parentName}\nParent Type: ${r.parentType}\n`;
      }
      return textResponse(text);
    },
    definition: getParentToolDefinition
  }),

  defineHandler<GetAbsoluteBoundsInput, GetAbsoluteBoundsResult>({
    name: 'get_absolute_bounds',
    schema: GetAbsoluteBoundsInputSchema as z.ZodSchema<GetAbsoluteBoundsInput>,
    execute: getAbsoluteBounds,
    formatResponse: (r) =>
      textResponse(
        `${r.message}\nNode ID: ${r.nodeId}\nPosition: (${r.bounds.x}, ${r.bounds.y})\nDimensions: ${r.bounds.width}x${r.bounds.height}px\n`
      ),
    definition: getAbsoluteBoundsToolDefinition
  }),

  defineHandler<GetRelativeBoundsInput, GetRelativeBoundsResult>({
    name: 'get_relative_bounds',
    schema: GetRelativeBoundsInputSchema as z.ZodSchema<GetRelativeBoundsInput>,
    execute: getRelativeBounds,
    formatResponse: (r) => textResponse(r.message),
    definition: getRelativeBoundsToolDefinition
  }),

  defineHandler<GetPluginDataInput, GetPluginDataResult>({
    name: 'get_plugin_data',
    schema: GetPluginDataInputSchema as z.ZodSchema<GetPluginDataInput>,
    execute: getPluginData,
    formatResponse: (r) => {
      let text = `${r.message}\nNode ID: ${r.nodeId}\nKey: ${r.key}\n`;
      if (r.value !== '') {
        text += `Value: ${r.value}\n`;
      }
      return textResponse(text);
    },
    definition: getPluginDataToolDefinition
  })
];
