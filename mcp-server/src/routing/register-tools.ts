/**
 * Tool Registration
 *
 * Registers all tool handlers with the global registry.
 * Handler definitions are organized by domain in separate modules.
 */

import { getLogger } from '../monitoring/logger.js';
import { creationHandlers } from './handlers-creation.js';
import { layoutUtilityHandlers } from './handlers-layout-utility.js';
import { navigationHandlers } from './handlers-navigation.js';
import { stylingHandlers } from './handlers-styling.js';
import { getToolRegistry } from './tool-registry.js';

const logger = getLogger().child({ component: 'tool-registration' });

/**
 * Register all tools with the global registry
 */
export function registerAllTools(): void {
  const registry = getToolRegistry();

  logger.info('Registering tools...');

  const allHandlers = [
    ...creationHandlers,
    ...navigationHandlers,
    ...stylingHandlers,
    ...layoutUtilityHandlers
  ];

  for (const handler of allHandlers) {
    registry.register(handler);
  }

  const toolCount = registry.getAll().length;
  logger.info(`Registered ${toolCount} tools`, { count: toolCount });
}
