# Specification: PLAN.md System for Sheet-Grounded Agents

## Overview

A single markdown file stored in `AGENT_BASE!C2`. The agent reads, updates, and tracks progress using checkbox syntax. Format inspired by Claude Code's plan mode but with lightweight structure for parseability.

---

## Format

```markdown
# Plan: [Title]

Goal: [One sentence describing success]

## Analysis

- Spreadsheet: [spreadsheet name/ID]
- Key sheets: [sheet names]
- Target ranges: 
  - Read: Sheet!Range (description of data)
  - Write: Sheet!Range (description of data)
- Current state: [what data exists]

## Questions for User

- [Clarifying question 1]
- [Clarifying question 2]

### Phase 1: [Name]
- [ ] 1.1 First step
- [ ] 1.2 Second step

### Phase 2: [Name]
- [ ] 2.1 Step one
- [ ] 2.2 Step two

### Phase 3: [Name]
- [ ] 3.1 Step one
- [ ] 3.2 Step two

## Notes

[Context, links, learnings, decisions]
```

---

## Status Syntax

| Syntax | Status | When to Use |
|--------|--------|-------------|
| `- [ ]` | Todo | Not started |
| `- [/]` | Doing | Currently working on |
| `- [x]` | Done | Completed |
| `- [>]` | Blocked | Waiting on something |
| `- [!]` | Review | Needs human review/input |

### Flow

```
[ ] → [/] → [x]
       ↓
      [>] → [/] → [x]
       ↓
      [!] → [/] → [x]
```

---

## Structure

### Phase Headers

Group related steps under `### Phase N: Name` headers:

```markdown
### Phase 1: Data Collection
- [x] 1.1 Read Inventory!A2:D100 (SKU, name, quantity, location) ✅ 2026-01-10
- [x] 1.2 Read Pricing!A2:C50 (SKU, unit cost, sale price) ✅ 2026-01-10

### Phase 2: Processing
- [/] 2.1 Calculate totals in Orders!E2:E100 (extended price per line)
- [ ] 2.2 Update Summary!B5:B20 (category subtotals)

### Phase 3: Validation
- [>] 3.1 Verify formulas in Summary!C5:C20 (margin percentages) — waiting for pricing data
- [ ] 3.2 Check for missing SKUs in Inventory!A:A (product codes)
```

### Step Numbering

Use `Phase.Step` format:

- Phase 1 steps: `1.1`, `1.2`, `1.3`
- Phase 2 steps: `2.1`, `2.2`, `2.3`
- Sub-steps (if needed): `2.1.1`, `2.1.2`

---

## Sections

### Analysis

Capture sheet context before planning:

```markdown
## Analysis

- Spreadsheet: Q4 Sales Report (ID: 1a2b3c...)
- Key sheets: Orders, Inventory, Summary, Dashboard
- Target ranges: 
  - Read: Orders!A2:F500 (order ID, date, customer, SKU, qty, total)
  - Read: Inventory!A2:D200 (SKU, product name, stock qty, reorder point)
  - Write: Summary!B5:E20 (category, units sold, revenue, margin)
  - Write: Dashboard!A1:G10 (KPI metrics and chart data)
- Current state: Orders has 487 rows through 2026-01-09
- Dependencies: Inventory must be current before processing
```

### Questions for User

Clarify before executing:

```markdown
## Questions for User

- Should archived orders (column F = "archived") be included in totals?
- Which date range for the report? (default: current quarter)
- Should Dashboard!A1 header be updated with run date?
```

Remove section once questions are answered, or mark answers inline.

---

## Annotations

**Completion date** (auto-added when done):
```markdown
- [x] 1.1 Read Orders!A2:F500 (order transactions) ✅ 2026-01-10
```

**Blocked reason** (inline after `—`):
```markdown
- [>] 3.1 Update Pricing!D2:D100 (sale prices) — waiting for supplier data in column C
```

**Review note** (inline after `—`):
```markdown
- [!] 2.3 Formula in Summary!E10 (grand total) — please verify SUM range is correct
```

---

## Storage

| Location | Cell | Content |
|----------|------|---------|
| `AGENT_BASE` | `C2` | Full markdown text |

---

## Types

```typescript
type TaskStatus = 'todo' | 'doing' | 'done' | 'blocked' | 'review';

interface PlanTask {
  line: number;        // Line index in markdown
  phase: number;       // Phase number (1, 2, 3...)
  step: string;        // "1.1", "1.2", "2.1", etc.
  status: TaskStatus;
  title: string;
  completedDate?: string;
  blockedReason?: string;
  reviewNote?: string;
}

interface PlanAnalysis {
  spreadsheet: string;
  keySheets: string[];
  targetRanges: {
    read: string[];
    write: string[];
  };
  currentState?: string;
}

interface Plan {
  title: string;
  goal: string;
  analysis?: PlanAnalysis;
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
```

---

## API (8 methods)

```typescript
class PlanManager {
  constructor(private sheets: SheetsClient, private cell = 'AGENT_BASE!C2') {}
  
  // Initialize
  initPlan(): Promise<Plan>
  
  // Read
  getPlan(): Promise<Plan | null>
  getNextTask(): Promise<PlanTask | null>
  getReviewTasks(): Promise<PlanTask[]>
  
  // Write  
  createPlan(title: string, goal: string, phases: PhaseInput[]): Promise<void>
  startTask(step: string): Promise<void>
  completeTask(step: string): Promise<void>
  blockTask(step: string, reason: string): Promise<void>
  reviewTask(step: string, note: string): Promise<void>
}

interface PhaseInput {
  name: string;
  steps: string[];
}
```

---

## Implementation

