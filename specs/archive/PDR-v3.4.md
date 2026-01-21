# Product Requirements Document: g-sheet-agent-io

**Version:** 3.4  
**Date:** January 11, 2025  
**Status:** Ready for Implementation  
**Timeline:** 6 weeks

---

## Executive Summary

### Problem
AI agents using Google Sheets lack persistent context, goal awareness, and action history. Each restart loses all state, making debugging impossible and goal tracking manual.

### Solution
A <55KB TypeScript library that adds agent workspace capabilities to Google Sheets:
- Persistent memory across restarts
- Automatic goal tracking and progress monitoring
- Complete action history for debugging and audits
- Human-readable, editable agent context

### Key Metrics
| Metric | Target | Limit |
|--------|--------|-------|
| Bundle size (gzipped) | 48KB | 55KB |
| Agent setup time | <10 min | - |
| Test coverage | 90% | 85% minimum |
| Goal tracking accuracy | 95% | - |

### Differentiation
- 10x lighter than google-spreadsheet (500KB+)
- Agent-native: workspace pattern with MEMORY, HISTORY, TASKS sheets
- Self-contained: no external database required
- Serverless-ready: Base64 credentials, no file mounts

### What This Library Does NOT Do

- **Does NOT auto-grant access**: User must explicitly share sheets with service account
- **Does NOT store credentials**: User provides via env vars or config; library never persists them
- **Does NOT handle OAuth flows**: Service account only; no browser-based consent
- **Does NOT manage Google Cloud setup**: User creates service account and enables Sheets API
- **Does NOT provide real-time sync**: Polling-based, not WebSocket

---

## Non-Goals (v1.0)

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-instance concurrency | Out of scope | Single agent per workspace only |
| Multi-agent coordination | Phase 3 | Agent bus, handoffs |
| Pattern learning | Phase 4 | ML-based optimization |
| Memory TTL/auto-expiry | Not planned | Use manual `forget()` |
| OAuth interactive flows | Not planned | Service account only |
| Real-time collaboration | Not planned | WebSocket sync |

---

## Target Users

| Segment | Share | Primary Need | Success Indicator |
|---------|-------|--------------|-------------------|
| AI Agent Developer | 70% | Persistent agent context | "Agent remembers state after restart" |
| Operations/DevOps | 20% | Audit trails, debugging | "I can trace every agent action" |
| Product Manager | 10% | Goal tracking, validation | "Dashboard shows 8/10 leads qualified" |

---

## Features

### F1: Agent Workspace

**User Story:** As an agent developer, I want a standard workspace structure so agents have persistent context across restarts.

**API:**
```typescript
await agent.initWorkspace(config: WorkspaceConfig): Promise<void>
await agent.validateWorkspace(): Promise<WorkspaceValidation>
```

**Acceptance Criteria:**
- Creates 5 sheets: AGENT_CONFIG, INSTRUCTIONS, MEMORY, HISTORY, TASKS
- All sheets have Zod-validated schemas
- Non-destructive: preserves existing data sheets
- `validateWorkspace()` returns integrity status and issues list

**Workspace Structure:**
```
├── AGENT_CONFIG   # Agent identity, state
├── INSTRUCTIONS   # Goals, constraints, rules
├── MEMORY         # Key-value storage
├── HISTORY        # Action audit log
├── TASKS          # Scheduled actions queue
└── [User sheets]  # Preserved
```

---

### F2: Persistent Memory

**User Story:** As an agent, I want to store and retrieve state so I don't lose context on restart.

**API:**
```typescript
// Single operations
await agent.remember(key: string, value: any, options?: { tags?: string }): Promise<void>
await agent.recall(key: string): Promise<any>
await agent.forget(key: string): Promise<void>

// Batch operations
await agent.rememberMany(entries: MemoryEntry[]): Promise<void>
await agent.recallMany(keys: string[]): Promise<Record<string, any>>
await agent.forgetMany(keys: string[]): Promise<void>
```

**Acceptance Criteria:**
- Supports types: string, number, boolean, object, array
- Batch operations are atomic
- Optional tags for memory categorization
- Values persisted to MEMORY sheet as JSON

