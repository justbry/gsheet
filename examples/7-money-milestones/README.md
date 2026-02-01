# 7 Money Milestones - Financial Simulation Game

A single-player financial simulation game demonstrating gsheet read/write patterns. Players choose lifestyle habits, then navigate 7 life phases (ages 18-38) making career and financial decisions with dice-based outcomes.

## What This Demonstrates

- **Sheet-based game state**: Read/write game state across multiple sheets
- **Structured data in cells**: Store JSON option data in PHASE_EVENTS
- **Append-style logging**: GAME_LOG grows with each play action
- **CLI argument parsing**: Commands with typed flags

## Game Loop

1. **Init** — Pick a name and 3 habit tiers. Starting stats are calculated and written to sheets.
2. **Play** — Advance to the next phase. Read the event card, pick option A/B/C, roll a d6 (modified by learning tier), apply the outcome.
3. **Status** — View current Cash, Debt, Assets, IP, and phase progress.
4. **Scoreboard** — Final score: `(Assets + Cash - Debt) + (IP x 50)`

## Habit Tiers

| Habit | Tier 1 | Tier 2 | Tier 3 |
|-------|--------|--------|--------|
| Learning | None | $150/mo cost, IP x1.5, +1 starting IP | $300/mo cost, IP x1.75, +2 starting IP |
| Health | -$150/mo income | No effect | +$150/mo income, $75/mo cost |
| Savings | -$300 starting cash | No effect | +$400 starting cash, -$200/mo income |

**Learning also modifies dice rolls:**
- Tier 2: Rolls of 1-2 become 3 (no worst outcomes)
- Tier 3: Rolls of 1-2 become 4, rolls of 5-6 always hit best

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
# Play next phase (choose A, B, or C)
bun examples/7-money-milestones/game-cli.ts play A --spreadsheet-id=$SPREADSHEET_ID

# Check current status
bun examples/7-money-milestones/game-cli.ts status --spreadsheet-id=$SPREADSHEET_ID

# View final score
bun examples/7-money-milestones/game-cli.ts scoreboard --spreadsheet-id=$SPREADSHEET_ID
```

## Sheet Structure

| Sheet | Purpose |
|-------|---------|
| GAME_CONFIG | Player name, habit tiers, started date |
| GAME_STATE | Cash, Debt, Assets, Monthly Income, IP, IP Multiplier, Current Phase |
| PHASE_EVENTS | 7 rows with phase title, description, and JSON-encoded A/B/C options |
| GAME_LOG | Timestamp, Phase, Choice, Roll, Modified Roll, Outcome, Stats Snapshot |

## The 7 Money Milestones

Based on the [HowMoneyWorks](https://howmoneyworks.com) framework:

1. **Financial Education** — Acquire knowledge: books / courses / work with a professional
2. **Proper Protection** — Safeguard income: basic term / comprehensive coverage / skip & invest
3. **Emergency Fund** — Build a buffer: 3 months / 6 months high-yield / rely on credit
4. **Debt Management** — Eliminate debt: snowball / avalanche / consolidate
5. **Cash Flow** — Optimize budget: cut spending / increase income / automate transfers
6. **Build Wealth** — Invest strategically: index funds / real estate + retirement / start a business
7. **Protect Wealth** — Preserve & transfer: estate plan / tax strategies / legacy giving

## Scoring

Each option has 3 outcome tiers (worst/avg/best) based on the dice roll:
- Roll 1-2: worst outcome
- Roll 3-4: average outcome
- Roll 5-6: best outcome

Final score: `(Assets + Cash - Debt) + (IP x 50)`

## Code Architecture

- **game-manager.ts** — Game logic, stat calculations, phase events, dice rolling
- **game-cli.ts** — CLI interface with init/play/status/scoreboard commands
