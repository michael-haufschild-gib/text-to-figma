#!/bin/bash

# Fix redundant response.success checks in all MCP tools
# The Figma bridge already validates success at the protocol level

set -e

cd "$(dirname "$0")/../src/tools"

echo "Fixing redundant response.success checks in MCP tools..."
echo ""

# List of files to fix (all that have the pattern)
FILES=$(grep -l "if (!response.success)" *.ts 2>/dev/null || true)

if [ -z "$FILES" ]; then
  echo "No files found with response.success checks."
  exit 0
fi

FIXED_COUNT=0

for file in $FILES; do
  echo "Processing $file..."

  # Check if the file has the pattern
  if grep -q "const response = await bridge.sendToFigma<{ success: boolean" "$file"; then
    # Pattern for responses with success/error type
    perl -i -0777 -pe 's/const response = await bridge\.sendToFigma<\{ success: boolean; error\?: string \}>\(\s*([^,]+),\s*(.*?)\s*\);\s*if \(!response\.success\) \{\s*throw new Error\(response\.error \|\| [^\)]+\);\s*\}/\/\/ Note: bridge.sendToFigma validates success at protocol level\n  \/\/ It only resolves if Figma returns success=true, otherwise rejects\n  await bridge.sendToFigma(\n    $1,\n    $2\n  )/gs' "$file"

    if [ $? -eq 0 ]; then
      FIXED_COUNT=$((FIXED_COUNT + 1))
      echo "  ✓ Fixed"
    else
      echo "  ✗ Could not fix (manual review needed)"
    fi
  else
    echo "  → Skipped (different pattern)"
  fi
done

echo ""
echo "Fixed $FIXED_COUNT files."
echo ""
echo "Next steps:"
echo "1. Review changes: git diff src/tools/"
echo "2. Rebuild: npm run build"
echo "3. Test the system"
