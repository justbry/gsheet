#!/usr/bin/env bash
#
# End-to-End CLI Testing Script
# Tests the gsheet CLI with a real Google Spreadsheet
#
# Usage: ./scripts/test-cli-e2e.sh <spreadsheet-id>
#

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Helper functions
log_test() {
  echo -e "\n${BLUE}TEST:${NC} $1"
  ((TESTS_TOTAL++))
}

pass() {
  echo -e "${GREEN}✓ PASS${NC}"
  ((TESTS_PASSED++))
}

fail() {
  echo -e "${RED}✗ FAIL:${NC} $1"
  ((TESTS_FAILED++))
}

# Check arguments
if [ -z "$1" ]; then
  echo "Usage: $0 <spreadsheet-id>"
  echo ""
  echo "Example:"
  echo "  $0 1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8"
  exit 1
fi

SPREADSHEET_ID=$1

# Check credentials
if [ -z "$CREDENTIALS_CONFIG" ]; then
  echo -e "${RED}Error:${NC} CREDENTIALS_CONFIG environment variable not set"
  echo ""
  echo "Set it with:"
  echo "  export CREDENTIALS_CONFIG=\$(base64 -i /path/to/service-account.json)"
  exit 1
fi

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  gsheet CLI End-to-End Tests${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo "Spreadsheet ID: $SPREADSHEET_ID"
echo ""

# ============================================
# Phase 3.1: Help & Version Commands
# ============================================
echo -e "\n${YELLOW}Phase 3.1: Help & Version Commands${NC}"

log_test "gsheet --help displays help text"
if gsheet --help | grep -q "USAGE:"; then
  pass
else
  fail "Help text not displayed"
fi

log_test "gsheet -h works as alias"
if gsheet -h | grep -q "USAGE:"; then
  pass
else
  fail "Short flag -h not working"
fi

log_test "gsheet --version displays version"
if gsheet --version | grep -q "gsheet v"; then
  pass
else
  fail "Version not displayed"
fi

log_test "gsheet -v works as alias"
if gsheet -v | grep -q "gsheet v"; then
  pass
else
  fail "Short flag -v not working"
fi

# ============================================
# Phase 3.2: Error Handling
# ============================================
echo -e "\n${YELLOW}Phase 3.2: Error Handling${NC}"

log_test "Missing spreadsheet ID shows error"
if gsheet ls 2>&1 | grep -q "Missing required flag: --spreadsheet-id"; then
  pass
else
  fail "Error message not shown"
fi

log_test "Invalid command shows error"
if gsheet invalidcmd --spreadsheet-id "$SPREADSHEET_ID" 2>&1 | grep -q "Unknown command"; then
  pass
else
  fail "Invalid command not caught"
fi

log_test "Missing filename for read shows error"
if gsheet read --spreadsheet-id "$SPREADSHEET_ID" 2>&1 | grep -q "requires a filename"; then
  pass
else
  fail "Missing filename not caught"
fi

# ============================================
# Phase 3.3: List Command
# ============================================
echo -e "\n${YELLOW}Phase 3.3: List Command${NC}"

log_test "gsheet ls works"
if gsheet ls --spreadsheet-id "$SPREADSHEET_ID" > /dev/null 2>&1; then
  pass
else
  fail "List command failed"
fi

log_test "gsheet ls --json outputs valid JSON"
if gsheet ls --spreadsheet-id "$SPREADSHEET_ID" --json 2>&1 | jq . > /dev/null 2>&1; then
  pass
else
  fail "JSON output is invalid"
fi

log_test "gsheet list (alias) works"
if gsheet list --spreadsheet-id "$SPREADSHEET_ID" > /dev/null 2>&1; then
  pass
else
  fail "List alias not working"
fi

# ============================================
# Phase 3.4: Write Command
# ============================================
echo -e "\n${YELLOW}Phase 3.4: Write Command${NC}"

log_test "Write file with --content flag"
if gsheet write TEST_E2E_1.md \
  --content "# E2E Test 1\n\nThis is an automated test." \
  --desc "e2e-test" \
  --tags "test,automated" \
  --spreadsheet-id "$SPREADSHEET_ID" 2>&1 | grep -q "Wrote TEST_E2E_1.md"; then
  pass
else
  fail "Write with --content failed"
fi

log_test "Write file from local file"
echo "# E2E Test 2\n\nFrom local file." > /tmp/test-e2e-2.md
if gsheet write TEST_E2E_2.md \
  --file /tmp/test-e2e-2.md \
  --desc "e2e-local" \
  --spreadsheet-id "$SPREADSHEET_ID" 2>&1 | grep -q "Wrote TEST_E2E_2.md"; then
  pass
  rm /tmp/test-e2e-2.md
else
  fail "Write from file failed"
fi

log_test "List shows newly created files"
if gsheet ls --spreadsheet-id "$SPREADSHEET_ID" --json | jq -r '.[].file' | grep -q "TEST_E2E_1.md"; then
  pass
else
  fail "Created file not appearing in list"
fi

# ============================================
# Phase 3.5: Read Command
# ============================================
echo -e "\n${YELLOW}Phase 3.5: Read Command${NC}"

log_test "Read file content"
if gsheet read TEST_E2E_1.md --spreadsheet-id "$SPREADSHEET_ID" 2>&1 | grep -q "E2E Test 1"; then
  pass
else
  fail "Read command failed or wrong content"
fi

log_test "Read with --metadata shows metadata"
if gsheet read TEST_E2E_1.md --metadata --spreadsheet-id "$SPREADSHEET_ID" 2>&1 | grep -q "Description:"; then
  pass
else
  fail "Metadata not shown"
fi

log_test "Read non-existent file shows error"
if gsheet read NONEXISTENT_FILE.md --spreadsheet-id "$SPREADSHEET_ID" 2>&1 | grep -q "File not found"; then
  pass
else
  fail "Non-existent file error not shown"
fi

log_test "gsheet cat (alias) works"
if gsheet cat TEST_E2E_1.md --spreadsheet-id "$SPREADSHEET_ID" 2>&1 | grep -q "E2E Test 1"; then
  pass
else
  fail "Cat alias not working"
fi

# ============================================
# Phase 3.6: Update Existing File
# ============================================
echo -e "\n${YELLOW}Phase 3.6: Update Existing File${NC}"

log_test "Update existing file"
if gsheet write TEST_E2E_1.md \
  --content "# E2E Test 1 Updated\n\nContent has been updated." \
  --desc "e2e-updated" \
  --spreadsheet-id "$SPREADSHEET_ID" 2>&1 | grep -q "Wrote TEST_E2E_1.md"; then
  pass
else
  fail "Update failed"
fi

log_test "Read shows updated content"
if gsheet read TEST_E2E_1.md --spreadsheet-id "$SPREADSHEET_ID" 2>&1 | grep -q "Updated"; then
  pass
else
  fail "Updated content not shown"
fi

# ============================================
# Phase 3.7: Delete Command
# ============================================
echo -e "\n${YELLOW}Phase 3.7: Delete Command${NC}"

log_test "Delete file"
if gsheet delete TEST_E2E_2.md --spreadsheet-id "$SPREADSHEET_ID" 2>&1 | grep -q "Deleted TEST_E2E_2.md"; then
  pass
else
  fail "Delete command failed"
fi

log_test "Deleted file not in list"
if ! gsheet ls --spreadsheet-id "$SPREADSHEET_ID" --json | jq -r '.[].file' | grep -q "TEST_E2E_2.md"; then
  pass
else
  fail "Deleted file still appearing in list"
fi

log_test "Delete non-existent file shows error"
if gsheet delete NONEXISTENT_FILE.md --spreadsheet-id "$SPREADSHEET_ID" 2>&1 | grep -q "File not found"; then
  pass
else
  fail "Non-existent file deletion error not shown"
fi

log_test "Cannot delete PLAN.md"
if gsheet delete PLAN.md --spreadsheet-id "$SPREADSHEET_ID" 2>&1 | grep -q "Cannot delete PLAN.md"; then
  pass
else
  fail "PLAN.md deletion was allowed"
fi

log_test "gsheet rm (alias) works"
if gsheet rm TEST_E2E_1.md --spreadsheet-id "$SPREADSHEET_ID" 2>&1 | grep -q "Deleted TEST_E2E_1.md"; then
  pass
else
  fail "Rm alias not working"
fi

# ============================================
# Phase 3.8: Special Characters & Edge Cases
# ============================================
echo -e "\n${YELLOW}Phase 3.8: Edge Cases${NC}"

log_test "Handle special characters in content"
if gsheet write TEST_SPECIAL.md \
  --content "# Special\n\n\"Quotes\" 'Apostrophes' & < > \$ 日本語" \
  --spreadsheet-id "$SPREADSHEET_ID" 2>&1 | grep -q "Wrote"; then
  pass
else
  fail "Special characters handling failed"
fi

log_test "Read special characters correctly"
if gsheet read TEST_SPECIAL.md --spreadsheet-id "$SPREADSHEET_ID" 2>&1 | grep -q "日本語"; then
  pass
  gsheet delete TEST_SPECIAL.md --spreadsheet-id "$SPREADSHEET_ID" > /dev/null 2>&1
else
  fail "Special characters not preserved"
fi

log_test "Handle empty content"
if gsheet write TEST_EMPTY.md \
  --content "" \
  --spreadsheet-id "$SPREADSHEET_ID" 2>&1 | grep -q "Wrote"; then
  pass
  gsheet delete TEST_EMPTY.md --spreadsheet-id "$SPREADSHEET_ID" > /dev/null 2>&1
else
  fail "Empty content handling failed"
fi

# ============================================
# Summary
# ============================================
echo -e "\n${YELLOW}========================================${NC}"
echo -e "${YELLOW}  Test Results${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo "Total Tests:  $TESTS_TOTAL"
echo -e "Passed:       ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed:       ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
