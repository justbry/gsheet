# Product Requirements Document: g-sheet-agent-io

**Version:** 2.1 (Simplified)  
**Date:** January 11, 2025  
**Status:** Ready for Implementation  
**Timeline:** 3 weeks to v1.0.0-beta.1

---

## Executive Summary

**Problem:** AI agents need lightweight Google Sheets operations for Cloudflare Workers. Existing libraries are either too heavy (500KB-2MB) or read-only (5KB).

**Solution:** A <50KB TypeScript library using the official googleapis library (30KB) for complete API access.

**Differentiation:**
- 38KB bundle (13x lighter than google-spreadsheet at 500KB)
- Objects by default: `{ name: 'Alice' }` not `['Alice']`
- Zod runtime validation (none of 3 analyzed projects have this)
- Serverless-ready (CREDENTIALS_CONFIG Base64 pattern)
- ≥90% test coverage (vs 30-60% in existing projects)
- Complete API: formatting, formulas, metadata

**Success Criteria:**
- Bundle: <50KB gzipped (38KB target)
- Setup time: <5 minutes (4/5 users succeed without docs)
- Coverage: ≥90% (blocks merge if <85%)
- Adoption: 100+ npm downloads/week by Month 3

---

## Problem Validation

Analysis of 3 existing projects (648 combined GitHub stars):

**g-sheets-api** (140 stars, 5KB)
- ✅ Lightweight, objects not arrays
- ❌ Read-only (top user complaint), public sheets only, no TypeScript

**mcp-google-sheets** (508 stars, Python)
- ✅ Complete features, CREDENTIALS_CONFIG pattern, batch operations
- ❌ Python (wrong ecosystem), server-based (no bundle optimization)

**google-sheets-mcp** (106 stars, TypeScript)
- ✅ TypeScript-first, verb-based API
- ❌ OAuth only (no automation), verbose API, no batching

**User Needs:**
1. Lightweight (<50KB for CF Workers 3MB limit)
2. Read + write (not read-only)
3. Private sheets (service account auth)
4. Type-safe (TypeScript + runtime validation)
5. Objects not arrays (better DX)

---

## Goals

### Primary (SMART)

| Goal | Measurement | Target | Gate |
|------|-------------|--------|------|
| Bundle size | `gzip -c dist/index.js \| wc -c` | 38KB (limit: 50KB) | CI fails if >50KB |
| Setup time | User testing (n=5, no docs) | <5 min (4/5 succeed) | Pre-launch |
| Test coverage | Vitest coverage report | ≥90% overall | Blocks merge if <85% |
| API completeness | Feature parity with googleapis | 80% of Sheets API | Week 2 checkpoint |
| Runtime safety | Zod validation | 100% inputs/outputs | Week 1 checkpoint |

### Non-Goals

- OAuth interactive flows (service account only)
- Real-time collaboration (WebSocket overhead >100KB)
- Browser-specific features (Node.js/edge only)
- Google Drive file upload (out of scope)

---

## Target Users

**Primary: AI Agent Developer** (60%)
- Need: <3MB bundle for CF Workers, type-safe operations
- Pain: google-spreadsheet (500KB) too heavy, g-sheets-api read-only
- Win: "Bundle dropped from 2.1MB to 600KB. Write operations work!"

**Secondary: Serverless App Developer** (30%)
- Need: Zero file mounts for Docker/K8s
- Pain: Must mount credential files
- Win: "Base64 creds in env var. No file management."

**Tertiary: PM Using AI** (10%)
- Need: Data validation, audit trails
- Pain: Agents corrupt data
- Win: "Zod validation prevented 47 invalid writes in Week 1."

---

## Features

### F1: Read as Objects

**User Story:** As a developer, I want sheet data as typed objects, so I don't manually parse arrays.

**Acceptance Criteria:**
- Default format: Objects with column headers as keys
- Optional format: Arrays (for performance)
- Headers: Auto-detect from row 1 OR specify explicitly
- Type inference: `read<Contact>({ sheet })` returns `Contact[]`
- Empty sheets: Return `{ rows: [] }` (not error)

**Example:**
```typescript
const { rows } = await agent.read<Contact>({ sheet: 'Contacts' });
// rows: [{ name: 'Alice', email: 'alice@example.com' }]
console.log(rows[0].name); // Type-safe
```

---

### F2: Write with Batching

**User Story:** As an agent developer, I want to update multiple ranges in one API call, so I avoid rate limits.

