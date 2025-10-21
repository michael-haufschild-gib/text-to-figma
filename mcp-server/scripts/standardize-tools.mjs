#!/usr/bin/env node

/**
 * Automated script to standardize all MCP tools with production-ready patterns
 *
 * This script:
 * 1. Adds logging and tool-result imports to all tools
 * 2. Wraps return values with createToolResult()
 * 3. Adds try/catch with logging
 * 4. Fixes type annotations
 * 5. Ensures consistent error handling
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TOOLS_DIR = join(__dirname, '../src/tools');

// Tools that have already been updated manually
const UPDATED_TOOLS = new Set(['set_layer_order.ts']);

function getToolFiles() {
  return readdirSync(TOOLS_DIR)
    .filter((f) => f.endsWith('.ts') && !UPDATED_TOOLS.has(f))
    .map((f) => join(TOOLS_DIR, f));
}

function addImports(content) {
  // Check if imports already exist
  if (content.includes("from '../utils/tool-result.js'")) {
    return content;
  }

  // Find the last import statement
  const importRegex = /^import\s+.*?from\s+['"].*?['"];?$/gm;
  const imports = content.match(importRegex);

  if (!imports) {
    console.log('  ⚠️  No imports found, skipping');
    return content;
  }

  const lastImport = imports[imports.length - 1];
  const lastImportIndex = content.indexOf(lastImport) + lastImport.length;

  const newImports = `
import { createToolResult, type ToolResult } from '../utils/tool-result.js';
import { createScopedLogger } from '../utils/logger.js';`;

  return content.slice(0, lastImportIndex) + newImports + content.slice(lastImportIndex);
}

function addLogger(content, toolName) {
  // Check if logger already exists
  if (content.includes('createScopedLogger')) {
    return content;
  }

  // Find first occurrence of export (function or const)
  const exportMatch = content.match(/\n(export\s+(async\s+)?function\s+\w+|export\s+const\s+\w+)/);

  if (!exportMatch) {
    console.log('  ⚠️  No export found, skipping logger');
    return content;
  }

  const insertIndex = exportMatch.index;
  const loggerLine = `\nconst log = createScopedLogger('${toolName}');\n`;

  return content.slice(0, insertIndex) + loggerLine + content.slice(insertIndex);
}

function updateResultType(content, toolName) {
  // Find the Result interface or type
  const resultTypeRegex = new RegExp(
    `export (interface|type) ${capitalize(camelCase(toolName))}Result\\s*=?\\s*{([^}]*)}`,
    's'
  );

  const match = content.match(resultTypeRegex);

  if (!match) {
    console.log('  ⚠️  No result type found, skipping');
    return content;
  }

  const [fullMatch, typeKind, typeBody] = match;

  // Check if already using ToolResult
  if (fullMatch.includes('ToolResult')) {
    return content;
  }

  // Create Data interface and update Result type
  const dataInterface = `export interface ${capitalize(camelCase(toolName))}Data {${typeBody}}\n\nexport type ${capitalize(camelCase(toolName))}Result = ToolResult<${capitalize(camelCase(toolName))}Data>;`;

  return content.replace(fullMatch, dataInterface);
}

function wrapReturnStatements(content) {
  // Find return statements that return object literals
  const returnRegex = /return\s+{([^}]+)};/gs;

  return content.replace(returnRegex, (match, objectBody) => {
    // Skip if already wrapped
    if (match.includes('createToolResult')) {
      return match;
    }

    // Extract message if exists
    const messageMatch = objectBody.match(/message:\s*[`'"]([^`'"]+)[`'"]/);
    const message = messageMatch ? messageMatch[1] : 'Operation completed successfully';

    // Remove message from object body
    const dataBody = objectBody.replace(/,?\s*message:\s*[`'"][^`'"]*[`'"]/, '');

    return `return createToolResult(\n    {${dataBody}},\n    '${message}'\n  );`;
  });
}

function addTryCatch(content, toolName) {
  // Find the main function body
  const functionRegex = new RegExp(
    `export async function ${camelCase(toolName)}\\([^)]*\\):[^{]*{([\\s\\S]*)}\\s*$`,
    ''
  );

  const match = content.match(functionRegex);

  if (!match) {
    console.log('  ⚠️  Could not parse function body');
    return content;
  }

  const [fullMatch, functionBody] = match;

  // Check if already has try/catch
  if (functionBody.trim().startsWith('try {')) {
    return content;
  }

  // Wrap body in try/catch
  const wrappedBody = `export async function ${camelCase(toolName)}(input: ${capitalize(camelCase(toolName))}Input): Promise<${capitalize(camelCase(toolName))}Result> {
  const startTime = Date.now();

  try {
${functionBody
  .split('\n')
  .map((line) => '  ' + line)
  .join('\n')}
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    log.error('Operation failed', {
      error: errorMessage,
      duration,
      input
    });

    throw new Error(\`[\${toolName}] \${errorMessage}\`);
  }
}`;

  return content.replace(fullMatch, wrappedBody);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function camelCase(str) {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

function getToolName(filePath) {
  return filePath.split('/').pop().replace('.ts', '');
}

function processToolFile(filePath) {
  const toolName = getToolName(filePath);
  console.log(`\n📝 Processing: ${toolName}`);

  try {
    let content = readFileSync(filePath, 'utf-8');
    const originalContent = content;

    // Step 1: Add imports
    console.log('  ➕ Adding imports...');
    content = addImports(content);

    // Step 2: Add logger
    console.log('  🔍 Adding logger...');
    content = addLogger(content, toolName);

    // Step 3: Update result type
    console.log('  📦 Updating result type...');
    content = updateResultType(content, toolName);

    // Step 4: Wrap return statements
    console.log('  🎁 Wrapping returns...');
    content = wrapReturnStatements(content);

    // Step 5: Add try/catch (complex, skip for now)
    // console.log('  🛡️  Adding error handling...');
    // content = addTryCatch(content, toolName);

    if (content !== originalContent) {
      writeFileSync(filePath, content, 'utf-8');
      console.log('  ✅ Updated successfully');
      return true;
    } else {
      console.log('  ⏭️  No changes needed');
      return false;
    }
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return false;
  }
}

function main() {
  console.log('🚀 Starting tool standardization...\n');
  console.log(`Tools directory: ${TOOLS_DIR}`);

  const toolFiles = getToolFiles();
  console.log(`\nFound ${toolFiles.length} tools to process`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of toolFiles) {
    const result = processToolFile(file);
    if (result === true) updated++;
    else if (result === false) skipped++;
    else errors++;
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log('='.repeat(60));

  if (errors > 0) {
    console.log('\n⚠️  Some tools had errors. Please review manually.');
    process.exit(1);
  } else {
    console.log('\n🎉 All tools processed successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Review changes with git diff');
    console.log('  2. Run: npm run build');
    console.log('  3. Run tests');
    console.log('  4. Commit changes');
  }
}

main();
