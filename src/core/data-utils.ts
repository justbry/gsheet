/**
 * Data Conversion Utilities - Pure data transformation functions
 *
 * Extracted from SheetAgent to enable reuse by managers and tests.
 * These are pure functions with no external dependencies or side effects.
 */

// =============================================================================
// Row/Object Conversion
// =============================================================================

/**
 * Convert a row array to an object using headers
 *
 * @param row - Array of cell values
 * @param headers - Array of header names corresponding to columns
 * @returns Object with headers as keys and row values as values
 *
 * @example
 * ```ts
 * rowToObject(['John', 30], ['name', 'age'])
 * // => { name: 'John', age: 30 }
 * ```
 */
export function rowToObject(row: unknown[], headers: string[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  headers.forEach((header, index) => {
    obj[header] = row[index] ?? null;
  });
  return obj;
}

/**
 * Convert raw 2D array data to objects using headers
 *
 * @param data - 2D array of data rows (without header row)
 * @param headers - Array of header names
 * @returns Array of objects with headers as keys
 *
 * @example
 * ```ts
 * convertToObjects([['John', 30], ['Jane', 25]], ['name', 'age'])
 * // => [{ name: 'John', age: 30 }, { name: 'Jane', age: 25 }]
 * ```
 */
export function convertToObjects<T>(
  data: unknown[][],
  headers: string[]
): T[] {
  return data.map(row => rowToObject(row, headers) as T);
}

// =============================================================================
// Write Data Preparation
// =============================================================================

/**
 * Prepare data for writing to the sheet
 *
 * Converts objects to 2D arrays if needed, handles headers.
 * If data is already a 2D array, returns as-is.
 * If data is an array of objects, converts to 2D array with optional header row.
 *
 * @param data - Either a 2D array or array of objects
 * @param headers - Header configuration:
 *   - Array: Use these specific headers
 *   - true/undefined: Auto-detect from first object's keys
 *   - false: Don't include header row
 * @returns 2D array ready for writing to sheet
 *
 * @example
 * ```ts
 * // With auto-detected headers
 * prepareWriteData([{ name: 'John', age: 30 }])
 * // => [['name', 'age'], ['John', 30]]
 *
 * // Without headers
 * prepareWriteData([{ name: 'John', age: 30 }], false)
 * // => [['John', 30]]
 *
 * // With custom headers
 * prepareWriteData([{ name: 'John', age: 30 }], ['name', 'age'])
 * // => [['name', 'age'], ['John', 30]]
 * ```
 */
export function prepareWriteData(
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

// =============================================================================
// Value Matching
// =============================================================================

/**
 * Check if a cell value matches the query value
 *
 * @param cellValue - The cell value to test
 * @param queryValue - The value to match against
 * @param matching - Matching mode:
 *   - 'strict': Exact match with type coercion for numbers
 *   - 'loose': Case-insensitive substring search
 * @returns True if the values match according to the matching mode
 *
 * @example
 * ```ts
 * // Strict matching
 * matchesCondition('42', 42, 'strict')  // => true (number coercion)
 * matchesCondition('hello', 'Hello', 'strict')  // => false (case-sensitive)
 *
 * // Loose matching
 * matchesCondition('Hello World', 'world', 'loose')  // => true (case-insensitive substring)
 * matchesCondition(42, '4', 'loose')  // => true (substring match)
 * ```
 */
export function matchesCondition(
  cellValue: unknown,
  queryValue: unknown,
  matching: 'strict' | 'loose'
): boolean {
  if (matching === 'strict') {
    // Handle null/undefined - only match if both are null/undefined
    if (cellValue === null || cellValue === undefined) {
      return queryValue === null || queryValue === undefined;
    }
    if (queryValue === null || queryValue === undefined) {
      return false; // cellValue is not null/undefined, so no match
    }

    // Exact match (with type coercion for numbers)
    if (typeof cellValue === 'number' && typeof queryValue === 'number') {
      return cellValue === queryValue;
    }
    if (typeof cellValue === 'number' || typeof queryValue === 'number') {
      // Only coerce if both are not empty strings
      // Empty string should not match 0
      if (cellValue === '' || queryValue === '') {
        return false;
      }
      // Compare as numbers if either is a number
      return Number(cellValue) === Number(queryValue);
    }
    return cellValue === queryValue;
  } else {
    // Loose matching - substring search (case-insensitive)
    // Special case: treat 0 and "" as equivalent "empty" values
    const cellIsEmpty = cellValue === '' || cellValue === 0;
    const queryIsEmpty = queryValue === '' || queryValue === 0;
    if (cellIsEmpty && queryIsEmpty) {
      return true;
    }

    // Convert to strings (null -> "null", undefined -> "undefined")
    const cellStr = String(cellValue).toLowerCase();
    const queryStr = String(queryValue).toLowerCase();
    return cellStr.includes(queryStr);
  }
}
