# Agentic Harness Guide v2
## Building a Plan-Driven AI Agent for Google Sheets

---

## Overview

This guide covers building a production-ready AI agent grounded in Google Sheets, using a **PLAN.md system** for structured task tracking. The approach combines:

- **ReAct pattern** for reasoning and acting
- **PLAN.md** for persistent state and goal tracking
- **Minimal toolset** for sheet operations

> "Consistently, the most successful implementations weren't using complex frameworks or specialized libraries. Instead, they were building with simple, composable patterns."  
> — Anthropic, *Building Effective Agents*

---

## Core Principles

| Principle | Description |
|-----------|-------------|
| **Simplicity First** | Start minimal; add complexity only when needed |
| **Plan-Driven** | Use PLAN.md as external memory and state tracker |
| **Transparency** | Show reasoning steps; track progress with checkboxes |
| **Focused Tools** | One job per tool; excellent documentation |
| **Recoverable** | Blocked/review statuses enable graceful failure handling |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      LLM AGENT                              │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  System Prompt                                        │  │
│  │  • Agent identity & capabilities                      │  │
│  │  • Tool definitions (Plan + Sheet tools)              │  │
│  │  • Planning workflow instructions                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Plan-Driven ReAct Loop                               │  │
│  │                                                       │  │
│  │  1. getPlan() → load context & goals                  │  │
│  │  2. getNextTask() → find what to do                   │  │
│  │  3. startTask(step) → mark [/] in progress            │  │
│  │  4. Execute sheet operation                           │  │
│  │  5. completeTask(step) → mark [x] ✅ done             │  │
│  │  6. Repeat until getNextTask() returns null           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│      PLAN TOOLS         │   │      SHEET TOOLS        │
├─────────────────────────┤   ├─────────────────────────┤
│ initPlan()              │   │ get_sheet_data()        │
│ getPlan()               │   │ update_cells()          │
│ getNextTask()           │   │ list_sheets()           │
│ getReviewTasks()        │   │ search_sheet()          │
│ createPlan()            │   │ create_sheet()          │
│ startTask()             │   └────────────┬────────────┘
│ completeTask()          │                │
│ blockTask()             │                │
│ reviewTask()            │                │
└────────────┬────────────┘                │
             │                             │
             ▼                             ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│     AGENT_BASE!C2       │   │    Google Sheets API    │
│    (PLAN.md storage)    │   │    (Data operations)    │
└─────────────────────────┘   └─────────────────────────┘
```

---

## The PLAN.md System

### Why PLAN.md?

The PLAN.md approach solves key agent challenges:

| Challenge | Solution |
|-----------|----------|
| **Lost in the middle** | Plan is re-read each step, keeping goals in recent context |
| **Session continuity** | Checkboxes persist state across sessions |
| **Error recovery** | Blocked `[>]` and review `[!]` statuses enable graceful handling |
| **Transparency** | Human-readable markdown shows exactly what agent is doing |
| **Context grounding** | Analysis section captures sheet structure upfront |

### Storage Location

| Location | Cell | Content |
|----------|------|---------|
| `AGENT_BASE` | `C1` | Marker: `"PLAN.md Contents"` |
| `AGENT_BASE` | `C2` | Full PLAN.md markdown |

### Plan Format

```markdown
# Plan: [Title]

Goal: [One sentence describing success]

## Analysis

- Spreadsheet: [name/ID]
- Key sheets: [sheet names]
- Target ranges:
  - Read: Sheet!Range (column descriptions)
  - Write: Sheet!Range (column descriptions)
- Current state: [what data exists]

## Questions for User

- [Clarifying question 1]
- [Clarifying question 2]

### Phase 1: [Name]
- [ ] 1.1 First step with Sheet!Range (columns)
- [ ] 1.2 Second step

### Phase 2: [Name]
- [ ] 2.1 Step one
- [ ] 2.2 Step two

## Notes

[Context, links, learnings, decisions]
```

### Status Markers

| Marker | Status | Meaning | Set By |
|--------|--------|---------|--------|
| `[ ]` | Todo | Not started | `createPlan()` |
| `[/]` | Doing | In progress | `startTask()` |
| `[x]` | Done | Completed | `completeTask()` |
| `[>]` | Blocked | Waiting on something | `blockTask()` |
| `[!]` | Review | Needs human input | `reviewTask()` |

### Status Flow

```
[ ] Todo
 │
 ▼
