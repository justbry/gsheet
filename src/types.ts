/**
 * Type definitions for gsheet (PDR-v4.5)
 */

// Service account credentials structure
export interface ServiceAccountCredentials {
  type: 'service_account';
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

// Retry configuration
export interface RetryConfig {
  enabled?: boolean;           // Default: true
  maxAttempts?: number;        // Default: 3
  retryableErrors?: string[];  // Default: network + 5xx errors
}

// Main options interface
export interface SheetAgentOptions {
  spreadsheetId: string;

  // Auth (pick one)
  credentials?: ServiceAccountCredentials;
  keyFile?: string;  // Local dev only

  // Retry for transient errors
  retry?: RetryConfig;

  // Default format for read operations
  defaultFormat?: 'object' | 'array';
}

// Read options
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface ReadOptions<T = Record<string, unknown>> {
  sheet: string | number;       // Sheet name or index
  range?: string;               // A1 notation (optional)
  format?: 'object' | 'array';  // Default: 'object'
  headers?: string[] | boolean; // Auto-detect (true), specify, or skip (false)
}

// Write options
export interface WriteOptions {
  sheet: string | number;
  range?: string;
  data: unknown[][] | Record<string, unknown>[];
  headers?: string[] | boolean;
}

// Search options
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface SearchOptions<T = Record<string, unknown>> {
  sheet: string | number;
  query: Record<string, unknown>;
  operator?: 'and' | 'or';      // Default: 'and'
  matching?: 'strict' | 'loose'; // Default: 'strict'
}

// BatchRead query
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface BatchReadQuery<T = Record<string, unknown>> {
  sheet: string | number;
  range?: string;
  format?: 'object' | 'array';
}

// Result types
export interface SheetData<T = Record<string, unknown>> {
  rows: T[];
  headers?: string[];
  range?: string;
}

export interface WriteResult {
  updatedRows: number;
  updatedColumns: number;
  updatedCells: number;
  updatedRange: string;
}

export interface SearchResult<T = Record<string, unknown>> {
  rows: T[];
  matchedCount: number;
  searchedCount: number;
}

export interface SearchMatch {
  row: number;
  column: string;
  value: string;
}

// Clear options and result
export interface ClearOptions {
  sheet: string | number;
  range: string;
}

export interface ClearResult {
  clearedRange: string;
}

// Delete rows options and result
export interface DeleteRowsOptions {
  sheet: string | number;
  startRow: number;
  endRow?: number;
}

export interface DeleteRowsResult {
  deletedRows: number;
}

// Plan types (PDR-v4.5)
export type TaskStatus = 'todo' | 'doing' | 'done' | 'blocked' | 'review';

export interface PlanTask {
  line: number;        // Line index in markdown
  phase: number;       // Phase number (1, 2, 3...)
  step: string;        // "1.1", "1.2", "2.1", etc.
  status: TaskStatus;
  title: string;
  completedDate?: string;
  blockedReason?: string;
  reviewNote?: string;
}

export interface PlanAnalysis {
  spreadsheet: string;
  keySheets: string[];
  targetRanges: {
    read: string[];
    write: string[];
  };
  currentState?: string;
}

export interface Phase {
  number: number;
  name: string;
  tasks: PlanTask[];
}

export interface Plan {
  title: string;
  goal: string;
  analysis?: PlanAnalysis;
  questions?: string[];
  phases: Phase[];
  notes: string;
  raw: string;
}

export interface PhaseInput {
  name: string;
  steps: string[];
}

// Task update type for updateTask() method
export type TaskUpdate =
  | { status: 'doing' }
  | { status: 'done' }
  | { status: 'blocked'; reason: string }
  | { status: 'review'; note: string };

// AgentScape file types (for CLI file system)
export interface AgentFile {
  file: string;           // Row 1: Filename (e.g., "AGENTS.md", "PLAN.md")
  desc: string;           // Row 2: Summary (max 50 words)
  tags: string;           // Row 3: Comma-separated tags for filtering
  path: string;           // Row 4: Virtual path (default /opt/agentscape/{file})
  createdTs: string;      // Row 5: ISO 8601 creation timestamp (set once, immutable)
  updatedTs: string;      // Row 6: ISO 8601 last modified timestamp
  status: string;         // Row 7: Lifecycle state: active | draft | archived
  dependsOn: string;      // Row 8: Comma-separated file dependencies
  contextLen: string;     // Row 9: Formula result — estimated token count
  maxCtxLen: string;      // Row 10: Token budget cap (empty = no limit)
  hash: string;           // Row 11: Formula result — content fingerprint
  content: string;        // Row 12+: MDContent (markdown)
}
