/**
 * Shell command - start interactive REPL
 */

import type { AgentScapeManager } from '../core/agentscape-manager';
import type { ParsedArgs } from '../parser';

/**
 * Start interactive REPL shell
 * Delegates to repl.ts
 */
export async function cmdShell(
  agentscape: AgentScapeManager,
  args: ParsedArgs
): Promise<void> {
  const { startRepl } = await import('../repl');
  await startRepl(agentscape);
}
