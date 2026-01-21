# Product Requirements Document: g-sheet-agent-io

**Version:** 4.5  
**Date:** January 11, 2026  
**Status:** Ready for Implementation  
**Timeline:** 3 weeks

---

## Executive Summary

### Problem

AI agents using Google Sheets lose all context on restart. There's no standard way to track goals, persist plans, or provide consistent agent behavior.

### Solution

A <30KB TypeScript library providing:

- **AGENT.md** — System prompt and context in a single cell
- **PLAN.md** — Markdown-based goal tracking with checkboxes
- **Minimal sheet tools** — 5 focused operations

### Philosophy

> "The most successful implementations weren't using complex frameworks. They were building with simple, composable patterns."  
> — Anthropic, *Building Effective Agents*

This library embraces:
- **One job per method** — Clear, focused APIs
- **Plan-driven execution** — PLAN.md as external memory and state tracker
- **Human-readable state** — Everything visible and editable in sheets
- **Minimal surface area** — 12 agent methods (6 plan + 6 sheet) + 2 properties
- **Auto-initialization** — System loads AGENT.md and creates AGENT_BASE on connect

### Key Metrics

| Metric | Target | Hard Limit |
|--------|--------|------------|
| Bundle size (gzipped) | 25KB | 30KB |
| Agent methods | 12 | 15 |
| Setup time | <5 min | - |
| Test coverage | 90% | 85% |

### What This Library Does NOT Do

- ❌ Multi-agent coordination (single agent per workspace)
- ❌ OAuth flows (service account only)
- ❌ Real-time sync (polling-based)
- ❌ Auto-grant sheet access (user shares manually)
- ❌ Store credentials (user provides via env/config)
- ❌ Key-value memory storage (use plan Notes section)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      LLM AGENT                              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   g-sheet-agent-io                          │
│                                                             │
│  ┌─────────────────────┐   ┌─────────────────────────────┐  │
│  │    Plan Manager     │   │      Sheet Operations       │  │
│  │                     │   │                             │  │
│  │  • initPlan()       │   │  • read()                   │  │
│  │  • getPlan()        │   │  • write()                  │  │
│  │  • getNextTask()    │   │  • listSheets()             │  │
│  │  • createPlan()     │   │  • search()                 │  │
│  │  • startTask()      │   │  • createSheet()            │  │
│  │  • completeTask()   │   │                             │  │
│  │  • blockTask()      │   └─────────────────────────────┘  │
│  │  • reviewTask()     │                                    │
│  └──────────┬──────────┘                                    │
│             │                                               │
│             ▼                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   AGENT_BASE Sheet                      ││
│  │  ┌───────────────────────────┬─────────────────────────┐││
│  │  │            A              │            B            │││
│  │  ├───────────────────────────┼─────────────────────────┤││
│  │  │ AGENT.md Contents         │ PLAN.md Contents        │←1││
│  │  ├───────────────────────────┼─────────────────────────┤││
│  │  │ # Sales Report Agent      │ # Plan: Q4 Report       │←2││
│  │  │                           │                         │││
│  │  │ You are a spreadsheet     │ Goal: Generate summary  │││
│  │  │ assistant that...         │                         │││
│  │  │                           │ ## Analysis             │││
│  │  │ ## Capabilities           │ - Spreadsheet: Sales    │││
│  │  │ - Read sales data         │ - Key sheets: Orders... │││
│  │  │ - Calculate totals        │                         │││
│  │  │ - Generate reports        │ ### Phase 1: Data       │││
│  │  │                           │ - [x] 1.1 Read Orders ✅│││
│  │  │ ## Constraints            │ - [/] 1.2 Read Products │││
│  │  │ - Never delete data       │                         │││
│  │  │ - Ask before overwrites   │ ## Notes                │││
│  │  │                           │ user_id: u_123          │││
│  │  │ ## Style                  │ last_row: 487           │││
│  │  │ - Be concise              │                         │││
│  │  └───────────────────────────┴─────────────────────────┘││
│  │       System Prompt (A2)          Plan (B2)             ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Google Sheets API                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Workspace Structure