```typescript
const STATUS_MAP: Record<string, TaskStatus> = {
  ' ': 'todo',
  '/': 'doing',
  'x': 'done',
  '>': 'blocked',
  '!': 'review'
};

const STATUS_CHAR: Record<TaskStatus, string> = {
  'todo': ' ',
  'doing': '/',
  'done': 'x',
  'blocked': '>',
  'review': '!'
};

const TASK_REGEX = /^- \[(.)\] (\d+\.\d+(?:\.\d+)?)\s+(.+)$/;
const PHASE_REGEX = /^### Phase (\d+): (.+)$/;

function parsePlan(markdown: string): Plan {
  const lines = markdown.split('\n');
  const phases: Phase[] = [];
  let title = '', goal = '', analysis = '', currentPhase: Phase | null = null;
  let inAnalysis = false, inQuestions = false, inNotes = false;
  const questions: string[] = [];
  const noteLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('# Plan:')) {
      title = line.replace('# Plan:', '').trim();
    } else if (line.startsWith('Goal:')) {
      goal = line.replace('Goal:', '').trim();
    } else if (line.startsWith('## Analysis')) {
      inAnalysis = true; inQuestions = false; inNotes = false;
    } else if (line.startsWith('## Questions')) {
      inQuestions = true; inAnalysis = false; inNotes = false;
    } else if (line.startsWith('## Notes')) {
      inNotes = true; inAnalysis = false; inQuestions = false;
    } else if (line.startsWith('### Phase')) {
      inAnalysis = false; inQuestions = false; inNotes = false;
      const match = line.match(PHASE_REGEX);
      if (match) {
        currentPhase = { number: parseInt(match[1]), name: match[2], tasks: [] };
        phases.push(currentPhase);
      }
    } else if (inAnalysis && line.startsWith('- ')) {
      analysis += line.slice(2) + '\n';
    } else if (inQuestions && line.startsWith('- ')) {
      questions.push(line.slice(2));
    } else if (inNotes) {
      noteLines.push(line);
    } else {
      const match = line.match(TASK_REGEX);
      if (match && currentPhase) {
        const [, statusChar, step, content] = match;
        const completedMatch = content.match(/✅ (\d{4}-\d{2}-\d{2})/);
        const blockedMatch = content.match(/— (.+)$/);
        currentPhase.tasks.push({
          line: i,
          phase: currentPhase.number,
          step,
          status: STATUS_MAP[statusChar] || 'todo',
          title: content.replace(/✅ \d{4}-\d{2}-\d{2}/, '').replace(/— .+$/, '').trim(),
          completedDate: completedMatch?.[1],
          blockedReason: STATUS_MAP[statusChar] === 'blocked' ? blockedMatch?.[1] : undefined,
          reviewNote: STATUS_MAP[statusChar] === 'review' ? blockedMatch?.[1] : undefined
        });
      }
    }
  }
  
  return { 
    title, 
    goal, 
    analysis: analysis.trim() || undefined,
    questions: questions.length ? questions : undefined,
    phases, 
    notes: noteLines.join('\n').trim(), 
    raw: markdown 
  };
}

function updateTaskStatus(markdown: string, step: string, status: TaskStatus, annotation?: string): string {
  const lines = markdown.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(TASK_REGEX);
    if (match && match[2] === step) {
      let newLine = lines[i].replace(/^- \[.\]/, `- [${STATUS_CHAR[status]}]`);
      
      // Remove existing annotation
      newLine = newLine.replace(/ — .+$/, '').replace(/ ✅ \d{4}-\d{2}-\d{2}/, '');
      
      // Add completion date
      if (status === 'done') {
        const today = new Date().toISOString().split('T')[0];
        newLine += ` ✅ ${today}`;
      }
      
      // Add blocked/review reason
      if ((status === 'blocked' || status === 'review') && annotation) {
        newLine += ` — ${annotation}`;
      }
      
      lines[i] = newLine;
      break;
    }
  }
  
  return lines.join('\n');
}

class PlanManager {
  constructor(private sheets: SheetsClient, private cell = 'AGENT_BASE!C2') {}
  
  private readonly PLAN_MARKER = 'PLAN.md Contents';
  
  private readonly STARTER_PLAN = `# Plan: Getting Started with Sheet Agent

Goal: Learn the basic tools and workflows for working with spreadsheets

## Analysis

- Spreadsheet: [Your spreadsheet name]
- Key sheets: [List sheets you want to work with]
- Target ranges:
  - Read: [Ranges to read from]
  - Write: [Ranges to write to]
- Current state: Workspace initialized, ready for first task

## Questions for User

- What spreadsheet would you like to work with?
- What is your goal for this session?

### Phase 1: Orientation
- [ ] 1.1 List available sheets in the spreadsheet
- [ ] 1.2 Read headers from main data sheet to understand structure
- [ ] 1.3 Identify key columns and data types

### Phase 2: First Task
- [ ] 2.1 Define a specific goal with the user
- [ ] 2.2 Create a detailed plan for that goal
- [ ] 2.3 Execute the plan step by step

## Notes

This is a starter plan created by initPlan(). Replace it with createPlan() once you understand the user's goals.

