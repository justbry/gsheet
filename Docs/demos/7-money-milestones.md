---
spreadsheet: https://docs.google.com/spreadsheets/d/1w3HVVsaQvQx_dmCBaYba-Ye4MfSa9GteeGP4JWsR0EU/edit?gid=950974090#gid=950974090
spreadsheet_id: 1w3HVVsaQvQx_dmCBaYba-Ye4MfSa9GteeGP4JWsR0EU
---

# 7 Money Milestones

A financial simulation game based on the [HowMoneyWorks](https://howmoneyworks.com) 7 Money Milestones framework. Players choose lifestyle habits, navigate 7 milestones with A/B/C decisions, roll dice, and score on a red/orange/yellow/green scale.

## Run

```bash
bun examples/7-money-milestones/game-cli.ts init --spreadsheet-id=1w3HVVsaQvQx_dmCBaYba-Ye4MfSa9GteeGP4JWsR0EU --player=Demo --learning=2 --health=2 --savings=M
bun examples/7-money-milestones/game-cli.ts play A --spreadsheet-id=1w3HVVsaQvQx_dmCBaYba-Ye4MfSa9GteeGP4JWsR0EU
bun examples/7-money-milestones/game-cli.ts status --spreadsheet-id=1w3HVVsaQvQx_dmCBaYba-Ye4MfSa9GteeGP4JWsR0EU
bun examples/7-money-milestones/game-cli.ts scoreboard --spreadsheet-id=1w3HVVsaQvQx_dmCBaYba-Ye4MfSa9GteeGP4JWsR0EU
```

## Features

- **7 Money Milestones** — Financial Education, Proper Protection, Emergency Fund, Debt Management, Cash Flow, Build Wealth, Protect Wealth
- **4-level scoring** — Red (10), Orange (40), Yellow (70), Green (100) per milestone
- **Final score** — Average of all 7 milestone scores (max 100)
- **Dice + habits** — d6 roll modified by learning tier determines your color level
- **CLI commands** — `init`, `play`, `status`, `scoreboard`

## Spreadsheet Setup

| Sheet | Purpose |
|-------|---------|
| GAME_CONFIG | Player name, habit tiers, started date |
| GAME_STATE | Cash, Debt, Assets, Monthly Income, IP, IP Multiplier, Current Phase |
| MILESTONE_SCORES | Per-milestone color and score (7 rows) |
| PHASE_EVENTS | 7 rows with levels JSON and A/B/C option JSON |
| GAME_LOG | Timestamp, Phase, Choice, Roll, Modified Roll, Color, Outcome, Stats |

## Prerequisites

- Google Spreadsheet shared with service account
- Demo uses spreadsheet `1w3HVVsaQvQx_dmCBaYba-Ye4MfSa9GteeGP4JWsR0EU`

## CLI Simulation

A full session — init with habits, play through milestones, check scores.

### 1. Initialize a new game

```bash
$ bun game-cli.ts init --spreadsheet-id=1w3HVVsaQvQx_dmCBaYba-Ye4MfSa9GteeGP4JWsR0EU --player="Alex Demo" --learning=2 --health=2 --savings=M
```

```
Initializing game for Alex Demo...
  Habits: Learning=2, Health=2, Savings=M

Game initialized! Starting stats:
  Cash: $500  Debt: $1000  Assets: $500
  Monthly Income: $1850  IP: 2  IP Multiplier: 1.5x

Sheets created: GAME_CONFIG, GAME_STATE, MILESTONE_SCORES, PHASE_EVENTS, GAME_LOG

Next: bun game-cli.ts status --spreadsheet-id=...
```

### 2. Check status

```bash
$ bun game-cli.ts status --spreadsheet-id=1w3HVVsaQvQx_dmCBaYba-Ye4MfSa9GteeGP4JWsR0EU
```

```
--- Alex Demo's Game ---
Started: 2026-02-01
Habits: Learning=2, Health=2, Savings=M

Phase: 1/7
Cash: $500  Debt: $1000  Assets: $500
Monthly Income: $1850  IP: 2 (x1.5)

Milestone Scores:
  1. Financial Education: --
  2. Proper Protection: --
  3. Emergency Fund: --
  4. Debt Management: --
  5. Cash Flow: --
  6. Build Wealth: --
  7. Protect Wealth: --

Next: bun game-cli.ts play A|B|C --spreadsheet-id=...
```

### 3. Play Milestone 1 — Financial Education

```bash
$ bun game-cli.ts play C --spreadsheet-id=1w3HVVsaQvQx_dmCBaYba-Ye4MfSa9GteeGP4JWsR0EU
```

```
--- Milestone 1: Financial Education ---
Milestone 1: Acquire a financial education — the foundation for every decision ahead.

You chose C: Work with a financial professional

Roll: 4 -> Modified: 4
Result: ● YELLOW (70 pts)
Level: Some knowledge with partial plan

  Cash: -200
  Debt: +0
  Assets: +150
  IP: +6

Current totals:
  Cash: $300  Debt: $1000  Assets: $650  IP: 8

Next milestone: 2/7
```

### 4. Play Milestone 2 — Proper Protection

```bash
$ bun game-cli.ts play B --spreadsheet-id=1w3HVVsaQvQx_dmCBaYba-Ye4MfSa9GteeGP4JWsR0EU
```

```
--- Milestone 2: Proper Protection ---
Milestone 2: Ensure adequate insurance protection — safeguard your income and loved ones.

You chose B: Comprehensive life + disability + umbrella

Roll: 5 -> Modified: 5
Result: ● YELLOW (70 pts)
Level: Premiums are high/underinsured

  Cash: -250
  Debt: +0
  Assets: +500
  IP: +2

Current totals:
  Cash: $50  Debt: $1000  Assets: $1150  IP: 10

Next milestone: 3/7
```

### 5. Play Milestone 3 — Emergency Fund

```bash
$ bun game-cli.ts play B --spreadsheet-id=1w3HVVsaQvQx_dmCBaYba-Ye4MfSa9GteeGP4JWsR0EU
```

```
--- Milestone 3: Emergency Fund ---
Milestone 3: Establish an emergency fund — your financial buffer for the unexpected.

You chose B: Build 6 months in a high-yield account

Roll: 6 -> Modified: 6
Result: ● GREEN (100 pts)
Level: Fully funded AND over 1%

  Cash: +700
  Debt: +0
  Assets: +600
  IP: +3

Current totals:
  Cash: $750  Debt: $1000  Assets: $1750  IP: 13

Next milestone: 4/7
```

### 6. Check status mid-game

```bash
$ bun game-cli.ts status --spreadsheet-id=1w3HVVsaQvQx_dmCBaYba-Ye4MfSa9GteeGP4JWsR0EU
```

```
--- Alex Demo's Game ---
Started: 2026-02-01
Habits: Learning=2, Health=2, Savings=M

Phase: 4/7
Cash: $750  Debt: $1000  Assets: $1750
Monthly Income: $1850  IP: 13 (x1.5)

Milestone Scores:
  1. Financial Education: ● YELLOW (70)
  2. Proper Protection: ● YELLOW (70)
  3. Emergency Fund: ● GREEN (100)
  4. Debt Management: --
  5. Cash Flow: --
  6. Build Wealth: --
  7. Protect Wealth: --

Running average: 34/100

Next: bun game-cli.ts play A|B|C --spreadsheet-id=...
```

### 7. Complete all milestones and view scoreboard

_(After playing milestones 4-7...)_

```bash
$ bun game-cli.ts scoreboard --spreadsheet-id=1w3HVVsaQvQx_dmCBaYba-Ye4MfSa9GteeGP4JWsR0EU
```

```
=== SCOREBOARD ===
Player: Alex Demo
Phase: COMPLETE

  1. Financial Education    ● YELLOW              70/100
  2. Proper Protection      ● YELLOW              70/100
  3. Emergency Fund         ● GREEN               100/100
  4. Debt Management        ● GREEN               100/100
  5. Cash Flow              ● ORANGE              40/100
  6. Build Wealth           ● YELLOW              70/100
  7. Protect Wealth         ● GREEN               100/100

                            ─────────────
  FINAL SCORE               78/100

Financials: Cash $3200 | Debt $0 | Assets $8500 | IP 42
```

## Source

`examples/7-money-milestones/`