**Acceptance Criteria:**
- `write()`: Single range, accepts objects or arrays
- `batchUpdate()`: Multiple ranges in one API call
- Zod validation before API call
- Error messages include fix instructions: "Share sheet with service@..."

**Example:**
```typescript
// Batch: one API call for multiple ranges
await agent.batchUpdate({
  sheet: 'Contacts',
  updates: [
    { range: 'A1:A5', values: [['Alice'], ['Bob']] },
    { range: 'B1:B5', values: [['alice@'], ['bob@']] }
  ]
});
```

---

### F3: Serverless Auth

**User Story:** As a DevOps engineer, I want Base64 credentials in env vars, so I don't mount files.

**Acceptance Criteria:**
- Auth priority: `CREDENTIALS_CONFIG` → `SERVICE_ACCOUNT_PATH` → `GOOGLE_APPLICATION_CREDENTIALS`
- Base64 decode: Transparent (user provides encoded string)
- Folder scoping: `DRIVE_FOLDER_ID` limits list/create operations
- Error messages: Include setup instructions

**Example:**
```bash
# Docker/K8s: Base64 in env var
export CREDENTIALS_CONFIG="ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3..."
export DRIVE_FOLDER_ID="abc123"

# Traditional: File path
export SERVICE_ACCOUNT_PATH="/path/to/key.json"
```

---

### F4: Client-Side Search

**User Story:** As a developer, I want to filter rows without server queries, so I get results fast.

**Acceptance Criteria:**
- Object queries: `{ status: 'active', score: { gte: 80 } }`
- Function queries: `(row) => row.score > 80`
- Operators: 'and' | 'or'
- Matching: 'strict' | 'loose' (substring)
- Performance: <3s for 5000 rows

**Example:**
```typescript
const { rows } = await agent.search({
  sheet: 'Leads',
  query: { status: 'active', score: { gte: 80 } },
  operator: 'and'
});
```

---

### F5: Helpful Errors (Zod)

**User Story:** As a developer debugging, I want clear error messages, so I fix issues fast.

**Acceptance Criteria:**
- Field-level validation paths
- Helpful suggestions in errors
- Permission errors include fix instructions
- Never generic "TypeError" messages

**Example:**
```typescript
ValidationError: Validation failed
  options.sheet: Expected string, received number
  options.range: Invalid A1 notation. Expected 'A1:Z100', got 'invalid'

PermissionError: Cannot write to sheet 'Leads'
Reason: Sheet not shared with service account
Fix: Share with service@project.iam.gserviceaccount.com (Editor)
```

---

### F6: Cell Formatting (50KB Budget)

**User Story:** As a PM, I want to format cells, so sheets are readable.

**Acceptance Criteria:**
- Background colors, text colors, fonts
- Borders, number formats
- Conditional formatting rules
- Uses googleapis formatting API

**Example:**
```typescript
await agent.formatCells({
  sheet: 'Leads',
  range: 'A1:Z1',
  format: {
    backgroundColor: { red: 0.2, green: 0.6, blue: 0.9 },
    textFormat: { bold: true }
  }
});
```

---

### F7: Formula Operations (50KB Budget)

**User Story:** As an agent, I want to create formulas, so sheets auto-calculate.

**Acceptance Criteria:**
- Read formulas (not just values)
- Write formulas to cells
- Validate formula syntax
- Execute formulas and return results

**Example:**
```typescript
await agent.writeFormula({
  sheet: 'Leads',
  cell: 'D2',
  formula: '=B2*C2'
});

const { formulas } = await agent.readFormulas({
  sheet: 'Leads',
  range: 'D2:D100'
});
```

---

### F8: Cell Metadata (50KB Budget)

**User Story:** As a developer, I want cell metadata, so I make smart decisions.

**Acceptance Criteria:**
- Data types (number, string, date, formula)
- Cell notes/comments
- Merged cell info
- Data validation rules

**Example:**
```typescript
const { data } = await agent.read({
  sheet: 'Contacts',
  includeMetadata: true
});

data.rows.forEach(row => {
  console.log(row.metadata.effectiveFormat);
  console.log(row.metadata.note);
});
```

---

## Technical Architecture

### Stack

| Component | Choice | Size | Rationale |
|-----------|--------|------|-----------|
| Core library | googleapis | 30KB | Official, complete API, Google-maintained |
| Validation | Zod 3.22+ | 8KB* | Runtime safety, helpful errors |
| Auth | google-auth-library | 0KB | Included in googleapis |
| Testing | Vitest | - | Fast, modern, TS support |
| Build | tsup | - | Tree-shaking, <1s builds |

