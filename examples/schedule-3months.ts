/**
 * 3-Month Class Scheduling Workflow Example
 *
 * This example demonstrates how to use g-sheet-agent-io to run the
 * 3-month class scheduling workflow that:
 * 1. Scans the Schedule sheet for unassigned slots in next 3 months
 * 2. Reads Teachers sheet to find compatible teachers
 * 3. Generates assignment suggestions based on language and rotation rules
 * 4. Asks for confirmation before applying changes
 * 5. Updates Schedule sheet with approved assignments
 * 6. Logs all decisions to HISTORY sheet
 *
 * Prerequisites:
 * - AGENT_BASE sheet with 3-month scheduling workflow prompt
 * - Schedule sheet with dates and class columns
 * - Teachers sheet with Name, Languages, Notes columns
 *
 * Run: bun examples/schedule-3months.ts
 */

import { SheetAgent, ValidationError, AuthError } from '../src/index';

// Configuration
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || 'your-spreadsheet-id-here';
const MONTHS_AHEAD = 3;

// Date parsing utility (handles multiple formats)
function parseDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    // Google Sheets serial number (days since Dec 30, 1899)
    const sheetsEpoch = new Date(1899, 11, 30);
    const date = new Date(sheetsEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const parts = trimmed.split(/[\/\-]/);

    if (parts.length === 2) {
      const [month, day] = parts.map(Number);
      if (month && day && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const now = new Date();
        let year = now.getFullYear();

        let date = new Date(year, month - 1, day);
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        if (date < twoMonthsAgo) {
          year++;
          date = new Date(year, month - 1, day);
        }

        if (!isNaN(date.getTime())) return date;
      }
    }

    if (parts.length === 3) {
      const [month, day, year] = parts.map(Number);
      if (month && day && year) {
        const fullYear = year < 100 ? 2000 + year : year;
        const date = new Date(fullYear, month - 1, day);
        if (!isNaN(date.getTime())) return date;
      }
    }

    const date = new Date(trimmed);
    if (!isNaN(date.getTime()) && date.getFullYear() > 2000) {
      return date;
    }
  }

  return null;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

// Extract language from class name
function extractClassLanguage(className: string): string {
  const languagePattern = /^(Swahili|French|Tagalog|Spanish)/i;
  const match = className.match(languagePattern);
  return match ? match[1] : 'English';
}

// Interfaces
interface UnassignedSlot {
  date: Date;
  dateStr: string;
  className: string;
  week?: string;
  lesson?: string;
  columnIndex: number;
  rowIndex: number;
}

interface Teacher {
  name: string;
  languages: string[];
  notes: string;
  active: boolean;
}

interface AssignmentSuggestion {
  slot: UnassignedSlot;
  suggestedTeacher: string | null;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  warnings?: string[];
  alternativeTeachers?: string[];
}

