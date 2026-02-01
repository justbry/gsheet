/**
 * AgentScapeManager - Manages files in the AGENTSCAPE sheet
 * Treats Google Sheets as a file system, storing markdown files with metadata
 *
 * Sheet format:
 * | FILE          | DESC | TAGS | DATES | Content/MD |
 * |---------------|------|------|-------|------------|
 * | AGENT-PROFILE.md | md | ...  | ...   | # Agent... |
 * | RESEARCH.md      | md | ...  | ...   | # Research |
 * | PLAN.md          | md | ...  | ...   | # Plan...  |
 *
 * Special case: PLAN.md delegates to PlanManager for consistency
 */

import type { AgentFile } from '../types';
import type { SheetClient } from '../core/sheet-client';
import type { PlanManager } from './plan-manager';
import { ValidationError } from '../errors';

export const AGENTSCAPE_SHEET = 'AGENTSCAPE';

// Column-based format: Column A has labels, columns B+ have files
const COLUMN_LABELS = ['FILE', 'DESC', 'TAGS', 'DATES', 'Content/MD'];

type SheetFormat = 'row-based' | 'column-based';

export class AgentScapeManager {
  private actualSheetName: string | null = null;
  private detectedFormat: SheetFormat | null = null;

  constructor(
    private readonly sheetClient: SheetClient,
    private readonly spreadsheetId: string,
    private readonly planManager: PlanManager
  ) {}

