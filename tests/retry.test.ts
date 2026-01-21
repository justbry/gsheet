import { describe, it, expect, vi } from "vitest";
import {
  withRetry,
  calculateBackoffDelay,
  isRetryableError,
  getRetryAfterSeconds,
  getDefaultRetryOptions,
  DEFAULT_RETRYABLE_ERRORS,
  RETRYABLE_STATUS_CODES,
  type RetryOptions,
} from "../src/core/sheet-client";
import { NetworkError } from "../src/errors";

// Test options with very short delays for fast tests
const getTestRetryOptions = (
  overrides?: Partial<RetryOptions>,
): RetryOptions => ({
  maxAttempts: 3,
  baseDelayMs: 10, // Very short for tests
  maxDelayMs: 50,
  retryableErrors: DEFAULT_RETRYABLE_ERRORS,
  ...overrides,
});

describe("Retry Utility", () => {
  describe("calculateBackoffDelay()", () => {
    it("should calculate exponential delay for first attempt", () => {
      const delay = calculateBackoffDelay(0, 1000, 30000);
      // First attempt: 1000 * 2^0 = 1000 + jitter (0-100ms)
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThanOrEqual(1100);
    });

    it("should calculate exponential delay for second attempt", () => {
      const delay = calculateBackoffDelay(1, 1000, 30000);
      // Second attempt: 1000 * 2^1 = 2000 + jitter (0-200ms)
      expect(delay).toBeGreaterThanOrEqual(2000);
      expect(delay).toBeLessThanOrEqual(2200);
    });

    it("should calculate exponential delay for third attempt", () => {
      const delay = calculateBackoffDelay(2, 1000, 30000);
      // Third attempt: 1000 * 2^2 = 4000 + jitter (0-400ms)
      expect(delay).toBeGreaterThanOrEqual(4000);
      expect(delay).toBeLessThanOrEqual(4400);
    });

    it("should cap delay at maxDelayMs", () => {
      const delay = calculateBackoffDelay(10, 1000, 30000);
      // 10th attempt would be 1000 * 2^10 = 1024000, but capped at 30000
      expect(delay).toBeGreaterThanOrEqual(30000);
      expect(delay).toBeLessThanOrEqual(33000); // 30000 + 10% jitter
    });
  });

  describe("isRetryableError()", () => {
    it("should return true for NetworkError", () => {
      const error = new NetworkError("Connection reset", 1, 3);
      expect(isRetryableError(error, DEFAULT_RETRYABLE_ERRORS)).toBe(true);
    });

    it("should return true for 429 status code", () => {
      const error = { response: { status: 429 } };
      expect(isRetryableError(error, DEFAULT_RETRYABLE_ERRORS)).toBe(true);
    });

    it("should return true for 500 status code", () => {
      const error = { response: { status: 500 } };
      expect(isRetryableError(error, DEFAULT_RETRYABLE_ERRORS)).toBe(true);
    });

    it("should return true for 502 status code", () => {
      const error = { response: { status: 502 } };
      expect(isRetryableError(error, DEFAULT_RETRYABLE_ERRORS)).toBe(true);
    });

    it("should return true for 503 status code", () => {
      const error = { response: { status: 503 } };
      expect(isRetryableError(error, DEFAULT_RETRYABLE_ERRORS)).toBe(true);
    });

    it("should return true for 504 status code", () => {
      const error = { response: { status: 504 } };
      expect(isRetryableError(error, DEFAULT_RETRYABLE_ERRORS)).toBe(true);
    });

    it("should return true for ECONNRESET", () => {
      const error = { code: "ECONNRESET" };
      expect(isRetryableError(error, DEFAULT_RETRYABLE_ERRORS)).toBe(true);
    });

    it("should return true for ETIMEDOUT", () => {
      const error = { code: "ETIMEDOUT" };
      expect(isRetryableError(error, DEFAULT_RETRYABLE_ERRORS)).toBe(true);
    });

    it("should return true for ENOTFOUND", () => {
      const error = { code: "ENOTFOUND" };
      expect(isRetryableError(error, DEFAULT_RETRYABLE_ERRORS)).toBe(true);
    });

    it("should return true for ECONNREFUSED", () => {
      const error = { code: "ECONNREFUSED" };
      expect(isRetryableError(error, DEFAULT_RETRYABLE_ERRORS)).toBe(true);
    });

    it("should return true for error with code in cause", () => {
      const error = { cause: { code: "ECONNRESET" } };
      expect(isRetryableError(error, DEFAULT_RETRYABLE_ERRORS)).toBe(true);
    });

    it("should return false for 400 Bad Request", () => {
      const error = { response: { status: 400 } };
      expect(isRetryableError(error, DEFAULT_RETRYABLE_ERRORS)).toBe(false);
    });

    it("should return false for 401 Unauthorized", () => {
      const error = { response: { status: 401 } };
      expect(isRetryableError(error, DEFAULT_RETRYABLE_ERRORS)).toBe(false);
    });

    it("should return false for 403 Forbidden", () => {
      const error = { response: { status: 403 } };
      expect(isRetryableError(error, DEFAULT_RETRYABLE_ERRORS)).toBe(false);
    });

    it("should return false for 404 Not Found", () => {
      const error = { response: { status: 404 } };
      expect(isRetryableError(error, DEFAULT_RETRYABLE_ERRORS)).toBe(false);
    });

    it("should return false for non-retryable error code", () => {
      const error = { code: "UNKNOWN_ERROR" };
      expect(isRetryableError(error, DEFAULT_RETRYABLE_ERRORS)).toBe(false);
    });

    it("should return true for status code in error message", () => {
      const error = new Error("Request failed with status 429");
      expect(isRetryableError(error, DEFAULT_RETRYABLE_ERRORS)).toBe(true);
    });
  });

  describe("getRetryAfterSeconds()", () => {
    it("should extract retry-after from headers (string)", () => {
      const error = {
        response: {
          headers: {
            "retry-after": "60",
          },
        },
      };
      expect(getRetryAfterSeconds(error)).toBe(60);
    });

    it("should extract retry-after from headers (number)", () => {
      const error = {
        response: {
          headers: {
            "retry-after": 120,
          },
        },
      };
      expect(getRetryAfterSeconds(error)).toBe(120);
    });

    it("should extract Retry-After (capitalized) from headers", () => {
      const error = {
        response: {
          headers: {
            "Retry-After": "30",
          },
        },
      };
      expect(getRetryAfterSeconds(error)).toBe(30);
    });

    it("should return null if no retry-after header", () => {
      const error = {
        response: {
          headers: {},
        },
      };
      expect(getRetryAfterSeconds(error)).toBe(null);
    });

    it("should return null for non-object error", () => {
      expect(getRetryAfterSeconds("error")).toBe(null);
      expect(getRetryAfterSeconds(null)).toBe(null);
      expect(getRetryAfterSeconds(undefined)).toBe(null);
    });
  });

  describe("getDefaultRetryOptions()", () => {
    it("should return default options when no config provided", () => {
      const options = getDefaultRetryOptions();
      expect(options.maxAttempts).toBe(3);
      expect(options.baseDelayMs).toBe(1000);
      expect(options.maxDelayMs).toBe(30000);
      expect(options.retryableErrors).toEqual(DEFAULT_RETRYABLE_ERRORS);
    });

    it("should respect maxAttempts from config", () => {
      const options = getDefaultRetryOptions({ maxAttempts: 5 });
      expect(options.maxAttempts).toBe(5);
    });

    it("should respect retryableErrors from config", () => {
      const customErrors = ["CUSTOM_ERROR"];
      const options = getDefaultRetryOptions({ retryableErrors: customErrors });
      expect(options.retryableErrors).toEqual(customErrors);
    });

    it("should handle enabled: false (not used in this implementation)", () => {
      const options = getDefaultRetryOptions({ enabled: false });
      // The enabled flag is checked externally, not in getDefaultRetryOptions
      expect(options.maxAttempts).toBe(3);
    });
  });

  describe("withRetry()", () => {
    it("should succeed on first try", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const options = getTestRetryOptions();

      const result = await withRetry(fn, options);

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable error and succeed", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ response: { status: 503 } })
        .mockResolvedValue("success");
      const options = getTestRetryOptions();

      const result = await withRetry(fn, options);

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should retry multiple times on retryable errors", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ response: { status: 502 } })
        .mockRejectedValueOnce({ response: { status: 503 } })
        .mockResolvedValue("success");
      const options = getTestRetryOptions();

      const result = await withRetry(fn, options);

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should throw after max retries on 429", async () => {
      const fn = vi.fn().mockRejectedValue({ response: { status: 429 } });
      const options = getTestRetryOptions();

      await expect(withRetry(fn, options)).rejects.toMatchObject({
        response: { status: 429 },
      });
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should throw NetworkError after max retries on network error", async () => {
      const fn = vi.fn().mockRejectedValue({ code: "ECONNRESET" });
      const options = getTestRetryOptions();

      await expect(withRetry(fn, options)).rejects.toThrow(NetworkError);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should not retry non-retryable errors", async () => {
      const fn = vi.fn().mockRejectedValue({ response: { status: 400 } });
      const options = getTestRetryOptions();

      await expect(withRetry(fn, options)).rejects.toMatchObject({
        response: { status: 400 },
      });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should not retry 401 Unauthorized", async () => {
      const fn = vi.fn().mockRejectedValue({ response: { status: 401 } });
      const options = getTestRetryOptions();

      await expect(withRetry(fn, options)).rejects.toMatchObject({
        response: { status: 401 },
      });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should respect retry-after header on 429 (uses delay)", async () => {
      // Use very short retry-after for test
      const fn = vi
        .fn()
        .mockRejectedValueOnce({
          response: {
            status: 429,
            headers: { "retry-after": "0" }, // 0 seconds for fast test
          },
        })
        .mockResolvedValue("success");
      const options = getTestRetryOptions();

      const result = await withRetry(fn, options);

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should use custom maxAttempts", async () => {
      const fn = vi.fn().mockRejectedValue({ response: { status: 500 } });
      const options = getTestRetryOptions({ maxAttempts: 5 });

      await expect(withRetry(fn, options)).rejects.toBeDefined();
      expect(fn).toHaveBeenCalledTimes(5);
    });

    it("should use custom retryableErrors", async () => {
      const fn = vi.fn().mockRejectedValue({ code: "CUSTOM_ERROR" });
      const options = getTestRetryOptions({
        retryableErrors: ["CUSTOM_ERROR"],
        maxAttempts: 2,
      });

      await expect(withRetry(fn, options)).rejects.toBeDefined();
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe("constants", () => {
    it("should export DEFAULT_RETRYABLE_ERRORS with network error codes", () => {
      expect(DEFAULT_RETRYABLE_ERRORS).toContain("ECONNRESET");
      expect(DEFAULT_RETRYABLE_ERRORS).toContain("ETIMEDOUT");
      expect(DEFAULT_RETRYABLE_ERRORS).toContain("ENOTFOUND");
      expect(DEFAULT_RETRYABLE_ERRORS).toContain("ECONNREFUSED");
    });

    it("should export RETRYABLE_STATUS_CODES with correct HTTP status codes", () => {
      expect(RETRYABLE_STATUS_CODES).toContain(429);
      expect(RETRYABLE_STATUS_CODES).toContain(500);
      expect(RETRYABLE_STATUS_CODES).toContain(502);
      expect(RETRYABLE_STATUS_CODES).toContain(503);
      expect(RETRYABLE_STATUS_CODES).toContain(504);
    });

    it("should NOT include 4xx errors in RETRYABLE_STATUS_CODES (except 429)", () => {
      expect(RETRYABLE_STATUS_CODES).not.toContain(400);
      expect(RETRYABLE_STATUS_CODES).not.toContain(401);
      expect(RETRYABLE_STATUS_CODES).not.toContain(403);
      expect(RETRYABLE_STATUS_CODES).not.toContain(404);
    });
  });
});