[/] Doing ──────────────────┐
 │                          │
 ├──► [x] Done ✅ 2026-01-11│
 │                          │
 ├──► [>] Blocked ──────────┤
 │     │                    │
 │     └──► [/] Doing ──────┤
 │                          │
 └──► [!] Review ───────────┤
       │                    │
       └──► [/] Doing ──────┘
```

---

## Tool Reference

### Plan Tools (8 methods)

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `initPlan()` | Initialize workspace | AGENT_BASE missing or no plan marker in C1 |
| `getPlan()` | Load current plan | Start of session, after any plan update |
| `getNextTask()` | Get next `[ ]` todo | Before starting work |
| `getReviewTasks()` | Get all `[!]` items | Start of session (handle before continuing) |
| `createPlan(title, goal, phases)` | Create new plan | When user describes a new goal |
| `startTask(step)` | Mark `[/]` in progress | Before executing a task |
| `completeTask(step)` | Mark `[x]` with date | After successful execution |
| `blockTask(step, reason)` | Mark `[>]` blocked | When task cannot proceed |
| `reviewTask(step, note)` | Mark `[!]` for review | When human verification needed |

### Sheet Tools (5 methods)

| Tool | Purpose | Example |
|------|---------|---------|
| `get_sheet_data(spreadsheet_id, sheet, range)` | Read cells | `get_sheet_data("abc", "Sales", "A1:D100")` |
| `update_cells(spreadsheet_id, sheet, range, data)` | Write data | `update_cells("abc", "Sales", "E2", [["Done"]])` |
| `list_sheets(spreadsheet_id)` | List tabs | `list_sheets("abc")` |
| `search_sheet(spreadsheet_id, sheet, query)` | Find values | `search_sheet("abc", "Contacts", "John")` |
| `create_sheet(spreadsheet_id, title)` | Add tab | `create_sheet("abc", "Q4 Report")` |

---

## The Plan-Driven ReAct Loop

### Standard ReAct

```
User Query → Think → Act → Observe → Think → ... → Respond
```

### Plan-Driven ReAct

```
┌─────────────────────────────────────────────────────────────┐
│                   Plan-Driven ReAct Loop                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐                                                │
│  │  INIT   │  getPlan() or initPlan()                       │
│  └────┬────┘  Load plan into context                        │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────┐                                                │
│  │ REVIEW? │  getReviewTasks()                              │
│  └────┬────┘  Handle pending reviews first                  │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────┐                                                │
│  │  THINK  │  getNextTask()                                 │
│  └────┬────┘  "Task 2.1: Read Orders!A2:F500"               │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────┐                                                │
│  │  START  │  startTask("2.1")                              │
│  └────┬────┘  Mark [/] in progress                          │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────┐                                                │
│  │   ACT   │  get_sheet_data("Orders", "A2:F500")           │
│  └────┬────┘  Execute the sheet operation                   │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────┐                                                │
│  │ OBSERVE │  "Received 487 rows of order data"             │
│  └────┬────┘  Process the result                            │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────┐     ┌─────────┐                                │
│  │ SUCCESS?│──No─►│ BLOCKED │  blockTask("2.1", reason)     │
│  └────┬────┘     │   or    │  reviewTask("2.1", note)       │
│       │Yes       │ REVIEW  │                                │
│       ▼          └─────────┘                                │
│  ┌─────────┐                                                │
│  │ COMPLETE│  completeTask("2.1")                           │
│  └────┬────┘  Mark [x] ✅ 2026-01-11                        │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────┐                                                │
│  │  MORE?  │  getNextTask()                                 │
│  └────┬────┘                                                │
│       │                                                     │
│       ├──Yes──► Loop back to THINK                          │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────┐                                                │
│  │  DONE   │  Summarize results to user                     │
│  └─────────┘                                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Workflow Phases

### Phase 1: Initialize

```typescript
// At session start
const plan = await getPlan();

if (!plan) {
  // AGENT_BASE doesn't exist or C1 missing marker
  await initPlan();  // Creates starter plan
}

// Check for pending reviews
const reviews = await getReviewTasks();
if (reviews.length > 0) {
  // Handle reviews before continuing
  return notifyUser(`Pending reviews: ${reviews.map(r => r.step + ' ' + r.title)}`);
}
```

### Phase 2: Create Plan

When user describes a goal:

```typescript
// 1. Analyze the spreadsheet
const sheets = await list_sheets(spreadsheetId);
const headers = await get_sheet_data(spreadsheetId, sheets[0], "1:1");

// 2. Create structured plan
await createPlan(
  "Generate Q4 Sales Report",
  "Aggregate order data and populate Summary dashboard",
  [
    { name: "Data Collection", steps: [
      "Read Orders!A2:F500 (order ID, date, customer, SKU, qty, total)",
      "Read Products!A2:D200 (SKU, name, category, unit cost)"
    ]},
    { name: "Processing", steps: [
      "Calculate regional totals in Staging!A2:E50",
      "Compute category breakdown in Staging!G2:J20"
    ]},
    { name: "Output", steps: [
      "Write summary to Summary!B5:E20",
      "Update Dashboard!A1:G10 with chart data"
    ]}
  ]
);
```

### Phase 3: Execute

```typescript
let task = await getNextTask();

while (task) {
  // Mark in progress
  await startTask(task.step);
  
  try {
    // Parse task.title for sheet reference and execute
    const result = await executeSheetOperation(task.title);
    
    // Mark complete
    await completeTask(task.step);
    
    // Report progress
    notifyUser(`✓ Completed ${task.step}: ${task.title}`);
    
  } catch (error) {
    if (needsUserInput(error)) {
      await reviewTask(task.step, error.message);
      notifyUser(`⚠ Task ${task.step} needs review: ${error.message}`);
      break;
    } else {
      await blockTask(task.step, error.message);
      notifyUser(`✗ Task ${task.step} blocked: ${error.message}`);
      break;
    }
  }
  
  task = await getNextTask();
}

// Check completion
if (!task) {
  const reviews = await getReviewTasks();
  if (reviews.length === 0) {
    notifyUser("✓ Plan complete!");
  }
}
```

### Phase 4: Handle Blocks & Reviews

```typescript
// When user resolves a block
async function resumeBlockedTask(step: string) {
  await startTask(step);  // Changes [>] to [/]
  // Continue execution...
}

// When user approves a review
async function approveReview(step: string) {
  await startTask(step);  // Changes [!] to [/]
  // Execute the task...
  await completeTask(step);
}
```

---

## Tool Definitions

### Plan Tools

```typescript
interface PlanManager {
  /**
   * Initialize the plan system.
   * Creates AGENT_BASE sheet if missing, writes marker to C1,
   * and creates starter plan in C2.
   * Idempotent - safe to call multiple times.
   */
  initPlan(): Promise<Plan>;
  
  /**
   * Read current plan from AGENT_BASE!C2.
   * Returns null if no plan exists.
   */
  getPlan(): Promise<Plan | null>;
  
  /**
   * Get the next task with [ ] todo status.
   * Skips blocked [>] and review [!] tasks.
   * Returns null when all tasks done.
   */
  getNextTask(): Promise<PlanTask | null>;
  
  /**
   * Get all tasks with [!] review status.
   * Check this at session start.
   */
  getReviewTasks(): Promise<PlanTask[]>;
  
  /**
   * Create a new plan with phases and steps.
   * Overwrites existing plan in AGENT_BASE!C2.
   */
  createPlan(title: string, goal: string, phases: PhaseInput[]): Promise<void>;
  
  /**
   * Mark task as in-progress [/].
   * Call before executing a task.
   */
  startTask(step: string): Promise<void>;
  
  /**
   * Mark task as done [x] with completion date.
   * Call after successful execution.
   */
  completeTask(step: string): Promise<void>;
  
  /**
   * Mark task as blocked [>] with reason.
   * Include affected sheet/range in reason.
   */
  blockTask(step: string, reason: string): Promise<void>;
  
  /**
   * Mark task for review [!] with note.
   * Use for human verification needs.
   */
  reviewTask(step: string, note: string): Promise<void>;
}

interface PhaseInput {
  name: string;
  steps: string[];  // Each step should include Sheet!Range (columns)
}
```

### Sheet Tools

