# Google Sheets Agent Configuration Guide

## Configuration Overview

The g-sheet-agent-io library uses a **three-tier priority system** for configuration, with different configuration options for library usage vs. CLI usage.

---

## Library Configuration (`SheetAgent.connect()`)

### Main Options Interface

```typescript
interface SheetAgentOptions {
  spreadsheetId: string;          // REQUIRED: Google Sheets ID

  // Auth (pick one - see priority below)
  credentials?: ServiceAccountCredentials;
  keyFile?: string;                // Local dev only

  // Retry for transient errors
  retry?: RetryConfig;

  // Default format for read operations
  defaultFormat?: 'object' | 'array';
}
```

### Authentication Priority (Library)

The library checks credentials in this order:

1. **Direct credentials object** (`options.credentials`)
   - Pass the parsed service account JSON directly
   ```typescript
   const agent = await SheetAgent.connect({
     spreadsheetId: 'your-sheet-id',
     credentials: {
       type: 'service_account',
       project_id: 'your-project',
       private_key: '...',
       client_email: '...',
       // ... rest of service account JSON
     }
   });
   ```

2. **CREDENTIALS_CONFIG environment variable** (Base64-encoded)
   - Automatically checked if no direct credentials provided
   - The service account JSON should be Base64-encoded
   ```bash
   export CREDENTIALS_CONFIG=$(base64 -i /path/to/service-account.json)
   ```
   ```typescript
   const agent = await SheetAgent.connect({
     spreadsheetId: 'your-sheet-id'
     // Will automatically use CREDENTIALS_CONFIG env var
   });
   ```

3. **keyFile path** (`options.keyFile`)
   - Path to service account JSON file on disk
   - For local development only
   ```typescript
   const agent = await SheetAgent.connect({
     spreadsheetId: 'your-sheet-id',
     keyFile: './credentials/service-account.json'
   });
   ```

### Retry Configuration

```typescript
interface RetryConfig {
  enabled?: boolean;           // Default: true
  maxAttempts?: number;        // Default: 3
  retryableErrors?: string[];  // Default: network + 5xx errors
}
```

**Usage:**
```typescript
const agent = await SheetAgent.connect({
  spreadsheetId: 'your-sheet-id',
  retry: {
    enabled: true,
    maxAttempts: 5,
    retryableErrors: ['ECONNRESET', '503', '429']
  }
});
```

**Default retryable errors:**
- Network errors: `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`
- HTTP errors: `500`, `502`, `503`, `504`, `429`

---

## CLI Configuration (`gsheet` command)

### Command Structure

```bash
gsheet [COMMAND] [ARGS] [OPTIONS]
```

### Authentication Options (CLI)

The CLI uses a **two-tier priority system**:

1. **--credentials flag** (path to file)
   ```bash
   gsheet ls --spreadsheet-id ABC123 --credentials ./service-account.json
   ```

2. **CREDENTIALS_CONFIG environment variable** (Base64-encoded) - **DEFAULT**
   ```bash
   export CREDENTIALS_CONFIG=$(base64 -i /path/to/service-account.json)
   gsheet ls --spreadsheet-id ABC123
   ```

### CLI Flags

**Required:**
- `--spreadsheet-id <id>` - Google Sheets spreadsheet ID

**Authentication:**
- `--credentials <path>` - Path to service account credentials JSON
- `--env` - Explicitly use CREDENTIALS_CONFIG env var (default behavior)

**File Operations:**
- `--content <text>` - File content (for write command)
- `--file <path>` - Path to local file (for write command)
- `--desc <text>` - File description
- `--tags <text>` - Comma-separated tags
- `--dates <text>` - Date information

**Output:**
- `--json` - Output as JSON (for list command)
- `--metadata` - Show metadata (for read command)

**General:**
- `-h, --help` - Show help
- `-v, --version` - Show version

---

## Environment Variables

### CREDENTIALS_CONFIG (Primary)

Base64-encoded service account JSON. Used by both library and CLI.

**Setup:**
```bash
# Encode your service account JSON
export CREDENTIALS_CONFIG=$(base64 -i /path/to/service-account.json)

# Verify it's set
echo $CREDENTIALS_CONFIG | base64 -d | jq .
```

**Format after decoding:**
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

### SPREADSHEET_ID (Testing)

Optional environment variable for testing:
```bash
export SPREADSHEET_ID=your-test-spreadsheet-id
```

---

## .env File Support

Bun automatically loads `.env` files, so you can create a `.env` file in your project root:

```env
# .env file
SPREADSHEET_ID=1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8
CREDENTIALS_CONFIG=ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCi...
```

