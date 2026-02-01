/**
 * PlanManager - Manages Plan markdown in the AGENTSCAPE sheet
 * Dynamically finds the PLAN.md column by scanning row 1
 * Implements PDR-v4.5 specification
 */

import type { Plan, PlanTask, PhaseInput, TaskStatus, Phase, PlanAnalysis, TaskUpdate } from '../types';
import type { SheetClient } from '../core/sheet-client';

const STATUS_MAP: Record<string, TaskStatus> = {
  ' ': 'todo',
  '/': 'doing',
  'x': 'done',
  '>': 'blocked',
  '!': 'review',
};

const STATUS_CHAR: Record<TaskStatus, string> = {
  'todo': ' ',
  'doing': '/',
  'done': 'x',
  'blocked': '>',
  'review': '!',
};

const TASK_REGEX = /^- \[(.)\] (\d+\.\d+(?:\.\d+)?)\s+(.+)$/;
const PHASE_REGEX = /^### Phase (\d+): (.+)$/;

export class PlanManager {
  private resolvedFileCell: string | null = null;
  private resolvedContentCell: string | null = null;

  constructor(
    private readonly sheetClient: SheetClient,
    private readonly spreadsheetId: string,
    private readonly planFileCell: string = 'AGENTSCAPE!C1',      // C1: filename "PLAN.md" (default, overridden by dynamic lookup)
    private readonly planContentCell: string = 'AGENTSCAPE!C6'    // C6: content (row 6 = Content/MD) (default, overridden by dynamic lookup)
  ) {}

