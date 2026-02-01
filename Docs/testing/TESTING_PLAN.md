# Testing Plan: Google Sheets Agent CLI

## Overview

This document outlines the complete testing strategy for the Google Sheets Agent CLI implementation. Follow these steps to verify all functionality works correctly.

## Prerequisites

### 1. Environment Setup
```bash
# Install dependencies
bun install

# Build the project
bun run build

# Verify build output
ls -la dist/cli/
```

### 2. Test Spreadsheet Setup
- [ ] Create a new Google Spreadsheet for testing
- [ ] Note the spreadsheet ID: `_______________________________`
- [ ] Share with service account email (Editor role)
- [ ] Verify service account credentials are available

### 3. Credentials Setup
```bash
# Option 1: Environment variable (recommended for testing)
export CREDENTIALS_CONFIG=$(base64 -i /path/to/service-account.json)

# Option 2: Direct file path
export TEST_CREDENTIALS_FILE=/path/to/service-account.json

# Set test spreadsheet ID
export TEST_SPREADSHEET_ID=your-test-spreadsheet-id
```

---

## Phase 0: Quick CLI Verification (Smoke Test)

**Purpose:** Verify CLI is built correctly and executable before running comprehensive tests.

### 0.1 Build CLI
```bash
# Clean build
rm -rf dist/
bun run build
```

**Verify:**
- [ ] Build completes without errors
- [ ] `dist/cli/index.js` exists
- [ ] `dist/cli/index.cjs` exists

### 0.2 Verify Shebang
```bash
head -n 1 dist/cli/index.js
```

**Expected Result:**
- [ ] First line is exactly `#!/usr/bin/env bun`
- [ ] No extra whitespace or characters

### 0.3 Verify CLI is Executable
```bash
# Direct execution (without bun link)
chmod +x dist/cli/index.js
./dist/cli/index.js --help
```

**Verify:**
- [ ] Help text displays
- [ ] No permission errors
- [ ] No "command not found" errors

### 0.4 Test CLI Link Installation
```bash
# Link globally
bun link

# Verify link worked
which gsheet
gsheet --version
```

**Verify:**
- [ ] `which gsheet` shows path to linked binary
- [ ] `gsheet --version` displays version
- [ ] Version format matches "g-sheet-agent-io vX.X.X"

### 0.5 Quick Functional Test
```bash
# Test basic commands work (should fail gracefully without spreadsheet ID)
gsheet --help
gsheet ls 2>&1 | grep -q "Missing required flag: --spreadsheet-id"
```

**Verify:**
- [ ] Help displays correctly
- [ ] Missing spreadsheet ID error is shown
- [ ] CLI responds to commands

### 0.6 Verify Build Artifacts
```bash
ls -lh dist/cli/
file dist/cli/index.js
```

**Verify:**
- [ ] `index.js` is present and executable (`-rwxr-xr-x` or similar)
- [ ] `index.cjs` is present
- [ ] `index.d.ts` is present
- [ ] File type shows as text/script

**If any Phase 0 tests fail, STOP and fix build issues before proceeding.**

**Test Status (2026-01-21):** ✅ **ALL PASSED (6/6)**

---

## Phase 1: Unit Tests

### 1.1 Run All Existing Tests
```bash
bun test
```

**Expected Result:**
- [ ] All existing tests pass
- [ ] No regression in existing functionality

### 1.2 Run CLI-Specific Tests
```bash
# AgentScapeManager tests
bun test tests/cli/agentscape-manager.test.ts

# Parser tests
bun test tests/cli/parser.test.ts
```

**Expected Results:**

