/**
 * Script to explore all sheets in the spreadsheet
 */
import { SheetAgent } from './src/agent';

const SPREADSHEET_ID = '1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8';

async function exploreSheets() {
  console.log('Connecting to Google Sheets...');
  
  const agent = await SheetAgent.connect({
    spreadsheetId: SPREADSHEET_ID,
  });

  console.log('Connected!\n');

  // List all sheets
  const sheets = await agent.listSheets();
  
  console.log('=== ALL SHEETS IN SPREADSHEET ===\n');
  sheets.forEach((sheet, index) => {
    console.log((index + 1) + '. ' + sheet);
  });
  
  console.log('\n=== READING SAMPLE DATA FROM KEY SHEETS ===\n');
  
  // Read first few rows from each sheet to understand structure
  for (const sheetName of sheets) {
    console.log('--- ' + sheetName + ' ---');
    try {
      const result = await agent.read({
        sheet: sheetName,
        range: 'A1:E5',
        format: 'array',
      });
      
      if (result.rows.length > 0) {
        console.log('First ' + Math.min(5, result.rows.length) + ' rows:');
        result.rows.forEach((row: any, index: number) => {
          console.log('  Row ' + (index + 1) + ':', row);
        });
      } else {
        console.log('  (Empty sheet)');
      }
    } catch (error: any) {
      console.log('  Error reading sheet: ' + error.message);
    }
    console.log('');
  }
}

exploreSheets().catch((error: any) => {
  console.error('Error:', error.message);
  process.exit(1);
});
