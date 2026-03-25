/**
 * Tool Handlers — Layout, Pages, Validation & Utility
 *
 * Handlers for layout management, page operations, design validation,
 * export, and miscellaneous utility tools.
 */

import { defineHandler, textResponse } from './handler-utils.js';

import {
  setLayoutProperties,
  setLayoutPropertiesToolDefinition,
  SetLayoutPropertiesInputSchema,
  type SetLayoutPropertiesInput,
  type SetLayoutPropertiesResult
} from '../tools/set_layout_properties.js';
import {
  setLayoutSizing,
  setLayoutSizingToolDefinition,
  SetLayoutSizingInputSchema,
  type SetLayoutSizingInput,
  type SetLayoutSizingResult
} from '../tools/set_layout_sizing.js';
import {
  setLayoutAlign,
  setLayoutAlignToolDefinition,
  SetLayoutAlignInputSchema,
  type SetLayoutAlignInput,
  type SetLayoutAlignResult
} from '../tools/set_layout_align.js';
import {
  alignNodes,
  alignNodesToolDefinition,
  AlignNodesInputSchema,
  type AlignNodesInput,
  type AlignNodesResult
} from '../tools/align_nodes.js';
import {
  distributeNodes,
  distributeNodesToolDefinition,
  DistributeNodesInputSchema,
  type DistributeNodesInput,
  type DistributeNodesResult
} from '../tools/distribute_nodes.js';
import {
  connectShapes,
  connectShapesToolDefinition,
  ConnectShapesInputSchema,
  type ConnectShapesInput,
  type ConnectShapesResult
} from '../tools/connect_shapes.js';
import {
  setLayerOrder,
  setLayerOrderToolDefinition,
  SetLayerOrderInputSchema,
  type SetLayerOrderInput,
  type SetLayerOrderResult
} from '../tools/set_layer_order.js';
import {
  addLayoutGrid,
  addLayoutGridToolDefinition,
  AddLayoutGridInputSchema,
  type AddLayoutGridInput,
  type AddLayoutGridResult
} from '../tools/add_layout_grid.js';
import {
  setConstraints,
  setConstraintsToolDefinition,
  SetConstraintsInputSchema,
  type SetConstraintsInput,
  type SetConstraintsResult
} from '../tools/set_constraints.js';
import {
  formatValidationReport,
  validateDesignTokens,
  validateDesignTokensToolDefinition,
  DesignTokensInputSchema,
  type DesignTokensInput,
  type ValidationReport
} from '../tools/validate_design_tokens.js';
import {
  checkWcagContrast,
  checkWcagContrastToolDefinition,
  CheckWcagContrastInputSchema,
  formatContrastCheckResult,
  type CheckWcagContrastInput,
  type CheckWcagContrastResult
} from '../tools/check_wcag_contrast.js';
import {
  createPage,
  createPageToolDefinition,
  CreatePageInputSchema,
  type CreatePageInput,
  type CreatePageResult
} from '../tools/create_page.js';
import {
  listPages,
  listPagesToolDefinition,
  ListPagesInputSchema,
  type ListPagesInput,
  type ListPagesResult
} from '../tools/list_pages.js';
import {
  setCurrentPage,
  setCurrentPageToolDefinition,
  SetCurrentPageInputSchema,
  type SetCurrentPageInput,
  type SetCurrentPageResult
} from '../tools/set_current_page.js';
import {
  exportNode,
  exportNodeToolDefinition,
  ExportNodeInputSchema,
  type ExportNodeInput,
  type ExportNodeResult
} from '../tools/export_node.js';
import {
  setExportSettings,
  setExportSettingsToolDefinition,
  SetExportSettingsInputSchema,
  type SetExportSettingsInput,
  type SetExportSettingsResult
} from '../tools/set_export_settings.js';
import {
  setVisible,
  setVisibleToolDefinition,
  SetVisibleInputSchema,
  type SetVisibleInput,
  type SetVisibleResult
} from '../tools/set_visible.js';
import {
  setLocked,
  setLockedToolDefinition,
  SetLockedInputSchema,
  type SetLockedInput,
  type SetLockedResult
} from '../tools/set_locked.js';
import {
  setPluginData,
  setPluginDataToolDefinition,
  SetPluginDataInputSchema,
  type SetPluginDataInput,
  type SetPluginDataResult
} from '../tools/set_plugin_data.js';
import {
  reparentNode,
  reparentNodeToolDefinition,
  ReparentNodeInputSchema,
  type ReparentNodeInput,
  type ReparentNodeResult
} from '../tools/reparent_node.js';
import {
  removeNode,
  removeNodeToolDefinition,
  RemoveNodeInputSchema,
  type RemoveNodeInput,
  type RemoveNodeResult
} from '../tools/remove_node.js';
import {
  renameNode,
  renameNodeToolDefinition,
  RenameNodeInputSchema,
  type RenameNodeInput,
  type RenameNodeResult
} from '../tools/rename_node.js';
import {
  detachComponent,
  detachComponentToolDefinition,
  DetachComponentInputSchema,
  type DetachComponentInput,
  type DetachComponentResult
} from '../tools/detach_component.js';

