import { vi } from 'vitest';
import type { ServiceAccountCredentials, Plan } from '../../src/types';

/**
 * Mock credentials for testing
 */
export const mockCredentials: ServiceAccountCredentials = {
  type: 'service_account',
  project_id: 'test-project',
  private_key_id: 'key-id',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIE...fake...key\n-----END PRIVATE KEY-----\n',
  client_email: 'test@test-project.iam.gserviceaccount.com',
  client_id: '123456789',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/test',
};

/**
 * Default sheet data for mocking
 */
export const DEFAULT_SHEET_DATA = [
  ['name', 'email', 'age'],
  ['Alice', 'alice@example.com', 30],
  ['Bob', 'bob@example.com', 25],
];

/**
 * Create a mock Google Sheets values.get response
 */
export function createMockGetResponse(
  values: unknown[][] = DEFAULT_SHEET_DATA,
  range: string = 'Sheet1!A1:C3'
) {
  return {
    data: {
      values,
      range,
    },
  };
}

/**
 * Create a mock Google Sheets values.update response
 */
export function createMockUpdateResponse(options: {
  updatedRows?: number;
  updatedColumns?: number;
  updatedCells?: number;
  updatedRange?: string;
} = {}) {
  return {
    data: {
      updatedRows: options.updatedRows ?? 2,
      updatedColumns: options.updatedColumns ?? 3,
      updatedCells: options.updatedCells ?? 6,
      updatedRange: options.updatedRange ?? 'Sheet1!A1:C2',
    },
  };
}

/**
 * Create a mock Google Sheets API with custom mocks
 */
export function createMockGoogleSheets(options: {
  getMock?: ReturnType<typeof vi.fn>;
  updateMock?: ReturnType<typeof vi.fn>;
  batchUpdateMock?: ReturnType<typeof vi.fn>;
  appendMock?: ReturnType<typeof vi.fn>;
} = {}) {
  const mockGet = options.getMock ?? vi.fn().mockResolvedValue(createMockGetResponse());
  const mockUpdate = options.updateMock ?? vi.fn().mockResolvedValue(createMockUpdateResponse());
  const mockBatchUpdate = options.batchUpdateMock ?? vi.fn().mockResolvedValue({ data: {} });
  const mockAppend = options.appendMock ?? vi.fn().mockResolvedValue({ data: {} });

  return {
    google: {
      auth: {
        GoogleAuth: vi.fn().mockImplementation(() => ({})),
      },
      sheets: vi.fn().mockImplementation(() => ({
        spreadsheets: {
          values: {
            get: mockGet,
            update: mockUpdate,
            append: mockAppend,
          },
          batchUpdate: mockBatchUpdate,
        },
      })),
    },
    mocks: {
      get: mockGet,
      update: mockUpdate,
      batchUpdate: mockBatchUpdate,
      append: mockAppend,
    },
  };
}

/**
 * Default test spreadsheet ID
 */
export const TEST_SPREADSHEET_ID = 'test-spreadsheet-id';

/**
 * Create default agent options for testing
 */
export function createAgentOptions(overrides: Record<string, unknown> = {}) {
  return {
    spreadsheetId: TEST_SPREADSHEET_ID,
    credentials: mockCredentials,
    ...overrides,
  };
}

/**
 * Mock Plan for testing
 */
export const mockPlan: Plan = {
  title: 'Test Plan',
  goal: 'Test goal',
  phases: [
    {
      number: 1,
      name: 'Setup',
      tasks: [
        { line: 10, phase: 1, step: '1.1', status: 'todo', title: 'First task' },
        { line: 11, phase: 1, step: '1.2', status: 'doing', title: 'Second task' },
        { line: 12, phase: 1, step: '1.3', status: 'done', title: 'Third task', completedDate: '2026-01-11' },
      ],
    },
    {
      number: 2,
      name: 'Execution',
      tasks: [
        { line: 14, phase: 2, step: '2.1', status: 'todo', title: 'Execute step one' },
      ],
    },
  ],
  notes: 'Test notes',
  raw: '# Plan: Test Plan\n\nGoal: Test goal\n\n### Phase 1: Setup\n- [ ] 1.1 First task\n- [/] 1.2 Second task\n- [x] 1.3 Third task ✅ 2026-01-11\n\n### Phase 2: Execution\n- [ ] 2.1 Execute step one\n\n## Notes\n\nTest notes',
};
