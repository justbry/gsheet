/**
 * Workspace constants
 */

// Workspace sheets enum
export const WorkspaceSheets = {
  AGENTSCAPE: 'AGENTSCAPE',
} as const;

export type WorkspaceSheet = (typeof WorkspaceSheets)[keyof typeof WorkspaceSheets];