async function main() {
  console.log(`🗓️  3-Month Class Scheduling Workflow\n`);

  const agent = new SheetAgent({
    spreadsheetId: SPREADSHEET_ID,
    defaultFormat: 'array',
  });

  try {
    // ─────────────────────────────────────────────────────────────────────
    // STEP 1: Calculate Date Range
    // ─────────────────────────────────────────────────────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + MONTHS_AHEAD);

    console.log(`📅 Date Range: ${formatDate(today)} to ${formatDate(endDate)}\n`);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 2: Read Schedule Sheet
    // ─────────────────────────────────────────────────────────────────────
    console.log('📖 Reading Schedule sheet...');
    const scheduleData = await agent.readWithContext({
      sheet: 'Schedule',
      format: 'array',
      purpose: 'Scan 3-month schedule for gaps',
      goalId: 'quarterly_scheduling',
    });

    const rows = scheduleData.rows as unknown[][];
    console.log(`   Found ${rows.length} total rows\n`);

    // Detect header row
    let headerRowIndex = -1;
    let headers: string[] = [];

    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i];
      if (!row) continue;

      const hasHeaderCell = row.some((cell) => {
        const val = String(cell ?? '').trim().toLowerCase();
        return val === 'week' || val === 'date' || val === 'class' || val === 'teacher';
      });

      if (hasHeaderCell) {
        headerRowIndex = i;
        headers = row.map(c => String(c ?? '').trim());
        break;
      }
    }

    if (headerRowIndex === -1) {
      headerRowIndex = 1;
      headers = (rows[1] ?? []).map(c => String(c ?? '').trim());
    }

    console.log(`📋 Headers (row ${headerRowIndex + 1}): ${headers.filter(h => h).join(', ')}\n`);

    // Identify class columns
    const metadataKeywords = ['week', 'reading', 'lessons', 'lesson', 'date', ''];
    const classColumns: { index: number; name: string }[] = [];

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i]?.toLowerCase() ?? '';
      const isMetadata = metadataKeywords.some(kw =>
        header === kw || header.startsWith('reading') || header.startsWith('lesson')
      );
      if (!isMetadata && headers[i]) {
        classColumns.push({ index: i, name: headers[i]! });
      }
    }

    console.log(`📚 Class columns: ${classColumns.map(c => c.name).join(', ')}\n`);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 3: Identify Unassigned Slots
    // ─────────────────────────────────────────────────────────────────────
    console.log('🔎 Scanning for unassigned slots...\n');

    const unassignedSlots: UnassignedSlot[] = [];
    const dataRows = rows.slice(headerRowIndex + 1);

    const weekColIndex = headers.findIndex(h => h.toLowerCase().includes('week'));
    const lessonColIndex = headers.findIndex(h => h.toLowerCase().includes('lesson'));

    let totalSlots = 0;

    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const row = dataRows[rowIdx];
      if (!row) continue;

      const dateVal = row[0];
      const classDate = parseDate(dateVal);

      if (!classDate) continue;
      if (classDate < today || classDate > endDate) continue;

      const week = weekColIndex >= 0 ? String(row[weekColIndex] ?? '') : '';
      const lesson = lessonColIndex >= 0 ? String(row[lessonColIndex] ?? '') : '';

      for (const col of classColumns) {
        totalSlots++;
        const teacherName = String(row[col.index] ?? '').trim();
        if (!teacherName) {
          unassignedSlots.push({
            date: classDate,
            dateStr: String(dateVal),
            className: col.name,
            week,
            lesson,
            columnIndex: col.index,
            rowIndex: headerRowIndex + 1 + rowIdx,
          });
        }
      }
    }

    const assignedCount = totalSlots - unassignedSlots.length;
    const percentage = totalSlots > 0 ? Math.round((assignedCount / totalSlots) * 100) : 100;

    console.log(`📊 Found ${unassignedSlots.length} unassigned slots out of ${totalSlots} total (${percentage}% coverage)\n`);

    if (unassignedSlots.length === 0) {
      console.log('✅ All classes have teachers assigned for the next 3 months!');
      return;
    }

    // ─────────────────────────────────────────────────────────────────────
    // STEP 4: Read Teachers Sheet
    // ─────────────────────────────────────────────────────────────────────
    console.log('👥 Reading Teachers sheet...');
    const teachersData = await agent.readWithContext({
      sheet: 'Teachers',
      format: 'array',
      purpose: 'Load teacher availability and languages',
      goalId: 'quarterly_scheduling',
    });

    const teacherRows = teachersData.rows as unknown[][];
    const teacherHeaders = (teacherRows[0] ?? []).map(h => String(h ?? '').trim().toLowerCase());

    const nameColIdx = teacherHeaders.findIndex(h => h.includes('name'));
    const langColIdx = teacherHeaders.findIndex(h => h.includes('language'));
    const notesColIdx = teacherHeaders.findIndex(h => h.includes('note'));

    const teachers: Teacher[] = [];
    for (let i = 1; i < teacherRows.length; i++) {
      const row = teacherRows[i];
      if (!row) continue;

      const name = String(row[nameColIdx] ?? '').trim();
      if (!name) continue;

      const languagesStr = String(row[langColIdx] ?? '').trim();
      const languages = languagesStr.split(',').map(l => l.trim()).filter(l => l);

      const notes = String(row[notesColIdx] ?? '').trim();
      const active = !notes.toLowerCase().includes('inactive') &&
                     !notes.toLowerCase().includes('unavailable');

      teachers.push({ name, languages, notes, active });
    }

    console.log(`   Found ${teachers.length} teachers (${teachers.filter(t => t.active).length} active)\n`);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 5: Generate Assignment Suggestions
    // ─────────────────────────────────────────────────────────────────────
    console.log('💡 Generating assignment suggestions...\n');

    const suggestions: AssignmentSuggestion[] = [];
    const teacherWorkload: Record<string, number> = {};

    // Initialize workload tracking
    teachers.forEach(t => { teacherWorkload[t.name] = 0; });

    for (const slot of unassignedSlots) {
      const classLanguage = extractClassLanguage(slot.className);

      // Find compatible teachers
      const compatibleTeachers = teachers.filter(t =>
        t.active &&
        t.languages.some(lang => lang.toLowerCase() === classLanguage.toLowerCase())
      );

      if (compatibleTeachers.length === 0) {
        suggestions.push({
          slot,
          suggestedTeacher: null,
          reason: `No active teachers available who speak ${classLanguage}`,
          confidence: 'low',
        });
        continue;
      }

      // Rank by workload (prefer balanced distribution)
      compatibleTeachers.sort((a, b) => {
        const workloadDiff = (teacherWorkload[a.name] || 0) - (teacherWorkload[b.name] || 0);
        if (workloadDiff !== 0) return workloadDiff;
        return a.name.localeCompare(b.name);
      });

      const suggested = compatibleTeachers[0]!;
      teacherWorkload[suggested.name] = (teacherWorkload[suggested.name] || 0) + 1;

      const workload = teacherWorkload[suggested.name] || 0;
      const warnings: string[] = [];
      let confidence: 'high' | 'medium' | 'low' = 'high';

      if (workload > 6) {
        warnings.push(`Heavy workload (${workload} assignments in 3 months)`);
        confidence = 'medium';
      }

      suggestions.push({
        slot,
        suggestedTeacher: suggested.name,
        reason: `Speaks ${classLanguage}, balanced workload (${workload} assignments)`,
        confidence,
        warnings: warnings.length > 0 ? warnings : undefined,
        alternativeTeachers: compatibleTeachers.slice(1, 3).map(t => t.name),
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // STEP 6: Generate Summary Report
    // ─────────────────────────────────────────────────────────────────────
    console.log('📄 Generating summary report...\n');
    console.log('═'.repeat(70));
    console.log(`  3-MONTH CLASS SCHEDULE ANALYSIS`);
    console.log(`  Date Range: ${formatDate(today)} to ${formatDate(endDate)}`);
    console.log(`  Generated: ${new Date().toISOString()}`);
    console.log('═'.repeat(70));
    console.log();

    // Section A: Summary Statistics
    console.log('## SUMMARY STATISTICS');
    console.log(`   Total class slots in range: ${totalSlots}`);
    console.log(`   Assigned: ${assignedCount} (${percentage}%)`);
    console.log(`   Unassigned: ${unassignedSlots.length} (${100 - percentage}%)`);
    console.log();

    // Section B: Suggested Assignments
    const fillableSlots = suggestions.filter(s => s.suggestedTeacher !== null);
    console.log(`## SUGGESTED ASSIGNMENTS (${fillableSlots.length} suggestions)`);
    console.log();

    let currentDate = '';
    for (const suggestion of fillableSlots) {
      const dateStr = formatDate(suggestion.slot.date);
      if (dateStr !== currentDate) {
        if (currentDate) console.log();
        console.log(`### 📅 ${dateStr} (${suggestion.slot.week || suggestion.slot.dateStr})`);
        currentDate = dateStr;
      }

      const confidence = suggestion.confidence === 'high' ? '✅' :
                        suggestion.confidence === 'medium' ? '⚠️' : '❓';

      console.log(`   ${confidence} **${suggestion.slot.className}** → ${suggestion.suggestedTeacher}`);
      console.log(`      Reason: ${suggestion.reason}`);
      if (suggestion.warnings && suggestion.warnings.length > 0) {
        suggestion.warnings.forEach(w => console.log(`      ⚠️  Warning: ${w}`));
      }
      if (suggestion.alternativeTeachers && suggestion.alternativeTeachers.length > 0) {
        console.log(`      Alternatives: ${suggestion.alternativeTeachers.join(', ')}`);
      }
    }
    console.log();

    // Section C: Unable to Fill
    const unfillableSlots = suggestions.filter(s => s.suggestedTeacher === null);
    if (unfillableSlots.length > 0) {
      console.log(`## UNABLE TO FILL (${unfillableSlots.length} slots)`);
      console.log();

      currentDate = '';
      for (const suggestion of unfillableSlots) {
        const dateStr = formatDate(suggestion.slot.date);
        if (dateStr !== currentDate) {
          if (currentDate) console.log();
          console.log(`### 📅 ${dateStr} (${suggestion.slot.week || suggestion.slot.dateStr})`);
          currentDate = dateStr;
        }

        console.log(`   ❌ **${suggestion.slot.className}**`);
        console.log(`      Reason: ${suggestion.reason}`);
      }
      console.log();
    }

    // Section D: Teacher Workload Preview
    console.log('## TEACHER WORKLOAD DISTRIBUTION');
    console.log();
    const workloadEntries = Object.entries(teacherWorkload)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);

    for (const [name, count] of workloadEntries) {
      const flag = count > 6 ? ' ⚠️ OVERLOADED' : '';
      console.log(`   ${name}: ${count} assignments${flag}`);
    }
    console.log();
    console.log('═'.repeat(70));
    console.log();

    // ─────────────────────────────────────────────────────────────────────
    // STEP 7: Ask for Confirmation
    // ─────────────────────────────────────────────────────────────────────
    console.log(`✋ CONFIRMATION REQUIRED`);
    console.log(`   Do you want to apply these ${fillableSlots.length} suggested assignments?`);
    console.log(`   (This is a demo - actual implementation would prompt user)`);
    console.log();

    // In actual implementation, this would use an interactive prompt
    // For now, we'll just demonstrate the structure
    const userConfirmed = false; // Set to true to actually apply

    if (!userConfirmed) {
      console.log('❌ Cancelled by user (demo mode)\n');

      // Log to HISTORY even when cancelled
      await agent.logAction({
        action: 'schedule_classes_3months',
        input: {
          dateRange: { start: formatDate(today), end: formatDate(endDate) },
          totalSlots,
          unassignedSlots: unassignedSlots.length,
          teachersAvailable: teachers.filter(t => t.active).length,
        },
        output: {
          suggestionsGenerated: suggestions.length,
          applicationType: 'cancelled',
          updatesApplied: 0,
          unableToFill: unfillableSlots.length,
        },
        status: 'cancelled',
        goalId: 'quarterly_scheduling',
      });

      console.log('📊 Logged to HISTORY sheet');
      return;
    }

    // ─────────────────────────────────────────────────────────────────────
    // STEP 8: Update Schedule Sheet (if confirmed)
    // ─────────────────────────────────────────────────────────────────────
    console.log('💾 Applying assignments to Schedule sheet...\n');

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Note: Actual implementation would batch these updates
    // For demo purposes, we're just showing the structure

    console.log('✅ Updates applied (demo - no actual writes performed)\n');

    // ─────────────────────────────────────────────────────────────────────
    // STEP 9: Log to HISTORY
    // ─────────────────────────────────────────────────────────────────────
    await agent.logAction({
      action: 'schedule_classes_3months',
      input: {
        dateRange: { start: formatDate(today), end: formatDate(endDate) },
        totalSlots,
        unassignedSlots: unassignedSlots.length,
        teachersAvailable: teachers.filter(t => t.active).length,
      },
      output: {
        suggestionsGenerated: suggestions.length,
        applicationType: 'demo',
        updatesApplied: successCount,
        updatesSkipped: skipCount,
        updatesErrored: errorCount,
        unableToFill: unfillableSlots.length,
        teacherWorkload,
      },
      status: 'completed',
      goalId: 'quarterly_scheduling',
    });

    // ─────────────────────────────────────────────────────────────────────
    // STEP 10: Return Summary
    // ─────────────────────────────────────────────────────────────────────
    console.log('✅ 3-MONTH SCHEDULING COMPLETE\n');
    console.log(`   Suggestions generated: ${fillableSlots.length}`);
    console.log(`   Unable to fill: ${unfillableSlots.length}`);
    console.log(`   Remaining unassigned: ${unfillableSlots.length}`);
    console.log();
    console.log('📊 View full details in HISTORY sheet');

  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('❌ Validation Error:', error.message);
      console.error('   Fix:', error.fix);
    } else if (error instanceof AuthError) {
      console.error('❌ Auth Error:', error.message);
      console.error('   Make sure CREDENTIALS_CONFIG env var is set');
    } else {
      throw error;
    }
  }
}

main();