*Peer dependency (user provides)

**Bundle:** 38KB total (30KB googleapis + 8KB wrapper)

### Auth Priority Chain

```typescript
function getCredentials(): Credentials {
  // 1. Base64 env var (Docker/K8s)
  if (process.env.CREDENTIALS_CONFIG) {
    return JSON.parse(
      Buffer.from(process.env.CREDENTIALS_CONFIG, 'base64').toString()
    );
  }
  
  // 2. Service account file
  if (process.env.SERVICE_ACCOUNT_PATH) {
    return JSON.parse(fs.readFileSync(process.env.SERVICE_ACCOUNT_PATH, 'utf8'));
  }
  
  // 3. Google ADC
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
  }
  
  throw new AuthError(
    'No credentials found. Set:\n' +
    '  CREDENTIALS_CONFIG (Base64) OR\n' +
    '  SERVICE_ACCOUNT_PATH (file) OR\n' +
    '  GOOGLE_APPLICATION_CREDENTIALS (Google standard)'
  );
}
```

### API Surface

```typescript
class SheetAgent {
  // Core operations
  read<T>(options: ReadOptions): Promise<SheetData<T>>;
  write(options: WriteOptions): Promise<WriteResult>;
  batchUpdate(options: BatchUpdateOptions): Promise<BatchUpdateResult>;
  search<T>(options: SearchOptions): Promise<SearchResult<T>>;
  
  // Formatting (50KB budget)
  formatCells(options: FormatOptions): Promise<FormatResult>;
  addConditionalFormat(options: ConditionalFormatOptions): Promise<FormatResult>;
  
  // Formulas (50KB budget)
  writeFormula(options: FormulaOptions): Promise<WriteResult>;
  readFormulas(options: ReadOptions): Promise<FormulaData>;
  
  // Metadata
  list(): Promise<SheetMetadata[]>;
  info(sheet: string): Promise<SheetInfo>;
  create(title: string): Promise<string>;
  getCellNotes(options: NotesOptions): Promise<NoteData>;
  
  // Workspace
  initWorkspace(config: WorkspaceConfig): Promise<void>;
  remember(key: string, value: any): Promise<void>;
  recall(key: string): Promise<any>;
}
```

### Commands

```bash
# Setup (Docker/K8s)
export CREDENTIALS_CONFIG=$(base64 -w 0 service-account.json)
export DRIVE_FOLDER_ID="abc123"

# Development
bun install              # Install deps
bun run build            # Build (<5s, fails if >50KB)
bun test                 # All tests
bun test:coverage        # Coverage (≥90%)
bun run validate         # Typecheck + lint + test + size
```

### Boundaries

**Always:**
- Return objects by default
- Use CREDENTIALS_CONFIG for serverless
- Validate all inputs with Zod
- Batch operations for multiple ranges
- Check bundle: `bun run size`

**Ask First:**
- Add dependencies (check bundle impact)
- Change auth priority
- Break API compatibility

**Never:**
- OAuth UI flows (100KB bloat)
- Include full googleapis (2MB)
- Use axios (50KB, use fetch)
- Skip Zod validation
- Return arrays by default

---

## Success Metrics

### Launch Criteria (Must Meet)

| Metric | Target | Measurement | Gate |
|--------|--------|-------------|------|
| Bundle size | <50KB | `gzip -c dist/index.js \| wc -c` | CI fails if exceeded |
| Test coverage | ≥90% | Vitest report | Blocks merge if <85% |
| Setup time | <5 min | User testing (n=5) | 4/5 succeed |
| Zero vulnerabilities | High/Critical | `bun audit` | Blocks release |

### Adoption (3-Month Targets)

| Month | npm DL/Week | GitHub Stars | Production Deployments |
|-------|-------------|--------------|------------------------|
| 1 | 20+ | 50+ | 5+ |
| 2 | 50+ | 100+ | 15+ |
| 3 | 100+ | 200+ | 30+ |

### Comparison to Existing

| Feature | g-sheets-api | mcp-google-sheets | google-sheets-mcp | **Ours** |
|---------|--------------|-------------------|-------------------|----------|
| Bundle | 5KB | N/A | N/A | 38KB ✓ |
| Write | ❌ | ✅ | ✅ | ✅ |
| Formatting | ❌ | ✅ | ❌ | ✅ |
| Formulas | ❌ | ✅ | ❌ | ✅ |
| TypeScript | ❌ | ❌ | ⚠️ | ✅ |
| Validation | ❌ | ❌ | ❌ | ✅ Zod |
| Objects | ✅ | ❌ | ❌ | ✅ |
| Batch ops | ❌ | ✅ | ❌ | ✅ |
| Tests | 40% | 60% | 30% | >90% |
| Serverless | ✅ | ⚠️ | ⚠️ | ✅ |

