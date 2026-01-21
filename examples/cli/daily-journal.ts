#!/usr/bin/env bun

/**
 * Create or append to a daily journal file in AGENTSCAPE
 *
 * Usage:
 *   bun examples/cli/daily-journal.ts --spreadsheet-id=ABC123 "Today I learned about..."
 */

import { SheetClient } from '../../src/core/sheet-client';
import { PlanManager } from '../../src/managers/plan-manager';
import { AgentScapeManager } from '../../src/managers/agentscape-manager';
import type { AgentFile } from '../../src/types';

async function main() {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  const spreadsheetId = args.find((arg) => arg.startsWith('--spreadsheet-id='))?.split('=')[1];
  const entry = args.find((arg) => !arg.startsWith('--'));

  if (!spreadsheetId) {
    console.error('Error: --spreadsheet-id is required');
    console.error('Usage: bun daily-journal.ts --spreadsheet-id=ABC123 "Your journal entry"');
    process.exit(1);
  }

  if (!entry) {
    console.error('Error: Journal entry is required');
    console.error('Usage: bun daily-journal.ts --spreadsheet-id=ABC123 "Your journal entry"');
    process.exit(1);
  }

  // Create SheetClient (uses CREDENTIALS_CONFIG env var)
  const sheetClient = new SheetClient({ spreadsheetId });
  const planManager = new PlanManager(sheetClient, spreadsheetId);
  const agentscape = new AgentScapeManager(sheetClient, spreadsheetId, planManager);

  // Initialize AGENTSCAPE sheet
  await agentscape.initAgentScape();

  // Get current date for journal filename
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `JOURNAL-${today}.md`;
  const timestamp = new Date().toLocaleTimeString();

  console.log(`Adding entry to ${filename} at ${timestamp}...\n`);

  // Check if journal file exists
  const existingFile = await agentscape.readFile(filename);

  let content: string;
  if (existingFile) {
    // Append to existing journal
    content = existingFile.content + `\n\n## ${timestamp}\n\n${entry}`;
    console.log('Appending to existing journal...');
  } else {
    // Create new journal
    content = `# Daily Journal - ${today}\n\n## ${timestamp}\n\n${entry}`;
    console.log('Creating new journal...');
  }

  // Write journal file
  const file: AgentFile = {
    file: filename,
    desc: 'journal',
    tags: 'journal,daily',
    dates: today,
    content,
  };

  await agentscape.writeFile(file);

  console.log(`\n✅ Journal entry added!`);
  console.log(`   File: ${filename}`);
  console.log(`   Entry: "${entry}"`);
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
