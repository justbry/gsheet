/**
 * g-sheet-agent-io
 * A lightweight TypeScript library that adds agent workspace capabilities to Google Sheets
 */

// Export main SheetAgent class
export { SheetAgent } from "./agent";

// Export types (PDR-v4.5)
export type {
  SheetAgentOptions,
  ServiceAccountCredentials,
  RetryConfig,
  ReadOptions,
  WriteOptions,
  SearchOptions,
  BatchReadQuery,
  SheetData,
  WriteResult,
  SearchResult,
  SearchMatch,
} from "./types";

// Export plan types
export type {
  Plan,
  Phase,
  PlanTask,
  PhaseInput,
  PlanAnalysis,
  TaskStatus,
  TaskUpdate,
} from "./types";

// Export error classes
export {
  ValidationError,
  PermissionError,
  NetworkError,
  AuthError,
  PlanError,
} from "./errors";

// Export schemas
export * from "./schemas";

// Export retry utility
export {
  withRetry,
  calculateBackoffDelay,
  isRetryableError,
  getDefaultRetryOptions,
  DEFAULT_RETRYABLE_ERRORS,
  RETRYABLE_STATUS_CODES,
} from "./core/sheet-client";

export type { RetryOptions } from "./core/sheet-client";
