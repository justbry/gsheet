/**
 * Sheet-read command - read data from any sheet in the spreadsheet
 */

import type { ParsedArgs } from '../parser';
import { SheetAgent } from '../core/agent';

/**
 * Read data from any sheet in the spreadsheet
 * Requires --sheet flag
 * Supports --format flag (array or objects)
 */
export async function cmdSheetRead(
  spreadsheetId: string,
  args: ParsedArgs
): Promise<void> {
  const sheetName = args.flags.sheet;
  if (typeof sheetName !== 'string') {
    throw new Error('--sheet flag is required for sheet-read command');
  }

  const format = args.flags.format === 'objects' ? 'object' : 'array';

  // Create a SheetAgent to read the sheet
  const agent = await SheetAgent.connect({ spreadsheetId });
  const result = await agent.read({ sheet: sheetName, format });

  if (args.flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Format output based on format type
  if (format === 'object') {
    const data = result.rows as Array<Record<string, unknown>>;

    if (data.length === 0) {
      console.log(`No data found in sheet: ${sheetName}`);
      return;
    }

    // Pretty print objects
    for (let i = 0; i < data.length; i++) {
      const obj = data[i];
      if (!obj) continue;
      console.log(`\n--- Row ${i + 1} ---`);
      for (const [key, value] of Object.entries(obj)) {
        console.log(`${key}: ${value}`);
      }
    }
    console.log(`\nTotal: ${data.length} row(s)`);
  } else {
    // Array format - print as table
    const rows = result.rows as unknown as unknown[][];

    if (rows.length === 0) {
      console.log(`No data found in sheet: ${sheetName}`);
      return;
    }

    // Print each row
    for (const row of rows) {
      console.log(row.map(cell => String(cell ?? '')).join(' | '));
    }

    console.log(`\nTotal: ${rows.length} row(s)`);
  }
}
