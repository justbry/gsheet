/**
 * Delete command - delete a file from AGENTSCAPE
 */

import type { AgentScapeManager } from '../core/agentscape-manager';
import type { ParsedArgs } from '../parser';

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
