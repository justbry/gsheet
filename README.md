# gsheet

A command-line tool for managing Google Sheets as an agent workspace. Store markdown files, manage task plans, and interact with spreadsheets—all from your terminal.

[![CI](https://github.com/justbry/gsheet/actions/workflows/ci.yml/badge.svg)](https://github.com/justbry/gsheet/actions/workflows/ci.yml)

**CLI-only tool** | **215 tests passing** | **Full TypeScript support**

## Why Google Sheets for Agents?

- **Human-readable state** — Debug and monitor your agent by opening a spreadsheet
- **No database required** — Perfect for prototypes, MVPs, and serverless deployments
- **Built-in collaboration** — Multiple agents or humans can work on the same workspace
- **Free tier friendly** — Google Sheets API has generous quotas
- **Plan-based workflow** — Organize agent tasks with markdown-based plans

## Installation

```bash
# Install globally with bun
bun install -g gsheet

# Or use directly with bunx
bunx gsheet --help

# Or compile to standalone binary
bun build --compile --minify ./src/cli.ts --outfile gsheet
```

## Quick Start

```bash
# Set your credentials (Base64-encoded service account JSON)
export CREDENTIALS_CONFIG=$(base64 -i service-account.json)

# Initialize AGENTSCAPE structure
gsheet init --spreadsheet-id YOUR_SPREADSHEET_ID

# List all files
gsheet ls --spreadsheet-id YOUR_SPREADSHEET_ID

# Read a file
gsheet read PLAN.md --spreadsheet-id YOUR_SPREADSHEET_ID

# Write a file
gsheet write NOTES.md --content "# My Notes" --spreadsheet-id YOUR_SPREADSHEET_ID

# Start interactive shell
gsheet shell --spreadsheet-id YOUR_SPREADSHEET_ID
```

## Features

### AGENTSCAPE File System

Store markdown files with metadata in a Google Sheet:

```bash
# Write a file with metadata
gsheet write RESEARCH.md \
  --file ./local-research.md \
  --desc "Research notes" \
  --tags "ai,research" \
  --status "active" \
  --spreadsheet-id YOUR_ID

# List all files with metadata
gsheet ls --spreadsheet-id YOUR_ID

# Output:
# FILE          | DESC            | STATUS  | TAGS         | CTX
# AGENTS.md     | Agent profile   | active  | system       | 1234
# PLAN.md       | Active plan     | active  | plan         | 567
# RESEARCH.md   | Research notes  | active  | ai,research  | 890
```

### Interactive Shell

```bash
gsheet shell --spreadsheet-id YOUR_ID

# In the shell:
agentscape> ls
agentscape> read PLAN.md
agentscape> write NOTES.md --content "# Notes"
agentscape> edit AGENTS.md  # Opens in $EDITOR
agentscape> help
agentscape> exit
```

**Shell Features:**
- Command history (up/down arrows)
- Tab completion for commands and filenames
- Edit files directly in your preferred editor
- Persistent session within the same spreadsheet

### Sheet Operations

Read and write to any sheet in the spreadsheet:

```bash
# Read a sheet
gsheet sheet-read --sheet Teachers --spreadsheet-id YOUR_ID

# Read as JSON objects
gsheet sheet-read --sheet Teachers --format objects --json --spreadsheet-id YOUR_ID

# Write to a sheet
gsheet sheet-write --sheet Schedule --range "F28" --data '[["Justin B"]]' --spreadsheet-id YOUR_ID

# Write multiple rows
gsheet sheet-write --sheet Schedule --range "F28:F31" \
  --data '[["A"],["B"],["C"],["D"]]' \
  --spreadsheet-id YOUR_ID
```

### Structure Validation

```bash
# Validate AGENTSCAPE structure
gsheet validate --spreadsheet-id YOUR_ID

# Initialize or fix structure
gsheet init --spreadsheet-id YOUR_ID

# Dry run (see what would change)
gsheet init --spreadsheet-id YOUR_ID --dry-run

# Force re-initialization
gsheet init --spreadsheet-id YOUR_ID --force
```

## Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize or fix AGENTSCAPE sheet structure |
| `ls`, `list` | List all files in AGENTSCAPE sheet |
| `read`, `cat <file>` | Read a file's content |
| `write <file>` | Write a file (requires `--content` or `--file`) |
| `delete`, `rm <file>` | Delete a file |
| `shell` | Start interactive REPL shell |
| `validate`, `check` | Validate AGENTSCAPE structure and format |
| `sheet-read` | Read any sheet (requires `--sheet` flag) |
| `sheet-write` | Write to any sheet (requires `--sheet`, `--range`, `--data`) |
| `help` | Show help message |
| `version` | Show version information |

## Options

### Global Options

| Option | Description |
|--------|-------------|
| `--spreadsheet-id <id\|url>` | Google Sheets spreadsheet ID or URL (required) |
| `--credentials <path>` | Path to service account credentials JSON |
| `--env` | Use CREDENTIALS_CONFIG environment variable (default) |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

### Command-Specific Options

| Option | Commands | Description |
|--------|----------|-------------|
| `--content <text>` | `write` | File content |
| `--file <path>` | `write` | Path to local file |
| `--desc <text>` | `write` | File description (max 50 words) |
| `--tags <text>` | `write` | Comma-separated tags |
| `--status <text>` | `write` | Lifecycle status: active, draft, archived |
| `--path <text>` | `write` | Virtual path (default: /opt/agentscape/{file}) |
| `--depends-on <text>` | `write` | Comma-separated file dependencies |
| `--max-ctx-len <number>` | `write` | Token budget cap for this file |
| `--json` | `ls`, `sheet-read` | Output as JSON |
| `--metadata` | `read` | Show file metadata |
| `--sheet <name>` | `sheet-read`, `sheet-write` | Sheet name |
| `--range <A1>` | `sheet-write` | Cell range in A1 notation |
| `--data <json>` | `sheet-write` | JSON 2D array of values |
| `--format <type>` | `sheet-read` | Output format: array, objects (default: array) |
| `--force` | `init` | Force re-initialization even if valid |
| `--dry-run` | `init` | Show what would be done without making changes |

## Authentication

### Method 1: Environment Variable (Recommended)

```bash
# Encode your service account JSON
export CREDENTIALS_CONFIG=$(base64 -i service-account.json)

# Use gsheet normally
gsheet ls --spreadsheet-id YOUR_ID
```

### Method 2: Credentials File

```bash
gsheet ls --spreadsheet-id YOUR_ID --credentials ./service-account.json
```

### Daily Spreadsheet ID Caching

On the first run each day, `--spreadsheet-id` is required. It's then cached in `.env.gsheet.YYYY-MM-DD`:

```bash
# First run today
gsheet ls --spreadsheet-id YOUR_ID

# Subsequent runs (same day)
gsheet ls
gsheet read PLAN.md
gsheet write NOTES.md --content "# Notes"
```

## AGENTSCAPE Sheet Structure

The AGENTSCAPE sheet stores files in a column-based format:

```
     A          B              C              D
1  FILE     AGENTS.md      PLAN.md        NOTES.md
2  DESC     Agent def      Active plan    My notes
3  TAGS     system         plan           draft
4  Path     /opt/agen...   /opt/agen...   /opt/agen...
5  CreatedTS 2026-01-15... 2026-01-15...  2026-02-09...
6  UpdatedTS 2026-02-01... 2026-02-08...  2026-02-09...
7  Status   active         active         draft
8  DependsOn               AGENTS.md
9  ContextLen =LEN(B12)    =LEN(C12)      =LEN(D12)
10 MaxCtxLen               5000
11 Hash     =SHA256(B12)   =SHA256(C12)   =SHA256(D12)
12 MDContent # Agent...    # Plan: ...    # Notes...
```

**Special Files:**
- `AGENTS.md` - Agent identity and system prompt
- `PLAN.md` - Task plan with markdown format (see Plan System below)
- Other `.md` files - Custom agent context and notes

## Plan System

`PLAN.md` uses a structured markdown format for task management:

```markdown
# Plan: [title]

Goal: [goal description]

## Analysis
- Spreadsheet: [name]
- Key sheets: [list]
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

## Notes
key: value pairs for working memory
```

### Task Status Markers

- `[ ]` - Todo (not started)
- `[/]` - Doing (in progress)
- `[x]` - Done (completed, adds date)
- `[>]` - Blocked (requires reason)
- `[!]` - Review (needs review, add note)

## Examples

### Backup All Files

```bash
#!/usr/bin/env bun
import { $ } from "bun";

const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID";
const BACKUP_DIR = "./agentscape-backup";

// Get list of files
const files = await $`gsheet ls --spreadsheet-id=${SPREADSHEET_ID} --json`.json();

// Create backup directory
await $`mkdir -p ${BACKUP_DIR}`;

// Download each file
for (const file of files) {
  const content = await $`gsheet read ${file.file} --spreadsheet-id=${SPREADSHEET_ID}`.text();
  await Bun.write(`${BACKUP_DIR}/${file.file}`, content);
  console.log(`Backed up: ${file.file}`);
}
```

### Daily Journal

```bash
#!/usr/bin/env bun
import { $ } from "bun";

const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID";
const date = new Date().toISOString().split('T')[0];
const filename = `${date}-journal.md`;

// Create journal entry
const content = `# Journal - ${date}

## Today's Goals
-

## Notes
-

## Reflections
-
`;

// Write to AGENTSCAPE
await $`gsheet write ${filename} --content=${content} --desc="Daily journal" --tags="journal" --spreadsheet-id=${SPREADSHEET_ID}`;

console.log(`Created: ${filename}`);
```

### Sync Local Folder

```bash
#!/usr/bin/env bun
import { $ } from "bun";
import { readdir } from "node:fs/promises";

const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID";
const LOCAL_DIR = "./docs";

// Get all .md files
const files = await readdir(LOCAL_DIR);
const mdFiles = files.filter(f => f.endsWith('.md'));

// Sync each file
for (const file of mdFiles) {
  await $`gsheet write ${file} --file=${LOCAL_DIR}/${file} --spreadsheet-id=${SPREADSHEET_ID}`;
  console.log(`Synced: ${file}`);
}
```

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Run unit tests only (exclude integration tests)
bun test --exclude tests/integration/*.test.ts

# Type check
bun run typecheck

# Build
bun run build

# Compile to standalone binary
bun build --compile --minify ./src/cli.ts --outfile gsheet

# Test compiled binary
./gsheet --version
./gsheet --help
```

## Project Structure

```
src/
├── cli.ts                    # Main CLI entry point
├── parser.ts                 # Argument parsing
├── repl.ts                   # REPL implementation
│
├── commands/                 # Individual command handlers
│   ├── list.ts
│   ├── read.ts
│   ├── write.ts
│   ├── delete.ts
│   ├── shell.ts
│   ├── sheet-read.ts
│   ├── sheet-write.ts
│   ├── init.ts
│   └── validate.ts
│
├── core/                     # Core implementation
│   ├── agent.ts             # SheetAgent class
│   ├── sheet-client.ts      # Google Sheets API client
│   ├── plan-manager.ts      # Plan/task management
│   └── agentscape-manager.ts # File system abstraction
│
├── types.ts                  # Type definitions
├── errors.ts                 # Error classes
└── schemas.ts                # Constants
```

## Error Handling

All errors include actionable `.fix` properties:

```typescript
// In your code using gsheet as a library
import { ValidationError, PermissionError, NetworkError } from 'gsheet';

try {
  // ... operations ...
} catch (error) {
  if (error instanceof PermissionError) {
    console.log(error.message); // "Cannot access spreadsheet"
    console.log(error.fix);     // "Share the spreadsheet with your service account email"
  }
}
```

From the CLI, errors are displayed with helpful messages:

```bash
$ gsheet ls --spreadsheet-id INVALID_ID
Permission Error: The service account does not have access to this spreadsheet.
Fix: Share the spreadsheet with the service account email (found in credentials JSON)
```

## Troubleshooting

### Missing Spreadsheet ID

```bash
Error: Missing --spreadsheet-id. Required on first run each day.
```

**Fix**: Provide `--spreadsheet-id` on your first command each day:
```bash
gsheet ls --spreadsheet-id YOUR_ID
```

### Permission Denied

```bash
Permission Error: The service account does not have access to this spreadsheet.
```

**Fix**: Share your spreadsheet with the service account email (found in your credentials JSON as `client_email`).

### Invalid Credentials

```bash
Authentication Error: Failed to parse CREDENTIALS_CONFIG
```

**Fix**: Re-encode your credentials:
```bash
export CREDENTIALS_CONFIG=$(base64 -i service-account.json)
```

### API Rate Limit

```bash
Error: Quota exceeded for quota metric 'Read requests'
```

**Fix**: Wait a minute. Google Sheets API has a limit of 60 requests per minute per user.

## License

MIT
