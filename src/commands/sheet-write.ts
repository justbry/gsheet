/**
 * Sheet-write command - write data to any sheet in the spreadsheet
 */

import type { ParsedArgs } from '../parser';
import { SheetAgent } from '../core/agent';

/**
 * Write data to any sheet in the spreadsheet
 * Requires --sheet, --range, and --data flags
 * Optional --headers flag
 */
export async function cmdSheetWrite(
  spreadsheetId: string,
  args: ParsedArgs
): Promise<void> {
  const sheetName = args.flags.sheet;
  if (typeof sheetName !== 'string') {
    throw new Error('--sheet flag is required for sheet-write command');
  }

  const range = args.flags.range;
  if (typeof range !== 'string') {
    throw new Error('--range flag is required for sheet-write command');
  }

  const dataStr = args.flags.data;
  if (typeof dataStr !== 'string') {
    throw new Error('--data flag is required for sheet-write command');
  }

  let data: unknown[][];
  try {
    data = JSON.parse(dataStr);
  } catch {
    throw new Error('--data must be a valid JSON array (e.g. \'[["value1"],["value2"]]\')');
  }

  if (!Array.isArray(data)) {
    throw new Error('--data must be a JSON array of arrays');
  }

  const headers = args.flags.headers === true ? true :
    typeof args.flags.headers === 'string' ? args.flags.headers.split(',') : undefined;

  const agent = await SheetAgent.connect({ spreadsheetId });
  const result = await agent.write({ sheet: sheetName, range, data, headers });

  console.log(`Updated ${result.updatedCells} cell(s) in ${result.updatedRange}`);
  console.log(`Rows: ${result.updatedRows}, Columns: ${result.updatedColumns}`);
}
