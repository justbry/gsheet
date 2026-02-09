/**
 * Read command - read a file's content from AGENTSCAPE
 */

import type { AgentScapeManager } from '../core/agentscape-manager';
import type { ParsedArgs } from '../parser';

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