**AgentScapeManager Tests:**
- [ ] `listFiles()` returns empty array for empty sheet
- [ ] `listFiles()` returns empty array when sheet doesn't exist
- [ ] `listFiles()` parses and returns files correctly
- [ ] `readFile()` throws ValidationError for empty filename
- [ ] `readFile()` returns null for non-existent file
- [ ] `readFile()` returns file when it exists
- [ ] `readFile()` delegates PLAN.md to PlanManager
- [ ] `writeFile()` throws ValidationError for empty filename
- [ ] `writeFile()` appends new files
- [ ] `writeFile()` updates existing files
- [ ] `writeFile()` delegates PLAN.md to PlanManager
- [ ] `deleteFile()` throws ValidationError for empty filename
- [ ] `deleteFile()` throws ValidationError for PLAN.md
- [ ] `deleteFile()` returns false for non-existent file
- [ ] `deleteFile()` deletes existing files
- [ ] `initAgentScape()` creates sheet if it doesn't exist
- [ ] `initAgentScape()` is idempotent when sheet exists

**Parser Tests:**
- [ ] Parses simple commands
- [ ] Parses commands with args
- [ ] Parses flags with values
- [ ] Parses boolean flags
- [ ] Normalizes -h to --help
- [ ] Normalizes -v to --version
- [ ] Throws error for unknown flags
- [ ] Validates commands correctly
- [ ] Validates required arguments
- [ ] Extracts auth options correctly

### 1.3 Test Coverage Report
```bash
bun test --coverage
```

**Expected Result:**
- [ ] Coverage report generated
- [ ] CLI modules have >80% coverage
- [ ] Note any uncovered areas: ___________________________

**Test Status (2026-01-21):** ✅ **48/49 PASSED (98%)**
- One failing test: `vi.mocked` API issue (non-blocking, test infrastructure only)
- All functional tests pass

---

## Phase 2: Build & Installation Tests

**Test Status (2026-01-21):** ✅ **ALL PASSED**

### 2.1 Verify Build Artifacts
```bash
ls -la dist/cli/
```

**Expected Files:**
- [ ] `index.js` (ESM format)
- [ ] `index.cjs` (CommonJS format)
- [ ] `index.d.ts` (TypeScript declarations)

### 2.2 Check Executable Permissions
```bash
head -n 1 dist/cli/index.js
```

**Expected Result:**
- [ ] First line is `#!/usr/bin/env bun`

### 2.3 Test Local Link
```bash
bun link
gsheet --version
```

**Expected Result:**
- [ ] `gsheet` command is available
- [ ] Version displays correctly

---

## Phase 3: CLI Command Tests (Manual)

**⚡ Quick Start:** An automated E2E test script is available:

```bash
# Set credentials
export CREDENTIALS_CONFIG=$(base64 -i /path/to/service-account.json)

# Run automated tests
./scripts/test-cli-e2e.sh <spreadsheet-id>
```

This script runs 30+ automated tests covering all CLI functionality. Use manual tests below for detailed verification or debugging.

---

### 3.1 Help & Version Commands

```bash
# Test help
gsheet --help
gsheet help
gsheet -h
```

**Verify:**
- [ ] Help text displays
- [ ] All commands listed (ls, read, write, delete, shell)
- [ ] All options documented
- [ ] Examples shown
- [ ] No errors

```bash
# Test version
gsheet --version
gsheet version
gsheet -v
```

**Verify:**
- [ ] Version number displays
- [ ] Format is "g-sheet-agent-io vX.X.X"

### 3.2 Error Handling

```bash
# Missing spreadsheet ID
gsheet ls

# Invalid command
gsheet invalid --spreadsheet-id=$TEST_SPREADSHEET_ID

# Missing filename for read
gsheet read --spreadsheet-id=$TEST_SPREADSHEET_ID

# Missing content/file for write
gsheet write TEST.md --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] Error: "Missing required flag: --spreadsheet-id"
- [ ] Error: "Unknown command: invalid"
- [ ] Error: 'Command "read" requires a filename argument'
- [ ] Error: 'Command "write" requires either --content or --file flag'
- [ ] Exit code is 1 for all errors

### 3.3 List Command

```bash
# List files (should be empty initially)
gsheet ls --spreadsheet-id=$TEST_SPREADSHEET_ID

