import { describe, it, expect } from 'vitest';
import {
  parseArgs,
  validateCommand,
  extractAuthOptions,
  getHelpText,
  getVersionText,
} from '../../src/cli/parser';

describe('Parser', () => {
  describe('parseArgs()', () => {
    it('should parse simple command', () => {
      const result = parseArgs(['ls']);

      expect(result.command).toBe('ls');
      expect(result.args).toEqual([]);
      expect(result.flags).toEqual({});
    });

    it('should parse command with args', () => {
      const result = parseArgs(['read', 'PLAN.md']);

      expect(result.command).toBe('read');
      expect(result.args).toEqual(['PLAN.md']);
      expect(result.flags).toEqual({});
    });

    it('should parse flags with values', () => {
      const result = parseArgs(['write', 'NOTES.md', '--content', 'Hello World', '--desc', 'notes']);

      expect(result.command).toBe('write');
      expect(result.args).toEqual(['NOTES.md']);
      expect(result.flags).toEqual({
        content: 'Hello World',
        desc: 'notes',
      });
    });

    it('should parse boolean flags', () => {
      const result = parseArgs(['ls', '--json', '--metadata']);

      expect(result.command).toBe('ls');
      expect(result.flags).toEqual({
        json: true,
        metadata: true,
      });
    });

    it('should parse mixed flags and args', () => {
      const result = parseArgs([
        'write',
        'FILE.md',
        '--spreadsheet-id',
        'ABC123',
        '--content',
        'Content here',
        '--json',
      ]);

      expect(result.command).toBe('write');
      expect(result.args).toEqual(['FILE.md']);
      expect(result.flags).toEqual({
        'spreadsheet-id': 'ABC123',
        content: 'Content here',
        json: true,
      });
    });

    it('should normalize -h to --help', () => {
      const result = parseArgs(['-h']);

      expect(result.flags.help).toBe(true);
    });

    it('should normalize -v to --version', () => {
      const result = parseArgs(['-v']);

      expect(result.flags.version).toBe(true);
    });

    it('should throw error for unknown flag', () => {
      expect(() => parseArgs(['ls', '--unknown'])).toThrow('Unknown flag: --unknown');
    });

    it('should handle multiple args', () => {
      const result = parseArgs(['command', 'arg1', 'arg2', 'arg3']);

      expect(result.command).toBe('command');
      expect(result.args).toEqual(['arg1', 'arg2', 'arg3']);
    });
  });

  describe('validateCommand()', () => {
    it('should pass for valid ls command', () => {
      const parsed = {
        command: 'ls',
        args: [],
        flags: { 'spreadsheet-id': 'ABC123' },
      };

      expect(() => validateCommand(parsed)).not.toThrow();
    });

    it('should pass for help command without spreadsheet-id', () => {
      const parsed = {
        command: 'help',
        args: [],
        flags: {},
      };

      expect(() => validateCommand(parsed)).not.toThrow();
    });

    it('should pass for version command without spreadsheet-id', () => {
      const parsed = {
        command: 'version',
        args: [],
        flags: {},
      };

      expect(() => validateCommand(parsed)).not.toThrow();
    });

    it('should pass for --help flag without spreadsheet-id', () => {
      const parsed = {
        command: '',
        args: [],
        flags: { help: true },
      };

      expect(() => validateCommand(parsed)).not.toThrow();
    });

    it('should throw for missing command', () => {
      const parsed = {
        command: '',
        args: [],
        flags: { 'spreadsheet-id': 'ABC123' },
      };

      expect(() => validateCommand(parsed)).toThrow('No command specified');
    });

    it('should throw for invalid command', () => {
      const parsed = {
        command: 'invalid',
        args: [],
        flags: { 'spreadsheet-id': 'ABC123' },
      };

      expect(() => validateCommand(parsed)).toThrow('Unknown command: invalid');
    });

    it('should not throw for missing spreadsheet-id (deferred to resolveSpreadsheetId)', () => {
      const parsed = {
        command: 'ls',
        args: [],
        flags: {},
      };

      expect(() => validateCommand(parsed)).not.toThrow();
    });

    it('should throw for read without filename', () => {
      const parsed = {
        command: 'read',
        args: [],
        flags: { 'spreadsheet-id': 'ABC123' },
      };

      expect(() => validateCommand(parsed)).toThrow('Command "read" requires a filename argument');
    });

    it('should throw for write without filename', () => {
      const parsed = {
        command: 'write',
        args: [],
        flags: { 'spreadsheet-id': 'ABC123', content: 'Hello' },
      };

      expect(() => validateCommand(parsed)).toThrow('Command "write" requires a filename argument');
    });

    it('should throw for write without content or file flag', () => {
      const parsed = {
        command: 'write',
        args: ['FILE.md'],
        flags: { 'spreadsheet-id': 'ABC123' },
      };

      expect(() => validateCommand(parsed)).toThrow(
        'Command "write" requires either --content or --file flag'
      );
    });

    it('should pass for write with content flag', () => {
      const parsed = {
        command: 'write',
        args: ['FILE.md'],
        flags: { 'spreadsheet-id': 'ABC123', content: 'Hello' },
      };

      expect(() => validateCommand(parsed)).not.toThrow();
    });

    it('should pass for write with file flag', () => {
      const parsed = {
        command: 'write',
        args: ['FILE.md'],
        flags: { 'spreadsheet-id': 'ABC123', file: './local.md' },
      };

      expect(() => validateCommand(parsed)).not.toThrow();
    });

    it('should throw for delete without filename', () => {
      const parsed = {
        command: 'delete',
        args: [],
        flags: { 'spreadsheet-id': 'ABC123' },
      };

      expect(() => validateCommand(parsed)).toThrow('Command "delete" requires a filename argument');
    });

    it('should accept command aliases', () => {
      expect(() =>
        validateCommand({ command: 'list', args: [], flags: { 'spreadsheet-id': 'ABC' } })
      ).not.toThrow();
      expect(() =>
        validateCommand({ command: 'cat', args: ['file'], flags: { 'spreadsheet-id': 'ABC' } })
      ).not.toThrow();
      expect(() =>
        validateCommand({
          command: 'rm',
          args: ['file'],
          flags: { 'spreadsheet-id': 'ABC' },
        })
      ).not.toThrow();
    });
  });

  describe('extractAuthOptions()', () => {
    it('should extract spreadsheet-id', () => {
      const flags = { 'spreadsheet-id': 'ABC123' };
      const result = extractAuthOptions(flags);

      expect(result.spreadsheetId).toBe('ABC123');
    });

    it('should extract credentials path', () => {
      const flags = { credentials: './creds.json' };
      const result = extractAuthOptions(flags);

      expect(result.credentials).toBe('./creds.json');
    });

    it('should extract env flag', () => {
      const flags = { env: true };
      const result = extractAuthOptions(flags);

      expect(result.env).toBe(true);
    });

    it('should handle missing flags', () => {
      const flags = {};
      const result = extractAuthOptions(flags);

      expect(result.spreadsheetId).toBeUndefined();
      expect(result.credentials).toBeUndefined();
      expect(result.env).toBeUndefined();
    });

    it('should ignore non-string spreadsheet-id', () => {
      const flags = { 'spreadsheet-id': true };
      const result = extractAuthOptions(flags);

      expect(result.spreadsheetId).toBeUndefined();
    });
  });

  describe('getHelpText()', () => {
    it('should return help text', () => {
      const help = getHelpText();

      expect(help).toContain('Google Sheets Agent CLI');
      expect(help).toContain('USAGE:');
      expect(help).toContain('COMMANDS:');
      expect(help).toContain('OPTIONS:');
      expect(help).toContain('EXAMPLES:');
    });

    it('should include all commands', () => {
      const help = getHelpText();

      expect(help).toContain('ls, list');
      expect(help).toContain('read, cat');
      expect(help).toContain('write');
      expect(help).toContain('delete, rm');
      expect(help).toContain('shell');
      expect(help).toContain('help');
      expect(help).toContain('version');
    });
  });

  describe('getVersionText()', () => {
    it('should return version text', () => {
      const version = getVersionText();

      expect(version).toContain('gsheet');
      expect(version).toMatch(/\d+\.\d+\.\d+/); // Should contain version number
    });
  });
});
