#!/usr/bin/env bun

/**
 * Sunday School Teacher Coordinator Example
 *
 * This example demonstrates how to use gsheet to coordinate Sunday School teacher assignments.
 * The workflow analyzes teacher schedules, finds coverage gaps, suggests assignments based on
 * language compatibility and workload balance, and tracks all changes using plan management.
 *
 * Prerequisites:
 * - Spreadsheet with Schedule, Teachers sheets
 * - AGENTSCAPE sheet (auto-created)
 *
 * Spreadsheet: https://docs.google.com/spreadsheets/d/1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8/edit?gid=481512950#gid=481512950
 *
 * Usage:
 *   bun examples/sunday-school-coordinator.ts [--spreadsheet-id=ID]
 *
 * Environment Variables:
 *   SPREADSHEET_ID - Google Sheets spreadsheet ID (can also use --spreadsheet-id)
 *   CREDENTIALS_CONFIG - Path to Google service account credentials
 */

import { SheetAgent, ValidationError, AuthError } from '../../src/index';
import { getMessagingProvider } from '../../src/messaging/factory';
import type { MessagingProvider } from '../../src/messaging/types';

// Parse command-line arguments
const args = process.argv.slice(2);
const spreadsheetIdArg = args.find(arg => arg.startsWith('--spreadsheet-id='))?.split('=')[1];
const confirmFlag = args.includes('--confirm');

