#!/usr/bin/env bun

/**
 * Google Sheets Agent CLI Entry Point
 * Command-line interface for AgentScape file system
 */

import { SheetAgent } from '../agent';
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
import { cmdList, cmdRead, cmdWrite, cmdDelete, cmdShell } from './commands';

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

    // Initialize AGENTSCAPE sheet (idempotent)
    await agentscape.initAgentScape();

    // Route to command handler
    await routeCommand(parsed, agentscape);

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
  agentscape: AgentScapeManager
): Promise<void> {
  const { command } = parsed;

  switch (command) {
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
