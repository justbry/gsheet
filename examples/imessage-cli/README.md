# iMessage CLI Example

Send iMessages from the command line using the gsheet CLI and macOS Messages.app.

## Overview

This example demonstrates how to:
1. Read teacher data from Google Sheets
2. Send iMessages using the CLI

## Prerequisites

- macOS with Messages.app
- iMessage account configured
- Service account credentials (for reading Google Sheets)

## Usage

### Read Teachers from Google Sheets

```bash
# Read Teachers sheet
./dist/cli/index.js sheet-read --sheet Teachers --spreadsheet-id YOUR_SPREADSHEET_ID

# Get JSON output
./dist/cli/index.js sheet-read --sheet Teachers --spreadsheet-id YOUR_SPREADSHEET_ID --json

# Get formatted objects
./dist/cli/index.js sheet-read --sheet Teachers --format objects --spreadsheet-id YOUR_SPREADSHEET_ID
```

### Send iMessages

```bash
# Preview message (without sending)
./dist/cli/index.js send-message --recipient "+15551234567" --message "Hello!"

# Send message (requires --confirm)
./dist/cli/index.js send-message --recipient "+15551234567" --message "Hello!" --confirm
```

## Example Workflow

```bash
# 1. Read teachers from spreadsheet
./dist/cli/index.js sheet-read --sheet Teachers --spreadsheet-id 1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8

# 2. Send invitation to a teacher
./dist/cli/index.js send-message \
  --recipient "+18016607519" \
  --message "Hi! Study session today at 12:30pm. Can you make it?" \
  --confirm
```

## Library Usage

You can also use the `iMessageManager` class programmatically:

```typescript
import { iMessageManager } from './imessage-manager';

const messenger = new iMessageManager();
await messenger.sendText('+15551234567', 'Hello!');
```

## Integration with Google Sheets

The CLI integrates with Google Sheets to manage teacher data:

**Teachers Sheet Columns:**
- Name
- Phone Number
- Languages
- Last Taught
- In Whatsapp Group
- Notes

## Files

- `send-message.ts` - Core iMessage sending tool (uses AppleScript)
- `imessage-manager.ts` - TypeScript class wrapper for sending iMessages
- `README.md` - This file

## Direct Usage

You can also use the `send-message.ts` tool directly:

```bash
# Send a message
bun examples/imessage-cli/send-message.ts --recipient "+15551234567" --message "Hello!"

# Show help
bun examples/imessage-cli/send-message.ts --help
```

## Notes

- Messages are sent via AppleScript to Messages.app
- The `--confirm` flag is required when using the CLI (safety feature)
- Recipients must have iMessage enabled
- All tools are self-contained in this repo (no external dependencies)
