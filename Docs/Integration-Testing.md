# Integration Tests

This directory contains integration tests that make real API calls to Google Sheets.

## Prerequisites

1. **Google Cloud Project** with the Google Sheets API enabled
2. **Service Account** with access to your test spreadsheet
3. **Test Spreadsheet** that the service account can read/write

## Setup

### 1. Create a Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable the Google Sheets API
4. Go to **IAM & Admin** > **Service Accounts**
5. Create a new service account
6. Download the JSON key file

### 2. Create a Test Spreadsheet

1. Create a new Google Sheets spreadsheet
2. Share it with your service account email (found in the JSON key)
3. Give the service account **Editor** access
4. Copy the spreadsheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit
   ```

### 3. Set Environment Variables

```bash
# The spreadsheet ID from step 2
export INTEGRATION_TEST_SHEET_ID="your-spreadsheet-id"

# Base64-encode your service account JSON key
export CREDENTIALS_CONFIG=$(base64 -i /path/to/service-account.json)
```

## Running Integration Tests

```bash
# Run integration tests only
bun run test:integration

# Run all tests (unit + integration)
bun run test && bun run test:integration
```

## Test Behavior

- **Without env vars**: Integration tests are skipped with a helpful message
- **With env vars**: Full integration test suite runs against real Google Sheets

## Test Coverage

The integration tests cover:

- `read()` - Reading data from sheets
- `write()` - Writing data to sheets
- `search()` - Searching data in sheets
- `rateLimitStatus()` - Rate limiting status
- `initAgentBase()` - Workspace initialization
- `validateWorkspace()` - Workspace validation
- `remember()`, `recall()`, `forget()` - Memory operations
- `scheduleTask()`, `fetchTask()`, `completeTask()` - Task queue
- `pause()`, `resume()`, `status()` - Agent lifecycle

## Notes

- Integration tests use far columns (like `Z1:AA2`) to avoid interfering with existing data
- Each test run creates a unique test key prefix to avoid collisions
- Tests are designed to clean up after themselves where possible
- Timeouts are set to 30 seconds to accommodate API latency
