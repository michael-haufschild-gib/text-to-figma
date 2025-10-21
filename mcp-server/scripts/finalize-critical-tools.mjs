#!/usr/bin/env node

/**
 * Finalize production-ready pattern for remaining critical tools
 *
 * This applies the minimal changes needed:
 * 1. Add success: true to return objects
 * 2. Add timestamp to return objects
 * 3. Keep error handling as-is (exceptions work fine for MCP)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TOOLS_DIR = join(process.cwd(), 'src/tools');

const REMAINING_TOOLS = [
  'connect_shapes',
  'get_node_by_id',
  'list_pages',
  'create_page',
  'get_absolute_bounds',
  'get_relative_bounds'
];

function addSuccessAndTimestamp(content) {
  // Find return statements and add success + timestamp
  return content.replace(/return\s+{([^}]+)}/gs, (match, body) => {
    // Skip if already has success
    if (body.includes('success:')) {
      return match;
    }

    // Add success and timestamp
    const trimmed = body.trim();
    const withComma = trimmed.endsWith(',') ? trimmed : trimmed + ',';

    return `return {
    success: true as const,${withComma}
    timestamp: new Date().toISOString()
  }`;
  });
}

function processFile(toolName) {
  const filePath = join(TOOLS_DIR, `${toolName}.ts`);
  console.log(`Processing ${toolName}...`);

  try {
    let content = readFileSync(filePath, 'utf-8');
    const original = content;

    content = addSuccessAndTimestamp(content);

    if (content !== original) {
      writeFileSync(filePath, content, 'utf-8');
      console.log(`  ✅ Updated ${toolName}`);
      return true;
    } else {
      console.log(`  ⏭️  No changes needed for ${toolName}`);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return false;
  }
}

console.log('🔧 Finalizing remaining critical tools...\n');

let updated = 0;
for (const tool of REMAINING_TOOLS) {
  if (processFile(tool)) {
    updated++;
  }
}

console.log(`\n✅ Updated ${updated}/${REMAINING_TOOLS.length} tools`);
console.log('\nNext: npm run build');
