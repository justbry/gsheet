/**
 * 7 Money Milestones - Financial Simulation Game Manager
 *
 * Based on the HowMoneyWorks 7 Money Milestones framework.
 * Each milestone has 4 levels: red (10), orange (40), yellow (70), green (100).
 * Final score = average of all 7 milestone scores.
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

export type MilestoneColor = 'red' | 'orange' | 'yellow' | 'green';

export const MILESTONE_SCORES: Record<MilestoneColor, number> = {
  red: 10,
  orange: 40,
  yellow: 70,
  green: 100,
};

export interface MilestoneLevel {
  color: MilestoneColor;
  description: string;
}

export interface PhaseEventOption {
  label: string;
  red:    { cash: number; debt: number; assets: number; ip: number };
  orange: { cash: number; debt: number; assets: number; ip: number };
  yellow: { cash: number; debt: number; assets: number; ip: number };
  green:  { cash: number; debt: number; assets: number; ip: number };
}

export interface PhaseEvent {
  phase: number;
  title: string;
  description: string;
  levels: [MilestoneLevel, MilestoneLevel, MilestoneLevel, MilestoneLevel]; // red, orange, yellow, green
  optionA: PhaseEventOption;
  optionB: PhaseEventOption;
  optionC: PhaseEventOption;
}

// --- Constants ---

const PHASE_EVENTS: PhaseEvent[] = [
  {
    phase: 1, title: 'Financial Education',
    description: 'Milestone 1: Acquire a financial education — the foundation for every decision ahead.',
    levels: [
      { color: 'red', description: 'Not sure where to start' },
      { color: 'orange', description: 'Some knowledge with no plan' },
      { color: 'yellow', description: 'Some knowledge with partial plan' },
      { color: 'green', description: 'Knowledgeable with full plan' },
    ],
    optionA: { label: 'Read personal finance books on your own',
      red:    { cash: -50, debt: 0, assets: 0, ip: 1 },
      orange: { cash: 0, debt: 0, assets: 0, ip: 2 },
      yellow: { cash: 50, debt: 0, assets: 0, ip: 3 },
      green:  { cash: 100, debt: 0, assets: 0, ip: 4 } },
    optionB: { label: 'Take a financial literacy course',
      red:    { cash: -200, debt: 0, assets: 0, ip: 1 },
      orange: { cash: -150, debt: 0, assets: 0, ip: 2 },
      yellow: { cash: -100, debt: 0, assets: 0, ip: 4 },
      green:  { cash: 0, debt: 0, assets: 100, ip: 5 } },
    optionC: { label: 'Work with a financial professional',
      red:    { cash: -300, debt: 0, assets: 0, ip: 2 },
      orange: { cash: -250, debt: 0, assets: 100, ip: 3 },
      yellow: { cash: -200, debt: 0, assets: 150, ip: 4 },
      green:  { cash: -100, debt: 0, assets: 300, ip: 5 } },
  },
  {
    phase: 2, title: 'Proper Protection',
    description: 'Milestone 2: Ensure adequate insurance protection — safeguard your income and loved ones.',
    levels: [
      { color: 'red', description: 'Missing key insurance' },
      { color: 'orange', description: 'Lacking coverage in key areas' },
      { color: 'yellow', description: 'Premiums are high/underinsured' },
      { color: 'green', description: 'Right types, coverage, and price' },
    ],
    optionA: { label: 'Basic term life insurance only',
      red:    { cash: -50, debt: 0, assets: 0, ip: 0 },
      orange: { cash: -100, debt: 0, assets: 100, ip: 0 },
      yellow: { cash: -100, debt: 0, assets: 200, ip: 1 },
      green:  { cash: -100, debt: 0, assets: 400, ip: 1 } },
    optionB: { label: 'Comprehensive life + disability + umbrella',
      red:    { cash: -300, debt: 0, assets: 0, ip: 0 },
      orange: { cash: -250, debt: 0, assets: 200, ip: 1 },
      yellow: { cash: -250, debt: 0, assets: 500, ip: 1 },
      green:  { cash: -200, debt: 0, assets: 800, ip: 2 } },
    optionC: { label: 'Skip insurance — invest the premiums instead',
      red:    { cash: -500, debt: 500, assets: -200, ip: 0 },
      orange: { cash: -100, debt: 200, assets: 100, ip: 0 },
      yellow: { cash: 200, debt: 0, assets: 200, ip: 0 },
      green:  { cash: 400, debt: 0, assets: 500, ip: 1 } },
  },
  {
    phase: 3, title: 'Emergency Fund',
    description: 'Milestone 3: Establish an emergency fund — your financial buffer for the unexpected.',
    levels: [
      { color: 'red', description: 'No emergency fund' },
      { color: 'orange', description: 'Neither fully funded nor over 1%' },
      { color: 'yellow', description: 'Funded OR over 1%' },
      { color: 'green', description: 'Fully funded AND over 1%' },
    ],
    optionA: { label: 'Save 3 months in a savings account',
      red:    { cash: 100, debt: 0, assets: 0, ip: 0 },
      orange: { cash: 300, debt: 0, assets: 0, ip: 0 },
      yellow: { cash: 600, debt: 0, assets: 0, ip: 1 },
      green:  { cash: 800, debt: 0, assets: 100, ip: 1 } },
    optionB: { label: 'Build 6 months in a high-yield account',
      red:    { cash: 50, debt: 0, assets: 50, ip: 0 },
      orange: { cash: 200, debt: 0, assets: 200, ip: 0 },
      yellow: { cash: 400, debt: 0, assets: 400, ip: 1 },
      green:  { cash: 700, debt: 0, assets: 600, ip: 2 } },
    optionC: { label: 'Keep minimal cash — rely on credit lines',
      red:    { cash: -400, debt: 800, assets: 0, ip: 0 },
      orange: { cash: -100, debt: 300, assets: 0, ip: 0 },
      yellow: { cash: 100, debt: 0, assets: 0, ip: 0 },
      green:  { cash: 300, debt: 0, assets: 0, ip: 1 } },
  },
  {
    phase: 4, title: 'Debt Management',
    description: 'Milestone 4: Implement debt management — free your income from high-interest obligations.',
    levels: [
      { color: 'red', description: 'Mortgage + >20% non-mortgage debt-to-income' },
      { color: 'orange', description: 'Mortgage + 12%-20% non-mortgage DTI' },
      { color: 'yellow', description: 'Mortgage + 5%-12% non-mortgage DTI' },
      { color: 'green', description: 'Mortgage + <5% non-mortgage DTI' },
    ],
    optionA: { label: 'Snowball method — smallest balances first',
      red:    { cash: 0, debt: -100, assets: 0, ip: 0 },
      orange: { cash: 50, debt: -300, assets: 0, ip: 1 },
      yellow: { cash: 100, debt: -600, assets: 0, ip: 1 },
      green:  { cash: 300, debt: -900, assets: 0, ip: 2 } },
    optionB: { label: 'Avalanche method — highest interest first',
      red:    { cash: -100, debt: -200, assets: 0, ip: 1 },
      orange: { cash: 0, debt: -400, assets: 0, ip: 1 },
      yellow: { cash: 0, debt: -700, assets: 0, ip: 2 },
      green:  { cash: 200, debt: -1000, assets: 0, ip: 3 } },
    optionC: { label: 'Consolidate into a personal loan',
      red:    { cash: -200, debt: 200, assets: 0, ip: 0 },
      orange: { cash: 0, debt: -200, assets: 0, ip: 0 },
      yellow: { cash: 100, debt: -500, assets: 0, ip: 1 },
      green:  { cash: 300, debt: -800, assets: 0, ip: 2 } },
  },
  {
    phase: 5, title: 'Cash Flow',
    description: 'Milestone 5: Enhance your cash flow — pay into debt, savings, and retirement.',
    levels: [
      { color: 'red', description: 'Not able to make payments' },
      { color: 'orange', description: 'Able to pay into 1 of 3 areas' },
      { color: 'yellow', description: 'Able to pay into 2 of 3 areas' },
      { color: 'green', description: 'Able to pay into debt, savings, and retirement' },
    ],
    optionA: { label: 'Strict budget — cut discretionary spending',
      red:    { cash: 100, debt: 0, assets: 0, ip: 0 },
      orange: { cash: 300, debt: 0, assets: 0, ip: 0 },
      yellow: { cash: 500, debt: -100, assets: 100, ip: 1 },
      green:  { cash: 800, debt: -200, assets: 300, ip: 1 } },
    optionB: { label: 'Increase income — side hustle or negotiate raise',
      red:    { cash: -100, debt: 0, assets: 0, ip: 1 },
      orange: { cash: 200, debt: 0, assets: 0, ip: 1 },
      yellow: { cash: 500, debt: 0, assets: 200, ip: 2 },
      green:  { cash: 1000, debt: -100, assets: 400, ip: 3 } },
    optionC: { label: 'Automate — systematic transfers to all 3 areas',
      red:    { cash: 50, debt: 0, assets: 50, ip: 0 },
      orange: { cash: 200, debt: -100, assets: 150, ip: 1 },
      yellow: { cash: 400, debt: -200, assets: 300, ip: 1 },
      green:  { cash: 600, debt: -300, assets: 500, ip: 2 } },
  },
  {
    phase: 6, title: 'Build Wealth',
    description: 'Milestone 6: Accelerate wealth building — grow assets toward financial independence.',
    levels: [
      { color: 'red', description: '0-25% of after-tax income saved/invested' },
      { color: 'orange', description: '26-50% of after-tax income saved/invested' },
      { color: 'yellow', description: '51-75% of after-tax income saved/invested' },
      { color: 'green', description: '76-100% of after-tax income saved/invested' },
    ],
    optionA: { label: 'Index funds — diversified, low-cost',
      red:    { cash: 0, debt: 0, assets: 300, ip: 0 },
      orange: { cash: 0, debt: 0, assets: 800, ip: 1 },
      yellow: { cash: 200, debt: 0, assets: 1500, ip: 1 },
      green:  { cash: 500, debt: 0, assets: 2500, ip: 2 } },
    optionB: { label: 'Real estate + retirement accounts',
      red:    { cash: -500, debt: 500, assets: 600, ip: 0 },
      orange: { cash: -200, debt: 0, assets: 1500, ip: 1 },
      yellow: { cash: 200, debt: 0, assets: 2500, ip: 2 },
      green:  { cash: 800, debt: 0, assets: 4000, ip: 3 } },
    optionC: { label: 'Start a business with your expertise',
      red:    { cash: -800, debt: 1500, assets: 0, ip: 2 },
      orange: { cash: -200, debt: 500, assets: 1000, ip: 2 },
      yellow: { cash: 500, debt: 0, assets: 2000, ip: 3 },
      green:  { cash: 2000, debt: 0, assets: 3500, ip: 5 } },
  },
  {
    phase: 7, title: 'Protect Wealth',
    description: 'Milestone 7: Fortify wealth protection — preserve and transfer what you\'ve built.',
    levels: [
      { color: 'red', description: 'No estate plan' },
      { color: 'orange', description: 'Estate plan needs updated' },
      { color: 'yellow', description: 'Some, but not all needed docs' },
      { color: 'green', description: 'Estate plan complete' },
    ],
    optionA: { label: 'Basic will + power of attorney',
      red:    { cash: -100, debt: 0, assets: 200, ip: 0 },
      orange: { cash: -100, debt: 0, assets: 600, ip: 1 },
      yellow: { cash: -100, debt: 0, assets: 1200, ip: 2 },
      green:  { cash: 0, debt: 0, assets: 2000, ip: 2 } },
    optionB: { label: 'Trust + tax-efficient asset protection',
      red:    { cash: -300, debt: 0, assets: 500, ip: 1 },
      orange: { cash: -200, debt: 0, assets: 1200, ip: 1 },
      yellow: { cash: 0, debt: 0, assets: 2000, ip: 2 },
      green:  { cash: 500, debt: 0, assets: 3500, ip: 3 } },
    optionC: { label: 'Full estate plan + legacy giving strategy',
      red:    { cash: -500, debt: 0, assets: 300, ip: 2 },
      orange: { cash: -300, debt: 0, assets: 800, ip: 3 },
      yellow: { cash: -100, debt: 0, assets: 1800, ip: 4 },
      green:  { cash: 200, debt: 0, assets: 3000, ip: 5 } },
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

    // Create MILESTONE_SCORES — tracks color/score per milestone
    await this.agent.createSheet('MILESTONE_SCORES');
    await this.agent.write({
      sheet: 'MILESTONE_SCORES',
      range: 'A1:D8',
      data: [
        ['Milestone', 'Title', 'Color', 'Score'],
        ...PHASE_EVENTS.map(e => [String(e.phase), e.title, '', '0']),
      ],
    });

    // Create PHASE_EVENTS with 7 event cards
    await this.agent.createSheet('PHASE_EVENTS');
    const eventRows: (string | number)[][] = [
      ['Phase', 'Title', 'Description', 'Levels', 'Option A', 'Option B', 'Option C'],
      ...PHASE_EVENTS.map(e => [
        e.phase,
        e.title,
        e.description,
        JSON.stringify(e.levels),
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
      range: 'A1:H1',
      data: [['Timestamp', 'Phase', 'Choice', 'Roll', 'Modified Roll', 'Color', 'Outcome', 'Stats Snapshot']],
    });
  }

  calculateStartingStats(
    learningTier: number,
    healthTier: number,
    savingsTier: 'L' | 'M' | 'H',
  ): PlayerStats {
    let cash = 500;
    let debt = 1000;
    let assets = 500;
    let monthlyIncome = 2000;
    let ip = 1;

    const ipMultiplier = learningTier === 1 ? 1.0 : learningTier === 2 ? 1.5 : 1.75;
    const learningIP = learningTier === 1 ? 0 : learningTier === 2 ? 1 : 2;
    const learningCost = learningTier === 1 ? 0 : learningTier === 2 ? 150 : 300;
    ip += learningIP;
    monthlyIncome -= learningCost;

    if (healthTier === 1) monthlyIncome -= 150;
    if (healthTier === 3) { monthlyIncome += 150; monthlyIncome -= 75; }

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

  async getMilestoneScores(): Promise<{ phase: number; title: string; color: string; score: number }[]> {
    const result = await this.agent.read({ sheet: 'MILESTONE_SCORES', range: 'A2:D8', format: 'array' });
    const rows = result.rows as unknown[][];
    return rows.map(row => ({
      phase: Number(row[0] ?? 0),
      title: String(row[1] ?? ''),
      color: String(row[2] ?? ''),
      score: Number(row[3] ?? 0),
    }));
  }

  async playPhase(choice: 'A' | 'B' | 'C'): Promise<{
    event: PhaseEvent;
    roll: number;
    modifiedRoll: number;
    color: MilestoneColor;
    milestoneScore: number;
    levelDescription: string;
    outcome: { cash: number; debt: number; assets: number; ip: number };
    newStats: PlayerStats;
  }> {
    const { config, stats } = await this.getStatus();

    if (stats.currentPhase > 7) {
      throw new Error('Game is over. Use "scoreboard" to see your final score.');
    }

    // Read event for current phase
    const phaseRow = stats.currentPhase + 1;
    const eventResult = await this.agent.read({
      sheet: 'PHASE_EVENTS',
      range: `A${phaseRow}:G${phaseRow}`,
      format: 'array',
    });
    const row = (eventResult.rows as unknown[][])[0];
    if (!row) throw new Error('Could not read phase event.');

    const event: PhaseEvent = {
      phase: Number(row[0]),
      title: String(row[1]),
      description: String(row[2]),
      levels: JSON.parse(String(row[3])),
      optionA: JSON.parse(String(row[4])),
      optionB: JSON.parse(String(row[5])),
      optionC: JSON.parse(String(row[6])),
    };

    const selectedOption = choice === 'A' ? event.optionA : choice === 'B' ? event.optionB : event.optionC;

    // Roll d6 with learning modifier
    const roll = Math.floor(Math.random() * 6) + 1;
    const modifiedRoll = this.applyLearningModifier(roll, config.learningTier);

    // Map roll to color: 1=red, 2-3=orange, 4-5=yellow, 6=green
    const color: MilestoneColor =
      modifiedRoll <= 1 ? 'red' :
      modifiedRoll <= 3 ? 'orange' :
      modifiedRoll <= 5 ? 'yellow' : 'green';

    const milestoneScore = MILESTONE_SCORES[color];
    const levelIdx = color === 'red' ? 0 : color === 'orange' ? 1 : color === 'yellow' ? 2 : 3;
    const levelDescription = event.levels[levelIdx].description;

    const outcome = selectedOption[color];
    const ipGain = Math.round(outcome.ip * stats.ipMultiplier);

    const newStats: PlayerStats = {
      cash: stats.cash + outcome.cash,
      debt: Math.max(0, stats.debt + outcome.debt),
      assets: Math.max(0, stats.assets + outcome.assets),
      monthlyIncome: stats.monthlyIncome,
      ip: stats.ip + ipGain,
      ipMultiplier: stats.ipMultiplier,
      currentPhase: stats.currentPhase + 1,
    };

    // Write updated GAME_STATE
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

    // Update MILESTONE_SCORES for this phase
    const msRow = stats.currentPhase + 1; // +1 for header
    await this.agent.write({
      sheet: 'MILESTONE_SCORES',
      range: `C${msRow}:D${msRow}`,
      data: [[color, String(milestoneScore)]],
    });

    // Log to GAME_LOG
    const logResult = await this.agent.read({ sheet: 'GAME_LOG', format: 'array' });
    const logRows = logResult.rows as unknown[][];
    const snapshot = `C:${newStats.cash} D:${newStats.debt} A:${newStats.assets} IP:${newStats.ip}`;
    const outcomeDesc = `${selectedOption.label} — cash:${outcome.cash} debt:${outcome.debt} assets:${outcome.assets} ip:${ipGain}`;

    logRows.push([
      new Date().toISOString(),
      String(stats.currentPhase),
      choice,
      String(roll),
      String(modifiedRoll),
      color.toUpperCase(),
      outcomeDesc,
      snapshot,
    ]);

    await this.agent.write({ sheet: 'GAME_LOG', range: 'A1', data: logRows });

    return { event, roll, modifiedRoll, color, milestoneScore, levelDescription, outcome: { ...outcome, ip: ipGain }, newStats };
  }

  applyLearningModifier(roll: number, learningTier: number): number {
    if (learningTier === 2) {
      return roll <= 2 ? 3 : roll;
    }
    if (learningTier === 3) {
      if (roll <= 2) return 4;
      if (roll >= 5) return 6;
      return roll;
    }
    return roll;
  }

  calculateFinalScore(milestones: { score: number }[]): number {
    const played = milestones.filter(m => m.score > 0);
    if (played.length === 0) return 0;
    return Math.round(played.reduce((sum, m) => sum + m.score, 0) / 7);
  }
}
