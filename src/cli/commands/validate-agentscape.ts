/**
 * Validate AGENTSCAPE Structure
 *
 * Ensures AGENTSCAPE follows the column-based format:
 * - Column A (rows 1-12): Field labels
 * - Column B+: Files following the 12-row structure
 */

import type { SheetClient } from '../../core/sheet-client';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  structure: {
    columnA: string[];
    files: Array<{
      column: string;
      filename: string;
      desc: string;
      tags: string;
      path: string;
      status: string;
      dependsOn: string;
      contextLen: string;
      maxCtxLen: string;
      contentLength: number;
    }>;
  };
}

const EXPECTED_LABELS = [
  'FILE', 'DESC', 'TAGS', 'Path', 'CreatedTS', 'UpdatedTS',
  'Status', 'DependsOn', 'ContextLen', 'MaxCtxLen', 'Hash', 'MDContent',
];

const METADATA_ROWS = 12;

export async function validateAgentscape(
  sheetClient: SheetClient,
  spreadsheetId: string
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    structure: {
      columnA: [],
      files: [],
    },
  };

  const client = await sheetClient.getClient();

  let sheetData: unknown[][];
  try {
    const response = await sheetClient.executeWithRetry(async () => {
      return client.spreadsheets.values.get({
        spreadsheetId,
        range: `AGENTSCAPE!A1:Z${METADATA_ROWS}`,
      });
    });
    sheetData = response.data.values || [];
  } catch (error) {
    result.valid = false;
    result.errors.push('Failed to read AGENTSCAPE sheet. Does it exist?');
    return result;
  }

  if (sheetData.length === 0) {
    result.valid = false;
    result.errors.push('AGENTSCAPE sheet is empty');
    return result;
  }

  // Validate Column A labels
  const columnA: string[] = [];
  for (let row = 0; row < METADATA_ROWS; row++) {
    const value = String(sheetData[row]?.[0] || '').trim();
    columnA.push(value);
  }
  result.structure.columnA = columnA;

  for (let i = 0; i < EXPECTED_LABELS.length; i++) {
    if (columnA[i] !== EXPECTED_LABELS[i]) {
      result.valid = false;
      result.errors.push(
        `Column A row ${i + 1}: Expected "${EXPECTED_LABELS[i]}", got "${columnA[i] || '(empty)'}"`
      );
    }
  }

  // Validate files in columns B+
  const firstRow = sheetData[0] || [];
  for (let col = 1; col < firstRow.length; col++) {
    const filename = String(firstRow[col] || '').trim();

    if (!filename) continue;

    if (EXPECTED_LABELS.includes(filename)) {
      result.warnings.push(
        `Column ${columnIndexToLetter(col)}: Row 1 contains label "${filename}". Files should have filenames here.`
      );
      continue;
    }

    const desc = String(sheetData[1]?.[col] || '').trim();
    const tags = String(sheetData[2]?.[col] || '').trim();
    const path = String(sheetData[3]?.[col] || '').trim();
    const status = String(sheetData[6]?.[col] || '').trim();
    const dependsOn = String(sheetData[7]?.[col] || '').trim();
    const contextLen = String(sheetData[8]?.[col] || '').trim();
    const maxCtxLen = String(sheetData[9]?.[col] || '').trim();
    const content = String(sheetData[11]?.[col] || '').trim();

    result.structure.files.push({
      column: columnIndexToLetter(col),
      filename,
      desc,
      tags,
      path,
      status,
      dependsOn,
      contextLen,
      maxCtxLen,
      contentLength: content.length,
    });

    if (!filename.endsWith('.md')) {
      result.warnings.push(
        `Column ${columnIndexToLetter(col)}: Filename "${filename}" doesn't end with .md`
      );
    }

    if (!desc) {
      result.warnings.push(
        `Column ${columnIndexToLetter(col)} (${filename}): Missing description (row 2)`
      );
    }

    if (!status) {
      result.warnings.push(
        `Column ${columnIndexToLetter(col)} (${filename}): Missing status (row 7)`
      );
    }

    if (!content) {
      result.warnings.push(
        `Column ${columnIndexToLetter(col)} (${filename}): Missing content (row 12)`
      );
    }
  }

  // Check for required files
  const fileNames = result.structure.files.map(f => f.filename);

  if (!fileNames.includes('AGENTS.md')) {
    result.errors.push('Missing required file: AGENTS.md (should be in column B)');
    result.valid = false;
  } else {
    const agentFile = result.structure.files.find(f => f.filename === 'AGENTS.md');
    if (agentFile && agentFile.column !== 'B') {
      result.warnings.push(`AGENTS.md found in column ${agentFile.column}, expected column B`);
    }
  }

  if (!fileNames.includes('PLAN.md')) {
    result.errors.push('Missing required file: PLAN.md (should be in column C)');
    result.valid = false;
  } else {
    const planFile = result.structure.files.find(f => f.filename === 'PLAN.md');
    if (planFile && planFile.column !== 'C') {
      result.warnings.push(`PLAN.md found in column ${planFile.column}, expected column C`);
    }
  }

  return result;
}

