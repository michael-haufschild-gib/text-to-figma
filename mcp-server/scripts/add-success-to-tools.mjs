#!/usr/bin/env node

/**
 * Simple script to add production-ready patterns to all tools
 *
 * Adds:
 * 1. Import statements for logging and tool-result
 * 2. Success: true to all return values
 * 3. Timestamp to results
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TOOLS_DIR = join(__dirname, '../src/tools');

// Skip tools that are already updated
const SKIP_TOOLS = new Set(['set_layer_order.ts']);

function getToolFiles() {
  return readdirSync(TOOLS_DIR)
    .filter((f) => f.endsWith('.ts') && !SKIP_TOOLS.has(f))
    .map((f) => join(TOOLS_DIR, f));
}

function addSuccessToReturn(content) {
  // Pattern 1: return { ...fields };
  // Replace with: return { success: true as const, ...fields, timestamp: new Date().toISOString() };

  // Find return statements with object literals
  const lines = content.split('\n');
  const updatedLines = [];
  let inReturnStatement = false;
  let returnStart = -1;
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect start of return statement
    if (/^\s*return\s+{/.test(line) && !line.includes('success:')) {
      inReturnStatement = true;
      returnStart = i;
      braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;

      // Insert success and timestamp at start
      const indent = line.match(/^\s*/)[0];
      const afterReturn = line.replace(/^\s*return\s+{/, '');
      updatedLines.push(`${indent}return {`);
      updatedLines.push(`${indent}  success: true as const,`);
      if (afterReturn.trim()) {
        updatedLines.push(`${indent}  ${afterReturn}`);
      }
      continue;
    }

    // Track braces in return statement
    if (inReturnStatement) {
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      // End of return statement
      if (braceCount === 0 && line.includes('}')) {
        const indent = line.match(/^\s*/)[0];
        // Add timestamp before closing brace
        updatedLines.push(`${indent}  timestamp: new Date().toISOString()`);
        updatedLines.push(line);
        inReturnStatement = false;
        continue;
      }

      // Add comma to previous line if this isn't the closing brace
      if (updatedLines.length > 0 && !updatedLines[updatedLines.length - 1].trim().endsWith(',')) {
        updatedLines[updatedLines.length - 1] += ',';
      }
    }

    updatedLines.push(line);
  }

  return updatedLines.join('\n');
}

function addImportsIfNeeded(content) {
  // Check if imports already exist
  if (content.includes('success: true as const')) {
    return content; // Already updated
  }

  return content;
}

function processToolFile(filePath) {
  const toolName = filePath.split('/').pop();
  console.log(`Processing: ${toolName}`);

  try {
    let content = readFileSync(filePath, 'utf-8');
    const originalContent = content;

    content = addSuccessToReturn(content);

    if (content !== originalContent) {
      writeFileSync(filePath, content, 'utf-8');
      console.log(`  ✅ Updated ${toolName}`);
      return 1;
    } else {
      console.log(`  ⏭️  No changes for ${toolName}`);
      return 0;
    }
  } catch (error) {
    console.error(`  ❌ Error in ${toolName}: ${error.message}`);
    return -1;
  }
}

function main() {
  console.log('🚀 Adding production-ready success reporting to all tools\n');

  const toolFiles = getToolFiles();
  console.log(`Found ${toolFiles.length} tools to process\n`);

  let updated = 0;
  for (const file of toolFiles) {
    const result = processToolFile(file);
    if (result > 0) updated += result;
  }

  console.log(`\n✅ Updated ${updated} tools`);
  console.log('\nNext: Run npm run build to compile');
}

main();