**Schema:**
| Column | Type | Required |
|--------|------|----------|
| key | string | Yes |
| value | string (JSON) | Yes |
| type | enum | Yes |
| tags | string | No |
| updated_at | datetime | Yes |

---

### F3: Action History

**User Story:** As a developer, I want a complete action log so I can debug and audit agent behavior.

**API:**
```typescript
await agent.fetchHistory(filter?: HistoryFilter): Promise<Action[]>
```

**Acceptance Criteria:**
- All operations auto-log to HISTORY sheet
- Append-only (never deletes)
- Queryable by: time range, action type, status, goalId
- Includes: action, input, output, status, duration_ms, error

**Schema:**
| Column | Type | Required |
|--------|------|----------|
| id | string | Yes |
| timestamp | datetime | Yes |
| action | string | Yes |
| input | string (JSON) | Yes |
| output | string (JSON) | Yes |
| status | success \| failure | Yes |
| duration_ms | number | Yes |
| goalId | string | No |
| error | string | No |
| dryRun | boolean | No |

---

### F4: Goal Tracking

**User Story:** As an agent, I want to track progress toward goals so I know if I'm succeeding.

**API:**
```typescript
await agent.defineGoal(goal: Goal): Promise<void>
await agent.checkProgress(goalId: string): Promise<GoalProgress>
await agent.suggestAction(goalId: string): Promise<SuggestedAction>
await agent.fetchGoals(filter?: { active?: boolean }): Promise<Goal[]>
await agent.fetchConstraints(): Promise<Constraint[]>
```

**Acceptance Criteria:**
- Goals stored in INSTRUCTIONS sheet with type='goal'
- Progress calculated from HISTORY entries matching goalId
- `checkProgress()` returns: current, target, percentComplete, onTrack, daysRemaining
- `suggestAction()` returns next action based on goal deficit

**GoalProgress Response:**
```typescript
{
  goalId: string;
  current: number;
  target: number;
  percentComplete: number;  // 0-100
  onTrack: boolean;
  daysRemaining: number;
}
```

---

### F5: Context-Aware Operations

**User Story:** As an agent, I want operations to auto-log context so I don't manually track actions.

**API:**
```typescript
await agent.readWithContext(options: ReadWithContext): Promise<SheetData>
await agent.writeWithContext(options: WriteWithContext): Promise<WriteResult>
await agent.searchWithContext(options: SearchWithContext): Promise<SearchResult>
```

**Acceptance Criteria:**
- Auto-logs to HISTORY with purpose and goalId
- Checks constraints before execution
- Updates agent state (last_action, last_sheet)
- Respects dryRun mode (logs without executing)
- Performance: <10ms overhead vs standard operations

**Context Options:**
```typescript
interface ReadWithContext {
  sheet: string;
  purpose: string;      // Logged as action name
  goalId?: string;      // Links to goal for tracking
  query?: QueryFilter;
}
```

---

### F6: Task Queue

**User Story:** As an agent, I want to schedule future actions so I execute tasks at the right time.

**API:**
```typescript
await agent.scheduleTask(task: TaskInput): Promise<void>
await agent.scheduleTasks(tasks: TaskInput[]): Promise<void>
await agent.fetchTask(): Promise<Task | null>
await agent.completeTask(taskId: string, result: any): Promise<void>
await agent.cancelTask(taskId: string): Promise<void>
```

**Acceptance Criteria:**
- `fetchTask()` returns highest-priority pending task
- Tasks have priority 1-10 (10 = highest)
- Tasks have scheduledFor datetime
- Status transitions: pending → in_progress → completed/failed/cancelled

**Schema:**
| Column | Type | Required |
|--------|------|----------|
| id | string | Yes |
| status | pending \| in_progress \| completed \| failed \| cancelled | Yes |
| priority | number (1-10) | Yes |
| action | string | Yes |
| params | string (JSON) | Yes |
| scheduledFor | datetime | Yes |
| createdAt | datetime | Yes |
| completedAt | datetime | No |
| result | string (JSON) | No |

---

### F7: Agent Lifecycle

**User Story:** As a developer, I want to gracefully pause and resume agent operations.

