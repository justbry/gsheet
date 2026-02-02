# Setting Up imsg Permissions - Handoff Guide

## Current Status

✅ **imsg is installed** (`brew install steipete/tap/imsg`)
✅ **Messages can be sent** (tested successfully - 5 messages sent to +19715339292)
❌ **Cannot read message history** - needs Full Disk Access permission

## What's Needed

To read message history with `imsg`, the terminal needs **Full Disk Access** to read the Messages database at:
```
~/Library/Messages/chat.db
```

## Step-by-Step Setup

### 1. Grant Full Disk Access

1. **Open System Settings**
   - Click Apple menu → System Settings
   - Or use Spotlight: Cmd+Space, type "System Settings"

2. **Navigate to Privacy & Security**
   - In the sidebar, scroll down to "Privacy & Security"
   - Click on it

3. **Open Full Disk Access**
   - Scroll down in the right panel
   - Find and click "Full Disk Access"
   - You may need to click the lock icon and authenticate

4. **Add Your Terminal**
   - Click the [+] button at the bottom
   - Navigate to your terminal application:
     - **Terminal.app**: `/Applications/Utilities/Terminal.app`
     - **iTerm2**: `/Applications/iTerm.app`
     - **Other**: Find your terminal in Applications
   - Select it and click "Open"

5. **Enable the Permission**
   - Find your terminal in the list
   - Toggle the switch to **ON** (it should turn blue)
   - **IMPORTANT**: Restart your terminal for the change to take effect

### 2. Grant Automation Permission (if not already done)

1. **Open System Settings → Privacy & Security → Automation**

2. **Find your terminal app** in the list

3. **Enable Messages.app** under your terminal
   - There should be a checkbox for "Messages"
   - Make sure it's checked

### 3. Restart Terminal

**Critical step!** Close and reopen your terminal app for permissions to take effect.

## Verification

After restarting your terminal, test that it works:

```bash
# Test reading chats (should work now)
imsg chats --limit 5

# Test reading message history
imsg history --participants "+19715339292" --limit 10

# If successful, you'll see your recent messages!
```

## What You Can Do After Setup

Once Full Disk Access is granted:

### Read Recent Chats
```bash
imsg chats --limit 20
```

### Read Message History
```bash
# By participant phone number
imsg history --participants "+19715339292" --limit 10

# By chat ID (get ID from 'imsg chats')
imsg history --chat-id 123 --limit 20

# With JSON output
imsg history --participants "+19715339292" --json
```

### Watch for New Messages
```bash
# Stream incoming messages in real-time
imsg watch
```

### Send Messages (already working!)
```bash
# Direct imsg
imsg send --to "+19715339292" --text "Hello!"

# Via our CLI
./dist/cli/index.js send-message \
  --recipient "+19715339292" \
  --message "Hello!" \
  --confirm

# Programmatic
bun examples/messaging-examples/multi-provider-demo.ts "+19715339292" "Hello!"
```

## Troubleshooting

### "permissionDenied(path: .../chat.db, underlying: authorization denied)"

**Solution:** Full Disk Access not granted yet
- Follow steps above
- Make sure you **restarted your terminal**

### Terminal not showing in Full Disk Access list

**Solution:** Manually add it
- Click the [+] button
- Navigate to `/Applications/Utilities/Terminal.app` (or your terminal)
- Add it manually

### Permission granted but still getting errors

**Solution:** Terminal wasn't restarted
- Completely quit your terminal app (Cmd+Q)
- Reopen it
- Try again

## Current Test Results

Messages sent successfully to **+19715339292**:
1. ✅ "Test message from your new multi-provider messaging system! 🎉"
2. ✅ "Second test - this one sent via the CLI wrapper! ✅"
3. ✅ "Third test - auto-detected provider! 🚀"
4. ✅ "Fourth test - via the factory pattern! 🎯"
5. ✅ "Another test message - confirming the system works! 📨"

All sent via `imsg` CLI through our multi-provider messaging system.

## Next Steps After Permissions Setup

Once Full Disk Access is working, you can:

1. **Verify message delivery:**
   ```bash
   imsg history --participants "+19715339292" --limit 10
   ```

2. **Test receiving messages:**
   - Send a message to yourself from your phone
   - Watch it appear: `imsg watch`

3. **Build more features:**
   - Auto-reply to messages
   - Log conversations
   - Integrate with other tools
   - Build chatbots

## Technical Details

**Why Full Disk Access is needed:**
- `imsg` reads the SQLite database at `~/Library/Messages/chat.db`
- macOS protects this database (contains private message data)
- Full Disk Access grants permission to read it

**What imsg can do without Full Disk Access:**
- ✅ Send messages (uses AppleScript to Messages.app)
- ❌ Read message history (needs database access)
- ❌ Watch for new messages (needs database access)
- ❌ List chats (needs database access)

**Security Note:**
Full Disk Access is a powerful permission. Only grant it to applications you trust. `imsg` is open-source and can be reviewed at: https://github.com/steipete/imsg

## Files in This Project

- `examples/imessage-cli/send-message.ts` - CLI tool using imsg
- `examples/imessage-cli/imessage-manager.ts` - TypeScript wrapper
- `src/messaging/factory.ts` - Multi-provider factory
- `examples/telnyx-cli/` - Telnyx SMS alternative (for cloud/serverless)

## Contact

If you need help after setup:
- Check `Docs/IMSG_MIGRATION.md` for migration guide
- Check `Docs/specs/IMSG_COMPARISON.md` for comparison
- See imsg docs: https://github.com/steipete/imsg