export const layoutUtilityHandlers = [
  // ─── Layout ─────────────────────────────────────────────────────────────
  defineHandler<SetLayoutPropertiesInput, SetLayoutPropertiesResult>({
    name: 'set_layout_properties',
    schema: SetLayoutPropertiesInputSchema,
    execute: setLayoutProperties,
    formatResponse: (r) =>
      textResponse(
        `Layout Properties Updated\nNode ID: ${r.nodeId}\nUpdated Properties: ${r.updated.join(', ')}\n\nCSS Equivalent:\n  ${r.cssEquivalent}\n`
      ),
    definition: setLayoutPropertiesToolDefinition
  }),

  defineHandler<SetLayoutSizingInput, SetLayoutSizingResult>({
    name: 'set_layout_sizing',
    schema: SetLayoutSizingInputSchema,
    execute: setLayoutSizing,
    formatResponse: (r) => {
      let text = `${r.message}\nNode ID: ${r.nodeId}\n`;
      if (r.horizontal) {
        text += `Horizontal: ${r.horizontal}\n`;
      }
      if (r.vertical) {
        text += `Vertical: ${r.vertical}\n`;
      }
      text += `\nCSS Equivalent:\n${r.cssEquivalent}\n`;
      return textResponse(text);
    },
    definition: setLayoutSizingToolDefinition
  }),

  defineHandler<SetLayoutAlignInput, SetLayoutAlignResult>({
    name: 'set_layout_align',
    schema: SetLayoutAlignInputSchema,
    execute: setLayoutAlign,
    formatResponse: (r) => {
      let text = `${r.message}\nNode ID: ${r.nodeId}\n`;
      if (r.primaryAxis) {
        text += `Primary Axis: ${r.primaryAxis}\n`;
      }
      if (r.counterAxis) {
        text += `Counter Axis: ${r.counterAxis}\n`;
      }
      text += `\nCSS Equivalent:\n${r.cssEquivalent}\n`;
      return textResponse(text);
    },
    definition: setLayoutAlignToolDefinition
  }),

  defineHandler<AlignNodesInput, AlignNodesResult>({
    name: 'align_nodes',
    schema: AlignNodesInputSchema,
    execute: alignNodes,
    formatResponse: (r) => textResponse(r.message),
    definition: alignNodesToolDefinition
  }),

  defineHandler<DistributeNodesInput, DistributeNodesResult>({
    name: 'distribute_nodes',
    schema: DistributeNodesInputSchema,
    execute: distributeNodes,
    formatResponse: (r) => textResponse(r.message),
    definition: distributeNodesToolDefinition
  }),

  defineHandler<ConnectShapesInput, ConnectShapesResult>({
    name: 'connect_shapes',
    schema: ConnectShapesInputSchema,
    execute: connectShapes,
    formatResponse: (r) => textResponse(r.message),
    definition: connectShapesToolDefinition
  }),

  defineHandler<SetLayerOrderInput, SetLayerOrderResult>({
    name: 'set_layer_order',
    schema: SetLayerOrderInputSchema,
    execute: setLayerOrder,
    formatResponse: (r) => textResponse(r.message),
    definition: setLayerOrderToolDefinition
  }),

  defineHandler<AddLayoutGridInput, AddLayoutGridResult>({
    name: 'add_layout_grid',
    schema: AddLayoutGridInputSchema,
    execute: addLayoutGrid,
    formatResponse: (r) => {
      let text = `${r.message}\nNode ID: ${r.nodeId}\nPattern: ${r.pattern}\n`;
      if (r.count !== undefined) {
        text += `Count: ${r.count}\n`;
      }
      text += `Gutter: ${r.gutter}px\nMargin: ${r.margin}px\n\nCSS Equivalent:\n${r.cssEquivalent}\n`;
      return textResponse(text);
    },
    definition: addLayoutGridToolDefinition
  }),

  defineHandler<SetConstraintsInput, SetConstraintsResult>({
    name: 'set_constraints',
    schema: SetConstraintsInputSchema,
    execute: setConstraints,
    formatResponse: (r) =>
      textResponse(
        `Constraints Applied Successfully\nNode ID: ${r.nodeId}\nApplied: ${r.applied.join(', ')}\n\nDescription: ${r.description}\n\nCSS Equivalent:\n${r.cssEquivalent}\n`
      ),
    definition: setConstraintsToolDefinition
  }),

  // ─── Validation ─────────────────────────────────────────────────────────
  defineHandler<DesignTokensInput, ValidationReport>({
    name: 'validate_design_tokens',
    schema: DesignTokensInputSchema,
    execute: (input) => Promise.resolve(validateDesignTokens(input)),
    formatResponse: (report) => textResponse(formatValidationReport(report)),
    definition: validateDesignTokensToolDefinition
  }),

  defineHandler<CheckWcagContrastInput, CheckWcagContrastResult>({
    name: 'check_wcag_contrast',
    schema: CheckWcagContrastInputSchema,
    execute: (input) => Promise.resolve(checkWcagContrast(input)),
    formatResponse: (result) => textResponse(formatContrastCheckResult(result)),
    definition: checkWcagContrastToolDefinition
  }),

  // ─── Pages ──────────────────────────────────────────────────────────────
  defineHandler<CreatePageInput, CreatePageResult>({
    name: 'create_page',
    schema: CreatePageInputSchema,
    execute: createPage,
    formatResponse: (r) => textResponse(`${r.message}\nPage ID: ${r.pageId}\nName: ${r.name}\n`),
    definition: createPageToolDefinition
  }),

  defineHandler<ListPagesInput, ListPagesResult>({
    name: 'list_pages',
    schema: ListPagesInputSchema,
    execute: listPages,
    formatResponse: (r) => {
      let text = `${r.message}\n\n`;
      if (r.pages.length > 0) {
        text += 'Pages:\n';
        r.pages.forEach((page, i) => {
          const current = page.isCurrent ? ' (current)' : '';
          text += `${i + 1}. ${page.name}${current} - ID: ${page.pageId}\n`;
        });
      }
      return textResponse(text);
    },
    definition: listPagesToolDefinition
  }),

  defineHandler<SetCurrentPageInput, SetCurrentPageResult>({
    name: 'set_current_page',
    schema: SetCurrentPageInputSchema,
    execute: setCurrentPage,
    formatResponse: (r) => {
      let text = `${r.message}\nPage ID: ${r.pageId}\n`;
      if (r.pageName) {
        text += `Page Name: ${r.pageName}\n`;
      }
      return textResponse(text);
    },
    definition: setCurrentPageToolDefinition
  }),

  // ─── Export & Utility ───────────────────────────────────────────────────
  defineHandler<ExportNodeInput, ExportNodeResult>({
    name: 'export_node',
    schema: ExportNodeInputSchema,
    execute: exportNode,
    formatResponse: (r) => {
      let text = `${r.message}\nNode ID: ${r.nodeId}\nFormat: ${r.format}\nScale: ${r.scale}x\n`;
      if (r.base64Data) {
        text += `\nBase64 Data: [${r.base64Data.length} characters]\n`;
      }
      if (r.filePath) {
        text += `\nFile Path: ${r.filePath}\n`;
      }
      return textResponse(text);
    },
    definition: exportNodeToolDefinition
  }),

  defineHandler<SetExportSettingsInput, SetExportSettingsResult>({
    name: 'set_export_settings',
    schema: SetExportSettingsInputSchema,
    execute: setExportSettings,
    formatResponse: (r) =>
      textResponse(`${r.message}\nNode ID: ${r.nodeId}\nExport Settings: ${r.settingsCount}\n`),
    definition: setExportSettingsToolDefinition
  }),

  defineHandler<SetVisibleInput, SetVisibleResult>({
    name: 'set_visible',
    schema: SetVisibleInputSchema,
    execute: setVisible,
    formatResponse: (r) =>
      textResponse(
        `${r.message}\nNode ID: ${r.nodeId}\nVisible: ${r.visible}\n\nCSS Equivalent:\n${r.cssEquivalent}\n`
      ),
    definition: setVisibleToolDefinition
  }),

  defineHandler<SetLockedInput, SetLockedResult>({
    name: 'set_locked',
    schema: SetLockedInputSchema,
    execute: setLocked,
    formatResponse: (r) =>
      textResponse(`${r.message}\nNode ID: ${r.nodeId}\nLocked: ${r.locked}\n`),
    definition: setLockedToolDefinition
  }),

  defineHandler<SetPluginDataInput, SetPluginDataResult>({
    name: 'set_plugin_data',
    schema: SetPluginDataInputSchema,
    execute: setPluginData,
    formatResponse: (r) => textResponse(`${r.message}\nNode ID: ${r.nodeId}\nKey: ${r.key}\n`),
    definition: setPluginDataToolDefinition
  }),

  // ─── Node Operations ──────────────────────────────────────────────────
  defineHandler<ReparentNodeInput, ReparentNodeResult>({
    name: 'reparent_node',
    schema: ReparentNodeInputSchema,
    execute: reparentNode,
    formatResponse: (r) =>
      textResponse(
        `${r.message}\nNode ID: ${r.nodeId}\nOld Parent: ${r.oldParentId ?? 'none'}\nNew Parent: ${r.newParentId}\n`
      ),
    definition: reparentNodeToolDefinition
  }),

  defineHandler<RemoveNodeInput, RemoveNodeResult>({
    name: 'remove_node',
    schema: RemoveNodeInputSchema,
    execute: removeNode,
    formatResponse: (r) =>
      textResponse(
        `${r.message}\nRemoved: ${r.name} (${r.type})\nFormer Parent: ${r.parentId ?? 'none'}\n`
      ),
    definition: removeNodeToolDefinition
  }),

  defineHandler<RenameNodeInput, RenameNodeResult>({
    name: 'rename_node',
    schema: RenameNodeInputSchema,
    execute: renameNode,
    formatResponse: (r) => textResponse(`${r.message}\n"${r.oldName}" → "${r.name}"\n`),
    definition: renameNodeToolDefinition
  }),

  defineHandler<DetachComponentInput, DetachComponentResult>({
    name: 'detach_component',
    schema: DetachComponentInputSchema,
    execute: detachComponent,
    formatResponse: (r) => {
      const lines = [r.message];
      for (const d of r.detached) {
        lines.push(`  ${d.name}: ${d.oldId} → ${d.newId}`);
      }
      return textResponse(lines.join('\n') + '\n');
    },
    definition: detachComponentToolDefinition
  })
];