Single sheet stores all agent state:

| Cell | Content | Purpose |
|------|---------|---------|
| `AGENT_BASE!A1` | `"AGENT.md Contents"` | Marker |
| `AGENT_BASE!A2` | Full AGENT.md markdown | System prompt, capabilities, constraints |
| `AGENT_BASE!B1` | `"PLAN.md Contents"` | Marker |
| `AGENT_BASE!B2` | Full PLAN.md markdown | Goals, tasks, progress, notes |

**Why this layout?**
- **Column A** = Who the agent is (stable)
- **Column B** = What the agent is doing (changes frequently)
- Both human-readable and editable
- Single sheet to inspect/debug

---

## AGENT.md System

### Purpose

The AGENT.md provides persistent system prompt context that:
- Defines agent identity and capabilities
- Sets constraints and rules
- Specifies communication style
- Survives across sessions

### Format

```markdown
# [Agent Name]

[One paragraph description of the agent's purpose]

## Capabilities

- [What the agent can do]
- [Tools and operations available]
- [Data it can access]

## Constraints

- [What the agent must NOT do]
- [Approval requirements]
- [Safety rules]

## Style

- [Communication preferences]
- [Formatting rules]
- [Tone guidelines]

## Context

- Owner: [name/email]
- Created: [date]
- Spreadsheet: [name]
```

### Example

```markdown
# Sales Report Agent

You are a spreadsheet assistant that analyzes sales data and generates reports. You work with the Q4 Sales spreadsheet containing Orders, Products, and Summary sheets.

## Capabilities

- Read and analyze sales data from Orders sheet
- Calculate totals, averages, and trends
- Write summaries to Summary sheet
- Search for specific products or customers

## Constraints

- Never delete existing data
- Ask for confirmation before overwriting cells
- Do not access sheets outside this spreadsheet
- Flag any data anomalies for human review

## Style

- Be concise and data-focused
- Use exact numbers, not approximations
- Format currency as $X,XXX.XX
- Always cite the source range (e.g., "Orders!B2:B100")

## Context

- Owner: sales-team@company.com
- Created: 2026-01-11
- Spreadsheet: Q4 Sales Report 2026
```

---

## PLAN.md System

### Format

```markdown
# Plan: [Title]

Goal: [One sentence describing success]

## Analysis

- Spreadsheet: [name/ID]
- Key sheets: [sheet names]
- Target ranges:
  - Read: Sheet!Range (column descriptions)
  - Write: Sheet!Range (column descriptions)
- Current state: [description]

## Questions for User

- [Clarifying question 1]

### Phase 1: [Name]
- [ ] 1.1 Step with Sheet!Range (columns)
- [ ] 1.2 Another step

### Phase 2: [Name]
- [ ] 2.1 Step description

## Notes

[Context, decisions, learnings, working state]
key: value
another_key: value
```

### Status Markers

| Marker | Status | Set By |
|--------|--------|--------|
| `[ ]` | Todo | `createPlan()` |
| `[/]` | Doing | `startTask()` |
| `[x]` | Done | `completeTask()` |
| `[>]` | Blocked | `blockTask()` |
| `[!]` | Review | `reviewTask()` |

### Notes as Working Memory

The `## Notes` section serves as lightweight working memory:

```markdown
## Notes

Processing started: 2026-01-11T10:30:00Z
last_processed_row: 487
user_threshold: 0.05
batch_size: 100
error_count: 2
```

This replaces a separate key-value memory system—just append to Notes.

---

## API Reference

### System Behavior (Automatic)

These happen automatically inside the library—**not agent methods**:

```typescript
// INTERNAL: Called automatically on SheetAgent construction
// Agent never calls this directly
async function initialize(): Promise<void> {
  // 1. Check if AGENT_BASE sheet exists
  // 2. If missing: create sheet, write markers to A1/B1
  // 3. If A2 empty: write default AGENT.md
  // 4. If B2 empty: write starter PLAN.md
  // 5. Load AGENT.md into this.agentContext (available as property)
}
```

