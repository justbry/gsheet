import { describe, it, expect } from "vitest";
import { WorkspaceSheets } from "../src/schemas";

describe("Schemas", () => {
  describe("WorkspaceSheets", () => {
    it("should contain only AGENTSCAPE", () => {
      const keys = Object.keys(WorkspaceSheets);
      expect(keys).toHaveLength(1);
      expect(keys).toContain('AGENTSCAPE');
    });

    it("should have correct value", () => {
      expect(WorkspaceSheets.AGENTSCAPE).toBe('AGENTSCAPE');
    });
  });
});
