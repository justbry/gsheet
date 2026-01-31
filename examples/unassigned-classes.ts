/**
 * Unassigned Classes Example
 *
 * This example demonstrates how to use gsheet to:
 * 1. Read data from a "Schedule" sheet
 * 2. Find all classes that don't have a teacher assigned (empty cell)
 * 3. Filter for classes scheduled in the next 3 months
 *
 * Works with schedule sheets that have:
 * - A date column (dates like "1/15", "2/20", or full dates)
 * - Multiple class columns where empty cells = no teacher assigned
 *
 * Run: bun examples/unassigned-classes.ts
 */

import { SheetAgent, ValidationError, AuthError } from '../src/index';

// Configuration
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || 'your-spreadsheet-id-here';
const MONTHS_AHEAD = parseInt(process.env.MONTHS_AHEAD || '3', 10);

// Represents an unassigned class slot
interface UnassignedClass {
  date: Date;
  dateStr: string;
  className: string;
  week?: string;
  lesson?: string;
}

async function main() {
  console.log(`🔍 Finding Unassigned Classes for Next ${MONTHS_AHEAD} Months\n`);

  const agent = new SheetAgent({
    spreadsheetId: SPREADSHEET_ID,
    defaultFormat: 'array',
  });

  try {
    // ─────────────────────────────────────────────────────────────────────
    // 1. READ THE SCHEDULE SHEET (as raw array to handle flexible structure)
    // ─────────────────────────────────────────────────────────────────────
    console.log('📖 Reading Schedule sheet...');

    const scheduleData = await agent.read({
      sheet: 'Schedule',
      format: 'array',
    });

    const rows = scheduleData.rows as unknown[][];
    console.log(`   Found ${rows.length} total rows\n`);

    if (rows.length < 3) {
      console.log('⚠️  Not enough data in the Schedule sheet');
      return;
    }

    // ─────────────────────────────────────────────────────────────────────
    // 2. DETECT HEADER ROW AND CLASS COLUMNS
    // ─────────────────────────────────────────────────────────────────────
    // Find the header row - look for row where a cell exactly matches "Week" or "Date"
    let headerRowIndex = -1;
    let headers: string[] = [];

    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i];
      if (!row) continue;

      // Check if any cell is exactly "Week" or "Date" (common header values)
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
      // Default to row 1 (0-indexed) if no header found
      headerRowIndex = 1;
      headers = (rows[1] ?? []).map(c => String(c ?? '').trim());
    }

    console.log(`📋 Headers (row ${headerRowIndex + 1}): ${headers.filter(h => h).join(', ')}\n`);

    // Find class columns (columns after the first few metadata columns)
    // Skip columns like: empty, Week, Reading, Lessons (these contain metadata, not teacher names)
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

    console.log(`📚 Class columns found: ${classColumns.map(c => c.name).join(', ')}\n`);

    // ─────────────────────────────────────────────────────────────────────
    // 3. CALCULATE DATE RANGE
    // ─────────────────────────────────────────────────────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + MONTHS_AHEAD);

    console.log(`📅 Date range: ${formatDate(today)} to ${formatDate(endDate)}\n`);

    // ─────────────────────────────────────────────────────────────────────
    // 4. FIND UNASSIGNED CLASSES IN DATE RANGE
    // ─────────────────────────────────────────────────────────────────────
    console.log('🔎 Scanning for unassigned classes...\n');

    const unassignedClasses: UnassignedClass[] = [];
    const dataRows = rows.slice(headerRowIndex + 1);

    // Find Week column index for context
    const weekColIndex = headers.findIndex(h => h.toLowerCase().includes('week'));
    const lessonColIndex = headers.findIndex(h => h.toLowerCase().includes('lesson'));

    for (const row of dataRows) {
      if (!row) continue;

      // Get date from first column (or first non-empty cell)
      const dateVal = row[0];
      const classDate = parseDate(dateVal);

      // Skip rows without valid dates or outside range
      if (!classDate) continue;
      if (classDate < today || classDate > endDate) continue;

      // Get week and lesson for context
      const week = weekColIndex >= 0 ? String(row[weekColIndex] ?? '') : '';
      const lesson = lessonColIndex >= 0 ? String(row[lessonColIndex] ?? '') : '';

      // Check each class column for empty cells (no teacher assigned)
      for (const col of classColumns) {
        const teacherName = String(row[col.index] ?? '').trim();
        if (!teacherName) {
          unassignedClasses.push({
            date: classDate,
            dateStr: String(dateVal),
            className: col.name,
            week,
            lesson,
          });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 5. DISPLAY RESULTS
    // ─────────────────────────────────────────────────────────────────────
    if (unassignedClasses.length === 0) {
      console.log(`✅ All classes have teachers assigned for the next ${MONTHS_AHEAD} months!`);
      return;
    }

    // Sort by date
    unassignedClasses.sort((a, b) => a.date.getTime() - b.date.getTime());

    console.log(`⚠️  Found ${unassignedClasses.length} unassigned class slot(s):\n`);
    console.log('┌──────────────────────────────────────────────────────────────────┐');

    // Group by date for cleaner display
    let currentDate = '';
    for (const cls of unassignedClasses) {
      const dateStr = formatDate(cls.date);
      if (dateStr !== currentDate) {
        if (currentDate) console.log('│');
        console.log(`│  📅 ${dateStr} (${cls.week || cls.dateStr})`);
        currentDate = dateStr;
      }
      const lessonInfo = cls.lesson ? ` - ${cls.lesson}` : '';
      console.log(`│     ❌ ${cls.className}${lessonInfo}`);
    }

    console.log('│');
    console.log('└──────────────────────────────────────────────────────────────────┘\n');

    // ─────────────────────────────────────────────────────────────────────
    // 6. SUMMARY
    // ─────────────────────────────────────────────────────────────────────
    // Count total class slots in range
    let totalSlots = 0;
    for (const row of dataRows) {
      if (!row) continue;
      const classDate = parseDate(row[0]);
      if (!classDate || classDate < today || classDate > endDate) continue;
      totalSlots += classColumns.length;
    }

    const assignedCount = totalSlots - unassignedClasses.length;
    const percentage = totalSlots > 0
      ? Math.round((assignedCount / totalSlots) * 100)
      : 100;

    console.log('📊 Summary:');
    console.log(`   Total class slots in next ${MONTHS_AHEAD} months: ${totalSlots}`);
    console.log(`   Assigned: ${assignedCount} (${percentage}%)`);
    console.log(`   Unassigned: ${unassignedClasses.length} (${100 - percentage}%)\n`);

    console.log('✅ Analysis complete!');
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

/**
 * Parse a date value from Google Sheets
 * Handles: ISO strings, serial numbers (Google Sheets date format), Date objects,
 * and partial dates like "1/15" or "10/5" (assumes current/next year)
 */
function parseDate(value: unknown): Date | null {
  if (!value) return null;

  // Already a Date object
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // Google Sheets serial number (days since Dec 30, 1899)
  if (typeof value === 'number') {
    // Google Sheets epoch starts at Dec 30, 1899
    const sheetsEpoch = new Date(1899, 11, 30);
    const date = new Date(sheetsEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }

  // String date - try parsing
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Parse MM/DD or MM/DD/YYYY format first (handles "9/7", "10/15", etc.)
    const parts = trimmed.split(/[\/\-]/);

    if (parts.length === 2) {
      // MM/DD format - determine year intelligently
      const [month, day] = parts.map(Number);
      if (month && day && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const now = new Date();
        let year = now.getFullYear();

        // If the date would be more than 2 months in the past, assume next year
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
      // MM/DD/YYYY format
      const [month, day, year] = parts.map(Number);
      if (month && day && year) {
        // Handle 2-digit years
        const fullYear = year < 100 ? 2000 + year : year;
        const date = new Date(fullYear, month - 1, day);
        if (!isNaN(date.getTime())) return date;
      }
    }

    // Try ISO format for full date strings (e.g., "2026-01-15")
    const date = new Date(trimmed);
    if (!isNaN(date.getTime()) && date.getFullYear() > 2000) {
      return date;
    }
  }

  return null;
}

/**
 * Format a date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

main();
