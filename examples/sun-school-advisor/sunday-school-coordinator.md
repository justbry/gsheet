# Sunday School Teacher Coordinator

A complete workflow example demonstrating how to use gsheet to coordinate Sunday School teacher assignments. This example shows plan-based coordination with contextual analysis, intelligent matching, and comprehensive reporting.

## What This Demonstrates

- **Contextual Reading**: Reading multiple sheets with purpose tracking
- **Date Parsing**: Robust handling of Google Sheets date formats
- **Intelligent Matching**: Language-based teacher assignment with workload balancing
- **Action Logging**: Tracking workflow execution in HISTORY sheet
- **Error Handling**: Graceful handling of missing data and edge cases

## Spreadsheet Structure

**Existing Spreadsheet**: https://docs.google.com/spreadsheets/d/1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8/edit?gid=481512950#gid=481512950

### Required Sheets

#### 1. Schedule
Weekly class schedule with columns:
- **Date** - Class date (various formats supported)
- **Week** - Week identifier
- **Reading** - Reading assignment
- **Lessons** - Lesson topic
- **Class columns** - Swahili, French, Youth A, Youth B, Temple Prep (teacher names)

#### 2. Teachers
Teacher directory with columns:
- **Name** - Teacher full name
- **Phone Number** - Contact number
- **In Whatsapp Group** - Yes/No
- **Languages** - Comma-separated languages (e.g., "Swahili, English")
- **Notes** - Availability notes (use "inactive" or "unavailable" to exclude)

#### 3. AGENTSCAPE (Auto-created)
Agent context, plan storage, and file system

## How It Works

### Step 1: Date Range Calculation
Calculates a 3-month window from today's date.

### Step 2: Schedule Analysis
- Reads Schedule sheet
- Detects header row automatically
- Identifies class columns (excludes metadata like Week, Reading, Lessons)
- Scans for empty cells (unassigned slots)

### Step 3: Teacher Matching
- Reads Teachers directory
- Parses languages for each teacher
- Filters out inactive teachers
- Matches teachers to classes by language

### Step 4: Assignment Suggestions
- Generates suggestions with confidence scores
- Balances workload across teachers
- Provides alternative teacher options
- Flags overloaded teachers (>6 assignments)

### Step 5: Comprehensive Reporting
Displays:
- Summary statistics (coverage percentage)
- Suggested assignments grouped by date
- Unable-to-fill slots with reasons
- Teacher workload distribution

### Step 6: Action Logging
Logs entire analysis to HISTORY sheet for tracking and auditing.

## Running the Example

### Prerequisites
1. Set environment variable with your spreadsheet ID:
   ```bash
   export SPREADSHEET_ID="1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8"
   ```

2. Ensure Google Sheets credentials are configured:
   ```bash
   export CREDENTIALS_CONFIG="path/to/credentials.json"
   ```

### Execute
```bash
bun examples/sunday-school-coordinator.ts
```

## Expected Output

```
📚 Sunday School Teacher Coordinator

📅 Analyzing 3-month period: 2026-02-01 to 2026-05-01

📖 Reading Schedule sheet...
   Found 52 total rows

📋 Headers (row 1): Date, Week, Reading, Lessons, Swahili, French, Youth A, Youth B, Temple Prep

📚 Class columns detected: Swahili, French, Youth A, Youth B, Temple Prep

🔎 Scanning for unassigned teaching slots...

📊 Coverage Status:
   Total slots: 195
   Assigned: 168 (86%)
   Unassigned: 27 (14%)

👥 Reading Teachers directory...
   Found 12 teachers (10 active)

💡 Generating assignment suggestions...

══════════════════════════════════════════════════════════════════════
  SUNDAY SCHOOL TEACHER COORDINATION REPORT
  Period: 2026-02-01 to 2026-05-01
  Generated: 2/1/2026, 12:20:16 AM
══════════════════════════════════════════════════════════════════════

## SUMMARY
   Total class slots: 195
   Assigned: 168 (86%)
   Unassigned: 27 (14%)

## SUGGESTED ASSIGNMENTS (24 suggestions)

### 📅 2026-02-08 (Week: Feb 8-14)
   ✅ Swahili → John Mwangi
      Speaks Swahili, balanced workload (3 assignments)
      Alternatives: Mary Kimani, David Ochieng

   ✅ French → Marie Dubois
      Speaks French, balanced workload (2 assignments)

### 📅 2026-02-15 (Week: Feb 15-21)
   ⚠️ Youth A → Sarah Johnson
      Speaks English, balanced workload (7 assignments)
      ⚠️  Heavy workload (7 assignments in 3 months)

## UNABLE TO FILL (3 slots) ❌

### 📅 2026-04-19 (Week: Apr 19-25)
   ❌ Temple Prep
      No active teachers available who speak English

## TEACHER WORKLOAD DISTRIBUTION

   Sarah Johnson: 7 assignments ⚠️ OVERLOADED
   John Mwangi: 6 assignments
   Marie Dubois: 5 assignments
   David Ochieng: 4 assignments
   Mary Kimani: 2 assignments

══════════════════════════════════════════════════════════════════════

✋ CONFIRMATION REQUIRED
   Would you like to apply these 24 suggested assignments?
   (Demo mode - auto-cancelling to prevent accidental writes)

❌ Cancelled (demo mode)

📊 Analysis logged to HISTORY sheet
```

## Key Features

### Robust Date Parsing
Handles multiple date formats from Google Sheets:
- Google Sheets serial numbers (e.g., 45323)
- M/D format (infers year)
- M/D/YY format
- ISO date strings

### Language Extraction
Automatically extracts language from class names:
- "Swahili Youth" → Swahili
- "French Class" → French
- "Youth A" → English (default)

### Workload Balancing
Distributes assignments evenly across teachers who speak the required language, preventing overload.

### Demo Mode Safety
Auto-cancels write operations to prevent accidental changes. Set `userConfirmed = true` in code to enable actual writes.

## Extending This Example

### Add Confirmation Prompt
Replace the demo confirmation with real user input:
```typescript
import { confirm } from '@inquirer/prompts';

const userConfirmed = await confirm({
  message: `Apply ${fillableSlots.length} suggested assignments?`,
});
```

### Implement Write Operation
After confirmation, update the Schedule sheet:
```typescript
if (userConfirmed) {
  for (const suggestion of fillableSlots) {
    if (!suggestion.suggestedTeacher) continue;

    await agent.write({
      sheet: 'Schedule',
      range: `${String.fromCharCode(65 + suggestion.slot.columnIndex)}${suggestion.slot.rowIndex + 1}`,
      data: [[suggestion.suggestedTeacher]],
    });
  }
}
```

### Add Email Notifications
Notify teachers of new assignments:
```typescript
const teacher = teachers.find(t => t.name === suggestion.suggestedTeacher);
if (teacher?.phone) {
  // Send SMS or email notification
  console.log(`📧 Notify ${teacher.name} at ${teacher.phone}`);
}
```

## Learn More

- [SheetAgent API Documentation](../src/agent.ts)
- [Full Workflow Example](./full-workflow.ts)
- [3-Month Scheduling Pattern](./schedule-3months.ts)
