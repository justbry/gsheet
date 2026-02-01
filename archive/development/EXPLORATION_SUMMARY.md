# Google Sheets Exploration Summary

**Date:** 2026-01-21
**Spreadsheet ID:** 1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8

## Questions Answered

### 1. Can the current CLI read from specific sheet tabs?

**YES!** The current implementation has full support for reading specific sheets (tabs).

**Evidence:**
- The `SheetAgent` class provides `read()` method accepting sheet name or index
- The `read()` method supports specific ranges using A1 notation
- Both array and object formats are supported
- Integration tests confirm this works (see `/Users/rmac/repos/gsheet/tests/integration/sheets-api.test.ts`)

**Code Example:**
```typescript
const agent = await SheetAgent.connect({
  spreadsheetId: '1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8',
});

// Read by sheet name
const schedule = await agent.read({
  sheet: 'Schedule',
  range: 'A1:I40',
  format: 'object'
});

// Read by sheet index
const firstSheet = await agent.read({
  sheet: 0,
  format: 'array'
});
```

### 2. What's the best way to access these sheets?

**Recommended Approach: Use the SheetAgent API directly**

The current CLI (`src/cli/index.ts`) is designed for the AGENTSCAPE file system operations (read/write markdown files stored in the AGENTSCAPE sheet), not for general sheet reading.

**For programmatic access:**

```typescript
import { SheetAgent } from './src/agent';

const agent = await SheetAgent.connect({
  spreadsheetId: SPREADSHEET_ID,
});

// Method 1: Direct read
const data = await agent.read({
  sheet: 'Schedule',
  range: 'A1:Z30',
  format: 'object'  // Auto-detects headers from first row
});

// Method 2: Batch read (more efficient for multiple ranges)
const results = await agent.batchRead([
  { sheet: 'Schedule', range: 'A1:I40' },
  { sheet: 'Teachers', format: 'object' },
  { sheet: 'Resources', format: 'object' }
]);

// Method 3: Search/filter
const frenchTeachers = await agent.search({
  sheet: 'Teachers',
  query: { Languages: 'French' },
  matching: 'loose'
});

// Method 4: List all sheets first
const allSheets = await agent.listSheets();
// Returns: ['Start Here', 'Schedule', 'Teachers', 'Resources', ...]
```

**For command-line access:**

Create custom scripts (as demonstrated) or extend the CLI:

```bash
# Current approach: Create TypeScript scripts
bun run read-schedule.ts
bun run analyze-schedule.ts
bun run read-teachers.ts

# Future enhancement: Extend CLI with sheet reading commands
# (not currently implemented)
```

### 3. Schedule Sheet Data (First 30 Rows)

**Schedule Sheet Structure:**

| Column | Header | Purpose |
|--------|--------|---------|
| A | (Class Date) | Date when class occurs (1st or 3rd Sunday) |
| B | Week | Week range for the lesson |
| C | Reading | Scripture reading assignment |
| D | Lessons | Lesson title |
| E | Swahili (RS Room) | Teacher assignment for Swahili class |
| F | French (PH Room) | Teacher assignment for French class |
| G | Youth A 12-15yo (201) | Teacher assignment for Youth A |
| H | Youth B 15-18yo | Teacher assignment for Youth B |
| I | Temple Prep | Teacher assignment for Temple Prep class |

**Key Findings:**

1. **Curriculum Transition:**
   - Rows 3-19: Doctrine and Covenants (September-December 2025)
   - Rows 20+: Old Testament (January 2026 onward)

2. **Teacher Assignment Status:**
   - Total assignments: 11 (out of ~30 weeks)
   - Most weeks still need teachers (indicated by "YELLOW BOXES" in spreadsheet)
   - Coverage is sparse, especially for Swahili, French, and Temple Prep classes

3. **Teacher Distribution:**
   - Ken Romney: 2 assignments (Youth B)
   - Justin B: 2 assignments (Youth B)
   - Single assignments: Edwigson, David Cooper, Justin Benson, Benjamin swensen, Daniel R, Milindi, Wilderson

