# AGENTSCAPE Architecture

AGENTSCAPE is a column-based file storage system built on Google Sheets. It provides a file system metaphor for storing agent configurations, plans, and arbitrary documents with consistent metadata.

## Storage Format

Each file occupies one column. Rows 1-11 hold metadata; row 12+ holds content.

```
        A            B                              C                              D
   +------------+---------------------------+-------------------------------+-------------------------------+
 1 | FILE       | AGENTS.md                 | PLAN.md                   | HISTORY.md                    |
   +------------+---------------------------+-------------------------------+-------------------------------+
 2 | DESC       | Core agent identity and   | Current plan                  | Append-only audit log of      |
   |            | capabilities.             |                               | agent actions.                |
   +------------+---------------------------+-------------------------------+-------------------------------+
 3 | TAGS       | system                    | tools,workflow                | log,append                    |
   +------------+---------------------------+-------------------------------+-------------------------------+
 4 | Path       | /opt/agentscape/AGENTS.md | /opt/agentscape/PLAN.md   | /opt/agentscape/HISTORY.md    |
   +------------+---------------------------+-------------------------------+-------------------------------+
 5 | CreatedTS  | 2026-01-15T08:00:00Z      | 2026-01-15T08:00:00Z          | 2026-01-15T08:00:00Z          |
   +------------+---------------------------+-------------------------------+-------------------------------+
 6 | UpdatedTS  | 2026-01-21T09:15:00Z      | 2026-01-21T09:15:00Z          | 2026-01-21T14:32:00Z          |
   +------------+---------------------------+-------------------------------+-------------------------------+
 7 | Status     | active                    | active                        | active                        |
   +------------+---------------------------+-------------------------------+-------------------------------+
 8 | DependsOn  |                           | AGENTS.md                     |                               |
   +------------+---------------------------+-------------------------------+-------------------------------+
 9 | ContextLen | =INT(LEN(B12)/4) -> 625   | =INT(LEN(C12)/4) -> 3750      | =INT(LEN(D12)/4) -> 1200      |
   +------------+---------------------------+-------------------------------+-------------------------------+
10 | MaxCtxLen  |                           | 5000                          | 500                           |
   +------------+---------------------------+-------------------------------+-------------------------------+
11 | Hash       | =SHA256(B12) -> a3f2...   | =SHA256(C12) -> 7b91...       | =SHA256(D12) -> e4c8...       |
   +------------+---------------------------+-------------------------------+-------------------------------+
12 | MDContent  | # Agent...                | # Plan...                 | # History...                  |
   |            | You are a sales analyst   | ## Phase 1                      | [2026-01-21] Agent init       |
   |            | ## Capabilities           | - [ ] ...                  | [2026-01-21] Plan loaded      |
   +------------+---------------------------+-------------------------------+-------------------------------+
      Labels        File 1                     File 2                         File 3
```

### Column Layout

| Column | Purpose |
|--------|---------|
| **A** | Row labels (FILE, DESC, TAGS, Path, CreatedTS, UpdatedTS, Status, DependsOn, ContextLen, MaxCtxLen, Hash, MDContent) |
| **B onwards** | One file per column |

### Row Definitions

| Row | Field | Description |
|-----|-------|-------------|
| 1 | `FILE` | Filename with extension (e.g., `AGENTS.md`) |
| 2 | `DESC` | Human-readable summary of file purpose (max 50 words) |
| 3 | `TAGS` | Comma-separated tags for filtering/querying |
| 4 | `Path` | Virtual filesystem path. Default: `/opt/agentscape/{filename}` |
| 5 | `CreatedTS` | Creation timestamp (ISO 8601). Set once, never modified. |
| 6 | `UpdatedTS` | Last modified timestamp (ISO 8601). Updated on every write. |
| 7 | `Status` | Lifecycle state: `active`, `draft`, `archived`. Controls visibility in queries. |
| 8 | `DependsOn` | Comma-separated filenames this file requires. Enables dependency-aware loading. |
| 9 | `ContextLen` | **Formula**: `=INT(LEN({col}12)/4)` -- estimates actual token count. Auto-updates. |
| 10 | `MaxCtxLen` | Maximum tokens to load from this file. Empty = no limit. |
| 11 | `Hash` | **Formula**: `=SHA256({col}12)` -- content fingerprint for change detection and caching. |
| 12+ | `MDContent` | File content (markdown supported, multi-line via cell wrap) |

### Cell References

To read `PLAN.md` directly via Sheets API:
- Filename: `C1` -> `"PLAN.md"`
- Path: `C4` -> `"/opt/agentscape/PLAN.md"`
- Status: `C7` -> `"active"`
- Dependencies: `C8` -> `"AGENTS.md"`
- Token estimate: `C9` -> `=INT(LEN(C12)/4)` (formula, returns ~3750)
- Max tokens: `C10` -> `5000` (budget cap)
- Content hash: `C11` -> `=SHA256(C12)` (formula, returns fingerprint)
- Content: `C12` -> `"# Workflow..."` (may span multiple rows visually but is one cell)

---

## Metadata Fields

### Tags

Tags enable filtering and categorization.

**Reserved tags:**
| Tag | Meaning |
|-----|---------|
| `system` | Core agent configuration, loaded on startup |
| `append` | Append-only file (e.g., HISTORY.md) |
| `readonly` | Cannot be modified via API |

### Path

Virtual filesystem paths enable CLI tooling and cross-references between files. Default: `/opt/agentscape/{filename}`.

### ContextLen (Token Estimation)

Row 9 contains a **formula** that estimates token count from MDContent:

```
=INT(LEN(B12)/4)
```

- `LEN(B12)` returns character count of MDContent cell
- Dividing by 4 estimates tokens (~4 characters per token for English text)
- `INT()` rounds down to whole number

### MaxCtxLen (Context Budget Cap)

Row 10 sets a **maximum token limit** for loading this file into context.

| MaxCtxLen | Behavior |
|-----------|----------|
| Empty | Load full content (no cap) |
| `500` | Truncate to ~500 tokens when loading |
| `0` | Never auto-load (must query explicitly) |

### CreatedTS & UpdatedTS

| Field | Row | Set When | Modified |
|-------|-----|----------|----------|
| `CreatedTS` | 5 | File first written | Never |
| `UpdatedTS` | 6 | File first written | Every write |

### Status (Lifecycle State)

| Status | Meaning | Auto-loaded? |
|--------|---------|--------------|
| `active` | In use, current | Yes |
| `draft` | Work in progress | No |
| `archived` | Retained but inactive | No |

### DependsOn (File Dependencies)

Row 8 declares which files must be loaded together. Comma-separated filenames.

### Hash (Content Fingerprint)

Row 11 contains a **formula** that computes a SHA256 hash of MDContent:

```
=SHA256(B12)
```

Use cases: cache invalidation, cross-environment sync, change detection.

## Changelog

- **v2.0.0** -- 12-row metadata schema replaces 6-row schema
  - Added: Path, CreatedTS, UpdatedTS, Status, DependsOn, ContextLen, MaxCtxLen, Hash
  - Removed: DATES (split into CreatedTS + UpdatedTS), BUDGET (replaced by ContextLen + MaxCtxLen)
  - Content moved from row 6 to row 12
- **v1.0.0** -- AGENTSCAPE replaces AGENT_BASE
  - Column-based file storage (6 rows: FILE, DESC, TAGS, DATES, BUDGET, Content/MD)