**Triggered by:** `SheetAgent.connect()` static method

**Behavior:**
- Silent — no logs unless error
- Idempotent — safe if sheet already exists  
- Non-destructive — never overwrites existing content
- Caches AGENT.md — available as `agent.system` property

This means agent code is simple:

```typescript
const agent = await SheetAgent.connect({ spreadsheetId, keyFile });

// AGENT.md is already loaded and available
console.log(agent.system);  // "# Sales Report Agent\n\nYou are..."
console.log(agent.spreadsheetId);  // "1abc123..."

// Just start working
const plan = await agent.getPlan();
```

---

### Agent Properties (2)

```typescript
interface SheetAgent {
  /**
   * The AGENT.md content, loaded at session start.
   * Read-only. Edit AGENT_BASE!A2 directly to change.
   */
  readonly system: string;

  /**
   * The spreadsheet ID this agent is connected to.
   * Useful for logging and debugging.
   */
  readonly spreadsheetId: string;
}
```

---

### Plan Methods (6)

```typescript
interface PlanManager {
  /**
   * Read current plan from AGENT_BASE!B2.
   */
  getPlan(): Promise<Plan>;

  /**
   * Get next task with [ ] status.
   * Skips [>] blocked and [!] review tasks.
   * Returns null when all tasks complete.
   */
  getNextTask(): Promise<PlanTask | null>;

  /**
   * Get all tasks with [!] review status.
   */
  getReviewTasks(): Promise<PlanTask[]>;

  /**
   * Create new plan, replacing existing.
   */
  createPlan(title: string, goal: string, phases: PhaseInput[]): Promise<void>;

  /**
   * Update task status.
   * Throws if task step not found.
   */
  updateTask(step: string, status: TaskUpdate): Promise<void>;

  /**
   * Append a line to the Notes section of the plan.
   * Creates Notes section if it doesn't exist.
   * Useful for working memory (key: value pairs).
   */
  appendNotes(line: string): Promise<void>;
}

type TaskUpdate = 
  | { status: 'doing' }
  | { status: 'done' }
  | { status: 'blocked'; reason: string }
  | { status: 'review'; note: string };
```

### Sheet Methods (6)

```typescript
interface SheetOperations {
  /**
   * Read data from sheet.
   * Returns objects by default, arrays optional.
   */
  read<T>(options: {
    sheet: string;
    range?: string;
    format?: 'object' | 'array';
  }): Promise<{ rows: T[]; rowCount: number }>;

  /**
   * Read multiple ranges in a single API call.
   * More efficient than multiple read() calls.
   */
  batchRead<T>(queries: Array<{
    sheet: string;
    range?: string;
    format?: 'object' | 'array';
  }>): Promise<Array<{ rows: T[]; rowCount: number }>>;

  /**
   * Write data to sheet.
   */
  write(options: {
    sheet: string;
    range: string;
    data: any[][];
  }): Promise<{ updatedCells: number }>;

  /**
   * List all sheet tabs.
   */
  listSheets(): Promise<string[]>;

  /**
   * Search for values in sheet.
   */
  search(options: {
    sheet: string;
    query: string;
    column?: string;
  }): Promise<{ matches: SearchMatch[] }>;

  /**
   * Create new sheet tab.
   */
  createSheet(title: string): Promise<void>;
}
```

**Total: 12 agent methods** (6 plan + 6 sheet) + 2 properties

*System initialization is internal—not an agent method.*

---

## Types

```typescript
// Plan types
interface Plan {
  title: string;
  goal: string;
  analysis?: string;
  questions?: string[];
  phases: Phase[];
  notes: string;
  raw: string;
}

interface Phase {
  number: number;
  name: string;
  tasks: PlanTask[];
}

interface PlanTask {
  line: number;
  phase: number;
  step: string;           // "1.1", "2.3", etc.
  status: TaskStatus;
  title: string;
  completedDate?: string;
  blockedReason?: string;
  reviewNote?: string;
}

type TaskStatus = 'todo' | 'doing' | 'done' | 'blocked' | 'review';

interface PhaseInput {
  name: string;
  steps: string[];
}

// Sheet types
interface SearchMatch {
  row: number;
  column: string;
  value: string;
}

// Config
interface SheetAgentConfig {
  spreadsheetId: string;
  credentials?: ServiceAccountCredentials;
  keyFile?: string;
  dryRun?: boolean;
}
```

