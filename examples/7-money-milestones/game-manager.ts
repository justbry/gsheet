/**
 * 7 Money Milestones - Financial Simulation Game Manager
 *
 * A single-player financial simulation game demonstrating gsheet read/write patterns.
 * Players pick habits, advance through 7 life phases, make choices, and roll dice.
 */

import type { SheetAgent } from '../../src/agent';

// --- Types ---

export interface GameConfig {
  playerName: string;
  learningTier: number; // 1-3
  healthTier: number; // 1-3
  savingsTier: 'L' | 'M' | 'H';
  startedDate: string;
}

export interface PlayerStats {
  cash: number;
  debt: number;
  assets: number;
  monthlyIncome: number;
  ip: number;
  ipMultiplier: number;
  currentPhase: number; // 1-7, 8 = game over
}

export interface PhaseEventOption {
  label: string;
  worst: { cash: number; debt: number; assets: number; ip: number };
  avg: { cash: number; debt: number; assets: number; ip: number };
  best: { cash: number; debt: number; assets: number; ip: number };
}

export interface PhaseEvent {
  phase: number;
  title: string;
  description: string;
  optionA: PhaseEventOption;
  optionB: PhaseEventOption;
  optionC: PhaseEventOption;
}

// --- Constants ---

const PHASE_EVENTS: PhaseEvent[] = [
  {
    phase: 1, title: 'Financial Education', description: 'Milestone 1: Acquire a financial education — the foundation for every decision ahead.',
    optionA: { label: 'Read personal finance books on your own',
      worst: { cash: -50, debt: 0, assets: 0, ip: 1 },
      avg:   { cash: 0, debt: 0, assets: 0, ip: 2 },
      best:  { cash: 100, debt: 0, assets: 0, ip: 3 } },
    optionB: { label: 'Take an online financial literacy course',
      worst: { cash: -200, debt: 0, assets: 0, ip: 1 },
      avg:   { cash: -100, debt: 0, assets: 0, ip: 3 },
      best:  { cash: 0, debt: 0, assets: 0, ip: 5 } },
    optionC: { label: 'Work with a financial professional',
      worst: { cash: -300, debt: 0, assets: 0, ip: 2 },
      avg:   { cash: -200, debt: 0, assets: 100, ip: 3 },
      best:  { cash: -100, debt: 0, assets: 200, ip: 4 } },
  },
  {
    phase: 2, title: 'Proper Protection', description: 'Milestone 2: Ensure adequate protection — safeguard your income and loved ones.',
    optionA: { label: 'Basic term life insurance only',
      worst: { cash: -100, debt: 0, assets: 0, ip: 0 },
      avg:   { cash: -100, debt: 0, assets: 100, ip: 1 },
      best:  { cash: -100, debt: 0, assets: 300, ip: 1 } },
    optionB: { label: 'Comprehensive life + disability coverage',
      worst: { cash: -300, debt: 0, assets: 0, ip: 0 },
      avg:   { cash: -250, debt: 0, assets: 400, ip: 1 },
      best:  { cash: -200, debt: 0, assets: 800, ip: 2 } },
    optionC: { label: 'Skip insurance — invest the premiums instead',
      worst: { cash: -500, debt: 500, assets: -200, ip: 0 },
      avg:   { cash: 200, debt: 0, assets: 200, ip: 0 },
      best:  { cash: 400, debt: 0, assets: 500, ip: 1 } },
  },
  {
    phase: 3, title: 'Emergency Fund', description: 'Milestone 3: Establish an emergency fund — your financial buffer for the unexpected.',
    optionA: { label: 'Save 3 months of expenses in savings account',
      worst: { cash: 200, debt: 0, assets: 0, ip: 0 },
      avg:   { cash: 500, debt: 0, assets: 0, ip: 1 },
      best:  { cash: 800, debt: 0, assets: 0, ip: 1 } },
    optionB: { label: 'Build 6 months in a high-yield money market',
      worst: { cash: 100, debt: 0, assets: 100, ip: 0 },
      avg:   { cash: 400, debt: 0, assets: 300, ip: 1 },
      best:  { cash: 700, debt: 0, assets: 500, ip: 2 } },
    optionC: { label: 'Keep minimal cash — rely on credit lines',
      worst: { cash: -400, debt: 800, assets: 0, ip: 0 },
      avg:   { cash: 100, debt: 200, assets: 0, ip: 0 },
      best:  { cash: 300, debt: 0, assets: 0, ip: 1 } },
  },
  {
    phase: 4, title: 'Debt Management', description: 'Milestone 4: Implement debt management — free your income from high-interest obligations.',
    optionA: { label: 'Snowball method — smallest balances first',
      worst: { cash: 0, debt: -200, assets: 0, ip: 0 },
      avg:   { cash: 100, debt: -500, assets: 0, ip: 1 },
      best:  { cash: 300, debt: -800, assets: 0, ip: 2 } },
    optionB: { label: 'Avalanche method — highest interest first',
      worst: { cash: -100, debt: -300, assets: 0, ip: 1 },
      avg:   { cash: 0, debt: -600, assets: 0, ip: 2 },
      best:  { cash: 200, debt: -900, assets: 0, ip: 3 } },
    optionC: { label: 'Consolidate with a personal loan',
      worst: { cash: -200, debt: 200, assets: 0, ip: 0 },
      avg:   { cash: 100, debt: -400, assets: 0, ip: 1 },
      best:  { cash: 300, debt: -700, assets: 0, ip: 2 } },
  },
  {
    phase: 5, title: 'Cash Flow', description: 'Milestone 5: Enhance your cash flow — optimize your budget to fuel savings and growth.',
    optionA: { label: 'Strict budget — cut discretionary spending',
      worst: { cash: 200, debt: 0, assets: 0, ip: 0 },
      avg:   { cash: 500, debt: 0, assets: 100, ip: 1 },
      best:  { cash: 800, debt: 0, assets: 200, ip: 1 } },
    optionB: { label: 'Increase income — side hustle or negotiate raise',
      worst: { cash: -100, debt: 0, assets: 0, ip: 1 },
      avg:   { cash: 400, debt: 0, assets: 0, ip: 2 },
      best:  { cash: 1000, debt: 0, assets: 300, ip: 3 } },
    optionC: { label: 'Automate — set up systematic transfers',
      worst: { cash: 100, debt: 0, assets: 100, ip: 0 },
      avg:   { cash: 300, debt: 0, assets: 300, ip: 1 },
      best:  { cash: 600, debt: 0, assets: 600, ip: 2 } },
  },
  {
    phase: 6, title: 'Build Wealth', description: 'Milestone 6: Accelerate wealth building — invest strategically for your future.',
    optionA: { label: 'Index funds — diversified, low-cost',
      worst: { cash: 0, debt: 0, assets: 500, ip: 0 },
      avg:   { cash: 200, debt: 0, assets: 1200, ip: 1 },
      best:  { cash: 500, debt: 0, assets: 2000, ip: 1 } },
    optionB: { label: 'Real estate + retirement accounts',
      worst: { cash: -500, debt: 500, assets: 800, ip: 0 },
      avg:   { cash: 200, debt: 0, assets: 2000, ip: 2 },
      best:  { cash: 800, debt: 0, assets: 4000, ip: 3 } },
    optionC: { label: 'Start a business with your expertise',
      worst: { cash: -800, debt: 1500, assets: 0, ip: 2 },
      avg:   { cash: 500, debt: 0, assets: 1500, ip: 3 },
      best:  { cash: 2000, debt: 0, assets: 3000, ip: 5 } },
  },
  {
    phase: 7, title: 'Protect Wealth', description: 'Milestone 7: Fortify wealth protection — preserve and transfer what you\'ve built.',
    optionA: { label: 'Estate plan + trust + will',
      worst: { cash: -300, debt: 0, assets: 500, ip: 1 },
      avg:   { cash: -200, debt: 0, assets: 1500, ip: 2 },
      best:  { cash: 0, debt: 0, assets: 2500, ip: 3 } },
    optionB: { label: 'Tax-efficient strategies + asset protection',
      worst: { cash: -200, debt: 0, assets: 800, ip: 1 },
      avg:   { cash: 200, debt: 0, assets: 2000, ip: 2 },
      best:  { cash: 800, debt: 0, assets: 3500, ip: 3 } },
    optionC: { label: 'Legacy giving + generational wealth plan',
      worst: { cash: -500, debt: 0, assets: 300, ip: 2 },
      avg:   { cash: -200, debt: 0, assets: 1200, ip: 4 },
      best:  { cash: 200, debt: 0, assets: 2500, ip: 5 } },
  },
];