4. **Weeks with Teachers (Sample):**

   **Week 11/10-11/16 (Class: 11/16)**
   - Lesson: "I Have Seen Your Sacrifices in Obedience"
   - Youth B: Ken Romney

   **Week 12/1-12/7 (Class: 12/7)**
   - Lesson: "The Vision of the Redemption of the Dead"
   - French: Edwigson
   - Youth A: David Cooper
   - Youth B: Justin Benson

   **Week 12/15-12/21 (Class: 12/21)**
   - Lesson: "The Family Is Central to the Creator's Plan"
   - Youth A: Benjamin swensen
   - Youth B: Ken Romney

   **Week 12/29-1/4 (Old Testament begins)**
   - Lesson: "Introduction to the Old Testament"
   - Swahili: Daniel R
   - Youth B: Justin B

   **Week 1/26-2/1**
   - Reading: Genesis 5; Moses 6
   - Swahili: Milindi
   - French: Wilderson
   - Youth B: Justin B

## Data Quality Observations

1. **Headers:** Row 1 contains instructions, Row 2 contains actual column headers
2. **Empty columns:** Some weeks have sparse data (only Reading/Lesson, no teachers)
3. **Section headers:** Some rows are curriculum section dividers (e.g., "Doctrine and Covenants - Come Follow Me")
4. **Inconsistent names:** Some use full names, others abbreviations (e.g., "Justin B" vs "Justin Benson")

## Scripts Created

All scripts are located in `/Users/rmac/repos/gsheet/`:

1. **read-schedule.ts**
   - Reads Schedule sheet in both array and object formats
   - Displays first 30 rows
   - Shows raw data structure

2. **analyze-schedule.ts**
   - Parses Schedule data with proper column interpretation
   - Extracts teacher assignments
   - Provides summary statistics

3. **read-teachers.ts**
   - Reads Teachers contact list
   - Demonstrates search functionality (finding French speakers)
   - Shows object format with headers

4. **explore-sheets.ts**
   - Lists all sheets in the spreadsheet
   - Reads sample data from each sheet
   - Useful for understanding overall spreadsheet structure

## Usage Examples

```bash
# Read and analyze schedule
bun run /Users/rmac/repos/gsheet/analyze-schedule.ts

# View teacher contact list
bun run /Users/rmac/repos/gsheet/read-teachers.ts

# Explore all sheets
bun run /Users/rmac/repos/gsheet/explore-sheets.ts
```

## API Capabilities Summary

The SheetAgent class (`/Users/rmac/repos/gsheet/src/agent.ts`) provides:

**Core Reading Operations:**
- `read()` - Read data from a sheet/range
- `batchRead()` - Read multiple ranges efficiently
- `search()` - Search/filter rows based on criteria
- `listSheets()` - List all sheet tabs

**Core Writing Operations:**
- `write()` - Write data to a sheet/range
- `createSheet()` - Create new sheet tab

**Planning/Task Operations:**
- `getPlan()` - Get current plan
- `createPlan()` - Create new plan
- `updateTask()` - Update task status
- `getNextTask()` - Get next task to execute

**Sheet Management:**
- `getClient()` - Get Google Sheets API client
- `executeWithRetry()` - Execute with automatic retry on transient errors

## Authentication

The codebase uses Google Service Account authentication via:
- `CREDENTIALS_CONFIG` environment variable (Base64-encoded JSON)
- Or `--credentials` flag with path to JSON file

Service account must have appropriate permissions on the spreadsheet.

## Next Steps / Recommendations

1. **Add CLI commands for direct sheet reading:**
   ```bash
   gsheet read-sheet Schedule --range A1:I40 --format json
   gsheet search Teachers --query '{"Languages":"French"}'
   ```

2. **Build teacher assignment utilities:**
   - Coverage gap detection
   - Automated assignment suggestions
   - Workload balancing

3. **Create reporting:**
   - Weekly assignment summary
   - Missing teacher notifications
   - Language coverage analysis

4. **Data validation:**
   - Check for double-bookings
   - Verify all weeks have adequate coverage
   - Validate contact information completeness
