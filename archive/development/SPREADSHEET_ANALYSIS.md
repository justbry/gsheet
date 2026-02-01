# Google Spreadsheet Analysis

**Spreadsheet ID:** `1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8`

**Analysis Date:** 2026-01-21

## Overview

This Google Spreadsheet is used to manage Sunday School teaching schedules and resources for a multi-language congregation. It tracks teacher assignments across different language groups (Swahili, French, English) and age groups (Youth A 12-15yo, Youth B 15-18yo, Temple Prep).

## All Sheets (Tabs)

1. **Start Here** - Getting started instructions for teachers
2. **Schedule** - Main teaching schedule with sign-ups
3. **Teachers** - Teacher contact information
4. **Resources** - Links to teaching resources
5. **AGENTSCAPE** - Agent configuration and system prompts
6. **AgentScape1** - Alternative agent configuration
7. **Copy of AgentScape** - Backup of agent configuration

## Sheet Details

### 1. Start Here
Contains orientation information for new teachers:
- Instructions on expectations
- How to add contact details
- Where to find resources
- How to sign up for teaching slots

### 2. Schedule
Main teaching schedule organized by:

**Structure:**
- Column A: Class Date (for 1st and 3rd Sundays)
- Column B: Week Range
- Column C: Reading Assignment
- Column D: Lesson Title
- Column E: Swahili (RS Room) - Teacher assignment
- Column F: French (PH Room) - Teacher assignment
- Column G: Youth A 12-15yo (201) - Teacher assignment
- Column H: Youth B 15-18yo - Teacher assignment
- Column I: Temple Prep - Teacher assignment

**Current Status:**
- Teaching curriculum: Doctrine and Covenants (September-December 2025) transitioning to Old Testament (January 2026+)
- Total teacher assignments: 11
- Most active teachers: Ken Romney (2), Justin B (2)

**Teacher Assignments:**
| Week | Class Date | Swahili | French | Youth A | Youth B | Temple Prep |
|------|------------|---------|--------|---------|---------|-------------|
| 11/10-11/16 | 11/16 | - | - | - | Ken Romney | - |
| 12/1-12/7 | 12/7 | - | Edwigson | David Cooper | Justin Benson | - |
| 12/15-12/21 | 12/21 | - | - | Benjamin swensen | Ken Romney | - |
| 12/29-1/4 | - | Daniel R | - | - | Justin B | - |
| 1/26-2/1 | - | Milindi | Wilderson | - | Justin B | - |

### 3. Teachers
Contact database with columns:
- Name
- Phone Number
- In Whatsapp Group (boolean)
- Languages
- Notes

**Sample data:**
- Edwigson C. (954-300-5229, French speaker)
- Justin Benson (971-533-9292, English/Tagalog, Coordinator)

### 4. Resources
Teaching resource links organized by:
- Resource name
- Type (Website, Shortcut)
- Link

**Key resources:**
- Short link to sign-up: https://tinyurl.com/s3-come-follow-me
- Swahili materials: Come Follow Me in Swahili
- French materials: Come Follow Me in French
- English materials: Come Follow Me in English

### 5. AGENTSCAPE
Agent configuration using column-based file system:
- Column A: FILE metadata
- Column B: AGENTS.md (system prompt and capabilities)
- Column C: PLAN.md (current plan/goals)
- Column D: RESEARCH.md (analysis workspace)

Contains comprehensive agent instructions for:
- Data operations (read, write, search)
- Planning system
- History logging
- Behavioral rules and boundaries

## Current CLI Capabilities

### Question 1: Can the current CLI read from specific sheet tabs?

**YES!** The current implementation fully supports reading from specific sheets (tabs).

The `SheetAgent` class in `/Users/rmac/repos/gsheet/src/agent.ts` provides:

```typescript
// Read from specific sheet
await agent.read({
  sheet: 'Schedule',  // Can use sheet name
  range: 'A1:Z30',    // Optional A1 notation
  format: 'array'     // or 'object'
});

// Also supports sheet index
await agent.read({
  sheet: 0,  // First sheet (by index)
  format: 'array'
});
```

### Question 2: Best way to access these sheets

**Recommended approach:**

```typescript
import { SheetAgent } from './src/agent';

// 1. Connect to spreadsheet
const agent = await SheetAgent.connect({
  spreadsheetId: '1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8',
});

// 2. List all available sheets
const sheets = await agent.listSheets();

// 3. Read specific sheet with range
const schedule = await agent.read({
  sheet: 'Schedule',
  range: 'A1:I40',
  format: 'object'  // Returns objects with headers
});

// 4. Search for specific data
const teachers = await agent.search({
  sheet: 'Teachers',
  query: { Languages: 'French' },
  matching: 'loose'
});
```

**Alternative: Use the CLI**

```bash
# Using the gsheet CLI
bun run src/cli/index.ts read Schedule \
  --spreadsheet-id 1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8

# Note: Current CLI is designed for AGENTSCAPE file system operations
# Direct sheet reading via CLI would require extension
```

### Question 3: Schedule Data (First 30 Rows)

See the detailed output in the scripts:
- `/Users/rmac/repos/gsheet/read-schedule.ts` - Raw data view
- `/Users/rmac/repos/gsheet/analyze-schedule.ts` - Structured analysis

**Key findings:**
- Schedule shows weeks from September 2025 through March 2026
- Teaching assignments are sparse (only 11 assignments out of many weeks)
- Most slots are still available (shown as yellow boxes in the actual spreadsheet)
- Current curriculum: Doctrine and Covenants transitioning to Old Testament

## Technical Implementation Details

### Data Reading Formats

1. **Array Format** - Returns raw 2D array
   ```typescript
   { rows: any[][], range: string }
   ```

2. **Object Format** - Returns array of objects with headers
   ```typescript
   { 
     rows: Record<string, unknown>[], 
     headers: string[], 
     range: string 
   }
   ```

### Authentication

The codebase uses Google Service Account credentials loaded from:
1. `CREDENTIALS_CONFIG` environment variable (Base64-encoded JSON) - Default
2. `--credentials` flag pointing to JSON file
3. Direct credentials object in code

### API Features Used

- Google Sheets API v4
- Batch read support (`batchRead()`)
- Search/filter capabilities
- Sheet creation and management
- Retry with exponential backoff for rate limiting

## Useful Scripts Created

1. **read-schedule.ts** - Read and display Schedule sheet data
2. **analyze-schedule.ts** - Parse and analyze teacher assignments
3. **explore-sheets.ts** - Explore all sheets in the spreadsheet

All scripts are located in: `/Users/rmac/repos/gsheet/`

## Next Steps / Recommendations

1. **CLI Extension**: Add direct sheet reading commands to the CLI
   ```bash
   gsheet read-sheet Schedule --range A1:I40 --format json
   ```

2. **Teacher Assignment Analytics**: Build reports on:
   - Coverage gaps (weeks without teachers)
   - Teacher workload distribution
   - Language coverage

3. **Automated Reminders**: System to notify teachers of upcoming assignments

4. **Validation**: Check for double-bookings or missing assignments
