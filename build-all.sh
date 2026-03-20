#!/usr/bin/env bash

###############################################################################
# Build All Components - Text-to-Figma Project
#
# This script builds all components of the Text-to-Figma system:
# - MCP Server (TypeScript → JavaScript)
# - Figma Plugin (TypeScript → JavaScript)
# - WebSocket Server (no build needed, pure JavaScript)
# - Tests (no build needed)
#
# Usage: ./build-all.sh
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_header() {
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  $1${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install Node.js first."
    exit 1
fi

print_header "Text-to-Figma Build System"

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

print_step "Project root: $PROJECT_ROOT"

###############################################################################
# Step 1: Install dependencies
###############################################################################

print_header "Step 1: Installing Dependencies"

print_step "Installing root dependencies..."
npm install
print_success "Root dependencies installed"

print_step "Installing MCP server dependencies..."
cd "$PROJECT_ROOT/mcp-server"
npm install
print_success "MCP server dependencies installed"

print_step "Installing WebSocket server dependencies..."
cd "$PROJECT_ROOT/websocket-server"
npm install
print_success "WebSocket server dependencies installed"

print_step "Installing Figma plugin dependencies..."
cd "$PROJECT_ROOT/figma-plugin"
npm install
print_success "Figma plugin dependencies installed"

print_step "Installing test dependencies..."
cd "$PROJECT_ROOT/tests"
npm install
print_success "Test dependencies installed"

###############################################################################
# Step 2: Build TypeScript components
###############################################################################

print_header "Step 2: Building TypeScript Components"

print_step "Building MCP server..."
cd "$PROJECT_ROOT/mcp-server"
npm run build
print_success "MCP server built → dist/"

print_step "Building Figma plugin..."
cd "$PROJECT_ROOT/figma-plugin"
npm run build
print_success "Figma plugin built → code.js"

print_step "Building WebSocket server..."
cd "$PROJECT_ROOT/websocket-server"
npm run build
print_success "WebSocket server built → dist/"

###############################################################################
# Step 3: Verify builds
###############################################################################

print_header "Step 3: Verifying Builds"

# Check MCP server build
if [ -f "$PROJECT_ROOT/mcp-server/dist/index.js" ]; then
    print_success "MCP server build verified"
else
    print_error "MCP server build failed - dist/index.js not found"
    exit 1
fi

# Check Figma plugin build
if [ -f "$PROJECT_ROOT/figma-plugin/code.js" ]; then
    print_success "Figma plugin build verified"
else
    print_error "Figma plugin build failed - code.js not found"
    exit 1
fi

# Check WebSocket server build
if [ -f "$PROJECT_ROOT/websocket-server/dist/server.js" ]; then
    print_success "WebSocket server build verified"
else
    print_error "WebSocket server build failed - dist/server.js not found"
    exit 1
fi

###############################################################################
# Step 4: Run type checks
###############################################################################

print_header "Step 4: Running Type Checks"

print_step "Type-checking MCP server..."
cd "$PROJECT_ROOT/mcp-server"
npm run type-check
print_success "MCP server types OK"

print_step "Type-checking Figma plugin..."
cd "$PROJECT_ROOT/figma-plugin"
npm run type-check
print_success "Figma plugin types OK"

###############################################################################
# Summary
###############################################################################

cd "$PROJECT_ROOT"

print_header "Build Complete! 🎉"

echo -e "${GREEN}All components built successfully:${NC}"
echo ""
echo "  MCP Server       → mcp-server/dist/"
echo "  Figma Plugin     → figma-plugin/code.js"
echo "  WebSocket Server → websocket-server/dist/"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""
echo "  1. Start the WebSocket server:"
echo "     cd websocket-server && npm start"
echo ""
echo "  2. Start the MCP server (new terminal):"
echo "     cd mcp-server && npm start"
echo ""
echo "  3. Load the Figma plugin:"
echo "     Figma → Plugins → Development → Import plugin from manifest"
echo "     Select: figma-plugin/manifest.json"
echo ""
echo -e "${BLUE}For detailed instructions, see: ${NC}USER_GUIDE.md"
echo ""
