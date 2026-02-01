#!/usr/bin/env bun

/**
 * send-message.ts - Send iMessage via macOS Messages.app
 *
 * Usage:
 *   bun send-message.ts --recipient <phone|email> --message <text>
 *
 * Examples:
 *   bun send-message.ts --recipient "+15551234567" --message "Hello!"
 *   bun send-message.ts --recipient "john@example.com" --message "Meeting at 3pm"
 */

import { parseArgs } from "util";

/**
 * Send iMessage using AppleScript
 */
async function sendMessage(recipient: string, message: string): Promise<void> {
  // Escape double quotes and backslashes for AppleScript string literals
  const escapedMessage = message.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const escapedRecipient = recipient.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const script = `
tell application "Messages"
  set targetService to 1st service whose service type = iMessage
  set targetBuddy to buddy "${escapedRecipient}" of targetService
  send "${escapedMessage}" to targetBuddy
end tell
  `.trim();

  try {
    // Use Bun.spawn with proper argument handling
    const proc = Bun.spawn(["osascript", "-e", script], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(stderr);
    }
  } catch (error: any) {
    // Parse AppleScript errors for user-friendly messages
    const errorMsg = error.message || String(error);

    if (errorMsg.includes("Can't get buddy")) {
      throw new Error(
        `Recipient "${recipient}" not found in Messages.app.\n` +
        `Please send them a message manually first to add them to your contacts.`
      );
    }

    if (errorMsg.includes("Can't get service")) {
      throw new Error(
        `iMessage service not available. Please ensure:\n` +
        `  1. Messages.app is running\n` +
        `  2. You're signed in to iMessage\n` +
        `  3. iMessage is enabled in Settings`
      );
    }

    throw new Error(`Failed to send message: ${errorMsg}`);
  }
}

/**
 * Main CLI entry point
 */
async function main() {
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        recipient: { type: "string", short: "r" },
        message: { type: "string", short: "m" },
        help: { type: "boolean", short: "h" },
      },
    });

    if (values.help) {
      console.log(`
Usage: bun send-message.ts --recipient <phone|email> --message <text>

Options:
  -r, --recipient   Recipient phone number or email
  -m, --message     Message text to send
  -h, --help        Show this help message

Examples:
  bun send-message.ts -r "+15551234567" -m "Hello!"
  bun send-message.ts -r "john@example.com" -m "Meeting at 3pm"
      `.trim());
      process.exit(0);
    }

    if (!values.recipient || !values.message) {
      console.error("Error: Both --recipient and --message are required");
      console.error("Run with --help for usage information");
      process.exit(1);
    }

    console.log(`📱 Sending to ${values.recipient}...`);

    // Send message
    await sendMessage(values.recipient, values.message);

    console.log(`✅ Message sent successfully!`);

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Only run main if this is the entry point
if (import.meta.main) {
  main();
}

// Export for use as a module
export { sendMessage };