Basic workflow:
1. Use getPlan() to check current plan
2. Use getNextTask() to find what to do next
3. Use startTask(step) before working on a task
4. Use completeTask(step) when done
5. Use blockTask(step, reason) if stuck
6. Use reviewTask(step, note) if human input needed
`;

  async initPlan(): Promise<Plan> {
    try {
      // Check if AGENT_BASE sheet exists
      const sheets = await this.sheets.listSheets();
      const hasAgentBase = sheets.includes('AGENT_BASE');
      
      if (hasAgentBase) {
        // Check if C1 contains plan marker
        const marker = await this.sheets.getCell('AGENT_BASE!C1');
        if (marker === this.PLAN_MARKER) {
          // Already initialized, return existing plan
          const existing = await this.getPlan();
          if (existing) return existing;
        }
      }
      
      // Create AGENT_BASE sheet if missing
      if (!hasAgentBase) {
        await this.sheets.createSheet('AGENT_BASE');
      }
      
      // Write marker to C1
      await this.sheets.setCell('AGENT_BASE!C1', this.PLAN_MARKER);
      
      // Write starter plan to C2
      await this.sheets.setCell(this.cell, this.STARTER_PLAN);
      
      // Return the starter plan
      return parsePlan(this.STARTER_PLAN);
      
    } catch (error) {
      // Handle errors gracefully - return a minimal plan
      console.error('initPlan error:', error);
      const fallbackPlan = `# Plan: Initialization Error

Goal: Recover from initialization error

## Analysis

- Error: ${error.message}
- Action needed: Check spreadsheet permissions and try again

### Phase 1: Recovery
- [ ] 1.1 Verify spreadsheet access
- [ ] 1.2 Retry initialization

## Notes

initPlan() encountered an error. Please check permissions and try again.
`;
      return parsePlan(fallbackPlan);
    }
  }
  
  async getPlan(): Promise<Plan | null> {
    const md = await this.sheets.getCell(this.cell);
    return md ? parsePlan(md) : null;
  }
  
  async getNextTask(): Promise<PlanTask | null> {
    const plan = await this.getPlan();
    if (!plan) return null;
    for (const phase of plan.phases) {
      const next = phase.tasks.find(t => t.status === 'todo');
      if (next) return next;
    }
    return null;
  }
  
  async getReviewTasks(): Promise<PlanTask[]> {
    const plan = await this.getPlan();
    if (!plan) return [];
    return plan.phases.flatMap(p => p.tasks.filter(t => t.status === 'review'));
  }
  
  async createPlan(title: string, goal: string, phases: PhaseInput[]): Promise<void> {
    const phasesMarkdown = phases.map((phase, i) => {
      const phaseNum = i + 1;
      const steps = phase.steps.map((s, j) => `- [ ] ${phaseNum}.${j + 1} ${s}`).join('\n');
      return `### Phase ${phaseNum}: ${phase.name}\n${steps}`;
    }).join('\n\n');
    
    const md = `# Plan: ${title}

Goal: ${goal}

## Analysis

- Spreadsheet: [spreadsheet name]
- Key sheets: [sheet names]
- Target ranges:
  - Read: [ranges to read]
  - Write: [ranges to write]
- Current state: [description]

## Questions for User

- [Any clarifying questions]

${phasesMarkdown}

## Notes

`;
    await this.sheets.setCell(this.cell, md);
  }
  
  async startTask(step: string): Promise<void> {
    const plan = await this.getPlan();
    if (!plan) throw new Error('No plan');
    const md = updateTaskStatus(plan.raw, step, 'doing');
    await this.sheets.setCell(this.cell, md);
  }
  
  async completeTask(step: string): Promise<void> {
    const plan = await this.getPlan();
    if (!plan) throw new Error('No plan');
    const md = updateTaskStatus(plan.raw, step, 'done');
    await this.sheets.setCell(this.cell, md);
  }
  
  async blockTask(step: string, reason: string): Promise<void> {
    const plan = await this.getPlan();
    if (!plan) throw new Error('No plan');
    const md = updateTaskStatus(plan.raw, step, 'blocked', reason);
    await this.sheets.setCell(this.cell, md);
  }
  
  async reviewTask(step: string, note: string): Promise<void> {
    const plan = await this.getPlan();
    if (!plan) throw new Error('No plan');
    const md = updateTaskStatus(plan.raw, step, 'review', note);
    await this.sheets.setCell(this.cell, md);
  }
}
```

---

## Usage

```typescript
// Create plan with phases
await plan.createPlan(
  "Generate Q4 Sales Report",
  "Aggregate order data and populate Summary dashboard",
  [
    { name: "Data Collection", steps: [
      "Read Orders!A2:F500 (order ID, date, customer, SKU, qty, total)",
      "Read Products!A2:D200 (SKU, name, category, unit cost)",
      "Read Regions!A2:C50 (region code, name, manager)"
    ]},
    { name: "Processing", steps: [
      "Calculate regional totals in Staging!A2:E50 (region, units, revenue, cost, margin)",
      "Compute product category breakdown in Staging!G2:J20 (category, qty, revenue, %)",
      "Generate month-over-month in Staging!L2:P13 (month, current, previous, delta, growth%)"
    ]},
    { name: "Output", steps: [
      "Write summary to Summary!B5:E20 (metric name, Q4 value, Q3 value, change)",
      "Update Dashboard!A1:G10 (chart data for visualization)",
      "Set Report!A1 (generated timestamp)"
    ]}
  ]
);

// Execute
let task = await plan.getNextTask();
while (task) {
  await plan.startTask(task.step);
  
  try {
    await executeSheetOperation(task.title);
    await plan.completeTask(task.step);
  } catch (e) {
    await plan.blockTask(task.step, e.message);
    break;
  }
  
  task = await plan.getNextTask();
}

// Check for items needing review
const reviewItems = await plan.getReviewTasks();
if (reviewItems.length > 0) {
  console.log('Awaiting review:', reviewItems.map(t => t.title));
}
```

---

## Example Plan

```markdown
# Plan: Monthly Inventory Reconciliation

Goal: Reconcile warehouse inventory with sales data and flag discrepancies

## Analysis

