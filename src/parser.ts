/**
 * CLI Argument Parser
 * Parses command-line arguments into structured commands
 */

export interface ParsedArgs {
  command: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

export interface AuthOptions {
  spreadsheetId?: string;
  credentials?: string;  // Path to credentials file
  env?: boolean;         // Use CREDENTIALS_CONFIG env var
}

const VALID_COMMANDS = [
  'init',
  'ls', 'list',
  'read', 'cat',
  'write', 'edit',
  'delete', 'rm',
  'shell',
  'validate', 'check',
  'sheet-read',
  'sheet-write',
  'help',
  'version',
];

const VALID_FLAGS = [
  '--sheet',
  '--format',
  '--recipient',
  '--message',
  '--confirm',
  '--provider',
  '--range',
  '--data',
  '--content',
  '--file',
  '--desc',
  '--tags',
  '--path',
  '--status',
  '--depends-on',
  '--max-ctx-len',
  '--spreadsheet-id',
  '--credentials',
  '--env',
  '--json',
  '--metadata',
  '--force',
  '--dry-run',
  '--help', '-h',
  '--version', '-v',
];

/**
 * Parse command-line arguments
 * @param argv - Process arguments (usually process.argv.slice(2))
 * @returns Parsed command, args, and flags
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const args: string[] = [];
  let command = '';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;

    // Handle flags
    if (arg.startsWith('--') || arg.startsWith('-')) {
      // Normalize aliases
      let flagName = arg;
      if (arg === '-h') flagName = '--help';
      if (arg === '-v') flagName = '--version';

      // Validate flag
      if (!VALID_FLAGS.includes(flagName)) {
        throw new Error(`Unknown flag: ${arg}`);
      }

      // Check if flag has a value (next arg doesn't start with -)
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        flags[flagName.slice(2)] = nextArg;
        i++; // Skip next arg
      } else {
        // Boolean flag
        flags[flagName.slice(2)] = true;
      }
    } else if (!command) {
      // First non-flag arg is the command
      command = arg;
    } else {
      // Remaining non-flag args
      args.push(arg);
    }
  }

  return { command, args, flags };
}

/**
 * Validate command and required arguments
 * @param parsed - Parsed arguments
 * @throws Error if command is invalid or missing required args
 */
export function validateCommand(parsed: ParsedArgs): void {
  const { command, args, flags } = parsed;

  // Special case: help and version don't need validation
  if (command === 'help' || flags.help) return;
  if (command === 'version' || flags.version) return;

  // Validate command
  if (!command) {
    throw new Error('No command specified. Use --help for usage information.');
  }

  if (!VALID_COMMANDS.includes(command)) {
    throw new Error(`Unknown command: ${command}. Valid commands: ${VALID_COMMANDS.join(', ')}`);
  }

  // Validate required args per command
  switch (command) {
    case 'read':
    case 'cat':
      if (args.length === 0) {
        throw new Error('Command "read" requires a filename argument');
      }
      break;

    case 'write':
    case 'edit':
      if (args.length === 0) {
        throw new Error('Command "write" requires a filename argument');
      }
      if (!flags.content && !flags.file) {
        throw new Error('Command "write" requires either --content or --file flag');
      }
      break;

    case 'delete':
    case 'rm':
      if (args.length === 0) {
        throw new Error('Command "delete" requires a filename argument');
      }
      break;

    case 'sheet-read':
      if (!flags.sheet) {
        throw new Error('Command "sheet-read" requires --sheet flag');
      }
      break;

    case 'sheet-write':
      if (!flags.sheet) {
        throw new Error('Command "sheet-write" requires --sheet flag');
      }
      if (!flags.range) {
        throw new Error('Command "sheet-write" requires --range flag (A1 notation, e.g. "F28" or "A1:D10")');
      }
      if (!flags.data) {
        throw new Error('Command "sheet-write" requires --data flag (JSON string of 2D array)');
      }
      break;
  }

  // spreadsheet-id validation is handled by resolveSpreadsheetId() with daily caching
}

/**
 * Extract spreadsheet ID from a Google Sheets URL or return the ID as-is
 * Supports formats:
 * - https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit...
 * - SPREADSHEET_ID (raw ID)
 * @param input - URL or spreadsheet ID
 * @returns Extracted spreadsheet ID
 */
export function extractSpreadsheetId(input: string): string {
  // If it's already just an ID (no slashes or protocol), return as-is
  if (!input.includes('/') && !input.includes(':')) {
    return input;
  }

  // Try to extract from URL
  const urlPattern = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
  const match = input.match(urlPattern);

  if (match && match[1]) {
    return match[1];
  }

  // If no match but looks like a URL, throw helpful error
  if (input.includes('docs.google.com') || input.startsWith('http')) {
    throw new Error(
      `Could not extract spreadsheet ID from URL: ${input}\n` +
      'Expected format: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/...'
    );
  }

  // Otherwise assume it's an ID
  return input;
}

/**
 * Extract auth options from parsed flags
 * @param flags - Parsed flags
 * @returns Auth options object
 */
export function extractAuthOptions(flags: Record<string, string | boolean>): AuthOptions {
  const rawSpreadsheetId = typeof flags['spreadsheet-id'] === 'string' ? flags['spreadsheet-id'] : undefined;

  return {
    spreadsheetId: rawSpreadsheetId ? extractSpreadsheetId(rawSpreadsheetId) : undefined,
    credentials: typeof flags.credentials === 'string' ? flags.credentials : undefined,
    env: flags.env === true ? true : undefined,
  };
}

/**
 * Resolve spreadsheet ID from flag or daily cache file.
 * When provided, saves to .env.gsheet.YYYYMMDD and cleans up older cache files.
 * When absent, reads from today's cache or throws requiring the flag.
 */
export async function resolveSpreadsheetId(flags: Record<string, string | boolean>): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const envFile = `.env.gsheet.${today}`;

