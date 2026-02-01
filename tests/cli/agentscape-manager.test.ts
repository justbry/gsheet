import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentScapeManager, AGENTSCAPE_SHEET } from '../../src/managers/agentscape-manager';
import { PlanManager } from '../../src/managers/plan-manager';
import type { SheetClient } from '../../src/core/sheet-client';
import type { AgentFile } from '../../src/types';
import { ValidationError } from '../../src/errors';

// Helper to build a full AgentFile with defaults
function makeFile(overrides: Partial<AgentFile> & { file: string; content: string }): AgentFile {
  return {
    desc: '',
    tags: '',
    path: `/opt/agentscape/${overrides.file}`,
    createdTs: '',
    updatedTs: '',
    status: 'active',
    dependsOn: '',
    contextLen: '',
    maxCtxLen: '',
    hash: '',
    ...overrides,
  };
}

// 12-row column-based header for column A
const COLUMN_A_LABELS = [
  'FILE', 'DESC', 'TAGS', 'Path', 'CreatedTS', 'UpdatedTS',
  'Status', 'DependsOn', 'ContextLen', 'MaxCtxLen', 'Hash', 'MDContent',
];

// Build a column-based sheet with labels + files
function buildColumnBasedSheet(files: Array<Record<string, string>>): unknown[][] {
  const rows: unknown[][] = COLUMN_A_LABELS.map(label => [label]);
  for (const file of files) {
    rows[0].push(file.file || '');
    rows[1].push(file.desc || '');
    rows[2].push(file.tags || '');
    rows[3].push(file.path || '');
    rows[4].push(file.createdTs || '');
    rows[5].push(file.updatedTs || '');
    rows[6].push(file.status || '');
    rows[7].push(file.dependsOn || '');
    rows[8].push(file.contextLen || '');
    rows[9].push(file.maxCtxLen || '');
    rows[10].push(file.hash || '');
    rows[11].push(file.content || '');
  }
  return rows;
}

// 12-column row-based header
const ROW_BASED_HEADER = [
  'FILE', 'DESC', 'TAGS', 'Path', 'CreatedTS', 'UpdatedTS',
  'Status', 'DependsOn', 'ContextLen', 'MaxCtxLen', 'Hash', 'MDContent',
];

function createMockSheetClient(mockResponses: Record<string, unknown> = {}) {
  const mockGet = vi.fn().mockImplementation((params: { spreadsheetId?: string; range?: string }) => {
    if (params.range) {
      const range = params.range;
      if (mockResponses[range]) {
        return Promise.resolve(mockResponses[range]);
      }
    }
    return Promise.resolve({ data: { values: [] } });
  });

  const mockUpdate = vi.fn().mockResolvedValue({ data: {} });
  const mockAppend = vi.fn().mockResolvedValue({ data: {} });
  const mockBatchUpdate = vi.fn().mockResolvedValue({ data: {} });

  const mockClient = {
    spreadsheets: {
      values: {
        get: mockGet,
        update: mockUpdate,
        append: mockAppend,
      },
      get: vi.fn().mockResolvedValue({
        data: {
          sheets: [
            { properties: { title: 'Sheet1', sheetId: 0 } },
            { properties: { title: AGENTSCAPE_SHEET, sheetId: 1 } },
          ],
        },
      }),
      batchUpdate: mockBatchUpdate,
    },
  };

  const sheetClient = {
    getClient: vi.fn().mockResolvedValue(mockClient),
    executeWithRetry: vi.fn().mockImplementation((fn) => fn()),
    spreadsheetId: 'test-spreadsheet-id',
  } as unknown as SheetClient;

  return { sheetClient, mockGet, mockUpdate, mockAppend, mockBatchUpdate };
}

function createMockPlanManager() {
  return {
    getPlan: vi.fn().mockResolvedValue({
      title: 'Test Plan',
      goal: 'Test Goal',
      phases: [],
      notes: '',
      raw: '# Plan: Test Plan\n\nGoal: Test Goal',
    }),
  } as unknown as PlanManager;
}

