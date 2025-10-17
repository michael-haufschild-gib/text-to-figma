#!/bin/bash

###############################################################################
# Run All Test Suites
#
# Executes all test suites in the proper order:
# 1. Unit tests (color converter, typography generator)
# 2. Integration tests (foundation, WCAG contrast, component tools)
# 3. Validation tests (design tokens)
# 4. E2E tests (button component, login form)
# 5. Agent tests (design reviewer)
#
# Returns exit code 0 if all tests pass, 1 if any fail.
###############################################################################

set -e  # Exit on first error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track results
TOTAL_SUITES=0
PASSED_SUITES=0
FAILED_SUITES=0
FAILED_SUITE_NAMES=()

# Function to run a test suite
run_test() {
  local test_name=$1
  local test_path=$2

  TOTAL_SUITES=$((TOTAL_SUITES + 1))

  echo ""
  echo "========================================="
  echo -e "${BLUE}Running: $test_name${NC}"
  echo "========================================="
  echo ""

  if node "$test_path"; then
    PASSED_SUITES=$((PASSED_SUITES + 1))
    echo ""
    echo -e "${GREEN}✓ $test_name PASSED${NC}"
  else
    FAILED_SUITES=$((FAILED_SUITES + 1))
    FAILED_SUITE_NAMES+=("$test_name")
    echo ""
    echo -e "${RED}✗ $test_name FAILED${NC}"
  fi
}

# Print header
echo ""
echo "==========================================="
echo -e "${BLUE}Text-to-Figma Comprehensive Test Suite${NC}"
echo "==========================================="
echo ""

# Check if MCP server is built
if [ ! -d "mcp-server/dist" ]; then
  echo -e "${YELLOW}⚠ MCP server not built. Building now...${NC}"
  cd mcp-server
  npm run build
  cd ..
  echo -e "${GREEN}✓ MCP server built${NC}"
fi

# Phase 1: Unit Tests
echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 1: Unit Tests${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""

run_test "Color Converter" "tests/unit/color-converter.test.js"
run_test "Typography Generator" "tests/unit/typography-generator.test.js"

# Phase 2: Integration Tests
echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 2: Integration Tests${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""

run_test "Foundation" "tests/integration/foundation.test.js"
run_test "WCAG Contrast" "tests/integration/wcag-contrast.test.js"
run_test "WCAG Contrast (Enhanced)" "tests/integration/wcag-contrast-enhanced.test.js"
run_test "Component Tools" "tests/integration/component-tools.test.js"

# Phase 3: Validation Tests
echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 3: Validation Tests${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""

run_test "Design Token Validation" "tests/validation/design-tokens.test.js"

# Phase 4: Agent Tests
echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 4: Agent Tests${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""

run_test "Design Review Agent" "tests/agents/design-reviewer.js"

# Phase 5: E2E Tests
echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 5: E2E Tests${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""

run_test "Button Component E2E" "tests/e2e/button-component.test.js"
run_test "Login Form E2E" "tests/e2e/login-form.test.js"

# Print final summary
echo ""
echo "==========================================="
echo -e "${BLUE}Test Summary${NC}"
echo "==========================================="
echo ""
echo "Total Suites: $TOTAL_SUITES"
echo -e "${GREEN}Passed: $PASSED_SUITES${NC}"
echo -e "${RED}Failed: $FAILED_SUITES${NC}"
echo ""

if [ $FAILED_SUITES -gt 0 ]; then
  echo -e "${RED}Failed Suites:${NC}"
  for suite in "${FAILED_SUITE_NAMES[@]}"; do
    echo -e "${RED}  ✗ $suite${NC}"
  done
  echo ""
  echo "==========================================="
  echo -e "${RED}TESTS FAILED${NC}"
  echo "==========================================="
  echo ""
  exit 1
else
  echo "==========================================="
  echo -e "${GREEN}ALL TESTS PASSED ✓${NC}"
  echo "==========================================="
  echo ""
  echo "Test Coverage:"
  echo "  ✓ Unit tests (2 suites)"
  echo "  ✓ Integration tests (4 suites)"
  echo "  ✓ Validation tests (1 suite)"
  echo "  ✓ Agent tests (1 suite)"
  echo "  ✓ E2E tests (2 suites)"
  echo ""
  echo "Total: $PASSED_SUITES/$TOTAL_SUITES test suites passed"
  echo ""
  exit 0
fi