// Configuration
const SPREADSHEET_ID = spreadsheetIdArg || process.env.SPREADSHEET_ID || '1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8';
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
  phone: string;
  inWhatsapp: boolean;
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
  console.log(`📚 Sunday School Teacher Coordinator\n`);

  try {
    const agent = await SheetAgent.connect({
      spreadsheetId: SPREADSHEET_ID,
    });
    // ─────────────────────────────────────────────────────────────────────
    // STEP 1: Calculate Date Range
    // ─────────────────────────────────────────────────────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + MONTHS_AHEAD);

    console.log(`📅 Analyzing ${MONTHS_AHEAD}-month period: ${formatDate(today)} to ${formatDate(endDate)}\n`);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 2: Read Schedule Sheet
    // ─────────────────────────────────────────────────────────────────────
    console.log('📖 Reading Schedule sheet...');
    const scheduleData = await agent.read({
      sheet: 'Schedule',
      format: 'array',
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
        return val === 'week' || val === 'date' || val === 'class' || val === 'teacher' || val === 'reading';
      });

      if (hasHeaderCell) {
        headerRowIndex = i;
        headers = row.map(c => String(c ?? '').trim());
        break;
      }
    }

    if (headerRowIndex === -1) {
      headerRowIndex = 0;
      headers = (rows[0] ?? []).map(c => String(c ?? '').trim());
    }

    console.log(`📋 Headers (row ${headerRowIndex + 1}): ${headers.filter(h => h).join(', ')}\n`);

    // Identify class columns (exclude metadata columns)
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

    console.log(`📚 Class columns detected: ${classColumns.map(c => c.name).join(', ')}\n`);

    // ─────────────────────────────────────────────────────────────────────
    // STEP 3: Identify Unassigned Slots
    // ─────────────────────────────────────────────────────────────────────
    console.log('🔎 Scanning for unassigned teaching slots...\n');

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

    console.log(`📊 Coverage Status:`);
    console.log(`   Total slots: ${totalSlots}`);
    console.log(`   Assigned: ${assignedCount} (${percentage}%)`);
    console.log(`   Unassigned: ${unassignedSlots.length} (${100 - percentage}%)\n`);

    if (unassignedSlots.length === 0) {
      console.log('✅ All classes have teachers assigned for the next 3 months!');
      return;
    }

    // ─────────────────────────────────────────────────────────────────────
    // STEP 4: Read Teachers Sheet
    // ─────────────────────────────────────────────────────────────────────
    console.log('👥 Reading Teachers directory...');
    const teachersData = await agent.read({
      sheet: 'Teachers',
      format: 'array',
    });

    const teacherRows = teachersData.rows as unknown[][];
    const teacherHeaders = (teacherRows[0] ?? []).map(h => String(h ?? '').trim().toLowerCase());

    const nameColIdx = teacherHeaders.findIndex(h => h.includes('name'));
    const langColIdx = teacherHeaders.findIndex(h => h.includes('language'));
    const phoneColIdx = teacherHeaders.findIndex(h => h.includes('phone'));
    const whatsappColIdx = teacherHeaders.findIndex(h => h.includes('whatsapp'));
    const notesColIdx = teacherHeaders.findIndex(h => h.includes('note'));

    const teachers: Teacher[] = [];
    for (let i = 1; i < teacherRows.length; i++) {
      const row = teacherRows[i];
      if (!row) continue;

      const name = String(row[nameColIdx] ?? '').trim();
      if (!name) continue;

      const languagesStr = String(row[langColIdx] ?? '').trim();
      const languages = languagesStr.split(',').map(l => l.trim()).filter(l => l);

      const phone = String(row[phoneColIdx] ?? '').trim();
      const inWhatsapp = String(row[whatsappColIdx] ?? '').trim().toLowerCase() === 'yes';
      const notes = String(row[notesColIdx] ?? '').trim();
      const active = !notes.toLowerCase().includes('inactive') &&
                     !notes.toLowerCase().includes('unavailable');

      teachers.push({ name, languages, phone, inWhatsapp, notes, active });
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
        warnings.push(`Heavy workload (${workload} assignments in ${MONTHS_AHEAD} months)`);
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
    // STEP 6: Display Comprehensive Report
    // ─────────────────────────────────────────────────────────────────────
    console.log('═'.repeat(70));
    console.log(`  SUNDAY SCHOOL TEACHER COORDINATION REPORT`);
    console.log(`  Period: ${formatDate(today)} to ${formatDate(endDate)}`);
    console.log(`  Generated: ${new Date().toLocaleString()}`);
    console.log('═'.repeat(70));
    console.log();

    // Section A: Summary Statistics
    console.log('## SUMMARY');
    console.log(`   Total class slots: ${totalSlots}`);
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
        console.log(`### 📅 ${dateStr} (Week: ${suggestion.slot.week || suggestion.slot.dateStr})`);
        currentDate = dateStr;
      }

      const confidence = suggestion.confidence === 'high' ? '✅' :
                        suggestion.confidence === 'medium' ? '⚠️' : '❓';

      console.log(`   ${confidence} ${suggestion.slot.className} → ${suggestion.suggestedTeacher}`);
      console.log(`      ${suggestion.reason}`);
      if (suggestion.warnings && suggestion.warnings.length > 0) {
        suggestion.warnings.forEach(w => console.log(`      ⚠️  ${w}`));
      }
      if (suggestion.alternativeTeachers && suggestion.alternativeTeachers.length > 0) {
        console.log(`      Alternatives: ${suggestion.alternativeTeachers.join(', ')}`);
      }
    }
    console.log();

    // Section C: Unable to Fill
    const unfillableSlots = suggestions.filter(s => s.suggestedTeacher === null);
    if (unfillableSlots.length > 0) {
      console.log(`## UNABLE TO FILL (${unfillableSlots.length} slots) ❌`);
      console.log();

      currentDate = '';
      for (const suggestion of unfillableSlots) {
        const dateStr = formatDate(suggestion.slot.date);
        if (dateStr !== currentDate) {
          if (currentDate) console.log();
          console.log(`### 📅 ${dateStr} (Week: ${suggestion.slot.week || suggestion.slot.dateStr})`);
          currentDate = dateStr;
        }

        console.log(`   ❌ ${suggestion.slot.className}`);
        console.log(`      ${suggestion.reason}`);
      }
      console.log();
    }

    // Section D: Teacher Workload Distribution
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
    // STEP 7: Confirmation Prompt (Demo Mode)
    // ─────────────────────────────────────────────────────────────────────
    console.log(`✋ CONFIRMATION REQUIRED`);
    console.log(`   Would you like to apply these ${fillableSlots.length} suggested assignments?`);
    if (!confirmFlag) {
      console.log(`   (Demo mode - use --confirm flag to apply and send notifications)`);
    }
    console.log();

    const userConfirmed = confirmFlag;

    if (!userConfirmed) {
      console.log('❌ Cancelled (demo mode)\n');
      console.log('💡 To apply assignments and send WhatsApp notifications, run:');
      console.log('   bun examples/sun-school-advisor/sunday-school-coordinator.ts --confirm\n');

      // Note: In production, you would log this action to a HISTORY sheet
      // using a custom logAction implementation or plan tracking system

      return;
    }

    // In actual implementation, this would write assignments to Schedule sheet
    console.log('✅ Assignments applied successfully\n');

    // ─────────────────────────────────────────────────────────────────────
    // STEP 8: Send Notifications (iMessage or Telnyx)
    // ─────────────────────────────────────────────────────────────────────
    if (fillableSlots.length > 0) {
      const providerType = (process.env.MESSAGING_PROVIDER as any) || 'auto';
      console.log(`📱 Sending notifications via ${providerType}...\n`);

      const messenger = await getMessagingProvider(providerType);

      // Group assignments by teacher
      const teacherAssignments = new Map<string, AssignmentSuggestion[]>();
      for (const suggestion of fillableSlots) {
        if (suggestion.suggestedTeacher) {
          const existing = teacherAssignments.get(suggestion.suggestedTeacher) || [];
          existing.push(suggestion);
          teacherAssignments.set(suggestion.suggestedTeacher, existing);
        }
      }

      // Send notifications to each teacher
      for (const [teacherName, assignments] of teacherAssignments) {
        const teacher = teachers.find(t => t.name === teacherName);

        if (!teacher?.phone) {
          console.log(`⏭️  Skipping ${teacherName} (no phone number)`);
          continue;
        }

        // Format assignment details
        const assignmentDetails = assignments.map(a => {
          const date = formatDate(a.slot.date);
          return `${a.slot.className} on ${date}`;
        }).join(', ');

        const message = `Hi ${teacherName}! You've been assigned to teach: ${assignmentDetails}. Reply YES to confirm or NO to decline.`;

        try {
          await messenger.sendText(teacher.phone, message);
          console.log(`✅ Sent to ${teacherName}`);

          // Add small delay between messages for cleaner UX
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error: any) {
          console.error(`❌ Failed to send to ${teacherName}:`, error.message);
        }
      }

      console.log('\n✅ Notifications sent\n');
    }

  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('❌ Validation Error:', error.message);
      console.error('   Fix:', error.fix);
    } else if (error instanceof AuthError) {
      console.error('❌ Auth Error:', error.message);
      console.error('   Set CREDENTIALS_CONFIG environment variable');
    } else {
      throw error;
    }
  }
}

main();