```typescript
/**
 * Read data from a specific range in Google Sheets.
 * 
 * @param spreadsheet_id - The ID from the sheet URL
 * @param sheet - Name of the tab (e.g., "Sheet1", "Sales Data")
 * @param range - Optional A1 notation (e.g., "A1:C10"). Omit for all data.
 * @returns Dictionary with values, row_count, column_count
 * 
 * @example
 * get_sheet_data("abc123", "Sales", "A1:B10")
 * // Returns: { values: [["Name", "Amount"], ["Alice", "100"]], ... }
 */
function get_sheet_data(
  spreadsheet_id: string,
  sheet: string,
  range?: string
): Promise<SheetData>;

/**
 * Write data to cells in Google Sheets.
 * 
 * @param spreadsheet_id - The ID from the sheet URL
 * @param sheet - Name of the tab
 * @param range - A1 notation for target cells
 * @param data - 2D array of values to write
 * 
 * @example
 * update_cells("abc123", "Sales", "D2:D5", [["Done"], ["Done"], ["Pending"], ["Done"]])
 */
function update_cells(
  spreadsheet_id: string,
  sheet: string,
  range: string,
  data: any[][]
): Promise<void>;

/**
 * List all sheet tabs in a spreadsheet.
 * 
 * @param spreadsheet_id - The ID from the sheet URL
 * @returns Array of sheet names
 */
function list_sheets(spreadsheet_id: string): Promise<string[]>;

/**
 * Search for values in a sheet.
 * 
 * @param spreadsheet_id - The ID from the sheet URL
 * @param sheet - Name of the tab to search
 * @param query - Text to search for
 * @returns Matching cells with locations
 */
function search_sheet(
  spreadsheet_id: string,
  sheet: string,
  query: string
): Promise<SearchResult[]>;

/**
 * Create a new sheet tab.
 * 
 * @param spreadsheet_id - The ID from the sheet URL
 * @param title - Name for the new sheet
 */
function create_sheet(
  spreadsheet_id: string,
  title: string
): Promise<void>;
```

---

## System Prompt

Add this to your agent's system prompt:

```markdown
You are a Google Sheets assistant that uses a PLAN.md system to track multi-step work.

## Capabilities

- Read, analyze, and modify spreadsheet data
- Create and execute structured plans
- Track progress with checkboxes
- Handle errors gracefully with blocked/review statuses

## Available Tools

### Plan Tools
- **initPlan()** — Initialize workspace (creates AGENT_BASE sheet + starter plan)
- **getPlan()** — Read current plan from AGENT_BASE!C2
- **getNextTask()** — Get next todo task (skips blocked/review)
- **getReviewTasks()** — Get tasks awaiting human review
- **createPlan(title, goal, phases)** — Create new plan
- **startTask(step)** — Mark task [/] in progress
- **completeTask(step)** — Mark task [x] done with date
- **blockTask(step, reason)** — Mark task [>] blocked
- **reviewTask(step, note)** — Mark task [!] for review

### Sheet Tools
- **get_sheet_data(spreadsheet_id, sheet, range)** — Read cells
- **update_cells(spreadsheet_id, sheet, range, data)** — Write cells
- **list_sheets(spreadsheet_id)** — List sheet tabs
- **search_sheet(spreadsheet_id, sheet, query)** — Find values
- **create_sheet(spreadsheet_id, title)** — Add new tab

## Workflow

### 1. Session Start

```
plan = getPlan()
if no plan:
  initPlan()  // Creates starter plan
else:
  reviews = getReviewTasks()
  if reviews exist:
    Handle reviews first
  else:
    task = getNextTask()
    Resume execution
```

### 2. Creating a Plan

When user describes a goal:

1. Analyze spreadsheet structure (list_sheets, read headers)
2. Identify key sheets and target ranges
3. Ask clarifying questions if needed
4. Call createPlan() with phases grouping related steps

Each step should reference **Sheet!Range (column descriptions)**:
- "Read Orders!A2:F500 (order ID, date, customer, SKU, qty, total)"
- "Write Summary!B5:E20 (category, units sold, revenue, margin)"

### 3. Executing Tasks

Work through tasks one at a time:

```
while task = getNextTask():
  startTask(task.step)      // Mark [/]
  execute sheet operation
  completeTask(task.step)   // Mark [x] ✅
  report progress to user
```

### 4. Handling Failures

**Blocked** — Task cannot proceed:
```
blockTask("2.1", "Sales!A2:H1000 is empty — need POS upload")
```
Tell user what's blocked and how to resolve.

**Review** — Needs human verification:
```
reviewTask("2.3", "please verify 5% variance threshold is correct")
```
Wait for user confirmation before proceeding.

### 5. Resuming

After user resolves block/review:
```
startTask(step)     // Changes [>] or [!] to [/]
execute task
completeTask(step)  // Mark [x] ✅
```

## Plan Format

```markdown
# Plan: [Title]

Goal: [One sentence describing success]

## Analysis

- Spreadsheet: [name/ID]
- Key sheets: [sheet names]
- Target ranges:
  - Read: Sheet!Range (columns)
  - Write: Sheet!Range (columns)
- Current state: [description]

## Questions for User

- [Clarifying questions]