**API:**
```typescript
await agent.pause(): Promise<void>
await agent.resume(): Promise<void>
await agent.status(): Promise<AgentStatus>
```

**Acceptance Criteria:**
- `pause()` completes in-flight operations, then rejects new ones
- Paused state persisted to AGENT_CONFIG
- Operations during pause throw `AgentPausedError`
- `status()` returns: state, uptime, lastAction, pendingTasks, memoryEntries

**AgentStatus Response:**
```typescript
{
  state: 'running' | 'paused';
  uptime: number;           // ms
  lastAction: string;       // ISO datetime
  pausedAt?: string;        // ISO datetime (if paused)
  pendingTasks: number;
  memoryEntries: number;
  historyEntries: number;
}
```

---

### F8: Rate Limiting & Retry

**User Story:** As a developer, I want automatic rate limit and transient error handling so my agent doesn't fail on temporary issues.

**API:**
```typescript
await agent.rateLimitStatus(): Promise<RateLimitStatus>
```

**Configuration:**
```typescript
{
  rateLimit: {
    requestsPerMinute: 250,  // Default (Google limit: 300)
    retryAttempts: 3,
    backoffMs: 1000,
    maxBackoffMs: 30000
  },
  retry: {
    enabled: true,           // Default: true
    maxAttempts: 3,          // Default: 3
    retryableErrors: [       // Default list
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      '500',
      '502',
      '503',
      '504'
    ]
  }
}
```

**Acceptance Criteria:**
- Automatic retry with exponential backoff on 429 errors
- Automatic retry on transient network errors (connection reset, timeout, DNS)
- Automatic retry on 5xx server errors
- Request queuing when approaching rate limit
- Batch operations to minimize API calls
- `rateLimitStatus()` returns: requestsThisMinute, remaining, resetsAt

**Retry Behavior:**
| Error Type | Retryable | Backoff |
|------------|-----------|---------|
| 429 Rate Limit | Yes | Exponential (1s → 2s → 4s) |
| 500 Internal Server Error | Yes | Exponential |
| 502 Bad Gateway | Yes | Exponential |
| 503 Service Unavailable | Yes | Exponential |
| 504 Gateway Timeout | Yes | Exponential |
| ECONNRESET | Yes | Exponential |
| ETIMEDOUT | Yes | Exponential |
| 400 Bad Request | No | - |
| 401 Unauthorized | No | - |
| 403 Forbidden | No | - |
| 404 Not Found | No | - |

---

### F9: Dry Run Mode

**User Story:** As a developer, I want to test agent logic without modifying sheets.

**Configuration:**
```typescript
const agent = new SheetAgent({
  spreadsheetId: 'abc123',
  dryRun: true
});
```

**Acceptance Criteria:**
- All writes return simulated results
- All operations log to HISTORY with `dryRun: true`
- No actual sheet modifications
- Reads execute normally

---

### F10: Core Operations

Standard sheet operations with full type safety and dual output format.

**API:**
```typescript
// Read/Write
await agent.read<T>(options: ReadOptions): Promise<SheetData<T>>
await agent.write(options: WriteOptions): Promise<WriteResult>
await agent.batchUpdate(options: BatchUpdateOptions): Promise<BatchUpdateResult>

// Search
await agent.search<T>(options: SearchOptions): Promise<SearchResult<T>>

// Formatting
await agent.formatCells(options: FormatOptions): Promise<FormatResult>

// Formulas
await agent.writeFormula(options: FormulaOptions): Promise<WriteResult>
await agent.readFormulas(options: ReadOptions): Promise<FormulaData>

// Metadata
await agent.getCellMetadata(options: MetadataOptions): Promise<CellMetadata>
```

**Dual Output Format:**

Objects by default (better DX):
```typescript
const { rows } = await agent.read<Contact>({ sheet: 'Contacts' });
// rows: [{ name: 'Alice', email: 'alice@example.com' }]
console.log(rows[0].name);  // Type-safe access
```

Arrays optional (better performance):
```typescript
const { rows } = await agent.read({
  sheet: 'Contacts',
  format: 'array'  // Skip object conversion
});
// rows: [['Alice', 'alice@example.com']]
```

