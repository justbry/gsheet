# AGENTSCAPE Architecture

AGENTSCAPE is the column-based file storage system that replaced the legacy AGENT_BASE sheet. It provides a file system metaphor over Google Sheets, enabling unlimited file storage with consistent metadata.

## Column-Based Format

Each file is stored as a column, with 6 rows of metadata:

```
     A          B            C              D              E              F
1  FILE      AGENTS.md    PLAN.md        WORKFLOW.md    COORDINATOR.md HISTORY.md
2  DESC      agent        plan           workflow       coordinator    history
3  TAGS      system       agent,plan     tools          skills         log
4  DATES     2026-01-21   2026-01-21     2026-01-21     2026-01-21     2026-01-21
5  BUDGET    2.5K         dynamic        15K            1.6K           0
6  Content   # Agent...   # Plan: ...    # Workflow...  # Coord...     # History...
```

### Key Points
- **Column A** = Row labels (FILE, DESC, TAGS, DATES, BUDGET, Content/MD)
- **Column B onwards** = Files (each column is one file)
- **Row 1** = Filenames
- **Row 5** = Context budget allocation
- **Row 6** = File content

### Cell References
- B1:B6 = AGENTS.md (FILE, DESC, TAGS, DATES, BUDGET, Content)
- C1:C6 = PLAN.md (FILE, DESC, TAGS, DATES, BUDGET, Content)
- PlanManager reads from C1 (filename) and C6 (content)

## Migration from AGENT_BASE

### Before (AGENT_BASE sheet)
```
+-------------------+--------------------------+
|        A          |            B             |
+-------------------+--------------------------+
| AGENT.md Content  |   PLAN.md Contents       | <- Row 1
+-------------------+--------------------------+
| # Sales Agent     | # Plan: Q4 Report        | <- Row 2
|                   |                          |
| You are a...      | Goal: Generate summary   |
|                   |                          |
| ## Capabilities   | ### Phase 1: Data        |
| - Read sales      | - [x] 1.1 Read Orders    |
| - Calculate...    | - [/] 1.2 Read Products  |
+-------------------+--------------------------+
```

### After (AGENTSCAPE sheet)
```
+------+------+------+-------+---------+----------------------+
| FILE | DESC | TAGS | DATES | Content |          F           |
+------+------+------+-------+---------+----------------------+
|AGENT |agent |system|2026-01|# Agent..|PLAN.md Contents      | <- Row 1
+------+------+------+-------+---------+----------------------+
|      |      |      |       |         |# Plan: Q4 Report     | <- Row 2
|      |      |      |       |         |                      |
|      |      |      |       |         |Goal: Generate...     |
|      |      |      |       |         |                      |
|      |      |      |       |         |### Phase 1: Data     |
|      |      |      |       |         |- [x] 1.1 Read...     |
|      |      |      |       |         |- [/] 1.2 Read...     |
+------+------+------+-------+---------+----------------------+
     Files stored row-by-row          Plan in dedicated column
```

## Key Differences

| Aspect | AGENT_BASE | AGENTSCAPE |
|--------|-----------|------------|
| **AGENT.md** | Column A (A1:A2) | Regular file (row in A-E) |
| **PLAN.md** | Column B (B1:B2) | Special column F (F1:F2) |
| **Other Files** | Not supported | Columns A-E (row-based) |
| **File System** | No | Yes (FILE/DESC/TAGS/DATES/Content) |
| **CLI Support** | Limited | Full file management |

## Benefits

1. **Unified Storage** - AGENT.md is a regular file, can store unlimited files
2. **File System Metaphor** - File-based API (readFile, writeFile, listFiles) instead of hard-coded cell references
3. **Extensibility** - Adding new documents = just write a file
4. **CLI Integration** - All files treated uniformly (ls, read, write, delete)
5. **Backward Compatibility** - Automatic migration from AGENT_BASE to AGENTSCAPE

## API Consistency

```typescript
// BEFORE: Inconsistent access
agent.system                    // AGENT.md (special property)
planManager.getPlan()           // PLAN.md (special handling)
// No way to store other files

// AFTER: Consistent file API
agent.system                    // AGENT.md (loaded from file)
planManager.getPlan()           // PLAN.md (still special, in column F)
agentscape.readFile('AGENT.md') // Can access AGENT.md as file
agentscape.readFile('RESEARCH.md') // Can store unlimited files
agentscape.listFiles()          // List all files
```

## Automatic Migration

When connecting to a spreadsheet with the old AGENT_BASE structure:

```typescript
const agent = await SheetAgent.connect({ spreadsheetId: 'abc123' });
// Automatic migration happens here!
```

**Steps:**
1. Detects AGENT_BASE sheet exists
2. Reads AGENT_BASE!A2 (agent context)
3. Reads AGENT_BASE!B2 (plan content)
4. Creates/initializes AGENTSCAPE sheet
5. Writes AGENT.md as regular file (columns A-E)
6. Writes plan to AGENTSCAPE!F1:F2
7. Deletes old AGENT_BASE sheet

## Code Impact

- Removed: `initAgentBase()` (~140 lines), hard-coded A1:A2/B1:B2 logic
- Added: File system abstraction via AgentScapeManager, automatic migration logic