  /**
   * Dynamically resolve the PLAN.md column by scanning row 1.
   * Falls back to constructor defaults if not found.
   */
  private async resolvePlanCells(): Promise<{ fileCell: string; contentCell: string }> {
    if (this.resolvedFileCell && this.resolvedContentCell) {
      return { fileCell: this.resolvedFileCell, contentCell: this.resolvedContentCell };
    }

    try {
      const client = await this.sheetClient.getClient();
      const response = await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: 'AGENTSCAPE!A1:Z1',
        });
      });

      const firstRow = response.data.values?.[0] || [];
      for (let col = 1; col < firstRow.length; col++) {
        if (String(firstRow[col] || '').trim() === 'PLAN.md') {
          const letter = this.columnIndexToLetter(col);
          this.resolvedFileCell = `AGENTSCAPE!${letter}1`;
          this.resolvedContentCell = `AGENTSCAPE!${letter}6`;
          return { fileCell: this.resolvedFileCell, contentCell: this.resolvedContentCell };
        }
      }
    } catch {
      // Fall through to defaults
    }

    this.resolvedFileCell = this.planFileCell;
    this.resolvedContentCell = this.planContentCell;
    return { fileCell: this.resolvedFileCell, contentCell: this.resolvedContentCell };
  }

  private columnIndexToLetter(index: number): string {
    let letter = '';
    let num = index;
    while (num >= 0) {
      letter = String.fromCharCode((num % 26) + 65) + letter;
      num = Math.floor(num / 26) - 1;
    }
    return letter;
  }

  /**
   * Get the current plan from AGENTSCAPE!C5 (column-based format)
   * First checks C1 for filename "PLAN.md", returns null if not initialized
   */
  async getPlan(): Promise<Plan | null> {
    const client = await this.sheetClient.getClient();
    const { fileCell, contentCell } = await this.resolvePlanCells();

    // Check for filename marker
    try {
      const fileResponse = await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: fileCell,
        });
      });
      const fileName = fileResponse.data.values?.[0]?.[0];
      if (fileName !== 'PLAN.md') {
        // Not initialized
        return null;
      }
    } catch (error) {
      // File cell doesn't exist
      return null;
    }

    // Read plan content
    const response = await this.sheetClient.executeWithRetry(async () => {
      return client.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: contentCell,
      });
    });

    const markdown = response.data.values?.[0]?.[0] as string | undefined;
    return markdown ? this.parsePlan(markdown) : null;
  }

  /**
   * Get the next task to execute (first todo task)
   */
  async getNextTask(): Promise<PlanTask | null> {
    const plan = await this.getPlan();
    if (!plan) return null;

    for (const phase of plan.phases) {
      const next = phase.tasks.find((t) => t.status === 'todo');
      if (next) return next;
    }
    return null;
  }

  /**
   * Get all tasks that need review
   */
  async getReviewTasks(): Promise<PlanTask[]> {
    const plan = await this.getPlan();
    if (!plan) return [];
    return plan.phases.flatMap((p) => p.tasks.filter((t) => t.status === 'review'));
  }

  /**
   * Create a new plan
   */
  async createPlan(title: string, goal: string, phases: PhaseInput[]): Promise<void> {
    const phasesMarkdown = phases
      .map((phase, i) => {
        const phaseNum = i + 1;
        const steps = phase.steps.map((s, j) => `- [ ] ${phaseNum}.${j + 1} ${s}`).join('\n');
        return `### Phase ${phaseNum}: ${phase.name}\n${steps}`;
      })
      .join('\n\n');

    const markdown = `# Plan: ${title}

Goal: ${goal}

## Analysis

- Spreadsheet: [spreadsheet name]
- Key sheets: [sheet names]
- Target ranges:
  - Read: [ranges to read]
  - Write: [ranges to write]
- Current state: [description]

## Questions for User

- [Any clarifying questions]

${phasesMarkdown}

## Notes

`;

    await this.writePlan(markdown);
  }

  /**
   * Update task status with a single method (PDR-v4.5)
   * Consolidates startTask, completeTask, blockTask, reviewTask
   * @param step - Step identifier (e.g., "1.1", "2.3")
   * @param update - Task update with status and optional reason/note
   */
  async updateTask(step: string, update: TaskUpdate): Promise<void> {
    switch (update.status) {
      case 'doing':
        await this.updateTaskStatus(step, 'doing');
        break;
      case 'done':
        await this.updateTaskStatus(step, 'done');
        break;
      case 'blocked':
        await this.updateTaskStatus(step, 'blocked', update.reason);
        break;
      case 'review':
        await this.updateTaskStatus(step, 'review', update.note);
        break;
    }
  }

  /**
   * Append a line to the Notes section of the plan
   * Creates Notes section if it doesn't exist
   * Useful for working memory (key: value pairs)
   */
  async appendNotes(line: string): Promise<void> {
    const plan = await this.getPlan();
    if (!plan) throw new Error('No plan found');

    // Find the Notes section or add it
    let markdown = plan.raw;
    const notesHeaderIndex = markdown.indexOf('## Notes');

    if (notesHeaderIndex === -1) {
      // No Notes section - add it at the end
      markdown = markdown.trimEnd() + '\n\n## Notes\n\n' + line;
    } else {
      // Notes section exists - append to it
      markdown = markdown.trimEnd() + '\n' + line;
    }

    await this.writePlan(markdown);
  }

  // Private methods

  /**
   * Parse plan markdown into structured Plan object
   */
  private parsePlan(markdown: string): Plan {
    const lines = markdown.split('\n');
    const phases: Phase[] = [];
    let title = '';
    let goal = '';
    let currentPhase: Phase | null = null;
    let inAnalysis = false;
    let inQuestions = false;
    let inNotes = false;
    const analysisLines: string[] = [];
    const questions: string[] = [];
    const noteLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      if (line.startsWith('# Plan:')) {
        title = line.replace('# Plan:', '').trim();
      } else if (line.startsWith('Goal:')) {
        goal = line.replace('Goal:', '').trim();
      } else if (line.startsWith('## Analysis')) {
        inAnalysis = true;
        inQuestions = false;
        inNotes = false;
      } else if (line.startsWith('## Questions')) {
        inQuestions = true;
        inAnalysis = false;
        inNotes = false;
      } else if (line.startsWith('## Notes')) {
        inNotes = true;
        inAnalysis = false;
        inQuestions = false;
      } else if (line.startsWith('### Phase')) {
        inAnalysis = false;
        inQuestions = false;
        inNotes = false;
        const match = line.match(PHASE_REGEX);
        if (match) {
          const phaseNum = match[1];
          const phaseName = match[2];
          if (phaseNum && phaseName) {
            currentPhase = { number: parseInt(phaseNum), name: phaseName, tasks: [] };
            phases.push(currentPhase);
          }
        }
      } else if (inAnalysis && line.startsWith('- ')) {
        analysisLines.push(line.slice(2));
      } else if (inQuestions && line.startsWith('- ')) {
        questions.push(line.slice(2));
      } else if (inNotes) {
        noteLines.push(line);
      } else {
        const match = line.match(TASK_REGEX);
        if (match && currentPhase) {
          const statusChar = match[1];
          const step = match[2];
          const content = match[3];
          if (statusChar !== undefined && step !== undefined && content !== undefined) {
            const completedMatch = content.match(/✅ (\d{4}-\d{2}-\d{2})/);
            const blockedMatch = content.match(/— (.+)$/);
            currentPhase.tasks.push({
              line: i,
              phase: currentPhase.number,
              step,
              status: STATUS_MAP[statusChar] || 'todo',
              title: content.replace(/✅ \d{4}-\d{2}-\d{2}/, '').replace(/— .+$/, '').trim(),
              completedDate: completedMatch?.[1],
              blockedReason: STATUS_MAP[statusChar] === 'blocked' ? blockedMatch?.[1] : undefined,
              reviewNote: STATUS_MAP[statusChar] === 'review' ? blockedMatch?.[1] : undefined,
            });
          }
        }
      }
    }

    // Parse analysis if present
    const analysis = analysisLines.length > 0 ? this.parseAnalysis(analysisLines) : undefined;

    return {
      title,
      goal,
      analysis,
      questions: questions.length > 0 ? questions : undefined,
      phases,
      notes: noteLines.join('\n').trim(),
      raw: markdown,
    };
  }

  /**
   * Parse analysis section into structured object
   */
  private parseAnalysis(lines: string[]): PlanAnalysis | undefined {
    const analysis: Partial<PlanAnalysis> = {
      spreadsheet: '',
      keySheets: [],
      targetRanges: { read: [], write: [] },
    };

    for (const line of lines) {
      if (line.startsWith('Spreadsheet:')) {
        analysis.spreadsheet = line.replace('Spreadsheet:', '').trim();
      } else if (line.startsWith('Key sheets:')) {
        analysis.keySheets = line
          .replace('Key sheets:', '')
          .split(',')
          .map((s) => s.trim());
      } else if (line.trim().startsWith('Read:')) {
        analysis.targetRanges?.read.push(line.replace(/.*Read:/, '').trim());
      } else if (line.trim().startsWith('Write:')) {
        analysis.targetRanges?.write.push(line.replace(/.*Write:/, '').trim());
      } else if (line.startsWith('Current state:')) {
        analysis.currentState = line.replace('Current state:', '').trim();
      }
    }

    return analysis.spreadsheet ? (analysis as PlanAnalysis) : undefined;
  }

  /**
   * Update task status in markdown
   */
  private updateTaskStatusInMarkdown(
    markdown: string,
    step: string,
    status: TaskStatus,
    annotation?: string
  ): string {
    const lines = markdown.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      const match = line.match(TASK_REGEX);
      if (match && match[2] === step) {
        let newLine = line.replace(/^- \[.\]/, `- [${STATUS_CHAR[status]}]`);

        // Remove existing annotation
        newLine = newLine.replace(/ — .+$/, '').replace(/ ✅ \d{4}-\d{2}-\d{2}/, '');

        // Add completion date
        if (status === 'done') {
          const today = new Date().toISOString().split('T')[0];
          newLine += ` ✅ ${today}`;
        }

        // Add blocked/review reason
        if ((status === 'blocked' || status === 'review') && annotation) {
          newLine += ` — ${annotation}`;
        }

        lines[i] = newLine;
        break;
      }
    }

    return lines.join('\n');
  }

  /**
   * Update task status and write back to sheet
   */
  private async updateTaskStatus(step: string, status: TaskStatus, annotation?: string): Promise<void> {
    const plan = await this.getPlan();
    if (!plan) throw new Error('No plan found');

    const updated = this.updateTaskStatusInMarkdown(plan.raw, step, status, annotation);
    await this.writePlan(updated);
  }

  /**
   * Write plan markdown to AGENTSCAPE!C5 (column-based format)
   */
  private async writePlan(markdown: string): Promise<void> {
    const client = await this.sheetClient.getClient();
    const { contentCell } = await this.resolvePlanCells();
    await this.sheetClient.executeWithRetry(async () => {
      return client.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: contentCell,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[markdown]],
        },
      });
    });
  }
}
