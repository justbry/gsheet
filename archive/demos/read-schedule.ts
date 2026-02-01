/**
 * Script to read the Schedule sheet from the Google Spreadsheet
 */
import { SheetAgent } from './src/agent';

const SPREADSHEET_ID = '1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8';

async function readSchedule() {
  console.log('Connecting to Google Sheets...');
  
  // Connect to the spreadsheet
  const agent = await SheetAgent.connect({
    spreadsheetId: SPREADSHEET_ID,
  });

  console.log('Connected! Reading Schedule sheet...\n');

  // Read the first 30 rows of the Schedule sheet
  const result = await agent.read({
    sheet: 'Schedule',
    range: 'A1:Z30',
    format: 'array',
  });

  console.log('Found ' + result.rows.length + ' rows in Schedule sheet\n');
  
  // Display all rows
  result.rows.forEach((row: any, index: number) => {
    console.log('Row ' + (index + 1) + ':', row);
  });

  console.log('\n--- Now reading with object format (auto-detect headers) ---\n');

  // Read again with object format to see structured data
  const objectResult = await agent.read({
    sheet: 'Schedule',
    range: 'A1:Z30',
    format: 'object',
  });

  console.log('Headers:', objectResult.headers);
  console.log('\nFirst 5 data rows (as objects):');
  objectResult.rows.slice(0, 5).forEach((row: any, index: number) => {
    console.log('\nRow ' + (index + 1) + ':', JSON.stringify(row, null, 2));
  });

  console.log('\n\nTotal rows found: ' + objectResult.rows.length);
}

// Run the script
readSchedule().catch((error: any) => {
  console.error('Error:', error.message);
  process.exit(1);
});