---

## Usage Example

### Connect

```typescript
import { SheetAgent } from 'g-sheet-agent-io';

// Use static .connect() for async initialization
const agent = await SheetAgent.connect({
  spreadsheetId: '1abc123...',
  keyFile: './service-account.json'
});

// Properties available immediately
console.log(agent.spreadsheetId);  // "1abc123..."
console.log(agent.system);  // "# Sales Report Agent\n\nYou are..."

// Workspace (AGENT_BASE) was auto-created if missing
```

### Create Plan

```typescript
await agent.createPlan(
  "Q4 Sales Report",
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
      "Update Dashboard!A1:G10"
    ]}
  ]
);
```

### Execute Loop

```typescript
let task = await agent.getNextTask();

while (task) {
  await agent.updateTask(task.step, { status: 'doing' });
  
  try {
    // Read multiple ranges efficiently
    const [orders, products] = await agent.batchRead([
      { sheet: 'Orders', range: 'A2:F500' },
      { sheet: 'Products', range: 'A2:D200' }
    ]);
    
    // Process data...
    const processedRows = orders.rowCount;
    
    // Track working state in Notes
    await agent.appendNotes(`processed_rows: ${processedRows}`);
    await agent.appendNotes(`timestamp: ${new Date().toISOString()}`);
    
    await agent.updateTask(task.step, { status: 'done' });
    
  } catch (error) {
    await agent.updateTask(task.step, { 
      status: 'blocked', 
      reason: error.message 
    });
    break;
  }
  
  task = await agent.getNextTask();
}
```

### Working Memory via Notes

```typescript
// Append state to Notes section
await agent.appendNotes('last_processed_row: 487');
await agent.appendNotes('user_threshold: 0.05');
await agent.appendNotes('batch_size: 100');

// Results in plan's Notes section:
// ## Notes
// 
// last_processed_row: 487
// user_threshold: 0.05
// batch_size: 100
```

### Request Human Review

```typescript
// When agent needs human verification
await agent.updateTask('2.3', { 
  status: 'review', 
  note: 'Please verify 5% threshold is correct' 
});

// Check for pending reviews
const reviews = await agent.getReviewTasks();
if (reviews.length > 0) {
  console.log('Waiting for human review:', reviews.map(t => t.step));
}
```

### Working Memory via Notes

Instead of separate memory methods, use the plan's Notes section:

```typescript
// Get current plan
const plan = await agent.getPlan();

// Parse notes for working state
const notes = plan.notes;
const lastRow = notes.match(/last_processed_row: (\d+)/)?.[1];

// Update notes by modifying plan
// (append to Notes section manually or via helper)
```

For simple state, the Notes section is sufficient. Complex state should be stored in dedicated sheet columns.

---

## Error Handling

### Error Types

```typescript
// Auth errors
AuthError: No credentials found
  Set one of:
    • options.credentials (object)
    • CREDENTIALS_CONFIG env var (Base64)
    • options.keyFile (path)

// Permission errors
PermissionError: Cannot access sheet 'Leads'
  Fix: Share with service@project.iam.gserviceaccount.com

// Plan errors
PlanError: No plan exists
  Fix: Call initPlan() or createPlan()

// Validation errors
ValidationError: Invalid range 'XYZ'
  Expected A1 notation like 'A1:C10'
```

### Retry Behavior

| Error | Retryable | Backoff |
|-------|-----------|---------|
| 429 Rate Limit | Yes | Exponential |
| 5xx Server Error | Yes | Exponential |
| Network timeout | Yes | Exponential |
| 400 Bad Request | No | — |
| 401/403 Auth | No | — |

Default: 3 retries, 1s → 2s → 4s backoff

---

## Configuration

### Auth Priority

