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

const HEADERS = ['FILE', 'DESC', 'TAGS', 'DATES', 'Content/MD'];

export class AgentScapeManager {
  private actualSheetName: string | null = null;

  constructor(
    private readonly sheetClient: SheetClient,
    private readonly spreadsheetId: string,
    private readonly planManager: PlanManager
  ) {}

  /**
   * List all files in AGENTSCAPE sheet
   * Returns array of AgentFile objects
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

      // Skip header row, parse remaining rows
      const files: AgentFile[] = [];
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
    } catch (error) {
      // Sheet might not exist yet
      if (this.isSheetNotFoundError(error)) {
        return [];
      }
      throw error;
    }
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

    // Special case: delegate PLAN.md to PlanManager
    if (filename === 'PLAN.md') {
      const plan = await this.planManager.getPlan();
      if (!plan) return null;

      return {
        file: 'PLAN.md',
        desc: 'plan',
        tags: 'agent,plan',
        dates: new Date().toISOString().split('T')[0] || '',
        content: plan.raw,
      };
    }

    // Search AGENTSCAPE for the file
    const files = await this.listFiles();
    return files.find((f) => f.file === filename) || null;
  }

  /**
   * Write a file to AGENTSCAPE
   * Special case: PLAN.md delegates to PlanManager
   * Updates existing file or creates new one
   */
  async writeFile(file: AgentFile): Promise<AgentFile> {
    if (!file.file) {
      throw new ValidationError('Filename cannot be empty');
    }

    // Special case: delegate PLAN.md to PlanManager
    if (file.file === 'PLAN.md') {
      // Write to AGENT_BASE!B2 via PlanManager
      const client = await this.sheetClient.getClient();
      await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'AGENT_BASE!B2',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[file.content]],
          },
        });
      });

      // Also set marker in B1
      await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: 'AGENT_BASE!B1',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [['PLAN.md Contents']],
          },
        });
      });

      return file;
    }

    const client = await this.sheetClient.getClient();
    const sheetName = await this.getActualSheetName();

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

      // Write headers
      await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${AGENTSCAPE_SHEET}!A1:E1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [HEADERS],
          },
        });
      });
    } else {
      // Sheet exists - get actual name and validate headers
      const sheetName = await this.getActualSheetName();

      // Read first row to check headers
      const response = await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A1:E1`,
        });
      });

      const existingHeaders = response.data.values?.[0] || [];

      // Check if headers match exactly (must be exactly 5 columns: FILE, DESC, TAGS, DATES, Content/MD)
      const headersMatch =
        existingHeaders.length >= HEADERS.length &&
        HEADERS.every((header, i) => String(existingHeaders[i]).trim() === header);

      // Check if this looks like an incompatible sheet (has more than 5 columns with data)
      const hasExtraColumns = existingHeaders.length > HEADERS.length && existingHeaders.slice(HEADERS.length).some(v => v && String(v).trim() !== '');

      if (hasExtraColumns) {
        throw new Error(
          `Sheet "${sheetName}" exists but has an incompatible structure (${existingHeaders.length} columns instead of ${HEADERS.length}). ` +
          `Please either: 1) Delete the "${sheetName}" sheet to allow creation of a new one, ` +
          `2) Use a different spreadsheet, or 3) Manually create an "AGENTSCAPE" sheet with headers: ${HEADERS.join(', ')}`
        );
      }

      if (!headersMatch) {
        // Headers don't match - fix them (only if sheet has <= 5 columns)
        await this.sheetClient.executeWithRetry(async () => {
          return client.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${sheetName}!A1:E1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [HEADERS],
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
}
