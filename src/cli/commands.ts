/**
 * CLI Command Handlers
 * Implements each command (list, read, write, shell)
 */

import type { AgentFile } from '../types';
import type { AgentScapeManager } from '../managers/agentscape-manager';
import type { ParsedArgs } from './parser';
import { SheetAgent } from '../agent';
import { join } from 'path';

/**
 * List all files in AGENTSCAPE sheet
 * Supports --json flag for JSON output
 */
export async function cmdList(
  agentscape: AgentScapeManager,
  args: ParsedArgs
): Promise<void> {
  const files = await agentscape.listFiles();

  if (args.flags.json) {
    console.log(JSON.stringify(files, null, 2));
    return;
  }

  if (files.length === 0) {
    console.log('No files found in AGENTSCAPE');
    return;
  }

  // Calculate column widths
  const fileWidth = Math.max(10, ...files.map((f) => f.file.length));
  const descWidth = Math.max(10, ...files.map((f) => f.desc.length));
  const statusWidth = Math.max(8, ...files.map((f) => f.status.length));
  const tagsWidth = Math.max(8, ...files.map((f) => f.tags.length));
  const ctxWidth = Math.max(6, ...files.map((f) => f.contextLen.length));

  // Print header
  console.log(
    `${'FILE'.padEnd(fileWidth)} | ${'DESC'.padEnd(descWidth)} | ${'STATUS'.padEnd(statusWidth)} | ${'TAGS'.padEnd(tagsWidth)} | ${'CTX'.padEnd(ctxWidth)}`
  );
  console.log('-'.repeat(fileWidth + descWidth + statusWidth + tagsWidth + ctxWidth + 16));

  // Print rows
  for (const file of files) {
    console.log(
      `${file.file.padEnd(fileWidth)} | ${file.desc.padEnd(descWidth)} | ${file.status.padEnd(statusWidth)} | ${file.tags.padEnd(tagsWidth)} | ${file.contextLen.padEnd(ctxWidth)}`
    );
  }

  console.log(`\nTotal: ${files.length} file(s)`);
}

/**
 * Read a file's content
 * Supports --metadata flag to show file metadata
 */
export async function cmdRead(
  agentscape: AgentScapeManager,
  args: ParsedArgs
): Promise<void> {
  const filename = args.args[0];
  if (!filename) {
    throw new Error('Filename required for read command');
  }

  const file = await agentscape.readFile(filename);

  if (!file) {
    console.error(`File not found: ${filename}`);
    process.exit(1);
  }

  // Show metadata if requested
  if (args.flags.metadata) {
    console.log(`File: ${file.file}`);
    console.log(`Description: ${file.desc}`);
    console.log(`Tags: ${file.tags}`);
    console.log(`Path: ${file.path}`);
    console.log(`Created: ${file.createdTs}`);
    console.log(`Updated: ${file.updatedTs}`);
    console.log(`Status: ${file.status}`);
    console.log(`DependsOn: ${file.dependsOn || '(none)'}`);
    console.log(`ContextLen: ${file.contextLen}`);
    console.log(`MaxCtxLen: ${file.maxCtxLen || '(no limit)'}`);
    console.log(`Hash: ${file.hash}`);
    console.log(`\n${'='.repeat(60)}\n`);
  }

  // Output content
  console.log(file.content);
}

/**
 * Write a file to AGENTSCAPE
 * Requires --content or --file flag
 * Optional: --desc, --tags, --status, --path, --depends-on
 */
export async function cmdWrite(
  agentscape: AgentScapeManager,
  args: ParsedArgs
): Promise<void> {
  const filename = args.args[0];
  if (!filename) {
    throw new Error('Filename required for write command');
  }

  // Get content from --content or --file
  let content: string;
  if (typeof args.flags.content === 'string') {
    content = args.flags.content;
  } else if (typeof args.flags.file === 'string') {
    const localFile = Bun.file(args.flags.file);
    content = await localFile.text();
  } else {
    throw new Error('Either --content or --file flag is required');
  }

  const now = new Date().toISOString();

  // Build file object
  const file: AgentFile = {
    file: filename,
    desc: typeof args.flags.desc === 'string' ? args.flags.desc : 'md',
    tags: typeof args.flags.tags === 'string' ? args.flags.tags : '',
    path: typeof args.flags.path === 'string' ? args.flags.path : `/opt/agentscape/${filename}`,
    createdTs: '',  // Will be auto-set or preserved by manager
    updatedTs: now,
    status: typeof args.flags.status === 'string' ? args.flags.status : 'active',
    dependsOn: typeof args.flags['depends-on'] === 'string' ? args.flags['depends-on'] : '',
    contextLen: '',  // Computed by formula
    maxCtxLen: typeof args.flags['max-ctx-len'] === 'string' ? args.flags['max-ctx-len'] : '',
    hash: '',        // Computed by formula
    content,
  };

  // Write file
  await agentscape.writeFile(file);

  console.log(`Wrote ${filename} (${content.length} bytes)`);
}