# List with JSON output
gsheet ls --spreadsheet-id=$TEST_SPREADSHEET_ID --json
```

**Verify:**
- [ ] Command completes successfully
- [ ] Table format shows headers: FILE, DESC, TAGS, DATES
- [ ] Shows "No files found" or empty list (initial state)
- [ ] JSON format is valid JSON array
- [ ] Exit code is 0

### 3.4 Write Command

```bash
# Write from content flag
gsheet write TEST_NOTE.md \
  --content "# Test Note\n\nThis is a test." \
  --desc "test" \
  --tags "test,sample" \
  --spreadsheet-id=$TEST_SPREADSHEET_ID

# Write from file
echo "# Local File\n\nContent from local file." > /tmp/test-local.md
gsheet write LOCAL_FILE.md \
  --file /tmp/test-local.md \
  --desc "local" \
  --spreadsheet-id=$TEST_SPREADSHEET_ID

# Verify files were written
gsheet ls --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] First write shows "✓ Wrote TEST_NOTE.md (XX bytes)"
- [ ] Second write shows "✓ Wrote LOCAL_FILE.md (XX bytes)"
- [ ] List shows both files
- [ ] Metadata (desc, tags) is correct
- [ ] Exit code is 0

### 3.5 Read Command

```bash
# Read file
gsheet read TEST_NOTE.md --spreadsheet-id=$TEST_SPREADSHEET_ID

# Read with metadata
gsheet read TEST_NOTE.md --metadata --spreadsheet-id=$TEST_SPREADSHEET_ID

# Read non-existent file
gsheet read NONEXISTENT.md --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] First read shows file content only
- [ ] Second read shows metadata header + content
- [ ] Metadata shows: File, Description, Tags, Dates
- [ ] Third read shows "File not found: NONEXISTENT.md"
- [ ] Third read exits with code 1

### 3.6 Update Existing File

```bash
# Update TEST_NOTE.md
gsheet write TEST_NOTE.md \
  --content "# Updated Note\n\nThis content has been updated." \
  --desc "updated" \
  --spreadsheet-id=$TEST_SPREADSHEET_ID

# Verify update
gsheet read TEST_NOTE.md --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] Write shows "✓ Wrote TEST_NOTE.md"
- [ ] Read shows updated content
- [ ] File count hasn't increased (update, not append)

### 3.7 Delete Command

```bash
# Delete a file
gsheet delete LOCAL_FILE.md --spreadsheet-id=$TEST_SPREADSHEET_ID

# Verify deletion
gsheet ls --spreadsheet-id=$TEST_SPREADSHEET_ID

# Try to delete PLAN.md (should fail)
gsheet delete PLAN.md --spreadsheet-id=$TEST_SPREADSHEET_ID

# Try to delete non-existent file
gsheet delete NONEXISTENT.md --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] First delete shows "✓ Deleted LOCAL_FILE.md"
- [ ] List no longer shows LOCAL_FILE.md
- [ ] PLAN.md deletion shows error "Cannot delete PLAN.md - protected file"
- [ ] PLAN.md deletion exits with code 1
- [ ] Non-existent file shows "File not found: NONEXISTENT.md"
- [ ] Non-existent file exits with code 1

### 3.8 Command Aliases

```bash
# Test aliases
gsheet list --spreadsheet-id=$TEST_SPREADSHEET_ID
gsheet cat TEST_NOTE.md --spreadsheet-id=$TEST_SPREADSHEET_ID
gsheet rm TEST_NOTE.md --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] `list` works same as `ls`
- [ ] `cat` works same as `read`
- [ ] `rm` works same as `delete`

---

## Phase 4: Interactive Shell Tests

### 4.1 Shell Startup

