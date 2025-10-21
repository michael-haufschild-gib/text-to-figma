/**
 * Tool Registration
 *
 * Auto-registers all tool handlers with the global registry.
 * Import and register each tool's handler export.
 */

import { getLogger } from '../monitoring/logger.js';
import { getToolRegistry } from './tool-registry.js';

// Import tool handlers (handlers completed so far)
import { checkWcagContrastHandler } from '../tools/check_wcag_contrast.js';
import { createFrameHandler } from '../tools/create_frame.js';
import { createTextHandler } from '../tools/create_text.js';
import { setFillsHandler } from '../tools/set_fills.js';
import { setLayoutPropertiesHandler } from '../tools/set_layout_properties.js';
import { validateDesignTokensHandler } from '../tools/validate_design_tokens.js';

// TODO: Import remaining 52 tool handlers (pattern established above)
// import { createComponentHandler } from '../tools/create_component.js';
// import { createInstanceHandler } from '../tools/create_instance.js';
// ... (remaining tools follow same pattern)

const logger = getLogger().child({ component: 'tool-registration' });

/**
 * Register all tools with the global registry
 *
 * Imports and registers each tool handler. This replaces the manual
 * TOOLS array in index.ts with automatic registration.
 *
 * @example
 * ```typescript
 * // In index.ts
 * import { registerAllTools } from './routing/register-tools.js';
 *
 * registerAllTools();
 * ```
 *
 * @remarks
 * - Called once during server startup
 * - Duplicate registration throws error
 * - Logs tool count for observability
 */
export function registerAllTools(): void {
  const registry = getToolRegistry();

  logger.info('Registering tools...');

  // Register completed tool handlers
  registry.register(createFrameHandler);
  registry.register(createTextHandler);
  registry.register(setFillsHandler);
  registry.register(setLayoutPropertiesHandler);
  registry.register(validateDesignTokensHandler);
  registry.register(checkWcagContrastHandler);

  // TODO: Register remaining 52 tools (same pattern)
  // registry.register(createComponentHandler);
  // registry.register(createInstanceHandler);
  // registry.register(setComponentPropertiesHandler);
  // registry.register(applyEffectsHandler);
  // registry.register(setConstraintsHandler);
  // registry.register(createRectangleWithImageFillHandler);
  // registry.register(setImageFillHandler);
  // registry.register(createEllipseHandler);
  // registry.register(createLineHandler);
  // registry.register(addGradientFillHandler);
  // registry.register(setCornerRadiusHandler);
  // registry.register(setStrokeHandler);
  // registry.register(createPolygonHandler);
  // registry.register(createStarHandler);
  // registry.register(setRotationHandler);
  // registry.register(setAbsolutePositionHandler);
  // registry.register(setSizeHandler);
  // registry.register(setTextDecorationHandler);
  // registry.register(setLetterSpacingHandler);
  // registry.register(setTextCaseHandler);
  // registry.register(createBooleanOperationHandler);
  // registry.register(setBlendModeHandler);
  // registry.register(setOpacityHandler);
  // registry.register(setStrokeJoinHandler);
  // registry.register(setStrokeCapHandler);
  // registry.register(createColorStyleHandler);
  // registry.register(applyFillStyleHandler);
  // registry.register(createTextStyleHandler);
  // registry.register(applyTextStyleHandler);
  // registry.register(createEffectStyleHandler);
  // registry.register(applyEffectStyleHandler);
  // registry.register(setClippingMaskHandler);
  // registry.register(setParagraphSpacingHandler);
  // registry.register(createComponentSetHandler);
  // registry.register(addVariantPropertyHandler);
  // registry.register(getNodeByIdHandler);
  // registry.register(getNodeByNameHandler);
  // registry.register(addLayoutGridHandler);
  // registry.register(flipNodeHandler);
  // registry.register(setVisibleHandler);
  // registry.register(setLockedHandler);
  // registry.register(setExportSettingsHandler);
  // registry.register(exportNodeHandler);
  // registry.register(getChildrenHandler);
  // registry.register(getParentHandler);
  // registry.register(setPluginDataHandler);
  // registry.register(getPluginDataHandler);
  // registry.register(setInstanceSwapHandler);
  // registry.register(setScaleHandler);
  // registry.register(createPageHandler);
  // registry.register(listPagesHandler);
  // registry.register(setCurrentPageHandler);
  // registry.register(getAbsoluteBoundsHandler);
  // registry.register(setLayoutSizingHandler);
  // registry.register(setLayoutAlignHandler);

  const toolCount = registry.getAll().length;
  logger.info(`Registered ${toolCount} tools`, { count: toolCount });

  console.error(`[Registry] Registered ${toolCount} tools`);
}
