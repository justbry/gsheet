---
spreadsheet: https://docs.google.com/spreadsheets/d/1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8/edit?gid=1431121461#gid=1431121461
spreadsheet_id: 1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8
---

# Sun School Advisor

Agent-driven scheduling and analysis for Sunday School classes. Scans a multi-month schedule for unassigned teaching slots, matches teachers by language, and balances workloads.

## Run

```bash
# Full coordinator — analyze coverage for next 3 months
bun examples/sun-school-advisor/sunday-school-coordinator.ts

# Analyze existing teacher assignments
bun examples/sun-school-advisor/analyze-schedule.ts

# Find unassigned classes only
bun examples/sun-school-advisor/unassigned-classes.ts
```

## Scripts

| Script | Purpose |
|--------|---------|
| `sunday-school-coordinator.ts` | Full workflow — reads schedule + teachers, identifies gaps, suggests assignments by language and workload |
| `analyze-schedule.ts` | Reads Schedule sheet and displays all teacher assignments with column detection |
| `unassigned-classes.ts` | Finds classes without teachers in the next N months (default 3) |

## Features

- **Language-aware matching** — detects class language (Swahili, French, etc.) and matches to teacher skills
- **Workload balancing** — distributes assignments evenly across available teachers
- **Flexible date parsing** — handles M/D, M/D/YY, ISO, and Sheets serial numbers
- **Coverage reporting** — total slots, assigned %, unassigned gaps
- **Multi-class support** — Swahili, French, Youth A/B, Temple Prep

## Spreadsheet Setup

| Sheet | Structure | Purpose |
|-------|-----------|---------|
| Schedule | Row 1: instructions, Row 2: headers (Week, Reading, Lessons, class columns), Row 3+: data with dates in column A | Class schedule with teacher sign-ups |
| Teachers | Headers: Name, Phone Number, In Whatsapp Group, Languages, Notes | Teacher roster and language capabilities |
| AGENTSCAPE | Auto-created | Agent context |

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `SPREADSHEET_ID` | Yes | Google Sheets spreadsheet ID |
| `CREDENTIALS_CONFIG` | Yes | Base64-encoded service account credentials |
| `MONTHS_AHEAD` | No | Override default 3-month lookahead |

## CLI Simulation

### Coordinator — full 3-month analysis

```bash
$ bun examples/sun-school-advisor/sunday-school-coordinator.ts
```

```
📚 Sunday School Teacher Coordinator

📅 Analyzing 3-month period: 2026-02-01 to 2026-05-01

📖 Reading Schedule sheet...
   Found 72 total rows

📋 Headers (row 2): Week, Reading, Lessons, Swahili (RS Room),
   French (PH Room), Youth A 12-15yo (201), Youth B 15-18yo, Temple Prep

📚 Class columns detected: Swahili (RS Room), French (PH Room),
   Youth A 12-15yo (201), Youth B 15-18yo, Temple Prep

🔎 Scanning for unassigned teaching slots...

📊 Coverage Status:
   Total slots: 0
   Assigned: 0 (100%)
   Unassigned: 0 (0%)

✅ All classes have teachers assigned for the next 3 months!
```

### Analyze schedule — teacher assignments and counts

```bash
$ bun examples/sun-school-advisor/analyze-schedule.ts
```

```
Connecting to Google Sheets...
Connected! Reading Schedule sheet...

=== SCHEDULE SHEET ANALYSIS ===

Row 2 (Column Headers): Week, Reading, Lessons, Swahili (RS Room),
  French (PH Room), Youth A 12-15yo (201), Youth B 15-18yo, Temple Prep

=== TEACHER ASSIGNMENTS ===

----------------------------------------
Class Date: 12/7
Week: 12/1-12/7
Reading: D&C 137-138
Lesson: The Vision of the Redemption of the Dead

Teachers Assigned:
  French (PH Room): Edwigson
  Youth A 12-15yo (201): David Cooper
  Youth B 15-18yo: Justin Benson

----------------------------------------
Week: 1/26-2/1
Reading: Genesis 5; Moses 6
Lesson: And He Heard a Voice from Heaven, Saying: This Is My Beloved Son

Teachers Assigned:
  Swahili (RS Room): Milindi
  French (PH Room): Wilderson
  Youth B 15-18yo: Justin B

=== SUMMARY ===

Total assignments: 11

Teacher assignment counts:
  Ken Romney: 2
  Justin B: 2
  Edwigson: 1
  David Cooper: 1
  Justin Benson: 1
  Benjamin swensen: 1
  Daniel R: 1
  Milindi: 1
  Wilderson: 1
```

### Unassigned classes — gap detection

```bash
$ bun examples/sun-school-advisor/unassigned-classes.ts
```

```
🔍 Finding Unassigned Classes for Next 3 Months

📖 Reading Schedule sheet...
   Found 72 total rows

📋 Headers (row 2): Week, Reading, Lessons, Swahili (RS Room),
   French (PH Room), Youth A 12-15yo (201), Youth B 15-18yo, Temple Prep

📚 Class columns found: Swahili (RS Room), French (PH Room),
   Youth A 12-15yo (201), Youth B 15-18yo, Temple Prep

📅 Date range: 2026-02-01 to 2026-05-01

🔎 Scanning for unassigned classes...

✅ All classes have teachers assigned for the next 3 months!
```

## Source

`examples/sun-school-advisor/`