**Read Options:**
```typescript
interface ReadOptions<T = Record<string, unknown>> {
  sheet: string | number;       // Sheet name or index
  range?: string;               // A1 notation (optional)
  format?: 'object' | 'array';  // Default: 'object'
  headers?: string[] | boolean; // Auto-detect (true), specify, or skip (false)
}
```

**Acceptance Criteria:**
- Default format: Objects with column headers as keys
- Optional format: Arrays (for performance-critical operations)
- Headers: Auto-detect from row 1 OR specify explicitly OR skip
- Type inference: `read<Contact>({ sheet })` returns `Contact[]`
- Empty sheets: Return `{ rows: [] }` (not error)

**Search Options:**
| Option | Values | Default |
|--------|--------|---------|
| operator | `'and'` \| `'or'` | `'and'` |
| matching | `'strict'` \| `'loose'` (substring) | `'strict'` |

Performance: <3s for 5,000 rows

**Cell Metadata:**
- Data types (number, string, date, formula)
- Cell notes/comments
- Merged cell info
- Data validation rules

---

## Technical Architecture

### Auth Configuration

Serverless-first authentication with no file mounts required.

**Priority Chain** (checked in order):
1. `options.credentials` — Direct credential object
2. `CREDENTIALS_CONFIG` — Base64-encoded JSON env var
3. `options.keyFile` — Path to JSON file (local dev only)

**Serverless Setup (Cloudflare Workers):**
```bash
# Encode credentials
cat service-account.json | base64 -w 0 > credentials.txt

# Set in wrangler.toml or dashboard
[vars]
CREDENTIALS_CONFIG = "eyJ0eXBlIjoic2VydmljZV9hY2NvdW50Ii..."
```

**Local Development:**
```typescript
const agent = new SheetAgent({
  spreadsheetId: 'abc123',
  keyFile: './service-account.json'  // Local only
});
```

**Error on Missing Auth:**
```
AuthError: No credentials found
Set one of:
  • options.credentials (object)
  • CREDENTIALS_CONFIG env var (Base64)
  • options.keyFile (path)
```

---

### Error Standards

All errors include actionable fix instructions.

**Validation Errors:**
```typescript
ValidationError: Validation failed
  options.sheet: Expected string, received number
  options.range: Invalid A1 notation. Expected 'A1:Z100', got 'invalid'
```

**Permission Errors:**
```typescript
PermissionError: Cannot write to sheet 'Leads'
Reason: Sheet not shared with service account
Fix: Share with service@project.iam.gserviceaccount.com (Editor role)
```

**Rate Limit Errors:**
```typescript
RateLimitError: API quota exceeded
Reason: 300+ requests in 60 seconds
Fix: Reduce request frequency or use batchUpdate()
Retry-After: 30 seconds
```

**Network Errors:**
```typescript
NetworkError: Connection failed (ECONNRESET)
Reason: Transient network issue
Status: Retrying (attempt 2/3)
```

**Agent State Errors:**
```typescript
AgentPausedError: Agent is paused
Fix: Call agent.resume() to continue operations
```

---

### Package Configuration

**package.json (required fields):**
```json
{
  "name": "g-sheet-agent-io",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "sideEffects": false,
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    },
    "./schemas": {
      "import": "./dist/schemas.js",
      "require": "./dist/schemas.cjs"
    }
  },
  "files": [
    "dist"
  ],
  "engines": {
    "node": ">=18"
  },
  "peerDependencies": {
    "zod": "^3.22.0"
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "validate": "bun run typecheck && bun run lint && bun test && bun run size",
    "size": "bun run build && gzip -c dist/index.js | wc -c"
  }
}
```

**Key package.json requirements:**
| Field | Value | Purpose |
|-------|-------|---------|
| `type` | `"module"` | ES modules by default |
| `sideEffects` | `false` | Enables tree-shaking |
| `exports` | Conditional exports | Proper ESM/CJS resolution |
| `files` | `["dist"]` | Only publish built files |

---

### TypeScript Configuration