- Spreadsheet: Inventory Management 2026 (ID: 1a2b3c4d...)
- Key sheets: Warehouse, Sales, Products, Discrepancies, Summary
- Target ranges:
  - Read: Warehouse!A2:F500 (SKU, bin location, qty on hand, last count date, counter, notes)
  - Read: Sales!A2:H1000 (order ID, date, SKU, qty sold, unit price, total, customer, status)
  - Read: Products!A2:D200 (SKU, product name, category, reorder threshold)
  - Write: Discrepancies!A2:G100 (SKU, expected qty, actual qty, variance, variance %, flag, notes)
  - Write: Summary!B3:E15 (metric, value, previous month, change)
- Current state: Warehouse has 487 SKUs, Sales has 943 transactions for January
- Dependencies: Sales data must include all POS uploads through end of month

## Questions for User

- Should we include items with zero stock in the reconciliation?
- Threshold for flagging discrepancy? (default: >5% variance)
- Should Discrepancies sheet be cleared before writing new data?

### Phase 1: Data Collection
- [x] 1.1 Read Warehouse!A2:F500 (current stock levels by SKU) ✅ 2026-01-08
- [x] 1.2 Read Sales!A2:H1000 (January transactions) ✅ 2026-01-08
- [x] 1.3 Read Products!A2:D200 (SKU master with categories) ✅ 2026-01-08

### Phase 2: Calculation
- [x] 2.1 Calculate expected inventory per SKU in Staging!A2:C500 (SKU, opening qty, sold qty) ✅ 2026-01-09
- [x] 2.2 Compare expected vs actual in Warehouse!G2:H500 (expected, variance) ✅ 2026-01-09
- [!] 2.3 Identify variance > threshold in Staging!E2:E500 (flag column) — please verify 5% threshold is correct

### Phase 3: Reporting
- [/] 3.1 Write flagged items to Discrepancies!A2:G100 (SKU, expected, actual, variance, %, flag, notes)
- [ ] 3.2 Calculate summary stats for Summary!B3:E15 (total SKUs, flagged count, total variance $, accuracy %)
- [>] 3.3 Update Dashboard!A1:D10 (chart data) — waiting for Phase 2 review approval

### Phase 4: Validation
- [ ] 4.1 Verify row counts: Discrepancies!A:A count matches flagged items in Staging!E:E
- [ ] 4.2 Spot-check 5 random SKUs: compare Discrepancies vs Warehouse manually
- [ ] 4.3 Send notification to warehouse team with Summary!B3:E15 attachment

## Notes

- Previous reconciliation: Discrepancies sheet has December data in rows 2-85
- Known issue: SKU "WH-4521" has duplicate entries in Warehouse!A:A
- Stakeholder: warehouse-team@company.com for notifications
- Formula reference: variance % = (actual - expected) / expected
```

---

## System Prompt

Add this section to your agent's system prompt to enable plan-driven execution:

```markdown
## Planning System

You have access to a PLAN stored in AGENT_BASE!C2. Use it to track multi-step work.

### Planning Tools

- **initPlan()** — Initialize plan system. Only use when AGENT_BASE sheet doesn't exist OR C1 doesn't contain "PLAN.md Contents". Creates AGENT_BASE sheet and writes starter plan to C2. Idempotent and handles errors gracefully.
- **getPlan()** — Read current plan from AGENT_BASE!C2
- **getNextTask()** — Get the next todo task (skips blocked/review)
- **getReviewTasks()** — Get all tasks awaiting human review
- **createPlan(title, goal, phases)** — Create a new plan
- **startTask(step)** — Mark task as in-progress `[/]`
- **completeTask(step)** — Mark task as done `[x]` with timestamp
- **blockTask(step, reason)** — Mark task as blocked `[>]` with reason
- **reviewTask(step, note)** — Mark task for human review `[!]` with note

### Plan Format

Plans are stored as markdown in AGENT_BASE!C2 with this structure:

```
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

- [Clarifying questions if any]

### Phase 1: [Name]
- [ ] 1.1 Step description with Sheet!Range (columns)
- [ ] 1.2 Another step

### Phase 2: [Name]
- [ ] 2.1 Step description
- [ ] 2.2 Another step

## Notes

[Context, decisions, learnings]
```

### Status Markers

| Marker | Status | Meaning |
|--------|--------|---------|
| `[ ]` | Todo | Not started, returned by getNextTask() |
| `[/]` | Doing | In progress, set by startTask() |
| `[x]` | Done | Completed, set by completeTask() |
| `[>]` | Blocked | Waiting on something, set by blockTask() |
| `[!]` | Review | Needs human input, set by reviewTask() |

### Workflow

#### 1. Initialize

At session start, call getPlan() to check for an existing plan. If AGENT_BASE sheet doesn't exist or C1 doesn't contain "PLAN.md Contents", call initPlan() to set up the workspace with a starter plan that guides the user through basic tools and workflows.

If a plan exists, check getReviewTasks() first — handle pending reviews before continuing. Then call getNextTask() to find where to resume. If no plan exists, ask the user what they want to accomplish.

#### 2. Create Plan

When the user describes a goal:

1. Analyze the spreadsheet — read headers to understand available data
2. Identify key sheets and ranges involved
3. Ask clarifying questions if needed
4. Call createPlan() with phases grouping related steps

Each step should reference Sheet!Range (column descriptions). For example: "Read Inventory!A2:F500 (SKU, bin, qty, last count, counter, notes)"

#### 3. Execute

Work through tasks one at a time:

1. Call getNextTask() to get the next todo item
2. Call startTask(step) to mark it in-progress
3. Execute the actual sheet operation (read, calculate, write)
4. Call completeTask(step) when done
5. Report progress to user
6. Repeat until getNextTask() returns null

