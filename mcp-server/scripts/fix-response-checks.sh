#!/bin/bash

# Fix redundant response.success checks in all MCP tools
# The Figma bridge already validates success at the protocol level

cd "$(dirname "$0")/../src/tools"

echo "Fixing redundant response.success checks in MCP tools..."

# Pattern 1: if (!response.success) { throw ... }
# Replace with: // Response already validated by bridge

for file in *.ts; do
  if grep -q "if (!response.success)" "$file"; then
    echo "Fixing $file (pattern 1)..."

    # Remove the success check and error throw, keep the rest
    perl -i -pe 's/\n\s+if \(!response\.success\) \{\s*\n\s+throw new Error\([^)]+\);\s*\n\s+\}//' "$file"
  fi
done

# Pattern 2: Check for response?.success as well
for file in *.ts; do
  if grep -q "if (!response\\.success)" "$file" || grep -q "response\\.success" "$file"; then
    echo "Checking $file for remaining patterns..."
  fi
done

echo "Done! Please review changes and rebuild."
