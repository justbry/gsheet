#!/usr/bin/env bun

/**
 * 7 Money Milestones - Financial Simulation CLI
 *
 * Usage:
 *   bun game-cli.ts init --spreadsheet-id=X --player=Name --learning=2 --health=3 --savings=H
 *   bun game-cli.ts play A --spreadsheet-id=X
 *   bun game-cli.ts status --spreadsheet-id=X
 *   bun game-cli.ts scoreboard --spreadsheet-id=X
 */

import { SheetAgent } from '../../src/agent';
import { MoneyMilestonesGame } from './game-manager';

function getArg(args: string[], prefix: string): string | undefined {
  return args.find(a => a.startsWith(`--${prefix}=`))?.split('=')[1];
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    printUsage();
    process.exit(1);
  }

  const spreadsheetId = getArg(args, 'spreadsheet-id');
  if (!spreadsheetId) {
    console.error('Error: --spreadsheet-id is required');
    process.exit(1);
  }

  const agent = new SheetAgent({ spreadsheetId, defaultFormat: 'array' });
  const game = new MoneyMilestonesGame(agent);

  try {
    switch (command) {
      case 'init': {
        const player = getArg(args, 'player');
        const learning = Number(getArg(args, 'learning') ?? 1);
        const health = Number(getArg(args, 'health') ?? 1);
        const savings = (getArg(args, 'savings') ?? 'M') as 'L' | 'M' | 'H';

        if (!player) {
          console.error('Error: --player=Name is required');
          process.exit(1);
        }
        if (learning < 1 || learning > 3) {
          console.error('Error: --learning must be 1, 2, or 3');
          process.exit(1);
        }
        if (health < 1 || health > 3) {
          console.error('Error: --health must be 1, 2, or 3');
          process.exit(1);
        }
        if (!['L', 'M', 'H'].includes(savings)) {
          console.error('Error: --savings must be L, M, or H');
          process.exit(1);
        }

        console.log(`Initializing game for ${player}...`);
        console.log(`  Habits: Learning=${learning}, Health=${health}, Savings=${savings}\n`);

        await game.initGame(player, learning, health, savings);

        const { stats } = await game.getStatus();
        console.log('Game initialized! Starting stats:');
        console.log(`  Cash: $${stats.cash}  Debt: $${stats.debt}  Assets: $${stats.assets}`);
        console.log(`  Monthly Income: $${stats.monthlyIncome}  IP: ${stats.ip}  IP Multiplier: ${stats.ipMultiplier}x`);
        console.log('\nSheets created: GAME_CONFIG, GAME_STATE, PHASE_EVENTS, GAME_LOG');
        console.log('\nNext: bun game-cli.ts status --spreadsheet-id=...');
        break;
      }

      case 'play': {
        const choice = args[1]?.toUpperCase() as 'A' | 'B' | 'C';
        if (!choice || !['A', 'B', 'C'].includes(choice)) {
          console.error('Error: play requires a choice: A, B, or C');
          console.error('  Usage: bun game-cli.ts play A --spreadsheet-id=...');
          process.exit(1);
        }

        const result = await game.playPhase(choice);

        console.log(`\n--- Phase ${result.event.phase}: ${result.event.title} ---`);
        console.log(result.event.description);
        console.log(`\nYou chose ${choice}: ${
          choice === 'A' ? result.event.optionA.label :
          choice === 'B' ? result.event.optionB.label :
          result.event.optionC.label
        }`);
        console.log(`\nRoll: ${result.roll} -> Modified: ${result.modifiedRoll} => ${result.outcomeTier.toUpperCase()}`);
        console.log(`  Cash: ${result.outcome.cash >= 0 ? '+' : ''}${result.outcome.cash}`);
        console.log(`  Debt: ${result.outcome.debt >= 0 ? '+' : ''}${result.outcome.debt}`);
        console.log(`  Assets: ${result.outcome.assets >= 0 ? '+' : ''}${result.outcome.assets}`);
        console.log(`  IP: +${result.outcome.ip}`);

        console.log(`\nCurrent totals:`);
        console.log(`  Cash: $${result.newStats.cash}  Debt: $${result.newStats.debt}  Assets: $${result.newStats.assets}  IP: ${result.newStats.ip}`);

        if (result.newStats.currentPhase > 7) {
          const score = game.calculateScore(result.newStats);
          console.log(`\nGame Over! Final Score: ${score}`);
          console.log('Run "scoreboard" for full breakdown.');
        } else {
          console.log(`\nNext phase: ${result.newStats.currentPhase}/7`);
        }
        break;
      }

      case 'status': {
        const { config, stats } = await game.getStatus();

        console.log(`\n--- ${config.playerName}'s Game ---`);
        console.log(`Started: ${config.startedDate}`);
        console.log(`Habits: Learning=${config.learningTier}, Health=${config.healthTier}, Savings=${config.savingsTier}`);
        console.log(`\nPhase: ${stats.currentPhase > 7 ? 'COMPLETE' : `${stats.currentPhase}/7`}`);
        console.log(`Cash: $${stats.cash}`);
        console.log(`Debt: $${stats.debt}`);
        console.log(`Assets: $${stats.assets}`);
        console.log(`Monthly Income: $${stats.monthlyIncome}`);
        console.log(`IP: ${stats.ip} (x${stats.ipMultiplier} multiplier)`);

        if (stats.currentPhase <= 7) {
          console.log(`\nNext: bun game-cli.ts play A|B|C --spreadsheet-id=...`);
        } else {
          console.log(`\nGame complete! Run: bun game-cli.ts scoreboard --spreadsheet-id=...`);
        }
        break;
      }

      case 'scoreboard': {
        const { config, stats } = await game.getStatus();
        const score = game.calculateScore(stats);

        console.log(`\n=== SCOREBOARD ===`);
        console.log(`Player: ${config.playerName}`);
        console.log(`Phase: ${stats.currentPhase > 7 ? 'COMPLETE' : `${stats.currentPhase}/7`}`);
        console.log(`\nBreakdown:`);
        console.log(`  Assets:  $${stats.assets}`);
        console.log(`  + Cash:  $${stats.cash}`);
        console.log(`  - Debt:  $${stats.debt}`);
        console.log(`  + IP:    ${stats.ip} x 50 = $${stats.ip * 50}`);
        console.log(`  ─────────────────`);
        console.log(`  SCORE:   ${score}`);
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
7 Money Milestones - Financial Simulation Game

Commands:
  init        Start a new game
              --spreadsheet-id=X --player=Name --learning=1|2|3 --health=1|2|3 --savings=L|M|H

  play        Play next phase (choose A, B, or C)
              play A|B|C --spreadsheet-id=X

  status      Show current game state
              --spreadsheet-id=X

  scoreboard  Show final score breakdown
              --spreadsheet-id=X

Habit Tiers:
  Learning: 1=None, 2=Moderate ($150/mo, IP x1.5), 3=Intensive ($300/mo, IP x1.75)
  Health:   1=Poor (-$150/mo), 2=Average, 3=Active (+$75/mo net)
  Savings:  L=Low (-$300 start), M=Medium, H=High (+$400 start, -$200/mo)

Examples:
  bun game-cli.ts init --spreadsheet-id=ABC --player=Demo --learning=2 --health=2 --savings=M
  bun game-cli.ts play A --spreadsheet-id=ABC
  bun game-cli.ts status --spreadsheet-id=ABC
  bun game-cli.ts scoreboard --spreadsheet-id=ABC
`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
