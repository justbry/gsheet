/**
 * Workspace constants for PDR-v4.5
 * Note: AGENT_BASE sheet removed in favor of AGENTSCAPE
 */

// Workspace sheets enum - kept for backward compatibility (empty)
export const WorkspaceSheets = {} as const;

export type WorkspaceSheet = (typeof WorkspaceSheets)[keyof typeof WorkspaceSheets];