function columnIndexToLetter(index: number): string {
  let letter = '';
  let num = index;

  while (num >= 0) {
    letter = String.fromCharCode((num % 26) + 65) + letter;
    num = Math.floor(num / 26) - 1;
  }

  return letter;
}

/**
 * Format validation result as readable text
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('AGENTSCAPE Structure Validation');
  lines.push('='.repeat(60));
  lines.push('');

  if (result.valid && result.warnings.length === 0) {
    lines.push('Status: VALID (no issues)');
  } else if (result.valid) {
    lines.push('Status: VALID (with warnings)');
  } else {
    lines.push('Status: INVALID');
  }
  lines.push('');

  // Column A validation
  lines.push('Column A (Labels):');
  lines.push('-'.repeat(60));
  result.structure.columnA.forEach((label, i) => {
    const expected = EXPECTED_LABELS[i];
    const match = label === expected;
    const icon = match ? 'OK' : 'FAIL';
    lines.push(`  Row ${i + 1}: [${icon}] "${label}" ${!match ? `(expected "${expected}")` : ''}`);
  });
  lines.push('');

  // Files
  lines.push(`Files Found: ${result.structure.files.length}`);
  lines.push('-'.repeat(60));
  result.structure.files.forEach((file) => {
    lines.push(`  Column ${file.column}: ${file.filename}`);
    lines.push(`    DESC: ${file.desc || '(empty)'}`);
    lines.push(`    TAGS: ${file.tags || '(empty)'}`);
    lines.push(`    Path: ${file.path || '(empty)'}`);
    lines.push(`    Status: ${file.status || '(empty)'}`);
    lines.push(`    DependsOn: ${file.dependsOn || '(none)'}`);
    lines.push(`    ContextLen: ${file.contextLen || '(empty)'}`);
    lines.push(`    MaxCtxLen: ${file.maxCtxLen || '(no limit)'}`);
    lines.push(`    Content: ${file.contentLength} characters`);
    lines.push('');
  });

  // Errors
  if (result.errors.length > 0) {
    lines.push('Errors:');
    lines.push('-'.repeat(60));
    result.errors.forEach((error) => {
      lines.push(`  ${error}`);
    });
    lines.push('');
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    lines.push('-'.repeat(60));
    result.warnings.forEach((warning) => {
      lines.push(`  ${warning}`);
    });
    lines.push('');
  }

  // Expected structure
  lines.push('Expected Structure (12 rows):');
  lines.push('-'.repeat(60));
  lines.push('      A             B              C              D+');
  lines.push(' 1  FILE         AGENTS.md      PLAN.md        [files...]');
  lines.push(' 2  DESC         Core agent...  Active plan... [desc...]');
  lines.push(' 3  TAGS         system         agent,plan     [tags...]');
  lines.push(' 4  Path         /opt/agent...  /opt/agent...  [paths...]');
  lines.push(' 5  CreatedTS    2026-01-15...  2026-01-15...  [timestamps...]');
  lines.push(' 6  UpdatedTS    2026-01-21...  2026-01-21...  [timestamps...]');
  lines.push(' 7  Status       active         active         [status...]');
  lines.push(' 8  DependsOn                   AGENTS.md      [deps...]');
  lines.push(' 9  ContextLen   =INT(LEN..)    =INT(LEN..)    [formulas...]');
  lines.push('10  MaxCtxLen                   5000           [limits...]');
  lines.push('11  Hash         =SHA256(..)    =SHA256(..)    [formulas...]');
  lines.push('12  MDContent    # Agent...     # Plan: ...    [content...]');
  lines.push('');

  lines.push('='.repeat(60));

  return lines.join('\n');
}
