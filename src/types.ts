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
export interface SearchOptions<T = Record<string, unknown>> {
  sheet: string | number;
  query: Record<string, unknown>;
  operator?: 'and' | 'or';      // Default: 'and'
  matching?: 'strict' | 'loose'; // Default: 'strict'
}

// BatchRead query
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
  file: string;           // Filename (e.g., "AGENT-PROFILE.md", "PLAN.md")
  desc: string;           // Description/type (e.g., "md", "profile")
  tags: string;           // Tags (comma-separated)
  dates: string;          // Dates (e.g., created, modified)
  content: string;        // File content (markdown)
}
