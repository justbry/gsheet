# Goal: Implement g-sheet-agent-io TypeScript Library

Build a <30KB TypeScript library that adds agent workspace capabilities to Google Sheets, following the PRD in `specs/PDR-v4.5.md`.

## Project Philosophy

> "The most successful implementations weren't using complex frameworks. They were building with simple, composable patterns."
> — Anthropic, *Building Effective Agents*

This library embraces:
- **One job per method** — Clear, focused APIs
- **Plan-driven execution** — PLAN.md as external memory and state tracker
- **Human-readable state** — Everything visible and editable in sheets
- **Minimal surface area** — 12 agent methods (6 plan + 6 sheet) + 2 properties
- **Auto-initialization** — System loads AGENT.md and creates AGENT_BASE on connect

## Key Metrics

| Metric | Target | Hard Limit |
|--------|--------|------------|
| Bundle size (gzipped) | 25KB | 30KB |
| Agent methods | 12 | 15 |
| Properties | 2 | 3 |
| Test coverage | 90% | 85% |

## What This Library Does NOT Do

- ❌ Multi-agent coordination (single agent per workspace)
- ❌ OAuth flows (service account only)
- ❌ Real-time sync (polling-based)
- ❌ Auto-grant sheet access (user shares manually)
- ❌ Store credentials (user provides via env/config)
- ❌ Key-value memory storage (use plan Notes section)

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
│  │  • getPlan()        │   │  • read()                   │  │
│  │  • createPlan()     │   │  • write()                  │  │
│  │  • getNextTask()    │   │  • listSheets()             │  │
│  │  • getReviewTasks() │   │  • search()                 │  │
│  │  • updateTask()     │   │  • createSheet()            │  │
│  │  • appendNotes()    │   │  • batchRead()              │  │
│  └──────────┬──────────┘   └─────────────────────────────┘  │
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

## Workspace Structure

Single AGENT_BASE sheet stores all agent state:

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

## API Reference

### System Behavior (Automatic)

These happen automatically inside the library—**not agent methods**:

```typescript
// INTERNAL: Called automatically on SheetAgent.connect()
// Agent never calls this directly
async function initialize(): Promise<void> {
  // 1. Validate spreadsheetId
  // 2. Check if AGENT_BASE sheet exists
  // 3. If missing: create sheet, write markers to A1/B1
  // 4. If A2 empty: write default AGENT.md
  // 5. If B2 empty: write starter PLAN.md
  // 6. Load AGENT.md into this.system property
  // 7. Throw error if spreadsheetId is invalid
}
```

**Triggered by:** `SheetAgent.connect()` static method

