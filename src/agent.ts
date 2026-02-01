/**
 * SheetAgent - Main class for Google Sheets agent workspace
 */
import { sheets_v4 } from 'googleapis';
import type {
  SheetAgentOptions,
  ReadOptions,
  WriteOptions,
  SearchOptions,
  SheetData,
  WriteResult,
  SearchResult,
  Plan,
  PlanTask,
  PhaseInput,
  BatchReadQuery,
  TaskUpdate,
  ClearOptions,
  ClearResult,
  DeleteRowsOptions,
  DeleteRowsResult,
} from './types';
import { WorkspaceSheets } from './schemas';
import { ValidationError, PermissionError } from './errors';
import { SheetClient } from './core/sheet-client';
import { PlanManager } from './managers/plan-manager';

export class SheetAgent {
  private readonly options: SheetAgentOptions;
  private readonly sheetClient: SheetClient;
  private readonly planManager: PlanManager;

  /** The AGENT.md content loaded at session start. Read-only. */
  private _system: string = '';

  /**
   * Static factory method to create and initialize a SheetAgent.
   * This is the recommended way to create a SheetAgent instance.
   *
   * @param options - Configuration options for the agent
   * @returns Promise resolving to an initialized SheetAgent
   * @throws AuthError if credentials are invalid
   * @throws PermissionError if spreadsheetId is invalid or inaccessible
   */
  static async connect(options: SheetAgentOptions): Promise<SheetAgent> {
    const agent = new SheetAgent(options);
    await agent.initialize();
    return agent;
  }

  /**
   * The AGENT.md content, loaded at session start.
   * Read-only. Edit AGENT_BASE!A2 directly to change.
   */
  get system(): string {
    return this._system;
  }

  /**
   * The spreadsheet ID this agent is connected to.
   * Useful for logging and debugging.
   */
  get spreadsheetId(): string {
    return this.options.spreadsheetId;
  }

  constructor(options: SheetAgentOptions) {
    this.options = {
      defaultFormat: 'object',
      ...options,
    };

    // Initialize sheet client for authentication and API access
    this.sheetClient = new SheetClient({
      spreadsheetId: options.spreadsheetId,
      credentials: options.credentials,
      keyFile: options.keyFile,
      retry: options.retry,
    });

    // Initialize plan manager (replaces task manager)
    this.planManager = new PlanManager(
      this.sheetClient,
      options.spreadsheetId
    );
  }

  /**
   * Get authenticated Google Sheets client (delegates to SheetClient)
   */
  private async getClient(): Promise<sheets_v4.Sheets> {
    return this.sheetClient.getClient();
  }

  /**
   * Initialize the agent (called by SheetAgent.connect())
   * 1. Validates spreadsheetId by attempting to access the spreadsheet
   * 2. Auto-creates AGENT_BASE sheet if not present
   * 3. Loads AGENT.md content into _system property
   * @private
   */
  private async initialize(): Promise<void> {
    // Step 1: Validate spreadsheetId by attempting to get the spreadsheet
    // This will throw PermissionError if invalid or inaccessible
    const client = await this.getClient();
    try {
      await this.executeWithRetry(async () => {
        return client.spreadsheets.get({
          spreadsheetId: this.options.spreadsheetId,
          fields: 'spreadsheetId',
        });
      });
    } catch (error) {
      // Re-throw with more context
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('not found') || message.includes('404')) {
        throw new PermissionError(
          `Cannot access spreadsheet '${this.options.spreadsheetId}'`,
          `The spreadsheet ID may be invalid or you don't have access. ` +
          `Fix: Share with service account email or verify the spreadsheet ID.`
        );
      }
      throw error;
    }

    // Step 2: Auto-initialize AGENT_BASE sheet (idempotent)
    await this.initAgentBase();

