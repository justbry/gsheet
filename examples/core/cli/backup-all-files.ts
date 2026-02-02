#!/usr/bin/env bun

/**
 * Backup all files from AGENTSCAPE to a local directory
 *
 * Usage:
 *   bun examples/cli/backup-all-files.ts --spreadsheet-id=ABC123 --output=./backup
 */

import { SheetClient } from '../../src/core/sheet-client';
import { PlanManager } from '../../src/managers/plan-manager';
import { AgentScapeManager } from '../../src/managers/agentscape-manager';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

async function main() {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  const spreadsheetId = args.find((arg) => arg.startsWith('--spreadsheet-id='))?.split('=')[1];
  const outputDir = args.find((arg) => arg.startsWith('--output='))?.split('=')[1] || './backup';

  if (!spreadsheetId) {
    console.error('Error: --spreadsheet-id is required');
    process.exit(1);
  }

  console.log(`Backing up files from spreadsheet: ${spreadsheetId}`);
  console.log(`Output directory: ${outputDir}\n`);

  // Create SheetClient (uses CREDENTIALS_CONFIG env var)
  const sheetClient = new SheetClient({ spreadsheetId });
  const planManager = new PlanManager(sheetClient, spreadsheetId);
  const agentscape = new AgentScapeManager(sheetClient, spreadsheetId, planManager);

  // Create output directory
  await fs.mkdir(outputDir, { recursive: true });

  // List all files
  const files = await agentscape.listFiles();

  if (files.length === 0) {
    console.log('No files to backup.');
    return;
  }

  console.log(`Found ${files.length} file(s)\n`);

  // Backup each file
  for (const file of files) {
    const filename = file.file;
    const filepath = path.join(outputDir, filename);

    console.log(`Backing up: ${filename}`);

    // Write file content
    await fs.writeFile(filepath, file.content, 'utf-8');

    // Write metadata as JSON sidecar
    const metadataPath = filepath + '.meta.json';
    await fs.writeFile(
      metadataPath,
      JSON.stringify(
        {
          file: file.file,
          desc: file.desc,
          tags: file.tags,
          updatedTs: file.updatedTs,
        },
        null,
        2
      ),
      'utf-8'
    );

    console.log(`  ✓ Saved to ${filepath}`);
    console.log(`  ✓ Metadata saved to ${metadataPath}`);
  }

  console.log(`\n✅ Backup complete! ${files.length} file(s) backed up to ${outputDir}`);
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
