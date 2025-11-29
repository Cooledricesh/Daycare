#!/bin/bash

# Quality Check Script for Next.js + TypeScript + Vitest
# This script runs type checking, linting, and build verification

set -e  # Exit on error

echo "🔍 Running Quality Checks..."
echo "================================"

# Check if we're in a Next.js project
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Are you in a Next.js project?"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0;33[0m' # No Color

# Track overall status
ALL_PASSED=true

# 1. Type Check
echo ""
echo "📘 Running TypeScript Type Check..."
if npm run type-check 2>/dev/null || npx tsc --noEmit; then
    echo -e "${GREEN}✅ Type check passed${NC}"
else
    echo -e "${RED}❌ Type check failed${NC}"
    ALL_PASSED=false
fi

# 2. Lint
echo ""
echo "🔧 Running ESLint..."
if npm run lint; then
    echo -e "${GREEN}✅ Lint check passed${NC}"
else
    echo -e "${RED}❌ Lint check failed${NC}"
    ALL_PASSED=false
fi

# 3. Build
echo ""
echo "🏗️  Running Build..."
if npm run build; then
    echo -e "${GREEN}✅ Build succeeded${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    ALL_PASSED=false
fi

# Summary
echo ""
echo "================================"
if [ "$ALL_PASSED" = true ]; then
    echo -e "${GREEN}✅ All quality checks passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some quality checks failed. Please fix the issues above.${NC}"
    exit 1
fi