```bash
gsheet shell --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] Shell starts with welcome message
- [ ] Prompt shows: `agentscape> `
- [ ] No errors during startup

### 4.2 Shell Commands

**In the shell, test each command:**

```
help
```
- [ ] Shows available commands
- [ ] Shows examples

```
ls
```
- [ ] Lists files in table format
- [ ] Matches output from CLI ls command

```
write SHELL_TEST.md --content "# Shell Test"
```
- [ ] Creates file successfully
- [ ] Shows confirmation message

```
read SHELL_TEST.md
```
- [ ] Shows file content
- [ ] Content is correct

```
read SHELL_TEST.md --metadata
```
- [ ] Shows metadata + content

```
delete SHELL_TEST.md
```
- [ ] Deletes file
- [ ] Shows confirmation

```
exit
```
- [ ] Shows "Goodbye!"
- [ ] Exits cleanly

### 4.3 Shell Features

**Test tab completion:**
1. Type `re` and press TAB
   - [ ] Completes to `read`

2. Type `read ` and press TAB
   - [ ] Shows available files

**Test command history:**
1. Run: `ls`
2. Run: `read TEST_NOTE.md`
3. Press UP arrow
   - [ ] Shows `read TEST_NOTE.md`
4. Press UP arrow again
   - [ ] Shows `ls`

**Test Ctrl+C:**
1. Press Ctrl+C
   - [ ] Shows message: "Use 'exit' or 'quit' to exit the shell"
   - [ ] Returns to prompt (doesn't exit)

### 4.4 Edit Command (Shell Only)

```bash
# In shell
edit TEST_NOTE.md
```

**Verify:**
- [ ] Opens file in $EDITOR (or nano if not set)
- [ ] Shows message: "Opening TEST_NOTE.md in <editor>..."
- [ ] After saving and closing editor, shows "✓ Saved TEST_NOTE.md"
- [ ] Changes are reflected in AGENTSCAPE

---

## Phase 5: PLAN.md Integration Tests

### 5.1 Create a Plan via Library

```bash
# Create test script
cat > /tmp/create-plan.ts << 'EOF'
import { SheetAgent } from './src/agent';

const agent = await SheetAgent.connect({
  spreadsheetId: process.env.TEST_SPREADSHEET_ID!,
});

await agent.createPlan('CLI Test Plan', 'Test PLAN.md integration', [
  { name: 'Phase 1', steps: ['Step 1.1', 'Step 1.2'] },
  { name: 'Phase 2', steps: ['Step 2.1'] },
]);

console.log('Plan created!');
EOF

bun /tmp/create-plan.ts
```

### 5.2 Read PLAN.md via CLI

```bash
gsheet read PLAN.md --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] Shows plan markdown
- [ ] Contains "# Plan: CLI Test Plan"
- [ ] Contains "Goal: Test PLAN.md integration"
- [ ] Contains "### Phase 1" and "### Phase 2"
- [ ] Contains task items (1.1, 1.2, 2.1)

### 5.3 List Files (Should Include PLAN.md)

```bash
gsheet ls --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] PLAN.md appears in list
- [ ] PLAN.md has desc "plan"

### 5.4 Attempt to Delete PLAN.md

```bash
gsheet delete PLAN.md --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] Shows error: "Cannot delete PLAN.md - protected file"
- [ ] Exit code is 1
- [ ] PLAN.md still exists (verify with ls)

### 5.5 Write to PLAN.md via CLI

```bash
gsheet write PLAN.md \
  --content "# Plan: Updated via CLI\n\nGoal: Test write delegation" \
  --spreadsheet-id=$TEST_SPREADSHEET_ID

gsheet read PLAN.md --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] Write succeeds
- [ ] Read shows updated content
- [ ] Content matches what was written

### 5.6 Verify via Library

```bash
cat > /tmp/verify-plan.ts << 'EOF'
import { SheetAgent } from './src/agent';

const agent = await SheetAgent.connect({
  spreadsheetId: process.env.TEST_SPREADSHEET_ID!,
});

const plan = await agent.getPlan();
console.log('Title:', plan?.title);
console.log('Goal:', plan?.goal);
EOF

bun /tmp/verify-plan.ts
```

**Verify:**
- [ ] Plan title is "Updated via CLI"
- [ ] Plan goal is "Test write delegation"
- [ ] Confirms CLI write properly updated AGENT_BASE!B2

---

## Phase 6: Authentication Tests

### 6.1 Environment Variable Auth (Default)

```bash
export CREDENTIALS_CONFIG=$(base64 -i /path/to/service-account.json)
gsheet ls --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] Authentication succeeds
- [ ] No errors