1. `options.credentials` — Direct object
2. `CREDENTIALS_CONFIG` — Base64 env var
3. `options.keyFile` — File path (local dev)

### Serverless Setup

```bash
# Encode credentials
cat service-account.json | base64 -w 0 > credentials.txt

# Set env var
CREDENTIALS_CONFIG="eyJ0eXBlIjoic2VydmljZV9hY2NvdW50Ii..."
```

### Options

```typescript
interface SheetAgentConfig {
  spreadsheetId: string;
  
  // Auth (pick one)
  credentials?: ServiceAccountCredentials;
  keyFile?: string;
  
  // Behavior
  dryRun?: boolean;              // Log without writing
  defaultFormat?: 'object' | 'array';
  
  // Rate limiting
  rateLimit?: {
    requestsPerMinute?: number;  // Default: 250
    retryAttempts?: number;      // Default: 3
    backoffMs?: number;          // Default: 1000
  };
}
```

---

## Bundle Breakdown

| Component | Size |
|-----------|------|
| googleapis (tree-shaken) | 18KB |
| Plan manager + parser | 3KB |
| Sheet operations | 3KB |
| Auth + errors | 2KB |
| Types | 1KB |
| **Total gzipped** | **~25KB** |

Compare: google-spreadsheet = 500KB+

---

## Implementation Timeline

### Week 1: Foundation
- Project setup (tsup, vitest, tsconfig)
- Auth handling (credentials, keyFile, env var)
- Basic read/write/listSheets
- Error types
- AGENT_BASE sheet creation

**Gate:** Build passes, <30KB

### Week 2: Plan System
- PLAN.md parser (regex-based)
- Auto-init + AGENT.md loading in `.connect()`
- `.system` and `.spreadsheetId` properties
- getPlan, createPlan, updateTask, appendNotes
- getNextTask, getReviewTasks

**Gate:** Plan tests pass, 90% coverage

### Week 3: Polish & Ship
- batchRead for multi-range efficiency
- search, createSheet
- Retry logic
- Dry run mode
- Documentation
- Examples
- Publish v1.0.0

**Gate:** All metrics met

---

## Success Metrics

### Launch Gates

| Metric | Target | Blocks Release |
|--------|--------|----------------|
| Bundle size | <30KB | Yes |
| Test coverage | 90% | Yes (85% min) |
| Agent methods | ≤12 | Yes |
| Setup time | <5 min | No |

### Adoption (3 months)

| Month | Downloads/week |
|-------|----------------|
| 1 | 50+ |
| 2 | 150+ |
| 3 | 300+ |

---

## Comparison: v4.0 → v4.5

| Aspect | v4.0 | v4.5 |
|--------|------|------|
| Bundle target | 35KB | 30KB |
| Column A | Memory (key-value) | AGENT.md (system prompt) |
| Column B | PLAN.md | PLAN.md |
| Initialization | Manual `initPlan()` | **Auto via `.connect()`** |
| Agent context | Manual `getAgent()` | **Auto-loaded as `.system` property** |
| Task status methods | 4 (start, complete, block, review) | **1** (`updateTask`) |
| Working memory | Separate memory methods | **`appendNotes()`** |
| Batch reads | N/A | **`batchRead()`** |
| Agent methods | 17 | 12 |
| Properties | 0 | 2 (`system`, `spreadsheetId`) |

### New in v4.5

**`appendNotes(line)`** — Simple working memory:
```typescript
await agent.appendNotes('last_row: 487');
await agent.appendNotes('threshold: 0.05');
// Appends to ## Notes section in PLAN.md
```

**`batchRead(queries)`** — Efficient multi-range reads:
```typescript
const [orders, products, inventory] = await agent.batchRead([
  { sheet: 'Orders', range: 'A2:F500' },
  { sheet: 'Products', range: 'A2:D200' },
  { sheet: 'Inventory', range: 'A2:C100' }
]);
// Single API call instead of 3
```

**`.system` property** — Renamed from `.context` for clarity:
```typescript
console.log(agent.system);  // Matches "system prompt" terminology
```

