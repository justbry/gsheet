/**
 * SheetClient - Handles Google Sheets API authentication and client management
 */
import { google, sheets_v4 } from "googleapis";
import type { ServiceAccountCredentials, RetryConfig } from "../types";
import { AuthError, NetworkError } from "../errors";

// =============================================================================
// Retry Utilities
// =============================================================================

// Default retryable error codes (network errors)
export const DEFAULT_RETRYABLE_ERRORS = [
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ECONNREFUSED",
  "ECONNABORTED",
  "EPIPE",
  "ENETUNREACH",
  "EAI_AGAIN",
];

// Default retryable HTTP status codes
export const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];
}

/**
 * Default retry options
 */
export function getDefaultRetryOptions(config?: RetryConfig): RetryOptions {
  return {
    maxAttempts: config?.maxAttempts ?? 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    retryableErrors: config?.retryableErrors ?? DEFAULT_RETRYABLE_ERRORS,
  };
}

/**
 * Calculate delay with exponential backoff and jitter
 * Formula: min(maxDelayMs, baseDelayMs * 2^attempt) + random jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, etc.
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  // Cap at maximum delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  // Add small random jitter (0-10% of delay) to prevent thundering herd
  const jitter = Math.random() * (cappedDelay * 0.1);
  return Math.floor(cappedDelay + jitter);
}

/**
 * Determine if an error is retryable
 */
export function isRetryableError(
  error: unknown,
  retryableErrors: string[],
): boolean {
  // Check if it's a known error type
  if (error instanceof NetworkError) {
    return true;
  }

  // Check for Google API errors with status codes
  if (isGoogleApiError(error)) {
    const status = getErrorStatusCode(error);
    if (status && RETRYABLE_STATUS_CODES.includes(status)) {
      return true;
    }
  }

  // Check for network error codes
  const errorCode = getErrorCode(error);
  if (errorCode && retryableErrors.includes(errorCode)) {
    return true;
  }

  // Check for HTTP status codes in error message
  const errorMessage = getErrorMessage(error);
  for (const statusCode of RETRYABLE_STATUS_CODES) {
    if (errorMessage.includes(String(statusCode))) {
      return true;
    }
  }

  return false;
}

/**
 * Check if error is a Google API error
 */
function isGoogleApiError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const err = error as Record<string, unknown>;
  // Google API errors typically have response.status or code
  return "response" in err || "code" in err || "status" in err;
}

/**
 * Get HTTP status code from error
 */
function getErrorStatusCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const err = error as Record<string, unknown>;

  // Check response.status (axios/googleapis style)
  if (typeof err.response === "object" && err.response !== null) {
    const response = err.response as Record<string, unknown>;
    if (typeof response.status === "number") {
      return response.status;
    }
  }

  // Check code (googleapis style)
  if (typeof err.code === "number") {
    return err.code;
  }

  // Check status directly
  if (typeof err.status === "number") {
    return err.status;
  }

  return null;
}

/**
 * Get error code (for network errors like ECONNRESET)
 */
function getErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const err = error as Record<string, unknown>;

  if (typeof err.code === "string") {
    return err.code;
  }

  // Check cause for Node.js network errors
  if (typeof err.cause === "object" && err.cause !== null) {
    const cause = err.cause as Record<string, unknown>;
    if (typeof cause.code === "string") {
      return cause.code;
    }
  }

  return null;
}

/**
 * Get error message
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

/**
 * Extract retry-after from 429 response (in seconds)
 */
export function getRetryAfterSeconds(error: unknown): number | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const err = error as Record<string, unknown>;

  // Check response headers
  if (typeof err.response === "object" && err.response !== null) {
    const response = err.response as Record<string, unknown>;
    if (typeof response.headers === "object" && response.headers !== null) {
      const headers = response.headers as Record<string, unknown>;
      const retryAfter = headers["retry-after"] ?? headers["Retry-After"];
      if (typeof retryAfter === "string") {
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) {
          return seconds;
        }
      }
      if (typeof retryAfter === "number") {
        return retryAfter;
      }
    }
  }

  return null;
}

/**
 * Wait for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - The async function to retry
 * @param options - Retry options
 * @returns The result of the function
 * @throws The last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (!isRetryableError(error, options.retryableErrors)) {
        throw error;
      }

      // Don't wait after the last attempt
      if (attempt + 1 >= options.maxAttempts) {
        break;
      }

      // Calculate delay
      let delayMs: number;

      // Check for Retry-After header on 429
      const retryAfterSeconds = getRetryAfterSeconds(error);
      if (retryAfterSeconds !== null) {
        delayMs = retryAfterSeconds * 1000;
      } else {
        delayMs = calculateBackoffDelay(
          attempt,
          options.baseDelayMs,
          options.maxDelayMs,
        );
      }

      await sleep(delayMs);
    }
  }

  // Transform error for better messaging
  const errorCode = getErrorCode(lastError);
  const errorMessage = getErrorMessage(lastError);

  if (errorCode && options.retryableErrors.includes(errorCode)) {
    throw new NetworkError(
      errorMessage,
      options.maxAttempts,
      options.maxAttempts,
    );
  }

  // Re-throw the original error
  throw lastError;
}

// =============================================================================
// SheetClient
// =============================================================================

/**
 * Options for SheetClient
 */
