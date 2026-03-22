/**
 * Package version — single source of truth.
 *
 * Uses createRequire to load package.json since import attributes
 * require Node18+ module resolution.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { name: string; version: string };

export const VERSION: string = pkg.version;
export const NAME: string = pkg.name;