    // Step 3: Load AGENT.md content into _system
    await this.loadSystem();
  }

  /**
   * Load AGENT.md content from AGENT_BASE!A2 into _system property
   * @private
   */
  private async loadSystem(): Promise<void> {
    const client = await this.getClient();
    try {
      const response = await this.executeWithRetry(async () => {
        return client.spreadsheets.values.get({
          spreadsheetId: this.options.spreadsheetId,
          range: `${WorkspaceSheets.AGENT_BASE}!A2`,
        });
      });
      this._system = (response.data.values?.[0]?.[0] as string) || '';
    } catch (error) {
      // If we can't read A2, leave _system empty
      this._system = '';
    }
  }

  /**
   * Execute a function with optional retry (delegates to SheetClient)
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    return this.sheetClient.executeWithRetry(fn);
  }

  /**
   * Convert sheet name or index to a valid range string
   */
  private getSheetRange(sheet: string | number, range?: string): string {
    const sheetRef = typeof sheet === 'number' ? `Sheet${sheet + 1}` : sheet;
    return range ? `${sheetRef}!${range}` : sheetRef;
  }

  /**
   * Get sheet ID by name or index
   * @private
   */
  private async getSheetId(sheet: string | number): Promise<number | null> {
    const client = await this.getClient();

    const response = await this.executeWithRetry(async () => {
      return client.spreadsheets.get({
        spreadsheetId: this.options.spreadsheetId,
      });
    });

    // Convert sheet reference to name for lookup
    const sheetName = typeof sheet === 'number' ? `Sheet${sheet + 1}` : sheet;
    const sheetNameLower = sheetName.toLowerCase();

    const sheetData = response.data.sheets?.find(
      (s) => s.properties?.title?.toLowerCase() === sheetNameLower
    );

    return sheetData?.properties?.sheetId ?? null;
  }

  /**
   * Convert raw 2D array data to objects using headers
   */
  private convertToObjects<T>(
    data: unknown[][],
    headers: string[]
  ): T[] {
    return data.map(row => this.rowToObject(row, headers) as T);
  }

  // ===================
  // Core operations
  // ===================

  /**
   * Read data from a sheet with dual format support (object/array)
   */
  async read<T = Record<string, unknown>>(options: ReadOptions<T>): Promise<SheetData<T>> {
    // Validate options
    if (!options.sheet && options.sheet !== 0) {
      throw new ValidationError('options.sheet is required', [
        'options.sheet: Expected string or number, received undefined',
      ]);
    }

    const client = await this.getClient();
    const range = this.getSheetRange(options.sheet, options.range);
    const format = options.format ?? this.options.defaultFormat ?? 'object';

    // Execute with retry wrapper
    const response = await this.executeWithRetry(async () => {
      // Record request for rate limiting

      return client.spreadsheets.values.get({
        spreadsheetId: this.options.spreadsheetId,
        range,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
      });
    });

    const values = response.data.values ?? [];

    // Return empty result if no data
    if (values.length === 0) {
      return { rows: [], headers: [], range: response.data.range ?? range };
    }

    // Handle array format - return raw 2D array
    if (format === 'array') {
      return {
        rows: values as T[],
        range: response.data.range ?? range,
      };
    }

    // Handle object format - need headers
    let headers: string[];
    let dataRows: unknown[][];

    if (Array.isArray(options.headers)) {
      // Use explicitly provided headers
      headers = options.headers;
      dataRows = values;
    } else if (options.headers === false) {
      // Skip headers - use numeric indices
      headers = values[0]?.map((_, i) => `col${i}`) ?? [];
      dataRows = values;
    } else {
      // Auto-detect: first row is headers (default)
      const firstRow = values[0];
      if (!firstRow) {
        return { rows: [], headers: [], range: response.data.range ?? range };
      }
      headers = firstRow.map((val, i) => String(val ?? `col${i}`));
      dataRows = values.slice(1);
    }

    const rows = this.convertToObjects<T>(dataRows, headers);

    return {
      rows,
      headers,
      range: response.data.range ?? range,
    };
  }

  /**
   * Read multiple ranges in a single API call.
   * More efficient than multiple read() calls.
   * Returns results in the same order as the input queries.
   */
  async batchRead<T = Record<string, unknown>>(
    queries: BatchReadQuery<T>[]
  ): Promise<Array<SheetData<T>>> {
    // Validate queries
    if (!queries || queries.length === 0) {
      throw new ValidationError('queries is required and must not be empty', [
        'queries: Expected non-empty array of read queries',
      ]);
    }

    for (let i = 0; i < queries.length; i++) {
      const q = queries[i]!;
      if (!q.sheet && q.sheet !== 0) {
        throw new ValidationError(`queries[${i}].sheet is required`, [
          `queries[${i}].sheet: Expected string or number, received undefined`,
        ]);
      }
    }

    const client = await this.getClient();

    // Build ranges array
    const ranges = queries.map((q) => this.getSheetRange(q.sheet, q.range));

    // Execute batch get with retry
    const response = await this.executeWithRetry(async () => {
      return client.spreadsheets.values.batchGet({
        spreadsheetId: this.options.spreadsheetId,
        ranges,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
      });
    });

    const valueRanges = response.data.valueRanges ?? [];

    // Process each result
    return queries.map((query, index) => {
      const valueRange = valueRanges[index];
      const values = valueRange?.values ?? [];
      const returnedRange = valueRange?.range ?? ranges[index];
      const format = query.format ?? this.options.defaultFormat ?? 'object';

      // Return empty result if no data
      if (values.length === 0) {
        return { rows: [], headers: [], range: returnedRange };
      }

      // Handle array format - return raw 2D array
      if (format === 'array') {
        return {
          rows: values as T[],
          range: returnedRange,
        };
      }

      // Handle object format - need headers (auto-detect from first row)
      const firstRow = values[0];
      if (!firstRow) {
        return { rows: [], headers: [], range: returnedRange };
      }

      const headers = firstRow.map((val: unknown, i: number) => String(val ?? `col${i}`));
      const dataRows = values.slice(1);
      const rows = this.convertToObjects<T>(dataRows, headers);

      return {
        rows,
        headers,
        range: returnedRange,
      };
    });
  }

  // ===================
  // Workspace operations
  // ===================

  /**
   * Load the default agent base prompt from the prompts directory
   * Falls back to minimal prompt if file not found
   */
  private async loadDefaultAgentBasePrompt(): Promise<string> {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');

      // Try to load from prompts/DEFAULT_AGENT_BASE.md
      const promptPath = path.join(__dirname, '../prompts/DEFAULT_AGENT_BASE.md');
      const content = await fs.readFile(promptPath, 'utf-8');

      if (content.trim()) {
        return content;
      }
    } catch (error) {
      // File not found or not readable, use fallback
      console.warn('Could not load DEFAULT_AGENT_BASE.md, using fallback prompt');
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

This is a starter plan. Once you confirm your goal, I'll create a detailed plan with specific steps, ranges, and success criteria.`;
  }

  /**
   * Initialize the agent base by creating AGENT_BASE sheet with agent context and plan
   * Creates: AGENT_BASE sheet with:
   *   - A1: "AGENT.md Contents" marker, A2: agent context markdown
   *   - B1: "PLAN.md Contents" marker, B2: plan markdown
   * Preserves existing user sheets (non-destructive)
   * Idempotent: safe to call multiple times without overwriting existing content
   * @private
   */
  private async initAgentBase(): Promise<void> {
    const client = await this.getClient();

    // Get existing sheets
    const existingSheets = await this.executeWithRetry(async () => {
      return client.spreadsheets.get({
        spreadsheetId: this.options.spreadsheetId,
      });
    });

    const existingSheetNames = new Set(
      (existingSheets.data.sheets ?? [])
        .map(s => s.properties?.title)
        .filter((title): title is string => title !== undefined)
    );

    // Determine which workspace sheets need to be created
    const workspaceSheetNames = Object.values(WorkspaceSheets);
    const sheetsToCreate = workspaceSheetNames.filter(
      name => !existingSheetNames.has(name)
    );

    // Create missing workspace sheets
    if (sheetsToCreate.length > 0) {
      const addSheetRequests = sheetsToCreate.map(title => ({
        addSheet: {
          properties: {
            title,
          },
        },
      }));

      await this.executeWithRetry(async () => {
          return client.spreadsheets.batchUpdate({
          spreadsheetId: this.options.spreadsheetId,
          requestBody: {
            requests: addSheetRequests,
          },
        });
      });
    }

    // Initialize AGENT_BASE content
    await this.initializeAgentBaseContent(client);
  }

  /**
   * Initialize AGENT_BASE sheet content (agent context and plan)
   * Idempotent: checks for markers and only initializes if missing
   */
  private async initializeAgentBaseContent(
    client: sheets_v4.Sheets
  ): Promise<void> {
    // Check if agent context is already initialized (A1 contains marker)
    let agentContextInitialized = false;
    try {
      const markerResponse = await this.executeWithRetry(async () => {
          return client.spreadsheets.values.get({
          spreadsheetId: this.options.spreadsheetId,
          range: `${WorkspaceSheets.AGENT_BASE}!A1`,
        });
      });
      const markerValue = markerResponse.data.values?.[0]?.[0];
      agentContextInitialized = markerValue === 'AGENT.md Contents';
    } catch (error) {
      // Marker cell doesn't exist yet
      agentContextInitialized = false;
    }

    // Initialize agent context if not already present
    if (!agentContextInitialized) {
      // Write marker to A1
      await this.executeWithRetry(async () => {
          return client.spreadsheets.values.update({
          spreadsheetId: this.options.spreadsheetId,
          range: `${WorkspaceSheets.AGENT_BASE}!A1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [['AGENT.md Contents']],
          },
        });
      });

      // Load and write comprehensive agent context to A2
      const agentContext = await this.loadDefaultAgentBasePrompt();
      await this.executeWithRetry(async () => {
          return client.spreadsheets.values.update({
          spreadsheetId: this.options.spreadsheetId,
          range: `${WorkspaceSheets.AGENT_BASE}!A2`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[agentContext]],
          },
        });
      });
    }

    // Check if plan is already initialized (B1 contains marker)
    let planInitialized = false;
    try {
      const planMarkerResponse = await this.executeWithRetry(async () => {
          return client.spreadsheets.values.get({
          spreadsheetId: this.options.spreadsheetId,
          range: `${WorkspaceSheets.AGENT_BASE}!B1`,
        });
      });
      const planMarkerValue = planMarkerResponse.data.values?.[0]?.[0];
      planInitialized = planMarkerValue === 'PLAN.md Contents';
    } catch (error) {
      // Plan marker cell doesn't exist yet
      planInitialized = false;
    }

    // Initialize plan if not already present
    if (!planInitialized) {
      // Write plan marker to B1
      await this.executeWithRetry(async () => {
          return client.spreadsheets.values.update({
          spreadsheetId: this.options.spreadsheetId,
          range: `${WorkspaceSheets.AGENT_BASE}!B1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [['PLAN.md Contents']],
          },
        });
      });

      // Write starter plan to B2
      const starterPlan = this.generateStarterPlanMarkdown();
      await this.executeWithRetry(async () => {
          return client.spreadsheets.values.update({
          spreadsheetId: this.options.spreadsheetId,
          range: `${WorkspaceSheets.AGENT_BASE}!B2`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[starterPlan]],
          },
        });
      });
    }
  }


  // ===================
  // Plan operations (replaces Task operations)
  // ===================

  /**
   * Get the current plan from AGENT_BASE!C1
   * Returns null if no plan exists
   */
  async getPlan(): Promise<Plan | null> {
    return this.planManager.getPlan();
  }

  /**
   * Create a new plan with phases and steps
   * Replaces any existing plan in AGENT_BASE!C1
   */
  async createPlan(title: string, goal: string, phases: PhaseInput[]): Promise<void> {
    return this.planManager.createPlan(title, goal, phases);
  }

  /**
   * Get the next task to execute (first todo task)
   * Returns null if no tasks are ready
   */
  async getNextTask(): Promise<PlanTask | null> {
    return this.planManager.getNextTask();
  }

  /**
   * Get all tasks that need review
   */
  async getReviewTasks(): Promise<PlanTask[]> {
    return this.planManager.getReviewTasks();
  }

  /**
   * Update task status.
   * Throws if task step not found.
   * @param step - Step identifier (e.g., "1.1", "2.3")
   * @param update - Task update with status and optional reason/note
   */
  async updateTask(step: string, update: TaskUpdate): Promise<void> {
    return this.planManager.updateTask(step, update);
  }

  /**
   * Append a line to the Notes section of the plan.
   * Creates Notes section if it doesn't exist.
   * Useful for working memory (key: value pairs).
   * @param line - Line to append to Notes section
   */
  async appendNotes(line: string): Promise<void> {
    return this.planManager.appendNotes(line);
  }

  // ===================
  // Other core operations
  // ===================

  /**
   * List all sheets in the spreadsheet
   * @returns Array of sheet names
   */
  async listSheets(): Promise<string[]> {
    const client = await this.getClient();
    const response = await this.executeWithRetry(async () => {
      return client.spreadsheets.get({
        spreadsheetId: this.options.spreadsheetId,
        fields: 'sheets.properties.title',
      });
    });

    return response.data.sheets?.map((sheet) => sheet.properties?.title || '') || [];
  }

  /**
   * Create a new sheet tab
   * @param title - Name of the new sheet
   * @returns The new sheet properties
   */
  async createSheet(title: string): Promise<{ sheetId: number; title: string }> {
    if (!title || typeof title !== 'string') {
      throw new ValidationError('title is required', [
        'title: Expected non-empty string, received ' + typeof title,
      ]);
    }

    const client = await this.getClient();
    const response = await this.executeWithRetry(async () => {
      return client.spreadsheets.batchUpdate({
        spreadsheetId: this.options.spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title,
                },
              },
            },
          ],
        },
      });
    });

    const newSheet = response.data.replies?.[0]?.addSheet?.properties;
    if (!newSheet?.sheetId || !newSheet?.title) {
      throw new ValidationError('Failed to create sheet', ['No sheet properties returned from API']);
    }

    return {
      sheetId: newSheet.sheetId,
      title: newSheet.title,
    };
  }

  /**
   * Write data to a sheet
   * Supports both 2D array data and object array data
   */
  async write(options: WriteOptions): Promise<WriteResult> {
    // Validate options
    if (!options.sheet && options.sheet !== 0) {
      throw new ValidationError('options.sheet is required', [
        'options.sheet: Expected string or number, received undefined',
      ]);
    }

    if (!options.data) {
      throw new ValidationError('options.data is required', [
        'options.data: Expected array of arrays or objects, received undefined',
      ]);
    }

    const range = this.getSheetRange(options.sheet, options.range);

    // Convert data to 2D array format
    const values = this.prepareWriteData(options.data, options.headers);

    const client = await this.getClient();

    // Execute with retry wrapper
    const response = await this.executeWithRetry(async () => {
      // Record request for rate limiting

      return client.spreadsheets.values.update({
        spreadsheetId: this.options.spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });
    });

    return {
      updatedRows: response.data.updatedRows ?? 0,
      updatedColumns: response.data.updatedColumns ?? 0,
      updatedCells: response.data.updatedCells ?? 0,
      updatedRange: response.data.updatedRange ?? range,
    };
  }

  /**
   * Clear data from a cell range
   */
  async clear(options: ClearOptions): Promise<ClearResult> {
    // Validate options
    if (!options.sheet && options.sheet !== 0) {
      throw new ValidationError('options.sheet is required', [
        'options.sheet: Expected string or number, received undefined',
      ]);
    }

    if (!options.range) {
      throw new ValidationError('options.range is required', [
        'options.range: Expected string, received undefined',
      ]);
    }

    const range = this.getSheetRange(options.sheet, options.range);
    const client = await this.getClient();

    // Execute with retry wrapper
    const response = await this.executeWithRetry(async () => {
      return client.spreadsheets.values.clear({
        spreadsheetId: this.options.spreadsheetId,
        range,
      });
    });

    return {
      clearedRange: response.data.clearedRange ?? range,
    };
  }

  /**
   * Delete rows from a sheet
   * Deletes one or more rows from the specified sheet
   *
   * @param options - DeleteRowsOptions specifying sheet and row range
   * @returns DeleteRowsResult with count of deleted rows
   * @throws ValidationError if options are invalid
   *
   * @example
   * // Delete a single row
   * await agent.deleteRows({ sheet: 'Sheet1', startRow: 5 });
   *
   * @example
   * // Delete multiple rows
   * await agent.deleteRows({ sheet: 'Sheet1', startRow: 5, endRow: 10 });
   */
  async deleteRows(options: DeleteRowsOptions): Promise<DeleteRowsResult> {
    // Validate options
    if (!options.sheet && options.sheet !== 0) {
      throw new ValidationError('options.sheet is required', [
        'options.sheet: Expected string or number, received undefined',
      ]);
    }

    if (typeof options.startRow !== 'number' || options.startRow < 1) {
      throw new ValidationError('options.startRow must be a positive number (1-indexed)', [
        `options.startRow: Expected positive number, received ${options.startRow}`,
      ]);
    }

    if (options.endRow !== undefined && options.endRow < options.startRow) {
      throw new ValidationError('options.endRow must be >= startRow', [
        `options.endRow: Expected >= ${options.startRow}, received ${options.endRow}`,
      ]);
    }

    // Get sheet ID
    const sheetId = await this.getSheetId(options.sheet);
    if (sheetId === null) {
      throw new ValidationError(`Sheet not found: ${options.sheet}`);
    }

    const client = await this.getClient();

    // Convert 1-indexed row numbers to 0-indexed for API
    // startIndex is inclusive, endIndex is exclusive
    const startIndex = options.startRow - 1;
    const endIndex = options.endRow ? options.endRow : options.startRow;

    // Execute with retry wrapper
    await this.executeWithRetry(async () => {
      return client.spreadsheets.batchUpdate({
        spreadsheetId: this.options.spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: 'ROWS',
                  startIndex: startIndex,
                  endIndex: endIndex,
                },
              },
            },
          ],
        },
      });
    });

    const deletedRows = endIndex - startIndex;

    return {
      deletedRows,
    };
  }

  /**
   * Prepare data for writing to the sheet
   * Converts objects to 2D arrays if needed, handles headers
   */
  private prepareWriteData(
    data: unknown[][] | Record<string, unknown>[],
    headers?: string[] | boolean
  ): unknown[][] {
    // If data is empty, return empty array
    if (data.length === 0) {
      return [];
    }

    // Check if data is already a 2D array
    const firstRow = data[0];
    if (Array.isArray(firstRow)) {
      // Already 2D array, return as-is
      return data as unknown[][];
    }

    // Data is an array of objects - convert to 2D array
    const objectData = data as Record<string, unknown>[];

    // Determine headers
    let headerRow: string[];
    if (Array.isArray(headers)) {
      headerRow = headers;
    } else {
      // Use keys from first object
      headerRow = Object.keys(objectData[0] ?? {});
    }

    // Convert objects to rows
    const rows = objectData.map(obj =>
      headerRow.map(key => {
        const value = obj[key];
        // Convert null/undefined to empty string
        return value ?? '';
      })
    );

    // Include header row unless explicitly disabled
    if (headers === false) {
      return rows;
    }

    return [headerRow, ...rows];
  }

  /**
   * Search for rows matching query criteria
   * Supports 'and'/'or' operators and 'strict'/'loose' matching
   */
  async search<T = Record<string, unknown>>(options: SearchOptions<T>): Promise<SearchResult<T>> {
    // Validate options
    if (!options.sheet && options.sheet !== 0) {
      throw new ValidationError('options.sheet is required', [
        'options.sheet: Expected string or number, received undefined',
      ]);
    }

    if (!options.query) {
      throw new ValidationError('options.query is required', [
        'options.query: Expected object with search criteria, received undefined',
      ]);
    }

    const client = await this.getClient();
    const range = this.getSheetRange(options.sheet, undefined);
    const operator = options.operator ?? 'and';
    const matching = options.matching ?? 'strict';

    // Execute with retry wrapper
    const response = await this.executeWithRetry(async () => {
      // Record request for rate limiting

      return client.spreadsheets.values.get({
        spreadsheetId: this.options.spreadsheetId,
        range,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
      });
    });

    const values = response.data.values ?? [];

    // Need at least a header row
    if (values.length === 0) {
      return { rows: [], matchedCount: 0, searchedCount: 0 };
    }

    // Extract headers and data rows
    const headerRow = values[0];
    if (!headerRow) {
      return { rows: [], matchedCount: 0, searchedCount: 0 };
    }

    const headers = headerRow.map((val, i) => String(val ?? `col${i}`));
    const dataRows = values.slice(1);

    if (dataRows.length === 0) {
      return { rows: [], matchedCount: 0, searchedCount: 0 };
    }

    // Convert query to entries for easier processing
    const queryEntries = Object.entries(options.query);

    // Filter rows based on query
    const matchedRows = dataRows.filter(row => {
      const rowObj = this.rowToObject(row, headers);

      if (operator === 'and') {
        // All conditions must match
        return queryEntries.every(([key, value]) =>
          this.matchesCondition(rowObj[key], value, matching)
        );
      } else {
        // At least one condition must match
        return queryEntries.some(([key, value]) =>
          this.matchesCondition(rowObj[key], value, matching)
        );
      }
    });

    // Convert matched rows to objects
    const rows = matchedRows.map(row => this.rowToObject(row, headers)) as T[];

    return {
      rows,
      matchedCount: matchedRows.length,
      searchedCount: dataRows.length,
    };
  }

  /**
   * Convert a row array to an object using headers
   */
  private rowToObject(row: unknown[], headers: string[]): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? null;
    });
    return obj;
  }

  /**
   * Check if a cell value matches the query value
   */
  private matchesCondition(
    cellValue: unknown,
    queryValue: unknown,
    matching: 'strict' | 'loose'
  ): boolean {
    // Handle null/undefined
    if (cellValue === null || cellValue === undefined) {
      return queryValue === null || queryValue === undefined;
    }

    if (matching === 'strict') {
      // Exact match (with type coercion for numbers)
      if (typeof cellValue === 'number' && typeof queryValue === 'number') {
        return cellValue === queryValue;
      }
      if (typeof cellValue === 'number' || typeof queryValue === 'number') {
        // Compare as numbers if either is a number
        return Number(cellValue) === Number(queryValue);
      }
      return cellValue === queryValue;
    } else {
      // Loose matching - substring search (case-insensitive)
      const cellStr = String(cellValue).toLowerCase();
      const queryStr = String(queryValue).toLowerCase();
      return cellStr.includes(queryStr);
    }
  }
}