  const provided = typeof flags['spreadsheet-id'] === 'string' ? flags['spreadsheet-id'] : undefined;

  if (provided) {
    const id = extractSpreadsheetId(provided);
    await Bun.write(envFile, id);
    // Clean up old env files
    const { unlinkSync } = await import('fs');
    const glob = new Bun.Glob('.env.gsheet.*');
    for await (const file of glob.scan('.')) {
      if (file !== envFile) {
        try { unlinkSync(file); } catch {}
      }
    }
    return id;
  }

  // Try today's cache
  const cached = Bun.file(envFile);
  if (await cached.exists()) {
    return (await cached.text()).trim();
  }

  throw new Error(
    `Missing --spreadsheet-id. Required on first run each day.\n` +
    `Usage: gsheet <command> --spreadsheet-id <id>`
  );
}

/**
 * Get help text
 */
export function getHelpText(): string {
  return `
Google Sheets Agent CLI

USAGE:
  gsheet [COMMAND] [OPTIONS]

COMMANDS:
  init                  Initialize or fix AGENTSCAPE sheet structure
  ls, list              List all files in AGENTSCAPE sheet
  read, cat <file>      Read a file's content
  write <file>          Write a file (requires --content or --file)
  delete, rm <file>     Delete a file
  shell                 Start interactive REPL shell
  validate, check       Validate AGENTSCAPE structure and format
  sheet-read            Read any sheet (requires --sheet flag)
  sheet-write           Write to any sheet (requires --sheet, --range, --data)
  help                  Show this help message
  version               Show version information

OPTIONS:
  --spreadsheet-id <id|url> Google Sheets spreadsheet ID or URL (required)
  --credentials <path>      Path to service account credentials JSON
  --env                     Use CREDENTIALS_CONFIG environment variable (default)

  --sheet <name>            Sheet name (for sheet-read/sheet-write)
  --range <A1>              Cell range in A1 notation (for sheet-write)
  --data <json>             JSON 2D array of values (for sheet-write)
  --format <type>           Output format: array, objects (default: array)
  --content <text>          File content (for write command)
  --file <path>             Path to local file (for write command)
  --desc <text>             File description (max 50 words)
  --tags <text>             Comma-separated tags
  --path <text>             Virtual path (default: /opt/agentscape/{file})
  --status <text>           Lifecycle status: active, draft, archived
  --depends-on <text>       Comma-separated file dependencies
  --max-ctx-len <number>    Token budget cap for this file

  --json                    Output as JSON (for list command)
  --metadata                Show metadata (for read command)
  --force                   Force re-initialization even if valid (for init)
  --dry-run                 Show what would be done without making changes (for init)

  -h, --help                Show help
  -v, --version             Show version

EXAMPLES:
  # Initialize AGENTSCAPE structure
  gsheet init --spreadsheet-id ABC123

  # Check what init would do (without making changes)
  gsheet init --spreadsheet-id ABC123 --dry-run

  # Force re-initialization
  gsheet init --spreadsheet-id ABC123 --force

  # List all files (using spreadsheet ID)
  gsheet ls --spreadsheet-id ABC123

  # List all files (using URL)
  gsheet ls --spreadsheet-id "https://docs.google.com/spreadsheets/d/ABC123/edit"

  # Read a file
  gsheet read PLAN.md --spreadsheet-id ABC123

  # Write a file
  gsheet write NOTES.md --content "# My Notes" --spreadsheet-id ABC123

  # Write from local file
  gsheet write RESEARCH.md --file ./research.md --spreadsheet-id ABC123

  # Interactive shell
  gsheet shell --spreadsheet-id ABC123

  # Validate AGENTSCAPE structure
  gsheet validate --spreadsheet-id ABC123

  # Read any sheet in the spreadsheet
  gsheet sheet-read --sheet Teachers --spreadsheet-id ABC123

  # Read sheet as JSON objects
  gsheet sheet-read --sheet Teachers --format objects --spreadsheet-id ABC123

  # Write to a sheet cell
  gsheet sheet-write --sheet Schedule --range "F28" --data '[["Justin B"]]'

  # Write multiple rows
  gsheet sheet-write --sheet Schedule --range "F28:F31" --data '[["A"],["B"],["C"],["D"]]'

AUTHENTICATION:
  By default, the CLI uses the CREDENTIALS_CONFIG environment variable (Base64-encoded
  service account JSON). You can also specify a credentials file with --credentials.

  export CREDENTIALS_CONFIG="<base64-encoded-json>"
  gsheet ls --spreadsheet-id=ABC123

  Or:
  gsheet ls --spreadsheet-id=ABC123 --credentials ./service-account.json
`;
}

/**
 * Get version text
 */
export function getVersionText(): string {
  // Note: In production, this would read from package.json
  return 'gsheet v1.1.0';
}
