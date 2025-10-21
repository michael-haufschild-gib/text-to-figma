#!/bin/bash

# Integration Test Runner
# Runs all integration tests for the Text-to-Figma WebSocket bridge

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_DIR="$SCRIPT_DIR/integration"
UNIT_TEST_DIR="$SCRIPT_DIR/unit"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Text-to-Figma Test Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}Node.js version: $(node --version)${NC}"
echo ""

# Check if MCP server is built
if [ ! -d "$PROJECT_ROOT/mcp-server/dist" ]; then
    echo -e "${YELLOW}MCP server not built. Building...${NC}"
    cd "$PROJECT_ROOT/mcp-server"
    npm run build
    cd "$PROJECT_ROOT"
    echo ""
else
    # Verify TypeScript compilation is up-to-date
    echo -e "${YELLOW}Verifying TypeScript compilation...${NC}"
    cd "$PROJECT_ROOT/mcp-server"

    # Run type-check to ensure no compilation errors
    if ! npm run type-check > /dev/null 2>&1; then
        echo -e "${RED}Error: TypeScript compilation check failed${NC}"
        echo -e "${YELLOW}Running full build...${NC}"
        npm run build
        if [ $? -ne 0 ]; then
            echo -e "${RED}Build failed. Exiting.${NC}"
            exit 1
        fi
    else
        # Check if any .ts files are newer than dist directory
        if find src -name "*.ts" -newer dist -print -quit | grep -q .; then
            echo -e "${YELLOW}Source files changed. Rebuilding...${NC}"
            npm run build
            if [ $? -ne 0 ]; then
                echo -e "${RED}Build failed. Exiting.${NC}"
                exit 1
            fi
        else
            echo -e "${GREEN}TypeScript compilation is up-to-date${NC}"
        fi
    fi

    cd "$PROJECT_ROOT"
    echo ""
fi

# Check if WebSocket server dependencies are installed
if [ ! -d "$PROJECT_ROOT/websocket-server/node_modules" ]; then
    echo -e "${YELLOW}Installing WebSocket server dependencies...${NC}"
    cd "$PROJECT_ROOT/websocket-server"
    npm install
    cd "$PROJECT_ROOT"
    echo ""
fi

# Ensure no stale server processes are running
echo -e "${YELLOW}Checking for stale server processes...${NC}"
if lsof -ti:8080 &> /dev/null; then
    echo -e "${YELLOW}Killing stale process on port 8080...${NC}"
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    sleep 1
fi
echo ""

cd "$PROJECT_ROOT"

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# =============================================================================
# UNIT TESTS
# =============================================================================
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Running Unit Tests${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Run unit tests
if [ -d "$UNIT_TEST_DIR" ]; then
    for test_file in "$UNIT_TEST_DIR"/*.test.js; do
        if [ -f "$test_file" ]; then
            ((TOTAL_TESTS++))
            test_name=$(basename "$test_file")
            echo -e "${BLUE}Running: ${test_name}${NC}"
            echo ""

            if node "$test_file"; then
                echo ""
                echo -e "${GREEN}✓ ${test_name} passed${NC}"
                echo ""
                ((TESTS_PASSED++))
            else
                echo ""
                echo -e "${RED}✗ ${test_name} failed${NC}"
                echo ""
                ((TESTS_FAILED++))
            fi
        fi
    done
else
    echo -e "${YELLOW}No unit tests found${NC}"
    echo ""
fi

# =============================================================================
# INTEGRATION TESTS
# =============================================================================
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Running Integration Tests${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Run integration tests
for test_file in "$TEST_DIR"/*.test.js; do
    if [ -f "$test_file" ]; then
        ((TOTAL_TESTS++))
        test_name=$(basename "$test_file")
        echo -e "${BLUE}Running: ${test_name}${NC}"
        echo ""

        if node "$test_file"; then
            echo ""
            echo -e "${GREEN}✓ ${test_name} passed${NC}"
            echo ""
            ((TESTS_PASSED++))
        else
            echo ""
            echo -e "${RED}✗ ${test_name} failed${NC}"
            echo ""
            ((TESTS_FAILED++))
        fi
    fi
done

# Final cleanup - ensure no processes are left running
echo -e "${YELLOW}Final cleanup...${NC}"
if lsof -ti:8080 &> /dev/null; then
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
fi
echo ""

# =============================================================================
# SUMMARY
# =============================================================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"
else
    echo -e "${GREEN}Failed: ${TESTS_FAILED}${NC}"
fi
echo ""

# Calculate pass rate
if [ $TOTAL_TESTS -gt 0 ]; then
    PASS_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))
    echo -e "Pass Rate: ${PASS_RATE}%"
    echo ""
fi

# Exit with appropriate code
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Some tests failed${NC}"
    exit 1
else
    echo -e "${GREEN}All tests passed!${NC}"
    echo ""
    echo "Test Coverage:"
    echo "  ✓ Unit Tests (color conversion, typography, WCAG contrast)"
    echo "  ✓ Integration Tests (WebSocket, component tools)"
    echo ""
    exit 0
fi