**Note:** Don't commit `.env` files with real credentials! Add to `.gitignore`.

---

## Configuration Examples

### Example 1: Library with Environment Variable

```typescript
// .env file:
// CREDENTIALS_CONFIG=<base64-encoded-json>

import { SheetAgent } from 'g-sheet-agent-io';

const agent = await SheetAgent.connect({
  spreadsheetId: 'your-sheet-id'
  // Uses CREDENTIALS_CONFIG automatically
});
```

### Example 2: Library with Direct Credentials

```typescript
import { SheetAgent } from 'g-sheet-agent-io';
import credentials from './credentials/service-account.json';

const agent = await SheetAgent.connect({
  spreadsheetId: 'your-sheet-id',
  credentials: credentials
});
```

### Example 3: Library with Key File

```typescript
import { SheetAgent } from 'g-sheet-agent-io';

const agent = await SheetAgent.connect({
  spreadsheetId: 'your-sheet-id',
  keyFile: './credentials/service-account.json'
});
```

### Example 4: CLI with Environment Variable

```bash
export CREDENTIALS_CONFIG=$(base64 -i ./service-account.json)
gsheet ls --spreadsheet-id ABC123
```

### Example 5: CLI with Credentials File

```bash
gsheet ls --spreadsheet-id ABC123 --credentials ./service-account.json
```

### Example 6: Interactive Shell

```bash
export CREDENTIALS_CONFIG=$(base64 -i ./service-account.json)
gsheet shell --spreadsheet-id ABC123

# Now in shell:
agentscape> ls
agentscape> read PLAN.md
agentscape> write NOTES.md --content "# My Notes"
```

---

## Service Account Setup

### 1. Create Service Account (Google Cloud Console)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Navigate to **IAM & Admin > Service Accounts**
4. Click **Create Service Account**
5. Download the JSON key file

### 2. Share Spreadsheet with Service Account

1. Open your Google Sheet
2. Click **Share**
3. Add the service account email (from JSON: `client_email`)
4. Give **Editor** permissions

### 3. Enable Google Sheets API

1. Go to **APIs & Services > Library**
2. Search for "Google Sheets API"
3. Click **Enable**

---

## Configuration Best Practices

### For Production

✅ **DO:**
- Use `CREDENTIALS_CONFIG` environment variable (Base64-encoded)
- Store credentials in secure secret management (AWS Secrets Manager, etc.)
- Use different service accounts for dev/staging/prod
- Rotate service account keys regularly

❌ **DON'T:**
- Commit service account JSON files to git
- Hardcode credentials in source code
- Share service accounts across environments
- Use `keyFile` in production (local dev only)

### For Development

✅ **DO:**
- Use `.env` file with `CREDENTIALS_CONFIG` (add to `.gitignore`)
- Use `keyFile` for quick local testing
- Keep test spreadsheets separate from production

### For Testing

✅ **DO:**
- Create dedicated test spreadsheets
- Use separate service account for tests
- Set `INTEGRATION_TEST_SHEET_ID` env var for integration tests

---

## Troubleshooting

### "No credentials found"
- Check `CREDENTIALS_CONFIG` is set: `echo $CREDENTIALS_CONFIG`
- Verify it's valid Base64: `echo $CREDENTIALS_CONFIG | base64 -d`
- Try using `--credentials` flag instead

### "Failed to parse CREDENTIALS_CONFIG"
- Ensure JSON is valid: `echo $CREDENTIALS_CONFIG | base64 -d | jq .`
- Re-encode the file: `export CREDENTIALS_CONFIG=$(base64 -i file.json)`

### "Permission denied" or "403 Forbidden"
- Check spreadsheet is shared with service account email
- Verify Google Sheets API is enabled
- Ensure service account has Editor permissions

### "Invalid spreadsheet ID"
- Copy ID from spreadsheet URL: `docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit`
- Ensure no extra spaces or characters

---

## Summary

**Configuration Priority:**

**Library:**
1. `options.credentials` (direct object)
2. `CREDENTIALS_CONFIG` env var (Base64)
3. `options.keyFile` (file path)

**CLI:**
1. `--credentials <file>` flag
2. `CREDENTIALS_CONFIG` env var (Base64)

**Recommended Setup:**
```bash
# 1. Set credentials
export CREDENTIALS_CONFIG=$(base64 -i ./service-account.json)

# 2. Set spreadsheet ID (optional, for convenience)
export SPREADSHEET_ID=your-spreadsheet-id

# 3. Use library
bun run your-script.ts

# 4. Or use CLI
gsheet ls --spreadsheet-id $SPREADSHEET_ID
```