### 6.2 Credentials File Auth

```bash
unset CREDENTIALS_CONFIG
gsheet ls --spreadsheet-id=$TEST_SPREADSHEET_ID --credentials /path/to/service-account.json
```

**Verify:**
- [ ] Authentication succeeds
- [ ] Uses credentials from file

### 6.3 Missing Credentials

```bash
unset CREDENTIALS_CONFIG
gsheet ls --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] Shows AuthError
- [ ] Message mentions CREDENTIALS_CONFIG or --credentials flag
- [ ] Shows fix instructions
- [ ] Exit code is 1

### 6.4 Invalid Credentials

```bash
export CREDENTIALS_CONFIG="invalid-base64"
gsheet ls --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] Shows AuthError
- [ ] Message mentions parsing failure
- [ ] Exit code is 1

### 6.5 Invalid Spreadsheet ID

```bash
export CREDENTIALS_CONFIG=$(base64 -i /path/to/service-account.json)
gsheet ls --spreadsheet-id=INVALID_ID
```

**Verify:**
- [ ] Shows PermissionError or appropriate error
- [ ] Error message is helpful
- [ ] Exit code is 1

---

## Phase 7: Example Scripts Tests

### 7.1 Backup All Files

```bash
# Create test files first
gsheet write BACKUP_TEST1.md --content "# Test 1" --spreadsheet-id=$TEST_SPREADSHEET_ID
gsheet write BACKUP_TEST2.md --content "# Test 2" --spreadsheet-id=$TEST_SPREADSHEET_ID

# Run backup
bun examples/cli/backup-all-files.ts --spreadsheet-id=$TEST_SPREADSHEET_ID --output=/tmp/backup-test

# Verify
ls -la /tmp/backup-test/
```

**Verify:**
- [ ] Backup directory created
- [ ] All files backed up (BACKUP_TEST1.md, BACKUP_TEST2.md, etc.)
- [ ] Metadata files created (.meta.json)
- [ ] Content matches original files
- [ ] Shows "✅ Backup complete! X file(s) backed up"

### 7.2 Sync Folder

```bash
# Create test folder
mkdir -p /tmp/sync-test
echo "# Sync File 1" > /tmp/sync-test/SYNC1.md
echo "# Sync File 2" > /tmp/sync-test/SYNC2.md

# Create metadata
cat > /tmp/sync-test/SYNC1.md.meta.json << 'EOF'
{
  "desc": "synced",
  "tags": "test,sync",
  "dates": "2026-01-20"
}
EOF

# Run sync
bun examples/cli/sync-folder.ts --spreadsheet-id=$TEST_SPREADSHEET_ID --folder=/tmp/sync-test

# Verify
gsheet ls --spreadsheet-id=$TEST_SPREADSHEET_ID
gsheet read SYNC1.md --metadata --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] Shows "✅ Sync complete! X file(s) synced"
- [ ] Files appear in AGENTSCAPE
- [ ] SYNC1.md has metadata from .meta.json
- [ ] SYNC2.md has default metadata
- [ ] Content matches local files

### 7.3 Daily Journal

```bash
# Create journal entry
bun examples/cli/daily-journal.ts --spreadsheet-id=$TEST_SPREADSHEET_ID "First journal entry"

# Read journal
gsheet read JOURNAL-$(date +%Y-%m-%d).md --spreadsheet-id=$TEST_SPREADSHEET_ID

# Add another entry
bun examples/cli/daily-journal.ts --spreadsheet-id=$TEST_SPREADSHEET_ID "Second journal entry"

# Read updated journal
gsheet read JOURNAL-$(date +%Y-%m-%d).md --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] First entry creates new journal file
- [ ] Journal contains timestamp + entry
- [ ] Second entry appends to same file
- [ ] Both entries present with timestamps
- [ ] Shows "✅ Journal entry added!"

