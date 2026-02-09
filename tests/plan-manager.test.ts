import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanManager } from '../src/core/plan-manager';
import type { SheetClient } from '../src/core/sheet-client';
import type { Plan, PhaseInput, TaskUpdate } from '../src/types';

// Create a mock SheetClient
function createMockSheetClient(mockResponses: Record<string, unknown> = {}) {
  const mockGet = vi.fn().mockImplementation((params: { range: string }) => {
    const range = params.range;
    if (mockResponses[range]) {
      return Promise.resolve(mockResponses[range]);
    }
    // Default empty response
    return Promise.resolve({ data: { values: [] } });
  });

  const mockUpdate = vi.fn().mockResolvedValue({ data: {} });

  const mockClient = {
    spreadsheets: {
      values: {
        get: mockGet,
        update: mockUpdate,
      },
    },
  };

  const sheetClient = {
    getClient: vi.fn().mockResolvedValue(mockClient),
    executeWithRetry: vi.fn().mockImplementation((fn) => fn()),
    spreadsheetId: 'test-spreadsheet-id',
  } as unknown as SheetClient;

  return { sheetClient, mockGet, mockUpdate };
}

// Sample plan markdown
// Note: Target ranges use a nested list format with "  - Read:" prefix
// The parser expects lines like "- Target ranges:" then "  Read:" or "  Write:" on subsequent lines
const samplePlanMarkdown = `# Plan: Test Plan

Goal: Test the plan system

## Analysis

- Spreadsheet: Test Sheet
- Key sheets: Sheet1, Sheet2
- Target ranges:
- Read: A1:B10
- Write: C1:D10
- Current state: Initial setup

## Questions for User

- What format should the output be?

### Phase 1: Setup

- [ ] 1.1 Initialize project
- [/] 1.2 Configure settings
- [x] 1.3 Install dependencies ✅ 2025-01-15

### Phase 2: Implementation

- [ ] 2.1 Create main module
- [>] 2.2 Add error handling — Waiting for requirements
- [!] 2.3 Write tests — Needs code review

## Notes

test_key: test_value
`;

