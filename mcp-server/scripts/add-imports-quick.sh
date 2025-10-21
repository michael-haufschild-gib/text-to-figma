#!/bin/bash

# Quick script to add imports to the remaining critical tools
# Tools to update: connect_shapes, get_node_by_id, list_pages, create_page, get_absolute_bounds, get_relative_bounds

TOOLS_DIR="/Users/Spare/Documents/code/text-to-figma/mcp-server/src/tools"

TOOLS=(
  "connect_shapes"
  "get_node_by_id"
  "list_pages"
  "create_page"
  "get_absolute_bounds"
  "get_relative_bounds"
)

for tool in "${TOOLS[@]}"; do
  file="$TOOLS_DIR/${tool}.ts"
  echo "Processing $tool..."

  # Check if already has imports
  if grep -q "tool-result.js" "$file"; then
    echo "  ✓ Already has imports, skipping"
    continue
  fi

  # Create backup
  cp "$file" "$file.bak"

  # Add imports after first getFigmaBridge import
  sed -i.tmp "/import.*getFigmaBridge/a\\
import { createToolResult, type ToolResult } from '../utils/tool-result.js';\\
import { createScopedLogger } from '../utils/logger.js';\\
\\
const log = createScopedLogger('${tool}');
" "$file"

  rm "$file.tmp"
  echo "  ✓ Updated $file"
done

echo ""
echo "✅ All tools updated!"
echo "Next: Manually update the function implementations"
