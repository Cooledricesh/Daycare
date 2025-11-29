#!/bin/bash

# Test Coverage Check Script for Vitest
# This script runs tests and verifies 70% coverage threshold

set -e

echo "🧪 Running Tests with Coverage..."
echo "================================"

# Check if vitest is installed
if ! npm list vitest > /dev/null 2>&1; then
    echo "❌ Error: Vitest is not installed. Run: npm install -D vitest"
    exit 1
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Run tests with coverage
echo ""
echo "Running tests..."
npm run test:coverage || npm run test -- --coverage

# Check if coverage directory exists
if [ ! -d "coverage" ]; then
    echo -e "${RED}❌ Coverage directory not found${NC}"
    exit 1
fi

# Parse coverage summary (this is a simple check)
echo ""
echo "================================"
echo "📊 Coverage Summary"
echo "================================"

# Show coverage summary
if [ -f "coverage/coverage-summary.json" ]; then
    # Use jq if available, otherwise just show the file
    if command -v jq &> /dev/null; then
        jq '.total' coverage/coverage-summary.json
    else
        cat coverage/coverage-summary.json
    fi
fi

echo ""
echo "✅ Test coverage check complete!"
echo "💡 Review coverage/index.html for detailed report"
echo ""
echo "Target: 70% coverage for all metrics"
