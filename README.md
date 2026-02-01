# gsheet

A lightweight TypeScript library that turns Google Sheets into a powerful agent workspace. Read, write, search data and manage task plans—all backed by a human-readable spreadsheet.

[![npm version](https://badge.fury.io/js/gsheet.svg)](https://www.npmjs.com/package/gsheet)
[![CI](https://github.com/justbry/gsheet/actions/workflows/ci.yml/badge.svg)](https://github.com/justbry/gsheet/actions/workflows/ci.yml)

**6.6KB gzipped** | **132 tests passing** | **Full TypeScript support**

## Why Google Sheets?

- **Human-readable state** — Debug and monitor your agent by opening a spreadsheet
- **No database required** — Perfect for prototypes, MVPs, and serverless deployments
- **Built-in collaboration** — Multiple agents or humans can work on the same workspace
- **Free tier friendly** — Google Sheets API has generous quotas
- **Plan-based workflow** — Organize agent tasks with markdown-based plans

## Installation

```bash
# Using npm
npm install gsheet zod

# Using bun
bun add gsheet zod
```

## Quick Start

```typescript
import { SheetAgent } from 'gsheet';

// Connect to the agent (auto-initializes workspace)
const agent = await SheetAgent.connect({
  spreadsheetId: 'YOUR_SPREADSHEET_ID',
  credentials: {
    type: 'service_account',
    project_id: 'your-project',
    private_key: '-----BEGIN PRIVATE KEY-----\n...',
    client_email: 'agent@your-project.iam.gserviceaccount.com',
    // ... other service account fields
  },
});

// Read data
const users = await agent.read({ sheet: 'Users' });
console.log(users.rows); // [{ name: 'Alice', ... }, ...]

// Write data
await agent.write({
  sheet: 'Users',
  data: [{ name: 'Bob', email: 'bob@example.com' }]
});

// Create a plan for your agent
await agent.createPlan('Data Sync', 'Sync data from API to spreadsheet', [
  { name: 'Fetch', steps: ['Call API', 'Parse response'] },
  { name: 'Process', steps: ['Transform data', 'Validate records'] },
  { name: 'Save', steps: ['Write to sheet', 'Mark complete'] }
]);

// Execute tasks
const task = await agent.getNextTask();
if (task) {
  await agent.updateTask(task.step, { status: 'doing' });
  // ... do work ...
  await agent.updateTask(task.step, { status: 'done' });
}
```

## CLI Tool

The library includes a command-line interface (`gsheet`) for interacting with Google Sheets as a file system, storing markdown files in an AGENTSCAPE sheet.

> **NOTE: Why Start with the CLI?**
>
> When building agentic systems, starting with a CLI provides several advantages:
>
> - **Rapid Prototyping** — Test your agent's workspace structure without writing application code
> - **Hands-on Understanding** — Interact with the AGENTSCAPE sheet directly to understand how files are stored and retrieved
> - **Debugging Aid** — Manually inspect, read, and modify agent files during development
> - **Human-in-the-Loop** — Easily inject context, review agent outputs, or correct mistakes before automation
> - **Progressive Enhancement** — Start with manual CLI commands, then automate with scripts, finally integrate the library API
> - **Shared Mental Model** — The CLI commands (`read`, `write`, `ls`) map directly to the library's API methods
>
> The CLI is not just a convenience tool—it's a learning interface that helps you design better agentic workflows by making the agent's workspace tangible and inspectable.

### Installation

```bash
# Install globally
bun install -g gsheet

# Or use directly with bunx
bunx gsheet --help
```

### Quick Start

```bash
# Set your credentials (Base64-encoded service account JSON)
export CREDENTIALS_CONFIG="<base64-encoded-json>"

# List all files
gsheet ls --spreadsheet-id=YOUR_SPREADSHEET_ID

# Read a file
gsheet read PLAN.md --spreadsheet-id=YOUR_SPREADSHEET_ID

# Write a file
gsheet write NOTES.md --content "# My Notes" --spreadsheet-id=YOUR_SPREADSHEET_ID

# Write from a local file
gsheet write RESEARCH.md --file ./research.md --spreadsheet-id=YOUR_SPREADSHEET_ID

# Start interactive shell
gsheet shell --spreadsheet-id=YOUR_SPREADSHEET_ID
```

### AGENTSCAPE Sheet Format

The CLI stores files in an AGENTSCAPE sheet with the following structure:

| FILE          | DESC | TAGS | DATES | Content/MD |
|---------------|------|------|-------|------------|
| AGENT-PROFILE.md | md | profile | 2026-01-20 | # Agent... |
| RESEARCH.md      | md | research | 2026-01-20 | # Research |
| PLAN.md          | md | plan | 2026-01-20 | # Plan...  |

**Special Case:** `PLAN.md` is automatically delegated to the plan system (stored in AGENT_BASE!B2) for consistency with the library API.

### CLI Commands

#### List Files
```bash
gsheet ls --spreadsheet-id=ABC123
gsheet list --spreadsheet-id=ABC123 --json  # JSON output
```

#### Read Files
```bash
gsheet read PLAN.md --spreadsheet-id=ABC123
gsheet cat NOTES.md --spreadsheet-id=ABC123 --metadata  # Show metadata
```

#### Write Files
```bash
# From content flag
gsheet write NOTES.md --content "# Notes\n\nContent here" --spreadsheet-id=ABC123

# From local file
gsheet write RESEARCH.md --file ./local-file.md --spreadsheet-id=ABC123

# With metadata
gsheet write NOTES.md \
  --content "# Notes" \
  --desc "notes" \
  --tags "important,draft" \
  --dates "2026-01-20" \
  --spreadsheet-id=ABC123
```

#### Delete Files
```bash
gsheet delete NOTES.md --spreadsheet-id=ABC123
gsheet rm OLD_FILE.md --spreadsheet-id=ABC123
```

**Note:** `PLAN.md` is protected and cannot be deleted.

#### Interactive Shell
```bash
gsheet shell --spreadsheet-id=ABC123
```

In the shell, you can use:
- `ls` - List all files
- `read <file>` or `cat <file>` - Read a file
- `write <file> --content "..."` - Write a file
- `edit <file>` - Open file in `$EDITOR`
- `delete <file>` or `rm <file>` - Delete a file
- `help` - Show available commands
- `exit` or `quit` - Exit the shell

**Features:**
- Command history (up/down arrows)
- Tab completion for commands and filenames
- Edit files directly in your preferred editor

### CLI Authentication

The CLI uses the same authentication methods as the library:

1. **Environment variable (default):**
   ```bash
   export CREDENTIALS_CONFIG=$(base64 -i service-account.json)
   gsheet ls --spreadsheet-id=ABC123
   ```

2. **Credentials file:**
   ```bash
   gsheet ls --spreadsheet-id=ABC123 --credentials ./service-account.json
   ```

### CLI Options

| Option | Description |
|--------|-------------|
| `--spreadsheet-id <id>` | Google Sheets spreadsheet ID (required) |
| `--credentials <path>` | Path to service account credentials JSON |
| `--env` | Use CREDENTIALS_CONFIG environment variable (default) |
| `--content <text>` | File content (for write command) |
| `--file <path>` | Path to local file (for write command) |
| `--desc <text>` | File description |
| `--tags <text>` | Comma-separated tags |
| `--dates <text>` | Date information |
| `--json` | Output as JSON (for list command) |
| `--metadata` | Show metadata (for read command) |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

## Authentication

Three methods (checked in order):

### 1. Direct Credentials (Recommended for production)

```typescript
const agent = new SheetAgent({
  spreadsheetId: 'YOUR_SPREADSHEET_ID',
  credentials: {
    type: 'service_account',
    project_id: 'your-project',
    private_key: process.env.GOOGLE_PRIVATE_KEY!,
    client_email: process.env.GOOGLE_CLIENT_EMAIL!,
    private_key_id: 'key-id',
    client_id: 'client-id',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
  },
});
```

### 2. Base64 Environment Variable (Serverless)

```bash
# Encode your service account JSON
export CREDENTIALS_CONFIG=$(base64 -i service-account.json)
```

```typescript
// No credentials needed—reads from CREDENTIALS_CONFIG
const agent = new SheetAgent({
  spreadsheetId: 'YOUR_SPREADSHEET_ID',
});
```

### 3. Key File (Development only)

```typescript
const agent = new SheetAgent({
  spreadsheetId: 'YOUR_SPREADSHEET_ID',
  keyFile: './service-account.json',
});
```

## Core API

### Data Operations

```typescript
// Read data from a sheet (auto-detects headers)
const data = await agent.read({
  sheet: 'Users',
  format: 'object' // Returns array of objects
});
console.log(data.rows); // [{ name: 'Alice', email: '...' }, ...]

// Write data to a sheet
await agent.write({
  sheet: 'Users',
  data: [
    { name: 'Alice', email: 'alice@example.com' },
    { name: 'Bob', email: 'bob@example.com' }
  ]
});

// Search for rows
const results = await agent.search({
  sheet: 'Users',
  query: { role: 'admin' },
  operator: 'and',
  matching: 'strict'
});

// Batch read multiple ranges efficiently
const [users, products] = await agent.batchRead([
  { sheet: 'Users', range: 'A1:C100' },
  { sheet: 'Products', range: 'A1:E50' }
]);
```

### Sheet Management

```typescript
// List all sheets in the spreadsheet
const sheets = await agent.listSheets();
console.log(sheets); // ['Sheet1', 'Users', 'Products']

// Create a new sheet
const newSheet = await agent.createSheet('Reports');
console.log(newSheet); // { sheetId: 123456, title: 'Reports' }
```

### Agent Properties

```typescript
// Access the agent context (read-only)
console.log(agent.system); // AGENT.md content from AGENT_BASE!A2

// Get the spreadsheet ID (useful for logging)
console.log(agent.spreadsheetId); // '1abc...'
```

### Dual Format Support

The `read()` method supports both object and array formats:

```typescript
// Object format (default) - auto-detects headers from first row
const data = await agent.read({
  sheet: 'Users',
  format: 'object'
});
console.log(data.rows[0]); // { name: 'Alice', email: 'alice@...' }

// Array format - returns raw 2D array
const rawData = await agent.read({
  sheet: 'Users',
  format: 'array'
});
console.log(rawData.rows[0]); // ['name', 'email']
console.log(rawData.rows[1]); // ['Alice', 'alice@...']

// Custom headers (skip first row)
const customData = await agent.read({
  sheet: 'Users',
  headers: ['name', 'email', 'role']
});

// Skip headers entirely (use numeric indices)
const noHeadersData = await agent.read({
  sheet: 'Users',
  headers: false
});
console.log(noHeadersData.rows[0]); // { col0: 'Alice', col1: 'alice@...' }
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `spreadsheetId` | string | Required | Google Sheets ID |
| `credentials` | object | — | Service account credentials |
| `keyFile` | string | — | Path to service account JSON |
| `defaultFormat` | `'object'` \| `'array'` | `'object'` | Default data format for reads |
| `retry.enabled` | boolean | `true` | Enable automatic retry on transient errors |
| `retry.maxAttempts` | number | `3` | Max retry attempts for failed requests |
| `retry.retryableErrors` | string[] | Network errors | Custom list of retryable error codes |

## Error Handling

All errors include an actionable `.fix` property:

```typescript
import {
  ValidationError,
  PermissionError,
  NetworkError,
  AuthError,
  PlanError
} from 'gsheet';

try {
  await agent.write({ sheet: 'Data', data: [...] });
} catch (error) {
  if (error instanceof PermissionError) {
    console.log(error.message); // "Cannot access sheet 'Data'"
    console.log(error.fix);     // "Share the spreadsheet with your service account email"
  }
  if (error instanceof NetworkError) {
    console.log(error.fix);     // "Check your network connection. The request will be retried automatically."
  }
  if (error instanceof PlanError) {
    console.log(error.fix);     // "Create a plan first using agent.createPlan()"
  }
}
```

## Plan System

The library includes a plan-based task management system stored in the AGENT_BASE sheet.

### Workspace Structure

When you connect to an agent with `SheetAgent.connect()`, the **AGENT_BASE** sheet is automatically created with:

| Cell | Purpose |
|------|---------|
| A1 | "AGENT.md Contents" marker |
| A2 | Agent context markdown (loaded into `agent.system` property) |
| B1 | "PLAN.md Contents" marker |
| B2 | Plan markdown with phases and tasks |

### Plan Format

Plans use a markdown-based format:

```markdown
# Plan: [title]

Goal: [goal description]

## Analysis
- Spreadsheet: [name]
- Key sheets: [list]
- Target ranges:
  - Read: [ranges]
  - Write: [ranges]
- Current state: [description]

## Questions for User
- [questions]

### Phase 1: [Phase Name]
- [ ] 1.1 Task title
- [x] 1.2 Completed task ✅ 2026-01-12
- [/] 1.3 Task in progress
- [>] 1.4 Blocked task — reason why
- [!] 1.5 Needs review — note

### Phase 2: [Phase Name]
- [ ] 2.1 Another task
- [ ] 2.2 Yet another task

## Notes
[key: value pairs for working memory]
```

### Plan Management

```typescript
// Create a plan
await agent.createPlan('Data Migration', 'Migrate legacy data to new format', [
  { name: 'Preparation', steps: ['Read source data', 'Validate formats'] },
  { name: 'Migration', steps: ['Transform data', 'Write to target'] },
  { name: 'Verification', steps: ['Run validation checks', 'Generate report'] }
]);

// Get current plan
const plan = await agent.getPlan();
console.log(plan.title);
console.log(plan.phases);

// Get next task to work on
const nextTask = await agent.getNextTask();
if (nextTask) {
  console.log(nextTask.step); // "1.1"
  console.log(nextTask.title); // "Read source data"

  // Mark task as in progress
  await agent.updateTask('1.1', { status: 'doing' });

  // Mark task as done
  await agent.updateTask('1.1', { status: 'done' });

  // Or mark as blocked
  await agent.updateTask('1.2', {
    status: 'blocked',
    reason: 'Waiting for API credentials'
  });
}

// Get tasks needing review
const reviewTasks = await agent.getReviewTasks();

// Add notes for working memory
await agent.appendNotes('source_row_count: 1523');
await agent.appendNotes('last_processed_id: abc-123');
```

### Task Status Types

- **`todo`** (`[ ]`) - Not started
- **`doing`** (`[/]`) - In progress
- **`done`** (`[x]`) - Completed (adds completion date)
- **`blocked`** (`[>]`) - Blocked (requires reason)
- **`review`** (`[!]`) - Needs review (requires note)

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Build
bun run build

# Check bundle size
bun run size
```

## License

MIT
