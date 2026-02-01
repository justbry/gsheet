/**
 * AgentScapeManager - Manages files in the AGENTSCAPE sheet
 * Treats Google Sheets as a file system, storing markdown files with metadata
 *
 * Sheet format (column-based, 12 rows):
 * Column A = labels, columns B+ = files
 * Row 1: FILE, Row 2: DESC, Row 3: TAGS, Row 4: Path,
 * Row 5: CreatedTS, Row 6: UpdatedTS, Row 7: Status,
 * Row 8: DependsOn, Row 9: ContextLen, Row 10: MaxCtxLen,
 * Row 11: Hash, Row 12+: MDContent
 *
 * Special case: PLAN.md delegates to PlanManager for consistency
 */

import type { AgentFile } from '../types';
import type { SheetClient } from '../core/sheet-client';
import type { PlanManager } from './plan-manager';
import { ValidationError } from '../errors';

export const AGENTSCAPE_SHEET = 'AGENTSCAPE';

const METADATA_ROWS = 12;

// Column-based format: Column A has labels, columns B+ have files
const COLUMN_LABELS = [
  'FILE', 'DESC', 'TAGS', 'Path', 'CreatedTS', 'UpdatedTS',
  'Status', 'DependsOn', 'ContextLen', 'MaxCtxLen', 'Hash', 'MDContent',
];

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
   */
  async listFiles(): Promise<AgentFile[]> {
    const client = await this.sheetClient.getClient();
    const sheetName = await this.getActualSheetName();

    try {
      const response = await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: sheetName,
        });
      });

      const rows = response.data.values;
      if (!rows || rows.length <= 1) {
        return [];
      }

      if (!this.detectedFormat) {
        this.detectedFormat = this.detectSheetFormat(rows);
      }

      if (this.detectedFormat === 'column-based') {
        return this.parseColumnBasedFormat(rows);
      } else {
        return this.parseRowBasedFormat(rows);
      }
    } catch (error) {
      if (this.isSheetNotFoundError(error)) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Detect whether the sheet is row-based or column-based
   */
  private detectSheetFormat(rows: unknown[][]): SheetFormat {
    if (!rows || rows.length < 2) {
      return 'row-based';
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

    if (a1 === 'FILE' && b1 === 'DESC') {
      return 'row-based';
    }

    if (a1 === 'FILE' && (b1.includes('.md') || b1.includes('.txt'))) {
      return 'column-based';
    }

    return 'row-based';
  }

  /**
   * Parse row-based format
   */
  private parseRowBasedFormat(rows: unknown[][]): AgentFile[] {
    const files: AgentFile[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      files.push({
        file: String(row[0] || ''),
        desc: String(row[1] || ''),
        tags: String(row[2] || ''),
        path: String(row[3] || ''),
        createdTs: String(row[4] || ''),
        updatedTs: String(row[5] || ''),
        status: String(row[6] || ''),
        dependsOn: String(row[7] || ''),
        contextLen: String(row[8] || ''),
        maxCtxLen: String(row[9] || ''),
        hash: String(row[10] || ''),
        content: String(row[11] || ''),
      });
    }

    return files;
  }

  /**
   * Parse column-based format (each file is a column)
   * Rows 1-11: metadata, Row 12+: content
   */
  private parseColumnBasedFormat(rows: unknown[][]): AgentFile[] {
    const files: AgentFile[] = [];

    if (rows.length < METADATA_ROWS) {
      return files;
    }

    const fileRow = rows[0];

    for (let col = 1; col < fileRow.length; col++) {
      const filename = String(fileRow[col] || '').trim();

      if (!filename) continue;
      if (COLUMN_LABELS.includes(filename)) continue;

      files.push({
        file: filename,
        desc: String(rows[1]?.[col] || ''),
        tags: String(rows[2]?.[col] || ''),
        path: String(rows[3]?.[col] || ''),
        createdTs: String(rows[4]?.[col] || ''),
        updatedTs: String(rows[5]?.[col] || ''),
        status: String(rows[6]?.[col] || ''),
        dependsOn: String(rows[7]?.[col] || ''),
        contextLen: String(rows[8]?.[col] || ''),
        maxCtxLen: String(rows[9]?.[col] || ''),
        hash: String(rows[10]?.[col] || ''),
        content: String(rows[11]?.[col] || ''),
      });
    }

    return files;
  }

  /**
   * Read a specific file from AGENTSCAPE
   */
  async readFile(filename: string): Promise<AgentFile | null> {
    if (!filename) {
      throw new ValidationError('Filename cannot be empty');
    }

    if (filename === 'PLAN.md') {
      const plan = await this.planManager.getPlan();
      if (plan) {
        const now = new Date().toISOString();
        return {
          file: 'PLAN.md',
          desc: 'Active execution plan with phased tasks and progress tracking.',
          tags: 'agent,plan',
          path: '/opt/agentscape/PLAN.md',
          createdTs: '',
          updatedTs: now,
          status: 'active',
          dependsOn: 'AGENTS.md',
          contextLen: '',
          maxCtxLen: '',
          hash: '',
          content: plan.raw,
        };
      }
    }

    const files = await this.listFiles();
    return files.find((f) => f.file === filename) || null;
  }

  /**
   * Write a file to AGENTSCAPE
   */
  async writeFile(file: AgentFile): Promise<AgentFile> {
    if (!file.file) {
      throw new ValidationError('Filename cannot be empty');
    }

    // Auto-set defaults
    const now = new Date().toISOString();
    if (!file.path) {
      file.path = `/opt/agentscape/${file.file}`;
    }
    if (!file.updatedTs) {
      file.updatedTs = now;
    }
    if (!file.status) {
      file.status = 'active';
    }

    // Special case: PLAN.md writes content via column-based lookup
    if (file.file === 'PLAN.md') {
      const client = await this.sheetClient.getClient();
      const sheetName = await this.getActualSheetName();

      const response = await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A1:Z1`,
        });
      });

      const firstRow = response.data.values?.[0] || [];
      let planCol = -1;
      for (let col = 1; col < firstRow.length; col++) {
        if (String(firstRow[col] || '').trim() === 'PLAN.md') {
          planCol = col;
          break;
        }
      }

      if (planCol === -1) {
        throw new ValidationError('PLAN.md column not found in AGENTSCAPE sheet');
      }

      const colLetter = this.columnIndexToLetter(planCol);
      await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!${colLetter}12`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[file.content]],
          },
        });
      });

      // Update UpdatedTS
      await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!${colLetter}6`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[now]],
          },
        });
      });

      return file;
    }

    const client = await this.sheetClient.getClient();
    const sheetName = await this.getActualSheetName();

    const response = await this.sheetClient.executeWithRetry(async () => {
      return client.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: sheetName,
      });
    });

    const rows = response.data.values || [];

    if (!this.detectedFormat && rows.length > 0) {
      this.detectedFormat = this.detectSheetFormat(rows);
    }

    if (this.detectedFormat === 'column-based') {
      return this.writeFileColumnBased(file, rows, client, sheetName);
    } else {
      return this.writeFileRowBased(file, client, sheetName);
    }
  }

  /**
   * Write file in row-based format
   */
  private async writeFileRowBased(file: AgentFile, client: any, sheetName: string): Promise<AgentFile> {
    const files = await this.listFiles();
    const existingIndex = files.findIndex((f) => f.file === file.file);

    // Preserve createdTs on update
    if (existingIndex !== -1) {
      if (!file.createdTs && files[existingIndex]?.createdTs) {
        file.createdTs = files[existingIndex].createdTs;
      }
      const rowIndex = existingIndex + 2;
      await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A${rowIndex}:L${rowIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [this.fileToRow(file)],
          },
        });
      });
    } else {
      if (!file.createdTs) {
        file.createdTs = new Date().toISOString();
      }
      await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A:L`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [this.fileToRow(file)],
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
    if (rows.length < METADATA_ROWS) {
      throw new ValidationError(`Column-based sheet must have at least ${METADATA_ROWS} rows`);
    }

    const fileRow = rows[0];

    // Find which column this file is in
    let columnIndex = -1;
    for (let col = 1; col < fileRow.length; col++) {
      const filename = String(fileRow[col] || '').trim();
      if (filename === file.file) {
        columnIndex = col;
        break;
      }
    }

    // Preserve createdTs on update
    if (columnIndex !== -1) {
      const existingCreated = String(rows[4]?.[columnIndex] || '').trim();
      if (!file.createdTs && existingCreated) {
        file.createdTs = existingCreated;
      }
    } else {
      // New file
      if (!file.createdTs) {
        file.createdTs = new Date().toISOString();
      }
      // Find next available column
      columnIndex = fileRow.length;
      for (let col = 1; col < fileRow.length; col++) {
        const filename = String(fileRow[col] || '').trim();
        if (!filename || COLUMN_LABELS.includes(filename)) {
          columnIndex = col;
          break;
        }
      }
    }

    const columnLetter = this.columnIndexToLetter(columnIndex);

    // Write the 12 values vertically
    await this.sheetClient.executeWithRetry(async () => {
      return client.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!${columnLetter}1:${columnLetter}${METADATA_ROWS}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            [file.file],                                                    // Row 1: FILE
            [file.desc],                                                    // Row 2: DESC
            [file.tags],                                                    // Row 3: TAGS
            [file.path],                                                    // Row 4: Path
            [file.createdTs],                                               // Row 5: CreatedTS
            [file.updatedTs],                                               // Row 6: UpdatedTS
            [file.status],                                                  // Row 7: Status
            [file.dependsOn],                                               // Row 8: DependsOn
            [`=INT(LEN(${columnLetter}${METADATA_ROWS})/4)`],               // Row 9: ContextLen formula
            [file.maxCtxLen],                                               // Row 10: MaxCtxLen
            [`=IF(${columnLetter}${METADATA_ROWS}="","",SHA256(${columnLetter}${METADATA_ROWS}))`], // Row 11: Hash formula
            [file.content],                                                 // Row 12: MDContent
          ],
        },
      });
    });

    return file;
  }

  private fileToRow(file: AgentFile): string[] {
    return [
      file.file, file.desc, file.tags, file.path,
      file.createdTs, file.updatedTs, file.status, file.dependsOn,
      file.contextLen, file.maxCtxLen, file.hash, file.content,
    ];
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
   */
  async deleteFile(filename: string): Promise<boolean> {
    if (!filename) {
      throw new ValidationError('Filename cannot be empty');
    }

    if (filename === 'PLAN.md') {
      throw new ValidationError('Cannot delete PLAN.md - protected file');
    }

    const files = await this.listFiles();
    const fileIndex = files.findIndex((f) => f.file === filename);

    if (fileIndex === -1) {
      return false;
    }

    const client = await this.sheetClient.getClient();

    const sheetId = await this.getSheetId(AGENTSCAPE_SHEET);
    if (sheetId === null) {
      return false;
    }

    // For column-based: delete column; for row-based: delete row
    if (this.detectedFormat === 'column-based') {
      const colIndex = fileIndex + 1; // +1 because column A is labels
      await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: sheetId,
                    dimension: 'COLUMNS',
                    startIndex: colIndex,
                    endIndex: colIndex + 1,
                  },
                },
              },
            ],
          },
        });
      });
    } else {
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
    }

    return true;
  }

  /**
   * Initialize AGENTSCAPE sheet with headers if it doesn't exist
   */
  async initAgentScape(): Promise<void> {
    const client = await this.sheetClient.getClient();

    const sheetId = await this.getSheetId(AGENTSCAPE_SHEET);

    if (sheetId === null) {
      // Create sheet
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

      this.actualSheetName = AGENTSCAPE_SHEET;

      // Write column labels in column A
      await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${AGENTSCAPE_SHEET}!A1:A${METADATA_ROWS}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: COLUMN_LABELS.map(label => [label]),
          },
        });
      });

      const now = new Date().toISOString();
      const today = now.split('T')[0] || '';

      // Initialize AGENTS.md in column B
      const agentContext = await this.loadDefaultAgentContext();
      await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${AGENTSCAPE_SHEET}!B1:B${METADATA_ROWS}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              ['AGENTS.md'],                              // B1: FILE
              ['Core agent identity and capabilities.'],  // B2: DESC
              ['system,context'],                         // B3: TAGS
              ['/opt/agentscape/AGENTS.md'],               // B4: Path
              [now],                                       // B5: CreatedTS
              [now],                                       // B6: UpdatedTS
              ['active'],                                  // B7: Status
              [''],                                        // B8: DependsOn
              ['=INT(LEN(B12)/4)'],                        // B9: ContextLen
              [''],                                        // B10: MaxCtxLen
              ['=IF(B12="","",SHA256(B12))'],               // B11: Hash
              [agentContext],                               // B12: MDContent
            ],
          },
        });
      });

      // Initialize PLAN.md in column C
      const starterPlan = this.generateStarterPlanMarkdown();
      await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${AGENTSCAPE_SHEET}!C1:C${METADATA_ROWS}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              ['PLAN.md'],                                            // C1: FILE
              ['Active execution plan with phased tasks.'],           // C2: DESC
              ['agent,plan'],                                         // C3: TAGS
              ['/opt/agentscape/PLAN.md'],                             // C4: Path
              [now],                                                   // C5: CreatedTS
              [now],                                                   // C6: UpdatedTS
              ['active'],                                              // C7: Status
              ['AGENTS.md'],                                           // C8: DependsOn
              ['=INT(LEN(C12)/4)'],                                    // C9: ContextLen
              [''],                                                    // C10: MaxCtxLen
              ['=IF(C12="","",SHA256(C12))'],                           // C11: Hash
              [starterPlan],                                            // C12: MDContent
            ],
          },
        });
      });
    } else {
      // Sheet exists — validate labels
      const sheetName = await this.getActualSheetName();

      const response = await this.sheetClient.executeWithRetry(async () => {
        return client.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${sheetName}!A1:A${METADATA_ROWS}`,
        });
      });

      const existingLabels = (response.data.values || []).map(row => String(row[0] || '').trim());

      const labelsMatch =
        existingLabels.length === COLUMN_LABELS.length &&
        COLUMN_LABELS.every((label, i) => existingLabels[i] === label);

      if (!labelsMatch && existingLabels.some(l => l !== '')) {
        throw new Error(
          `Sheet "${sheetName}" exists but has an incompatible structure. ` +
          `Expected column labels: ${COLUMN_LABELS.join(', ')} in column A (rows 1-${METADATA_ROWS}). ` +
          `Please either: 1) Delete the "${sheetName}" sheet to allow creation of a new one, ` +
          `or 2) Use a different spreadsheet.`
        );
      }

      if (!labelsMatch) {
        await this.sheetClient.executeWithRetry(async () => {
          return client.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${sheetName}!A1:A${METADATA_ROWS}`,
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

      if (!planInitialized) {
        const now = new Date().toISOString();
        const starterPlan = this.generateStarterPlanMarkdown();
        await this.sheetClient.executeWithRetry(async () => {
          return client.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${sheetName}!C1:C${METADATA_ROWS}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [
                ['PLAN.md'],
                ['Active execution plan with phased tasks.'],
                ['agent,plan'],
                ['/opt/agentscape/PLAN.md'],
                [now],
                [now],
                ['active'],
                ['AGENTS.md'],
                ['=INT(LEN(C12)/4)'],
                [''],
                ['=IF(C12="","",SHA256(C12))'],
                [starterPlan],
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

      if (!hasAgentMd) {
        const now = new Date().toISOString();
        const agentContext = await this.loadDefaultAgentContext();
        await this.sheetClient.executeWithRetry(async () => {
          return client.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${sheetName}!B1:B${METADATA_ROWS}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [
                ['AGENTS.md'],
                ['Core agent identity and capabilities.'],
                ['system,context'],
                ['/opt/agentscape/AGENTS.md'],
                [now],
                [now],
                ['active'],
                [''],
                ['=INT(LEN(B12)/4)'],
                [''],
                ['=IF(B12="","",SHA256(B12))'],
                [agentContext],
              ],
            },
          });
        });
      }
    }
  }

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

  private isSheetNotFoundError(error: unknown): boolean {
    if (typeof error === 'object' && error !== null) {
      const err = error as { message?: string };
      return err.message?.includes('Unable to parse range') ?? false;
    }
    return false;
  }

  private async loadDefaultAgentContext(): Promise<string> {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');

      const promptPath = path.join(__dirname, '../../prompts/DEFAULT_AGENTS.md');
      const content = await fs.readFile(promptPath, 'utf-8');

      if (content.trim()) {
        return content;
      }
    } catch (error) {
      console.warn('Could not load DEFAULT_AGENTS.md, using fallback prompt');
    }

    return `# Sheet Agent Context

## Persona
You are a spreadsheet automation agent.

## Core Tools
- read, write, append, search operations
- Planning system (getPlan, createPlan, task management)
- History logging

See documentation for full details.`;
  }

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
