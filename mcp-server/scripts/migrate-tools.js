#!/usr/bin/env node

/**
 * Tool Migration Script
 *
 * Automatically adds error handling, logging, metrics, and JSDoc to all tools
 * that don't already have them.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOOLS_DIR = path.join(__dirname, '../src/tools');

const REQUIRED_IMPORTS = `import { getLogger } from '../monitoring/logger.js';
import { getMetrics } from '../monitoring/metrics.js';
import { trackError } from '../monitoring/error-tracker.js';
import { ValidationError, FigmaAPIError, NetworkError, wrapError } from '../errors/index.js';`;

async function getAllToolFiles() {
  const files = await fs.readdir(TOOLS_DIR);
  return files.filter((f) => f.endsWith('.ts') && f !== 'index.ts');
}

async function hasRequiredImports(content) {
  return (
    content.includes('getLogger') &&
    content.includes('getMetrics') &&
    content.includes('trackError') &&
    content.includes('ValidationError')
  );
}

async function addImportsIfMissing(content, toolName) {
  if (await hasRequiredImports(content)) {
    return content;
  }

  // Find the last import statement
  const lines = content.split('\n');
  let lastImportIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^import .* from/)) {
      lastImportIndex = i;
    }
  }

  if (lastImportIndex === -1) {
    // No imports found, add after first comment block
    for (let i = 0; i < lines.length; i++) {
      if (
        !lines[i].startsWith('/*') &&
        !lines[i].startsWith('*') &&
        !lines[i].startsWith(' *') &&
        lines[i].trim()
      ) {
        lines.splice(i, 0, REQUIRED_IMPORTS, '');
        break;
      }
    }
  } else {
    // Add after last import
    lines.splice(lastImportIndex + 1, 0, REQUIRED_IMPORTS);
  }

  return lines.join('\n');
}

async function addMonitoringSetup(content, toolName) {
  if (content.includes('const logger = getLogger()')) {
    return content;
  }

  const setupCode = `
const logger = getLogger().child({ tool: '${toolName}' });
const metrics = getMetrics();

// Register metrics for this tool
const invocationCounter = metrics.counter('tool_invocations_total', 'Total tool invocations', ['tool']);
const successCounter = metrics.counter('tool_success_total', 'Successful tool executions', ['tool']);
const errorCounter = metrics.counter('tool_errors_total', 'Tool execution errors', ['tool', 'error_type']);
const durationHistogram = metrics.histogram(
  'tool_duration_ms',
  'Tool execution duration in milliseconds',
  [10, 50, 100, 200, 500, 1000, 2000, 5000]
);
`;

  // Find where to insert (after all type/schema definitions, before the main function)
  const lines = content.split('\n');
  let insertIndex = -1;

  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].match(/^export (async )?function/) || lines[i].match(/^export const.*=.*async/)) {
      insertIndex = i;
      break;
    }
  }

  if (insertIndex > 0) {
    lines.splice(insertIndex, 0, setupCode);
  }

  return lines.join('\n');
}

async function wrapFunctionWithErrorHandling(content, toolName) {
  // This is complex - for now, just mark tools that need manual updates
  if (content.includes('invocationCounter.inc') && content.includes('try {')) {
    return { content, needsManual: false };
  }

  return { content, needsManual: true };
}

async function migrateToolFile(filePath) {
  const toolName = path.basename(filePath, '.ts');
  console.log(`\nProcessing: ${toolName}`);

  let content = await fs.readFile(filePath, 'utf-8');
  const originalContent = content;

  // Step 1: Add imports
  content = await addImportsIfMissing(content, toolName);

  // Step 2: Add monitoring setup
  content = await addMonitoringSetup(content, toolName);

  // Step 3: Check if manual update needed
  const { content: newContent, needsManual } = await wrapFunctionWithErrorHandling(
    content,
    toolName
  );
  content = newContent;

  if (content !== originalContent) {
    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`  ✓ Updated imports and monitoring setup`);

    if (needsManual) {
      console.log(`  ⚠ Manual error handling update needed`);
      return { file: toolName, status: 'partial' };
    } else {
      console.log(`  ✓ Fully migrated`);
      return { file: toolName, status: 'complete' };
    }
  } else {
    console.log(`  ✓ Already migrated`);
    return { file: toolName, status: 'complete' };
  }
}

async function main() {
  console.log('========================================');
  console.log('Tool Migration Script');
  console.log('========================================\n');

  const toolFiles = await getAllToolFiles();
  console.log(`Found ${toolFiles.length} tool files\n`);

  const results = [];

  for (const file of toolFiles) {
    const filePath = path.join(TOOLS_DIR, file);
    try {
      const result = await migrateToolFile(filePath);
      results.push(result);
    } catch (error) {
      console.error(`  ✗ Error processing ${file}:`, error.message);
      results.push({ file: path.basename(file, '.ts'), status: 'error', error: error.message });
    }
  }

  console.log('\n========================================');
  console.log('Migration Summary');
  console.log('========================================');

  const complete = results.filter((r) => r.status === 'complete').length;
  const partial = results.filter((r) => r.status === 'partial').length;
  const errors = results.filter((r) => r.status === 'error').length;

  console.log(`Total tools: ${results.length}`);
  console.log(`Fully migrated: ${complete}`);
  console.log(`Partially migrated (needs manual update): ${partial}`);
  console.log(`Errors: ${errors}`);

  if (partial > 0) {
    console.log('\nTools needing manual error handling update:');
    results
      .filter((r) => r.status === 'partial')
      .forEach((r) => {
        console.log(`  - ${r.file}`);
      });
  }

  if (errors > 0) {
    console.log('\nTools with errors:');
    results
      .filter((r) => r.status === 'error')
      .forEach((r) => {
        console.log(`  - ${r.file}: ${r.error}`);
      });
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
