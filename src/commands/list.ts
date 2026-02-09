/**
 * List command - show all files in AGENTSCAPE sheet
 */

import type { AgentScapeManager } from '../core/agentscape-manager';
import type { ParsedArgs } from '../parser';

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
