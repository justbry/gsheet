# Migration to imsg CLI

## What Changed

We've refactored the iMessage implementation to use the **imsg CLI** instead of our custom AppleScript wrapper.

## Why This Change?

| Feature | Old (AppleScript) | New (imsg CLI) |
|---------|-------------------|----------------|
| **Reliability** | Basic | ✅ Production-tested |
| **Error handling** | Limited | ✅ Robust |
| **Send messages** | ✅ Yes | ✅ Yes |
| **Receive messages** | ❌ No | ✅ Yes (future feature) |
| **JSON output** | ❌ No | ✅ Yes |
| **Maintenance** | Custom code | ✅ Active 2026 updates |
| **Phone normalization** | Manual | ✅ Automatic E.164 |
| **Attachments** | ❌ No | ✅ Yes |

## Before You Start

### 1. Install imsg

```bash
brew install steipete/tap/imsg
```

### 2. Grant Permissions

**Full Disk Access:**
1. Open System Settings
2. Privacy & Security → Full Disk Access
3. Add your terminal app (Terminal, iTerm2, etc.)
4. Toggle it on

**Automation:**
1. Open System Settings
2. Privacy & Security → Automation
3. Find your terminal app
4. Enable: Messages.app

### 3. Verify Installation

```bash
# Check imsg is installed
imsg --version

# Test sending a message to yourself
imsg send --buddy "+15551234567" --text "Test message"
```

## Usage

### CLI (No Changes!)

The CLI interface remains the same:

```bash
# Auto-detect provider (will use imsg on macOS if installed)
./dist/cli/index.js send-message \
  --recipient "+15551234567" \
  --message "Hello!" \
  --confirm

# Force iMessage provider (uses imsg under the hood)
./dist/cli/index.js send-message \
  --recipient "+15551234567" \
  --message "Hello!" \
  --provider imessage \
  --confirm
```

### Programmatic (No Changes!)

The API remains the same:

```typescript
import { iMessageManager } from './examples/imessage-cli/imessage-manager';

const manager = new iMessageManager();
await manager.sendText('+15551234567', 'Hello!');
```

### Factory (No Changes!)

```typescript
import { getMessagingProvider } from './src/messaging/factory';

// Auto-detect (will check for imsg installation)
const messenger = await getMessagingProvider('auto');
await messenger.sendText('+15551234567', 'Hello!');
```

## Auto-Detection Logic

The factory now checks for `imsg` installation:

```typescript
if (provider === 'auto') {
  // 1. Check for Telnyx config (highest priority)
  if (process.env.TELNYX_API_KEY) {
    return 'telnyx';
  }
  // 2. Check for macOS with imsg installed
  else if (process.platform === 'darwin' && await checkImsgInstalled()) {
    return 'imessage'; // Uses imsg CLI
  }
  // 3. Default to Telnyx
  else {
    return 'telnyx';
  }
}
```

## What If imsg Isn't Installed?

If you try to use iMessage without imsg installed, you'll get a clear error:

```
❌ Error: imsg CLI not found. Install it via: brew install steipete/tap/imsg
```

**Solutions:**
1. Install imsg: `brew install steipete/tap/imsg`
2. Use Telnyx instead: `--provider telnyx`
3. Set auto-detection to prefer Telnyx: `export TELNYX_API_KEY=...`

## Troubleshooting

### "imsg: command not found"

**Solution:** Install imsg
```bash
brew install steipete/tap/imsg
```

### Permission Errors

**Solution:** Grant required permissions
1. System Settings → Privacy & Security → Full Disk Access → Add Terminal
2. System Settings → Privacy & Security → Automation → Terminal → Messages

### "Messages.app is not signed in"

**Solution:** Open Messages.app and sign in with your Apple ID

### "Buddy not found"

**Solution:** The recipient needs to be in your Messages.app contacts. Send them a message manually first, or use their exact contact info.

## Benefits of imsg

### 1. Better Error Messages

**Old (AppleScript):**
```
Error: Can't get buddy "..."
```

**New (imsg):**
```
Error: Recipient not found in Messages.app.
Please send them a message manually first to add them to your contacts.
```

### 2. More Reliable

- imsg handles edge cases we haven't considered
- Production-tested by thousands of users
- Active maintenance and bug fixes

### 3. Future Features

With imsg, we can later add:
- **Receive messages** - Watch for incoming messages
- **Message history** - Query past conversations
- **Attachments** - Send images, files, etc.
- **Reactions** - Add reactions to messages
- **Group chats** - Better group message handling

### 4. JSON Output

imsg supports JSON output for programmatic parsing:

```bash
imsg chats --json
imsg messages --buddy "+15551234567" --json
```

We can leverage this in future versions for richer integrations.

## Migration Checklist

- [x] Refactor `send-message.ts` to use imsg CLI
- [x] Update `iMessageManager` to call imsg
- [x] Add installation check
- [x] Update factory auto-detection
- [x] Update documentation
- [x] Build succeeds
- [ ] **Install imsg on your system**
- [ ] **Grant required permissions**
- [ ] **Test sending a message**

## Testing

After installing imsg, test the integration:

```bash
# Test direct imsg CLI
imsg send --buddy "+15551234567" --text "Test 1"

# Test via our CLI
./dist/cli/index.js send-message \
  --recipient "+15551234567" \
  --message "Test 2" \
  --provider imessage \
  --confirm

# Test via TypeScript
bun examples/messaging-examples/multi-provider-demo.ts "+15551234567" "Test 3"
```

## Summary

**What changed:**
- iMessage now uses `imsg` CLI instead of AppleScript
- Requires Homebrew installation
- Better reliability and error handling

**What stayed the same:**
- CLI interface (no breaking changes)
- Programmatic API (no breaking changes)
- Factory auto-detection (enhanced, not broken)

**What you need to do:**
1. Install imsg: `brew install steipete/tap/imsg`
2. Grant permissions
3. Continue using as before

## Resources

- [imsg GitHub](https://github.com/steipete/imsg)
- [imsg.dev](https://www.imsg.dev/)
- [Homebrew](https://brew.sh/)
