/**
 * Script to read the Teachers sheet
 */
import { SheetAgent } from '../../src/agent';

const SPREADSHEET_ID = '1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8';

async function readTeachers() {
  console.log('Connecting to Google Sheets...');
  
  const agent = await SheetAgent.connect({
    spreadsheetId: SPREADSHEET_ID,
  });

  console.log('Connected! Reading Teachers sheet...\n');

  // Read the Teachers sheet with object format (auto-detect headers)
  const result = await agent.read({
    sheet: 'Teachers',
    format: 'object',
  });

  console.log('=== TEACHERS CONTACT LIST ===\n');
  console.log('Headers:', result.headers);
  console.log('');

  // Display all teachers
  let count = 0;
  result.rows.forEach((teacher: any) => {
    // Skip empty rows
    if (!teacher.Name && !teacher['Phone Number']) {
      return;
    }
    
    count++;
    console.log('Teacher ' + count + ':');
    console.log('  Name: ' + (teacher.Name || 'N/A'));
    console.log('  Phone: ' + (teacher['Phone Number'] || 'N/A'));
    console.log('  WhatsApp: ' + (teacher['In Whatsapp Group'] ? 'Yes' : 'No'));
    console.log('  Languages: ' + (teacher.Languages || 'N/A'));
    if (teacher.Notes) {
      console.log('  Notes: ' + teacher.Notes);
    }
    console.log('');
  });

  console.log('Total teachers with contact info: ' + count);
  
  // Search for French speakers
  console.log('\n=== FRENCH SPEAKERS ===\n');
  const frenchSpeakers = await agent.search({
    sheet: 'Teachers',
    query: { Languages: 'French' },
    matching: 'loose',
  });
  
  frenchSpeakers.rows.forEach((teacher: any) => {
    console.log('- ' + teacher.Name + ' (' + teacher.Languages + ')');
  });
}

readTeachers().catch((error: any) => {
  console.error('Error:', error.message);
  process.exit(1);
});
