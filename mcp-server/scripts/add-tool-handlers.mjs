#!/usr/bin/env node
/**
 * Script to automatically add handler exports to all tool files
 *
 * This script:
 * 1. Reads index.ts to extract formatResponse logic from switch cases
 * 2. For each tool file in tools/, adds handler export if missing
 * 3. Preserves exact response formatting from original switch cases
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const TOOLS_DIR = path.join(PROJECT_ROOT, 'mcp-server/src/tools');
const INDEX_FILE = path.join(PROJECT_ROOT, 'mcp-server/src/index.ts');

// Tools that already have handlers (manually added)
const COMPLETED_TOOLS = new Set(['create_frame', 'set_fills']);

/**
 * Extract switch case response formatting from index.ts
 */
function extractResponseFormats(indexContent) {
  const formats = new Map();

  // Match each case in the switch statement
  const caseRegex =
    /case '([^']+)':\s*\{([^}]*?)return\s*\{[^}]*content:\s*\[([^\]]+)\][^}]*\};?\s*\}/gs;

  let match;
  while ((match = caseRegex.exec(indexContent)) !== null) {
    const [, toolName, body, contentArray] = match;
    formats.set(toolName, { body, contentArray });
  }

  return formats;
}

/**
 * Convert tool_name to camelCase
 */
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert tool_name to PascalCase
 */
function toPascalCase(str) {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Extract the formatResponse logic from switch case body
 */
function buildFormatResponse(toolName, body, contentArray) {
  // Clean up the body to extract text assembly logic
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('const'));

  // Build the formatResponse function
  return `  formatResponse: (result) => {
${lines.join('\n').replace(/^/gm, '    ')}    return [${contentArray.trim()}];
  }`;
}

/**
 * Add handler export to a tool file
 */
function addHandlerToTool(toolFile, toolName, responseFormat) {
  const toolPath = path.join(TOOLS_DIR, toolFile);
  let content = fs.readFileSync(toolPath, 'utf-8');

  // Check if handler already exists
  if (content.includes(`${toCamelCase(toolName)}Handler`)) {
    console.log(`  ✓ ${toolName} - handler already exists`);
    return;
  }

  // Find the tool definition export
  const defName = `${toCamelCase(toolName)}ToolDefinition`;
  const defIndex = content.lastIndexOf(`export const ${defName}`);

  if (defIndex === -1) {
    console.log(`  ✗ ${toolName} - tool definition not found`);
    return;
  }

  // Find the end of the definition (closing };)
  let braceCount = 0;
  let defEnd = defIndex;
  let inDef = false;

  for (let i = defIndex; i < content.length; i++) {
    if (content[i] === '{') {
      braceCount++;
      inDef = true;
    } else if (content[i] === '}') {
      braceCount--;
      if (inDef && braceCount === 0) {
        defEnd = i + 2; // Include }; and newline
        break;
      }
    }
  }

  // Extract input and result types
  const inputType = `${toPascalCase(toolName)}Input`;
  const resultType = `${toPascalCase(toolName)}Result`;

  // Build handler export
  const handlerExport = `
/**
 * Handler export for tool registration
 */
export const ${toCamelCase(toolName)}Handler: import('../routing/tool-handler.js').ToolHandler<
  ${inputType},
  ${resultType}
> = {
  name: '${toolName}',
  schema: ${toCamelCase(toolName)}InputSchema as any,
  execute: ${toCamelCase(toolName)},
${buildFormatResponse(toolName, responseFormat.body, responseFormat.contentArray)},
  definition: ${defName}
};
`;

  // Insert handler after tool definition
  content = content.slice(0, defEnd) + handlerExport + content.slice(defEnd);

  fs.writeFileSync(toolPath, content, 'utf-8');
  console.log(`  ✓ ${toolName} - handler added`);
}

/**
 * Main script
 */
async function main() {
  console.log('Adding handler exports to tool files...\n');

  // Read index.ts
  const indexContent = fs.readFileSync(INDEX_FILE, 'utf-8');
  const responseFormats = extractResponseFormats(indexContent);

  console.log(`Found ${responseFormats.size} switch cases in index.ts\n`);

  // Get all tool files
  const toolFiles = fs.readdirSync(TOOLS_DIR).filter((f) => f.endsWith('.ts'));

  console.log(`Processing ${toolFiles.length} tool files...\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const toolFile of toolFiles) {
    const toolName = toolFile.replace('.ts', '');

    if (COMPLETED_TOOLS.has(toolName)) {
      skipped++;
      continue;
    }

    const responseFormat = responseFormats.get(toolName);
    if (!responseFormat) {
      console.log(`  ⚠ ${toolName} - no switch case found in index.ts`);
      skipped++;
      continue;
    }

    try {
      addHandlerToTool(toolFile, toolName, responseFormat);
      updated++;
    } catch (error) {
      console.error(`  ✗ ${toolName} - error: ${error.message}`);
      errors++;
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total: ${toolFiles.length}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