describe('PlanManager', () => {
  describe('getPlan()', () => {
    it('should return null if marker is not set', async () => {
      const { sheetClient, mockGet } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['Wrong Marker']] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      const plan = await manager.getPlan();

      expect(plan).toBeNull();
    });

    it('should return null if marker cell is empty', async () => {
      const { sheetClient, mockGet } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      const plan = await manager.getPlan();

      expect(plan).toBeNull();
    });

    it('should parse plan when marker is correct', async () => {
      const { sheetClient } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [[samplePlanMarkdown]] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      const plan = await manager.getPlan();

      expect(plan).not.toBeNull();
      expect(plan?.title).toBe('Test Plan');
      expect(plan?.goal).toBe('Test the plan system');
      expect(plan?.phases).toHaveLength(2);
    });

    it('should parse analysis section correctly', async () => {
      const { sheetClient } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [[samplePlanMarkdown]] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      const plan = await manager.getPlan();

      expect(plan?.analysis).toBeDefined();
      expect(plan?.analysis?.spreadsheet).toBe('Test Sheet');
      expect(plan?.analysis?.keySheets).toEqual(['Sheet1', 'Sheet2']);
      expect(plan?.analysis?.targetRanges?.read).toContain('A1:B10');
      expect(plan?.analysis?.targetRanges?.write).toContain('C1:D10');
    });

    it('should parse questions section correctly', async () => {
      const { sheetClient } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [[samplePlanMarkdown]] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      const plan = await manager.getPlan();

      expect(plan?.questions).toBeDefined();
      expect(plan?.questions).toContain('What format should the output be?');
    });

    it('should parse task statuses correctly', async () => {
      const { sheetClient } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [[samplePlanMarkdown]] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      const plan = await manager.getPlan();

      const phase1 = plan?.phases[0];
      expect(phase1?.tasks[0]?.status).toBe('todo');
      expect(phase1?.tasks[1]?.status).toBe('doing');
      expect(phase1?.tasks[2]?.status).toBe('done');
      expect(phase1?.tasks[2]?.completedDate).toBe('2025-01-15');

      const phase2 = plan?.phases[1];
      expect(phase2?.tasks[0]?.status).toBe('todo');
      expect(phase2?.tasks[1]?.status).toBe('blocked');
      expect(phase2?.tasks[1]?.blockedReason).toBe('Waiting for requirements');
      expect(phase2?.tasks[2]?.status).toBe('review');
      expect(phase2?.tasks[2]?.reviewNote).toBe('Needs code review');
    });

    it('should parse notes section correctly', async () => {
      const { sheetClient } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [[samplePlanMarkdown]] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      const plan = await manager.getPlan();

      expect(plan?.notes).toContain('test_key: test_value');
    });

    it('should return null if plan content is empty', async () => {
      const { sheetClient } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [['']] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      const plan = await manager.getPlan();

      expect(plan).toBeNull();
    });
  });

  describe('getNextTask()', () => {
    it('should return first todo task', async () => {
      const { sheetClient } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [[samplePlanMarkdown]] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      const task = await manager.getNextTask();

      expect(task).not.toBeNull();
      expect(task?.step).toBe('1.1');
      expect(task?.status).toBe('todo');
      expect(task?.title).toBe('Initialize project');
    });

    it('should return null when no plan exists', async () => {
      const { sheetClient } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      const task = await manager.getNextTask();

      expect(task).toBeNull();
    });

    it('should return null when all tasks are done', async () => {
      const allDoneMarkdown = `# Plan: Done Plan

Goal: Everything done

### Phase 1: Done

- [x] 1.1 Task 1 ✅ 2025-01-15
- [x] 1.2 Task 2 ✅ 2025-01-15

## Notes
`;

      const { sheetClient } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [[allDoneMarkdown]] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      const task = await manager.getNextTask();

      expect(task).toBeNull();
    });

    it('should skip blocked and review tasks', async () => {
      const blockedFirstMarkdown = `# Plan: Blocked First

Goal: Test skipping

### Phase 1: Test

- [>] 1.1 Blocked task — Waiting
- [!] 1.2 Review task — Needs review
- [ ] 1.3 Next task

## Notes
`;

      const { sheetClient } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [[blockedFirstMarkdown]] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      const task = await manager.getNextTask();

      expect(task?.step).toBe('1.3');
    });
  });

  describe('getReviewTasks()', () => {
    it('should return tasks with review status', async () => {
      const { sheetClient } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [[samplePlanMarkdown]] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      const tasks = await manager.getReviewTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0]?.step).toBe('2.3');
      expect(tasks[0]?.status).toBe('review');
    });

    it('should return empty array when no plan exists', async () => {
      const { sheetClient } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      const tasks = await manager.getReviewTasks();

      expect(tasks).toEqual([]);
    });

    it('should return empty array when no review tasks exist', async () => {
      const noReviewMarkdown = `# Plan: No Review

Goal: Test no review

### Phase 1: Test

- [ ] 1.1 Task 1
- [x] 1.2 Task 2 ✅ 2025-01-15

## Notes
`;

      const { sheetClient } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [[noReviewMarkdown]] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      const tasks = await manager.getReviewTasks();

      expect(tasks).toEqual([]);
    });
  });

  describe('createPlan()', () => {
    it('should create a new plan with title, goal, and phases', async () => {
      const { sheetClient, mockUpdate } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');

      const phases: PhaseInput[] = [
        { name: 'Setup', steps: ['Install deps', 'Configure project'] },
        { name: 'Build', steps: ['Write code', 'Run tests'] },
      ];

      await manager.createPlan('New Project', 'Build a great app', phases);

      expect(mockUpdate).toHaveBeenCalled();
      const updateCall = mockUpdate.mock.calls[0]?.[0];
      expect(updateCall?.range).toBe('AGENTSCAPE!C12');

      const writtenContent = updateCall?.requestBody?.values?.[0]?.[0] as string;
      expect(writtenContent).toContain('# Plan: New Project');
      expect(writtenContent).toContain('Goal: Build a great app');
      expect(writtenContent).toContain('### Phase 1: Setup');
      expect(writtenContent).toContain('- [ ] 1.1 Install deps');
      expect(writtenContent).toContain('- [ ] 1.2 Configure project');
      expect(writtenContent).toContain('### Phase 2: Build');
      expect(writtenContent).toContain('- [ ] 2.1 Write code');
      expect(writtenContent).toContain('- [ ] 2.2 Run tests');
    });

    it('should include analysis template in new plan', async () => {
      const { sheetClient, mockUpdate } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      await manager.createPlan('Test', 'Goal', [{ name: 'Phase 1', steps: ['Step 1'] }]);

      const writtenContent = mockUpdate.mock.calls[0]?.[0]?.requestBody?.values?.[0]?.[0] as string;
      expect(writtenContent).toContain('## Analysis');
      expect(writtenContent).toContain('## Questions for User');
      expect(writtenContent).toContain('## Notes');
    });
  });

  describe('updateTask()', () => {
    it('should update task to doing status', async () => {
      const { sheetClient, mockUpdate } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [[samplePlanMarkdown]] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      await manager.updateTask('1.1', { status: 'doing' });

      expect(mockUpdate).toHaveBeenCalled();
      const writtenContent = mockUpdate.mock.calls[0]?.[0]?.requestBody?.values?.[0]?.[0] as string;
      expect(writtenContent).toContain('- [/] 1.1 Initialize project');
    });

    it('should update task to done status with completion date', async () => {
      const { sheetClient, mockUpdate } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [[samplePlanMarkdown]] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      await manager.updateTask('1.1', { status: 'done' });

      expect(mockUpdate).toHaveBeenCalled();
      const writtenContent = mockUpdate.mock.calls[0]?.[0]?.requestBody?.values?.[0]?.[0] as string;
      // Should contain done marker and date
      expect(writtenContent).toMatch(/- \[x\] 1\.1 Initialize project ✅ \d{4}-\d{2}-\d{2}/);
    });

    it('should update task to blocked status with reason', async () => {
      const { sheetClient, mockUpdate } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [[samplePlanMarkdown]] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      await manager.updateTask('1.1', { status: 'blocked', reason: 'Need API key' });

      expect(mockUpdate).toHaveBeenCalled();
      const writtenContent = mockUpdate.mock.calls[0]?.[0]?.requestBody?.values?.[0]?.[0] as string;
      expect(writtenContent).toContain('- [>] 1.1 Initialize project — Need API key');
    });

    it('should update task to review status with note', async () => {
      const { sheetClient, mockUpdate } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [[samplePlanMarkdown]] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      await manager.updateTask('1.1', { status: 'review', note: 'Please review code' });

      expect(mockUpdate).toHaveBeenCalled();
      const writtenContent = mockUpdate.mock.calls[0]?.[0]?.requestBody?.values?.[0]?.[0] as string;
      expect(writtenContent).toContain('- [!] 1.1 Initialize project — Please review code');
    });

    it('should throw error when no plan exists', async () => {
      const { sheetClient } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      await expect(manager.updateTask('1.1', { status: 'doing' })).rejects.toThrow('No plan found');
    });
  });

  describe('appendNotes()', () => {
    it('should append line to existing notes section', async () => {
      const { sheetClient, mockUpdate } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [[samplePlanMarkdown]] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      await manager.appendNotes('new_key: new_value');

      expect(mockUpdate).toHaveBeenCalled();
      const writtenContent = mockUpdate.mock.calls[0]?.[0]?.requestBody?.values?.[0]?.[0] as string;
      expect(writtenContent).toContain('test_key: test_value');
      expect(writtenContent).toContain('new_key: new_value');
    });

    it('should create notes section if it does not exist', async () => {
      const noNotesMarkdown = `# Plan: No Notes

Goal: Test creating notes

### Phase 1: Test

- [ ] 1.1 Task 1
`;

      const { sheetClient, mockUpdate } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [[noNotesMarkdown]] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      await manager.appendNotes('first_note: value');

      expect(mockUpdate).toHaveBeenCalled();
      const writtenContent = mockUpdate.mock.calls[0]?.[0]?.requestBody?.values?.[0]?.[0] as string;
      expect(writtenContent).toContain('## Notes');
      expect(writtenContent).toContain('first_note: value');
    });

    it('should throw error when no plan exists', async () => {
      const { sheetClient } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      await expect(manager.appendNotes('key: value')).rejects.toThrow('No plan found');
    });
  });

  describe('parsePlan edge cases', () => {
    it('should handle plan without analysis section', async () => {
      const noAnalysisMarkdown = `# Plan: Simple Plan

Goal: Simple goal

### Phase 1: Work

- [ ] 1.1 Do stuff

## Notes
`;

      const { sheetClient } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [[noAnalysisMarkdown]] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      const plan = await manager.getPlan();

      expect(plan?.title).toBe('Simple Plan');
      expect(plan?.analysis).toBeUndefined();
    });

    it('should handle plan without questions section', async () => {
      const noQuestionsMarkdown = `# Plan: No Questions Plan

Goal: Goal here

### Phase 1: Work

- [ ] 1.1 Task

## Notes
`;

      const { sheetClient } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [[noQuestionsMarkdown]] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      const plan = await manager.getPlan();

      expect(plan?.questions).toBeUndefined();
    });

    it('should handle tasks with sub-steps (1.1.1 format)', async () => {
      const subStepMarkdown = `# Plan: SubStep Plan

Goal: Test substeps

### Phase 1: Work

- [ ] 1.1 Main task
- [ ] 1.1.1 Sub task
- [ ] 1.2 Another task

## Notes
`;

      const { sheetClient } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [[subStepMarkdown]] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      const plan = await manager.getPlan();

      expect(plan?.phases[0]?.tasks).toHaveLength(3);
      expect(plan?.phases[0]?.tasks[1]?.step).toBe('1.1.1');
    });

    it('should preserve raw markdown', async () => {
      const { sheetClient } = createMockSheetClient({
        'AGENTSCAPE!C1': { data: { values: [['PLAN.md']] } },
        'AGENTSCAPE!C12': { data: { values: [[samplePlanMarkdown]] } },
      });

      const manager = new PlanManager(sheetClient, 'test-spreadsheet-id');
      const plan = await manager.getPlan();

      expect(plan?.raw).toBe(samplePlanMarkdown);
    });
  });
});