  /**
   * List all files in AGENTSCAPE sheet
   * Returns array of AgentFile objects
   * Supports both row-based and column-based formats
   */
  async listFiles(): Promise<AgentFile[]> {
    const client = await this.sheetClient.getClient();
    const sheetName = await this.getActualSheetName();

    // Read full AGENTSCAPE sheet
    try {
      const response = await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: sheetName,
        });
      });

      const rows = response.data.values;
      if (!rows || rows.length <= 1) {
        // Empty sheet or only headers
        return [];
      }

      // Detect format if not already cached
      if (!this.detectedFormat) {
        this.detectedFormat = this.detectSheetFormat(rows);
      }

      // Parse based on detected format
      if (this.detectedFormat === 'column-based') {
        return this.parseColumnBasedFormat(rows);
      } else {
        return this.parseRowBasedFormat(rows);
      }
    } catch (error) {
      // Sheet might not exist yet
      if (this.isSheetNotFoundError(error)) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Detect whether the sheet is row-based or column-based
   * Row-based: A1=FILE, B1=DESC, A2=filename1, A3=filename2
   * Column-based: A1=FILE, B1=filename1, C1=filename2, A2=DESC, A3=TAGS
   */
  private detectSheetFormat(rows: unknown[][]): SheetFormat {
    if (!rows || rows.length < 2) {
      return 'row-based'; // Default
    }

    const firstRow = rows[0];
    if (!firstRow || firstRow.length < 2) {
      return 'row-based';
    }

    const a1 = String(firstRow[0] || '').trim();
    const b1 = String(firstRow[1] || '').trim();

    // Check if second row has DESC in column A (strongest indicator of column-based)
    if (rows.length >= 2) {
      const a2 = String(rows[1]?.[0] || '').trim();
      if (a1 === 'FILE' && a2 === 'DESC') {
        return 'column-based';
      }
    }

    // If A1 is "FILE" and B1 is "DESC", it's row-based
    if (a1 === 'FILE' && b1 === 'DESC') {
      return 'row-based';
    }

    // If A1 is "FILE" and B1 looks like a filename (has extension), it's column-based
    if (a1 === 'FILE' && (b1.includes('.md') || b1.includes('.txt'))) {
      return 'column-based';
    }

    // Default to row-based
    return 'row-based';
  }

  /**
   * Parse row-based format (original format)
   * Header row: FILE | DESC | TAGS | DATES | Content/MD
   * Data rows: filename | desc | tags | dates | content
   */
  private parseRowBasedFormat(rows: unknown[][]): AgentFile[] {
    const files: AgentFile[] = [];

    // Skip header row, parse remaining rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      files.push({
        file: String(row[0] || ''),
        desc: String(row[1] || ''),
        tags: String(row[2] || ''),
        dates: String(row[3] || ''),
        content: String(row[4] || ''),
      });
    }

    return files;
  }

  /**
   * Parse column-based format (each file is a column)
   * Row 1: FILE | filename1 | filename2 | filename3
   * Row 2: DESC | desc1 | desc2 | desc3
   * Row 3: TAGS | tags1 | tags2 | tags3
   * Row 4: DATES | dates1 | dates2 | dates3
   * Row 5: Content/MD | content1 | content2 | content3
   */
  private parseColumnBasedFormat(rows: unknown[][]): AgentFile[] {
    const files: AgentFile[] = [];

    if (rows.length < 5) {
      // Need at least 5 rows (FILE, DESC, TAGS, DATES, Content/MD)
      return files;
    }

    const fileRow = rows[0];
    const descRow = rows[1];
    const tagsRow = rows[2];
    const datesRow = rows[3];
    const contentRow = rows[4];

    // Start from column B (index 1) since column A has the labels (FILE, DESC, TAGS, DATES, Content/MD)
    for (let col = 1; col < fileRow.length; col++) {
      const filename = String(fileRow[col] || '').trim();

      // Skip empty columns or label columns
      if (!filename) continue;

      // Skip if this looks like a label (FILE, DESC, TAGS, DATES, Content/MD)
      if (['FILE', 'DESC', 'TAGS', 'DATES', 'Content/MD'].includes(filename)) {
        continue;
      }

      files.push({
        file: filename,
        desc: String(descRow[col] || ''),
        tags: String(tagsRow[col] || ''),
        dates: String(datesRow[col] || ''),
        content: String(contentRow[col] || ''),
      });
    }

    return files;
  }

  /**
   * Read a specific file from AGENTSCAPE
   * Special case: PLAN.md delegates to PlanManager
   * Returns null if file not found
   */
  async readFile(filename: string): Promise<AgentFile | null> {
    if (!filename) {
      throw new ValidationError('Filename cannot be empty');
    }

    // Special case: delegate PLAN.md to PlanManager (if it exists there)
    if (filename === 'PLAN.md') {
      const plan = await this.planManager.getPlan();
      if (plan) {
        return {
          file: 'PLAN.md',
          desc: 'plan',
          tags: 'agent,plan',
          dates: new Date().toISOString().split('T')[0] || '',
          content: plan.raw,
        };
      }
      // Fall through to check AGENTSCAPE if PlanManager doesn't have it
    }

    // Search AGENTSCAPE for the file
    const files = await this.listFiles();
    return files.find((f) => f.file === filename) || null;
  }

  /**
   * Write a file to AGENTSCAPE
   * Special case: PLAN.md delegates to PlanManager
   * Updates existing file or creates new one
   * Supports both row-based and column-based formats
   */
  async writeFile(file: AgentFile): Promise<AgentFile> {
    if (!file.file) {
      throw new ValidationError('Filename cannot be empty');
    }

    // Special case: delegate PLAN.md to PlanManager
    if (file.file === 'PLAN.md') {
      // Write to AGENTSCAPE!F5 (content row in column-based format)
      const client = await this.sheetClient.getClient();
      await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'AGENTSCAPE!F5',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[file.content]],
          },
        });
      });

      return file;
    }

    const client = await this.sheetClient.getClient();
    const sheetName = await this.getActualSheetName();

    // Read current sheet to detect format
    const response = await this.sheetClient.executeWithRetry(async () => {
      return client.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: sheetName,
      });
    });

    const rows = response.data.values || [];

    // Detect format if not cached
    if (!this.detectedFormat && rows.length > 0) {
      this.detectedFormat = this.detectSheetFormat(rows);
    }

    // Write based on detected format
    if (this.detectedFormat === 'column-based') {
      return this.writeFileColumnBased(file, rows, client, sheetName);
    } else {
      return this.writeFileRowBased(file, client, sheetName);
    }
  }

  /**
   * Write file in row-based format (original)
   */
  private async writeFileRowBased(file: AgentFile, client: any, sheetName: string): Promise<AgentFile> {
    // Check if file already exists
    const files = await this.listFiles();
    const existingIndex = files.findIndex((f) => f.file === file.file);

    if (existingIndex !== -1) {
      // Update existing file (row index is existingIndex + 2 because of header + 0-indexing)
      const rowIndex = existingIndex + 2;
      await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A${rowIndex}:E${rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[file.file, file.desc, file.tags, file.dates, file.content]],
          },
        });
      });
    } else {
      // Append new file
      await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A:E`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[file.file, file.desc, file.tags, file.dates, file.content]],
          },
        });
      });
    }

    return file;
  }

  /**
   * Write file in column-based format (each file is a column)
   */
  private async writeFileColumnBased(file: AgentFile, rows: unknown[][], client: any, sheetName: string): Promise<AgentFile> {
    if (rows.length < 5) {
      throw new ValidationError('Column-based sheet must have at least 5 rows (FILE, DESC, TAGS, DATES, Content/MD)');
    }

    const fileRow = rows[0];

    // Find which column this file is in (or find next available column)
    let columnIndex = -1;
    for (let col = 1; col < fileRow.length; col++) {
      const filename = String(fileRow[col] || '').trim();
      if (filename === file.file) {
        columnIndex = col;
        break;
      }
    }

    // If file doesn't exist, find next available column
    if (columnIndex === -1) {
      // Find first empty column after existing files
      columnIndex = fileRow.length;
      for (let col = 1; col < fileRow.length; col++) {
        const filename = String(fileRow[col] || '').trim();
        if (!filename || ['FILE', 'DESC', 'TAGS', 'DATES', 'Content/MD'].includes(filename)) {
          columnIndex = col;
          break;
        }
      }
    }

    // Convert column index to letter (A=0, B=1, C=2, etc.)
    const columnLetter = this.columnIndexToLetter(columnIndex);

    // Write the 5 values vertically to this column
    await this.sheetClient.executeWithRetry(async () => {
      return client.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!${columnLetter}1:${columnLetter}5`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            [file.file],
            [file.desc],
            [file.tags],
            [file.dates],
            [file.content],
          ],
        },
      });
    });

    return file;
  }

  /**
   * Convert column index to letter (0=A, 1=B, 25=Z, 26=AA, etc.)
   */
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
   * Delete a file from AGENTSCAPE
   * Throws error if trying to delete PLAN.md (protected)
   * Returns true if deleted, false if not found
   */
  async deleteFile(filename: string): Promise<boolean> {
    if (!filename) {
      throw new ValidationError('Filename cannot be empty');
    }

    // Protect PLAN.md from deletion
    if (filename === 'PLAN.md') {
      throw new ValidationError('Cannot delete PLAN.md - protected file');
    }

    const files = await this.listFiles();
    const fileIndex = files.findIndex((f) => f.file === filename);

    if (fileIndex === -1) {
      return false; // File not found
    }

    // Delete the row (need to use batchUpdate to delete row)
    const client = await this.sheetClient.getClient();

    // Get sheet ID first
    const sheetId = await this.getSheetId(AGENTSCAPE_SHEET);
    if (sheetId === null) {
      return false;
    }

    // Row index is fileIndex + 1 (skip header)
    const rowIndex = fileIndex + 1;

    await this.sheetClient.executeWithRetry(async () => {
      return client.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: 'ROWS',
                  startIndex: rowIndex,
                  endIndex: rowIndex + 1,
                },
              },
            },
          ],
        },
      });
    });

    return true;
  }

  /**
   * Initialize AGENTSCAPE sheet with headers if it doesn't exist
   * Idempotent - safe to call multiple times
   * Validates and fixes headers if they don't match expected format
   */
  async initAgentScape(): Promise<void> {
    const client = await this.sheetClient.getClient();

    // Check if AGENTSCAPE sheet exists (case-insensitive)
    const sheetId = await this.getSheetId(AGENTSCAPE_SHEET);

    if (sheetId === null) {
      // Sheet doesn't exist - create it
      await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: AGENTSCAPE_SHEET,
                  },
                },
              },
            ],
          },
        });
      });

      // Cache the sheet name (we just created it)
      this.actualSheetName = AGENTSCAPE_SHEET;

      // Write column labels in column A (column-based format)
      await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${AGENTSCAPE_SHEET}!A1:A5`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: COLUMN_LABELS.map(label => [label]),
          },
        });
      });

      // Initialize AGENTS.md in column B (B1:B5) - guaranteed first file
      const agentContext = await this.loadDefaultAgentContext();
      await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${AGENTSCAPE_SHEET}!B1:B5`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              ['AGENTS.md'],          // B1: filename
              ['agent'],             // B2: description
              ['system,context'],    // B3: tags
              [new Date().toISOString().split('T')[0] || ''],  // B4: date
              [agentContext]         // B5: content
            ],
          },
        });
      });

      // Initialize PLAN.md in column C (C1:C5) - special handling
      const starterPlan = this.generateStarterPlanMarkdown();
      await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${AGENTSCAPE_SHEET}!C1:C5`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              ['PLAN.md'],           // C1: filename
              ['plan'],              // C2: description
              ['agent,plan'],        // C3: tags
              [new Date().toISOString().split('T')[0] || ''],  // C4: date
              [starterPlan]          // C5: content
            ],
          },
        });
      });
    } else {
      // Sheet exists - get actual name and validate headers
      const sheetName = await this.getActualSheetName();

      // Read column A to check labels (column-based format)
      const response = await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A1:A5`,
        });
      });

      const existingLabels = (response.data.values || []).map(row => String(row[0] || '').trim());

      // Check if labels match exactly (FILE, DESC, TAGS, DATES, Content/MD)
      const labelsMatch =
        existingLabels.length === COLUMN_LABELS.length &&
        COLUMN_LABELS.every((label, i) => existingLabels[i] === label);

      if (!labelsMatch && existingLabels.some(l => l !== '')) {
        // Labels exist but don't match - check if it's incompatible
        throw new Error(
          `Sheet "${sheetName}" exists but has an incompatible structure. ` +
          `Expected column labels: ${COLUMN_LABELS.join(', ')} in column A (rows 1-5). ` +
          `Please either: 1) Delete the "${sheetName}" sheet to allow creation of a new one, ` +
          `or 2) Use a different spreadsheet.`
        );
      }

      if (!labelsMatch) {
        // Labels don't exist or are empty - initialize them
        await this.sheetClient.executeWithRetry(async () => {
          return client.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${sheetName}!A1:A5`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: COLUMN_LABELS.map(label => [label]),
            },
          });
        });
      }

      // Check if PLAN.md file exists in column C
      let planInitialized = false;
      try {
        const planFileResponse = await this.sheetClient.executeWithRetry(async () => {
          return client.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: `${sheetName}!C1`,
          });
        });
        const planFileName = planFileResponse.data.values?.[0]?.[0];
        planInitialized = planFileName === 'PLAN.md';
      } catch (error) {
        planInitialized = false;
      }

      // Initialize PLAN.md file if not present (column-based format)
      if (!planInitialized) {
        const starterPlan = this.generateStarterPlanMarkdown();
        await this.sheetClient.executeWithRetry(async () => {
          return client.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${sheetName}!C1:C5`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [
                ['PLAN.md'],           // C1: filename
                ['plan'],              // C2: description
                ['agent,plan'],        // C3: tags
                [new Date().toISOString().split('T')[0] || ''],  // C4: date
                [starterPlan]          // C5: content
              ],
            },
          });
        });
      }

      // Check if AGENTS.md exists in column B
      let hasAgentMd = false;
      try {
        const agentFileResponse = await this.sheetClient.executeWithRetry(async () => {
          return client.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: `${sheetName}!B1`,
          });
        });
        const agentFileName = agentFileResponse.data.values?.[0]?.[0];
        hasAgentMd = agentFileName === 'AGENTS.md';
      } catch (error) {
        hasAgentMd = false;
      }

      // Initialize AGENTS.md in column B if not present
      if (!hasAgentMd) {
        const agentContext = await this.loadDefaultAgentContext();
        await this.sheetClient.executeWithRetry(async () => {
          return client.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${sheetName}!B1:B5`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [
                ['AGENTS.md'],          // B1: filename
                ['agent'],             // B2: description
                ['system,context'],    // B3: tags
                [new Date().toISOString().split('T')[0] || ''],  // B4: date
                [agentContext]         // B5: content
              ],
            },
          });
        });
      }
    }
  }

  /**
   * Get the actual sheet name (with correct casing)
   * Returns the sheet name as it exists in the spreadsheet
   * Caches the result for subsequent calls
   */
  private async getActualSheetName(): Promise<string> {
    if (this.actualSheetName) {
      return this.actualSheetName;
    }

    const client = await this.sheetClient.getClient();
    const response = await this.sheetClient.executeWithRetry(async () => {
      return client.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
    });

    const targetNameLower = AGENTSCAPE_SHEET.toLowerCase();
    const sheet = response.data.sheets?.find(
      (s) => s.properties?.title?.toLowerCase() === targetNameLower
    );

    this.actualSheetName = sheet?.properties?.title ?? AGENTSCAPE_SHEET;
    return this.actualSheetName;
  }

  /**
   * Get sheet ID by name
   * Returns null if sheet not found
   * Note: Case-insensitive lookup to handle both "AGENTSCAPE" and "AgentScape"
   */
  private async getSheetId(sheetName: string): Promise<number | null> {
    const client = await this.sheetClient.getClient();

    const response = await this.sheetClient.executeWithRetry(async () => {
      return client.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
    });

    const sheetNameLower = sheetName.toLowerCase();
    const sheet = response.data.sheets?.find(
      (s) => s.properties?.title?.toLowerCase() === sheetNameLower
    );
    return sheet?.properties?.sheetId ?? null;
  }

  /**
   * Check if error is a "sheet not found" error
   */
  private isSheetNotFoundError(error: unknown): boolean {
    if (typeof error === 'object' && error !== null) {
      const err = error as { message?: string };
      return err.message?.includes('Unable to parse range') ?? false;
    }
    return false;
  }

  /**
   * Load the default agent context from prompts/DEFAULT_AGENTS.md
   * Falls back to minimal prompt if file not found
   */
  private async loadDefaultAgentContext(): Promise<string> {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');

      // Try to load from prompts/DEFAULT_AGENTS.md
      const promptPath = path.join(__dirname, '../../prompts/DEFAULT_AGENTS.md');
      const content = await fs.readFile(promptPath, 'utf-8');

      if (content.trim()) {
        return content;
      }
    } catch (error) {
      // File not found or not readable, use fallback
      console.warn('Could not load DEFAULT_AGENTS.md, using fallback prompt');
    }

    // Fallback: minimal prompt if file doesn't exist
    return `# Sheet Agent Context

## Persona
You are a spreadsheet automation agent.

## Core Tools
- read, write, append, search operations
- Planning system (getPlan, createPlan, task management)
- History logging

See documentation for full details.`;
  }

  /**
   * Generate the starter plan markdown for new workspaces
   */
  private generateStarterPlanMarkdown(): string {
    return `# Plan: Getting Started

Goal: Learn the sheet agent system and complete first task

## Analysis

- Spreadsheet: [Your spreadsheet]
- Key sheets: [To be determined]
- Target ranges:
  - Read: [Ranges to be determined]
  - Write: [Ranges to be determined]
- Current state: Agent initialized, ready for first task

## Questions for User

- What spreadsheet task would you like to accomplish?
- Which sheets contain the data you want to work with?

### Phase 1: Orientation
- [ ] 1.1 List all sheets in the spreadsheet
- [ ] 1.2 Read headers from main sheet to understand structure
- [ ] 1.3 Confirm user's goal and create detailed plan

### Phase 2: Execution
- [ ] 2.1 Execute the planned task
- [ ] 2.2 Verify results with user
- [ ] 2.3 Complete and log the work

## Notes

`;
  }
}