describe('AgentScapeManager', () => {
  describe('listFiles()', () => {
    it('should return empty array when sheet is empty', async () => {
      const { sheetClient } = createMockSheetClient({
        [AGENTSCAPE_SHEET]: { data: { values: [ROW_BASED_HEADER] } },
      });
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      const files = await manager.listFiles();
      expect(files).toEqual([]);
    });

    it('should return empty array when sheet does not exist', async () => {
      const { sheetClient, mockGet } = createMockSheetClient();
      mockGet.mockRejectedValue(new Error('Unable to parse range'));

      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      const files = await manager.listFiles();
      expect(files).toEqual([]);
    });

    it('should parse row-based files with 12 columns', async () => {
      const { sheetClient } = createMockSheetClient({
        [AGENTSCAPE_SHEET]: {
          data: {
            values: [
              ROW_BASED_HEADER,
              ['NOTES.md', 'notes', 'tag1,tag2', '/opt/agentscape/NOTES.md', '2026-01-15T00:00:00Z', '2026-01-20T00:00:00Z', 'active', '', '250', '', 'abc123', '# Notes\n\nContent here'],
              ['RESEARCH.md', 'research', 'research', '/opt/agentscape/RESEARCH.md', '2026-01-16T00:00:00Z', '2026-01-21T00:00:00Z', 'draft', 'NOTES.md', '500', '1000', 'def456', '# Research\n\nMore content'],
            ],
          },
        },
      });
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      const files = await manager.listFiles();

      expect(files).toHaveLength(2);
      expect(files[0]).toEqual({
        file: 'NOTES.md',
        desc: 'notes',
        tags: 'tag1,tag2',
        path: '/opt/agentscape/NOTES.md',
        createdTs: '2026-01-15T00:00:00Z',
        updatedTs: '2026-01-20T00:00:00Z',
        status: 'active',
        dependsOn: '',
        contextLen: '250',
        maxCtxLen: '',
        hash: 'abc123',
        content: '# Notes\n\nContent here',
      });
      expect(files[1]?.status).toBe('draft');
      expect(files[1]?.dependsOn).toBe('NOTES.md');
    });

    it('should parse column-based files with 12 rows', async () => {
      const sheetData = buildColumnBasedSheet([
        { file: 'AGENTS.md', desc: 'agent', tags: 'system', path: '/opt/agentscape/AGENTS.md', status: 'active', content: '# Agent' },
        { file: 'PLAN.md', desc: 'plan', tags: 'plan', path: '/opt/agentscape/PLAN.md', status: 'active', dependsOn: 'AGENTS.md', content: '# Plan' },
      ]);

      const { sheetClient } = createMockSheetClient({
        [AGENTSCAPE_SHEET]: { data: { values: sheetData } },
      });
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      const files = await manager.listFiles();

      expect(files).toHaveLength(2);
      expect(files[0]?.file).toBe('AGENTS.md');
      expect(files[0]?.status).toBe('active');
      expect(files[1]?.file).toBe('PLAN.md');
      expect(files[1]?.dependsOn).toBe('AGENTS.md');
    });
  });

  describe('readFile()', () => {
    it('should throw ValidationError for empty filename', async () => {
      const { sheetClient } = createMockSheetClient();
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      await expect(manager.readFile('')).rejects.toThrow(ValidationError);
    });

    it('should return null for non-existent file', async () => {
      const { sheetClient } = createMockSheetClient({
        [AGENTSCAPE_SHEET]: {
          data: {
            values: [
              ROW_BASED_HEADER,
              ['NOTES.md', 'notes', '', '', '', '', 'active', '', '', '', '', '# Notes'],
            ],
          },
        },
      });
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      const file = await manager.readFile('NONEXISTENT.md');
      expect(file).toBeNull();
    });

    it('should return file when it exists with all 12 fields', async () => {
      const { sheetClient } = createMockSheetClient({
        [AGENTSCAPE_SHEET]: {
          data: {
            values: [
              ROW_BASED_HEADER,
              ['NOTES.md', 'notes', 'tag1', '/opt/agentscape/NOTES.md', '2026-01-15T00:00:00Z', '2026-01-20T00:00:00Z', 'active', '', '250', '', 'abc123', '# Notes\n\nContent'],
            ],
          },
        },
      });
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      const file = await manager.readFile('NOTES.md');

      expect(file).toEqual({
        file: 'NOTES.md',
        desc: 'notes',
        tags: 'tag1',
        path: '/opt/agentscape/NOTES.md',
        createdTs: '2026-01-15T00:00:00Z',
        updatedTs: '2026-01-20T00:00:00Z',
        status: 'active',
        dependsOn: '',
        contextLen: '250',
        maxCtxLen: '',
        hash: 'abc123',
        content: '# Notes\n\nContent',
      });
    });

    it('should delegate PLAN.md to PlanManager', async () => {
      const { sheetClient } = createMockSheetClient();
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      const file = await manager.readFile('PLAN.md');

      expect(planManager.getPlan).toHaveBeenCalled();
      expect(file).toMatchObject({
        file: 'PLAN.md',
        desc: 'Active execution plan with phased tasks and progress tracking.',
        status: 'active',
        dependsOn: 'AGENTS.md',
        content: '# Plan: Test Plan\n\nGoal: Test Goal',
      });
    });

    it('should return null when PLAN.md does not exist', async () => {
      const { sheetClient } = createMockSheetClient();
      const planManager = {
        getPlan: vi.fn().mockResolvedValue(null),
      } as unknown as PlanManager;
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      const file = await manager.readFile('PLAN.md');
      expect(file).toBeNull();
    });
  });

  describe('writeFile()', () => {
    it('should throw ValidationError for empty filename', async () => {
      const { sheetClient } = createMockSheetClient();
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      const file = makeFile({ file: '', content: '' });

      await expect(manager.writeFile(file)).rejects.toThrow(ValidationError);
    });

    it('should append new file in row-based format', async () => {
      const { sheetClient, mockAppend } = createMockSheetClient({
        [AGENTSCAPE_SHEET]: {
          data: {
            values: [ROW_BASED_HEADER],
          },
        },
      });
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      const file = makeFile({
        file: 'NEW.md',
        desc: 'new',
        tags: 'tag1',
        content: '# New File',
      });

      await manager.writeFile(file);

      expect(mockAppend).toHaveBeenCalledWith(
        expect.objectContaining({
          range: `${AGENTSCAPE_SHEET}!A:L`,
        })
      );
    });

    it('should update existing file in row-based format', async () => {
      const { sheetClient, mockUpdate } = createMockSheetClient({
        [AGENTSCAPE_SHEET]: {
          data: {
            values: [
              ROW_BASED_HEADER,
              ['EXISTING.md', 'old', 'old-tag', '/opt/agentscape/EXISTING.md', '2026-01-15T00:00:00Z', '2026-01-15T00:00:00Z', 'active', '', '', '', '', '# Old Content'],
            ],
          },
        },
      });
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      const file = makeFile({
        file: 'EXISTING.md',
        desc: 'updated',
        tags: 'new-tag',
        content: '# Updated Content',
      });

      await manager.writeFile(file);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          range: `${AGENTSCAPE_SHEET}!A2:L2`,
        })
      );
    });

    it('should delegate PLAN.md content write to row 12', async () => {
      const { sheetClient, mockUpdate } = createMockSheetClient({
        'AGENTSCAPE!A1:Z1': { data: { values: [['FILE', 'AGENTS.md', 'PLAN.md']] } },
      });
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      const file = makeFile({
        file: 'PLAN.md',
        desc: 'plan',
        content: '# Plan: New Plan\n\nGoal: New Goal',
      });

      await manager.writeFile(file);

      // Should write content to row 12 (PLAN.md is in column C)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          range: 'AGENTSCAPE!C12',
        })
      );
      // Should also update UpdatedTS at row 6
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          range: 'AGENTSCAPE!C6',
        })
      );
    });

    it('should auto-set path and status defaults', async () => {
      const { sheetClient, mockAppend } = createMockSheetClient({
        [AGENTSCAPE_SHEET]: {
          data: {
            values: [ROW_BASED_HEADER],
          },
        },
      });
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      const file = makeFile({
        file: 'TEST.md',
        path: '',
        status: '',
        content: '# Test',
      });

      const result = await manager.writeFile(file);

      expect(result.path).toBe('/opt/agentscape/TEST.md');
      expect(result.status).toBe('active');
      expect(result.updatedTs).toBeTruthy();
    });
  });

  describe('deleteFile()', () => {
    it('should throw ValidationError for empty filename', async () => {
      const { sheetClient } = createMockSheetClient();
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      await expect(manager.deleteFile('')).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when trying to delete PLAN.md', async () => {
      const { sheetClient } = createMockSheetClient();
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      await expect(manager.deleteFile('PLAN.md')).rejects.toThrow(ValidationError);
      await expect(manager.deleteFile('PLAN.md')).rejects.toThrow('Cannot delete PLAN.md');
    });

    it('should return false for non-existent file', async () => {
      const { sheetClient } = createMockSheetClient({
        [AGENTSCAPE_SHEET]: {
          data: {
            values: [ROW_BASED_HEADER],
          },
        },
      });
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      const deleted = await manager.deleteFile('NONEXISTENT.md');
      expect(deleted).toBe(false);
    });

    it('should delete existing file', async () => {
      const { sheetClient, mockBatchUpdate } = createMockSheetClient({
        [AGENTSCAPE_SHEET]: {
          data: {
            values: [
              ROW_BASED_HEADER,
              ['DELETE_ME.md', 'delete', '', '', '', '', 'active', '', '', '', '', '# Delete'],
            ],
          },
        },
      });
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      const deleted = await manager.deleteFile('DELETE_ME.md');

      expect(deleted).toBe(true);
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            requests: expect.arrayContaining([
              expect.objectContaining({
                deleteDimension: expect.objectContaining({
                  range: expect.objectContaining({
                    sheetId: 1,
                    dimension: 'ROWS',
                  }),
                }),
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('initAgentScape()', () => {
    it('should create AGENTSCAPE sheet if it does not exist', async () => {
      const { sheetClient, mockBatchUpdate, mockUpdate } = createMockSheetClient();

      const mockClientObj = await sheetClient.getClient();
      (mockClientObj.spreadsheets.get as any).mockResolvedValue({
        data: {
          sheets: [{ properties: { title: 'Sheet1', sheetId: 0 } }],
        },
      } as any);

      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      await manager.initAgentScape();

      // Should create the sheet
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            requests: expect.arrayContaining([
              expect.objectContaining({
                addSheet: expect.objectContaining({
                  properties: expect.objectContaining({
                    title: AGENTSCAPE_SHEET,
                  }),
                }),
              }),
            ]),
          }),
        })
      );

      // Should write 12 column labels
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          range: `${AGENTSCAPE_SHEET}!A1:A12`,
          requestBody: expect.objectContaining({
            values: COLUMN_A_LABELS.map(l => [l]),
          }),
        })
      );

      // Should write AGENTS.md file in column B
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          range: `${AGENTSCAPE_SHEET}!B1:B12`,
        })
      );

      // Should write PLAN.md file in column C
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          range: `${AGENTSCAPE_SHEET}!C1:C12`,
        })
      );
    });

    it('should be idempotent when sheet already exists', async () => {
      const { sheetClient, mockBatchUpdate } = createMockSheetClient();
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      await manager.initAgentScape();

      // Should not create sheet (it already exists)
      expect(mockBatchUpdate).not.toHaveBeenCalled();
    });
  });
});
