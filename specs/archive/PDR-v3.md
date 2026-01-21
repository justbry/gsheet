# Product Requirements Document: g-sheet-agent-io

**Version:** 3.0 (Agent-Grounded)  
**Date:** January 11, 2025  
**Status:** Ready for Implementation  
**Timeline:** 5 weeks to v1.0.0

---

## Executive Summary

**Problem:** AI agents like Mastra use Google Sheets as data storage, but lack persistent context, goal awareness, and action history. They treat sheets as databases, not environments.

**Solution:** A <50KB TypeScript library that transforms Google Sheets into a complete agent workspace with:
- Persistent memory across restarts
- Goal tracking and progress monitoring
- Complete action history and audit trails
- Human-readable, editable agent context

**Differentiation:**
- 38KB bundle (13x lighter than google-spreadsheet)
- Agent workspace pattern (AGENT_CONFIG, MEMORY, HISTORY, TASKS)
- Context-aware operations (every action logs purpose and goal)
- Goal-driven behavior (agents track progress, get suggestions)
- Self-contained (no external databases needed)

**Success Criteria:**
- Bundle: <50KB gzipped (38KB target)
- Setup time: <10 minutes (agent workspace + first goal)
- Coverage: ≥90% (blocks merge if <85%)
- Goal tracking accuracy: 95% (measured vs manual count)

---

## Problem Validation

### Current State: Sheets as Database

```typescript
// Agent has no context or memory
const leads = await agent.read({ sheet: 'Leads' });
// What goal is this for? Unknown.
// What did agent do before this? Unknown.
// What will agent do next? Unknown.
```

