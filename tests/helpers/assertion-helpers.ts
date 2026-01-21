import { expect } from 'vitest';
import type { Mock } from 'vitest';

/**
 * Assert that a batch update was called with specific request structure
 */
export function expectBatchUpdateCalled(
  mockFn: Mock,
  expectedRequest: Record<string, unknown>,
  spreadsheetId: string = 'test-spreadsheet-id'
) {
  expect(mockFn).toHaveBeenCalledWith(
    expect.objectContaining({
      spreadsheetId,
      requestBody: expect.objectContaining({
        requests: expect.arrayContaining([
          expect.objectContaining(expectedRequest),
        ]),
      }),
    })
  );
}

/**
 * Assert that an update was called with specific value structure
 */
export function expectUpdateCalled(
  mockFn: Mock,
  expectedValues: unknown[][],
  spreadsheetId: string = 'test-spreadsheet-id'
) {
  expect(mockFn).toHaveBeenCalledWith(
    expect.objectContaining({
      spreadsheetId,
      requestBody: expect.objectContaining({
        values: expectedValues,
      }),
    })
  );
}

/**
 * Assert that a ValidationError was thrown with specific message
 */
export async function expectValidationError(
  promise: Promise<unknown>,
  expectedMessage?: string
) {
  await expect(promise).rejects.toThrow('Validation failed');
  if (expectedMessage) {
    await expect(promise).rejects.toThrow(expectedMessage);
  }
}

/**
 * Assert sheet range format in get/update calls
 */
export function expectRangeCalled(
  mockFn: Mock,
  expectedRange: string,
  spreadsheetId: string = 'test-spreadsheet-id'
) {
  expect(mockFn).toHaveBeenCalledWith(
    expect.objectContaining({
      spreadsheetId,
      range: expectedRange,
    })
  );
}
