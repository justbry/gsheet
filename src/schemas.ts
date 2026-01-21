/**
 * Workspace constants for PDR-v4.5
 */

// Workspace sheets enum - AGENT_BASE is the single sheet for all agent state
export const WorkspaceSheets = {
  AGENT_BASE: 'AGENT_BASE',
} as const;

export type WorkspaceSheet = (typeof WorkspaceSheets)[keyof typeof WorkspaceSheets];
