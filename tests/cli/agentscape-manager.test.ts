import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentScapeManager, AGENTSCAPE_SHEET } from '../../src/managers/agentscape-manager';
import { PlanManager } from '../../src/managers/plan-manager';
import type { SheetClient } from '../../src/core/sheet-client';
import type { AgentFile } from '../../src/types';
import { ValidationError } from '../../src/errors';

// Create a mock SheetClient
function createMockSheetClient(mockResponses: Record<string, unknown> = {}) {
  const mockGet = vi.fn().mockImplementation((params: { spreadsheetId?: string; range?: string; ranges?: string[] }) => {
    if (params.range) {
      const range = params.range;
      if (mockResponses[range]) {
        return Promise.resolve(mockResponses[range]);
      }
    }
    // Default empty response
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

// Create a mock PlanManager
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
        [AGENTSCAPE_SHEET]: { data: { values: [['FILE', 'DESC', 'TAGS', 'DATES', 'BUDGET', 'Content/MD']] } },
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

    it('should parse and return files', async () => {
      const { sheetClient } = createMockSheetClient({
        [AGENTSCAPE_SHEET]: {
          data: {
            values: [
              ['FILE', 'DESC', 'TAGS', 'DATES', 'BUDGET', 'Content/MD'],
              ['NOTES.md', 'notes', 'tag1,tag2', '2025-01-15', '1K', '# Notes\n\nContent here'],
              ['RESEARCH.md', 'research', 'research', '2025-01-16', '2K', '# Research\n\nMore content'],
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
        dates: '2025-01-15',
        budget: '1K',
        content: '# Notes\n\nContent here',
      });
      expect(files[1]).toEqual({
        file: 'RESEARCH.md',
        desc: 'research',
        tags: 'research',
        dates: '2025-01-16',
        budget: '2K',
        content: '# Research\n\nMore content',
      });
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
              ['FILE', 'DESC', 'TAGS', 'DATES', 'BUDGET', 'Content/MD'],
              ['NOTES.md', 'notes', '', '', '', '# Notes'],
            ],
          },
        },
      });
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      const file = await manager.readFile('NONEXISTENT.md');

      expect(file).toBeNull();
    });

    it('should return file when it exists', async () => {
      const { sheetClient } = createMockSheetClient({
        [AGENTSCAPE_SHEET]: {
          data: {
            values: [
              ['FILE', 'DESC', 'TAGS', 'DATES', 'BUDGET', 'Content/MD'],
              ['NOTES.md', 'notes', 'tag1', '2025-01-15', '1K', '# Notes\n\nContent'],
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
        dates: '2025-01-15',
        budget: '1K',
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
        desc: 'plan',
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

      const file: AgentFile = { file: '', desc: '', tags: '', dates: '', content: '' };

      await expect(manager.writeFile(file)).rejects.toThrow(ValidationError);
    });

    it('should append new file when it does not exist', async () => {
      const { sheetClient, mockAppend } = createMockSheetClient({
        [AGENTSCAPE_SHEET]: {
          data: {
            values: [['FILE', 'DESC', 'TAGS', 'DATES', 'BUDGET', 'Content/MD']],
          },
        },
      });
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      const file: AgentFile = {
        file: 'NEW.md',
        desc: 'new',
        tags: 'tag1',
        dates: '2025-01-20',
        content: '# New File',
      };

      await manager.writeFile(file);

      expect(mockAppend).toHaveBeenCalledWith(
        expect.objectContaining({
          range: `${AGENTSCAPE_SHEET}!A:F`,
        })
      );
    });

    it('should update existing file', async () => {
      const { sheetClient, mockUpdate } = createMockSheetClient({
        [AGENTSCAPE_SHEET]: {
          data: {
            values: [
              ['FILE', 'DESC', 'TAGS', 'DATES', 'BUDGET', 'Content/MD'],
              ['EXISTING.md', 'old', 'old-tag', '2025-01-15', '', '# Old Content'],
            ],
          },
        },
      });
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      const file: AgentFile = {
        file: 'EXISTING.md',
        desc: 'updated',
        tags: 'new-tag',
        dates: '2025-01-20',
        content: '# Updated Content',
      };

      await manager.writeFile(file);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          range: `${AGENTSCAPE_SHEET}!A2:F2`,
        })
      );
    });

    it('should delegate PLAN.md to PlanManager', async () => {
      const { sheetClient, mockUpdate } = createMockSheetClient({
        'AGENTSCAPE!A1:Z1': { data: { values: [['FILE', 'AGENTS.md', 'PLAN.md']] } },
      });
      const planManager = createMockPlanManager();
      const manager = new AgentScapeManager(sheetClient, 'test-id', planManager);

      const file: AgentFile = {
        file: 'PLAN.md',
        desc: 'plan',
        tags: '',
        dates: '',
        content: '# Plan: New Plan\n\nGoal: New Goal',
      };

      await manager.writeFile(file);

      // Should write to AGENTSCAPE!C6 (PLAN.md is in column C)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          range: 'AGENTSCAPE!C6',
        })
      );
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
            values: [['FILE', 'DESC', 'TAGS', 'DATES', 'BUDGET', 'Content/MD']],
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
              ['FILE', 'DESC', 'TAGS', 'DATES', 'BUDGET', 'Content/MD'],
              ['DELETE_ME.md', 'delete', '', '', '', '# Delete'],
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

      // Mock that sheet doesn't exist
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

      // Should write column labels (column-based format)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          range: `${AGENTSCAPE_SHEET}!A1:A6`,
          requestBody: expect.objectContaining({
            values: [['FILE'], ['DESC'], ['TAGS'], ['DATES'], ['BUDGET'], ['Content/MD']],
          }),
        })
      );

      // Should write AGENTS.md file
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          range: `${AGENTSCAPE_SHEET}!B1:B6`,
        })
      );

      // Should write PLAN.md file
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          range: `${AGENTSCAPE_SHEET}!C1:C6`,
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
