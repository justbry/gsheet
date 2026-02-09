import { test, expect, describe } from 'vitest';
import { extractSpreadsheetId } from '../src/parser';

describe('extractSpreadsheetId', () => {
  test('should extract ID from full URL', () => {
    const url = 'https://docs.google.com/spreadsheets/d/1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8/edit?gid=275232686#gid=275232686';
    const result = extractSpreadsheetId(url);
    expect(result).toBe('1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8');
  });

  test('should extract ID from URL without query params', () => {
    const url = 'https://docs.google.com/spreadsheets/d/1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8/edit';
    const result = extractSpreadsheetId(url);
    expect(result).toBe('1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8');
  });

  test('should return plain ID as-is', () => {
    const id = '1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8';
    const result = extractSpreadsheetId(id);
    expect(result).toBe('1EJh-PTWiBLgYHTbiSfwmJdeJ1W-iQ-H5WiHEN9WPpu8');
  });

  test('should handle short IDs', () => {
    const id = 'ABC123xyz';
    const result = extractSpreadsheetId(id);
    expect(result).toBe('ABC123xyz');
  });

  test('should handle IDs with hyphens and underscores', () => {
    const id = 'ABC-123_xyz';
    const result = extractSpreadsheetId(id);
    expect(result).toBe('ABC-123_xyz');
  });

  test('should throw error for malformed URL', () => {
    const url = 'https://docs.google.com/invalid/path';
    expect(() => extractSpreadsheetId(url)).toThrow('Could not extract spreadsheet ID from URL');
  });

  test('should extract from URL with different edit modes', () => {
    const url = 'https://docs.google.com/spreadsheets/d/ABC123/edit#gid=0';
    const result = extractSpreadsheetId(url);
    expect(result).toBe('ABC123');
  });

  test('should extract from copy URL', () => {
    const url = 'https://docs.google.com/spreadsheets/d/ABC123/copy';
    const result = extractSpreadsheetId(url);
    expect(result).toBe('ABC123');
  });
});
