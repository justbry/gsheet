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
  'ls', 'list',
  'read', 'cat',
  'write', 'edit',
  'delete', 'rm',
  'shell',
  'help',
  'version',
];

const VALID_FLAGS = [
  '--sheet',
  '--content',
  '--file',
  '--desc',
  '--tags',
  '--dates',
  '--spreadsheet-id',
  '--credentials',
  '--env',
  '--json',
  '--metadata',
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
  }

  // Validate spreadsheet-id is provided (unless it's help/version)
  if (!flags['spreadsheet-id'] && command !== 'help' && command !== 'version') {
    throw new Error('Missing required flag: --spreadsheet-id');
  }
}

/**
 * Extract auth options from parsed flags
 * @param flags - Parsed flags
 * @returns Auth options object
 */
export function extractAuthOptions(flags: Record<string, string | boolean>): AuthOptions {
  return {
    spreadsheetId: typeof flags['spreadsheet-id'] === 'string' ? flags['spreadsheet-id'] : undefined,
    credentials: typeof flags.credentials === 'string' ? flags.credentials : undefined,
    env: flags.env === true ? true : undefined,
  };
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
  ls, list              List all files in AGENTSCAPE sheet
  read, cat <file>      Read a file's content
  write <file>          Write a file (requires --content or --file)
  delete, rm <file>     Delete a file
  shell                 Start interactive REPL shell
  help                  Show this help message
  version               Show version information

OPTIONS:
  --spreadsheet-id <id>     Google Sheets spreadsheet ID (required)
  --credentials <path>      Path to service account credentials JSON
  --env                     Use CREDENTIALS_CONFIG environment variable (default)

  --content <text>          File content (for write command)
  --file <path>             Path to local file (for write command)
  --desc <text>             File description
  --tags <text>             Comma-separated tags
  --dates <text>            Date information

  --json                    Output as JSON (for list command)
  --metadata                Show metadata (for read command)

  -h, --help                Show help
  -v, --version             Show version

EXAMPLES:
  # List all files
  gsheet ls --spreadsheet-id=ABC123

  # Read a file
  gsheet read PLAN.md --spreadsheet-id=ABC123

  # Write a file
  gsheet write NOTES.md --content "# My Notes" --spreadsheet-id=ABC123

  # Write from local file
  gsheet write RESEARCH.md --file ./research.md --spreadsheet-id=ABC123

  # Interactive shell
  gsheet shell --spreadsheet-id=ABC123

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
  return 'gsheet v1.0.0';
}