**`.spreadsheetId` property** — For logging/debugging:
```typescript
console.log(`Working on: ${agent.spreadsheetId}`);
```

### Why Remove Memory?

1. **Redundant** — Notes section can store key-value pairs
2. **Simpler** — Fewer concepts to learn
3. **Lighter** — Smaller bundle
4. **LLM-native** — Markdown notes are natural for LLMs

### Where to Store State Now

| State Type | Location |
|------------|----------|
| Agent identity | AGENT.md (A2) |
| Current goals | PLAN.md phases |
| Task status | PLAN.md checkboxes |
| Working variables | PLAN.md Notes section |
| Persistent data | Dedicated sheet columns |

---

## Quick Reference

```typescript
// Connect (auto-initializes workspace, loads AGENT.md)
const agent = await SheetAgent.connect({ spreadsheetId, keyFile });

// Properties (read-only)
agent.system;         // AGENT.md content
agent.spreadsheetId;  // Sheet ID for logging

// Plan workflow
const plan = await agent.getPlan();
await agent.createPlan(title, goal, phases);
await agent.appendNotes('key: value');

// Task execution
const task = await agent.getNextTask();
await agent.updateTask(task.step, { status: 'doing' });
await agent.updateTask(task.step, { status: 'done' });
await agent.updateTask(task.step, { status: 'blocked', reason: '...' });
await agent.updateTask(task.step, { status: 'review', note: '...' });

// Reviews
const reviews = await agent.getReviewTasks();

// Sheet operations  
const { rows } = await agent.read({ sheet: 'Sales', range: 'A2:D100' });
const results = await agent.batchRead([
  { sheet: 'Orders', range: 'A2:F500' },
  { sheet: 'Products', range: 'A2:D200' }
]);
await agent.write({ sheet: 'Summary', range: 'B5', data: [[total]] });
const sheets = await agent.listSheets();
const { matches } = await agent.search({ sheet: 'Contacts', query: 'john' });
await agent.createSheet('NewTab');
```

### API Summary

| Type | Name | Description |
|------|------|-------------|
| **Property** | `system` | AGENT.md content (read-only) |
| | `spreadsheetId` | Connected sheet ID |
| **Plan** | `getPlan()` | Read plan from B2 |
| | `createPlan()` | Create/replace plan |
| | `getNextTask()` | Next `[ ]` todo task |
| | `getReviewTasks()` | All `[!]` review tasks |
| | `updateTask()` | Change task status |
| | `appendNotes()` | Add line to Notes section |
| **Sheet** | `read()` | Read single range |
| | `batchRead()` | Read multiple ranges (1 API call) |
| | `write()` | Write data |
| | `listSheets()` | List all tabs |
| | `search()` | Find values |
| | `createSheet()` | Add new tab |

---

## Workspace Layout

```
AGENT_BASE
┌─────────────────────────────┬─────────────────────────────┐
│             A               │             B               │
├─────────────────────────────┼─────────────────────────────┤
│ AGENT.md Contents           │ PLAN.md Contents            │ ← Row 1 (markers)
├─────────────────────────────┼─────────────────────────────┤
│ # Sales Report Agent        │ # Plan: Q4 Report           │ ← Row 2 (content)
│                             │                             │
│ You are a spreadsheet       │ Goal: Generate summary...   │
│ assistant that analyzes     │                             │
│ sales data...               │ ## Analysis                 │
│                             │ - Spreadsheet: Q4 Sales     │
│ ## Capabilities             │ - Key sheets: Orders...     │
│ - Read sales data           │                             │
│ - Calculate totals          │ ### Phase 1: Data           │
│ - Generate reports          │ - [x] 1.1 Read Orders ✅    │
│                             │ - [/] 1.2 Read Products     │
│ ## Constraints              │                             │
│ - Never delete data         │ ## Notes                    │
│ - Ask before overwrites     │ last_row: 487               │
│                             │ threshold: 0.05             │
└─────────────────────────────┴─────────────────────────────┘
      WHO (stable)                  WHAT (active)
```

---

*Version 4.5 — `.system` + `appendNotes()` + `batchRead()`*
