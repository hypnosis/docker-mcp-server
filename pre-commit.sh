#!/bin/bash

# ============================================================================
# PRE-COMMIT TEST SCRIPT
# Comprehensive testing before committing changes
# ============================================================================

set -e  # Exit on any error

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         Docker MCP Server - Pre-Commit Tests                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
FAILED_TESTS=()
PASSED_TESTS=()

# Function to print step
print_step() {
    echo ""
    echo -e "${BLUE}▶ $1${NC}"
    echo "────────────────────────────────────────────────────────────────"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    PASSED_TESTS+=("$1")
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
    FAILED_TESTS+=("$1")
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# ============================================================================
# STEP 1: Clean and Build
# ============================================================================

print_step "Step 1: Clean and Build"

echo "Cleaning dist folder..."
npm run clean
print_success "Clean completed"

echo "Building TypeScript..."
npm run build
if [ $? -eq 0 ]; then
    print_success "Build successful"
else
    print_error "Build failed"
    exit 1
fi

# ============================================================================
# STEP 2: TypeScript and Linting
# ============================================================================

print_step "Step 2: TypeScript Check"

echo "Checking TypeScript types..."
npx tsc --noEmit
if [ $? -eq 0 ]; then
    print_success "TypeScript check passed"
else
    print_error "TypeScript errors found"
    exit 1
fi

# ============================================================================
# STEP 3: Unit Tests
# ============================================================================

print_step "Step 3: Unit Tests"

echo "Running unit tests..."
npm run test:unit
if [ $? -eq 0 ]; then
    print_success "Unit tests passed"
else
    print_error "Unit tests failed"
    exit 1
fi

# ============================================================================
# STEP 4: Test Coverage
# ============================================================================

print_step "Step 4: Test Coverage"

echo "Generating test coverage..."
npm run test:coverage
if [ $? -eq 0 ]; then
    print_success "Coverage generated"
    echo ""
    echo "Coverage report available at: coverage/index.html"
else
    print_warning "Coverage generation had warnings (non-blocking)"
fi

# ============================================================================
# STEP 5: Manual Test Reminder
# ============================================================================

print_step "Step 5: Manual Test Reminder"

echo "Automated tests completed successfully!"
echo ""
print_warning "REMINDER: Have you tested manually?"
echo ""
echo "Please verify:"
echo "  1. LOCAL profile works (default)"
echo "  2. REMOTE profile works (if configured in profiles.json)"
echo "  3. All critical commands tested with real data"
echo "  4. Documentation is up to date"
echo ""
echo "E2E tests: Run manually when needed:"
echo "  npm run test:e2e              # All E2E tests"
echo "  npm run test:e2e:database     # Database tools only"
echo "  npm run test:e2e:container    # Container tools only"
echo ""
echo "See docs/testing/MANUAL_TEST.md for detailed checklist"
echo ""

read -p "Have you completed manual tests? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Manual tests not completed"
    echo "Please complete manual tests before committing"
    exit 1
fi

print_success "Manual tests confirmed"

# ============================================================================
# STEP 6: Final Checks
# ============================================================================

print_step "Step 6: Final Checks"

echo "Checking for uncommitted changes..."
if git diff --quiet && git diff --cached --quiet; then
    print_warning "No changes to commit"
else
    print_success "Changes ready to commit"
fi

echo "Checking package version..."
PACKAGE_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $PACKAGE_VERSION"
print_success "Version check completed"

# ============================================================================
# Summary
# ============================================================================

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    TEST SUMMARY                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

echo -e "${GREEN}Passed Tests (${#PASSED_TESTS[@]}):${NC}"
for test in "${PASSED_TESTS[@]}"; do
    echo "  ✓ $test"
done

if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}Failed Tests (${#FAILED_TESTS[@]}):${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo "  ✗ $test"
    done
    echo ""
    print_error "Some tests failed. Please fix before committing."
    exit 1
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          ALL TESTS PASSED! Ready to commit ✓                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo "Next steps:"
echo "  1. Review your changes: git diff"
echo "  2. Stage your changes: git add ."
echo "  3. Commit: git commit -m 'your message'"
echo "  4. Push: git push"
echo ""
