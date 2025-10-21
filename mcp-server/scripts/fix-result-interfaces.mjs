#!/usr/bin/env node

/**
 * Simple fix: Add success and timestamp to Result interfaces
 */

import { readFileSync, writeFileSync } from 'fs';

const TOOLS_DIR = '/Users/Spare/Documents/code/text-to-figma/mcp-server/src/tools';

const TOOLS = [
  'connect_shapes',
  'get_node_by_id',
  'list_pages',
  'create_page',
  'get_absolute_bounds',
  'get_relative_bounds'
];

function fixInterface(content, interfaceName) {
  // Find the interface and add success + timestamp after the opening brace
  const regex = new RegExp(`(export interface ${interfaceName} \\{)\\n`, '');
  return content.replace(regex, `$1\n  success: true;\n`);
}

function addTimestamp(content, interfaceName) {
  // Find message: string and add timestamp after it
  const regex = new RegExp(`(\\s+message: string;)\\n(\\})`, '');
  return content.replace(regex, `$1\n  timestamp: string;\n$2`);
}

for (const tool of TOOLS) {
  const file = `${TOOLS_DIR}/${tool}.ts`;
  console.log(`Fixing ${tool}...`);

  const interfaceName =
    tool
      .split('_')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('') + 'Result';

  let content = readFileSync(file, 'utf-8');

  // Skip if already has success
  if (content.includes(`export interface ${interfaceName} {\n  success:`)) {
    console.log(`  Already fixed`);
    continue;
  }

  content = fixInterface(content, interfaceName);
  content = addTimestamp(content, interfaceName);

  writeFileSync(file, content, 'utf-8');
  console.log(`  ✅ Fixed ${tool}`);
}

console.log('\nDone! Run npm run build');
