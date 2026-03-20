#!/bin/bash

###############################################################################
# Run All Test Suites
#
# Delegates to vitest via the root package.json. All tests (unit and
# integration) are configured in vitest.workspace.ts.
###############################################################################

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Running all tests via vitest..."
npm test
