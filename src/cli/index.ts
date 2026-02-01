#!/usr/bin/env bun

/**
 * Google Sheets Agent CLI Entry Point
 * Command-line interface for AgentScape file system
 */

import { SheetClient } from '../core/sheet-client';
import { PlanManager } from '../managers/plan-manager';
import { AgentScapeManager } from '../managers/agentscape-manager';
import { AuthError, ValidationError } from '../errors';
import type { ServiceAccountCredentials } from '../types';
import {
  parseArgs,
  validateCommand,
  extractAuthOptions,
  getHelpText,
  getVersionText,
} from './parser';
import { cmdList, cmdRead, cmdWrite, cmdDelete, cmdShell, cmdSheetRead, cmdSendMessage } from './commands';
import { validateAgentscape, formatValidationResult } from './commands/validate-agentscape';
import { initAgentscape, formatInitResult } from './commands/init-agentscape';

/**
 * Main CLI function
 */
async function main() {
  try {
    // Parse command-line arguments
    const argv = process.argv.slice(2);
    const parsed = parseArgs(argv);

    // Handle --help early (before auth)
    if (parsed.flags.help || parsed.command === 'help') {
      console.log(getHelpText());
      process.exit(0);
    }

    // Handle --version early (before auth)
    if (parsed.flags.version || parsed.command === 'version') {
      console.log(getVersionText());
      process.exit(0);
    }

    // Validate command and arguments
    validateCommand(parsed);

    // Handle send-message separately (doesn't need spreadsheet)
    if (parsed.command === 'send-message') {
      await cmdSendMessage(parsed);
      process.exit(0);
    }

    // Extract auth options
    const authOptions = extractAuthOptions(parsed.flags);

    if (!authOptions.spreadsheetId) {
      throw new Error('Missing required flag: --spreadsheet-id');
    }

    // Resolve credentials
    const credentials = await resolveCredentials(authOptions);

    // Create SheetClient
    const sheetClient = new SheetClient({
      spreadsheetId: authOptions.spreadsheetId,
      credentials,
    });

    // Create PlanManager
    const planManager = new PlanManager(sheetClient, authOptions.spreadsheetId);

    // Create AgentScapeManager
    const agentscape = new AgentScapeManager(sheetClient, authOptions.spreadsheetId, planManager);

    // Special handling for commands that don't need AGENTSCAPE initialization
    const skipInit = ['init', 'sheet-read'].includes(parsed.command);

    if (skipInit) {
      await routeCommand(parsed, agentscape, sheetClient, authOptions.spreadsheetId);
    } else {
      // Initialize AGENTSCAPE sheet (idempotent) for other commands
      await agentscape.initAgentScape();

      // Route to command handler
      await routeCommand(parsed, agentscape, sheetClient, authOptions.spreadsheetId);
    }

    process.exit(0);
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

/**
 * Resolve credentials from auth options
 */
async function resolveCredentials(authOptions: {
  credentials?: string;
  env?: boolean;
  spreadsheetId?: string;
}): Promise<ServiceAccountCredentials> {
  // Priority 1: --credentials flag (path to JSON file)
  if (authOptions.credentials) {
    try {
      const file = Bun.file(authOptions.credentials);
      const content = await file.text();
      const parsed = JSON.parse(content);
      return parsed as ServiceAccountCredentials;
    } catch (error) {
      throw new AuthError(
        `Failed to read credentials file '${authOptions.credentials}': ${error instanceof Error ? error.message : 'Invalid JSON'}`
      );
    }
  }

  // Priority 2: CREDENTIALS_CONFIG env var (Base64-encoded JSON) - default
  const envCredentials = process.env.CREDENTIALS_CONFIG;
  if (envCredentials) {
    try {
      const decoded = Buffer.from(envCredentials, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      return parsed as ServiceAccountCredentials;
    } catch (error) {
      throw new AuthError(
        `Failed to parse CREDENTIALS_CONFIG: ${error instanceof Error ? error.message : 'Invalid JSON'}`
      );
    }
  }

  // No credentials found
  throw new AuthError(
    'No credentials found. Set CREDENTIALS_CONFIG environment variable or use --credentials flag.'
  );
}

/**
 * Route parsed command to appropriate handler
 */
async function routeCommand(
  parsed: { command: string; args: string[]; flags: Record<string, string | boolean> },
  agentscape: AgentScapeManager,
  sheetClient: SheetClient,
  spreadsheetId: string
): Promise<void> {
  const { command } = parsed;

  switch (command) {
    case 'init':
      // Initialize or fix AGENTSCAPE structure
      const initResult = await initAgentscape(
        sheetClient,
        spreadsheetId,
        {
          force: parsed.flags.force === true,
          dryRun: parsed.flags['dry-run'] === true,
        }
      );
      console.log(formatInitResult(initResult));
      if (!initResult.success) {
        process.exit(1);
      }
      break;

    case 'ls':
    case 'list':
      await cmdList(agentscape, parsed);
      break;

    case 'read':
    case 'cat':
      await cmdRead(agentscape, parsed);
      break;

    case 'write':
    case 'edit':
      await cmdWrite(agentscape, parsed);
      break;

    case 'delete':
    case 'rm':
      await cmdDelete(agentscape, parsed);
      break;

    case 'shell':
      await cmdShell(agentscape, parsed);
      break;

    case 'validate':
    case 'check':
      // Validate AGENTSCAPE structure
      const validationResult = await validateAgentscape(
        sheetClient,
        spreadsheetId
      );
      console.log(formatValidationResult(validationResult));
      if (!validationResult.valid) {
        process.exit(1);
      }
      break;

    case 'sheet-read':
      await cmdSheetRead(spreadsheetId, parsed);
      break;

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

/**
 * Handle and format errors
 */
function handleError(error: unknown): void {
  if (error instanceof AuthError) {
    console.error(`Authentication Error: ${error.message}`);
    console.error(`Fix: ${error.fix}`);
  } else if (error instanceof ValidationError) {
    console.error(`Validation Error: ${error.message}`);
    if (error.details.length > 0) {
      console.error('Details:');
      error.details.forEach((detail) => console.error(`  - ${detail}`));
    }
  } else if (error instanceof Error) {
    // Check for Google Sheets API errors
    const message = error.message;

    if (message.includes('The caller does not have permission')) {
      console.error('Permission Error: The service account does not have access to this spreadsheet.');
      console.error('Fix: Share the spreadsheet with the service account email (found in credentials JSON)');
    } else if (message.includes('Requested entity was not found')) {
      console.error('Not Found: The spreadsheet ID does not exist or is not accessible.');
      console.error('Fix: Verify the spreadsheet ID is correct');
    } else if (message.includes('already exists')) {
      console.error('Sheet Error: A sheet with this name already exists.');
      console.error('Note: This is likely a transient error. Try the command again.');
    } else {
      console.error(`Error: ${message}`);
    }
  } else {
    console.error(`Error: ${String(error)}`);
  }
}

// Run main function
main();
