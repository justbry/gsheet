# 7 Money Milestones

A gamified personal finance tracker with dual CLI and Google Sheets interfaces. Players progress through 7 milestone levels — from building an emergency fund to building wealth and giving — with automatic state management and scoring.

## Run

```bash
bun examples/7-money-milestones/game-cli.ts init
bun examples/7-money-milestones/game-cli.ts status
bun examples/7-money-milestones/game-cli.ts action "Saved $500 this month"
```

## Features

- **7-level progression** — Emergency Fund, Debt Payoff, 3-Month Reserve, Invest 15%, College Savings, Pay Off Home, Build Wealth & Give
- **CLI commands** — `init`, `status`, `action`, `complete`, `advice`, `report`
- **Google Apps Script UI** — optional spreadsheet-native interface (`apps-script.js`)
- **No-skip enforcement** — milestones must be completed in order
- **AI-powered advice** — contextual financial guidance per milestone

## Spreadsheet Setup

| Sheet | Purpose |
|-------|---------|
| Game State | Current milestone, score, history |
| Actions | Logged player actions with timestamps |
| AGENTSCAPE | Agent context (auto-created) |

## Prerequisites

- Fresh Google Spreadsheet shared with service account
- `SPREADSHEET_ID` environment variable
- Optional: install `apps-script.js` in Apps Script editor for spreadsheet UI

## CLI Simulation

A full session walkthrough — init, track actions, get advice, complete a milestone, and check progress.

### 1. Initialize a new game

```bash
$ bun game-cli.ts init --spreadsheet-id=$SID --player="Alex Demo"
```

```
🎮 Initializing 7 Money Milestones game for Alex Demo...

✅ Game initialized successfully!

📊 Created sheets:
   - GAME_CONFIG (game settings)
   - GAME_STATE (milestone progress)
   - PLAYER_ACTIONS (action log)
   - AGENTSCAPE (tutorial and resources)

💡 Next steps:
   1. Check status: bun game-cli.ts status --spreadsheet-id=...
   2. Record action: bun game-cli.ts action "description" --milestone=1 --spreadsheet-id=...
   3. Get advice: bun game-cli.ts advice --spreadsheet-id=...
```

### 2. Check status

```bash
$ bun game-cli.ts status --spreadsheet-id=$SID
```

```
📊 7 Money Milestones - Game Status

Player: Alex Demo
Started: 2026-02-01
Current Milestone: 1/7
Total Score: 0 points

Milestones:

🎯 Milestone 1: Emergency Fund ($1000)
   Status: ACTIVE

🔒 Milestone 2: Pay Off Credit Cards
   Status: LOCKED

🔒 Milestone 3: 3-6 Months Emergency Fund
   Status: LOCKED

🔒 Milestone 4: Invest 15% of Income
   Status: LOCKED

🔒 Milestone 5: College Fund
   Status: LOCKED

🔒 Milestone 6: Pay Off Mortgage
   Status: LOCKED

🔒 Milestone 7: Build Wealth & Give
   Status: LOCKED
```

### 3. Record actions toward Milestone 1

```bash
$ bun game-cli.ts action "Saved $500 from tax refund" --milestone=1 --amount=500 --spreadsheet-id=$SID
```

```
📝 Recording action for Milestone 1...

✅ Action recorded: "Saved $500 from tax refund"
   Amount: $500.00
   Milestone: 1

💡 Check PLAYER_ACTIONS sheet to see your action history.
```

```bash
$ bun game-cli.ts action "Side hustle income deposited" --milestone=1 --amount=500 --spreadsheet-id=$SID
```

```
📝 Recording action for Milestone 1...

✅ Action recorded: "Side hustle income deposited"
   Amount: $500.00
   Milestone: 1
```

### 4. Get advice for current milestone

```bash
$ bun game-cli.ts advice --spreadsheet-id=$SID
```

```
💡 Financial Advice

Focus on saving $1000 for your starter emergency fund. This protects you from
small emergencies like car repairs or medical bills. Try automating $50/week
transfers to a savings account.
```

### 5. Complete Milestone 1

```bash
$ bun game-cli.ts complete 1 --spreadsheet-id=$SID
```

```
🎯 Completing Milestone 1...

✅ Milestone 1 completed!
   Score earned: 100 points

🎯 Next up: Milestone 2
   Run: bun game-cli.ts status --spreadsheet-id=... to see details
```

### 6. Progress report

```bash
$ bun game-cli.ts report --spreadsheet-id=$SID
```

```
📈 Progress Report

Player: Alex Demo
Current Milestone: 2/7
Completed: 1/7 milestones
Total Score: 100 points

🏆 Achievements:
   🎯 First Steps - Emergency fund established!

📋 Next Steps:
   Work on: Pay Off Credit Cards
   Record actions with: bun game-cli.ts action "description" --milestone=2
   Complete with: bun game-cli.ts complete 2
```

### 7. Final status

```bash
$ bun game-cli.ts status --spreadsheet-id=$SID
```

```
📊 7 Money Milestones - Game Status

Player: Alex Demo
Started: 2026-02-01
Current Milestone: 2/7
Total Score: 100 points

Milestones:

✅ Milestone 1: Emergency Fund ($1000)
   Status: COMPLETED
   Completed: 2026-02-01
   Score: 100 points
   Notes: Completed on 2026-02-01. Score: 100

🎯 Milestone 2: Pay Off Credit Cards
   Status: ACTIVE

🔒 Milestone 3: 3-6 Months Emergency Fund
   Status: LOCKED

🔒 Milestone 4: Invest 15% of Income
   Status: LOCKED

🔒 Milestone 5: College Fund
   Status: LOCKED

🔒 Milestone 6: Pay Off Mortgage
   Status: LOCKED

🔒 Milestone 7: Build Wealth & Give
   Status: LOCKED
```

## Source

`examples/7-money-milestones/`
