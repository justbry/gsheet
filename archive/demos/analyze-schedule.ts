/**
 * Script to analyze the Schedule sheet and extract teacher assignments
 */
import { SheetAgent } from './src/agent';

const SPREADSHEET_ID = '1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8';

async function analyzeSchedule() {
  console.log('Connecting to Google Sheets...');
  
  const agent = await SheetAgent.connect({
    spreadsheetId: SPREADSHEET_ID,
  });

  console.log('Connected! Reading Schedule sheet...\n');

  // Read the Schedule sheet as raw array data
  const result = await agent.read({
    sheet: 'Schedule',
    range: 'A1:I40',
    format: 'array',
  });

  console.log('=== SCHEDULE SHEET ANALYSIS ===\n');
  
  // Row 1 is the instruction header
  console.log('Row 1 (Instructions):', result.rows[0]);
  
  // Row 2 is the actual column headers
  const headers = result.rows[1] as any[];
  console.log('\nRow 2 (Column Headers):', headers);
  console.log('\nParsed Headers:');
  headers.forEach((header, index) => {
    if (header) {
      console.log('  Column ' + String.fromCharCode(65 + index) + ': ' + header);
    }
  });

  console.log('\n=== TEACHER ASSIGNMENTS ===\n');
  
  // Process data rows (starting from row 3, index 2)
  const dataRows = result.rows.slice(2);
  
  dataRows.forEach((row: any, index: number) => {
    const rowNum = index + 3; // Actual row number in sheet
    const classDate = row[0];
    const weekRange = row[1];
    const reading = row[2];
    const lesson = row[3];
    const swahili = row[4];
    const french = row[5];
    const youthA = row[6];
    const youthB = row[7];
    const templePrep = row[8];
    
    // Skip empty rows or section headers
    if (!weekRange || weekRange === 'Week') return;
    
    // Check if there are any teacher assignments
    const hasTeachers = swahili || french || youthA || youthB || templePrep;
    
    if (classDate || hasTeachers) {
      console.log('----------------------------------------');
      if (classDate) {
        console.log('Class Date: ' + classDate);
      }
      console.log('Week: ' + weekRange);
      console.log('Reading: ' + (reading || 'N/A'));
      console.log('Lesson: ' + (lesson || 'N/A'));
      
      if (hasTeachers) {
        console.log('\nTeachers Assigned:');
        if (swahili) console.log('  Swahili (RS Room): ' + swahili);
        if (french) console.log('  French (PH Room): ' + french);
        if (youthA) console.log('  Youth A 12-15yo (201): ' + youthA);
        if (youthB) console.log('  Youth B 15-18yo: ' + youthB);
        if (templePrep) console.log('  Temple Prep: ' + templePrep);
      }
      console.log('');
    }
  });
  
  console.log('=== SUMMARY ===\n');
  
  // Count teacher assignments
  let assignmentCount = 0;
  const teacherCounts: Record<string, number> = {};
  
  dataRows.forEach((row: any) => {
    const teachers = [row[4], row[5], row[6], row[7], row[8]].filter(Boolean);
    teachers.forEach((teacher: string) => {
      assignmentCount++;
      teacherCounts[teacher] = (teacherCounts[teacher] || 0) + 1;
    });
  });
  
  console.log('Total assignments: ' + assignmentCount);
  console.log('\nTeacher assignment counts:');
  Object.entries(teacherCounts).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
    console.log('  ' + name + ': ' + count);
  });
}

analyzeSchedule().catch((error: any) => {
  console.error('Error:', error.message);
  process.exit(1);
});
