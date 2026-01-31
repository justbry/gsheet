/**
 * Custom error classes with actionable fix instructions
 */

/**
 * Base error class for all gsheet errors
 */
export abstract class SheetAgentError extends Error {
  abstract readonly code: string;
  abstract readonly fix: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Validation errors for invalid inputs
 */
export class ValidationError extends SheetAgentError {
  readonly code = 'VALIDATION_ERROR';
  readonly fix: string;
  readonly details: string[];

  constructor(message: string, details: string[] = []) {
    const detailStr = details.length > 0 ? '\n  ' + details.join('\n  ') : '';
    super(`Validation failed${detailStr ? ':' + detailStr : ': ' + message}`);
    this.fix = 'Check the input parameters and ensure they match the expected types and formats.';
    this.details = details;
  }
}

/**
 * Permission errors when access is denied
 */
export class PermissionError extends SheetAgentError {
  readonly code = 'PERMISSION_ERROR';
  readonly fix: string;
  readonly sheet?: string;
  readonly serviceAccount?: string;
  readonly constraint?: string;

  constructor(sheet: string, serviceAccountOrConstraint?: string) {
    // Check if this is a constraint-based error (starts with "Blocked by constraint")
    const isConstraint = serviceAccountOrConstraint?.startsWith('Blocked by constraint');

    if (isConstraint) {
      super(`${serviceAccountOrConstraint}`);
      this.sheet = sheet;
      this.constraint = serviceAccountOrConstraint;
      this.fix = `Remove or deactivate the constraint to allow access to '${sheet}'`;
    } else {
      super(`Cannot access sheet '${sheet}'`);
      this.sheet = sheet;
      this.serviceAccount = serviceAccountOrConstraint;
      this.fix = serviceAccountOrConstraint
        ? `Share the spreadsheet with ${serviceAccountOrConstraint} (Editor role)`
        : 'Share the spreadsheet with the service account (Editor role)';
    }
  }
}

/**
 * Network errors for connection issues
 */
export class NetworkError extends SheetAgentError {
  readonly code = 'NETWORK_ERROR';
  readonly fix: string;
  readonly originalError?: string;
  readonly attempt?: number;
  readonly maxAttempts?: number;

  constructor(originalError: string, attempt?: number, maxAttempts?: number) {
    const retryInfo = attempt && maxAttempts ? ` (attempt ${attempt}/${maxAttempts})` : '';
    super(`Connection failed: ${originalError}${retryInfo}`);
    this.originalError = originalError;
    this.attempt = attempt;
    this.maxAttempts = maxAttempts;
    this.fix = 'Check your network connection. The request will be retried automatically.';
  }
}

/**
 * Agent paused error when operations are attempted while paused
 */
export class AgentPausedError extends SheetAgentError {
  readonly code = 'AGENT_PAUSED_ERROR';
  readonly fix = 'Call agent.resume() to continue operations';

  constructor() {
    super('Agent is paused');
  }
}

/**
 * Authentication error when credentials are missing or invalid
 */
export class AuthError extends SheetAgentError {
  readonly code = 'AUTH_ERROR';
  readonly fix: string;

  constructor(message: string = 'No credentials found') {
    super(message);
    this.fix = `Set one of:
  • options.credentials (object)
  • CREDENTIALS_CONFIG env var (Base64)
  • options.keyFile (path)`;
  }
}

/**
 * Plan-related errors (missing plan, task not found)
 */
export class PlanError extends SheetAgentError {
  readonly code = 'PLAN_ERROR';
  readonly fix: string;
  readonly step?: string;
  readonly availableTasks?: string[];

  constructor(message: string, fix?: string, context?: { step?: string; availableTasks?: string[] }) {
    super(message);
    this.step = context?.step;
    this.availableTasks = context?.availableTasks;
    this.fix = fix ?? 'Create a plan first using agent.createPlan()';
  }
}