---

## Phase 8: Edge Cases & Error Scenarios

### 8.1 Large Content

```bash
# Generate large content (>100KB)
python3 -c "print('# Large File\n\n' + 'Lorem ipsum dolor sit amet. ' * 5000)" > /tmp/large.md

gsheet write LARGE.md --file /tmp/large.md --spreadsheet-id=$TEST_SPREADSHEET_ID
gsheet read LARGE.md --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] Large file writes successfully
- [ ] Large file reads successfully
- [ ] No truncation or data loss

### 8.2 Special Characters in Content

```bash
gsheet write SPECIAL.md \
  --content "# Special Chars\n\n\"Quotes\" 'Apostrophes' & < > \$ \n\n日本語 中文 العربية" \
  --spreadsheet-id=$TEST_SPREADSHEET_ID

gsheet read SPECIAL.md --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] Special characters preserved
- [ ] Unicode characters preserved
- [ ] No encoding issues

### 8.3 Empty Content

```bash
gsheet write EMPTY.md --content "" --spreadsheet-id=$TEST_SPREADSHEET_ID
gsheet read EMPTY.md --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] Empty file creates successfully
- [ ] Read returns empty content (not null)

### 8.4 Filename with Spaces

```bash
gsheet write "FILE WITH SPACES.md" --content "# Test" --spreadsheet-id=$TEST_SPREADSHEET_ID
gsheet read "FILE WITH SPACES.md" --spreadsheet-id=$TEST_SPREADSHEET_ID
gsheet delete "FILE WITH SPACES.md" --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] Write succeeds
- [ ] Read succeeds
- [ ] Delete succeeds
- [ ] No issues with spaces

### 8.5 Many Files (Performance)

```bash
# Create 50 files
for i in {1..50}; do
  gsheet write "TEST_$i.md" --content "# Test $i" --spreadsheet-id=$TEST_SPREADSHEET_ID
done

# List all
time gsheet ls --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] All 50 files created
- [ ] List command completes in reasonable time (<5s)
- [ ] All files displayed correctly

### 8.6 Concurrent Operations

```bash
# Write same file concurrently (test race conditions)
gsheet write CONCURRENT.md --content "Version 1" --spreadsheet-id=$TEST_SPREADSHEET_ID &
gsheet write CONCURRENT.md --content "Version 2" --spreadsheet-id=$TEST_SPREADSHEET_ID &
wait

gsheet read CONCURRENT.md --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] Both writes complete without errors
- [ ] File contains one of the versions (no corruption)
- [ ] No crashes or exceptions

---

## Phase 9: Cross-Platform Tests

### 9.1 Different Shells

Test in each shell:
- [ ] bash: `bash -c 'gsheet --help'`
- [ ] zsh: `zsh -c 'gsheet --help'`
- [ ] sh: `sh -c 'gsheet --help'`

### 9.2 Different Node/Bun Versions

```bash
# Test with different Bun versions (if applicable)
bun --version
gsheet --version
```

**Verify:**
- [ ] CLI works across Bun versions
- [ ] No version-specific issues

---

## Phase 10: Documentation Verification

### 10.1 README Accuracy

Read through README.md CLI section and verify:
- [ ] All commands documented match implementation
- [ ] All flags documented match implementation
- [ ] Examples work as shown
- [ ] No missing features
- [ ] No outdated information

### 10.2 Help Text Accuracy

```bash
gsheet --help
```

Compare with README:
- [ ] Help text matches README
- [ ] All commands listed
- [ ] All options listed
- [ ] Examples are correct

### 10.3 Example Scripts Documentation

Read `examples/cli/README.md`:
- [ ] All examples tested above work as documented
- [ ] Prerequisites are accurate
- [ ] Use cases make sense
- [ ] Tips are helpful

---

## Phase 11: Integration with Library API

### 11.1 CLI + Library Interoperability

