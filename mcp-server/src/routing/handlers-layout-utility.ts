/**
 * Tool Handlers — Layout, Pages, Validation & Utility
 *
 * Handlers for layout management, page operations, design validation,
 * export, and miscellaneous utility tools.
 */

import { handler as setLayoutProperties } from '../tools/set_layout_properties.js';
import { handler as setLayoutSizing } from '../tools/set_layout_sizing.js';
import { handler as setLayoutAlign } from '../tools/set_layout_align.js';
import { handler as alignNodes } from '../tools/align_nodes.js';
import { handler as distributeNodes } from '../tools/distribute_nodes.js';
import { handler as connectShapes } from '../tools/connect_shapes.js';
import { handler as setLayerOrder } from '../tools/set_layer_order.js';
import { handler as addLayoutGrid } from '../tools/add_layout_grid.js';
import { handler as setConstraints } from '../tools/set_constraints.js';
import { handler as validateDesignTokens } from '../tools/validate_design_tokens.js';
import { handler as checkWcagContrast } from '../tools/check_wcag_contrast.js';
import { handler as createPage } from '../tools/create_page.js';
import { handler as listPages } from '../tools/list_pages.js';
import { handler as setCurrentPage } from '../tools/set_current_page.js';
import { handler as exportNode } from '../tools/export_node.js';
import { handler as setExportSettings } from '../tools/set_export_settings.js';
import { handler as setVisible } from '../tools/set_visible.js';
import { handler as setLocked } from '../tools/set_locked.js';
import { handler as setPluginData } from '../tools/set_plugin_data.js';
import { handler as reparentNode } from '../tools/reparent_node.js';
import { handler as removeNode } from '../tools/remove_node.js';
import { handler as renameNode } from '../tools/rename_node.js';
import { handler as detachComponent } from '../tools/detach_component.js';
import { handler as groupNodes } from '../tools/group_nodes.js';

export const layoutUtilityHandlers = [
  setLayoutProperties,
  setLayoutSizing,
  setLayoutAlign,
  alignNodes,
  distributeNodes,
  connectShapes,
  setLayerOrder,
  addLayoutGrid,
  setConstraints,
  validateDesignTokens,
  checkWcagContrast,
  createPage,
  listPages,
  setCurrentPage,
  exportNode,
  setExportSettings,
  setVisible,
  setLocked,
  setPluginData,
  reparentNode,
  removeNode,
  renameNode,
  detachComponent,
  groupNodes
];