// --- Game Manager ---

export class MoneyMilestonesGame {
  constructor(private agent: SheetAgent) {}

  async initGame(
    name: string,
    learningTier: number,
    healthTier: number,
    savingsTier: 'L' | 'M' | 'H',
  ): Promise<void> {
    const startedDate = new Date().toISOString().split('T')[0]!;

    // Calculate starting stats from habits
    const stats = this.calculateStartingStats(learningTier, healthTier, savingsTier);

    // Create GAME_CONFIG
    await this.agent.createSheet('GAME_CONFIG');
    await this.agent.write({
      sheet: 'GAME_CONFIG',
      range: 'A1:B5',
      data: [
        ['Player Name', name],
        ['Learning Tier', String(learningTier)],
        ['Health Tier', String(healthTier)],
        ['Savings Tier', savingsTier],
        ['Started Date', startedDate],
      ],
    });

    // Create GAME_STATE
    await this.agent.createSheet('GAME_STATE');
    await this.agent.write({
      sheet: 'GAME_STATE',
      range: 'A1:B7',
      data: [
        ['Cash', String(stats.cash)],
        ['Debt', String(stats.debt)],
        ['Assets', String(stats.assets)],
        ['Monthly Income', String(stats.monthlyIncome)],
        ['IP', String(stats.ip)],
        ['IP Multiplier', String(stats.ipMultiplier)],
        ['Current Phase', '1'],
      ],
    });

    // Create PHASE_EVENTS with 7 event cards
    await this.agent.createSheet('PHASE_EVENTS');
    const eventRows: (string | number)[][] = [
      ['Phase', 'Title', 'Description', 'Option A', 'Option B', 'Option C'],
      ...PHASE_EVENTS.map(e => [
        e.phase,
        e.title,
        e.description,
        JSON.stringify(e.optionA),
        JSON.stringify(e.optionB),
        JSON.stringify(e.optionC),
      ]),
    ];
    await this.agent.write({
      sheet: 'PHASE_EVENTS',
      range: 'A1',
      data: eventRows,
    });

    // Create GAME_LOG
    await this.agent.createSheet('GAME_LOG');
    await this.agent.write({
      sheet: 'GAME_LOG',
      range: 'A1:G1',
      data: [['Timestamp', 'Phase', 'Choice', 'Roll', 'Modified Roll', 'Outcome', 'Stats Snapshot']],
    });
  }

