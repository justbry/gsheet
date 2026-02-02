# Grant Obsidian Access to imsg Message History

## Obsidian Location

**Path:** `/Applications/Obsidian.app`

## Steps to Grant Full Disk Access

### 1. Open System Settings
- Click Apple menu (  ) → System Settings
- Or press: Cmd+Space, type "System Settings"

### 2. Navigate to Full Disk Access
1. In the sidebar, scroll to **Privacy & Security**
2. Click **Privacy & Security**
3. Scroll down in the right panel
4. Find and click **Full Disk Access**
5. Click the 🔒 lock icon (bottom left) and authenticate

### 3. Add Obsidian
1. Click the **[+]** button (bottom of the list)
2. Navigate to: `/Applications/`
3. Find and select **Obsidian.app**
4. Click **Open**

### 4. Enable Permission
- Find **Obsidian** in the Full Disk Access list
- Toggle the switch to **ON** (turns blue)
- **Important:** Quit and restart Obsidian for changes to take effect

## Verify It Works

### Test from Obsidian

Once Obsidian is restarted, you can use `imsg` from within Obsidian (via shell commands in plugins or templates):

```bash
# List recent chats
imsg chats --limit 10

# Read message history
imsg history --participants "+19715339292" --limit 10

# Watch for new messages
imsg watch
```

## Use Cases in Obsidian

### 1. Shell Commands Plugin

If you use the [Shell Commands](https://github.com/Taitava/obsidian-shellcommands) plugin:

**Add a command:**
- Command: `imsg chats --limit 20 --json`
- Output: To current note or new note
- Use for: Quick access to recent conversations

### 2. Templater Plugin

If you use [Templater](https://github.com/SilentVoid13/Templater):

```javascript
<%*
// Get recent messages from a contact
const phone = "+19715339292";
const result = await tp.system.command(
  `imsg history --participants "${phone}" --limit 10 --json`
);
tR += result;
%>
```

### 3. Dataview Plugin

If you use [Dataview](https://github.com/blacksmithgu/obsidian-dataview):

Create a note template that logs messages:

```bash
# Run from terminal to create note with message history
imsg history --participants "+19715339292" --limit 20 > ~/ObsidianVault/Messages/conversation-$(date +%Y%m%d).md
```

### 4. QuickAdd Plugin

If you use [QuickAdd](https://github.com/chhoumann/quickadd):

**Capture:** Create a macro that:
1. Prompts for phone number
2. Runs `imsg history --participants "$PHONE" --limit 10`
3. Inserts into current note

## Example: Message Journal Template

Create a template in Obsidian:

```markdown
---
date: {{date}}
contact: {{VALUE:contact}}
---

# Message History: {{VALUE:contact}}

\`\`\`bash
imsg history --participants "{{VALUE:contact}}" --limit 20
\`\`\`

## Notes

-

## Follow-up

- [ ]
```

Then use Templater or QuickAdd to execute the command and populate the template.

## Troubleshooting

### "permissionDenied" error in Obsidian

**Solution:**
1. Make sure Obsidian is in Full Disk Access list
2. Make sure it's toggled ON (blue)
3. **Quit Obsidian completely** (Cmd+Q)
4. Reopen Obsidian
5. Try again

### Obsidian not showing in Full Disk Access

**Solution:**
- Manually add it using [+] button
- Navigate to `/Applications/Obsidian.app`
- Don't select the binary inside - select the whole .app

### Commands work in Terminal but not Obsidian

**Solution:**
- Path issue - make sure command uses full path:
  ```bash
  /opt/homebrew/bin/imsg chats --limit 10
  ```
- Or ensure Obsidian has PATH configured in plugin settings

## Advanced: Create an Obsidian Plugin

You could create a custom Obsidian plugin that:

1. **Shows recent conversations** in sidebar
2. **Sends messages** directly from Obsidian
3. **Auto-logs** conversations to daily notes
4. **Searches** message history from command palette

Example plugin code:

```typescript
import { Plugin } from 'obsidian';
import { exec } from 'child_process';

export default class iMessagePlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'fetch-messages',
      name: 'Fetch Recent Messages',
      callback: () => {
        exec('/opt/homebrew/bin/imsg chats --limit 10 --json',
          (error, stdout, stderr) => {
            if (error) {
              console.error(error);
              return;
            }
            // Parse JSON and display in Obsidian
            const chats = JSON.parse(stdout);
            console.log(chats);
          }
        );
      }
    });
  }
}
```

## Security Note

**Full Disk Access is powerful** - it grants access to:
- All your messages (SMS, iMessage)
- Message database (chat.db)
- Attachments and media

Only grant to applications you trust. Obsidian is:
- ✅ Open-source
- ✅ Local-first (data stays on your machine)
- ✅ Privacy-focused

Review at: https://github.com/obsidianmd/obsidian-releases

## Summary

**To enable imsg in Obsidian:**
1. ✅ System Settings → Privacy & Security → Full Disk Access
2. ✅ Click [+] and add `/Applications/Obsidian.app`
3. ✅ Toggle ON
4. ✅ Quit and restart Obsidian
5. ✅ Test: Run imsg commands from Shell Commands or Templater

**What you can do:**
- 📱 Read message history in notes
- 💬 Log conversations automatically
- 🔍 Search messages from Obsidian
- 📝 Create message-based journal entries
- 🤖 Build custom workflows

**Resources:**
- imsg docs: https://github.com/steipete/imsg
- Our messaging system: `examples/imessage-cli/`
- Shell Commands plugin: https://github.com/Taitava/obsidian-shellcommands