**Behavior:**
- Silent — no logs unless error
- Idempotent — safe if sheet already exists
- Non-destructive — never overwrites existing content
- Validates spreadsheetId — throws AuthError/PermissionError if invalid
- Caches AGENT.md — available as `agent.system` property

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
}
```

## Implementation Requirements

### Phase 1: Foundation (COMPLETED)
- [x] Project setup (tsup, vitest, tsconfig)
- [x] Auth handling (credentials, keyFile, env var)
- [x] Basic read/write operations
- [x] Error types with actionable messages
- [x] Retry logic with exponential backoff

### Phase 2: Core API (IN PROGRESS)
- [x] Static `SheetAgent.connect()` factory method ✅ (Iteration 21)
- [x] Auto-initialize AGENT_BASE sheet ✅ (Iteration 21 - uses initAgentBase())
- [x] Auto-load AGENT.md into `.system` property ✅ (Iteration 21)
- [x] Validate spreadsheetId (throw error if invalid) ✅ (Iteration 21)
- [x] Implement `batchRead()` for multi-range reads ✅ (Iteration 22)
- [x] Implement plan methods: `getPlan()`, `createPlan()`, `getNextTask()`, `getReviewTasks()`, `updateTask()`, `appendNotes()` ✅ (Already implemented)
- [x] Implement sheet methods: `read()`, `write()`, `listSheets()`, `search()`, `createSheet()` ✅ (Already implemented)
- [x] Add `updateTask()` and `appendNotes()` wrapper methods to SheetAgent ✅ (Iteration 23)
- [x] Remove lifecycle methods (pause, resume, status, ensureInitialized, checkPaused) ✅ (Iteration 24)
- [x] Remove advanced operations (append, formatCells, writeFormula, readFormulas, getCellMetadata, batchUpdate) ✅ (Iteration 25)
- [x] Remove context-aware operations (readWithContext, writeWithContext, searchWithContext, appendWithContext) ✅ (Iteration 25)
- [x] Remove workspace and history methods (validateWorkspace, fetchHistory, logAction) ✅ (Iteration 26)
- [x] Remove old task methods (startTask, completeTask, blockTask, reviewTask) ✅ (Iteration 27)
- [x] Clean up unused imports and types ✅ (Iteration 28)
  - Made `initAgentBase()` private (not part of public API)
  - Removed `AgentPausedError` export (lifecycle methods were removed)
  - Added `PlanError` class for plan-related errors
  - Removed orphaned manager files: `agent-base-manager.ts`, `history-manager.ts`, `table-config-manager.ts`
  - Removed orphaned utility files: `schema-generator.ts`, `constants.ts`, `table-config.ts`, `parse-json.ts`, `id-generator.ts`
  - Fixed TypeScript strict mode errors in `plan-manager.ts`
- [x] Consolidate to exactly 12 methods + 2 properties ✅ (Iteration 29)
  - Fixed PLAN.md column mismatch: changed initializeAgentBaseContent from C1/C2 to B1/B2 to match PlanManager
  - Verified public API: 12 methods (6 plan + 6 sheet) + 2 properties
    - Static: `connect()` (factory method)
    - Properties: `system`, `spreadsheetId`
    - Plan methods: `getPlan()`, `createPlan()`, `getNextTask()`, `getReviewTasks()`, `updateTask()`, `appendNotes()`
    - Sheet methods: `read()`, `batchRead()`, `write()`, `listSheets()`, `search()`, `createSheet()`

### Phase 3: Managers
- [x] Update PlanManager to read from column B (not C) ✅ (Already implemented)
- [x] Add `appendNotes()` method to PlanManager ✅ (Already implemented)
- [x] Add `updateTask()` method to PlanManager ✅ (Already implemented)
- [x] Update AgentBaseManager markers: "AGENT.md Contents" ✅ (Already implemented)
- [x] Keep HistoryManager internal (not in public API) ✅ (Not exported in index.ts)

### Phase 4: Testing & Polish
- [x] Clean up test suite (remove tests for removed methods) ✅ (Iteration 30)
  - Deleted 6 obsolete test files for removed features:
    - `lifecycle.test.ts` (pause/resume/status)
    - `context-aware.test.ts` (readWithContext, etc.)
    - `history.test.ts` (fetchHistory, logAction)
    - `workspace.test.ts` (initAgentBase, validateWorkspace)
    - `tasks.test.ts` (old task queue: scheduleTask, fetchTask, etc.)
    - `append.test.ts` (append, appendWithContext)
  - Completely rewrote `agent.test.ts`:
    - Removed tests for `ensureInitialized()`, `batchUpdate()`, `formatCells()`, `writeFormula()`, `readFormulas()`, `getCellMetadata()`
    - Added tests for constructor, `spreadsheetId` property, `system` property, `batchRead()`, retry logic
    - All 49 agent tests now passing
  - Updated `mock-factory.ts` helpers (removed `WorkspaceConfig` import and mock)
  - Updated `integration/sheets-api.test.ts`:
    - Use `SheetAgent.connect()` instead of `new SheetAgent()` + `initAgentBase()`
    - Replaced removed method tests (status, pause, resume, validateWorkspace) with new API tests
    - Fixed PhaseInput type (use `steps` not `tasks`)
    - Added tests for properties, batchRead, listSheets, plan management
- [x] Fix integration tests - fixed sheet names (TESTS → Schedule/AGENT_BASE) ✅ (Iteration 31)
- [x] Add comprehensive tests for plan-manager.ts (99.22% coverage) ✅ (Iteration 31)
  - Added 29 tests covering: getPlan(), getNextTask(), getReviewTasks(), createPlan(), updateTask(), appendNotes()
  - Tests cover parsing of analysis, questions, notes sections
  - Tests cover task status updates (doing, done, blocked, review)
  - Tests cover edge cases (no plan, empty content, sub-steps)
- [ ] Add tests for agent.ts methods (current: 54.39% - PRIORITY)
  - **Uncovered:** Lines 126-144 (`loadSystem()`), 327-355 (`loadDefaultAgentBasePrompt()`), 372-609 (`initAgentBase()` + helpers)
  - **Need tests for:**
    - `loadSystem()` - loading AGENT.md content from A2
    - `loadDefaultAgentBasePrompt()` - file loading with fallback
    - `generateStarterPlanMarkdown()` - starter plan generation
    - `initAgentBase()` - workspace initialization
    - `initializeAgentBaseContent()` - marker checking and content writing
  - **Target:** 85%+ coverage for agent.ts
- [ ] Add tests for sheet-client.ts (current: 92.22% - good!)
- [x] Ensure 85%+ test coverage **CURRENT: 76.46%** (need +8.54%)
- [x] Verify bundle size < 30KB gzipped **CURRENT: 6.6KB** ✅

### Phase 5: Code Simplification

**Goal:** Reduce complexity and improve maintainability without changing functionality.

**Key Simplifications:**

1. **Extract `initializeCellContent()` helper** - Reduce duplication in `initializeAgentBaseContent()`
   ```typescript
   // Current: 90 lines of repetitive code checking markers and writing content
   // Target: Extract helper that handles check-marker-and-write pattern

   private async initializeCellContent(
     client: sheets_v4.Sheets,
     cellRef: string,  // e.g., "A1", "B1"
     markerText: string,  // e.g., "AGENT.md Contents"
     contentCellRef: string,  // e.g., "A2", "B2"
     contentGetter: () => Promise<string>
   ): Promise<void>
   ```

2. **Extract header detection logic** - Simplify `read()` method
   ```typescript
   // Current: Lines 220-249 in read() method (30 lines of header logic)
   // Target: Extract to private helper method

   private parseHeaders<T>(
     values: unknown[][],
     options: ReadOptions<T>
   ): { headers: string[]; dataRows: unknown[][] }
   ```

3. **Simplify `batchRead()` validation** - Reduce nesting
   ```typescript
   // Current: Nested validation with array indexing
   // Target: Use .forEach() or .map() with early return

   private validateBatchQueries(queries: BatchReadQuery[]): void {
     if (!queries?.length) {
       throw new ValidationError('queries required and must not be empty');
     }
     queries.forEach((q, i) => {
       if (!q.sheet && q.sheet !== 0) {
         throw new ValidationError(`queries[${i}].sheet is required`);
       }
     });
   }
   ```

4. **Use batch write for AGENT_BASE initialization** - Single API call instead of 4
   ```typescript
   // Current: 4 separate API calls (A1 marker, A2 content, B1 marker, B2 content)
   // Target: 1 batch update with all 4 cells

   await client.spreadsheets.values.batchUpdate({
     spreadsheetId: this.options.spreadsheetId,
     valueInputOption: 'USER_ENTERED',
     requestBody: {
       data: [
         { range: 'AGENT_BASE!A1', values: [['AGENT.md Contents']] },
         { range: 'AGENT_BASE!A2', values: [[agentContext]] },
         { range: 'AGENT_BASE!B1', values: [['PLAN.md Contents']] },
         { range: 'AGENT_BASE!B2', values: [[starterPlan]] }
       ]
     }
   });
   ```

5. **Reduce nesting in `convertToObjects()`** - Improve readability
   ```typescript
   // Review method at lines ~850-890 for simplification opportunities
   ```

**Implementation Guidelines:**
- Keep all existing functionality (no behavior changes)
- Add tests if logic changes significantly
- Maintain current error handling
- Prefer readability over cleverness
- Each refactor should be in its own commit

**Success Criteria:**
- [ ] `initializeAgentBaseContent()` reduced from ~90 lines to ~40 lines
- [ ] Header detection extracted (read() method -30 lines)
- [ ] Validation extracted from batchRead() (-15 lines)
- [ ] AGENT_BASE init uses 1 batch call instead of 4 calls
- [ ] All tests still passing
- [ ] No change in test coverage %

## Success Criteria

| Metric | Target | Status |
|--------|--------|--------|
| Bundle size | <30KB gzipped | ⏳ Pending |
| Test coverage | ≥85% | ⏳ Pending |
| API methods | 12 | ⏳ Pending |
| Properties | 2 | ⏳ Pending |
| All tests pass | 100% | ⏳ Pending |
| Invalid SHEETID throws | Yes | ⏳ Pending |

## Usage Example

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

// Create plan
await agent.createPlan(
  "Q4 Sales Report",
  "Aggregate order data and populate Summary dashboard",
  [
    { name: "Data Collection", steps: [
      "Read Orders!A2:F500",
      "Read Products!A2:D200"
    ]},
    { name: "Output", steps: [
      "Write summary to Summary!B5"
    ]}
  ]
);

// Execute loop
let task = await agent.getNextTask();

while (task) {
  await agent.updateTask(task.step, { status: 'doing' });

  try {
    // Read multiple ranges efficiently
    const [orders, products] = await agent.batchRead([
      { sheet: 'Orders', range: 'A2:F500' },
      { sheet: 'Products', range: 'A2:D200' }
    ]);

    // Track state in Notes
    await agent.appendNotes(`processed_rows: ${orders.rowCount}`);

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

## Error Handling Requirements

### Error Handling Principles

1. **Actionable Messages** - Every error must tell the user exactly how to fix it
2. **Context First** - Include what operation failed and with what inputs
3. **Solution Paths** - Provide multiple fix options when available
4. **Developer-Friendly** - Include technical details that help debugging
5. **No Generic Errors** - Never throw `Error("something went wrong")`

### Error Classes (from src/errors.ts)

Use the existing error classes with proper context:

```typescript
import {
  AuthError,           // Authentication/credentials failures
  PermissionError,     // Access denied, invalid IDs, missing permissions
  ValidationError,     // Invalid input, bad format
  PlanError           // Plan-related issues (missing plan, task not found)
} from './errors';
```

### Error Message Format

**Template:**
```
[Context]: [What failed]

  [Why it failed - root cause]

  Fix: [Step-by-step solution]
  OR: [Alternative solution if applicable]