### Phase 1: [Name]
- [ ] 1.1 Step with Sheet!Range (columns)
- [ ] 1.2 Another step

### Phase 2: [Name]
- [ ] 2.1 Step description
- [ ] 2.2 Another step

## Notes

[Context, decisions, learnings]
```

## Status Markers

| Marker | Status | Meaning |
|--------|--------|---------|
| `[ ]` | Todo | Not started |
| `[/]` | Doing | In progress |
| `[x]` | Done | Completed with date |
| `[>]` | Blocked | Waiting on something |
| `[!]` | Review | Needs human input |

## Best Practices

1. **One task at a time** — start, execute, complete before moving on
2. **Update status immediately** — don't batch updates
3. **Be specific in blocks** — include sheet/range affected
4. **Request review for** — destructive actions, thresholds, final outputs
5. **Always include ranges** — Sheet!Range (what columns contain)
6. **Report progress** — tell user after each task completes
7. **Fetch only needed data** — use specific ranges, not entire sheets
```

---

## Example Session

### User Request

> "I need to reconcile our warehouse inventory with January sales and flag any discrepancies over 5%."

### Agent Response

```
I'll create a plan for the inventory reconciliation. Let me first check the spreadsheet structure.

[Calls list_sheets()]
[Calls get_sheet_data() on each sheet to read headers]

Based on my analysis:
- Warehouse sheet has: SKU, bin location, qty on hand, last count date
- Sales sheet has: order ID, date, SKU, qty sold, unit price, total
- Products sheet has: SKU, product name, category

I have a few questions before we start:

1. Should items with zero stock be included?
2. Should I clear the existing Discrepancies sheet before writing?
3. Is 5% the correct threshold for flagging?

[User answers questions]

Creating the plan now...

[Calls createPlan()]
```

### Resulting Plan

```markdown
# Plan: January Inventory Reconciliation

Goal: Reconcile warehouse inventory with sales data and flag discrepancies > 5%

## Analysis

- Spreadsheet: Inventory Management 2026 (ID: 1a2b3c...)
- Key sheets: Warehouse, Sales, Products, Discrepancies, Summary
- Target ranges:
  - Read: Warehouse!A2:F500 (SKU, bin, qty on hand, last count, counter, notes)
  - Read: Sales!A2:H1000 (order ID, date, SKU, qty sold, price, total, customer, status)
  - Read: Products!A2:D200 (SKU, name, category, reorder threshold)
  - Write: Discrepancies!A2:G100 (SKU, expected, actual, variance, %, flag, notes)
  - Write: Summary!B3:E15 (metric, value, previous, change)
- Current state: Warehouse has 487 SKUs, Sales has 943 January transactions

## Questions for User

- ✓ Include zero stock items: No
- ✓ Clear Discrepancies first: Yes
- ✓ Threshold: 5%

### Phase 1: Data Collection
- [ ] 1.1 Read Warehouse!A2:F500 (current stock levels)
- [ ] 1.2 Read Sales!A2:H1000 (January transactions)
- [ ] 1.3 Read Products!A2:D200 (SKU master data)

### Phase 2: Calculation
- [ ] 2.1 Calculate expected inventory per SKU
- [ ] 2.2 Compare expected vs actual quantities
- [ ] 2.3 Identify items with variance > 5%

### Phase 3: Output
- [ ] 3.1 Clear Discrepancies!A2:G100
- [ ] 3.2 Write flagged items to Discrepancies!A2:G100
- [ ] 3.3 Calculate summary stats for Summary!B3:E15

### Phase 4: Validation
- [ ] 4.1 Verify row counts match
- [ ] 4.2 Spot-check 5 random SKUs

## Notes

- Previous reconciliation data in Discrepancies rows 2-85 (December)
- Threshold confirmed at 5% variance
- User approved clearing existing data
```

### Execution

```
Starting Phase 1: Data Collection

[startTask("1.1")]
Reading Warehouse!A2:F500...
[get_sheet_data()]
✓ Retrieved 487 SKUs with stock levels
[completeTask("1.1")]

[startTask("1.2")]
Reading Sales!A2:H1000...
[get_sheet_data()]
✓ Retrieved 943 January transactions
[completeTask("1.2")]

[startTask("1.3")]
Reading Products!A2:D200...
[get_sheet_data()]
✓ Retrieved 195 products
[completeTask("1.3")]

Phase 1 complete. Starting Phase 2: Calculation...

[startTask("2.1")]
Calculating expected inventory...
...
```