  calculateStartingStats(
    learningTier: number,
    healthTier: number,
    savingsTier: 'L' | 'M' | 'H',
  ): PlayerStats {
    // Base stats
    let cash = 500;
    let debt = 1000;
    let assets = 500;
    let monthlyIncome = 2000;
    let ip = 1;

    // Learning tier: IP multiplier + starting IP + monthly cost
    const ipMultiplier = learningTier === 1 ? 1.0 : learningTier === 2 ? 1.5 : 1.75;
    const learningIP = learningTier === 1 ? 0 : learningTier === 2 ? 1 : 2;
    const learningCost = learningTier === 1 ? 0 : learningTier === 2 ? 150 : 300;
    ip += learningIP;
    monthlyIncome -= learningCost;

    // Health tier: income modifier + monthly cost
    if (healthTier === 1) monthlyIncome -= 150;
    if (healthTier === 3) { monthlyIncome += 150; monthlyIncome -= 75; }

    // Savings tier: phase-start effect + income modifier
    if (savingsTier === 'L') cash -= 300;
    if (savingsTier === 'H') { cash += 400; monthlyIncome -= 200; }

    return { cash, debt, assets, monthlyIncome, ip, ipMultiplier, currentPhase: 1 };
  }

  async getStatus(): Promise<{ config: GameConfig; stats: PlayerStats }> {
    const configResult = await this.agent.read({ sheet: 'GAME_CONFIG', range: 'A1:B5', format: 'array' });
    const configData = configResult.rows as unknown[][];

    const config: GameConfig = {
      playerName: String(configData[0]?.[1] ?? ''),
      learningTier: Number(configData[1]?.[1] ?? 1),
      healthTier: Number(configData[2]?.[1] ?? 1),
      savingsTier: String(configData[3]?.[1] ?? 'M') as 'L' | 'M' | 'H',
      startedDate: String(configData[4]?.[1] ?? ''),
    };

    const stateResult = await this.agent.read({ sheet: 'GAME_STATE', range: 'A1:B7', format: 'array' });
    const stateData = stateResult.rows as unknown[][];

    const stats: PlayerStats = {
      cash: Number(stateData[0]?.[1] ?? 0),
      debt: Number(stateData[1]?.[1] ?? 0),
      assets: Number(stateData[2]?.[1] ?? 0),
      monthlyIncome: Number(stateData[3]?.[1] ?? 0),
      ip: Number(stateData[4]?.[1] ?? 0),
      ipMultiplier: Number(stateData[5]?.[1] ?? 1),
      currentPhase: Number(stateData[6]?.[1] ?? 1),
    };

    return { config, stats };
  }

