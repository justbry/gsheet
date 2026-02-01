/**
 * Initialize/Fix AGENTSCAPE Structure
 *
 * This command ensures the AGENTSCAPE sheet has the correct structure:
 * - Column A (rows 1-6): Field labels (FILE, DESC, TAGS, DATES, BUDGET, Content/MD)
 * - Column B+: Files following the 6-row structure
 *
 * If AGENTSCAPE exists but has an invalid structure, this command will:
 * 1. Read the existing data
 * 2. Extract any valid files
 * 3. Rebuild the structure with correct labels
 * 4. Preserve existing file content
 */

import type { SheetClient } from '../../core/sheet-client';

interface InitResult {
  success: boolean;
  action: 'created' | 'fixed' | 'already_valid';
  filesFound: number;
  fileNames: string[];
  errors: string[];
  warnings: string[];
}

const EXPECTED_LABELS = ['FILE', 'DESC', 'TAGS', 'DATES', 'BUDGET', 'Content/MD'];

/**
 * Initialize or fix AGENTSCAPE structure
 */
export async function initAgentscape(
  sheetClient: SheetClient,
  spreadsheetId: string,
  options: { force?: boolean; dryRun?: boolean } = {}
): Promise<InitResult> {
  const result: InitResult = {
    success: false,
    action: 'created',
    filesFound: 0,
    fileNames: [],
    errors: [],
    warnings: [],
  };

  const client = await sheetClient.getClient();

  // Step 1: Check if AGENTSCAPE sheet exists
  let sheetExists = false;
  try {
    const spreadsheet = await sheetClient.executeWithRetry(async () => {
      return client.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets(properties(sheetId,title))',
      });
    });

    const sheets = spreadsheet.data.sheets || [];
    sheetExists = sheets.some((s) => s.properties?.title === 'AGENTSCAPE');
  } catch (error) {
    result.errors.push(`Failed to check for AGENTSCAPE sheet: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }

  // Step 2: Read existing data if sheet exists
  let currentData: unknown[][] = [];
  if (sheetExists) {
    try {
      const response = await sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.get({
          spreadsheetId,
          range: 'AGENTSCAPE!A1:Z10',
        });
      });
      currentData = response.data.values || [];
    } catch (error) {
      result.errors.push(`Failed to read AGENTSCAPE sheet: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }

  // Step 3: Validate current structure
  const isValid = validateStructure(currentData);
  if (isValid && !options.force) {
    result.success = true;
    result.action = 'already_valid';
    // Count files in valid structure
    if (currentData.length > 0) {
      const firstRow = currentData[0] || [];
      for (let i = 1; i < firstRow.length; i++) {
        const filename = String(firstRow[i] || '').trim();
        if (filename && !EXPECTED_LABELS.includes(filename)) {
          result.fileNames.push(filename);
        }
      }
      result.filesFound = result.fileNames.length;
    }
    return result;
  }

  // Step 4: Extract files from existing data (if any)
  const files = extractFilesFromData(currentData);
  result.filesFound = files.length;
  result.fileNames = files.map((f) => f.name);

  if (files.length === 0) {
    result.warnings.push('No existing files found. Creating default AGENTS.md and PLAN.md files.');
    // Create default files
    files.push(
      {
        name: 'AGENTS.md',
        desc: 'agent',
        tags: 'system,context',
        dates: new Date().toISOString().split('T')[0],
        budget: '2.5K',
        content: '# Agent Context\n\nYou are an AI agent with access to a Google Sheets workspace.\n\n## Core Tools\n- read, write, append, search operations\n- Planning system (getPlan, createPlan, task management)\n- History logging\n\nSee documentation for full details.',
      },
      {
        name: 'PLAN.md',
        desc: 'plan',
        tags: 'agent,plan',
        dates: new Date().toISOString().split('T')[0],
        budget: 'dynamic',
        content: '# Plan: Getting Started\n\nGoal: Learn the sheet agent system and complete first task\n\n## Analysis\n\n- Spreadsheet: [Your spreadsheet]\n- Key sheets: [To be determined]\n\n### Phase 1: Orientation\n- [ ] 1.1 List all sheets in the spreadsheet\n- [ ] 1.2 Read headers from main sheet to understand structure\n- [ ] 1.3 Confirm user\'s goal and create detailed plan',
      }
    );
    result.filesFound = files.length;
    result.fileNames = files.map((f) => f.name);
  }

  // Step 5: Build correct structure
  const fixedData: string[][] = [
    ['FILE'],       // Row 1
    ['DESC'],       // Row 2
    ['TAGS'],       // Row 3
    ['DATES'],      // Row 4
    ['BUDGET'],     // Row 5
    ['Content/MD'], // Row 6
  ];

  // Add each file as a column
  files.forEach((file) => {
    fixedData[0].push(file.name);
    fixedData[1].push(file.desc);
    fixedData[2].push(file.tags);
    fixedData[3].push(file.dates);
    fixedData[4].push(file.budget);
    fixedData[5].push(file.content);
  });

  // Step 6: Write to sheet (or simulate if dry run)
  if (options.dryRun) {
    result.success = true;
    result.action = sheetExists ? 'fixed' : 'created';
    result.warnings.push('Dry run mode - no changes were made');
    return result;
  }

  try {
    // Create sheet if it doesn't exist
    if (!sheetExists) {
      await sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'AGENTSCAPE',
                  },
                },
              },
            ],
          },
        });
      });
      result.action = 'created';
    } else {
      result.action = 'fixed';
    }

    // Write the structure
    await sheetClient.executeWithRetry(async () => {
      return client.spreadsheets.values.update({
        spreadsheetId,
        range: 'AGENTSCAPE!A1:Z6',
        valueInputOption: 'RAW',
        requestBody: {
          values: fixedData,
        },
      });
    });

    result.success = true;
  } catch (error) {
    result.errors.push(`Failed to write AGENTSCAPE structure: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }

  return result;
}

/**
 * Validate if current data has correct structure
 */
function validateStructure(data: unknown[][]): boolean {
  if (data.length < 6) return false;

  // Check column A labels
  for (let i = 0; i < 6; i++) {
    const value = String(data[i]?.[0] || '').trim();
    if (value !== EXPECTED_LABELS[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Extract files from existing data
 */
function extractFilesFromData(
  data: unknown[][]
): Array<{ name: string; desc: string; tags: string; dates: string; budget: string; content: string }> {
  const files: Array<{ name: string; desc: string; tags: string; dates: string; budget: string; content: string }> = [];

  if (data.length === 0) return files;

  const row1 = data[0] || [];

  // Look for files in columns B onwards
  for (let col = 1; col < row1.length; col++) {
    const cell = row1[col];
    if (!cell || typeof cell !== 'string') continue;

    const cellStr = cell.trim();
    if (!cellStr) continue;

    // Check if it looks like a filename or file identifier
    if (cellStr.endsWith('.md') || cellStr.includes('PLAN') || cellStr.includes('WORKFLOW') ||
        cellStr.includes('AGENTS') || cellStr.includes('HISTORY') || cellStr.includes('COORDINATOR')) {

      const name = cellStr.endsWith('.md') ? cellStr : `${cellStr}.md`;
      const desc = String(data[1]?.[col] || '').trim();
      const tags = String(data[2]?.[col] || '').trim();
      const dates = String(data[3]?.[col] || new Date().toISOString().split('T')[0]).trim();
      const budget = String(data[4]?.[col] || '0').trim();
      const content = String(data[5]?.[col] || '').trim();

      files.push({ name, desc, tags, dates, budget, content });
    }
  }

  return files;
}

/**
 * Format initialization result as readable text
 */
export function formatInitResult(result: InitResult): string {
  const lines: string[] = [];

  lines.push('═'.repeat(60));
  lines.push('AGENTSCAPE Initialization');
  lines.push('═'.repeat(60));
  lines.push('');

  // Overall status
  if (result.success) {
    if (result.action === 'already_valid') {
      lines.push('✅ Status: AGENTSCAPE already has valid structure');
    } else if (result.action === 'created') {
      lines.push('✅ Status: AGENTSCAPE sheet created successfully');
    } else {
      lines.push('✅ Status: AGENTSCAPE structure fixed successfully');
    }
  } else {
    lines.push('❌ Status: Failed to initialize AGENTSCAPE');
  }
  lines.push('');

  // Action taken
  lines.push(`Action: ${result.action}`);
  lines.push(`Files found/created: ${result.filesFound}`);

  if (result.fileNames.length > 0) {
    lines.push('');
    lines.push('Files:');
    lines.push('─'.repeat(60));
    result.fileNames.forEach((name) => {
      lines.push(`  • ${name}`);
    });
  }

  lines.push('');

  // Errors
  if (result.errors.length > 0) {
    lines.push('Errors:');
    lines.push('─'.repeat(60));
    result.errors.forEach((error) => {
      lines.push(`  ❌ ${error}`);
    });
    lines.push('');
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    lines.push('─'.repeat(60));
    result.warnings.forEach((warning) => {
      lines.push(`  ⚠️  ${warning}`);
    });
    lines.push('');
  }

  lines.push('═'.repeat(60));

  return lines.join('\n');
}
