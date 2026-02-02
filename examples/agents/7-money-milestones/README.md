# 7 Money Milestones - Financial Simulation Game

A single-player financial simulation game based on the [HowMoneyWorks](https://howmoneyworks.com) 7 Money Milestones framework. Demonstrates gsheet read/write patterns through interactive gameplay.

## What This Demonstrates

- **Sheet-based game state**: Read/write game state across multiple sheets
- **Structured data in cells**: Store JSON option data in PHASE_EVENTS
- **Append-style logging**: GAME_LOG grows with each play action
- **CLI argument parsing**: Commands with typed flags

## Game Loop

1. **Init** — Pick a name and 3 habit tiers. Starting stats are calculated and written to sheets.
2. **Play** — Advance to the next milestone. Pick option A/B/C, roll a d6 (modified by learning tier), land on a color level.
3. **Status** — View current Cash, Debt, Assets, IP, and milestone color scores.
4. **Scoreboard** — Final score = average of all 7 milestone scores (max 100).

## The 7 Money Milestones

Each milestone has 4 levels:

| # | Milestone | Red (10) | Orange (40) | Yellow (70) | Green (100) |
|---|-----------|----------|-------------|-------------|-------------|
| 1 | Financial Education | Not sure where to start | Some knowledge, no plan | Some knowledge, partial plan | Knowledgeable with full plan |
| 2 | Proper Protection | Missing key insurance | Lacking coverage in key areas | Premiums high/underinsured | Right types, coverage, and price |
| 3 | Emergency Fund | No emergency fund | Neither fully funded nor over 1% | Funded OR over 1% | Fully funded AND over 1% |
| 4 | Debt Management | Mortgage + >20% DTI | Mortgage + 12%-20% DTI | Mortgage + 5%-12% DTI | Mortgage + <5% DTI |
| 5 | Cash Flow | Not able to make payments | Pay into 1 of 3 areas | Pay into 2 of 3 areas | Pay into debt, savings, retirement |
| 6 | Build Wealth | 0-25% after-tax saved | 26-50% after-tax saved | 51-75% after-tax saved | 76-100% after-tax saved |
| 7 | Protect Wealth | No estate plan | Estate plan needs updated | Some, not all needed docs | Estate plan complete |

## Scoring

- **Red**: 10 pts | **Orange**: 40 pts | **Yellow**: 70 pts | **Green**: 100 pts
- **Final Score** = average of all 7 milestone scores (max 100)
- Dice roll determines your color: 1=red, 2-3=orange, 4-5=yellow, 6=green
- Learning tier modifies rolls upward

## Habit Tiers

| Habit | Tier 1 | Tier 2 | Tier 3 |
|-------|--------|--------|--------|
| Learning | None | $150/mo cost, IP x1.5, +1 starting IP | $300/mo cost, IP x1.75, +2 starting IP |
| Health | -$150/mo income | No effect | +$150/mo income, $75/mo cost |
| Savings | -$300 starting cash | No effect | +$400 starting cash, -$200/mo income |

**Learning also modifies dice rolls:**
- Tier 2: Rolls of 1-2 become 3 (no red outcomes)
- Tier 3: Rolls of 1-2 become 4, rolls of 5-6 always hit green

## Setup

```bash
export SPREADSHEET_ID="your-spreadsheet-id"

# Initialize a new game
bun examples/7-money-milestones/game-cli.ts init \
  --spreadsheet-id=$SPREADSHEET_ID \
  --player="Demo" \
  --learning=2 --health=2 --savings=M
```

## Commands

```bash
# Play next milestone (choose A, B, or C)
bun examples/7-money-milestones/game-cli.ts play A --spreadsheet-id=$SPREADSHEET_ID

# Check current status + milestone scores
bun examples/7-money-milestones/game-cli.ts status --spreadsheet-id=$SPREADSHEET_ID

# View final score breakdown
bun examples/7-money-milestones/game-cli.ts scoreboard --spreadsheet-id=$SPREADSHEET_ID
```

## Sheet Structure

| Sheet | Purpose |
|-------|---------|
| GAME_CONFIG | Player name, habit tiers, started date |
| GAME_STATE | Cash, Debt, Assets, Monthly Income, IP, IP Multiplier, Current Phase |
| MILESTONE_SCORES | Per-milestone color and score (7 rows) |
| PHASE_EVENTS | 7 rows with title, description, levels JSON, and A/B/C option JSON |
| GAME_LOG | Timestamp, Phase, Choice, Roll, Modified Roll, Color, Outcome, Stats Snapshot |

## Code Architecture

- **game-manager.ts** — Game logic, milestone levels/scoring, stat calculations, dice rolling
- **game-cli.ts** — CLI interface with init/play/status/scoreboard commands
