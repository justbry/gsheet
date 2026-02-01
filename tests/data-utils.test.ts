import { describe, it, expect } from "vitest";
import {
  rowToObject,
  convertToObjects,
  prepareWriteData,
  matchesCondition,
} from "../src/core/data-utils";

describe("Data Conversion Utilities", () => {
  describe("rowToObject()", () => {
    it("should convert a row array to an object with headers", () => {
      const row = ["John", 30, "Engineer"];
      const headers = ["name", "age", "role"];
      const result = rowToObject(row, headers);

      expect(result).toEqual({
        name: "John",
        age: 30,
        role: "Engineer",
      });
    });

    it("should handle empty row", () => {
      const row: unknown[] = [];
      const headers = ["name", "age"];
      const result = rowToObject(row, headers);

      expect(result).toEqual({
        name: null,
        age: null,
      });
    });

    it("should handle row shorter than headers", () => {
      const row = ["John"];
      const headers = ["name", "age", "role"];
      const result = rowToObject(row, headers);

      expect(result).toEqual({
        name: "John",
        age: null,
        role: null,
      });
    });

    it("should handle row longer than headers", () => {
      const row = ["John", 30, "Engineer", "Extra"];
      const headers = ["name", "age"];
      const result = rowToObject(row, headers);

      expect(result).toEqual({
        name: "John",
        age: 30,
      });
    });

    it("should handle empty headers", () => {
      const row = ["John", 30];
      const headers: string[] = [];
      const result = rowToObject(row, headers);

      expect(result).toEqual({});
    });

    it("should handle null and undefined values in row", () => {
      const row = ["John", null, undefined, 0, false, ""];
      const headers = ["name", "value1", "value2", "value3", "value4", "value5"];
      const result = rowToObject(row, headers);

      expect(result).toEqual({
        name: "John",
        value1: null,
        value2: null,
        value3: 0,
        value4: false,
        value5: "",
      });
    });

    it("should handle various data types", () => {
      const row = [42, "text", true, false, 3.14, null];
      const headers = ["num", "str", "bool1", "bool2", "float", "nil"];
      const result = rowToObject(row, headers);

      expect(result).toEqual({
        num: 42,
        str: "text",
        bool1: true,
        bool2: false,
        float: 3.14,
        nil: null,
      });
    });
  });

  describe("convertToObjects()", () => {
    it("should convert 2D array to objects", () => {
      const data = [
        ["John", 30],
        ["Jane", 25],
        ["Bob", 35],
      ];
      const headers = ["name", "age"];
      const result = convertToObjects(data, headers);

      expect(result).toEqual([
        { name: "John", age: 30 },
        { name: "Jane", age: 25 },
        { name: "Bob", age: 35 },
      ]);
    });

    it("should handle empty data array", () => {
      const data: unknown[][] = [];
      const headers = ["name", "age"];
      const result = convertToObjects(data, headers);

      expect(result).toEqual([]);
    });

    it("should handle single row", () => {
      const data = [["John", 30]];
      const headers = ["name", "age"];
      const result = convertToObjects(data, headers);

      expect(result).toEqual([{ name: "John", age: 30 }]);
    });

    it("should handle rows with missing values", () => {
      const data = [
        ["John", 30],
        ["Jane"],
        ["Bob", 35, "extra"],
      ];
      const headers = ["name", "age"];
      const result = convertToObjects(data, headers);

      expect(result).toEqual([
        { name: "John", age: 30 },
        { name: "Jane", age: null },
        { name: "Bob", age: 35 },
      ]);
    });

    it("should preserve data types", () => {
      const data = [
        [42, "text", true],
        [0, "", false],
      ];
      const headers = ["num", "str", "bool"];
      const result = convertToObjects(data, headers);

      expect(result).toEqual([
        { num: 42, str: "text", bool: true },
        { num: 0, str: "", bool: false },
      ]);
    });

    it("should handle typed conversion", () => {
      interface User {
        name: string;
        age: number;
      }

      const data = [
        ["John", 30],
        ["Jane", 25],
      ];
      const headers = ["name", "age"];
      const result = convertToObjects<User>(data, headers);

      expect(result).toEqual([
        { name: "John", age: 30 },
        { name: "Jane", age: 25 },
      ]);
    });
  });

  describe("prepareWriteData()", () => {
    describe("with 2D array input", () => {
      it("should return 2D array as-is", () => {
        const data = [
          ["John", 30],
          ["Jane", 25],
        ];
        const result = prepareWriteData(data);

        expect(result).toEqual([
          ["John", 30],
          ["Jane", 25],
        ]);
      });

      it("should handle empty 2D array", () => {
        const data: unknown[][] = [];
        const result = prepareWriteData(data);

        expect(result).toEqual([]);
      });

      it("should ignore headers parameter for 2D array", () => {
        const data = [
          ["John", 30],
          ["Jane", 25],
        ];
        const result = prepareWriteData(data, ["name", "age"]);

        expect(result).toEqual([
          ["John", 30],
          ["Jane", 25],
        ]);
      });
    });

    describe("with object array input", () => {
      it("should convert objects to 2D array with auto-detected headers", () => {
        const data = [
          { name: "John", age: 30 },
          { name: "Jane", age: 25 },
        ];
        const result = prepareWriteData(data);

        expect(result).toEqual([
          ["name", "age"],
          ["John", 30],
          ["Jane", 25],
        ]);
      });

      it("should convert objects with custom headers", () => {
        const data = [
          { name: "John", age: 30, role: "Engineer" },
          { name: "Jane", age: 25, role: "Designer" },
        ];
        const result = prepareWriteData(data, ["name", "role"]);

        expect(result).toEqual([
          ["name", "role"],
          ["John", "Engineer"],
          ["Jane", "Designer"],
        ]);
      });

      it("should convert objects without header row when headers is false", () => {
        const data = [
          { name: "John", age: 30 },
          { name: "Jane", age: 25 },
        ];
        const result = prepareWriteData(data, false);

        expect(result).toEqual([
          ["John", 30],
          ["Jane", 25],
        ]);
      });

      it("should handle empty object array", () => {
        const data: Record<string, unknown>[] = [];
        const result = prepareWriteData(data);

        expect(result).toEqual([]);
      });

      it("should convert null/undefined to empty string", () => {
        const data = [
          { name: "John", value: null },
          { name: "Jane", value: undefined },
        ];
        const result = prepareWriteData(data);

        expect(result).toEqual([
          ["name", "value"],
          ["John", ""],
          ["Jane", ""],
        ]);
      });

      it("should handle objects with missing keys", () => {
        const data = [
          { name: "John", age: 30 },
          { name: "Jane" },
          { name: "Bob", age: 35 },
        ];
        const result = prepareWriteData(data);

        expect(result).toEqual([
          ["name", "age"],
          ["John", 30],
          ["Jane", ""],
          ["Bob", 35],
        ]);
      });

      it("should handle headers=true (auto-detect)", () => {
        const data = [
          { name: "John", age: 30 },
          { name: "Jane", age: 25 },
        ];
        const result = prepareWriteData(data, true);

        expect(result).toEqual([
          ["name", "age"],
          ["John", 30],
          ["Jane", 25],
        ]);
      });

      it("should handle headers=undefined (auto-detect)", () => {
        const data = [
          { name: "John", age: 30 },
          { name: "Jane", age: 25 },
        ];
        const result = prepareWriteData(data, undefined);

        expect(result).toEqual([
          ["name", "age"],
          ["John", 30],
          ["Jane", 25],
        ]);
      });

      it("should preserve data types", () => {
        const data = [
          { num: 42, str: "text", bool: true, zero: 0, empty: "" },
        ];
        const result = prepareWriteData(data);

        expect(result).toEqual([
          ["num", "str", "bool", "zero", "empty"],
          [42, "text", true, 0, ""],
        ]);
      });

      it("should handle custom headers with missing keys", () => {
        const data = [
          { name: "John", age: 30 },
          { name: "Jane", age: 25 },
        ];
        const result = prepareWriteData(data, ["name", "age", "role"]);

        expect(result).toEqual([
          ["name", "age", "role"],
          ["John", 30, ""],
          ["Jane", 25, ""],
        ]);
      });

      it("should handle empty object", () => {
        const data = [{}];
        const result = prepareWriteData(data);

        expect(result).toEqual([[], []]);
      });

      it("should preserve key order from first object", () => {
        const data = [
          { z: 3, a: 1, m: 2 },
          { z: 6, a: 4, m: 5 },
        ];
        const result = prepareWriteData(data);

        expect(result).toEqual([
          ["z", "a", "m"],
          [3, 1, 2],
          [6, 4, 5],
        ]);
      });
    });
  });

  describe("matchesCondition()", () => {
    describe("strict matching", () => {
      it("should match exact strings", () => {
        expect(matchesCondition("hello", "hello", "strict")).toBe(true);
        expect(matchesCondition("hello", "Hello", "strict")).toBe(false);
        expect(matchesCondition("hello", "world", "strict")).toBe(false);
      });

      it("should match exact numbers", () => {
        expect(matchesCondition(42, 42, "strict")).toBe(true);
        expect(matchesCondition(42, 43, "strict")).toBe(false);
        expect(matchesCondition(0, 0, "strict")).toBe(true);
        expect(matchesCondition(3.14, 3.14, "strict")).toBe(true);
      });

      it("should coerce string to number when one is number", () => {
        expect(matchesCondition("42", 42, "strict")).toBe(true);
        expect(matchesCondition(42, "42", "strict")).toBe(true);
        expect(matchesCondition("42", "42", "strict")).toBe(true);
        expect(matchesCondition("3.14", 3.14, "strict")).toBe(true);
      });

      it("should handle zero correctly", () => {
        expect(matchesCondition(0, 0, "strict")).toBe(true);
        expect(matchesCondition("0", 0, "strict")).toBe(true);
        expect(matchesCondition(0, "0", "strict")).toBe(true);
      });

      it("should match booleans", () => {
        expect(matchesCondition(true, true, "strict")).toBe(true);
        expect(matchesCondition(false, false, "strict")).toBe(true);
        expect(matchesCondition(true, false, "strict")).toBe(false);
        expect(matchesCondition(false, true, "strict")).toBe(false);
      });

      it("should handle null and undefined", () => {
        expect(matchesCondition(null, null, "strict")).toBe(true);
        expect(matchesCondition(undefined, undefined, "strict")).toBe(true);
        expect(matchesCondition(null, undefined, "strict")).toBe(true);
        expect(matchesCondition(undefined, null, "strict")).toBe(true);
        expect(matchesCondition(null, "null", "strict")).toBe(false);
        expect(matchesCondition("", null, "strict")).toBe(false);
        expect(matchesCondition(0, null, "strict")).toBe(false);
      });

      it("should not match different types", () => {
        expect(matchesCondition("true", true, "strict")).toBe(false);
        expect(matchesCondition("false", false, "strict")).toBe(false);
        expect(matchesCondition("", false, "strict")).toBe(false);
      });

      it("should handle empty strings", () => {
        expect(matchesCondition("", "", "strict")).toBe(true);
        expect(matchesCondition("", "hello", "strict")).toBe(false);
      });

      it("should handle NaN correctly", () => {
        // NaN never equals NaN
        expect(matchesCondition(NaN, NaN, "strict")).toBe(false);
        expect(matchesCondition("not a number", NaN, "strict")).toBe(false);
      });
    });

    describe("loose matching", () => {
      it("should do case-insensitive substring search", () => {
        expect(matchesCondition("Hello World", "world", "loose")).toBe(true);
        expect(matchesCondition("Hello World", "HELLO", "loose")).toBe(true);
        expect(matchesCondition("Hello World", "lo wo", "loose")).toBe(true);
        expect(matchesCondition("Hello World", "xyz", "loose")).toBe(false);
      });

      it("should convert numbers to strings for matching", () => {
        expect(matchesCondition(42, "42", "loose")).toBe(true);
        expect(matchesCondition(42, "4", "loose")).toBe(true);
        expect(matchesCondition(1234, "23", "loose")).toBe(true);
        expect(matchesCondition(42, "5", "loose")).toBe(false);
      });

      it("should handle boolean values", () => {
        expect(matchesCondition(true, "true", "loose")).toBe(true);
        expect(matchesCondition(true, "TRUE", "loose")).toBe(true);
        expect(matchesCondition(true, "tru", "loose")).toBe(true);
        expect(matchesCondition(false, "false", "loose")).toBe(true);
        expect(matchesCondition(false, "fal", "loose")).toBe(true);
      });

      it("should handle empty strings", () => {
        expect(matchesCondition("", "", "loose")).toBe(true);
        expect(matchesCondition("hello", "", "loose")).toBe(true);
        expect(matchesCondition("", "hello", "loose")).toBe(false);
      });

      it("should handle null and undefined as strings", () => {
        expect(matchesCondition(null, "null", "loose")).toBe(true);
        expect(matchesCondition(undefined, "undefined", "loose")).toBe(true);
        expect(matchesCondition(null, "nul", "loose")).toBe(true);
        expect(matchesCondition(undefined, "undef", "loose")).toBe(true);
      });

      it("should match when query is substring of cell", () => {
        expect(matchesCondition("JavaScript", "Java", "loose")).toBe(true);
        expect(matchesCondition("JavaScript", "Script", "loose")).toBe(true);
        expect(matchesCondition("JavaScript", "avaS", "loose")).toBe(true);
      });

      it("should be case-insensitive", () => {
        expect(matchesCondition("ABC", "abc", "loose")).toBe(true);
        expect(matchesCondition("abc", "ABC", "loose")).toBe(true);
        expect(matchesCondition("AbC", "aBc", "loose")).toBe(true);
      });

      it("should handle special characters", () => {
        expect(matchesCondition("hello@world.com", "@world", "loose")).toBe(true);
        expect(matchesCondition("$100.50", "$100", "loose")).toBe(true);
        expect(matchesCondition("test-value", "-val", "loose")).toBe(true);
      });

      it("should match exact values", () => {
        expect(matchesCondition("hello", "hello", "loose")).toBe(true);
        expect(matchesCondition(42, 42, "loose")).toBe(true);
      });

      it("should handle whitespace", () => {
        expect(matchesCondition("  spaces  ", "spaces", "loose")).toBe(true);
        expect(matchesCondition("hello world", "o w", "loose")).toBe(true);
      });
    });

    describe("edge cases", () => {
      it("should handle cell value as null with null query (strict)", () => {
        expect(matchesCondition(null, null, "strict")).toBe(true);
      });

      it("should handle cell value as undefined with undefined query (strict)", () => {
        expect(matchesCondition(undefined, undefined, "strict")).toBe(true);
      });

      it("should convert null to 'null' string (loose)", () => {
        expect(matchesCondition(null, "null", "loose")).toBe(true);
      });

      it("should handle numeric string vs number", () => {
        expect(matchesCondition("123", 123, "strict")).toBe(true);
        expect(matchesCondition("123", 123, "loose")).toBe(true);
      });

      it("should handle zero vs empty string", () => {
        expect(matchesCondition(0, "", "strict")).toBe(false);
        expect(matchesCondition(0, "", "loose")).toBe(true);
        expect(matchesCondition("", 0, "loose")).toBe(true);
      });

      it("should handle objects (converted to string)", () => {
        const obj = { toString: () => "custom" };
        expect(matchesCondition(obj, "custom", "loose")).toBe(true);
        expect(matchesCondition(obj, "cus", "loose")).toBe(true);
      });
    });
  });
});
