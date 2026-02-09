import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SheetAgent } from '../src/core/agent';
import { ValidationError } from '../src/errors';
import { mockCredentials } from './helpers';

// Mock googleapis
vi.mock('googleapis', () => {
  const mockGet = vi.fn().mockResolvedValue({
    data: {
      values: [
        ['name', 'email', 'age'],
        ['Alice', 'alice@example.com', 30],
        ['Bob', 'bob@example.com', 25],
      ],
      range: 'Sheet1!A1:C3',
    },
  });

  return {
    google: {
      auth: {
        GoogleAuth: vi.fn().mockImplementation(() => ({})),
      },
      sheets: vi.fn().mockImplementation(() => ({
        spreadsheets: {
          values: {
            get: mockGet,
          },
        },
      })),
    },
  };
});

describe('SheetAgent', () => {
  describe('constructor', () => {
    it('should create a SheetAgent instance with required options', () => {
      const agent = new SheetAgent({
        spreadsheetId: 'test-spreadsheet-id',
      });
      expect(agent).toBeInstanceOf(SheetAgent);
    });

    it('should create a SheetAgent instance with all options', () => {
      const agent = new SheetAgent({
        spreadsheetId: 'test-spreadsheet-id',
        defaultFormat: 'object',
        credentials: mockCredentials,
      });
      expect(agent).toBeInstanceOf(SheetAgent);
    });
  });

  describe('spreadsheetId property', () => {
    it('should return the spreadsheet ID', () => {
      const agent = new SheetAgent({
        spreadsheetId: 'test-spreadsheet-id',
        credentials: mockCredentials,
      });
      expect(agent.spreadsheetId).toBe('test-spreadsheet-id');
    });
  });

  describe('system property', () => {
    it('should return empty string before initialization', () => {
      const agent = new SheetAgent({
        spreadsheetId: 'test-spreadsheet-id',
        credentials: mockCredentials,
      });
      // Before connect() is called, system (AGENTS.md) is empty
      expect(agent.system).toBe('');
    });
  });

  describe('plan property', () => {
    it('should return empty string before initialization', () => {
      const agent = new SheetAgent({
        spreadsheetId: 'test-spreadsheet-id',
        credentials: mockCredentials,
      });
      // Before connect() is called, plan (PLAN.md) is empty
      expect(agent.plan).toBe('');
    });
  });

  describe('read()', () => {
    let agent: SheetAgent;

    beforeEach(async () => {
      agent = new SheetAgent({
        spreadsheetId: 'test-spreadsheet-id',
        credentials: mockCredentials,
      });
    });

    it('should throw ValidationError when sheet is not provided', async () => {
      await expect(agent.read({} as any)).rejects.toThrow(ValidationError);
    });

    it('should accept sheet as number (index)', async () => {
      const result = await agent.read({ sheet: 0 });
      expect(result).toBeDefined();
    });

    it('should read data in object format (default)', async () => {
      const result = await agent.read({ sheet: 'Sheet1' });

      expect(result.rows).toHaveLength(2);
      expect(result.headers).toEqual(['name', 'email', 'age']);
      expect(result.rows[0]).toEqual({
        name: 'Alice',
        email: 'alice@example.com',
        age: 30,
      });
      expect(result.rows[1]).toEqual({
        name: 'Bob',
        email: 'bob@example.com',
        age: 25,
      });
    });

    it('should read data in array format', async () => {
      const result = await agent.read({ sheet: 'Sheet1', format: 'array' });

      expect(result.rows).toHaveLength(3);
      expect(result.rows[0]).toEqual(['name', 'email', 'age']);
      expect(result.rows[1]).toEqual(['Alice', 'alice@example.com', 30]);
    });

    it('should use explicit headers when provided', async () => {
      const result = await agent.read({
        sheet: 'Sheet1',
        headers: ['col_a', 'col_b', 'col_c'],
      });

      // All rows become data rows with explicit headers
      expect(result.rows).toHaveLength(3);
      expect(result.headers).toEqual(['col_a', 'col_b', 'col_c']);
      expect(result.rows[0]).toEqual({
        col_a: 'name',
        col_b: 'email',
        col_c: 'age',
      });
    });

    it('should use numeric column indices when headers is false', async () => {
      const result = await agent.read({
        sheet: 'Sheet1',
        headers: false,
      });

      expect(result.headers).toEqual(['col0', 'col1', 'col2']);
      expect(result.rows[0]).toEqual({
        col0: 'name',
        col1: 'email',
        col2: 'age',
      });
    });

    it('should include range in result', async () => {
      const result = await agent.read({ sheet: 'Sheet1' });
      expect(result.range).toBe('Sheet1!A1:C3');
    });

    it('should respect defaultFormat option', async () => {
      const arrayAgent = new SheetAgent({
        spreadsheetId: 'test-id',
        credentials: mockCredentials,
        defaultFormat: 'array',
      });

      const result = await arrayAgent.read({ sheet: 'Sheet1' });
      expect(result.rows).toHaveLength(3); // All rows including header
      expect(result.rows[0]).toEqual(['name', 'email', 'age']);
    });

    it('should handle empty sheets', async () => {
      // Mock empty response
      const { google } = await import('googleapis');
      (google.sheets as any).mockImplementationOnce(() => ({
        spreadsheets: {
          values: {
            get: vi.fn().mockResolvedValue({
              data: { values: [], range: 'Sheet1' },
            }),
          },
        },
      }));

      const emptyAgent = new SheetAgent({
        spreadsheetId: 'test-id',
        credentials: mockCredentials,
      });

      const result = await emptyAgent.read({ sheet: 'Sheet1' });
      expect(result.rows).toEqual([]);
      expect(result.headers).toEqual([]);
    });
  });

  describe('write()', () => {
    let agent: SheetAgent;
    let mockUpdate: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      mockUpdate = vi.fn().mockResolvedValue({
        data: {
          updatedRows: 2,
          updatedColumns: 3,
          updatedCells: 6,
          updatedRange: 'Sheet1!A1:C2',
        },
      });

      // Re-mock googleapis to include update
      const { google } = await import('googleapis');
      (google.sheets as any).mockImplementation(() => ({
        spreadsheets: {
          values: {
            get: vi.fn().mockResolvedValue({
              data: {
                values: [
                  ['name', 'email', 'age'],
                  ['Alice', 'alice@example.com', 30],
                ],
                range: 'Sheet1!A1:C2',
              },
            }),
            update: mockUpdate,
          },
        },
      }));

      agent = new SheetAgent({
        spreadsheetId: 'test-spreadsheet-id',
        credentials: mockCredentials,
      });
    });

    it('should throw ValidationError when sheet is not provided', async () => {
      await expect(agent.write({ data: [] } as any)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when data is not provided', async () => {
      await expect(agent.write({ sheet: 'Sheet1' } as any)).rejects.toThrow(ValidationError);
    });

    it('should write 2D array data directly', async () => {
      const result = await agent.write({
        sheet: 'Sheet1',
        data: [
          ['Alice', 'alice@example.com', 30],
          ['Bob', 'bob@example.com', 25],
        ],
      });

      expect(result.updatedRows).toBe(2);
      expect(result.updatedColumns).toBe(3);
      expect(result.updatedCells).toBe(6);
      expect(result.updatedRange).toBe('Sheet1!A1:C2');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          spreadsheetId: 'test-spreadsheet-id',
          range: 'Sheet1',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              ['Alice', 'alice@example.com', 30],
              ['Bob', 'bob@example.com', 25],
            ],
          },
        })
      );
    });

    it('should write object array with headers: true (default)', async () => {
      const result = await agent.write({
        sheet: 'Sheet1',
        data: [
          { name: 'Alice', email: 'alice@example.com', age: 30 },
          { name: 'Bob', email: 'bob@example.com', age: 25 },
        ],
      });

      expect(result.updatedCells).toBe(6);
      // Should include header row from first object's keys
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: {
            values: [
              ['name', 'email', 'age'],
              ['Alice', 'alice@example.com', 30],
              ['Bob', 'bob@example.com', 25],
            ],
          },
        })
      );
    });

    it('should write object array with explicit headers', async () => {
      await agent.write({
        sheet: 'Sheet1',
        data: [
          { name: 'Alice', email: 'alice@example.com' },
        ],
        headers: ['name', 'email'],
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: {
            values: [
              ['name', 'email'],
              ['Alice', 'alice@example.com'],
            ],
          },
        })
      );
    });

    it('should write object array without headers when headers: false', async () => {
      await agent.write({
        sheet: 'Sheet1',
        data: [
          { name: 'Alice', email: 'alice@example.com' },
        ],
        headers: false,
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: {
            values: [
              ['Alice', 'alice@example.com'],
            ],
          },
        })
      );
    });

    it('should write to specific range', async () => {
      await agent.write({
        sheet: 'Sheet1',
        range: 'A5:C10',
        data: [['test']],
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          range: 'Sheet1!A5:C10',
        })
      );
    });

    it('should accept sheet as number (index)', async () => {
      await agent.write({
        sheet: 0,
        data: [['test']],
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          range: 'Sheet1',
        })
      );
    });

    it('should handle empty object values as empty strings', async () => {
      await agent.write({
        sheet: 'Sheet1',
        data: [
          { name: 'Alice', email: null as any },
        ],
        headers: false,
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: {
            values: [
              ['Alice', ''],
            ],
          },
        })
      );
    });
  });

  describe('clear()', () => {
    let agent: SheetAgent;
    let mockClear: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      mockClear = vi.fn().mockResolvedValue({
        data: {
          clearedRange: 'Sheet1!A1:C10',
        },
      });

      const { google } = await import('googleapis');
      (google.sheets as any).mockImplementation(() => ({
        spreadsheets: {
          values: {
            clear: mockClear,
          },
        },
      }));

      agent = new SheetAgent({
        spreadsheetId: 'test-spreadsheet-id',
        credentials: mockCredentials,
      });
    });

    it('should throw ValidationError when sheet is not provided', async () => {
      await expect(agent.clear({ range: 'A1:C10' } as any)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when range is not provided', async () => {
      await expect(agent.clear({ sheet: 'Sheet1' } as any)).rejects.toThrow(ValidationError);
    });

    it('should clear specified range successfully', async () => {
      const result = await agent.clear({
        sheet: 'Sheet1',
        range: 'A1:C10',
      });

      expect(result.clearedRange).toBe('Sheet1!A1:C10');
      expect(mockClear).toHaveBeenCalledWith(
        expect.objectContaining({
          spreadsheetId: 'test-spreadsheet-id',
          range: 'Sheet1!A1:C10',
        })
      );
    });

    it('should accept sheet as number (index)', async () => {
      await agent.clear({
        sheet: 0,
        range: 'A1:B5',
      });

      expect(mockClear).toHaveBeenCalledWith(
        expect.objectContaining({
          range: 'Sheet1!A1:B5',
        })
      );
    });

    it('should handle different range formats', async () => {
      await agent.clear({
        sheet: 'Data',
        range: 'B2:D20',
      });

      expect(mockClear).toHaveBeenCalledWith(
        expect.objectContaining({
          spreadsheetId: 'test-spreadsheet-id',
          range: 'Data!B2:D20',
        })
      );
    });
  });

  describe('search()', () => {
    let agent: SheetAgent;
    let mockGet: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      mockGet = vi.fn().mockResolvedValue({
        data: {
          values: [
            ['name', 'email', 'age', 'city'],
            ['Alice', 'alice@example.com', 30, 'New York'],
            ['Bob', 'bob@example.com', 25, 'Los Angeles'],
            ['Charlie', 'charlie@example.com', 30, 'New York'],
            ['David', 'david@example.com', 35, 'Chicago'],
          ],
          range: 'Sheet1!A1:D5',
        },
      });

      const { google } = await import('googleapis');
      (google.sheets as any).mockImplementation(() => ({
        spreadsheets: {
          values: {
            get: mockGet,
          },
        },
      }));

      agent = new SheetAgent({
        spreadsheetId: 'test-spreadsheet-id',
        credentials: mockCredentials,
      });
    });

    it('should throw ValidationError when sheet is not provided', async () => {
      await expect(agent.search({ query: { name: 'Alice' } } as any)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when query is not provided', async () => {
      await expect(agent.search({ sheet: 'Sheet1' } as any)).rejects.toThrow(ValidationError);
    });

    it('should search with strict matching (default)', async () => {
      const result = await agent.search({
        sheet: 'Sheet1',
        query: { name: 'Alice' },
      });

      expect(result.matchedCount).toBe(1);
      expect(result.searchedCount).toBe(4);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual({
        name: 'Alice',
        email: 'alice@example.com',
        age: 30,
        city: 'New York',
      });
    });

    it('should search with loose matching (substring)', async () => {
      const result = await agent.search({
        sheet: 'Sheet1',
        query: { email: 'example.com' },
        matching: 'loose',
      });

      expect(result.matchedCount).toBe(4);
      expect(result.searchedCount).toBe(4);
    });

    it('should search with AND operator (default)', async () => {
      const result = await agent.search({
        sheet: 'Sheet1',
        query: { age: 30, city: 'New York' },
      });

      expect(result.matchedCount).toBe(2); // Alice and Charlie
      expect(result.rows).toHaveLength(2);
      expect(result.rows.every(r => r.age === 30 && r.city === 'New York')).toBe(true);
    });

    it('should search with OR operator', async () => {
      // Testing OR with city = 'New York' OR age = 35
      const result2 = await agent.search({
        sheet: 'Sheet1',
        query: { city: 'New York', age: 35 },
        operator: 'or',
      });

      // Should match Alice (NY), Charlie (NY), David (35)
      expect(result2.matchedCount).toBe(3);
    });

    it('should return empty result when no matches found', async () => {
      const result = await agent.search({
        sheet: 'Sheet1',
        query: { name: 'NonExistent' },
      });

      expect(result.matchedCount).toBe(0);
      expect(result.searchedCount).toBe(4);
      expect(result.rows).toEqual([]);
    });

    it('should handle empty sheets', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          values: [['name', 'email']],  // Only headers, no data
          range: 'Sheet1!A1:B1',
        },
      });

      const emptyAgent = new SheetAgent({
        spreadsheetId: 'test-id',
        credentials: mockCredentials,
      });

      const result = await emptyAgent.search({
        sheet: 'Sheet1',
        query: { name: 'Alice' },
      });

      expect(result.matchedCount).toBe(0);
      expect(result.searchedCount).toBe(0);
      expect(result.rows).toEqual([]);
    });

    it('should search numeric values with strict matching', async () => {
      const result = await agent.search({
        sheet: 'Sheet1',
        query: { age: 30 },
      });

      expect(result.matchedCount).toBe(2); // Alice and Charlie
    });

    it('should search with loose matching on partial strings', async () => {
      const result = await agent.search({
        sheet: 'Sheet1',
        query: { city: 'New' },
        matching: 'loose',
      });

      expect(result.matchedCount).toBe(2); // Alice and Charlie (New York)
    });

    it('should handle case-insensitive loose matching', async () => {
      const result = await agent.search({
        sheet: 'Sheet1',
        query: { city: 'new york' },
        matching: 'loose',
      });

      expect(result.matchedCount).toBe(2);
    });

    it('should work with sheet index', async () => {
      const result = await agent.search({
        sheet: 0,
        query: { name: 'Alice' },
      });

      expect(result.matchedCount).toBe(1);
    });
  });

  describe('listSheets()', () => {
    let agent: SheetAgent;
    let mockGet: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      mockGet = vi.fn().mockResolvedValue({
        data: {
          sheets: [
            { properties: { title: 'Sheet1' } },
            { properties: { title: 'Data' } },
            { properties: { title: 'AGENTSCAPE' } },
          ],
        },
      });

      const { google } = await import('googleapis');
      (google.sheets as any).mockImplementation(() => ({
        spreadsheets: {
          get: mockGet,
        },
      }));

      agent = new SheetAgent({
        spreadsheetId: 'test-spreadsheet-id',
        credentials: mockCredentials,
      });
    });

    it('should return list of sheet names', async () => {
      const sheets = await agent.listSheets();

      expect(sheets).toHaveLength(3);
      expect(sheets).toContain('Sheet1');
      expect(sheets).toContain('Data');
      expect(sheets).toContain('AGENTSCAPE');
    });
  });

  describe('createSheet()', () => {
    let agent: SheetAgent;
    let mockBatchUpdate: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      mockBatchUpdate = vi.fn().mockResolvedValue({
        data: {
          replies: [
            {
              addSheet: {
                properties: {
                  sheetId: 123,
                  title: 'NewSheet',
                },
              },
            },
          ],
        },
      });

      const { google } = await import('googleapis');
      (google.sheets as any).mockImplementation(() => ({
        spreadsheets: {
          batchUpdate: mockBatchUpdate,
        },
      }));

      agent = new SheetAgent({
        spreadsheetId: 'test-spreadsheet-id',
        credentials: mockCredentials,
      });
    });

    it('should throw ValidationError when title is not provided', async () => {
      await expect(agent.createSheet('' as any)).rejects.toThrow(ValidationError);
    });

    it('should create a new sheet and return its properties', async () => {
      const result = await agent.createSheet('NewSheet');

      expect(result.sheetId).toBe(123);
      expect(result.title).toBe('NewSheet');
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          spreadsheetId: 'test-spreadsheet-id',
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'NewSheet',
                  },
                },
              },
            ],
          },
        })
      );
    });
  });

  describe('batchRead()', () => {
    let agent: SheetAgent;
    let mockBatchGet: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      mockBatchGet = vi.fn().mockResolvedValue({
        data: {
          valueRanges: [
            {
              range: 'Sheet1!A1:B3',
              values: [
                ['name', 'email'],
                ['Alice', 'alice@example.com'],
                ['Bob', 'bob@example.com'],
              ],
            },
            {
              range: 'Sheet2!A1:C2',
              values: [
                ['id', 'product', 'price'],
                [1, 'Widget', 9.99],
              ],
            },
          ],
        },
      });

      const { google } = await import('googleapis');
      (google.sheets as any).mockImplementation(() => ({
        spreadsheets: {
          values: {
            batchGet: mockBatchGet,
          },
        },
      }));

      agent = new SheetAgent({
        spreadsheetId: 'test-spreadsheet-id',
        credentials: mockCredentials,
      });
    });

    it('should throw ValidationError when queries is empty', async () => {
      await expect(agent.batchRead([])).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when a query has no sheet', async () => {
      await expect(agent.batchRead([{} as any])).rejects.toThrow(ValidationError);
    });

    it('should read multiple ranges in a single API call', async () => {
      const results = await agent.batchRead([
        { sheet: 'Sheet1', range: 'A1:B3' },
        { sheet: 'Sheet2', range: 'A1:C2' },
      ]);

      expect(results).toHaveLength(2);

      // First result
      expect(results[0].rows).toHaveLength(2);
      expect(results[0].headers).toEqual(['name', 'email']);
      expect(results[0].rows[0]).toEqual({ name: 'Alice', email: 'alice@example.com' });

      // Second result
      expect(results[1].rows).toHaveLength(1);
      expect(results[1].headers).toEqual(['id', 'product', 'price']);
      expect(results[1].rows[0]).toEqual({ id: 1, product: 'Widget', price: 9.99 });
    });

    it('should support array format in batchRead', async () => {
      const results = await agent.batchRead([
        { sheet: 'Sheet1', range: 'A1:B3', format: 'array' },
      ]);

      expect(results[0].rows).toHaveLength(3);
      expect(results[0].rows[0]).toEqual(['name', 'email']);
    });
  });

  describe('deleteRows()', () => {
    let agent: SheetAgent;
    let mockBatchUpdate: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      mockBatchUpdate = vi.fn().mockResolvedValue({
        data: {},
      });

      const { google } = await import('googleapis');
      (google.sheets as any).mockImplementation(() => ({
        spreadsheets: {
          get: vi.fn().mockResolvedValue({
            data: {
              sheets: [
                { properties: { sheetId: 0, title: 'Sheet1' } },
                { properties: { sheetId: 1, title: 'Data' } },
              ],
            },
          }),
          batchUpdate: mockBatchUpdate,
        },
      }));

      agent = new SheetAgent({
        spreadsheetId: 'test-spreadsheet-id',
        credentials: mockCredentials,
      });
    });

    it('should throw ValidationError when sheet is not provided', async () => {
      await expect(agent.deleteRows({ startRow: 5 } as any)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when startRow is not provided', async () => {
      await expect(agent.deleteRows({ sheet: 'Sheet1' } as any)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when startRow is less than 1', async () => {
      await expect(agent.deleteRows({ sheet: 'Sheet1', startRow: 0 })).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when endRow is less than startRow', async () => {
      await expect(agent.deleteRows({ sheet: 'Sheet1', startRow: 5, endRow: 3 })).rejects.toThrow(ValidationError);
    });

    it('should delete a single row successfully', async () => {
      const result = await agent.deleteRows({
        sheet: 'Sheet1',
        startRow: 5,
      });

      expect(result.deletedRows).toBe(1);
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          spreadsheetId: 'test-spreadsheet-id',
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: 0,
                    dimension: 'ROWS',
                    startIndex: 4, // 0-indexed
                    endIndex: 5,
                  },
                },
              },
            ],
          },
        })
      );
    });

    it('should delete multiple rows successfully', async () => {
      const result = await agent.deleteRows({
        sheet: 'Sheet1',
        startRow: 5,
        endRow: 9,
      });

      expect(result.deletedRows).toBe(5);
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          spreadsheetId: 'test-spreadsheet-id',
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: 0,
                    dimension: 'ROWS',
                    startIndex: 4, // 0-indexed
                    endIndex: 9,
                  },
                },
              },
            ],
          },
        })
      );
    });

    it('should accept sheet as number (index)', async () => {
      const result = await agent.deleteRows({
        sheet: 0,
        startRow: 2,
      });

      expect(result.deletedRows).toBe(1);
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: 0,
                    dimension: 'ROWS',
                    startIndex: 1,
                    endIndex: 2,
                  },
                },
              },
            ],
          },
        })
      );
    });

    it('should work with different sheet names', async () => {
      const result = await agent.deleteRows({
        sheet: 'Data',
        startRow: 3,
        endRow: 5,
      });

      expect(result.deletedRows).toBe(3);  // Rows 3, 4, 5 (inclusive)
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: 1, // Data sheet has sheetId: 1
                    dimension: 'ROWS',
                    startIndex: 2,
                    endIndex: 5,
                  },
                },
              },
            ],
          },
        })
      );
    });

    it('should throw ValidationError when sheet is not found', async () => {
      await expect(
        agent.deleteRows({
          sheet: 'NonExistentSheet',
          startRow: 1,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('exponential backoff retry', () => {
    it('should retry on 503 Service Unavailable and succeed', async () => {
      const mockGet = vi.fn()
        .mockRejectedValueOnce({ response: { status: 503 } })
        .mockResolvedValue({
          data: {
            values: [['name', 'email'], ['Alice', 'alice@example.com']],
            range: 'Sheet1!A1:B2',
          },
        });

      const { google } = await import('googleapis');
      (google.sheets as any).mockImplementation(() => ({
        spreadsheets: {
          values: {
            get: mockGet,
          },
        },
      }));

      const agent = new SheetAgent({
        spreadsheetId: 'test-id',
        credentials: mockCredentials,
        retry: {
          maxAttempts: 3,
        },
      });

      const result = await agent.read({ sheet: 'Sheet1' });
      expect(result.rows).toHaveLength(1);
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it('should retry on 429 Rate Limit and succeed', async () => {
      const mockGet = vi.fn()
        .mockRejectedValueOnce({
          response: {
            status: 429,
            headers: { 'retry-after': '0' },
          },
        })
        .mockResolvedValue({
          data: {
            values: [['name'], ['Bob']],
            range: 'Sheet1!A1:A2',
          },
        });

      const { google } = await import('googleapis');
      (google.sheets as any).mockImplementation(() => ({
        spreadsheets: {
          values: {
            get: mockGet,
          },
        },
      }));

      const agent = new SheetAgent({
        spreadsheetId: 'test-id',
        credentials: mockCredentials,
        retry: { maxAttempts: 3 },
      });

      const result = await agent.read({ sheet: 'Sheet1' });
      expect(result.rows).toHaveLength(1);
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it('should retry on network error (ECONNRESET) and succeed', async () => {
      const mockGet = vi.fn()
        .mockRejectedValueOnce({ code: 'ECONNRESET' })
        .mockResolvedValue({
          data: {
            values: [['name'], ['Charlie']],
            range: 'Sheet1!A1:A2',
          },
        });

      const { google } = await import('googleapis');
      (google.sheets as any).mockImplementation(() => ({
        spreadsheets: {
          values: {
            get: mockGet,
          },
        },
      }));

      const agent = new SheetAgent({
        spreadsheetId: 'test-id',
        credentials: mockCredentials,
        retry: { maxAttempts: 3 },
      });

      const result = await agent.read({ sheet: 'Sheet1' });
      expect(result.rows).toHaveLength(1);
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry on 400 Bad Request', async () => {
      const mockGet = vi.fn()
        .mockRejectedValue({ response: { status: 400 } });

      const { google } = await import('googleapis');
      (google.sheets as any).mockImplementation(() => ({
        spreadsheets: {
          values: {
            get: mockGet,
          },
        },
      }));

      const agent = new SheetAgent({
        spreadsheetId: 'test-id',
        credentials: mockCredentials,
        retry: { maxAttempts: 3 },
      });

      await expect(agent.read({ sheet: 'Sheet1' })).rejects.toMatchObject({
        response: { status: 400 },
      });
      expect(mockGet).toHaveBeenCalledTimes(1); // No retry
    });

    it('should NOT retry on 403 Forbidden', async () => {
      const mockGet = vi.fn()
        .mockRejectedValue({ response: { status: 403 } });

      const { google } = await import('googleapis');
      (google.sheets as any).mockImplementation(() => ({
        spreadsheets: {
          values: {
            get: mockGet,
          },
        },
      }));

      const agent = new SheetAgent({
        spreadsheetId: 'test-id',
        credentials: mockCredentials,
        retry: { maxAttempts: 3 },
      });

      await expect(agent.read({ sheet: 'Sheet1' })).rejects.toMatchObject({
        response: { status: 403 },
      });
      expect(mockGet).toHaveBeenCalledTimes(1); // No retry
    });

    it('should disable retry when retry.enabled is false', async () => {
      const mockGet = vi.fn()
        .mockRejectedValue({ response: { status: 503 } });

      const { google } = await import('googleapis');
      (google.sheets as any).mockImplementation(() => ({
        spreadsheets: {
          values: {
            get: mockGet,
          },
        },
      }));

      const agent = new SheetAgent({
        spreadsheetId: 'test-id',
        credentials: mockCredentials,
        retry: { enabled: false, maxAttempts: 3 },
      });

      await expect(agent.read({ sheet: 'Sheet1' })).rejects.toMatchObject({
        response: { status: 503 },
      });
      expect(mockGet).toHaveBeenCalledTimes(1); // No retry when disabled
    });

    it('should respect maxAttempts configuration', async () => {
      const mockGet = vi.fn()
        .mockRejectedValue({ response: { status: 500 } });

      const { google } = await import('googleapis');
      (google.sheets as any).mockImplementation(() => ({
        spreadsheets: {
          values: {
            get: mockGet,
          },
        },
      }));

      const agent = new SheetAgent({
        spreadsheetId: 'test-id',
        credentials: mockCredentials,
        retry: { maxAttempts: 3, initialDelayMs: 10 }, // Use small delay for test
      });

      await expect(agent.read({ sheet: 'Sheet1' })).rejects.toBeDefined();
      expect(mockGet).toHaveBeenCalledTimes(3);
    }, 30000); // Increase timeout

    it('should retry write operations on transient errors', async () => {
      const mockUpdate = vi.fn()
        .mockRejectedValueOnce({ response: { status: 502 } })
        .mockResolvedValue({
          data: {
            updatedRows: 2,
            updatedColumns: 2,
            updatedCells: 4,
            updatedRange: 'Sheet1!A1:B2',
          },
        });

      const { google } = await import('googleapis');
      (google.sheets as any).mockImplementation(() => ({
        spreadsheets: {
          values: {
            update: mockUpdate,
          },
        },
      }));

      const agent = new SheetAgent({
        spreadsheetId: 'test-id',
        credentials: mockCredentials,
        retry: { maxAttempts: 3 },
      });

      const result = await agent.write({
        sheet: 'Sheet1',
        data: [['a', 'b'], ['c', 'd']],
      });

      expect(result.updatedCells).toBe(4);
      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });
  });
});
