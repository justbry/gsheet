/**
 * Interactive REPL Shell
 * Provides interactive command-line interface for AgentScape
 */

import * as readline from 'node:readline';
import type { AgentScapeManager } from '../managers/agentscape-manager';
import { parseArgs, validateCommand } from './parser';
import { cmdList, cmdRead, cmdWrite, cmdDelete } from './commands';

const PROMPT = 'agentscape> ';

const HELP_TEXT = `
Available commands:
  ls, list              List all files
  read, cat <file>      Read a file
  write <file>          Write a file (use --content or --file)
  delete, rm <file>     Delete a file
  help                  Show this help
  exit, quit            Exit the shell

Examples:
  ls
  read PLAN.md
  read PLAN.md --metadata
  write NOTES.md --content "# My Notes"
  write RESEARCH.md --file ./local-file.md
  delete OLD_FILE.md
`;

/**
 * Start the interactive REPL
 */
export async function startRepl(agentscape: AgentScapeManager): Promise<void> {
  console.log('AgentScape Interactive Shell');
  console.log('Type "help" for available commands, "exit" to quit\n');

  // Get file list for tab completion
  let fileList: string[] = [];
  try {
    const files = await agentscape.listFiles();
    fileList = files.map((f) => f.file);
  } catch (error) {
    // Ignore errors during startup
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: PROMPT,
    completer: (line: string) => completer(line, fileList),
  });

  // Enable history
  // Note: readline automatically handles up/down arrow keys for history

  rl.prompt();

  rl.on('line', async (input: string) => {
    const trimmed = input.trim();

    // Skip empty lines
    if (!trimmed) {
      rl.prompt();
      return;
    }

    // Handle exit commands
    if (trimmed === 'exit' || trimmed === 'quit') {
      console.log('Goodbye!');
      rl.close();
      return;
    }

    // Handle help
    if (trimmed === 'help') {
      console.log(HELP_TEXT);
      rl.prompt();
      return;
    }

    // Handle edit command (special REPL command)
    if (trimmed.startsWith('edit ')) {
      await handleEditCommand(trimmed, agentscape);
      rl.prompt();
      return;
    }

    // Parse and execute command
    try {
      const argv = parseCommandLine(trimmed);
      const parsed = parseArgs(argv);

      // Don't need to validate spreadsheet-id in REPL (already connected)
      // Just validate the command itself
      if (!parsed.command) {
        throw new Error('No command specified. Type "help" for available commands.');
      }

      // Route to command handler
      await routeCommand(parsed, agentscape);

      // Refresh file list for tab completion
      try {
        const files = await agentscape.listFiles();
        fileList = files.map((f) => f.file);
      } catch (error) {
        // Ignore errors during refresh
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });

  // Handle Ctrl+C gracefully
  rl.on('SIGINT', () => {
    console.log('\nUse "exit" or "quit" to exit the shell');
    rl.prompt();
  });
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
      await cmdWrite(agentscape, parsed);
      break;

    case 'delete':
    case 'rm':
      await cmdDelete(agentscape, parsed);
      break;

    case 'help':
      console.log(HELP_TEXT);
      break;

    default:
      throw new Error(`Unknown command: ${command}. Type "help" for available commands.`);
  }
}

/**
 * Parse command line into argv array
 * Handles quoted strings properly
 */
function parseCommandLine(line: string): string[] {
  const argv: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (!char) continue;

    if (inQuote) {
      if (char === quoteChar) {
        // End quote
        inQuote = false;
        quoteChar = '';
      } else {
        current += char;
      }
    } else {
      if (char === '"' || char === "'") {
        // Start quote
        inQuote = true;
        quoteChar = char;
      } else if (char === ' ') {
        // End of arg
        if (current) {
          argv.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
  }

  // Push remaining
  if (current) {
    argv.push(current);
  }

  return argv;
}

/**
 * Tab completion function
 * Completes commands and filenames
 */
function completer(line: string, fileList: string[]): [string[], string] {
  const commands = ['ls', 'list', 'read', 'cat', 'write', 'edit', 'delete', 'rm', 'help', 'exit', 'quit'];

  // Get the word being completed
  const words = line.split(' ');
  const lastWord = words[words.length - 1] || '';

  // If we're completing the first word, suggest commands
  if (words.length === 1) {
    const hits = commands.filter((c) => c.startsWith(lastWord));
    return [hits, lastWord];
  }

  // If we're completing after read/cat/edit/delete, suggest filenames
  const firstWord = words[0];
  if (firstWord && ['read', 'cat', 'edit', 'delete', 'rm'].includes(firstWord)) {
    const hits = fileList.filter((f) => f.startsWith(lastWord));
    return [hits, lastWord];
  }

  // No completions
  return [[], lastWord];
}

/**
 * Handle edit command - opens file in $EDITOR
 */
async function handleEditCommand(line: string, agentscape: AgentScapeManager): Promise<void> {
  const parts = line.split(' ');
  const filename = parts[1];

  if (!filename) {
    console.error('Usage: edit <filename>');
    return;
  }

  // Get editor from environment
  const editor = process.env.EDITOR || process.env.VISUAL || 'nano';

  // Read file from AGENTSCAPE
  const file = await agentscape.readFile(filename);

  if (!file) {
    console.error(`File not found: ${filename}`);
    return;
  }

  // Write to temp file
  const tmpFile = `/tmp/agentscape-${filename}`;
  await Bun.write(tmpFile, file.content);

  // Open in editor
  console.log(`Opening ${filename} in ${editor}...`);
  const proc = Bun.spawn([editor, tmpFile], {
    stdio: ['inherit', 'inherit', 'inherit'],
  });

  await proc.exited;

  // Read back from temp file
  const tmpFileObj = Bun.file(tmpFile);
  const newContent = await tmpFileObj.text();

  // Write back to AGENTSCAPE
  file.content = newContent;
  await agentscape.writeFile(file);

  console.log(`✓ Saved ${filename}`);

  // Clean up temp file
  await Bun.write(tmpFile, ''); // Clear content
}