/**
 * Delete a file from AGENTSCAPE
 */
export async function cmdDelete(
  agentscape: AgentScapeManager,
  args: ParsedArgs
): Promise<void> {
  const filename = args.args[0];
  if (!filename) {
    throw new Error('Filename required for delete command');
  }

  const deleted = await agentscape.deleteFile(filename);

  if (deleted) {
    console.log(`Deleted ${filename}`);
  } else {
    console.error(`File not found: ${filename}`);
    process.exit(1);
  }
}

/**
 * Start interactive REPL shell
 * Delegates to repl.ts
 */
export async function cmdShell(
  agentscape: AgentScapeManager,
  args: ParsedArgs
): Promise<void> {
  const { startRepl } = await import('./repl');
  await startRepl(agentscape);
}

/**
 * Read data from any sheet in the spreadsheet
 * Requires --sheet flag
 * Supports --format flag (array or objects)
 */
export async function cmdSheetRead(
  spreadsheetId: string,
  args: ParsedArgs
): Promise<void> {
  const sheetName = args.flags.sheet;
  if (typeof sheetName !== 'string') {
    throw new Error('--sheet flag is required for sheet-read command');
  }

  const format = args.flags.format === 'objects' ? 'objects' : 'array';

  // Create a SheetAgent to read the sheet
  const agent = await SheetAgent.connect({ spreadsheetId });
  const result = await agent.read({ sheet: sheetName, format });

  if (args.flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Format output based on format type
  if (format === 'objects') {
    const data = result.rows as Array<Record<string, unknown>>;

    if (data.length === 0) {
      console.log(`No data found in sheet: ${sheetName}`);
      return;
    }

    // Pretty print objects
    for (let i = 0; i < data.length; i++) {
      const obj = data[i];
      console.log(`\n--- Row ${i + 1} ---`);
      for (const [key, value] of Object.entries(obj)) {
        console.log(`${key}: ${value}`);
      }
    }
    console.log(`\nTotal: ${data.length} row(s)`);
  } else {
    // Array format - print as table
    const rows = result.rows as unknown[][];

    if (rows.length === 0) {
      console.log(`No data found in sheet: ${sheetName}`);
      return;
    }

    // Print each row
    for (const row of rows) {
      console.log(row.map(cell => String(cell ?? '')).join(' | '));
    }

    console.log(`\nTotal: ${rows.length} row(s)`);
  }
}

/**
 * Send iMessage using macOS Messages.app
 * Requires --recipient and --message flags
 * Requires --confirm flag for safety
 */
export async function cmdSendMessage(
  args: ParsedArgs
): Promise<void> {
  const recipient = args.flags.recipient;
  const message = args.flags.message;

  if (typeof recipient !== 'string') {
    throw new Error('--recipient flag is required');
  }

  if (typeof message !== 'string') {
    throw new Error('--message flag is required');
  }

  if (!args.flags.confirm) {
    console.log('⚠️  Preview mode (use --confirm to send):\n');
    console.log(`To: ${recipient}`);
    console.log(`Message:\n${message}`);
    return;
  }

  // Path to local send-message.ts tool (relative to project root)
  const sendMessagePath = join(
    process.cwd(),
    'examples/imessage-cli/send-message.ts'
  );

  console.log(`📱 Sending to ${recipient}...`);

  // Call SendMessage.ts with proper argument escaping
  const proc = Bun.spawn(['bun', sendMessagePath, '--recipient', recipient, '--message', message], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to send message: ${stderr}`);
  }

  console.log('✅ Message sent successfully!');
}
