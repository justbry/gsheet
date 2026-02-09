/**
 * Initialize/Fix AGENTSCAPE Structure
 *
 * This command ensures the AGENTSCAPE sheet has the correct structure:
 * - Column A (rows 1-12): Field labels (FILE, DESC, TAGS, Path, CreatedTS, UpdatedTS, Status, DependsOn, ContextLen, MaxCtxLen, Hash, MDContent)
 * - Column B+: Files following the 12-row structure
 *
 * If AGENTSCAPE exists but has an invalid structure, this command will:
 * 1. Read the existing data
 * 2. Extract any valid files
 * 3. Rebuild the structure with correct labels
 * 4. Preserve existing file content
 */

import type { SheetClient } from '../core/sheet-client';

interface InitResult {
  success: boolean;
  action: 'created' | 'fixed' | 'already_valid';
  filesFound: number;
  fileNames: string[];
  errors: string[];
  warnings: string[];
}

const EXPECTED_LABELS = [
  'FILE', 'DESC', 'TAGS', 'Path', 'CreatedTS', 'UpdatedTS',
  'Status', 'DependsOn', 'ContextLen', 'MaxCtxLen', 'Hash', 'MDContent',
];

const METADATA_ROWS = 12;

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
          range: `AGENTSCAPE!A1:Z${METADATA_ROWS}`,
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
    const now = new Date().toISOString();
    result.warnings.push('No existing files found. Creating default AGENTS.md and PLAN.md files.');
    files.push(
      {
        name: 'AGENTS.md',
        desc: 'Core agent identity and capabilities.',
        tags: 'system,context',
        path: '/opt/agentscape/AGENTS.md',
        createdTs: now,
        updatedTs: now,
        status: 'active',
        dependsOn: '',
        contextLen: '=INT(LEN(B12)/4)',
        maxCtxLen: '',
        hash: '=IF(B12="","",SHA256(B12))',
        content: '# Agent Context\n\nYou are an AI agent with access to a Google Sheets workspace.\n\n## Core Tools\n- read, write, append, search operations\n- Planning system (getPlan, createPlan, task management)\n- History logging\n\nSee documentation for full details.',
      },
      {
        name: 'PLAN.md',
        desc: 'Active execution plan with phased tasks.',
        tags: 'agent,plan',
        path: '/opt/agentscape/PLAN.md',
        createdTs: now,
        updatedTs: now,
        status: 'active',
        dependsOn: 'AGENTS.md',
        contextLen: '=INT(LEN(C12)/4)',
        maxCtxLen: '',
        hash: '=IF(C12="","",SHA256(C12))',
        content: '# Plan: Getting Started\n\nGoal: Learn the sheet agent system and complete first task\n\n## Analysis\n\n- Spreadsheet: [Your spreadsheet]\n- Key sheets: [To be determined]\n\n### Phase 1: Orientation\n- [ ] 1.1 List all sheets in the spreadsheet\n- [ ] 1.2 Read headers from main sheet to understand structure\n- [ ] 1.3 Confirm user\'s goal and create detailed plan',
      }
    );
    result.filesFound = files.length;
    result.fileNames = files.map((f) => f.name);
  }

  // Step 5: Build correct structure
  const fixedData: string[][] = EXPECTED_LABELS.map(label => [label]);

  // Add each file as a column
  files.forEach((file) => {
    fixedData[0].push(file.name);
    fixedData[1].push(file.desc);
    fixedData[2].push(file.tags);
    fixedData[3].push(file.path);
    fixedData[4].push(file.createdTs);
    fixedData[5].push(file.updatedTs);
    fixedData[6].push(file.status);
    fixedData[7].push(file.dependsOn);
    fixedData[8].push(file.contextLen);
    fixedData[9].push(file.maxCtxLen);
    fixedData[10].push(file.hash);
    fixedData[11].push(file.content);
  });

  // Step 6: Write to sheet (or simulate if dry run)
  if (options.dryRun) {
    result.success = true;
    result.action = sheetExists ? 'fixed' : 'created';
    result.warnings.push('Dry run mode - no changes were made');
    return result;
  }

  try {
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

    await sheetClient.executeWithRetry(async () => {
      return client.spreadsheets.values.update({
        spreadsheetId,
        range: `AGENTSCAPE!A1:Z${METADATA_ROWS}`,
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
  if (data.length < METADATA_ROWS) return false;

  for (let i = 0; i < METADATA_ROWS; i++) {
    const value = String(data[i]?.[0] || '').trim();
    if (value !== EXPECTED_LABELS[i]) {
      return false;
    }
  }

  return true;
}

interface ExtractedFile {
  name: string;
  desc: string;
  tags: string;
  path: string;
  createdTs: string;
  updatedTs: string;
  status: string;
  dependsOn: string;
  contextLen: string;
  maxCtxLen: string;
  hash: string;
  content: string;
}

/**
 * Extract files from existing data
 */
function extractFilesFromData(data: unknown[][]): ExtractedFile[] {
  const files: ExtractedFile[] = [];

  if (data.length === 0) return files;

  const row1 = data[0] || [];

  for (let col = 1; col < row1.length; col++) {
    const cell = row1[col];
    if (!cell || typeof cell !== 'string') continue;

    const cellStr = cell.trim();
    if (!cellStr) continue;

    if (cellStr.endsWith('.md') || cellStr.includes('PLAN') || cellStr.includes('WORKFLOW') ||
        cellStr.includes('AGENTS') || cellStr.includes('HISTORY') || cellStr.includes('COORDINATOR')) {

      const name = cellStr.endsWith('.md') ? cellStr : `${cellStr}.md`;
      const now = new Date().toISOString();

      files.push({
        name,
        desc: String(data[1]?.[col] || '').trim(),
        tags: String(data[2]?.[col] || '').trim(),
        path: String(data[3]?.[col] || `/opt/agentscape/${name}`).trim(),
        createdTs: String(data[4]?.[col] || now).trim(),
        updatedTs: String(data[5]?.[col] || now).trim(),
        status: String(data[6]?.[col] || 'active').trim(),
        dependsOn: String(data[7]?.[col] || '').trim(),
        contextLen: String(data[8]?.[col] || '').trim(),
        maxCtxLen: String(data[9]?.[col] || '').trim(),
        hash: String(data[10]?.[col] || '').trim(),
        content: String(data[11]?.[col] || '').trim(),
      });
    }
  }

  return files;
}

/**
 * Format initialization result as readable text
 */
export function formatInitResult(result: InitResult): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('AGENTSCAPE Initialization');
  lines.push('='.repeat(60));
  lines.push('');

  if (result.success) {
    if (result.action === 'already_valid') {
      lines.push('Status: AGENTSCAPE already has valid structure');
    } else if (result.action === 'created') {
      lines.push('Status: AGENTSCAPE sheet created successfully');
    } else {
      lines.push('Status: AGENTSCAPE structure fixed successfully');
    }
  } else {
    lines.push('Status: Failed to initialize AGENTSCAPE');
  }
  lines.push('');

  lines.push(`Action: ${result.action}`);
  lines.push(`Files found/created: ${result.filesFound}`);

  if (result.fileNames.length > 0) {
    lines.push('');
    lines.push('Files:');
    lines.push('-'.repeat(60));
    result.fileNames.forEach((name) => {
      lines.push(`  ${name}`);
    });
  }

  lines.push('');

  if (result.errors.length > 0) {
    lines.push('Errors:');
    lines.push('-'.repeat(60));
    result.errors.forEach((error) => {
      lines.push(`  ${error}`);
    });
    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    lines.push('-'.repeat(60));
    result.warnings.forEach((warning) => {
      lines.push(`  ${warning}`);
    });
    lines.push('');
  }

  lines.push('='.repeat(60));

  return lines.join('\n');
}
