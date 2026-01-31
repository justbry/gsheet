# CLI Examples

These examples demonstrate how to use the `gsheet` CLI and AgentScapeManager programmatically.

## Prerequisites

1. **Set up credentials:**
   ```bash
   export CREDENTIALS_CONFIG=$(base64 -i service-account.json)
   ```

2. **Get your spreadsheet ID:**
   - Open your Google Sheet
   - Copy the ID from the URL: `https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit`

3. **Share the spreadsheet:**
   - Share with your service account email (Editor role)

## Examples

### 1. Backup All Files

Backup all files from AGENTSCAPE to a local directory.

```bash
bun examples/cli/backup-all-files.ts --spreadsheet-id=YOUR_ID --output=./backup
```

**What it does:**
- Lists all files in AGENTSCAPE
- Saves each file to `./backup/FILENAME.md`
- Saves metadata to `./backup/FILENAME.md.meta.json`

**Use cases:**
- Regular backups of your agent's files
- Exporting files for version control
- Creating local copies for offline editing

### 2. Sync Folder

Sync a local markdown folder to AGENTSCAPE sheet.

```bash
bun examples/cli/sync-folder.ts --spreadsheet-id=YOUR_ID --folder=./notes
```

**What it does:**
- Scans `./notes` for `.md` files
- Uploads each file to AGENTSCAPE
- Reads metadata from `.md.meta.json` sidecar files if they exist
- Skips `PLAN.md` (protected file)

**Use cases:**
- Uploading documentation to Google Sheets
- Syncing local notes to cloud storage
- Bulk uploading markdown content

**Metadata format** (optional `.md.meta.json` file):
```json
{
  "desc": "research",
  "tags": "important,draft",
  "dates": "2026-01-20"
}
```

### 3. Daily Journal

Create or append to a daily journal file.

```bash
bun examples/cli/daily-journal.ts --spreadsheet-id=YOUR_ID "Today I learned about Google Sheets API..."
```

**What it does:**
- Creates a journal file named `YYYY-MM-DD.md`
- Appends entries with timestamps
- Automatically creates new journal files each day

**Use cases:**
- Daily logging and note-taking
- Progress tracking
- Learning journal
- Work log

**Example journal file:**
```markdown
# Daily Journal - 2026-01-20

## 10:30:45 AM

Today I learned about Google Sheets API...

## 2:15:22 PM

Implemented the CLI tool successfully!
```

## Creating Custom Scripts

You can create your own automation scripts using the AgentScapeManager:

```typescript
#!/usr/bin/env bun

import { SheetClient } from 'gsheet/dist/core/sheet-client';
import { PlanManager } from 'gsheet/dist/managers/plan-manager';
import { AgentScapeManager } from 'gsheet/dist/managers/agentscape-manager';

async function main() {
  const spreadsheetId = 'YOUR_SPREADSHEET_ID';

  // Create managers
  const sheetClient = new SheetClient({ spreadsheetId });
  const planManager = new PlanManager(sheetClient, spreadsheetId);
  const agentscape = new AgentScapeManager(sheetClient, spreadsheetId, planManager);

  // Initialize sheet (idempotent)
  await agentscape.initAgentScape();

  // List files
  const files = await agentscape.listFiles();
  console.log(`Found ${files.length} files`);

  // Read a file
  const file = await agentscape.readFile('NOTES.md');
  if (file) {
    console.log(file.content);
  }

  // Write a file
  await agentscape.writeFile({
    file: 'NEW.md',
    desc: 'notes',
    tags: 'example',
    dates: new Date().toISOString().split('T')[0],
    content: '# New File\n\nContent here',
  });
}

main();
```

## Tips

1. **Use environment variables** for spreadsheet IDs:
   ```bash
   export SPREADSHEET_ID=YOUR_ID
   bun examples/cli/backup-all-files.ts --spreadsheet-id=$SPREADSHEET_ID
   ```

2. **Create shell aliases** for frequent commands:
   ```bash
   alias journal="bun examples/cli/daily-journal.ts --spreadsheet-id=$SPREADSHEET_ID"
   journal "My daily entry"
   ```

3. **Automate with cron** for scheduled backups:
   ```bash
   # Run daily backup at 11 PM
   0 23 * * * cd /path/to/project && bun examples/cli/backup-all-files.ts --spreadsheet-id=$SPREADSHEET_ID
   ```

4. **Combine with other tools**:
   ```bash
   # Backup and commit to git
   bun examples/cli/backup-all-files.ts --spreadsheet-id=$SPREADSHEET_ID --output=./backup
   cd backup && git add . && git commit -m "Daily backup $(date +%Y-%m-%d)"
   ```

## Troubleshooting

### Authentication errors
- Verify `CREDENTIALS_CONFIG` is set correctly
- Check that the spreadsheet is shared with your service account email

### Permission errors
- Ensure service account has Editor role on the spreadsheet
- Verify the spreadsheet ID is correct

### File not found errors
- Run `gsheet ls --spreadsheet-id=YOUR_ID` to list all files
- Check that AGENTSCAPE sheet exists (run `gsheet shell` and type `ls`)

## Learn More

- [CLI Documentation](../../README.md#cli-tool)
- [AgentScapeManager API](../../src/managers/agentscape-manager.ts)
- [Main README](../../README.md)
