#!/usr/bin/env bun

/**
 * Sync a local markdown folder to AGENTSCAPE sheet
 *
 * Usage:
 *   bun examples/cli/sync-folder.ts --spreadsheet-id=ABC123 --folder=./notes
 */

import { SheetClient } from '../../src/core/sheet-client';
import { PlanManager } from '../../src/managers/plan-manager';
import { AgentScapeManager } from '../../src/managers/agentscape-manager';
import type { AgentFile } from '../../src/types';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

async function main() {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  const spreadsheetId = args.find((arg) => arg.startsWith('--spreadsheet-id='))?.split('=')[1];
  const folder = args.find((arg) => arg.startsWith('--folder='))?.split('=')[1] || './notes';

  if (!spreadsheetId) {
    console.error('Error: --spreadsheet-id is required');
    process.exit(1);
  }

  console.log(`Syncing folder: ${folder}`);
  console.log(`To spreadsheet: ${spreadsheetId}\n`);

  // Create SheetClient (uses CREDENTIALS_CONFIG env var)
  const sheetClient = new SheetClient({ spreadsheetId });
  const planManager = new PlanManager(sheetClient, spreadsheetId);
  const agentscape = new AgentScapeManager(sheetClient, spreadsheetId, planManager);

  // Initialize AGENTSCAPE sheet
  await agentscape.initAgentScape();

  // Read all .md files from folder
  const files = await fs.readdir(folder);
  const mdFiles = files.filter((f) => f.endsWith('.md'));

  if (mdFiles.length === 0) {
    console.log('No .md files found in folder.');
    return;
  }

  console.log(`Found ${mdFiles.length} markdown file(s)\n`);

  // Sync each file
  let synced = 0;
  let skipped = 0;

  for (const filename of mdFiles) {
    const filepath = path.join(folder, filename);

    // Skip PLAN.md (special file)
    if (filename === 'PLAN.md') {
      console.log(`⊘ Skipping ${filename} (protected file)`);
      skipped++;
      continue;
    }

    console.log(`Syncing: ${filename}`);

    // Read file content
    const content = await fs.readFile(filepath, 'utf-8');

    // Check for metadata sidecar
    const metadataPath = filepath + '.meta.json';
    let metadata = {
      desc: 'md',
      tags: '',
      dates: new Date().toISOString().split('T')[0] || '',
    };

    try {
      const metaContent = await fs.readFile(metadataPath, 'utf-8');
      const parsedMeta = JSON.parse(metaContent);
      metadata = {
        desc: parsedMeta.desc || metadata.desc,
        tags: parsedMeta.tags || metadata.tags,
        dates: parsedMeta.dates || metadata.dates,
      };
      console.log(`  ✓ Loaded metadata from ${filename}.meta.json`);
    } catch {
      // No metadata file, use defaults
    }

    // Create AgentFile
    const file: AgentFile = {
      file: filename,
      desc: metadata.desc,
      tags: metadata.tags,
      dates: metadata.dates,
      content,
    };

    // Write to AGENTSCAPE
    await agentscape.writeFile(file);
    console.log(`  ✓ Synced to AGENTSCAPE`);
    synced++;
  }

  console.log(`\n✅ Sync complete!`);
  console.log(`   ${synced} file(s) synced`);
  if (skipped > 0) {
    console.log(`   ${skipped} file(s) skipped`);
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