#### 4. Handle Blocks

If a task cannot proceed, call blockTask(step, reason) with a specific reason that includes the affected range. Examples:

- "waiting for supplier data in Pricing!C2:C100"
- "Sales!A2:H1000 is empty — need POS upload"
- "cannot write to Summary sheet — need edit access"

Tell the user what's blocked and ask them to resolve it.

#### 5. Request Review

If a task needs human verification, call reviewTask(step, note). Use this for:

- Verifying thresholds or logic: "please verify 5% variance threshold is correct"
- Confirming destructive actions: "about to clear Discrepancies!A2:G100 — OK to proceed?"
- Validating outputs: "please spot-check Summary!B3:E10 totals"

Wait for user confirmation before proceeding.

#### 6. Resume After Review

When user approves a review item, call startTask(step) on that task, do the work, then call completeTask(step).

#### 7. Complete

When getNextTask() returns null and getReviewTasks() is empty, the plan is complete. Summarize what was accomplished and list the output ranges that were written.

### Best Practices

1. Call getPlan() at session start; only call initPlan() if AGENT_BASE or plan marker missing
2. One task at a time — start, execute, complete before moving on
3. Update status immediately — don't batch updates
4. Be specific in block reasons — include sheet/range affected
5. Request review for destructive actions, threshold decisions, final outputs
6. Always include range descriptions: Sheet!Range (what the columns contain)
7. Keep user informed — report progress after each task
```

---

### Parser Tests

```typescript
describe('parsePlan', () => {
  const samplePlan = `# Plan: Test Plan

Goal: Test the parser

## Analysis

- Spreadsheet: Test Sheet
- Key sheets: Data, Output
- Target ranges:
  - Read: Data!A2:C10 (id, name, value)
  - Write: Output!A2:B10 (id, result)

## Questions for User

- Question one?
- Question two?

### Phase 1: Setup
- [ ] 1.1 Read Data!A2:C10 (source data)
- [/] 1.2 Validate Data!A:A (id column)

### Phase 2: Process
- [x] 2.1 Calculate Output!B2:B10 (results) ✅ 2026-01-10
- [>] 2.2 Write Output!A2:A10 (ids) — waiting for validation
- [!] 2.3 Check Output!C2:C10 (flags) — verify threshold

## Notes

Test notes here
`;

  test('parses title', () => {
    const plan = parsePlan(samplePlan);
    expect(plan.title).toBe('Test Plan');
  });

  test('parses goal', () => {
    const plan = parsePlan(samplePlan);
    expect(plan.goal).toBe('Test the parser');
  });

  test('parses analysis section', () => {
    const plan = parsePlan(samplePlan);
    expect(plan.analysis).toContain('Test Sheet');
    expect(plan.analysis).toContain('Data!A2:C10');
  });

  test('parses questions', () => {
    const plan = parsePlan(samplePlan);
    expect(plan.questions).toHaveLength(2);
    expect(plan.questions[0]).toBe('Question one?');
  });

  test('parses phases', () => {
    const plan = parsePlan(samplePlan);
    expect(plan.phases).toHaveLength(2);
    expect(plan.phases[0].name).toBe('Setup');
    expect(plan.phases[1].name).toBe('Process');
  });

  test('parses tasks within phases', () => {
    const plan = parsePlan(samplePlan);
    expect(plan.phases[0].tasks).toHaveLength(2);
    expect(plan.phases[1].tasks).toHaveLength(3);
  });

  test('parses task status correctly', () => {
    const plan = parsePlan(samplePlan);
    const phase1 = plan.phases[0];
    const phase2 = plan.phases[1];
    
    expect(phase1.tasks[0].status).toBe('todo');
    expect(phase1.tasks[1].status).toBe('doing');
    expect(phase2.tasks[0].status).toBe('done');
    expect(phase2.tasks[1].status).toBe('blocked');
    expect(phase2.tasks[2].status).toBe('review');
  });

  test('parses step numbers', () => {
    const plan = parsePlan(samplePlan);
    expect(plan.phases[0].tasks[0].step).toBe('1.1');
    expect(plan.phases[0].tasks[1].step).toBe('1.2');
    expect(plan.phases[1].tasks[0].step).toBe('2.1');
  });

  test('parses completion date', () => {
    const plan = parsePlan(samplePlan);
    const doneTask = plan.phases[1].tasks[0];
    expect(doneTask.completedDate).toBe('2026-01-10');
  });

  test('parses blocked reason', () => {
    const plan = parsePlan(samplePlan);
    const blockedTask = plan.phases[1].tasks[1];
    expect(blockedTask.blockedReason).toBe('waiting for validation');
  });

  test('parses review note', () => {
    const plan = parsePlan(samplePlan);
    const reviewTask = plan.phases[1].tasks[2];
    expect(reviewTask.reviewNote).toBe('verify threshold');
  });

  test('parses notes section', () => {
    const plan = parsePlan(samplePlan);
    expect(plan.notes).toBe('Test notes here');
  });

  test('extracts task title without annotations', () => {
    const plan = parsePlan(samplePlan);
    const doneTask = plan.phases[1].tasks[0];
    expect(doneTask.title).toBe('Calculate Output!B2:B10 (results)');
    expect(doneTask.title).not.toContain('✅');
  });

  test('handles empty plan gracefully', () => {
    const plan = parsePlan('');
    expect(plan.title).toBe('');
    expect(plan.phases).toHaveLength(0);
  });

  test('handles plan with no questions section', () => {
    const minimal = `# Plan: Minimal

Goal: Test

### Phase 1: Only
- [ ] 1.1 Task one
`;
    const plan = parsePlan(minimal);
    expect(plan.questions).toBeUndefined();
  });
});
```

### Status Update Tests

```typescript
describe('updateTaskStatus', () => {
  const basePlan = `# Plan: Test

Goal: Test updates

### Phase 1: Work
- [ ] 1.1 First task
- [ ] 1.2 Second task
- [/] 1.3 In progress task
`;

  test('updates todo to doing', () => {
    const updated = updateTaskStatus(basePlan, '1.1', 'doing');
    expect(updated).toContain('- [/] 1.1 First task');
  });

  test('updates doing to done with date', () => {
    const updated = updateTaskStatus(basePlan, '1.3', 'done');
    expect(updated).toMatch(/- \[x\] 1\.3 In progress task ✅ \d{4}-\d{2}-\d{2}/);
  });

  test('updates to blocked with reason', () => {
    const updated = updateTaskStatus(basePlan, '1.1', 'blocked', 'waiting for data');
    expect(updated).toContain('- [>] 1.1 First task — waiting for data');
  });

  test('updates to review with note', () => {
    const updated = updateTaskStatus(basePlan, '1.2', 'review', 'check formula');
    expect(updated).toContain('- [!] 1.2 Second task — check formula');
  });

  test('removes blocked reason when unblocking', () => {
    const blocked = `### Phase 1: Work
- [>] 1.1 Task — old reason`;
    const updated = updateTaskStatus(blocked, '1.1', 'doing');
    expect(updated).toContain('- [/] 1.1 Task');
    expect(updated).not.toContain('old reason');
  });

  test('replaces existing annotation when updating', () => {
    const withDate = `### Phase 1: Work
- [x] 1.1 Task ✅ 2026-01-01`;
    const updated = updateTaskStatus(withDate, '1.1', 'doing');
    expect(updated).toContain('- [/] 1.1 Task');
    expect(updated).not.toContain('✅');
  });

  test('does not modify other tasks', () => {
    const updated = updateTaskStatus(basePlan, '1.1', 'done');
    expect(updated).toContain('- [ ] 1.2 Second task');
    expect(updated).toContain('- [/] 1.3 In progress task');
  });

  test('handles task not found gracefully', () => {
    const updated = updateTaskStatus(basePlan, '9.9', 'done');
    expect(updated).toBe(basePlan);
  });
});
```

### PlanManager Integration Tests

```typescript
describe('PlanManager', () => {
  let mockSheets: MockSheetsClient;
  let manager: PlanManager;

  beforeEach(() => {
    mockSheets = new MockSheetsClient();
    manager = new PlanManager(mockSheets, 'AGENT_BASE!C2');
  });

  describe('initPlan', () => {
    test('creates AGENT_BASE sheet if missing', async () => {
      mockSheets.setSheets([]);
      
      await manager.initPlan();
      
      expect(mockSheets.createdSheets).toContain('AGENT_BASE');
    });

    test('writes plan marker to C1', async () => {
      mockSheets.setSheets([]);
      
      await manager.initPlan();
      
      expect(mockSheets.getCell('AGENT_BASE!C1')).toBe('PLAN.md Contents');
    });

    test('writes starter plan to C2', async () => {
      mockSheets.setSheets([]);
      
      await manager.initPlan();
      
      const content = mockSheets.getCell('AGENT_BASE!C2');
      expect(content).toContain('# Plan: Getting Started');
      expect(content).toContain('### Phase 1: Orientation');
    });

    test('returns existing plan if already initialized', async () => {
      mockSheets.setSheets(['AGENT_BASE']);
      mockSheets.setCell('AGENT_BASE!C1', 'PLAN.md Contents');
      mockSheets.setCell('AGENT_BASE!C2', `# Plan: Existing
Goal: Test
### Phase 1: Work
- [ ] 1.1 Task`);
      
      const plan = await manager.initPlan();
      
      expect(plan.title).toBe('Existing');
    });

    test('is idempotent - does not overwrite existing plan', async () => {
      mockSheets.setSheets(['AGENT_BASE']);
      mockSheets.setCell('AGENT_BASE!C1', 'PLAN.md Contents');
      mockSheets.setCell('AGENT_BASE!C2', `# Plan: My Plan
Goal: Keep this
### Phase 1: Important
- [x] 1.1 Done task ✅ 2026-01-01`);
      
      await manager.initPlan();
      await manager.initPlan();
      await manager.initPlan();
      
      const content = mockSheets.getCell('AGENT_BASE!C2');
      expect(content).toContain('# Plan: My Plan');
      expect(content).toContain('Done task');
    });

    test('initializes if C1 marker is missing', async () => {
      mockSheets.setSheets(['AGENT_BASE']);
      mockSheets.setCell('AGENT_BASE!C1', ''); // No marker
      
      await manager.initPlan();
      
      expect(mockSheets.getCell('AGENT_BASE!C1')).toBe('PLAN.md Contents');
      expect(mockSheets.getCell('AGENT_BASE!C2')).toContain('Getting Started');
    });

    test('initializes if C1 has wrong content', async () => {
      mockSheets.setSheets(['AGENT_BASE']);
      mockSheets.setCell('AGENT_BASE!C1', 'Something else');
      
      await manager.initPlan();
      
      expect(mockSheets.getCell('AGENT_BASE!C1')).toBe('PLAN.md Contents');
    });

    test('handles errors gracefully', async () => {
      mockSheets.setSheets([]);
      mockSheets.failNextOperation('Network error');
      
      const plan = await manager.initPlan();
      
      expect(plan.title).toBe('Initialization Error');
      expect(plan.notes).toContain('error');
    });

    test('starter plan has all required sections', async () => {
      mockSheets.setSheets([]);
      
      const plan = await manager.initPlan();
      
      expect(plan.title).toBe('Getting Started with Sheet Agent');
      expect(plan.goal).toContain('Learn the basic tools');
      expect(plan.analysis).toBeDefined();
      expect(plan.questions).toBeDefined();
      expect(plan.phases.length).toBeGreaterThanOrEqual(2);
      expect(plan.notes).toContain('starter plan');
    });
  });

  describe('getPlan', () => {
    test('returns null when cell is empty', async () => {
      mockSheets.setCell('AGENT_BASE!C2', '');
      const plan = await manager.getPlan();
      expect(plan).toBeNull();
    });

    test('returns parsed plan when cell has content', async () => {
      mockSheets.setCell('AGENT_BASE!C2', `# Plan: Test
Goal: Testing
### Phase 1: Work
- [ ] 1.1 Do something`);
      const plan = await manager.getPlan();
      expect(plan?.title).toBe('Test');
      expect(plan?.phases).toHaveLength(1);
    });
  });

  describe('getNextTask', () => {
    test('returns first todo task', async () => {
      mockSheets.setCell('AGENT_BASE!C2', `# Plan: Test
Goal: Test
### Phase 1: Done
- [x] 1.1 Complete ✅ 2026-01-01
### Phase 2: Pending
- [ ] 2.1 Next task
- [ ] 2.2 After that`);
      const next = await manager.getNextTask();
      expect(next?.step).toBe('2.1');
      expect(next?.title).toBe('Next task');
    });

    test('returns null when all tasks done', async () => {
      mockSheets.setCell('AGENT_BASE!C2', `# Plan: Test
Goal: Test
### Phase 1: Done
- [x] 1.1 Complete ✅ 2026-01-01`);
      const next = await manager.getNextTask();
      expect(next).toBeNull();
    });

    test('skips blocked and review tasks', async () => {
      mockSheets.setCell('AGENT_BASE!C2', `# Plan: Test
Goal: Test
### Phase 1: Mixed
- [>] 1.1 Blocked — reason
- [!] 1.2 Review — note
- [ ] 1.3 Available`);
      const next = await manager.getNextTask();
      expect(next?.step).toBe('1.3');
    });
  });

  describe('getReviewTasks', () => {
    test('returns all tasks with review status', async () => {
      mockSheets.setCell('AGENT_BASE!C2', `# Plan: Test
Goal: Test
### Phase 1: Work
- [!] 1.1 Review one — check this
- [ ] 1.2 Normal task
### Phase 2: More
- [!] 2.1 Review two — verify that`);
      const reviews = await manager.getReviewTasks();
      expect(reviews).toHaveLength(2);
      expect(reviews[0].step).toBe('1.1');
      expect(reviews[1].step).toBe('2.1');
    });

    test('returns empty array when no reviews', async () => {
      mockSheets.setCell('AGENT_BASE!C2', `# Plan: Test
Goal: Test
### Phase 1: Work
- [ ] 1.1 Normal task`);
      const reviews = await manager.getReviewTasks();
      expect(reviews).toHaveLength(0);
    });
  });

  describe('createPlan', () => {
    test('creates plan with correct structure', async () => {
      await manager.createPlan(
        'New Plan',
        'Achieve something',
        [
          { name: 'Setup', steps: ['Step A', 'Step B'] },
          { name: 'Execute', steps: ['Step C'] }
        ]
      );
      
      const content = mockSheets.getCell('AGENT_BASE!C2');
      expect(content).toContain('# Plan: New Plan');
      expect(content).toContain('Goal: Achieve something');
      expect(content).toContain('### Phase 1: Setup');
      expect(content).toContain('- [ ] 1.1 Step A');
      expect(content).toContain('- [ ] 1.2 Step B');
      expect(content).toContain('### Phase 2: Execute');
      expect(content).toContain('- [ ] 2.1 Step C');
    });

    test('includes analysis template', async () => {
      await manager.createPlan('Test', 'Goal', [{ name: 'Work', steps: ['Task'] }]);
      const content = mockSheets.getCell('AGENT_BASE!C2');
      expect(content).toContain('## Analysis');
      expect(content).toContain('- Spreadsheet:');
      expect(content).toContain('- Key sheets:');
      expect(content).toContain('- Target ranges:');
    });
  });

  describe('startTask', () => {
    test('updates task to doing status', async () => {
      mockSheets.setCell('AGENT_BASE!C2', `# Plan: Test
Goal: Test
### Phase 1: Work
- [ ] 1.1 The task`);
      
      await manager.startTask('1.1');
      
      const content = mockSheets.getCell('AGENT_BASE!C2');
      expect(content).toContain('- [/] 1.1 The task');
    });

    test('throws when no plan exists', async () => {
      mockSheets.setCell('AGENT_BASE!C2', '');
      await expect(manager.startTask('1.1')).rejects.toThrow('No plan');
    });
  });

  describe('completeTask', () => {
    test('updates task to done with date', async () => {
      mockSheets.setCell('AGENT_BASE!C2', `# Plan: Test
Goal: Test
### Phase 1: Work
- [/] 1.1 The task`);
      
      await manager.completeTask('1.1');
      
      const content = mockSheets.getCell('AGENT_BASE!C2');
      expect(content).toMatch(/- \[x\] 1\.1 The task ✅ \d{4}-\d{2}-\d{2}/);
    });
  });

  describe('blockTask', () => {
    test('updates task to blocked with reason', async () => {
      mockSheets.setCell('AGENT_BASE!C2', `# Plan: Test
Goal: Test
### Phase 1: Work
- [/] 1.1 The task`);
      
      await manager.blockTask('1.1', 'need approval');
      
      const content = mockSheets.getCell('AGENT_BASE!C2');
      expect(content).toContain('- [>] 1.1 The task — need approval');
    });
  });

  describe('reviewTask', () => {
    test('updates task to review with note', async () => {
      mockSheets.setCell('AGENT_BASE!C2', `# Plan: Test
Goal: Test
### Phase 1: Work
- [/] 1.1 The task`);
      
      await manager.reviewTask('1.1', 'please check formula');
      
      const content = mockSheets.getCell('AGENT_BASE!C2');
      expect(content).toContain('- [!] 1.1 The task — please check formula');
    });
  });
});
```

### Regex Pattern Tests

```typescript
describe('regex patterns', () => {
  describe('TASK_REGEX', () => {
    const TASK_REGEX = /^- \[(.)\] (\d+\.\d+(?:\.\d+)?)\s+(.+)$/;

    test('matches basic task', () => {
      const match = '- [ ] 1.1 Simple task'.match(TASK_REGEX);
      expect(match).toBeTruthy();
      expect(match[1]).toBe(' ');
      expect(match[2]).toBe('1.1');
      expect(match[3]).toBe('Simple task');
    });

    test('matches task with sheet reference', () => {
      const match = '- [x] 2.3 Read Data!A2:B10 (columns) ✅ 2026-01-10'.match(TASK_REGEX);
      expect(match).toBeTruthy();
      expect(match[2]).toBe('2.3');
      expect(match[3]).toBe('Read Data!A2:B10 (columns) ✅ 2026-01-10');
    });

    test('matches sub-sub-step', () => {
      const match = '- [/] 1.2.3 Nested task'.match(TASK_REGEX);
      expect(match).toBeTruthy();
      expect(match[2]).toBe('1.2.3');
    });

    test('matches all status characters', () => {
      const statuses = [' ', '/', 'x', '>', '!'];
      statuses.forEach(s => {
        const match = `- [${s}] 1.1 Task`.match(TASK_REGEX);
        expect(match).toBeTruthy();
        expect(match[1]).toBe(s);
      });
    });

    test('does not match invalid formats', () => {
      expect('- [ ] 1 No decimal'.match(TASK_REGEX)).toBeNull();
      expect('- [ ] Task no number'.match(TASK_REGEX)).toBeNull();
      expect('[ ] 1.1 No dash'.match(TASK_REGEX)).toBeNull();
      expect('- [x]1.1 No space'.match(TASK_REGEX)).toBeNull();
    });
  });

  describe('PHASE_REGEX', () => {
    const PHASE_REGEX = /^### Phase (\d+): (.+)$/;

    test('matches phase header', () => {
      const match = '### Phase 1: Setup'.match(PHASE_REGEX);
      expect(match).toBeTruthy();
      expect(match[1]).toBe('1');
      expect(match[2]).toBe('Setup');
    });

    test('matches multi-word phase name', () => {
      const match = '### Phase 2: Data Processing and Validation'.match(PHASE_REGEX);
      expect(match).toBeTruthy();
      expect(match[2]).toBe('Data Processing and Validation');
    });

    test('does not match wrong heading level', () => {
      expect('## Phase 1: Wrong'.match(PHASE_REGEX)).toBeNull();
      expect('#### Phase 1: Wrong'.match(PHASE_REGEX)).toBeNull();
    });
  });
});
```

### Edge Case Tests

```typescript
describe('edge cases', () => {
  test('handles special characters in task titles', () => {
    const plan = parsePlan(`# Plan: Test
Goal: Test
### Phase 1: Work
- [ ] 1.1 Task with "quotes" and 'apostrophes'
- [ ] 1.2 Task with $pecial ch@racters!
- [ ] 1.3 Task with émojis 🎉`);
    
    expect(plan.phases[0].tasks[0].title).toContain('quotes');
    expect(plan.phases[0].tasks[1].title).toContain('$pecial');
    expect(plan.phases[0].tasks[2].title).toContain('🎉');
  });

  test('handles very long task titles', () => {
    const longTitle = 'A'.repeat(500);
    const plan = parsePlan(`# Plan: Test
Goal: Test
### Phase 1: Work
- [ ] 1.1 ${longTitle}`);
    
    expect(plan.phases[0].tasks[0].title).toBe(longTitle);
  });

  test('handles multiple blocked reasons (keeps last)', () => {
    const updated = updateTaskStatus(
      '- [>] 1.1 Task — first reason',
      '1.1',
      'blocked',
      'second reason'
    );
    expect(updated).toContain('— second reason');
    expect(updated).not.toContain('first reason');
  });

  test('handles plan with only analysis section', () => {
    const plan = parsePlan(`# Plan: Analysis Only
Goal: Test

## Analysis

- Spreadsheet: Test
- Key sheets: Data`);
    
    expect(plan.title).toBe('Analysis Only');
    expect(plan.analysis).toContain('Test');
    expect(plan.phases).toHaveLength(0);
  });

  test('preserves raw markdown exactly', () => {
    const original = `# Plan: Test

Goal: Test goal

### Phase 1: Work
- [ ] 1.1 Task

## Notes

Some notes`;
    
    const plan = parsePlan(original);
    expect(plan.raw).toBe(original);
  });
});
```

---

| Aspect | Value |
|--------|-------|
| Storage | `AGENT_BASE!C2` |
| Format | Markdown with Phase headers |
| Hierarchy | `### Phase N:` + `N.#` step numbering |
| Statuses | `[ ]` `[/]` `[x]` `[>]` `[!]` |
| Sections | Analysis, Questions, Phases, Notes |
| Methods | 8 |

**Sheet-grounded. Human-readable. Claude-like.**
