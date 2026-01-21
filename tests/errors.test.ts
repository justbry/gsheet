import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  PermissionError,
  NetworkError,
  AgentPausedError,
  AuthError,
} from '../src/errors';

describe('Error Classes', () => {
  describe('ValidationError', () => {
    it('should create with message only', () => {
      const error = new ValidationError('Invalid input');
      expect(error.message).toContain('Validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.fix).toBeDefined();
      expect(error.details).toEqual([]);
    });

    it('should create with details', () => {
      const error = new ValidationError('Invalid input', [
        'options.sheet: Expected string, received number',
        'options.range: Invalid A1 notation',
      ]);
      expect(error.message).toContain('options.sheet');
      expect(error.message).toContain('options.range');
      expect(error.details).toHaveLength(2);
    });
  });

  describe('PermissionError', () => {
    it('should create with sheet name only', () => {
      const error = new PermissionError('Leads');
      expect(error.message).toBe("Cannot access sheet 'Leads'");
      expect(error.code).toBe('PERMISSION_ERROR');
      expect(error.sheet).toBe('Leads');
      expect(error.fix).toContain('Share the spreadsheet');
    });

    it('should create with service account', () => {
      const error = new PermissionError('Leads', 'service@project.iam.gserviceaccount.com');
      expect(error.fix).toContain('service@project.iam.gserviceaccount.com');
    });
  });

  describe('NetworkError', () => {
    it('should create with original error', () => {
      const error = new NetworkError('ECONNRESET');
      expect(error.message).toContain('ECONNRESET');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.originalError).toBe('ECONNRESET');
    });

    it('should create with retry info', () => {
      const error = new NetworkError('ETIMEDOUT', 2, 3);
      expect(error.message).toContain('attempt 2/3');
      expect(error.attempt).toBe(2);
      expect(error.maxAttempts).toBe(3);
    });
  });

  describe('AgentPausedError', () => {
    it('should create with correct message and fix', () => {
      const error = new AgentPausedError();
      expect(error.message).toBe('Agent is paused');
      expect(error.code).toBe('AGENT_PAUSED_ERROR');
      expect(error.fix).toContain('resume()');
    });
  });

  describe('AuthError', () => {
    it('should create with default message', () => {
      const error = new AuthError();
      expect(error.message).toBe('No credentials found');
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.fix).toContain('options.credentials');
      expect(error.fix).toContain('CREDENTIALS_CONFIG');
      expect(error.fix).toContain('options.keyFile');
    });

    it('should create with custom message', () => {
      const error = new AuthError('Invalid credentials format');
      expect(error.message).toBe('Invalid credentials format');
    });
  });
});
