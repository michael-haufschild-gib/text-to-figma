/**
 * Text-to-Figma Plugin — Entry Point
 *
 * Routes incoming messages from the WebSocket bridge to handler modules.
 */

import {
  handleCreateComponent,
  handleCreateInstance,
  handleCreateComponentSet,
  handleSetComponentProperties,
  handleAddVariantProperty,
  handleSetInstanceSwap
} from './handlers/components.js';
import {
  handleCreateFrame,
  handleCreateText,
  handleCreateEllipse,
  handleCreateLine,
  handleCreatePolygon,
  handleCreateStar,
  handleCreateRectangleWithImageFill
} from './handlers/creation.js';
import { handleCreateDesign } from './handlers/design.js';
import {
  handleSetLayoutProperties,
  handleSetLayoutAlign,
  handleSetLayoutSizing,
  handleSetConstraints,
  handleSetLayerOrder,
  handleAddLayoutGrid
} from './handlers/layout.js';
import {
  handleAlignNodes,
  handleDistributeNodes,
  handleConnectShapes
} from './handlers/spatial.js';
import {
  handleGetNodeById,
  handleGetNodeByName,
  handleGetChildren,
  handleGetParent,
  handleGetAbsoluteBounds,
  handleGetRelativeBounds,
  handleGetPageHierarchy,
  handleGetSelection
} from './handlers/query.js';
import {
  handleCreateColorStyle,
  handleCreateTextStyle,
  handleCreateEffectStyle,
  handleApplyFillStyle,
  handleApplyTextStyle,
  handleApplyEffectStyle
} from './handlers/styles.js';
import {
  handleSetFills,
  handleSetCornerRadius,
  handleSetStroke,
  handleSetAppearance,
  handleSetOpacity,
  handleSetBlendMode,
  handleApplyEffects,
  handleAddGradientFill,
  handleSetImageFill
} from './handlers/styling.js';
import {
  handleSetTextProperties,
  handleSetTextDecoration,
  handleSetTextCase,
  handleSetLetterSpacing,
  handleSetParagraphSpacing
} from './handlers/text.js';
import { handleSetTransform } from './handlers/transform.js';
import {
  handleSetVisible,
  handleSetLocked,
  handleSetExportSettings,
  handleExportNode,
  handleSetPluginData,
  handleGetPluginData,
  handleCreatePageWithPayload,
  handleListPages,
  handleSetCurrentPage,
  handleSetStrokeJoin,
  handleSetStrokeCap,
  handleSetClippingMask,
  handleCreatePath,
  handleCreateBooleanOperation,
  handleReparentNode,
  handleRemoveNode,
  handleRenameNode,
  handleDetachComponent
} from './handlers/utility.js';

// ─── Build-time constants (injected by esbuild via build.mjs) ────────────────

declare const __PLUGIN_VERSION__: string;

// ─── Plugin UI ────────────────────────────────────────────────────────────────

figma.showUI(__html__, { width: 400, height: 300 });

// ─── Font preloading ──────────────────────────────────────────────────────────

const COMMON_FONTS: FontName[] = [
  { family: 'Inter', style: 'Regular' },
  { family: 'Inter', style: 'Medium' },
  { family: 'Inter', style: 'Semi Bold' },
  { family: 'Inter', style: 'Bold' },
  { family: 'Roboto', style: 'Regular' },
  { family: 'Roboto', style: 'Medium' },
  { family: 'Roboto', style: 'Bold' }
];

void (async () => {
  for (const font of COMMON_FONTS) {
    try {
      await figma.loadFontAsync(font);
    } catch {
      // Font unavailable — non-fatal
    }
  }
})();

// ─── Command routing table ────────────────────────────────────────────────────

type Handler = (payload: Record<string, unknown>) => unknown | Promise<unknown>;

const handlers: Record<string, Handler> = {
  // Diagnostic
  ping: () => ({
    pong: true,
    timestamp: Date.now(),
    pluginVersion: __PLUGIN_VERSION__,
    fileName: figma.root.name,
    currentPage: figma.currentPage.name
  }),

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
  set_clipping_mask: handleSetClippingMask,
  reparent_node: handleReparentNode,
  remove_node: handleRemoveNode,
  rename_node: handleRenameNode,
  detach_component: handleDetachComponent
};

// ─── Message handler ──────────────────────────────────────────────────────────

figma.ui.onmessage = (msg: Record<string, unknown>): void => {
  void handleMessage(msg);
};

async function handleMessage(msg: Record<string, unknown>): Promise<void> {
  const { type, payload, requestId } = msg as {
    type: string;
    payload?: Record<string, unknown>;
    requestId?: string;
  };

  if (typeof type !== 'string' || type === '') {
    figma.ui.postMessage({
      id: requestId ?? null,
      success: false,
      error: 'Missing or invalid message type'
    });
    return;
  }

  try {
    const handler = handlers[type];
    if (!handler) {
      throw new Error(`Unknown command type: ${type}`);
    }

    const result = await handler(payload ?? {});

    figma.ui.postMessage({ id: requestId, success: true, data: result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${type}] Error:`, errorMessage);
    figma.ui.postMessage({ id: requestId, success: false, error: errorMessage });
  }
}