**Wins:** Only TypeScript library <50KB with formatting + formulas + objects + Zod + >90% tests

---

## Implementation Timeline

### Week 1: Core + Formatting

**Days 1-2:**
- Project setup (bun, TypeScript, Vitest)
- googleapis integration (~30KB)
- Zod schemas for all operations
- Auth chain (CREDENTIALS_CONFIG → SERVICE_ACCOUNT_PATH → ADC)

**Days 3-4:**
- Read operations (googleapis with object conversion)
- Write operations (googleapis)
- Cell formatting API
- Unit tests (>95% coverage)

**Days 5-7:**
- Batch operations (googleapis batchUpdate)
- Formula operations (read/write/execute)
- Conditional formatting
- Integration tests

**Gate:** `bun run validate` passes + bundle <50KB

---

### Week 2: Search + Metadata

**Days 8-9:**
- Client-side search (object + function queries)
- Operator + matching modes
- Performance optimization (5000 rows <3s)

**Days 10-11:**
- DRIVE_FOLDER_ID scoping
- Cell metadata (notes, validation, merged cells)
- Advanced formatting examples

**Days 12-14:**
- Workspace pattern (initWorkspace)
- AGENT.md, MEMORY, HISTORY sheets
- remember() / recall() helpers

**Gate:** ≥90% coverage + all features working

---

### Week 3: Production

**Days 15-16:**
- Bundle optimization (tree-shake unused endpoints)
- CF Workers deployment test
- Performance benchmarks

**Days 17-18:**
- Documentation (README, API reference, examples)
- Migration guide from g-sheets-api
- CREDENTIALS_CONFIG setup guide
- Formatting + formula guides

**Days 19-21:**
- Security audit (`bun audit`)
- E2E tests (full workflows)
- Example projects (basic, formatting, formulas, workspace)
- CHANGELOG, publish to npm

**Gate:** All success metrics met

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Bundle >50KB | High | Low | Pre-commit hook, CI check, tree-shaking |
| Google API breaking change | High | Low | Version lock, extensive tests |
| Rate limiting | Medium | Medium | Exponential backoff, batch operations |
| CREDENTIALS_CONFIG confusion | Medium | Medium | Multiple examples, clear setup guide |

---

## Decision Log

### Resolved

| Question | Decision | Rationale |
|----------|----------|-----------|
| 15KB vs 50KB budget? | 50KB | +26KB for +300% API coverage, still 13x lighter than alternatives |
| Auth approach? | CREDENTIALS_CONFIG → SERVICE_ACCOUNT_PATH → ADC | Serverless-friendly, proven by mcp-google-sheets (508 stars) |
| Return format? | Objects by default | Proven by g-sheets-api (140 stars), 10x better DX |
| Core library? | googleapis | Official, complete, Google-maintained, 30KB tree-shaken |
| Validation? | Zod | None of 3 projects have runtime validation |
| Testing? | Vitest, >90% | All 3 projects lack comprehensive tests |

### Out of Scope

- OAuth interactive flows → Service account only
- Formula execution in v1 → Read formulas only
- Google Docs/Slides → Sheets only

---

## Appendix

### 50KB vs 15KB Trade-off

| Aspect | 15KB (Hybrid) | 50KB (googleapis) |
|--------|---------------|-------------------|
| Bundle | 12KB | 38KB |
| API coverage | 20% | 80% |
| Libraries | 2 (g-sheets-api + fetch) | 1 (googleapis) |
| Formatting | ❌ | ✅ |
| Formulas | ❌ | ✅ |
| Maintenance | 2 dependencies | 1 dependency |
| Type safety | Manual | Official |
| Future-proof | Limited | Complete |

**Verdict:** 50KB wins on 6/7 criteria (loses only on absolute size)

### Cloudflare Workers Validation

```
CF Workers limit: 3,072 KB (3MB compressed)
Our bundle:          38 KB
Remaining:        3,034 KB (98.8% free)
```

**Conclusion:** No problem for serverless deployment

---

*Version: 2.1 (Simplified)*  
*Bundle: 38KB (googleapis 30KB + core 8KB)*  
*Status: Ready for Implementation*
