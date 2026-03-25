/**
 * Tool Handlers — Navigation & Query
 *
 * Handlers for tools that read/query Figma nodes without modifying them.
 */

import { handler as getPageHierarchy } from '../tools/get_page_hierarchy.js';
import { handler as getSelection } from '../tools/get_selection.js';
import { handler as getNodeInfo } from '../tools/get_node_info.js';
import { handler as getNodeById } from '../tools/get_node_by_id.js';
import { handler as getNodeByName } from '../tools/get_node_by_name.js';
import { handler as getChildren } from '../tools/get_children.js';
import { handler as getParent } from '../tools/get_parent.js';
import { handler as getAbsoluteBounds } from '../tools/get_absolute_bounds.js';
import { handler as getRelativeBounds } from '../tools/get_relative_bounds.js';
import { handler as getPluginData } from '../tools/get_plugin_data.js';

export const navigationHandlers = [
  getPageHierarchy,
  getSelection,
  getNodeInfo,
  getNodeById,
  getNodeByName,
  getChildren,
  getParent,
  getAbsoluteBounds,
  getRelativeBounds,
  getPluginData
];
