/**
 * Write command - write a file to AGENTSCAPE
 */

import type { AgentFile } from '../types';
import type { AgentScapeManager } from '../core/agentscape-manager';
import type { ParsedArgs } from '../parser';

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
