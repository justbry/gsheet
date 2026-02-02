#!/usr/bin/env bun

/**
 * Telnyx SMS Sender
 * Send SMS messages via Telnyx API from command line
 *
 * Usage:
 *   bun send-message.ts --recipient "+15551234567" --message "Hello, world!"
 *
 * Environment:
 *   TELNYX_API_KEY       - Your Telnyx API key
 *   TELNYX_PHONE_NUMBER  - Your Telnyx phone number
 */

import { TelnyxManager } from './telnyx-manager';

interface Args {
  recipient?: string;
  message?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--recipient' && argv[i + 1]) {
      args.recipient = argv[i + 1];
      i++;
    } else if (argv[i] === '--message' && argv[i + 1]) {
      args.message = argv[i + 1];
      i++;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.recipient) {
    console.error('❌ Error: --recipient flag is required');
    console.error('Usage: bun send-message.ts --recipient "+15551234567" --message "Hello!"');
    process.exit(1);
  }

  if (!args.message) {
    console.error('❌ Error: --message flag is required');
    console.error('Usage: bun send-message.ts --recipient "+15551234567" --message "Hello!"');
    process.exit(1);
  }

  try {
    const manager = new TelnyxManager();
    await manager.sendText(args.recipient, args.message);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
