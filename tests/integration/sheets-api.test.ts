/**
 * Integration tests for Google Sheets API
 *
 * These tests make real API calls to Google Sheets and require:
 * 1. A valid Google Sheets spreadsheet with write permissions
 * 2. Service account credentials
 *
 * Environment variables:
 * - INTEGRATION_TEST_SHEET_ID: The spreadsheet ID to use for testing
 * - CREDENTIALS_CONFIG: Base64-encoded service account JSON
 *
 * Run with: bun run test:integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SheetAgent } from '../../src/agent';

// Skip all tests if no integration environment is configured
const SHEET_ID = process.env.INTEGRATION_TEST_SHEET_ID;
const hasCredentials = !!process.env.CREDENTIALS_CONFIG;

const canRunIntegrationTests = SHEET_ID && hasCredentials;

describe.skipIf(!canRunIntegrationTests)('Integration: Google Sheets API', () => {
  let agent: SheetAgent;
  // Use an existing sheet from the test spreadsheet for read operations
  const existingSheetName = 'Schedule';
  // Use AGENTSCAPE for write tests (we know it exists)
  const writeTestSheet = 'AGENTSCAPE';

  beforeAll(async () => {
    if (!canRunIntegrationTests) return;

    // Use static connect() factory to properly initialize the agent
    agent = await SheetAgent.connect({
      spreadsheetId: SHEET_ID!,
    });
  });

  afterAll(async () => {
    // Cleanup: would delete test sheet if we had the capability
    // For now, tests should clean up after themselves
  });

  describe('properties', () => {
    it('should return the spreadsheet ID', () => {
      expect(agent.spreadsheetId).toBe(SHEET_ID);
    });

    it('should return system prompt after initialization', () => {
      // After connect(), system should be loaded from AGENTSCAPE!A2
      expect(typeof agent.system).toBe('string');
    });
  });

  describe('read()', () => {
    it('should read data from a real spreadsheet', async () => {
      const result = await agent.read({
        sheet: existingSheetName,
        format: 'array',
      });

      expect(result).toHaveProperty('rows');
      expect(Array.isArray(result.rows)).toBe(true);
    });

    it('should read data with range', async () => {
      const result = await agent.read({
        sheet: existingSheetName,
        range: 'A1:D3',
        format: 'array',
      });

      expect(result).toHaveProperty('rows');
      expect(Array.isArray(result.rows)).toBe(true);
    });
  });

  describe('write()', () => {
    it('should write data to a real spreadsheet', async () => {
      // Write to a specific range in column C/D that won't interfere with AGENT.md (A2) or PLAN.md (B2)
      const testData = [
        ['Integration Test', new Date().toISOString()],
        ['Row 2', 'Value 2'],
      ];

      const result = await agent.write({
        sheet: writeTestSheet,
        range: 'C5:D6', // Use columns C-D, rows 5-6 to avoid A/B columns
        data: testData,
      });

      expect(result.updatedCells).toBeGreaterThan(0);
    });
  });

  describe('search()', () => {
    it('should search data in a real spreadsheet', async () => {
      const result = await agent.search({
        sheet: existingSheetName,
        query: {}, // Empty query returns all rows
      });

      expect(result).toHaveProperty('rows');
      expect(Array.isArray(result.rows)).toBe(true);
    });
  });

  describe('clear()', () => {
    it('should clear data from a specific range', async () => {
      // First, write some test data to a safe range (E10:F12)
      const testData = [
        ['Clear Test 1', 'Value 1'],
        ['Clear Test 2', 'Value 2'],
        ['Clear Test 3', 'Value 3'],
      ];

      await agent.write({
        sheet: writeTestSheet,
        range: 'E10:F12',
        data: testData,
      });

      // Verify data was written
      const beforeClear = await agent.read({
        sheet: writeTestSheet,
        range: 'E10:F12',
        format: 'array',
      });
      expect(beforeClear.rows.length).toBeGreaterThan(0);

      // Clear the range
      const result = await agent.clear({
        sheet: writeTestSheet,
        range: 'E10:F12',
      });

      expect(result).toHaveProperty('clearedRange');
      expect(result.clearedRange).toContain('E10:F12');

      // Verify data was cleared
      const afterClear = await agent.read({
        sheet: writeTestSheet,
        range: 'E10:F12',
        format: 'array',
      });
      // After clearing, the range should be empty or contain empty rows
      const hasData = afterClear.rows.some(row =>
        row.some(cell => cell !== null && cell !== undefined && cell !== '')
      );
      expect(hasData).toBe(false);
    });

    it('should clear a specific range', async () => {
      // Write test data to columns G-H (safe area)
      const testData = [
        ['Sheet Clear Test 1', 'Value 1'],
        ['Sheet Clear Test 2', 'Value 2'],
      ];

      await agent.write({
        sheet: writeTestSheet,
        range: 'G5:H6',
        data: testData,
      });

      // Clear the entire range
      const result = await agent.clear({
        sheet: writeTestSheet,
        range: 'G5:H6',
      });

      expect(result).toHaveProperty('clearedRange');
    });
  });

  describe('deleteRows()', () => {
    it('should delete a single row', async () => {
      // Write test data to a safe range (columns I-J, starting at row 15)
      const testData = [
        ['Delete Test Row 1', 'A'],
        ['Delete Test Row 2', 'B'],
        ['Delete Test Row 3', 'C'],
        ['Delete Test Row 4', 'D'],
        ['Delete Test Row 5', 'E'],
      ];

      await agent.write({
        sheet: writeTestSheet,
        range: 'I15:J19',
        data: testData,
      });

      // Read to verify data was written
      const beforeDelete = await agent.read({
        sheet: writeTestSheet,
        range: 'I15:J19',
        format: 'array',
      });
      expect(beforeDelete.rows.length).toBe(5);

      // Delete row 16 (1-indexed, the 2nd row of our test data)
      const result = await agent.deleteRows({
        sheet: writeTestSheet,
        startRow: 16,
      });

      expect(result).toHaveProperty('deletedRows');
      expect(result.deletedRows).toBe(1);

      // Note: After deletion, remaining rows shift up
      // We can verify by reading the range again - there should be fewer rows
      const afterDelete = await agent.read({
        sheet: writeTestSheet,
        range: 'I15:J18', // Reduced range since 1 row was deleted
        format: 'array',
      });
      expect(afterDelete.rows.length).toBeLessThan(beforeDelete.rows.length);
    });

    it('should delete a range of rows', async () => {
      // Write test data to a safe range (columns K-L, starting at row 20)
      const testData = [
        ['Range Delete 1', '1'],
        ['Range Delete 2', '2'],
        ['Range Delete 3', '3'],
        ['Range Delete 4', '4'],
        ['Range Delete 5', '5'],
      ];

      await agent.write({
        sheet: writeTestSheet,
        range: 'K20:L24',
        data: testData,
      });

      // Delete rows 21-23 (1-indexed, 3 rows total)
      const result = await agent.deleteRows({
        sheet: writeTestSheet,
        startRow: 21,
        endRow: 23,
      });

      expect(result).toHaveProperty('deletedRows');
      expect(result.deletedRows).toBe(3);
    });
  });

  describe('batchRead()', () => {
    it('should read multiple ranges in a single API call', async () => {
      const results = await agent.batchRead([
        { sheet: existingSheetName, range: 'A1:B3' },
        { sheet: writeTestSheet, range: 'A1:B2' },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('rows');
      expect(results[1]).toHaveProperty('rows');
    });
  });

  describe('listSheets()', () => {
    it('should list all sheets in the spreadsheet', async () => {
      const sheets = await agent.listSheets();

      expect(Array.isArray(sheets)).toBe(true);
      expect(sheets.length).toBeGreaterThan(0);
      // AGENT_BASE should exist after connect() initializes it
      expect(sheets).toContain('AGENT_BASE');
    });
  });

  describe('plan management', () => {
    it('should get plan (initially a starter plan)', async () => {
      const plan = await agent.getPlan();

      // A starter plan is created by connect() if no plan exists
      expect(plan).toBeDefined();
      if (plan) {
        expect(plan).toHaveProperty('title');
        expect(plan).toHaveProperty('goal');
        expect(plan).toHaveProperty('phases');
      }
    });

    it('should create a new plan', async () => {
      await agent.createPlan('Integration Test Plan', 'Test the plan system', [
        {
          name: 'Setup',
          steps: ['Configure test data', 'Verify prerequisites'],
        },
        {
          name: 'Execute',
          steps: ['Run test operations', 'Collect results'],
        },
      ]);

      const plan = await agent.getPlan();
      expect(plan).not.toBeNull();
      expect(plan?.title).toBe('Integration Test Plan');
      expect(plan?.phases).toHaveLength(2);
    });

    it('should get next task', async () => {
      const task = await agent.getNextTask();

      // First todo task should be the first task in phase 1
      expect(task).not.toBeNull();
      if (task) {
        expect(task.step).toBe('1.1');
        expect(task.status).toBe('todo');
      }
    });

    it('should update task status', async () => {
      // Mark first task as done
      await agent.updateTask('1.1', { status: 'done' });

      // Verify it's marked as done
      const plan = await agent.getPlan();
      const task = plan?.phases[0]?.tasks.find(t => t.step === '1.1');
      expect(task?.status).toBe('done');
    });

    it('should get review tasks', async () => {
      // Create a plan with a review task
      await agent.createPlan('Review Test Plan', 'Test review tasks', [
        {
          name: 'Phase 1',
          steps: ['Task 1', 'Task 2', 'Task 3'],
        },
      ]);

      // Mark task 1.2 as review
      await agent.updateTask('1.2', { status: 'review', note: 'Ready for review' });

      const reviewTasks = await agent.getReviewTasks();
      expect(reviewTasks.length).toBeGreaterThanOrEqual(1);
      expect(reviewTasks.some(t => t.step === '1.2')).toBe(true);
    });

    it('should append notes', async () => {
      await agent.appendNotes('test_key: test_value');

      const plan = await agent.getPlan();
      expect(plan?.notes).toContain('test_key: test_value');
    });
  });
});

// Describe block for documentation purposes when tests are skipped
describe.skipIf(canRunIntegrationTests)('Integration Tests - Setup Required', () => {
  it('should skip when INTEGRATION_TEST_SHEET_ID is not set', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                    INTEGRATION TESTS SKIPPED                       ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  To run integration tests, you need:                              ║
║                                                                    ║
║  1. A Google Sheets spreadsheet with write permissions            ║
║  2. A service account with access to that spreadsheet             ║
║  3. Environment variables set:                                    ║
║                                                                    ║
║     export INTEGRATION_TEST_SHEET_ID="your-spreadsheet-id"        ║
║     export CREDENTIALS_CONFIG="base64-encoded-credentials"        ║
║                                                                    ║
║  Then run: bun run test:integration                               ║
║                                                                    ║
╚═══════════════════════════════════════════════════════════════════╝
`);
    expect(true).toBe(true);
  });
});