**Pain Points:**
1. No memory between restarts (forgets everything)
2. No goal tracking (doesn't know if succeeding)
3. No action history (can't debug or audit)
4. No context awareness (every action isolated)
5. Human can't see what agent is doing/thinking

### Improved: Sheets as Agent Environment

```typescript
// Agent has full context and memory
const leads = await agent.readWithContext({
  sheet: 'Leads',
  purpose: 'qualify_leads',
  goalId: 'GOAL-001'  // Tracking: "Qualify 10 leads/week"
});
// ✅ Logged to HISTORY with timestamp, goal, outcome
// ✅ Progress toward goal auto-updated
// ✅ Human can see: "Agent searched leads for goal GOAL-001"
```

**Solutions:**
1. MEMORY sheet (persistent key-value storage)
2. INSTRUCTIONS sheet (goals, constraints, rules)
3. HISTORY sheet (complete action audit trail)
4. TASKS sheet (planned actions queue)
5. Context-aware operations (readWithContext, writeWithContext)

---

## Goals

### Primary (SMART)

| Goal | Measurement | Target | Gate |
|------|-------------|--------|------|
| Bundle size | `gzip -c dist/index.js \| wc -c` | 38KB (limit: 50KB) | CI fails if >50KB |
| Agent setup time | User testing (n=5) | <10 min (workspace + goal) | Pre-launch |
| Test coverage | Vitest coverage report | ≥90% overall | Blocks merge if <85% |
| Goal tracking accuracy | Manual vs auto count | 95% match | Integration tests |
| Action logging | All ops logged | 100% coverage | Unit tests |

### Non-Goals

- Multi-agent coordination (agent bus, handoffs)
- Advanced AI (pattern learning, optimization)
- Sheet-native query language (QUERY formula compiler)
- Real-time collaboration (WebSocket)
- OAuth interactive flows (service account only)

---

## Target Users

**Primary: AI Agent Developer** (70%)
- Need: Agents that remember context, track goals, log actions
- Pain: Agents restart from scratch, no persistence, can't debug
- Win: "Agent remembers last state. I can see everything it did. Goals tracked automatically."

**Secondary: Operations/DevOps** (20%)
- Need: Audit trails, observable agent behavior
- Pain: Black box agents, no visibility into actions
- Win: "HISTORY sheet shows every action. I can debug failures instantly."

**Tertiary: Product Manager** (10%)
- Need: Track if agent meets goals, validate agent decisions
- Pain: Can't measure agent performance, no goal tracking
- Win: "Dashboard shows: 8/10 leads qualified this week. 80% toward goal."

---

## Features

### F1: Agent Workspace Pattern

**User Story:** As an agent developer, I want standard workspace structure, so agents have persistent context.

**Acceptance Criteria:**
- `initWorkspace()` creates 5 standard sheets: AGENT_CONFIG, INSTRUCTIONS, MEMORY, HISTORY, TASKS
- Each sheet has Zod-validated schema
- Workspace includes agent identity (ID, name, version)
- All workspace sheets have consistent structure
- Works with existing data sheets (non-destructive)

**Example:**
```typescript
await agent.initWorkspace({
  agentId: 'mastra-crm-001',
  purpose: 'Qualify sales leads',
  goals: [{
    id: 'GOAL-001',
    description: 'Qualify 10 leads per week with score ≥80',
    target: 10,
    deadline: '2025-01-18T23:59:59Z'
  }],
  constraints: [{
    id: 'CONSTRAINT-001',
    description: 'Never delete leads without manager approval'
  }]
});

// Creates workspace:
// - AGENT_CONFIG (identity, permissions)
// - INSTRUCTIONS (goals, constraints, rules)
// - MEMORY (persistent key-value)
// - HISTORY (action audit trail)
// - TASKS (planned actions)
```

**Workspace Structure:**
```
Spreadsheet: "Mastra CRM Agent"
├── AGENT_CONFIG      # Agent identity and configuration
├── INSTRUCTIONS      # Goals, constraints, rules
├── MEMORY            # Persistent key-value storage
├── HISTORY           # Complete action log
├── TASKS             # Planned actions queue
└── Leads             # Data sheet (user-created)
```

---

### F2: Persistent Memory

**User Story:** As an agent, I want to remember context across restarts, so I don't lose state.

**Acceptance Criteria:**
- `remember(key, value)` stores data in MEMORY sheet
- `recall(key)` retrieves stored data
- `forget(key)` deletes stored data
- Supports string, number, boolean, object, array types
- Optional TTL (time-to-live) for auto-expiry
- Tagged memories for search

**Example:**
```typescript
// Save state
await agent.remember('last_lead_id', 'LEAD-12345');
await agent.remember('qualified_count', 8);
await agent.remember('last_search', {
  query: { score: { gte: 80 } },
  timestamp: '2025-01-11T10:00:00Z'
}, { tags: 'search,recent' });

// Retrieve state (even after restart)
const lastLead = await agent.recall('last_lead_id');
// 'LEAD-12345'

const count = await agent.recall('qualified_count');
// 8

// Forget state
await agent.forget('last_search');
```

**MEMORY Sheet Schema:**
```typescript
const MemorySchema = z.object({
  key: z.string(),
  value: z.string(), // JSON stringified
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  tags: z.string().optional(),
  ttl: z.string().datetime().nullable(),
  updated_at: z.string().datetime(),
});
```

---

### F3: Action History & Audit Trail

**User Story:** As a developer, I want to see every action the agent took, so I can debug and audit.

**Acceptance Criteria:**
- All operations auto-log to HISTORY sheet
- Log includes: action, input, output, status, duration, goal
- Query history by time, action type, status, goal
- Export history for analysis
- Never deletes history (append-only)

**Example:**
```typescript
// Actions auto-log
await agent.readWithContext({
  sheet: 'Leads',
  purpose: 'qualify_leads',
  goalId: 'GOAL-001'
});

// HISTORY sheet automatically records:
// {
//   id: 'ACT-00123',
//   timestamp: '2025-01-11T10:30:45Z',
//   action: 'qualify_leads',
//   input: '{"sheet":"Leads","query":{"score":{"gte":80}}}',
//   output: '{"rowCount":5}',
//   status: 'success',
//   duration_ms: 245,
//   goalId: 'GOAL-001'
// }

// Query history
const todayActions = await agent.getHistory({
  since: '2025-01-11T00:00:00Z'
});

const failures = await agent.getHistory({
  status: 'failure',
  limit: 10
});

const goalActions = await agent.getHistory({
  goalId: 'GOAL-001',
  since: '2025-01-04T00:00:00Z'
});
```

**HISTORY Sheet Schema:**
```typescript
const HistorySchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  action: z.string(),
  input: z.string(), // JSON
  output: z.string(), // JSON
  status: z.enum(['success', 'failure']),
  duration_ms: z.number(),
  goalId: z.string().nullable(),
  error: z.string().nullable(),
});
```

---

### F4: Goal Tracking

**User Story:** As an agent, I want to track progress toward goals, so I know if I'm succeeding.

**Acceptance Criteria:**
- Define goals with target metrics
- Auto-calculate progress from HISTORY
- `checkProgress(goalId)` returns current vs target
- Identify if on track or behind
- Suggest next action based on progress
- Visual indicators (conditional formatting)

**Example:**
```typescript
// Define goal (stored in INSTRUCTIONS sheet)
await agent.defineGoal({
  id: 'GOAL-001',
  description: 'Qualify 10 leads per week with score ≥80',
  metric: 'qualified_leads',
  target: 10,
  deadline: '2025-01-18T23:59:59Z'
});

// Check progress
const progress = await agent.checkProgress('GOAL-001');
// {
//   goalId: 'GOAL-001',
//   description: 'Qualify 10 leads per week...',
//   current: 8,
//   target: 10,
//   percentComplete: 80,
//   onTrack: true,
//   daysRemaining: 2
// }

// Get next suggested action
const next = await agent.suggestNextAction('GOAL-001');
// {
//   action: 'search_leads',
//   params: { score: { gte: 85 } },
//   reasoning: 'Need 2 more leads to hit weekly goal'
// }
```

**INSTRUCTIONS Sheet Schema:**
```typescript
const InstructionSchema = z.object({
  id: z.string(),
  type: z.enum(['goal', 'constraint', 'rule']),
  priority: z.number().min(1).max(10),
  content: z.string(),
  active: z.boolean(),
  created_at: z.string().datetime(),
  // Goal-specific fields
  metric: z.string().optional(),
  target: z.number().optional(),
  deadline: z.string().datetime().optional(),
});
```

---

### F5: Context-Aware Operations

**User Story:** As an agent, I want operations to log context automatically, so I don't manually track actions.

**Acceptance Criteria:**
- `readWithContext()` auto-logs read with purpose and goal
- `writeWithContext()` auto-logs write with purpose and goal
- `searchWithContext()` auto-logs search with purpose and goal
- All context operations check constraints before executing
- All context operations update agent state
- Performance: <10ms overhead vs standard operations

**Example:**
```typescript
// Standard operation (no context)
const leads = await agent.read({ sheet: 'Leads' });
// ❌ Not logged, no goal tracking, no constraints checked

// Context-aware operation
const leads = await agent.readWithContext({
  sheet: 'Leads',
  purpose: 'qualify_leads',
  goalId: 'GOAL-001',
  query: { score: { gte: 80 } }
});
// ✅ Logged to HISTORY
// ✅ Constraints checked (CONSTRAINT-001)
// ✅ Progress toward GOAL-001 updated
// ✅ Agent state updated (last_action, last_sheet)
```

**Implementation:**
```typescript
async readWithContext(options: ReadWithContext): Promise<SheetData> {
  const startTime = Date.now();
  
  // 1. Check constraints
  const constraints = await this.getActiveConstraints();
  if (!this.canRead(options.sheet, constraints)) {
    throw new ConstraintError('Reading not allowed by CONSTRAINT-003');
  }
  
  // 2. Execute read
  const result = await this.read(options);
  
  // 3. Auto-log to HISTORY
  await this.logAction({
    action: options.purpose || 'read',
    input: { sheet: options.sheet, query: options.query },
    output: { rowCount: result.rows.length },
    status: 'success',
    duration_ms: Date.now() - startTime,
    goalId: options.goalId,
  });
  
  // 4. Update state
  await this.remember('last_action', options.purpose);
  await this.remember('last_sheet', options.sheet);
  
  return result;
}
```

---

### F6: Task Queue

**User Story:** As an agent, I want to plan future actions, so I execute tasks at the right time.

**Acceptance Criteria:**
- `addTask()` schedules action for future
- `getNextTask()` retrieves highest priority pending task
- `completeTask()` marks task done, stores result
- Tasks have priority (1-10)
- Tasks have scheduled time
- Tasks support recurring patterns

**Example:**
```typescript
// Schedule task
await agent.addTask({
  action: 'send_followup_email',
  params: { lead_id: 'LEAD-123' },
  priority: 8,
  scheduledFor: '2025-01-12T09:00:00Z'
});

// Get next task to execute
const task = await agent.getNextTask();
// {
//   id: 'TASK-001',
//   action: 'send_followup_email',
//   params: { lead_id: 'LEAD-123' },
//   priority: 8,
//   status: 'pending'
// }

// Execute and complete
const result = await agent.executeAction(task.action, task.params);
await agent.completeTask(task.id, result);
// Task status → 'completed'
// Result stored in TASKS sheet
```

**TASKS Sheet Schema:**
```typescript
const TaskSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'cancelled']),
  priority: z.number().min(1).max(10),
  action: z.string(),
  params: z.string(), // JSON
  scheduledFor: z.string().datetime(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  result: z.string().nullable(), // JSON
});
```

---

### F7: Observable Dashboard

**User Story:** As a developer, I want to see agent status at a glance, so I know if it's healthy.

**Acceptance Criteria:**
- Auto-generated DASHBOARD sheet
- Shows: current status, uptime, last action, health
- Shows: today's activity (actions, success rate, errors)
- Shows: goal progress with visual indicators
- Updates automatically after each action
- Conditional formatting (green = on track, red = behind)

**Example:**
```typescript
// Dashboard auto-updates after each action
await agent.readWithContext({
  sheet: 'Leads',
  purpose: 'qualify_leads',
  goalId: 'GOAL-001'
});

// DASHBOARD sheet shows:
// ┌─────────────────────────────────┐
// │ Current Status                  │
// │ Agent: mastra-crm-001           │
// │ Uptime: 5 days 3 hours          │
// │ Last Action: qualify_leads      │
// │ Health: ✅ Healthy              │
// ├─────────────────────────────────┤
// │ Today's Activity                │
// │ Actions: 247                    │
// │ Success Rate: 94%               │
// │ Avg Duration: 180ms             │
// │ Errors: 15                      │
// ├─────────────────────────────────┤
// │ Goal Progress                   │
// │ GOAL-001: 8/10 (80%) ✅         │
// │ GOAL-002: 3/5 (60%) ⚠️          │
// └─────────────────────────────────┘

// Manual dashboard update
await agent.updateDashboard();
```

**Implementation:**
```typescript
async updateDashboard(): Promise<void> {
  const metrics = await this.calculateMetrics();
  
  // Write dashboard data
  await this.write({
    sheet: 'DASHBOARD',
    range: 'A1:B20',
    data: this.formatDashboard(metrics)
  });
  
  // Add conditional formatting
  await this.formatCells({
    sheet: 'DASHBOARD',
    range: 'B15:B16', // Goal progress
    rules: [
      {
        condition: { type: 'NUMBER_GREATER', values: [0.8] },
        format: { backgroundColor: { green: 0.8 } }
      },
      {
        condition: { type: 'NUMBER_LESS', values: [0.6] },
        format: { backgroundColor: { red: 0.8 } }
      }
    ]
  });
}
```

---

### F8: Read/Write/Format (From v2.1)

All features from v2.1 PRD:
- Read as objects (F1)
- Write with batching (F2)
- Serverless auth (F3)
- Client-side search (F4)
- Helpful errors (F5)
- Cell formatting (F6)
- Formula operations (F7)
- Cell metadata (F8)

**Note:** These are table stakes. Agent-grounding features (F1-F7 above) are the differentiator.

---

## Technical Architecture

### Stack (Same as v2.1)

| Component | Choice | Size | Rationale |
|-----------|--------|------|-----------|
| Core library | googleapis | 30KB | Official, complete API |
| Validation | Zod 3.22+ | 8KB* | Runtime safety |
| Auth | google-auth-library | 0KB | Included |
| Testing | Vitest | - | Fast, modern |
| Build | tsup | - | Tree-shaking |

*Peer dependency

**Total Bundle:** 38KB (30KB googleapis + 8KB wrapper)

### Enhanced API Surface

```typescript
class SheetAgent {
  // Workspace (NEW)
  initWorkspace(config: WorkspaceConfig): Promise<void>;
  
  // Memory (NEW)
  remember(key: string, value: any, options?: MemoryOptions): Promise<void>;
  recall(key: string): Promise<any>;
  forget(key: string): Promise<void>;
  
  // History (NEW)
  getHistory(filter?: HistoryFilter): Promise<Action[]>;
  
  // Goals (NEW)
  defineGoal(goal: Goal): Promise<void>;
  checkProgress(goalId: string): Promise<GoalProgress>;
  suggestNextAction(goalId: string): Promise<Task>;
  getActiveGoals(): Promise<Goal[]>;
  
  // Tasks (NEW)
  addTask(task: Task): Promise<void>;
  getNextTask(): Promise<Task | null>;
  completeTask(taskId: string, result: any): Promise<void>;
  
  // Dashboard (NEW)
  updateDashboard(): Promise<void>;
  
  // Context-Aware Operations (NEW)
  readWithContext(options: ReadWithContext): Promise<SheetData>;
  writeWithContext(options: WriteWithContext): Promise<WriteResult>;
  searchWithContext(options: SearchWithContext): Promise<SearchResult>;
  
  // Standard Operations (from v2.1)
  read<T>(options: ReadOptions): Promise<SheetData<T>>;
  write(options: WriteOptions): Promise<WriteResult>;
  search<T>(options: SearchOptions): Promise<SearchResult<T>>;
  batchUpdate(options: BatchUpdateOptions): Promise<BatchUpdateResult>;
  formatCells(options: FormatOptions): Promise<FormatResult>;
  writeFormula(options: FormulaOptions): Promise<WriteResult>;
  readFormulas(options: ReadOptions): Promise<FormulaData>;
}
```

### Workspace Schemas

**AGENT_CONFIG:**
```typescript
const AgentConfigSchema = z.object({
  agent_id: z.string(),
  agent_name: z.string(),
  agent_version: z.string(),
  purpose: z.string(),
  owner_email: z.string().email(),
  created_at: z.string().datetime(),
  environment: z.enum(['development', 'staging', 'production']),
});
```

**INSTRUCTIONS:**
```typescript
const InstructionSchema = z.object({
  id: z.string(),
  type: z.enum(['goal', 'constraint', 'rule']),
  priority: z.number().min(1).max(10),
  content: z.string(),
  active: z.boolean(),
  created_at: z.string().datetime(),
  // Goal-specific
  metric: z.string().optional(),
  target: z.number().optional(),
  deadline: z.string().datetime().optional(),
});
```

**MEMORY:**
```typescript
const MemorySchema = z.object({
  key: z.string(),
  value: z.string(), // JSON
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  tags: z.string().optional(),
  ttl: z.string().datetime().nullable(),
  updated_at: z.string().datetime(),
});
```

**HISTORY:**
```typescript
const HistorySchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  action: z.string(),
  input: z.string(), // JSON
  output: z.string(), // JSON
  status: z.enum(['success', 'failure']),
  duration_ms: z.number(),
  goalId: z.string().nullable(),
  error: z.string().nullable(),
});
```

**TASKS:**
```typescript
const TaskSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'cancelled']),
  priority: z.number().min(1).max(10),
  action: z.string(),
  params: z.string(), // JSON
  scheduledFor: z.string().datetime(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  result: z.string().nullable(),
});
```

---

## Success Metrics

### Launch Criteria (Must Meet)

| Metric | Target | Measurement | Gate |
|--------|--------|-------------|------|
| Bundle size | <50KB | `gzip -c dist/index.js \| wc -c` | CI fails if >50KB |
| Test coverage | ≥90% | Vitest report | Blocks merge if <85% |
| Agent setup time | <10 min | User testing (n=5) | 4/5 succeed |
| Goal tracking accuracy | 95% | Auto vs manual count | Integration tests |
| History logging | 100% | All ops logged | Unit tests |

### Adoption (3-Month Targets)

| Month | npm DL/Week | GitHub Stars | Agent Deployments |
|-------|-------------|--------------|-------------------|
| 1 | 30+ | 50+ | 10+ |
| 2 | 75+ | 125+ | 25+ |
| 3 | 150+ | 250+ | 50+ |

### Comparison to v2.1

| Feature | v2.1 (Basic) | v3.0 (Agent-Grounded) |
|---------|--------------|----------------------|
| Bundle | 38KB | 38KB ✓ Same |
| Read/Write | ✅ | ✅ |
| Formatting | ✅ | ✅ |
| Formulas | ✅ | ✅ |
| **Workspace** | ❌ | ✅ NEW |
| **Memory** | Basic | ✅ Full |
| **History** | ❌ | ✅ NEW |
| **Goals** | ❌ | ✅ NEW |
| **Tasks** | ❌ | ✅ NEW |
| **Dashboard** | ❌ | ✅ NEW |
| **Context Ops** | ❌ | ✅ NEW |

**v3.0 = v2.1 + Agent Grounding** (same bundle size!)

---

## Implementation Timeline

### Week 1-3: Core v2.1 Features

Same as v2.1 PRD:
- Week 1: Core operations + formatting
- Week 2: Search + metadata
- Week 3: Production polish

**Gate:** All v2.1 features working, <50KB bundle, ≥90% coverage

---

### Week 4: Workspace Foundation

**Days 1-2:**
- Workspace schemas (Zod validation)
- `initWorkspace()` implementation
- Create AGENT_CONFIG, INSTRUCTIONS, MEMORY, HISTORY, TASKS sheets
- Unit tests for workspace creation

**Days 3-4:**
- Memory operations (remember, recall, forget)
- Memory TTL and expiry
- Memory tags and search
- Integration tests with real sheets

**Days 5:**
- History logging infrastructure
- Auto-logging wrapper functions
- History query filters
- Performance optimization (<10ms overhead)

**Gate:** `bun run validate` passes, workspace tests ≥95% coverage

**Checkpoint:**
```bash
bun test tests/workspace/init.test.ts
bun test tests/workspace/memory.test.ts
bun test tests/workspace/history.test.ts
```

---

### Week 5: Goal Tracking & Context Ops

**Days 1-2:**
- Goal definition and storage
- Progress calculation from HISTORY
- `checkProgress()` implementation
- Goal status indicators

**Days 3:**
- `suggestNextAction()` implementation
- Action suggestion logic based on history
- Goal deadline warnings
- Integration tests

**Days 4:**
- Context-aware operations (readWithContext, writeWithContext)
- Constraint checking before operations
- Auto-logging integration
- State updates

**Days 5:**
- Task queue (addTask, getNextTask, completeTask)
- Task priority sorting
- Task scheduling logic
- E2E tests

**Gate:** Goal tracking 95% accurate, all context ops log correctly

**Checkpoint:**
```bash
bun test tests/goals/tracking.test.ts
bun test tests/context/operations.test.ts
bun test tests/tasks/queue.test.ts
```

---

### Week 6: Dashboard & Documentation

**Days 1-2:**
- Dashboard generation
- Metrics calculation
- Conditional formatting
- Auto-update on actions

**Days 3:**
- Complete code examples
- Migration guide from v2.1
- Agent workspace setup guide
- Goal tracking examples

**Days 4:**
- E2E agent workflow tests
- Real-world example: CRM agent
- Performance benchmarks
- Bundle size verification

**Days 5:**
- Security audit
- CHANGELOG
- Publish v1.0.0
- Announce launch

**Gate:** All success metrics met, documentation complete

**Final Checklist:**
```bash
bun run validate              # All checks pass
bun run size                  # <50KB ✓
bun test:coverage             # ≥90% ✓
bun test:e2e                  # All workflows pass
bun audit                     # Zero high/critical ✓
```

---

## Example: Complete Agent Lifecycle

```typescript
// ============================================
// 1. INITIALIZATION (First Time)
// ============================================
const agent = new SheetAgent({
  spreadsheetId: 'abc123',
  agentId: 'mastra-crm-001',
});

// Create workspace
await agent.initWorkspace({
  agentId: 'mastra-crm-001',
  agentName: 'CRM Lead Qualifier',
  purpose: 'Qualify sales leads and track progress',
  goals: [{
    id: 'GOAL-001',
    description: 'Qualify 10 leads per week with score ≥80',
    metric: 'qualified_leads',
    target: 10,
    deadline: '2025-01-18T23:59:59Z'
  }],
  constraints: [{
    id: 'CONSTRAINT-001',
    description: 'Never delete leads without manager approval',
    priority: 10
  }]
});

// ============================================
// 2. DAILY OPERATION
// ============================================

// Morning: Check goals and get plan
const goals = await agent.getActiveGoals();
console.log('Active goals:', goals.length);

const progress = await agent.checkProgress('GOAL-001');
console.log(`Progress: ${progress.current}/${progress.target} (${progress.percentComplete}%)`);

if (!progress.onTrack) {
  console.warn('⚠️ Behind schedule!');
}

// Get suggested action
const nextAction = await agent.suggestNextAction('GOAL-001');
console.log('Suggested:', nextAction.action, nextAction.reasoning);

// Execute with full context
const leads = await agent.searchWithContext({
  sheet: 'Leads',
  purpose: 'qualify_leads',
  goalId: 'GOAL-001',
  query: { score: { gte: 80 }, status: 'new' }
});

console.log(`Found ${leads.rows.length} high-score leads`);

// Process each lead
for (const lead of leads.rows) {
  // Qualify lead
  const qualified = await agent.qualifyLead(lead);
  
  if (qualified) {
    // Update lead status
    await agent.writeWithContext({
      sheet: 'Leads',
      purpose: 'update_lead_status',
      goalId: 'GOAL-001',
      data: [{
        id: lead.id,
        status: 'qualified',
        qualified_at: new Date().toISOString()
      }]
    });
    
    // Remember this lead
    await agent.remember('last_qualified_lead', lead.id);
    
    // Schedule follow-up task
    await agent.addTask({
      action: 'send_welcome_email',
      params: { lead_id: lead.id },
      priority: 8,
      scheduledFor: new Date(Date.now() + 3600000).toISOString() // 1 hour
    });
  }
}

// ============================================
// 3. ONGOING: Task Execution
// ============================================

// Check for due tasks
const task = await agent.getNextTask();

if (task) {
  console.log('Executing task:', task.action);
  
  try {
    const result = await agent.executeTask(task);
    await agent.completeTask(task.id, result);
  } catch (error) {
    console.error('Task failed:', error);
    // Task automatically logged to HISTORY with error
  }
}

// ============================================
// 4. EVENING: Review & Update
// ============================================

// Get today's activity
const todayHistory = await agent.getHistory({
  since: new Date().toISOString().split('T')[0] + 'T00:00:00Z'
});

console.log(`Today: ${todayHistory.length} actions`);

const successRate = todayHistory.filter(a => a.status === 'success').length / todayHistory.length;
console.log(`Success rate: ${(successRate * 100).toFixed(1)}%`);

// Update dashboard
await agent.updateDashboard();

// Check if any goals completed
const finalProgress = await agent.checkProgress('GOAL-001');
if (finalProgress.percentComplete >= 100) {
  console.log('🎉 Goal GOAL-001 completed!');
}

// ============================================
// 5. RESTART (Next Day)
// ============================================

// Agent remembers everything!
const lastLead = await agent.recall('last_qualified_lead');
console.log('Resuming from lead:', lastLead);

const progress2 = await agent.checkProgress('GOAL-001');
console.log('Current progress:', progress2.current);
// Still shows 8/10 from yesterday!
```

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Bundle >50KB with workspace | High | Low | Workspace schemas add ~4KB only |
| Goal tracking accuracy <95% | Medium | Medium | Extensive integration tests, manual verification |
| History logging overhead >10ms | Medium | Low | Async logging, no blocking |
| Workspace sheet conflicts | Medium | Low | Reserved sheet names, validation |
| Memory storage limits | Low | Medium | Document limits (10K rows = ~500 memories) |

---

## Decision Log

### Resolved

| Question | Decision | Rationale |
|----------|----------|-----------|
| Include multi-agent? | No (Phase 3) | Keep v1 simple, focus on single-agent grounding |
| Include pattern learning? | No (Phase 4) | Advanced AI beyond v1 scope |
| Goal tracking approach? | Analyze HISTORY | No external DB needed, transparent |
| Memory storage? | MEMORY sheet | Simple, human-readable, no DB setup |
| Task scheduling? | TASKS sheet | Self-contained, visible queue |
| Dashboard updates? | After each action | Real-time visibility |

### Out of Scope (Future Versions)

- Multi-agent coordination (MESSAGES sheet, handoffs)
- Pattern learning from history
- Performance optimization suggestions
- Sheet-native query language (QUERY formulas)
- Time-travel debugging

---

## Appendix

### Workspace Sheet Details

**AGENT_CONFIG Sheet:**
| Column | Type | Example |
|--------|------|---------|
| key | string | agent_id |
| value | string | mastra-crm-001 |
| type | string | string |
| updated_at | datetime | 2025-01-11T10:00:00Z |

**INSTRUCTIONS Sheet:**
| Column | Type | Example |
|--------|------|---------|
| id | string | GOAL-001 |
| type | enum | goal |
| priority | number | 10 |
| content | string | "Qualify 10 leads/week..." |
| active | boolean | TRUE |
| metric | string | qualified_leads |
| target | number | 10 |
| deadline | datetime | 2025-01-18T23:59:59Z |

**MEMORY Sheet:**
| Column | Type | Example |
|--------|------|---------|
| key | string | last_lead_id |
| value | string | "LEAD-12345" |
| type | string | string |
| tags | string | lead,recent |
| ttl | datetime | null |
| updated_at | datetime | 2025-01-11T10:00:00Z |

**HISTORY Sheet:**
| Column | Type | Example |
|--------|------|---------|
| id | string | ACT-00123 |
| timestamp | datetime | 2025-01-11T10:30:45Z |
| action | string | qualify_leads |
| input | string | {"sheet":"Leads",...} |
| output | string | {"rowCount":5} |
| status | enum | success |
| duration_ms | number | 245 |
| goalId | string | GOAL-001 |

**TASKS Sheet:**
| Column | Type | Example |
|--------|------|---------|
| id | string | TASK-001 |
| status | enum | pending |
| priority | number | 8 |
| action | string | send_followup_email |
| params | string | {"lead_id":"LEAD-123"} |
| scheduledFor | datetime | 2025-01-12T09:00:00Z |
| completedAt | datetime | null |
| result | string | null |

### Bundle Size Breakdown

```
googleapis (tree-shaken):     30 KB
Core wrapper (v2.1):           8 KB
Workspace schemas:             2 KB
Goal tracking logic:           1 KB
Context-aware wrappers:        1 KB
--------------------------------------
Total:                        42 KB
Gzipped:                      38 KB ✓
```

**Still under 50KB limit!**

---

*Version: 3.0 (Agent-Grounded)*  
*Bundle: 38KB (googleapis 30KB + wrapper 8KB)*  
*Timeline: 5 weeks (3 weeks v2.1 + 2 weeks agent features)*  
*Status: Ready for Implementation*