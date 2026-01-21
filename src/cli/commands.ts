/**
 * CLI Command Handlers
 * Implements each command (list, read, write, shell)
 */

import type { AgentFile } from '../types';
import type { AgentScapeManager } from '../managers/agentscape-manager';
import type { ParsedArgs } from './parser';

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
    // JSON output
    console.log(JSON.stringify(files, null, 2));
    return;
  }

  // Table output
  if (files.length === 0) {
    console.log('No files found in AGENTSCAPE');
    return;
  }

  // Calculate column widths
  const fileWidth = Math.max(10, ...files.map((f) => f.file.length));
  const descWidth = Math.max(10, ...files.map((f) => f.desc.length));
  const tagsWidth = Math.max(10, ...files.map((f) => f.tags.length));
  const datesWidth = Math.max(10, ...files.map((f) => f.dates.length));

  // Print header
  console.log(
    `${'FILE'.padEnd(fileWidth)} | ${'DESC'.padEnd(descWidth)} | ${'TAGS'.padEnd(tagsWidth)} | ${'DATES'.padEnd(datesWidth)}`
  );
  console.log('-'.repeat(fileWidth + descWidth + tagsWidth + datesWidth + 12));

  // Print rows
  for (const file of files) {
    console.log(
      `${file.file.padEnd(fileWidth)} | ${file.desc.padEnd(descWidth)} | ${file.tags.padEnd(tagsWidth)} | ${file.dates.padEnd(datesWidth)}`
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
    console.log(`Dates: ${file.dates}`);
    console.log(`\n${'='.repeat(60)}\n`);
  }

  // Output content
  console.log(file.content);
}

/**
 * Write a file to AGENTSCAPE
 * Requires --content or --file flag
 * Optional: --desc, --tags, --dates
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
    // Read from local file
    const localFile = Bun.file(args.flags.file);
    content = await localFile.text();
  } else {
    throw new Error('Either --content or --file flag is required');
  }

  // Build file object
  const file: AgentFile = {
    file: filename,
    desc: typeof args.flags.desc === 'string' ? args.flags.desc : 'md',
    tags: typeof args.flags.tags === 'string' ? args.flags.tags : '',
    dates: typeof args.flags.dates === 'string' ? args.flags.dates : new Date().toISOString().split('T')[0] || '',
    content,
  };

  // Write file
  await agentscape.writeFile(file);

  console.log(`✓ Wrote ${filename} (${content.length} bytes)`);
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
    console.log(`✓ Deleted ${filename}`);
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