export interface SheetClientOptions {
  spreadsheetId: string;
  credentials?: ServiceAccountCredentials;
  keyFile?: string;
  retry?: RetryConfig;
}

/**
 * SheetClient handles authentication and provides the Google Sheets client
 */
export class SheetClient {
  private readonly options: SheetClientOptions;
  private sheetsClient: sheets_v4.Sheets | null = null;
  private authPromise: Promise<sheets_v4.Sheets> | null = null;
  private readonly retryOptions: RetryOptions;

  constructor(options: SheetClientOptions) {
    this.options = options;

    // Configure retry options (use defaults if not specified)
    this.retryOptions = getDefaultRetryOptions(options.retry);
  }

  /**
   * Get the spreadsheet ID
   */
  get spreadsheetId(): string {
    return this.options.spreadsheetId;
  }

  /**
   * Check if retry is enabled (default: true)
   */
  isRetryEnabled(): boolean {
    return this.options.retry?.enabled !== false;
  }

  /**
   * Execute a function with optional retry
   * Wraps the function with exponential backoff retry if enabled
   */
  async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.isRetryEnabled()) {
      return fn();
    }
    return withRetry(fn, this.retryOptions);
  }

  /**
   * Get authenticated Google Sheets client (lazy initialization)
   */
  async getClient(): Promise<sheets_v4.Sheets> {
    if (this.sheetsClient) {
      return this.sheetsClient;
    }

    // Prevent multiple concurrent auth requests
    if (this.authPromise) {
      return this.authPromise;
    }

    this.authPromise = this.authenticate();
    this.sheetsClient = await this.authPromise;
    this.authPromise = null;
    return this.sheetsClient;
  }

  /**
   * Authenticate and return sheets client
   */
  private async authenticate(): Promise<sheets_v4.Sheets> {
    const credentials = await this.resolveCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    return google.sheets({ version: "v4", auth });
  }

  /**
   * Resolve credentials from multiple sources
   * Priority: options.credentials → CREDENTIALS_CONFIG env → options.keyFile
   */
  private async resolveCredentials(): Promise<ServiceAccountCredentials> {
    // Priority 1: Direct credentials object
    if (this.options.credentials) {
      this.validateCredentials(this.options.credentials);
      return this.options.credentials;
    }

    // Priority 2: CREDENTIALS_CONFIG env var (Base64 encoded)
    const envCredentials = process.env["CREDENTIALS_CONFIG"];
    if (envCredentials) {
      try {
        const decoded = Buffer.from(envCredentials, "base64").toString("utf-8");
        const parsed = JSON.parse(decoded) as ServiceAccountCredentials;
        this.validateCredentials(parsed);
        return parsed;
      } catch (error) {
        if (error instanceof AuthError) throw error;
        throw new AuthError(
          `Failed to parse CREDENTIALS_CONFIG: ${error instanceof Error ? error.message : "Invalid JSON"}`,
        );
      }
    }

    // Priority 3: keyFile path
    if (this.options.keyFile) {
      try {
        const file = Bun.file(this.options.keyFile);
        const content = await file.text();
        const parsed = JSON.parse(content) as ServiceAccountCredentials;
        this.validateCredentials(parsed);
        return parsed;
      } catch (error) {
        if (error instanceof AuthError) throw error;
        throw new AuthError(
          `Failed to read keyFile '${this.options.keyFile}': ${error instanceof Error ? error.message : "File not found"}`,
        );
      }
    }

    // No credentials found
    throw new AuthError("No credentials found");
  }

  /**
   * Validate that credentials have required fields
   */
  private validateCredentials(credentials: ServiceAccountCredentials): void {
    const requiredFields: (keyof ServiceAccountCredentials)[] = [
      "type",
      "project_id",
      "private_key",
      "client_email",
    ];

    const missingFields = requiredFields.filter((field) => !credentials[field]);

    if (missingFields.length > 0) {
      throw new AuthError(
        `Invalid credentials: missing required fields: ${missingFields.join(", ")}`,
      );
    }

    if (credentials.type !== "service_account") {
      throw new AuthError(
        `Invalid credentials: type must be 'service_account', got '${credentials.type}'`,
      );
    }
  }
}
