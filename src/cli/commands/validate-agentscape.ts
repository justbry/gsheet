/**
 * Validate AGENTSCAPE Structure
 *
 * Ensures AGENTSCAPE follows the column-based format:
 * - Column A (rows 1-5): Field labels (FILE, DESC, TAGS, DATES, Content/MD)
 * - Column B+: Files following the 5-row structure
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
      dates: string;
      contentLength: number;
    }>;
  };
}

const EXPECTED_LABELS = ['FILE', 'DESC', 'TAGS', 'DATES', 'Content/MD'];

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

  // Step 1: Read the entire AGENTSCAPE sheet
  let sheetData: unknown[][];
  try {
    const response = await sheetClient.executeWithRetry(async () => {
      return client.spreadsheets.values.get({
        spreadsheetId,
        range: 'AGENTSCAPE!A1:Z5', // Read first 5 rows, up to column Z
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

  // Step 2: Validate Column A (rows 1-5 should be field labels)
  const columnA: string[] = [];
  for (let row = 0; row < 5; row++) {
    const value = String(sheetData[row]?.[0] || '').trim();
    columnA.push(value);
  }
  result.structure.columnA = columnA;

  // Check if Column A matches expected labels
  for (let i = 0; i < EXPECTED_LABELS.length; i++) {
    if (columnA[i] !== EXPECTED_LABELS[i]) {
      result.valid = false;
      result.errors.push(
        `Column A row ${i + 1}: Expected "${EXPECTED_LABELS[i]}", got "${columnA[i] || '(empty)'}"`
      );
    }
  }

  // Check if Column A has data beyond row 5
  if (sheetData.length > 5) {
    for (let row = 5; row < sheetData.length; row++) {
      const value = String(sheetData[row]?.[0] || '').trim();
      if (value) {
        result.warnings.push(
          `Column A row ${row + 1}: Unexpected data "${value}". Column A should only have labels in rows 1-5.`
        );
      }
    }
  }

  // Step 3: Validate files in columns B+
  const firstRow = sheetData[0] || [];
  for (let col = 1; col < firstRow.length; col++) {
    const filename = String(firstRow[col] || '').trim();

    // Skip empty columns
    if (!filename) continue;

    // Skip if this looks like a label (shouldn't be in row 1 for files)
    if (EXPECTED_LABELS.includes(filename)) {
      result.warnings.push(
        `Column ${columnIndexToLetter(col)}: Row 1 contains label "${filename}". Files should have filenames here.`
      );
      continue;
    }

    // Extract file metadata (rows 1-5)
    const desc = String(sheetData[1]?.[col] || '').trim();
    const tags = String(sheetData[2]?.[col] || '').trim();
    const dates = String(sheetData[3]?.[col] || '').trim();
    const content = String(sheetData[4]?.[col] || '').trim();

    result.structure.files.push({
      column: columnIndexToLetter(col),
      filename,
      desc,
      tags,
      dates,
      contentLength: content.length,
    });

    // Validate file structure
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

    if (!content) {
      result.warnings.push(
        `Column ${columnIndexToLetter(col)} (${filename}): Missing content (row 5)`
      );
    }

    // Check if there's data beyond row 5
    if (sheetData.length > 5) {
      for (let row = 5; row < sheetData.length; row++) {
        const value = String(sheetData[row]?.[col] || '').trim();
        if (value) {
          result.warnings.push(
            `Column ${columnIndexToLetter(col)} (${filename}) row ${row + 1}: Unexpected data. Files should only use rows 1-5.`
          );
          break; // Only report once per file
        }
      }
    }
  }

  // Step 4: Check for required files
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

/**
 * Convert column index to letter (0=A, 1=B, 25=Z, 26=AA, etc.)
 */
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

  lines.push('═'.repeat(60));
  lines.push('AGENTSCAPE Structure Validation');
  lines.push('═'.repeat(60));
  lines.push('');

  // Overall status
  if (result.valid && result.warnings.length === 0) {
    lines.push('✅ Status: VALID (no issues)');
  } else if (result.valid) {
    lines.push('⚠️  Status: VALID (with warnings)');
  } else {
    lines.push('❌ Status: INVALID');
  }
  lines.push('');

  // Column A validation
  lines.push('Column A (Labels):');
  lines.push('─'.repeat(60));
  result.structure.columnA.forEach((label, i) => {
    const expected = EXPECTED_LABELS[i];
    const match = label === expected;
    const icon = match ? '✓' : '✗';
    lines.push(`  Row ${i + 1}: ${icon} "${label}" ${!match ? `(expected "${expected}")` : ''}`);
  });
  lines.push('');

  // Files
  lines.push(`Files Found: ${result.structure.files.length}`);
  lines.push('─'.repeat(60));
  result.structure.files.forEach((file) => {
    lines.push(`  Column ${file.column}: ${file.filename}`);
    lines.push(`    DESC: ${file.desc || '(empty)'}`);
    lines.push(`    TAGS: ${file.tags || '(empty)'}`);
    lines.push(`    DATES: ${file.dates || '(empty)'}`);
    lines.push(`    Content: ${file.contentLength} characters`);
    lines.push('');
  });

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

  // Expected structure
  lines.push('Expected Structure:');
  lines.push('─'.repeat(60));
  lines.push('     A          B            C            D+');
  lines.push('1  FILE      AGENTS.md    PLAN.md      [files...]');
  lines.push('2  DESC      agent        plan         [desc...]');
  lines.push('3  TAGS      system       agent,plan   [tags...]');
  lines.push('4  DATES     2026-01-21   2026-01-21   [dates...]');
  lines.push('5  Content   # Agent...   # Plan: ...  [content...]');
  lines.push('');

  lines.push('═'.repeat(60));

  return lines.join('\n');
}