  async playPhase(choice: 'A' | 'B' | 'C'): Promise<{
    event: PhaseEvent;
    roll: number;
    modifiedRoll: number;
    outcomeTier: 'worst' | 'avg' | 'best';
    outcome: { cash: number; debt: number; assets: number; ip: number };
    newStats: PlayerStats;
  }> {
    const { config, stats } = await this.getStatus();

    if (stats.currentPhase > 7) {
      throw new Error('Game is over. Use "scoreboard" to see your final score.');
    }

    // Read event for current phase
    const phaseRow = stats.currentPhase + 1; // +1 for header
    const eventResult = await this.agent.read({
      sheet: 'PHASE_EVENTS',
      range: `A${phaseRow}:F${phaseRow}`,
      format: 'array',
    });
    const row = (eventResult.rows as unknown[][])[0];
    if (!row) throw new Error('Could not read phase event.');

    const event: PhaseEvent = {
      phase: Number(row[0]),
      title: String(row[1]),
      description: String(row[2]),
      optionA: JSON.parse(String(row[3])),
      optionB: JSON.parse(String(row[4])),
      optionC: JSON.parse(String(row[5])),
    };

    const selectedOption = choice === 'A' ? event.optionA : choice === 'B' ? event.optionB : event.optionC;

    // Roll d6 with learning modifier
    const roll = Math.floor(Math.random() * 6) + 1;
    const modifiedRoll = this.applyLearningModifier(roll, config.learningTier);

    // Determine outcome tier
    const outcomeTier: 'worst' | 'avg' | 'best' =
      modifiedRoll <= 2 ? 'worst' : modifiedRoll <= 4 ? 'avg' : 'best';

    const outcome = selectedOption[outcomeTier];

    // Apply IP multiplier to IP gains
    const ipGain = Math.round(outcome.ip * stats.ipMultiplier);

    // Update stats
    const newStats: PlayerStats = {
      cash: stats.cash + outcome.cash,
      debt: Math.max(0, stats.debt + outcome.debt),
      assets: Math.max(0, stats.assets + outcome.assets),
      monthlyIncome: stats.monthlyIncome,
      ip: stats.ip + ipGain,
      ipMultiplier: stats.ipMultiplier,
      currentPhase: stats.currentPhase + 1,
    };

    // Write updated state
    await this.agent.write({
      sheet: 'GAME_STATE',
      range: 'A1:B7',
      data: [
        ['Cash', String(newStats.cash)],
        ['Debt', String(newStats.debt)],
        ['Assets', String(newStats.assets)],
        ['Monthly Income', String(newStats.monthlyIncome)],
        ['IP', String(newStats.ip)],
        ['IP Multiplier', String(newStats.ipMultiplier)],
        ['Current Phase', String(newStats.currentPhase)],
      ],
    });

    // Log to GAME_LOG
    const logResult = await this.agent.read({ sheet: 'GAME_LOG', format: 'array' });
    const logRows = logResult.rows as unknown[][];
    const snapshot = `C:${newStats.cash} D:${newStats.debt} A:${newStats.assets} IP:${newStats.ip}`;
    const outcomeDesc = `${outcomeTier.toUpperCase()}: ${selectedOption.label} — cash:${outcome.cash} debt:${outcome.debt} assets:${outcome.assets} ip:${ipGain}`;

    logRows.push([
      new Date().toISOString(),
      String(stats.currentPhase),
      choice,
      String(roll),
      String(modifiedRoll),
      outcomeDesc,
      snapshot,
    ]);

    await this.agent.write({ sheet: 'GAME_LOG', range: 'A1', data: logRows });

    return { event, roll, modifiedRoll, outcomeTier, outcome: { ...outcome, ip: ipGain }, newStats };
  }

  applyLearningModifier(roll: number, learningTier: number): number {
    if (learningTier === 2) {
      // Tier 2: rolls 1-2 become 3
      return roll <= 2 ? 3 : roll;
    }
    if (learningTier === 3) {
      // Tier 3: rolls 1-2 become 4, rolls 5-6 always best
      if (roll <= 2) return 4;
      if (roll >= 5) return 6;
      return roll;
    }
    return roll;
  }

  calculateScore(stats: PlayerStats): number {
    return (stats.assets + stats.cash - stats.debt) + (stats.ip * 50);
  }
}