```

**Example:**
```typescript
throw new PermissionError(
  `Cannot access spreadsheet '${spreadsheetId}'`,
  `The spreadsheet may not exist, or the service account doesn't have access.\n\n` +
  `Fix: Share spreadsheet with: ${serviceAccountEmail}\n` +
  `OR: Verify spreadsheet ID is correct\n` +
  `OR: Check service account key file has valid credentials`
);
```

### Required Error Scenarios

#### 1. Authentication Errors

**No credentials provided:**
```typescript
throw new AuthError(
  'No credentials found',
  'Service account credentials are required to access Google Sheets.\n\n' +
  'Fix: Provide credentials using ONE of:\n' +
  '  • options.credentials - Pass credentials object directly\n' +
  '  • CREDENTIALS_CONFIG - Set Base64-encoded env var\n' +
  '  • options.keyFile - Path to service-account.json file\n\n' +
  'Example:\n' +
  '  await SheetAgent.connect({ spreadsheetId, keyFile: "./key.json" })'
);
```

**Invalid credentials format:**
```typescript
throw new AuthError(
  'Invalid service account credentials',
  `Credentials must include: type, project_id, private_key, client_email.\n\n` +
  `Fix: Download a new service account key from Google Cloud Console:\n` +
  `  1. Go to IAM & Admin > Service Accounts\n` +
  `  2. Select your service account\n` +
  `  3. Keys > Add Key > Create New Key > JSON`
);
```

#### 2. Permission Errors

**Invalid spreadsheet ID:**
```typescript
throw new PermissionError(
  `Cannot access spreadsheet '${spreadsheetId}'`,
  `The spreadsheet was not found or you don't have access.\n\n` +
  `Fix: Verify the spreadsheet ID is correct\n` +
  `  • Current ID: ${spreadsheetId}\n` +
  `  • Format should be: 1abc...xyz (40+ characters)\n` +
  `  • Found in URL: https://docs.google.com/spreadsheets/d/[ID]/edit\n\n` +
  `OR: Share spreadsheet with service account:\n` +
  `  1. Open spreadsheet\n` +
  `  2. Click Share\n` +
  `  3. Add email: ${serviceAccountEmail}\n` +
  `  4. Grant Editor access`
);
```

**Sheet not found:**
```typescript
throw new PermissionError(
  `Sheet '${sheetName}' not found in spreadsheet`,
  `The sheet tab doesn't exist in this spreadsheet.\n\n` +
  `Fix: Check available sheets:\n` +
  `  const sheets = await agent.listSheets();\n` +
  `  console.log('Available:', sheets);\n\n` +
  `OR: Create the sheet first:\n` +
  `  await agent.createSheet('${sheetName}');`
);
```

#### 3. Validation Errors

**Invalid range format:**
```typescript
throw new ValidationError(
  `Invalid range format: '${range}'`,
  `Range must use A1 notation (e.g., 'A1:B10').\n\n` +
  `Fix: Use correct format:\n` +
  `  ✓ 'A1:B10' - Specific range\n` +
  `  ✓ 'A:B' - Entire columns\n` +
  `  ✓ '1:10' - Entire rows\n` +
  `  ✗ 'invalid' - Not A1 notation\n\n` +
  `Your range: '${range}'`
);
```

**Invalid task status:**
```typescript
throw new ValidationError(
  `Invalid task status update`,
  `Status must be one of: 'doing', 'done', 'blocked', 'review'.\n\n` +
  `Fix: Use proper TaskUpdate object:\n` +
  `  await agent.updateTask(step, { status: 'doing' });\n` +
  `  await agent.updateTask(step, { status: 'done' });\n` +
  `  await agent.updateTask(step, { status: 'blocked', reason: '...' });\n` +
  `  await agent.updateTask(step, { status: 'review', note: '...' });`
);
```

#### 4. Plan Errors

**No plan exists:**
```typescript
throw new PlanError(
  'No plan exists',
  `Cannot get tasks because no plan has been created.\n\n` +
  `Fix: Create a plan first:\n` +
  `  await agent.createPlan(\n` +
  `    "Plan Title",\n` +
  `    "Goal description",\n` +
  `    [{ name: "Phase 1", steps: ["Step 1", "Step 2"] }]\n` +
  `  );`
);
```

**Task not found:**
```typescript
throw new PlanError(
  `Task '${step}' not found in plan`,
  `The task step doesn't exist in the current plan.\n\n` +
  `Fix: Check available tasks:\n` +
  `  const plan = await agent.getPlan();\n` +
  `  plan.phases.forEach(phase => {\n` +
  `    phase.tasks.forEach(task => console.log(task.step));\n` +
  `  });\n\n` +
  `Available tasks: ${availableSteps.join(', ')}`
);
```

#### 5. API Errors (Google Sheets)

**Rate limit exceeded:**
```typescript
throw new Error(
  'Google Sheets API rate limit exceeded',
  `Too many requests in a short time.\n\n` +
  `Fix: Wait and retry:\n` +
  `  • Default: 100 requests per 100 seconds per user\n` +
  `  • The library auto-retries with exponential backoff\n` +
  `  • Reduce request frequency if this persists\n\n` +
  `OR: Use batchRead() to combine multiple reads:\n` +
  `  const [orders, products] = await agent.batchRead([\n` +
  `    { sheet: 'Orders', range: 'A2:F500' },\n` +
  `    { sheet: 'Products', range: 'A2:D200' }\n` +
  `  ]);`
);
```

### Error Context Patterns

**Always include:**
1. **Operation** - What was being attempted
2. **Input values** - What parameters were used
3. **Current state** - Relevant system state
4. **Fix steps** - Numbered, actionable steps

**Good Error:**
```typescript
throw new ValidationError(
  `Cannot write to range 'Sheet1!A1:B2' with data size [5x3]`,
  `Data dimensions (5 rows × 3 columns) don't match range (2 rows × 2 columns).\n\n` +
  `Fix: Adjust range to match data:\n` +
  `  1. Data size: ${rows.length} rows × ${rows[0].length} columns\n` +
  `  2. Use range: 'Sheet1!A1:C5'\n` +
  `  3. Or use append() to auto-size:\n` +
  `     await agent.append({ sheet: 'Sheet1', data: rows });`
);
```

**Bad Error:**
```typescript
throw new Error('Invalid data');  // ❌ No context, no fix
```

### Testing Error Scenarios

**Add tests for every error type:**

```typescript
describe('Error Handling', () => {
  it('throws AuthError with actionable message when no credentials', async () => {
    await expect(
      SheetAgent.connect({ spreadsheetId: 'test' })
    ).rejects.toThrow(AuthError);

    await expect(
      SheetAgent.connect({ spreadsheetId: 'test' })
    ).rejects.toThrow(/options\.credentials|CREDENTIALS_CONFIG|keyFile/);
  });

  it('throws PermissionError with fix steps for invalid spreadsheetId', async () => {
    const agent = await SheetAgent.connect({
      spreadsheetId: 'invalid-id',
      keyFile: './key.json'
    });

    await expect(agent.read({ sheet: 'Test' }))
      .rejects.toThrow(PermissionError);

    await expect(agent.read({ sheet: 'Test' }))
      .rejects.toThrow(/Share spreadsheet with/);
  });

  it('throws ValidationError with format examples for invalid range', async () => {
    await expect(
      agent.read({ sheet: 'Test', range: 'invalid' })
    ).rejects.toThrow(ValidationError);

    await expect(
      agent.read({ sheet: 'Test', range: 'invalid' })
    ).rejects.toThrow(/A1 notation/);
  });

  it('throws PlanError with creation example when no plan exists', async () => {
    await expect(agent.getNextTask())
      .rejects.toThrow(PlanError);

    await expect(agent.getNextTask())
      .rejects.toThrow(/createPlan/);
  });
});
```

### Error Recovery Patterns

**Implement graceful fallbacks where appropriate:**

```typescript
// Example: Load system with fallback
private async loadSystem(): Promise<void> {
  try {
    const response = await this.executeWithRetry(async () => {
      return client.spreadsheets.values.get({
        spreadsheetId: this.options.spreadsheetId,
        range: `${WorkspaceSheets.AGENT_BASE}!A2`,
      });
    });
    this._system = (response.data.values?.[0]?.[0] as string) || '';
  } catch (error) {
    // Graceful fallback - don't throw, just log
    console.warn('Could not load AGENT.md, using empty system context');
    this._system = '';
  }
}
```

### Implementation Checklist

- [ ] Replace all generic `throw new Error()` with specific error classes
- [ ] Add "Fix:" section to every error message
- [ ] Include relevant values (IDs, ranges, etc.) in error context
- [ ] Add retry logic for transient API failures
- [ ] Write tests for each error scenario
- [ ] Validate error messages include actionable steps
- [ ] Add examples in error messages where helpful
- [ ] Include links to docs/guides for complex fixes

## Reference

Full PRD specification: `specs/PDR-v4.5.md`
