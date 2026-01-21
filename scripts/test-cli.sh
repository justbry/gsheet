#!/usr/bin/env bash

# Quick CLI Test Script
# Tests core functionality of the gsheet CLI
# Usage: ./scripts/test-cli.sh <spreadsheet-id>

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SPREADSHEET_ID=$1

# Check arguments
if [ -z "$SPREADSHEET_ID" ]; then
  echo -e "${RED}Error: Spreadsheet ID required${NC}"
  echo "Usage: $0 <spreadsheet-id>"
  echo ""
  echo "Example:"
  echo "  export CREDENTIALS_CONFIG=\$(base64 -i service-account.json)"
  echo "  $0 1abc...xyz"
  exit 1
fi

# Check credentials
if [ -z "$CREDENTIALS_CONFIG" ]; then
  echo -e "${RED}Error: CREDENTIALS_CONFIG environment variable not set${NC}"
  echo ""
  echo "Set it with:"
  echo "  export CREDENTIALS_CONFIG=\$(base64 -i service-account.json)"
  exit 1
fi

# Check if gsheet command exists
if ! command -v gsheet &> /dev/null; then
  echo -e "${YELLOW}Warning: gsheet command not found${NC}"
  echo "Run 'bun link' first to install the CLI globally"
  exit 1
fi

echo ""
echo "🧪 Testing Google Sheets Agent CLI"
echo "=================================="
echo "Spreadsheet ID: $SPREADSHEET_ID"
echo ""

PASS=0
FAIL=0
TOTAL=0

# Helper function to run test
run_test() {
  local name=$1
  local cmd=$2

  TOTAL=$((TOTAL + 1))
  echo -n "Testing $name... "

  if eval "$cmd" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}✗${NC}"
    FAIL=$((FAIL + 1))
    echo "  Command: $cmd"
  fi
}

# Helper function to run test expecting failure
run_test_expect_fail() {
  local name=$1
  local cmd=$2

  TOTAL=$((TOTAL + 1))
  echo -n "Testing $name... "

  if eval "$cmd" > /dev/null 2>&1; then
    echo -e "${RED}✗ (should have failed)${NC}"
    FAIL=$((FAIL + 1))
  else
    echo -e "${GREEN}✓${NC}"
    PASS=$((PASS + 1))
  fi
}

echo "Phase 1: Basic Commands"
echo "----------------------"

run_test "help" "gsheet --help"
run_test "version" "gsheet --version"
run_test "list files" "gsheet ls --spreadsheet-id=$SPREADSHEET_ID"

echo ""
echo "Phase 2: Write Operations"
echo "------------------------"

run_test "write from content" "gsheet write TEST_CLI.md --content '# Test' --spreadsheet-id=$SPREADSHEET_ID"
run_test "write with metadata" "gsheet write TEST_META.md --content '# Meta' --desc 'test' --tags 'cli,test' --spreadsheet-id=$SPREADSHEET_ID"

# Create temp file for file-based write
echo "# Local File" > /tmp/test-cli-local.md
run_test "write from file" "gsheet write TEST_LOCAL.md --file /tmp/test-cli-local.md --spreadsheet-id=$SPREADSHEET_ID"

echo ""
echo "Phase 3: Read Operations"
echo "-----------------------"

run_test "read file" "gsheet read TEST_CLI.md --spreadsheet-id=$SPREADSHEET_ID"
run_test "read with metadata" "gsheet read TEST_META.md --metadata --spreadsheet-id=$SPREADSHEET_ID"
run_test "list shows files" "gsheet ls --spreadsheet-id=$SPREADSHEET_ID | grep TEST_CLI.md"

echo ""
echo "Phase 4: Update Operations"
echo "-------------------------"

run_test "update existing file" "gsheet write TEST_CLI.md --content '# Updated' --spreadsheet-id=$SPREADSHEET_ID"
run_test "verify update" "gsheet read TEST_CLI.md --spreadsheet-id=$SPREADSHEET_ID | grep Updated"

echo ""
echo "Phase 5: Delete Operations"
echo "-------------------------"

run_test "delete file" "gsheet delete TEST_LOCAL.md --spreadsheet-id=$SPREADSHEET_ID"
run_test "verify deletion" "! gsheet read TEST_LOCAL.md --spreadsheet-id=$SPREADSHEET_ID 2>&1 | grep 'File not found'"
run_test_expect_fail "delete PLAN.md (protected)" "gsheet delete PLAN.md --spreadsheet-id=$SPREADSHEET_ID"

echo ""
echo "Phase 6: Error Handling"
echo "----------------------"

run_test_expect_fail "missing spreadsheet-id" "gsheet ls"
run_test_expect_fail "invalid command" "gsheet invalid --spreadsheet-id=$SPREADSHEET_ID"
run_test_expect_fail "read missing file" "gsheet read NONEXISTENT.md --spreadsheet-id=$SPREADSHEET_ID"
run_test_expect_fail "write without content" "gsheet write TEST.md --spreadsheet-id=$SPREADSHEET_ID"

echo ""
echo "Phase 7: Cleanup"
echo "---------------"

run_test "cleanup test files" "gsheet delete TEST_CLI.md --spreadsheet-id=$SPREADSHEET_ID && gsheet delete TEST_META.md --spreadsheet-id=$SPREADSHEET_ID"

echo ""
echo "=================================="
echo "Results: $PASS/$TOTAL passed"

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}$FAIL tests failed${NC}"
  exit 1
else
  echo -e "${GREEN}All tests passed! 🎉${NC}"
  exit 0
fi
