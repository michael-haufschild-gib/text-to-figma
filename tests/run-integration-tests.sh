#!/bin/bash

###############################################################################
# Run Integration Tests
#
# Delegates to vitest integration project via the root package.json.
###############################################################################

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Running integration tests via vitest..."
npm run test:integration