---

## Error Handling

### Blocked Task Example

```markdown
### Phase 2: Processing
- [/] 2.1 Calculate totals from Sales!A2:H1000
```

Agent encounters empty sheet:

```typescript
try {
  const data = await get_sheet_data(id, "Sales", "A2:H1000");
  if (data.values.length === 0) {
    throw new Error("Sales!A2:H1000 is empty — need POS data upload");
  }
} catch (error) {
  await blockTask("2.1", error.message);
}
```

Plan updates to:

```markdown
### Phase 2: Processing
- [>] 2.1 Calculate totals from Sales!A2:H1000 — Sales!A2:H1000 is empty — need POS data upload
```

Agent tells user:

> "Task 2.1 is blocked: Sales sheet is empty. Please upload the POS data and let me know when ready."

### Review Task Example

```markdown
### Phase 3: Output
- [/] 3.1 Clear Discrepancies!A2:G100 (existing data)
```

Agent requests confirmation:

```typescript
await reviewTask("3.1", "about to delete 85 rows of December data — OK to proceed?");
```

Plan updates to:

```markdown
### Phase 3: Output
- [!] 3.1 Clear Discrepancies!A2:G100 (existing data) — about to delete 85 rows of December data — OK to proceed?
```

Agent tells user:

> "Task 3.1 needs your approval: I'm about to clear 85 rows of existing December data from Discrepancies. Is that OK?"

---

## Context Management

### The Problem

Large spreadsheets can exceed LLM context limits:

- 10,000-row sheet ≈ 500K+ tokens
- Performance degrades with long contexts
- Even cached, long inputs are expensive

### Solutions

| Strategy | Implementation |
|----------|----------------|
| **Specific ranges** | Use A1 notation, not entire sheets |
| **Pagination** | Return max 500 rows per call |
| **Analysis section** | Document structure once, reference later |
| **Plan as cache** | Sheet structure captured in Analysis, not re-fetched |

### Example: Analysis as Context Cache

Instead of re-reading headers every time:

```markdown
## Analysis

- Target ranges:
  - Read: Orders!A2:F500 (order_id, date, customer, SKU, qty, total)
```

Agent knows column structure without additional API calls.

---

## Authentication

### Google Service Account (Recommended)

```python
from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

def get_sheets_service():
    credentials = service_account.Credentials.from_service_account_file(
        'service-account.json',
        scopes=SCOPES
    )
    return build('sheets', 'v4', credentials=credentials)
```

### Setup

1. Create Google Cloud project
2. Enable Google Sheets API
3. Create Service Account
4. Download JSON key file
5. Share target spreadsheets with service account email

---

## Quick Start Checklist

### Setup
- [ ] Google Cloud project with Sheets API enabled
- [ ] Service Account configured
- [ ] Target spreadsheet shared with service account

### Tools
- [ ] 5 sheet tools defined with clear docstrings
- [ ] 8 plan tools implemented
- [ ] Error handling returns informative messages

### System Prompt
- [ ] Agent identity and capabilities
- [ ] All tool definitions included
- [ ] Planning workflow documented
- [ ] Status markers explained

### Testing
- [ ] initPlan() creates AGENT_BASE correctly
- [ ] createPlan() generates valid markdown
- [ ] Status updates work (start → complete)
- [ ] Block and review flows work
- [ ] Session resume works

---

## Anti-Patterns

| ❌ Don't | ✅ Do Instead |
|----------|---------------|
| Fetch entire spreadsheets | Request specific ranges |
| Skip plan initialization | Always check getPlan() first |
| Batch status updates | Update immediately after each action |
| Hide errors from agent | Return errors for learning |
| Vague block reasons | Include specific sheet/range affected |
| Skip reviews for destructive actions | Always reviewTask() before deleting |
| Re-read structure every task | Cache in Analysis section |

---

## Summary

| Component | Approach |
|-----------|----------|
| **Pattern** | Plan-Driven ReAct |
| **State** | PLAN.md in AGENT_BASE!C2 |
| **Tools** | 8 plan + 5 sheet = 13 total |
| **Statuses** | `[ ]` `[/]` `[x]` `[>]` `[!]` |
| **Auth** | Google Service Account |
| **Context** | Analysis section + specific ranges |

---

## References

- [Anthropic: Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Manus: Context Engineering for AI Agents](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus)
- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [ReAct: Reasoning and Acting in LLMs](https://arxiv.org/abs/2210.03629)

---

*Version 2.0 — January 2026*
