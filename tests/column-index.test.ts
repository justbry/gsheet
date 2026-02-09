import { test, expect, describe } from 'vitest';

// Test the column index to letter conversion logic
function columnIndexToLetter(index: number): string {
  let letter = '';
  let num = index;

  while (num >= 0) {
    letter = String.fromCharCode((num % 26) + 65) + letter;
    num = Math.floor(num / 26) - 1;
  }

  return letter;
}

describe('columnIndexToLetter', () => {
  test('should convert 0 to A', () => {
    expect(columnIndexToLetter(0)).toBe('A');
  });

  test('should convert 1 to B', () => {
    expect(columnIndexToLetter(1)).toBe('B');
  });

  test('should convert 25 to Z', () => {
    expect(columnIndexToLetter(25)).toBe('Z');
  });

  test('should convert 26 to AA', () => {
    expect(columnIndexToLetter(26)).toBe('AA');
  });

  test('should convert 27 to AB', () => {
    expect(columnIndexToLetter(27)).toBe('AB');
  });

  test('should convert 51 to AZ', () => {
    expect(columnIndexToLetter(51)).toBe('AZ');
  });

  test('should convert 52 to BA', () => {
    expect(columnIndexToLetter(52)).toBe('BA');
  });

  test('should convert 701 to ZZ', () => {
    expect(columnIndexToLetter(701)).toBe('ZZ');
  });

  test('should convert 702 to AAA', () => {
    expect(columnIndexToLetter(702)).toBe('AAA');
  });
});