**tsconfig.json (required settings):**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true,
    
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Key tsconfig requirements:**
| Setting | Value | Purpose |
|---------|-------|---------|
| `strict` | `true` | Enable all strict checks |
| `noUncheckedIndexedAccess` | `true` | Safer array/object access |
| `forceConsistentCasingInFileNames` | `true` | Cross-platform compatibility |
| `isolatedModules` | `true` | Required for esbuild/tsup |
| `moduleResolution` | `"bundler"` | Modern resolution for bundlers |

---

### Build Configuration

**tsup.config.ts:**
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/schemas.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: true,
  splitting: false,
  external: ['zod'],
});
```

---

### Bundle Breakdown

| Component | Size |
|-----------|------|
| googleapis (tree-shaken) | 30 KB |
| Core wrapper | 8 KB |
| Workspace schemas | 3 KB |
| Memory operations | 2 KB |
| History logging | 2 KB |
| Goal tracking | 2 KB |
| Task queue | 1 KB |
| Rate limiter + retry | 1.5 KB |
| Context wrappers | 1 KB |
| Lifecycle control | 0.5 KB |
| **Total (uncompressed)** | **51 KB** |
| **Gzipped** | **~48 KB** |

Cloudflare Workers limit: 3MB compressed → 98% headroom remaining

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| googleapis | latest | Google Sheets API |
| zod | 3.22+ | Schema validation (peer dep) |

---

### Configuration Interface

```typescript
interface SheetAgentOptions {
  spreadsheetId: string;
  agentId?: string;
  
  // Auth (pick one)
  credentials?: ServiceAccountCredentials;
  keyFile?: string;  // Local dev only
  
  // Modes
  dryRun?: boolean;
  
  // Output format
  defaultFormat?: 'object' | 'array';  // Default: 'object'
  
  // Rate limiting
  rateLimit?: {
    requestsPerMinute?: number;  // Default: 250
    retryAttempts?: number;      // Default: 3
    backoffMs?: number;          // Default: 1000
    maxBackoffMs?: number;       // Default: 30000
  };
  
  // Retry for transient errors
  retry?: {
    enabled?: boolean;           // Default: true
    maxAttempts?: number;        // Default: 3
    retryableErrors?: string[];  // Default: network + 5xx errors
  };
}
```

---

## Success Metrics

### Launch Gates

| Metric | Target | Gate | Measurement |
|--------|--------|------|-------------|
| Bundle size | 48KB | CI fails >55KB | `gzip -c dist/index.js \| wc -c` |
| Test coverage | 90% | Blocks merge <85% | Vitest coverage |
| Setup time | <10 min | 4/5 users succeed | User testing (n=5) |
| Goal accuracy | 95% | - | Auto vs manual count |
| History logging | 100% | - | All ops logged |
| Rate limit handling | 0 unhandled 429s | - | E2E tests |
| Retry success | 95% transient recovery | - | Integration tests |

### Adoption Targets (3-Month)

| Month | npm Downloads/Week | GitHub Stars |
|-------|-------------------|--------------|
| 1 | 30+ | 50+ |
| 2 | 75+ | 125+ |
| 3 | 150+ | 250+ |

---

## Performance Bounds

| Operation | Expected | Warning | Critical |
|-----------|----------|---------|----------|
| `recall()` single key | <50ms | >100ms | >500ms |
| `recallMany()` 10 keys | <100ms | >200ms | >1s |
| `fetchHistory()` 100 records | <200ms | >500ms | >2s |
| `fetchHistory()` 1000 records | <1s | >2s | >5s |
| `search()` 5000 rows | <3s | >5s | >10s |
| Context operation overhead | <10ms | >25ms | >50ms |
| `validateWorkspace()` | <500ms | >1s | >3s |
| Object conversion (1000 rows) | <50ms | >100ms | >200ms |

### Resource Limits

| Resource | Recommended | Hard Limit |
|----------|-------------|------------|
| MEMORY entries | 500 | 10,000 |
| HISTORY entries | 10,000 | 100,000 |
| Pending TASKS | 100 | 1,000 |
| Memory value size | 10KB | 50KB |

---

## Implementation Timeline

### Week 1-3: Core Operations
- Read/write/search with batching
- Dual output format (object/array)
- Cell formatting and formulas
- Error handling and auth
- **Gate:** <50KB bundle, 90% coverage

### Week 4: Workspace Foundation
- Day 1-2: Workspace init, validation, schemas
- Day 3-4: Memory operations (single + batch)
- Day 5: History logging infrastructure
- **Gate:** Workspace tests pass

### Week 5: Goals & Context
- Day 1-2: Goal definition, progress tracking, suggestions
- Day 3: Context-aware operations, dry run mode
- Day 4: Task queue (single + batch)
- Day 5: Rate limiter + retry logic
- **Gate:** Goal tracking 95% accurate

### Week 6: Polish & Launch
- Day 1-2: Lifecycle control (pause/resume/status)
- Day 3: Documentation, examples
- Day 4: E2E tests, benchmarks, bundle verification
- Day 5: Security audit, publish v1.0.0
- **Gate:** All launch metrics met

---

## Development Commands

```bash
# Install
bun install

