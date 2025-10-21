#!/usr/bin/env node

/**
 * Migration script to fix connection checking pattern in all MCP tools
 *
 * This script updates all tool files to use the more robust
 * sendToFigmaWithRetry pattern instead of checking isConnected()
 * and using basic sendToFigma.
 *
 * Changes made:
 * 1. Replace sendToFigma() with sendToFigmaWithRetry()
 * 2. Remove the premature isConnected() check that causes false errors
 * 3. Preserve all other functionality
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOOLS_DIR = path.join(__dirname, '../src/tools');

/**
 * Pattern to match the problematic connection check
 */
const CONNECTION_CHECK_PATTERN =
  /\s+if \(!bridge\.isConnected\(\)\) \{\s+throw new Error\(['"](Not connected to Figma[^'"]*)['"]\);\s+\}/gm;

/**
 * Pattern to match sendToFigma calls (without Retry)
 */
const SEND_TO_FIGMA_PATTERN = /bridge\.sendToFigma</g;

/**
 * Process a single tool file
 */
async function processFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    let modified = false;
    let newContent = content;

    // Check if file has the problematic pattern
    const hasConnectionCheck = CONNECTION_CHECK_PATTERN.test(content);
    const hasSendToFigma = /bridge\.sendToFigma</.test(content);

    if (!hasConnectionCheck && !hasSendToFigma) {
      return { filePath, modified: false, reason: 'No patterns to fix' };
    }

    // Step 1: Remove the connection check
    if (hasConnectionCheck) {
      newContent = newContent.replace(CONNECTION_CHECK_PATTERN, '');
      modified = true;
    }

    // Step 2: Replace sendToFigma with sendToFigmaWithRetry
    if (hasSendToFigma) {
      newContent = newContent.replace(SEND_TO_FIGMA_PATTERN, 'bridge.sendToFigmaWithRetry<');
      modified = true;
    }

    if (modified) {
      await fs.writeFile(filePath, newContent, 'utf-8');
      return { filePath, modified: true, reason: 'Updated connection pattern' };
    }

    return { filePath, modified: false, reason: 'No changes needed' };
  } catch (error) {
    return { filePath, modified: false, error: error.message };
  }
}

/**
 * Find all TypeScript files in tools directory
 */
async function findToolFiles(dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findToolFiles(fullPath)));
    } else if (entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔧 Fixing connection pattern in MCP tools...\n');

  // Find all tool files
  const toolFiles = await findToolFiles(TOOLS_DIR);
  console.log(`Found ${toolFiles.length} TypeScript files to process\n`);

  // Process each file
  const results = await Promise.all(toolFiles.map(processFile));

  // Summary
  const modified = results.filter((r) => r.modified);
  const errors = results.filter((r) => r.error);
  const skipped = results.filter((r) => !r.modified && !r.error);

  console.log('📊 Summary:');
  console.log(`✅ Modified: ${modified.length} files`);
  console.log(`⏭️  Skipped: ${skipped.length} files`);
  console.log(`❌ Errors: ${errors.length} files\n`);

  if (modified.length > 0) {
    console.log('✅ Modified files:');
    modified.forEach((r) => {
      const relativePath = path.relative(TOOLS_DIR, r.filePath);
      console.log(`   - ${relativePath}: ${r.reason}`);
    });
    console.log();
  }

  if (errors.length > 0) {
    console.log('❌ Errors:');
    errors.forEach((r) => {
      const relativePath = path.relative(TOOLS_DIR, r.filePath);
      console.log(`   - ${relativePath}: ${r.error}`);
    });
    console.log();
  }

  console.log('✨ Migration complete!');
  console.log('\nNext steps:');
  console.log('1. Review the changes: git diff mcp-server/src/tools/');
  console.log('2. Build the project: npm run build');
  console.log('3. Run tests: npm test');
  console.log('4. Test connection behavior manually');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