```bash
# Create file via CLI
gsheet write INTEROP.md --content "# Via CLI" --spreadsheet-id=$TEST_SPREADSHEET_ID

# Read via library
cat > /tmp/test-interop.ts << 'EOF'
import { SheetAgent } from './src/agent';
import { SheetClient } from './src/core/sheet-client';
import { PlanManager } from './src/managers/plan-manager';
import { AgentScapeManager } from './src/managers/agentscape-manager';

const spreadsheetId = process.env.TEST_SPREADSHEET_ID!;
const sheetClient = new SheetClient({ spreadsheetId });
const planManager = new PlanManager(sheetClient, spreadsheetId);
const agentscape = new AgentScapeManager(sheetClient, spreadsheetId, planManager);

const file = await agentscape.readFile('INTEROP.md');
console.log('Content:', file?.content);

// Write via library
await agentscape.writeFile({
  file: 'LIBRARY.md',
  desc: 'lib',
  tags: 'library',
  dates: '2026-01-20',
  content: '# Via Library',
});
console.log('Written LIBRARY.md');
EOF

bun /tmp/test-interop.ts

# Read via CLI
gsheet read LIBRARY.md --spreadsheet-id=$TEST_SPREADSHEET_ID
```

**Verify:**
- [ ] CLI-created file readable by library
- [ ] Library-created file readable by CLI
- [ ] Data format is compatible
- [ ] No data loss or corruption

---

## Phase 12: Cleanup & Final Verification

### 12.1 Clean Up Test Files

```bash
# List all files
gsheet ls --spreadsheet-id=$TEST_SPREADSHEET_ID --json > /tmp/files.json

# Delete all test files (except PLAN.md)
# Manual cleanup or script
```

### 12.2 Final Checks

```bash
# Run all tests one more time
bun test

# Verify no regressions
bun run typecheck

# Check bundle size
bun run size
```

**Verify:**
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Bundle size is reasonable

---

## Test Results Summary

### Overall Status
- [ ] All Phase 1 tests passed (Unit Tests)
- [ ] All Phase 2 tests passed (Build & Installation)
- [ ] All Phase 3 tests passed (CLI Commands)
- [ ] All Phase 4 tests passed (Interactive Shell)
- [ ] All Phase 5 tests passed (PLAN.md Integration)
- [ ] All Phase 6 tests passed (Authentication)
- [ ] All Phase 7 tests passed (Example Scripts)
- [ ] All Phase 8 tests passed (Edge Cases)
- [ ] All Phase 9 tests passed (Cross-Platform)
- [ ] All Phase 10 tests passed (Documentation)
- [ ] All Phase 11 tests passed (Library Integration)
- [ ] All Phase 12 tests passed (Cleanup)

### Issues Found

| Issue # | Phase | Description | Severity | Status |
|---------|-------|-------------|----------|--------|
| 1 | | | Critical/High/Medium/Low | Open/Fixed |
| 2 | | | | |

### Notes

_Add any additional observations, performance metrics, or recommendations here._

---

## Automated Test Script

**Comprehensive E2E test script available:** `scripts/test-cli-e2e.sh`

This script provides:
- ✅ 30+ automated test cases
- ✅ Colored output (pass/fail indicators)
- ✅ Detailed test summaries
- ✅ Coverage of all CLI commands
- ✅ Error handling validation
- ✅ Edge case testing

**Usage:**

```bash
# Set credentials
export CREDENTIALS_CONFIG=$(base64 -i /path/to/service-account.json)

# Run tests with a clean test spreadsheet
./scripts/test-cli-e2e.sh <spreadsheet-id>
```

**Example Output:**

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

**What the script tests:**
- Help & version commands (4 tests)
- Error handling (3 tests)
- List command (3 tests)
- Write command (3 tests)
- Read command (4 tests)
- Update operations (2 tests)
- Delete command (4 tests)
- Edge cases (7 tests)

**See also:** `TEST_RESULTS.md` for detailed test execution results.

---

## Sign-Off

**Tester:** ___________________________

**Date:** ___________________________

**Approved for Release:** [ ] Yes [ ] No

**Comments:**
