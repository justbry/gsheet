# Test Scripts

This directory contains automated testing scripts for the g-sheet-agent-io CLI.

---

## `test-cli-e2e.sh`

**Comprehensive end-to-end CLI test script**

### Description

Runs 30+ automated tests covering all CLI functionality including:
- Help and version commands
- Error handling and validation
- List operations
- Write operations (new files and updates)
- Read operations (with and without metadata)
- Delete operations (with PLAN.md protection)
- Special characters and edge cases

### Prerequisites

1. **Service Account Credentials**
   ```bash
   export CREDENTIALS_CONFIG=$(base64 -i /path/to/service-account.json)
   ```

2. **Clean Test Spreadsheet**
   - Create a new Google Spreadsheet
   - Share with service account email (Editor role)
   - Note the spreadsheet ID from URL

### Usage

```bash
./scripts/test-cli-e2e.sh <spreadsheet-id>
```

### Example

```bash
# Set credentials
export CREDENTIALS_CONFIG=$(base64 -i ~/.config/gcloud/service-account.json)

# Run tests
./scripts/test-cli-e2e.sh 1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8
```

### Output

```
========================================
  gsheet CLI End-to-End Tests
========================================

Spreadsheet ID: 1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8

Phase 3.1: Help & Version Commands

TEST: gsheet --help displays help text
✓ PASS

TEST: gsheet -h works as alias
✓ PASS

...

========================================
  Test Results
========================================

Total Tests:  30
Passed:       30
Failed:       0

✓ All tests passed!
```

### Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed or error occurred

### Test Coverage

| Phase | Tests | Coverage |
|-------|-------|----------|
| 3.1 - Help & Version | 4 | --help, -h, --version, -v |
| 3.2 - Error Handling | 3 | Missing flags, invalid commands, validation |
| 3.3 - List Command | 3 | ls, --json, aliases |
| 3.4 - Write Command | 3 | --content, --file, metadata |
| 3.5 - Read Command | 4 | read, --metadata, cat alias, errors |
| 3.6 - Update Files | 2 | Overwrite existing files |
| 3.7 - Delete Command | 4 | delete, PLAN.md protection, rm alias |
| 3.8 - Edge Cases | 7 | Special chars, Unicode, empty content |

**Total:** 30 tests

### Notes

- Script creates test files (TEST_E2E_*.md) which are cleaned up after testing
- Requires a clean spreadsheet without existing AGENTSCAPE sheet or with compatible structure
- Tests are non-destructive to existing data (creates/deletes only test files)
- Safe to run multiple times

---

## Adding New Tests

To add new tests to the E2E script:

1. Add test function after existing phases
2. Increment `TESTS_TOTAL` counter
3. Use `pass()` or `fail("reason")` to record results
4. Clean up any test data created

Example:

```bash
# Phase 3.9: New Feature Tests
echo -e "\n${YELLOW}Phase 3.9: New Feature Tests${NC}"

log_test "Test new feature"
if gsheet new-command --spreadsheet-id "$SPREADSHEET_ID" 2>&1 | grep -q "expected output"; then
  pass
else
  fail "Expected output not found"
fi
```

---

## CI/CD Integration

To integrate with CI/CD:

```yaml
# Example GitHub Actions
- name: Run E2E Tests
  env:
    CREDENTIALS_CONFIG: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_BASE64 }}
  run: |
    ./scripts/test-cli-e2e.sh ${{ secrets.TEST_SPREADSHEET_ID }}
```

---

## Troubleshooting

**"CREDENTIALS_CONFIG not set"**
- Ensure environment variable is set with base64-encoded credentials
- Check: `echo $CREDENTIALS_CONFIG | base64 -d | jq .`

**Permission errors**
- Verify service account has Editor access to spreadsheet
- Check service account email in credentials JSON
- Share spreadsheet with that email

**"Sheet already exists" errors**
- Use a fresh spreadsheet without existing AGENTSCAPE sheet
- Or ensure existing sheet has compatible structure (5 columns)

**Tests failing unexpectedly**
- Run `bun run build` first to ensure latest CLI
- Verify `gsheet --version` shows expected version
- Check `which gsheet` points to correct binary