# Build (fails if >55KB gzipped)
bun run build

# Test
bun test              # All tests
bun test:coverage     # With coverage (≥90% required)

# Validate (typecheck + lint + test + size)
bun run validate

# Size check
bun run size

# Format
bun run format
```

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Bundle >55KB | High | Low | CI gate, tree-shaking, sideEffects: false |
| Goal tracking <95% accuracy | Medium | Medium | Integration tests, manual verification |
| Logging overhead >10ms | Medium | Low | Async logging |
| Rate limit exhaustion | Medium | Medium | Built-in limiter, configurable |
| Transient network failures | Medium | Medium | Automatic retry with backoff |
| Concurrent instance conflicts | High | N/A | Documented single-instance only |

---

## Appendix: Complete API Reference

```typescript
class SheetAgent {
  // Workspace
  initWorkspace(config: WorkspaceConfig): Promise<void>;
  validateWorkspace(): Promise<WorkspaceValidation>;
  
  // Memory
  remember(key: string, value: any, options?: MemoryOptions): Promise<void>;
  rememberMany(entries: MemoryEntry[]): Promise<void>;
  recall(key: string): Promise<any>;
  recallMany(keys: string[]): Promise<Record<string, any>>;
  forget(key: string): Promise<void>;
  forgetMany(keys: string[]): Promise<void>;
  
  // History
  fetchHistory(filter?: HistoryFilter): Promise<Action[]>;
  
  // Goals
  defineGoal(goal: Goal): Promise<void>;
  checkProgress(goalId: string): Promise<GoalProgress>;
  suggestAction(goalId: string): Promise<SuggestedAction>;
  fetchGoals(filter?: GoalFilter): Promise<Goal[]>;
  fetchConstraints(): Promise<Constraint[]>;
  
  // Tasks
  scheduleTask(task: TaskInput): Promise<void>;
  scheduleTasks(tasks: TaskInput[]): Promise<void>;
  fetchTask(): Promise<Task | null>;
  completeTask(taskId: string, result: any): Promise<void>;
  cancelTask(taskId: string): Promise<void>;
  
  // Lifecycle
  pause(): Promise<void>;
  resume(): Promise<void>;
  status(): Promise<AgentStatus>;
  
  // Rate Limiting
  rateLimitStatus(): Promise<RateLimitStatus>;
  
  // Context-Aware Operations
  readWithContext(options: ReadWithContext): Promise<SheetData>;
  writeWithContext(options: WriteWithContext): Promise<WriteResult>;
  searchWithContext(options: SearchWithContext): Promise<SearchResult>;
  
  // Core Operations (dual format support)
  read<T>(options: ReadOptions): Promise<SheetData<T>>;
  write(options: WriteOptions): Promise<WriteResult>;
  search<T>(options: SearchOptions): Promise<SearchResult<T>>;
  batchUpdate(options: BatchUpdateOptions): Promise<BatchUpdateResult>;
  formatCells(options: FormatOptions): Promise<FormatResult>;
  writeFormula(options: FormulaOptions): Promise<WriteResult>;
  readFormulas(options: ReadOptions): Promise<FormulaData>;
  getCellMetadata(options: MetadataOptions): Promise<CellMetadata>;
}
```

---

*Version 3.4 — Ready for Implementation*
